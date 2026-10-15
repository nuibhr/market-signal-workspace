import test from 'node:test';
import assert from 'node:assert/strict';
import { loadChartCandles } from './chart-client.mjs';
const asset = { id: 'thai', symbol: 'PTT', instrumentId: 'SET100:PTT', feed: 'settrade-daily' };
const value = (time, options = {}) => ({ status: 'available', instrumentId: asset.instrumentId, timeframe: '15m', bars: [{ time }], freshness: 'recent', ...options });
const backup = time => value(time, { chartOnly: true, signalEligible: false, freshness: 'delayed', fallback: true });

test('native source is preferred; network errors and HTTP failures both reach the delayed backup', async () => {
  let calls = 0;
  assert.equal((await loadChartCandles(asset, '15m', { fetcher: async () => { calls++; return Response.json(value(1000)); } })).bars[0].time, 1000);
  assert.equal(calls, 1);
  for (const first of [() => { throw TypeError('offline'); }, () => Response.json({ code: 'SOURCE_UNAVAILABLE' }, { status: 503 })]) {
    const urls = [];
    const result = await loadChartCandles(asset, '15m', { fetcher: async url => { urls.push(url); return urls.length === 1 ? first() : Response.json(backup(900)); } });
    assert.equal(result.chartOnly, true); assert.equal(urls.length, 2); assert.match(urls[1], /^\/api\/history-bars\?/);
  }
});

test('a stuck native JSON body has a deadline and can recover with backup instead of hanging forever', async () => {
  let calls = 0;
  const result = await loadChartCandles(asset, '15m', { timeoutMs: 10, fetcher: async () => {
    if (++calls === 1) return { ok: true, json: () => new Promise(() => {}) };
    return Response.json(backup(900));
  } });
  assert.equal(calls, 2); assert.equal(result.chartOnly, true);
});

test('fallback cannot silently change instrument/frame or claim eligibility for live signals', async () => {
  for (const patch of [{ instrumentId: 'SET100:OTHER' }, { timeframe: '1h' }, { signalEligible: true }, { chartOnly: false }]) {
    let calls = 0;
    await assert.rejects(loadChartCandles(asset, '15m', { fetcher: async () => ++calls === 1 ? Response.json({}, { status: 503 }) : Response.json({ ...backup(900), ...patch }) }), { code: 'INVALID_BACKUP_SERIES' });
  }
});

test('stale native data triggers backup, but an older/failed backup never replaces newer candles', async () => {
  for (const [backupTime, expected] of [[2000, 2000], [500, 1000]]) {
    let calls = 0;
    const result = await loadChartCandles(asset, '15m', { fetcher: async () => Response.json(++calls === 1 ? value(1000, { freshness: 'stale' }) : backup(backupTime)) });
    assert.equal(calls, 2); assert.equal(result.bars[0].time, expected);
  }
  let calls = 0;
  const result = await loadChartCandles(asset, '15m', { fetcher: async () => ++calls === 1 ? Response.json(value(1000, { freshness: 'stale' })) : Response.json({}, { status: 503 }) });
  assert.equal(result.freshness, 'stale');
});

test('an aborted selection never starts a backup request or paints the old instrument', async () => {
  const controller = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  let calls = 0;
  const pending = loadChartCandles(asset, '15m', { signal: controller.signal, fetcher: async () => { calls++; started(); return new Promise(() => {}); } });
  await ready; controller.abort();
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(calls, 1);
});

test('TFEX 4H reaches the same-contract snapshot route; US intraday reaches Yahoo once', async () => {
  const tfex = { id: 'tfex', symbol: 'S50Z26', instrumentId: 'TFEX:S50Z26', feed: 'tfex-quote' }, urls = [];
  await loadChartCandles(tfex, '4h', { fetcher: async url => {
    urls.push(url);
    return urls.length === 1 ? Response.json({}, { status: 503 }) : Response.json({ ...backup(900), instrumentId: tfex.instrumentId, timeframe: '4h' });
  } });
  assert.match(urls[1], /history-bars\?symbol=S50Z26&market=tfex&timeframe=4h/);
  let calls = 0;
  const etf = { id: 'us', symbol: 'SPY', instrumentId: 'US_ETFS:SPY', feed: 'fmp-quote' };
  await loadChartCandles(etf, '15m', { fetcher: async url => { calls++; assert.match(url, /^\/api\/history-bars/); return Response.json({ ...backup(900), instrumentId: etf.instrumentId }); } });
  assert.equal(calls, 1);
});
