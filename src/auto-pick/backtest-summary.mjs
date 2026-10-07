import { createSettradeClient } from '../market-data/settrade.mjs';
import { getUsDailyBars } from '../market-data/us-eod.mjs';
import { archiveCandles } from './history-store.mjs';
import { storage } from '../storage/database.mjs';
import { historicalCandles } from './history-store.mjs';
import { replayThreeMonths } from './backtest.mjs';
import { THAI_ORB_RULE_VERSION } from './thai-orb.mjs';
import { DR_ORB_RULE_VERSION } from './dr-orb.mjs';
import { US_EOD_RULE_VERSION } from './us-engine.mjs';
import { SET100_SYMBOLS, MAI_INITIAL_SYMBOLS, DR80_SYMBOLS, US_STOCKS } from '../markets/catalog.mjs';
import { US_SCAN_SYMBOLS } from '../markets/us-universe.mjs';

const historyClient = createSettradeClient();
const versions = { thai: THAI_ORB_RULE_VERSION, dr: DR_ORB_RULE_VERSION, us: US_EOD_RULE_VERSION };
const usSet = new Set(US_STOCKS.map(item => item.symbol));
const universes = { thai: [...new Set([...SET100_SYMBOLS, ...MAI_INITIAL_SYMBOLS])], dr: [...new Set(DR80_SYMBOLS)], us: US_SCAN_SYMBOLS.filter(symbol => usSet.has(symbol)) };
const dayAt = now => new Date(now).toISOString().slice(0, 10);
const modelFor = market => `${versions[market]}:aggregate-v3`;

// One instrument per wake: HTTP reads never launch a whole-universe replay or provider request.
export async function refreshNextBacktest(now = Date.now()) {
  const day = dayAt(now);
  (await storage.run('DELETE FROM historical_replay_summaries WHERE report_day<?',dayAt(now - 7 * 86400000)));
  const observed = new Set((await storage.all("SELECT DISTINCT symbol FROM scanner_candles WHERE timeframe='1d'")).map(row => row.symbol));
  let next = null;
  for (const [market, symbols] of Object.entries(universes)) {
    const rows = (await storage.all('SELECT symbol,updated_at FROM historical_replay_summaries WHERE report_day=? AND market=? AND model=?',day, market, modelFor(market)));
    const saved = new Map(rows.map(row => [row.symbol, Date.parse(row.updated_at)]));
    for (const symbol of symbols) {
      const updated = saved.get(symbol) ?? 0;
      const priority = updated ? 2 : observed.has(symbol) ? 0 : 1;
      if (!next || priority < next.priority || priority === next.priority && updated < next.updated) next = { market, symbol, updated, priority };
    }
  }
  if (!next || next.updated && now - next.updated < 6 * 3600000) return null;
  const {market, symbol} = next;
  // Bounded provider work for one instrument, independent of the customer page.
  const displayAllowed = process.env.NODE_ENV !== 'production' || process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED === 'true';
  try {
    if (market === 'us') {
      const series = await getUsDailyBars(symbol, {now}); (await archiveCandles(symbol,'1d',series));
    } else if (displayAllowed && historyClient.configuration.configured) {
      const dailySeries = await historyClient.getCandles(symbol,'1d',1000);
      (await archiveCandles(symbol,'1d',dailySeries));
      const intradaySeries = await historyClient.getCandles(symbol,'15m',1000);
      (await archiveCandles(symbol,'15m',intradaySeries));
    }
  } catch { /* Keep archived observations; never fabricate missing history. */ }
  const daily = (await historicalCandles(symbol, '1d'));
  const intraday = market === 'us' ? [] : (await historicalCandles(symbol, '15m'));
  const result = replayThreeMonths({symbol, market, daily, intraday, now: Date.parse(`${day}T00:00:00Z`)});
  delete result.trades;
  (await storage.run('INSERT INTO historical_replay_summaries VALUES(?,?,?,?,?,?) ON CONFLICT(report_day,market,symbol,model) DO UPDATE SET result_json=excluded.result_json,updated_at=excluded.updated_at',day, market, symbol, modelFor(market), JSON.stringify(result), new Date(now).toISOString()));
  return {market, symbol};
}
export async function backtestSummary(market = 'all', now = Date.now()) {
  const day = dayAt(now);
  const end = new Date(`${day}T00:00:00Z`); const start = new Date(end); start.setUTCMonth(start.getUTCMonth() - 3);
  const markets = Object.keys(universes).filter(id => market === 'all' || id === market);
  const rows = await Promise.all(markets.map(async id => {
    const allowed = new Set(universes[id]);
    const saved = (await storage.all('SELECT symbol,result_json,updated_at FROM historical_replay_summaries WHERE report_day=? AND market=? AND model=?',day, id, modelFor(id))).filter(row => allowed.has(row.symbol));
    const results = saved.map(row => JSON.parse(row.result_json));
    const sum = field => results.reduce((total, row) => total + (row[field] ?? 0), 0);
    const closed = sum('closed');
    return {market: id, expected: allowed.size, processed: saved.length,
      withData: results.filter(row => row.evaluatedSessions > 0).length,
      completeHistory: results.filter(row => row.coverageComplete).length,
      plans: sum('plans'), entries: sum('entries'), closed, wins: sum('wins'), losses: sum('losses'),
      breakeven: sum('breakeven'), unresolved: sum('unresolved'), evaluatedSessions: sum('evaluatedSessions'),
      winRate: closed ? sum('wins') / closed * 100 : null,
      updatedAt: saved.map(row => row.updated_at).sort().at(-1) ?? null};
  }));
  const summary = Object.fromEntries(['expected','processed','withData','completeHistory','plans','entries','closed','wins','losses','breakeven','unresolved','evaluatedSessions'].map(key => [key, rows.reduce((total,row)=>total+row[key],0)]));
  summary.winRate = summary.closed ? summary.wins / summary.closed * 100 : null;
  return {status:'available', market, requestedFrom:start.toISOString().slice(0,10),requestedTo:day,
    updatedAt:rows.map(row=>row.updatedAt).filter(Boolean).sort().at(-1)??null, markets:rows, summary,
    coverageComplete:summary.expected>0 && summary.completeHistory===summary.expected && summary.processed===summary.expected,
    note:'ผลจำลองจากแท่งที่จัดเก็บ ก่อนค่าธรรมเนียมและสลิปเพจ · ไม่นับแผนไม่เข้าและผลตรวจไม่ได้ · ไม่ใช่ผลซื้อขายลูกค้า'};
}
