import { storage, operation as op } from '../storage/database.mjs';
export async function archiveCandles(symbol,timeframe,series) {
  const previous=new Map((await storage.all('SELECT time,bar_json,source FROM scanner_candles WHERE symbol=? AND timeframe=?',symbol,timeframe)).map(row=>[row.time,row]));
  const source=series.source??null;
  const changed=series.bars.map(bar=>({time:String(bar.time),json:JSON.stringify(bar)})).filter(bar=>{
    const old=previous.get(bar.time);return !old||old.bar_json!==bar.json||old.source!==source;
  });
  const sql=`INSERT INTO scanner_candles VALUES(?,?,?,?,?) ON CONFLICT(symbol,timeframe,time) DO UPDATE SET bar_json=excluded.bar_json,source=excluded.source
    WHERE scanner_candles.bar_json<>excluded.bar_json OR scanner_candles.source IS NOT excluded.source`;
  // Keep remote transactions bounded and retryable: each candle has a stable unique key.
  // Existing unchanged history is never rewritten on every scanner pass.
  for(let index=0;index<changed.length;index+=50) {
    await storage.batch(changed.slice(index,index+50).map(bar=>op(sql,symbol,timeframe,bar.time,bar.json,source)));
  }
}
export async function historicalCandles(symbol,timeframe) {
  const rows=await storage.all('SELECT bar_json FROM scanner_candles WHERE symbol=? AND timeframe=?',symbol,timeframe);
  return rows.map(row=>JSON.parse(row.bar_json)).sort((a,b)=>typeof a.time==='number'?a.time-b.time:a.time.localeCompare(b.time));
}
