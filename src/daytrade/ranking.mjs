// Read-only presentation score. Qualification, orders and the forward ledger are
// still owned by engine.mjs. This is NOT a win probability or a backtest result.
export const RANKING_VERSION = 'daytrade-quality-v1';
const clamp = value => Math.max(0, Math.min(1, value));
export function rankSetup(bars, values, setup) {
  if (!setup || !['LONG', 'SHORT'].includes(setup.side) || bars.length < 60) return null;
  const i = bars.length - 1, b = bars[i], fast = values.fast[i], slow = values.slow[i], atr = values.volatility[i];
  if (![b.open,b.high,b.low,b.close,fast,slow,atr,setup.stop].every(Number.isFinite) || atr <= 0 || b.high <= b.low) return null;
  const dir = setup.side === 'LONG' ? 1 : -1;
  const riskATR = dir * (b.close - setup.stop) / atr;
  if (!(riskATR > 0)) return null;
  const factors = [
    { label:'แนวโน้ม EMA20/50', points:dir*(fast-slow)>0?30:0, max:30 },
    { label:'ราคาปิดตามฝั่ง EMA20', points:dir*(b.close-fast)>0?25:0, max:25 },
    { label:'แรงปิดแท่งตามทิศทาง', points:Math.round(20*clamp((dir>0?b.close-b.low:b.high-b.close)/(b.high-b.low))), max:20 },
    { label:'ไม่ยืดห่าง EMA20', points:Math.round(15*clamp((3-Math.abs(b.close-fast)/atr)/2)), max:15 },
    { label:'ระยะ Stop ตาม ATR', points:Math.round(10*clamp((4-riskATR)/2)), max:10 },
  ];
  return { version:RANKING_VERSION, score:Math.max(1,factors.reduce((sum,f)=>sum+f.points,0)), factors, side:setup.side, evaluatedAt:(b.time+900)*1000 };
}

// Input must have passed monitorRow's freshness/connection checks. Never pad the
// shortlist with waiting/stale/replay rows, or mix another market into its MVP.
export function topOpportunities(rows, market) {
  const seen = new Set();
  return rows.filter(r=>r.market===market && r.met && !r.abnormal && r.side &&
    r.ranking?.version===RANKING_VERSION && r.ranking.side===r.side &&
    r.ranking.evaluatedAt===(r.latestBar+900)*1000 &&
    Number.isInteger(r.ranking.score) && r.ranking.score>=1 && r.ranking.score<=100)
    .sort((a,b)=>b.ranking.score-a.ranking.score || b.ranking.evaluatedAt-a.ranking.evaluatedAt || a.symbol.localeCompare(b.symbol))
    .filter(r=>{if(seen.has(r.symbol))return false;seen.add(r.symbol);return true;}).slice(0,5);
}
