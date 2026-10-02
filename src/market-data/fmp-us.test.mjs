import test from 'node:test';
import assert from 'node:assert/strict';
import { getFmpDailyBars } from './fmp-us.mjs';
const row = (date, extra={}) => ({ symbol:'NVDA',date,open:100,high:105,low:99,close:104,volume:1000,...extra });
const fetcher = rows => async () => Response.json(rows);
test('US chart/scanner reject the open daily candle until after the close', async () => {
  const rows = [row('2026-09-30'),row('2026-10-01')];
  const before = await getFmpDailyBars('NVDA',{now:Date.parse('2026-10-01T18:00:00Z'),apiKey:'test',fetcher:fetcher(rows)});
  const after = await getFmpDailyBars('NVDA',{now:Date.parse('2026-10-01T21:00:00Z'),apiKey:'test',fetcher:fetcher(rows)});
  assert.equal(before.latestDay,'2026-09-30');
  assert.equal(after.latestDay,'2026-10-01');
});
test('US duplicate days and malformed OHLC cannot enter a signal', async () => {
  const data = await getFmpDailyBars('NVDA',{now:Date.parse('2026-10-01T21:00:00Z'),apiKey:'test',
    fetcher:fetcher([row('2026-09-28'),row('2026-09-29'),row('2026-09-29'),row('2026-09-30',{high:98})])});
  assert.deepEqual(data.bars.map(b=>b.time),['2026-09-28']);
});
