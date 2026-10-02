// Read-only replay of today's Thai candidate window. Never writes picks or events.
import { createSettradeClient } from '../src/market-data/settrade.mjs';
import { thaiScanSymbols } from '../src/auto-pick/runner.mjs';
import { bangkokParts } from '../src/auto-pick/engine.mjs';
import { completedCandles } from '../src/analysis/pivots.mjs';
import { buildTradePlan } from '../src/analysis/trade-plan.mjs';
import { normalizeThaiTradePlan } from '../src/analysis/thai-tick.mjs';

const client = createSettradeClient();
const day = bangkokParts().day;
const asOf = Date.parse(`${day}T11:14:00+07:00`);
const results = [];
await client.login();
for (const symbol of thaiScanSymbols()) {
  try {
    const [fifteen, oneHour, fourHour, daily] = await Promise.all(['15m', '1h', '4h', '1d'].map(frame => client.getCandles(symbol, frame)));
    const lastClosed = completedCandles(fifteen.bars, '15m', asOf).at(-1);
    if (!lastClosed || bangkokParts(lastClosed.time * 1000).day !== day
      || asOf - (lastClosed.time + 900) * 1000 >= 45 * 60_000) {
      results.push({ symbol, state: 'NO_CURRENT_SESSION_CANDLE' });
      continue;
    }
    const plan = normalizeThaiTradePlan(buildTradePlan({ symbol, instrumentId: `SET100:${symbol}`,
      dailyBars: daily.bars, fourHourBars: fourHour.bars, oneHourBars: oneHour.bars, now: asOf, allowShort: false }));
    results.push({ symbol, state: plan.tradeAllowed ? 'CANDIDATE' : 'REJECTED',
      code: plan.code ?? null, score: plan.signalScore ?? null,
      bars: { m15: fifteen.bars.length, h1: oneHour.bars.length, h4: fourHour.bars.length, d1: daily.bars.length } });
  } catch {
    results.push({ symbol, state: 'SOURCE_UNAVAILABLE' });
  }
}
process.stdout.write(`${JSON.stringify({ mode: 'read-only-replay', day, asOf: new Date(asOf).toISOString(),
  checked: results.length, available: results.filter(item => ['CANDIDATE', 'REJECTED'].includes(item.state)).length,
  candidates: results.filter(item => item.state === 'CANDIDATE').length, results })}\n`);
