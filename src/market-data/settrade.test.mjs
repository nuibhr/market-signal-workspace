import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessDailySeries, createSettradeClient, normalizeSettradeDailyCandles, normalizeSettradeQuote, SettradeDataError } from './settrade.mjs';

test('quote distinguishes provider observation time from receipt time', () => {
  const quote = normalizeSettradeQuote({ last: 42.5 }, 'PTT', '2026-09-25T03:00:00.000Z');
  assert.equal(quote.price, 42.5);
  assert.equal(quote.observedAt, null);
  assert.equal(quote.receivedAt, '2026-09-25T03:00:00.000Z');
  assert.equal(quote.latency, 'unknown');
});

test('daily bars reject invalid dates, missing OHLCV and ambiguous duplicates', () => {
  const series = normalizeSettradeDailyCandles({
    time: ['2026-09-21', 'bad', '2026-09-23', '2026-09-23', '2026-09-24'],
    open: [10, 10, 12, 12, 13],
    high: [12, 11, 14, 14, 15],
    low: [9, 9, 11, 11, 12],
    close: [11, 10, 13, 13, 14],
    volume: [100, 100, 100, 100, -1],
  }, 'PTT', '2026-09-25T03:00:00.000Z');
  assert.deepEqual(series.bars.map(bar => bar.time), ['2026-09-21']);
  assert.deepEqual(series.diagnostics, { received: 5, rejected: 4 });
});

test('an 84-day-old daily close cannot qualify a new signal', () => {
  const series = { bars: [{ time: '2026-07-03' }] };
  const result = assessDailySeries(series, Date.parse('2026-09-25T04:03:00.000Z'));
  assert.deepEqual(result, { freshness: 'stale', latestDay: '2026-07-03', ageDays: 84, signalEligible: false });
});

test('client keeps secret out of responses and handles auth failure as status only', async () => {
  const env = {
    SETTRADE_BROKER_ID: '022', SETTRADE_APP_CODE: 'test-app', BROKER_APP_ID: 'test-id',
    BROKER_API_SECRET: Buffer.alloc(32, 1).toString('base64'),
  };
  const requests = [];
  const client = createSettradeClient({ env, fetcher: async (url, init) => {
    requests.push({ url, init });
    return { ok: false, status: 404 };
  }, now: () => 1_700_000_000_000 });
  await assert.rejects(client.getQuote('PTT'), error => error instanceof SettradeDataError && error.code === 'AUTH_FAILED' && error.status === 404);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.method, 'POST');
  assert.equal(JSON.stringify(client.configuration).includes(env.BROKER_API_SECRET), false);
});

test('client makes read-only quote and candle calls after authentication', async () => {
  const env = {
    SETTRADE_BROKER_ID: '022', SETTRADE_APP_CODE: 'test-app', BROKER_APP_ID: 'test-id',
    BROKER_API_SECRET: Buffer.alloc(32, 1).toString('base64'),
  };
  const requests = [];
  const client = createSettradeClient({ env, now: () => 1_700_000_000_000, fetcher: async (url, init) => {
    requests.push({ url, method: init.method ?? 'GET' });
    const body = url.endsWith('/login')
      ? { access_token: 'private-token', expires_in: 3600 }
      : url.includes('/quote/') ? { last: 33 } : { time: ['2026-09-24'], open: [32], high: [34], low: [31], close: [33], volume: [100] };
    return { ok: true, json: async () => body };
  } });
  assert.equal((await client.getQuote('PTT')).price, 33);
  assert.equal((await client.getDailyCandles('PTT')).bars.length, 1);
  assert.deepEqual(requests.map(request => request.method), ['POST', 'GET', 'GET']);
  assert.equal(requests.some(request => /account|order|portfolio/.test(request.url)), false);
});
