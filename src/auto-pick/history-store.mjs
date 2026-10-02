import { sharedDatabase } from '../membership/store.mjs';
function db(){const d=sharedDatabase();d.exec(`CREATE TABLE IF NOT EXISTS scanner_candles(symbol TEXT NOT NULL,timeframe TEXT NOT NULL,time TEXT NOT NULL,bar_json TEXT NOT NULL,source TEXT,PRIMARY KEY(symbol,timeframe,time))`);return d;}
export function archiveCandles(symbol,timeframe,series){
 const d=db();const stmt=d.prepare('INSERT INTO scanner_candles VALUES(?,?,?,?,?) ON CONFLICT(symbol,timeframe,time) DO UPDATE SET bar_json=excluded.bar_json,source=excluded.source');
 d.exec('BEGIN IMMEDIATE');try{for(const bar of series.bars)stmt.run(symbol,timeframe,String(bar.time),JSON.stringify(bar),series.source??null);d.exec('COMMIT');}catch(e){d.exec('ROLLBACK');throw e;}
}
export function historicalCandles(symbol,timeframe){return db().prepare('SELECT bar_json FROM scanner_candles WHERE symbol=? AND timeframe=?').all(symbol,timeframe).map(r=>JSON.parse(r.bar_json)).sort((a,b)=>typeof a.time==='number'?a.time-b.time:a.time.localeCompare(b.time));}
