import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const temporary = mkdtempSync(join(tmpdir(), 'nugaom-chart-backup-'));
process.env.DATABASE_PATH = join(temporary, 'fixture.sqlite');
const { sharedDatabase } = await import('../storage/sqlite.mjs');
const { delayedChartSeries, candleClosedAt, rememberChartSnapshot, delayedChartSnapshot } = await import('./delayed-candles.mjs');
const { loadChartBackup } = await import('./chart-backup.mjs');
const { getYahooHistory, isYahooCandleStart } = await import('./yahoo-history.mjs');
test.after(() => { sharedDatabase().close(); rmSync(temporary, { recursive: true, force: true }); });

const now = Date.parse('2026-10-15T04:00:00Z');
const asset = { id: 'tfex', symbol: 'S50Z26', instrumentId: 'TFEX:S50Z26' };
const bar = (time, close = 100) => ({ time: Date.parse(time) / 1000, open: close, high: close + 1, low: close - 1, close, volume: 100 });
const series = (bars, instrument = asset) => ({ status: 'available', instrumentId: instrument.instrumentId, timeframe: '15m', source: 'TFEX Open API', receivedAt: new Date(now).toISOString(), bars, quote: { price: 999 }, signalEligible: true, privateField: 'must not persist' });
const bars = [bar('2026-10-15T03:30:00Z'), bar('2026-10-15T03:45:00Z'), bar('2026-10-15T04:00:00Z')];

test('15-minute fallback includes only candles known by its availability cutoff and never a live quote or signal', () => {
  const value = delayedChartSeries(series(bars), asset, '15m', now);
  assert.equal(value.bars.length, 1); assert.equal(value.bars[0].time, bars[0].time);
  assert.equal(value.dataAsOf, '2026-10-15T03:45:00.000Z'); assert.equal(value.observedDelaySeconds, 900);
  assert.equal(value.minimumDelayMinutes, 15); assert.equal(value.quote, null);
  assert.equal(value.signalEligible, false); assert.equal(value.executionEligible, false); assert.equal(value.chartOnly, true);
  assert.equal(series(bars).signalEligible, true);
});

test('cache roundtrip preserves an exact TFEX contract and rejects older concurrent snapshots', async () => {
  await rememberChartSnapshot(series(bars.slice(0, 2)), asset, '15m', now);
  await rememberChartSnapshot(series(bars.slice(0, 1)), asset, '15m', now + 1);
  const value = await delayedChartSnapshot(asset, '15m', now + 15 * 60000);
  assert.equal(value.bars.length, 2); assert.equal(value.quote, null);
  assert.equal(value.privateField, undefined); assert.equal(value.symbol, 'S50Z26');
  assert.equal(await delayedChartSnapshot({ ...asset, symbol: 'S50H27', instrumentId: 'TFEX:S50H27' }, '15m', now), null);
  assert.equal(await delayedChartSnapshot(asset, '1h', now), null);
  assert.equal(await delayedChartSnapshot(asset, '15m', now + 8 * 86400000), null);
});

test('bad OHLC, duplicate/unsorted bars and instrument/timeframe mismatches cannot be fallback data', () => {
  for (const value of [series([bars[0], bars[0]]), series([...bars].reverse()), series([{ ...bars[0], low: 500 }]),
    { ...series(bars), instrumentId: 'TFEX:GOZ26' }, { ...series(bars), timeframe: '1h' }])
    assert.equal(delayedChartSeries(value, asset, '15m', now), null);
  assert.equal(delayedChartSeries(series([bars[2]]), asset, '15m', now), null);
  const stale = delayedChartSeries(series([bars[0]]), asset, '15m', now + 3 * 3600000);
  assert.equal(stale.freshness, 'stale'); assert.equal(stale.observedDelaySeconds, 11700);
});

test('daily candle availability uses the actual US close across DST and rejects invalid dates', () => {
  assert.equal(new Date(candleClosedAt({ time: '2026-10-15' }, '1d', 'us')).toISOString(), '2026-10-15T20:00:00.000Z');
  assert.equal(new Date(candleClosedAt({ time: '2026-11-05' }, '1d', 'us')).toISOString(), '2026-11-05T21:00:00.000Z');
  assert.ok(Number.isNaN(candleClosedAt({ time: '2026-02-30' }, '1d', 'thai')));
});

test('native delayed backup remains usable without Yahoo; stale backups are replaced only by newer data', async () => {
  const cached = delayedChartSeries(series(bars), asset, '15m', now);
  let calls = 0;
  const selected = await loadChartBackup(asset, '15m', { env: {}, snapshot: async () => cached, yahoo: async () => { calls++; throw Error('not needed'); } });
  assert.equal(selected, cached); assert.equal(calls, 0);
  const stale = { ...cached, freshness: 'stale' }, newer = { ...cached, dataAsOf: '2026-10-15T04:00:00Z' };
  assert.equal(await loadChartBackup(asset, '15m', { env: {}, snapshot: async () => stale, yahoo: async () => newer }), newer);
  assert.equal(await loadChartBackup(asset, '15m', { env: {}, snapshot: async () => stale, yahoo: async () => { throw Error('offline'); } }), stale);
});

test('production fallback checks the actual provider rights independently, including cached US candles', async () => {
  let reads = 0;
  await assert.rejects(loadChartBackup(asset, '15m', { env: { NODE_ENV: 'production' }, snapshot: async () => { reads++; } }), { code: 'DISPLAY_RIGHTS_NOT_CONFIRMED' });
  assert.equal(reads, 0);
  const cached = delayedChartSeries(series(bars), asset, '15m', now);
  assert.equal(await loadChartBackup(asset, '15m', { env: { NODE_ENV: 'production', TFEX_DISPLAY_RIGHTS_CONFIRMED: 'true' }, snapshot: async () => cached }), cached);
  const us = { id: 'us', symbol: 'NVDA', instrumentId: 'US_STOCKS:NVDA' };
  await assert.rejects(loadChartBackup(us, '1d', { env: { NODE_ENV: 'production', YAHOO_EOD_DISPLAY_RIGHTS_CONFIRMED: 'true' },
    snapshot: async () => ({ source: 'Financial Modeling Prep · EOD', freshness: 'delayed' }) }), { code: 'BACKUP_NOT_AVAILABLE' });
});

test('Yahoo preserves native DR identity and enforces the additional availability lag', async () => {
  const dr = { id: 'dr', symbol: 'AAPL80', instrumentId: 'DR80:AAPL80' };
  const response = { meta: { symbol: 'AAPL80.BK', currency: 'THB', exchangeName: 'SET' }, quotes: bars.map(b => ({ ...b, date: new Date(b.time * 1000) })) };
  let ticker;
  const value = await getYahooHistory(dr, '15m', { now, chartFetcher: async requested => { ticker = requested; return response; } });
  assert.equal(ticker, 'AAPL80.BK'); assert.equal(value.bars.length, 1); assert.equal(value.fallbackKind, 'yahoo');
  assert.equal(value.signalEligible, false); assert.equal(value.quote, null);
  await assert.rejects(getYahooHistory(dr, '15m', { now, chartFetcher: async () => ({ ...response, meta: { ...response.meta, symbol: 'AAPL', currency: 'USD' } }) }), { code: 'INSTRUMENT_MISMATCH' });
});
test('a seconds-level Yahoo live observation cannot masquerade as a completed candle', async () => {
  const thai = { id: 'thai', symbol: 'PTT', instrumentId: 'SET100:PTT' };
  const data = await getYahooHistory(thai, '15m', { now, chartFetcher: async () => ({ meta: { symbol: 'PTT.BK', currency: 'THB', exchangeName: 'SET' },
    quotes: [{ ...bars[0], date: new Date('2026-10-15T03:10:11Z') }, { ...bars[0], date: new Date('2026-10-15T03:30:00Z') }] }) });
  assert.equal(data.bars.length, 1); assert.equal(data.bars[0].time, bars[0].time);
});
test('a Yahoo close quote at 16:00 NY or a misaligned timestamp cannot become a regular-session intraday bar', () => {
  for (const frame of ['15m', '1h']) assert.equal(isYahooCandleStart(Date.parse('2026-10-14T20:00:00Z'), frame, 'us'), false);
  assert.equal(isYahooCandleStart(Date.parse('2026-10-14T19:30:00Z'), '1h', 'us'), true);
  assert.equal(isYahooCandleStart(Date.parse('2026-11-05T20:45:00Z'), '15m', 'us'), true);
  assert.equal(isYahooCandleStart(Date.parse('2026-10-15T03:10:00Z'), '15m', 'thai'), false);
});

test('Yahoo ETF cannot be replaced with stock/index data, and TFEX never maps to a foreign future or index', async () => {
  const etf = { id: 'us', symbol: 'SPY', sectionId: 'US_ETFS', instrumentId: 'US_ETFS:SPY' };
  for (const patch of [{ instrumentType: 'EQUITY' }, { currency: 'THB' }, { exchangeName: 'SET' }]) {
    await assert.rejects(getYahooHistory(etf, '1d', { now, chartFetcher: async () => ({ meta: { symbol: 'SPY', currency: 'USD', instrumentType: 'ETF', exchangeName: 'PCX', ...patch }, quotes: [] }) }), { code: 'INSTRUMENT_MISMATCH' });
  }
  let calls = 0;
  await assert.rejects(getYahooHistory(asset, '15m', { chartFetcher: async () => { calls++; } }), { code: 'INSTRUMENT_NOT_SUPPORTED' });
  assert.equal(calls, 0);
});

test('native D1 retains and restores the same exact-contract delayed snapshot across request contexts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'nugaom-chart-d1-')), configPath = join(directory, 'wrangler.json');
  writeFileSync(configPath, JSON.stringify({ name: 'nugaom-chart-fixture', compatibility_date: '2026-10-07',
    d1_databases: [{ binding: 'DB', database_name: 'fixture', database_id: '00000000-0000-0000-0000-000000000000', migrations_dir: resolve('deploy/cloudflare/migrations') }] }));
  const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'migrations', 'apply', 'DB', '--local', '--config', configPath], { encoding: 'utf8', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  assert.equal(result.status, 0);
  const { getPlatformProxy } = await import('wrangler');
  const proxy = await getPlatformProxy({ configPath, persist: { path: join(directory, '.wrangler/state/v3') } });
  const { withD1Database } = await import('../storage/database.mjs');
  try {
    await withD1Database(proxy.env.DB, () => rememberChartSnapshot(series(bars.slice(0, 2)), asset, '15m', now));
    await withD1Database(proxy.env.DB, () => rememberChartSnapshot(series(bars.slice(0, 1)), asset, '15m', now + 1));
    const snapshot = await withD1Database(proxy.env.DB, () => delayedChartSnapshot(asset, '15m', now + 15 * 60000));
    assert.equal(snapshot.bars.length, 2); assert.equal(snapshot.symbol, 'S50Z26'); assert.equal(snapshot.quote, null);
    assert.equal(snapshot.signalEligible, false); assert.equal(snapshot.minimumDelayMinutes, 15);
  } finally { await proxy.dispose(); rmSync(directory, { recursive: true, force: true }); }
});
