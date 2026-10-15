import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseCandleCsv, inspectSwingDataset, inspectSwingManifest } from './dataset.mjs';
const header = 'time,open,high,low,close,Volume\n';
test('TradingView-style CSV accepts explicit timezone/epoch timestamps and rejects ambiguous time, bad OHLC and duplicates', () => {
  assert.equal(parseCandleCsv('\uFEFF' + header + '2026-10-15T10:00:00+07:00,100,102,99,101,1000\n', '4h')[0].close, 101);
  assert.equal(parseCandleCsv(header + '2026-10-15T00:00:00+07:00,100,102,99,101,1000\n', '1d', { timeZone: 'Asia/Bangkok' })[0].time, '2026-10-15');
  for (const row of ['2026-10-15 10:00:00,100,102,99,101,1000', '2026-10-15T10:00:00Z,100,99,98,101,1000',
    '2026-10-15T10:00:00Z,,102,99,101,1000']) assert.throws(() => parseCandleCsv(header + row, '4h'));
  assert.throws(() => parseCandleCsv(header + '2026-10-15,100,102,99,101,1000\n2026-10-15,100,102,99,101,1000', '1d'));
  assert.throws(() => parseCandleCsv(header + '2026-02-30,100,102,99,101,1000', '1d'));
  assert.throws(() => parseCandleCsv(header + '1792022400,100,102,99,101,1000\n1792026000,100,102,99,101,1000', '1d'));
});
test('missing files/calendar/warmup/execution coverage cannot be reported as a completed three-year backtest', () => {
  const report = inspectSwingDataset({ market: 'thai', timezone: 'Asia/Bangkok' }, {});
  assert.equal(report.status, 'blocked'); assert.equal(report.strategyValidated, false);
  for (const code of ['D1_AND_4H_REQUIRED', 'TRADING_CALENDAR_REQUIRED', 'PRE_START_WARMUP_200_DAILY_BARS_REQUIRED',
    'EXECUTION_BARS_REQUIRED_FOR_15M_DELAY', 'EXECUTION_SESSION_COVERAGE_UNVERIFIED', 'ENTRY_RULE_REQUIRED']) assert.ok(report.blocked.includes(code));
  assert.ok(Math.abs(report.costs.approximateRoundTripPercent - 0.4384) < 1e-9);
});
test('even an old first bar does not prove middle/end coverage; absent 4H and execution sessions remain visible', () => {
  const report = inspectSwingDataset({ market: 'thai', timezone: 'Asia/Bangkok', from: '2023-10-15', toExclusive: '2026-10-15',
    tradingDays: ['2023-10-16', '2024-10-16', '2026-10-14'], expected4hBarsByDay: {}, expected15mBarsByDay: {} },
    { '1d': [{ time: '2023-10-16' }], '4h': [{ time: Date.parse('2023-10-16T03:00:00Z') / 1000 }], '15m': [{ time: Date.parse('2023-10-16T03:00:00Z') / 1000 }] });
  assert.deepEqual(report.missingDailyDays, ['2024-10-16', '2026-10-14']);
  assert.ok(report.blocked.includes('MISSING_DAILY_SESSIONS'));
  assert.ok(report.blocked.includes('INTRADAY_SESSION_COVERAGE_UNVERIFIED'));
  assert.ok(report.blocked.includes('EXECUTION_SESSION_COVERAGE_UNVERIFIED'));
});
test('CSV loader hashes public bars without outputting paths and refuses a symlink escape or Parquet masquerading as CSV', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nugaom-swing-data-'));
  const outside = mkdtempSync(join(tmpdir(), 'nugaom-outside-'));
  try {
    writeFileSync(join(directory, 'daily.csv'), header + '2023-10-16,100,102,99,101,1000');
    writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ market: 'thai', timezone: 'Asia/Bangkok', files: { '1d': 'daily.csv' } }));
    const report = inspectSwingManifest(join(directory, 'manifest.json'));
    assert.match(report.datasetHashes['1d'], /^[a-f0-9]{64}$/); assert.ok(!JSON.stringify(report).includes(directory));
    writeFileSync(join(outside, 'bars.csv'), header); symlinkSync(join(outside, 'bars.csv'), join(directory, 'escape.csv'));
    writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ files: { '1d': 'escape.csv' } }));
    assert.throws(() => inspectSwingManifest(join(directory, 'manifest.json')), { code: 'DATASET_FILE_OUTSIDE_ROOT_OR_TOO_LARGE' });
    writeFileSync(join(directory, 'bars.parquet'), 'fixture');
    writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ files: { '1d': 'bars.parquet' } }));
    assert.throws(() => inspectSwingManifest(join(directory, 'manifest.json')), { code: 'PARQUET_TO_CSV_REQUIRED' });
  } finally { rmSync(directory, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
});
