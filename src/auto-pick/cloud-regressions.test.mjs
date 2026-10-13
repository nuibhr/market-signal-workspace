import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'nugaom-cloud-regressions-'));
process.env.DATABASE_PATH = join(dir, 'fixtures.sqlite');
process.env.STORAGE_PROVIDER = 'sqlite';
const { storage } = await import('../storage/database.mjs');
const { sharedDatabase } = await import('../storage/sqlite.mjs');
const { createCloudScanner, MAX_SCAN_ATTEMPTS } = await import('./cloud-jobs.mjs');
const { createSignal, saveAdvance, signalForSession, cloudScannerProcessHealth, recordScanProgress, scannerHealth } = await import('./store.mjs');
const { advanceThaiOrbPick } = await import('./thai-orb.mjs');
const { SET100_SYMBOLS, MAI_INITIAL_SYMBOLS } = await import('../markets/catalog.mjs');
test.after(() => { sharedDatabase().close(); rmSync(dir, { recursive: true, force: true }); });
const at = s => Date.parse(`2026-10-07T${s}:00+07:00`);

test('Cloud gives the final entry candle to the monitor before expiring a waiting plan', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: at('10:15') });
  const opening = { time: at('10:00') / 1000, open: 100, high: 100.1, low: 99.8, close: 100, volume: 10000 };
  const plan = { id: 'cloud-final-entry', setupType: 'OPENING_RANGE_BREAKOUT', tradeAllowed: true, entry: 100.1, stopLoss: 98.5, tp1: 104,
    referenceCandles: { fifteenMinuteTimestamp: opening.time }, features: { minEntryBarValue: 500000 } };
  const pick = await createSignal({ market: 'thai', symbol: 'PTT', sessionDay: '2026-10-07', plan, source: 'FIXTURE ONLY' });
  await saveAdvance({ ...pick, lastChecked15m: at('10:45') / 1000 }, []);
  const bars = [opening, ...['10:15', '10:30', '10:45'].map(s => ({ ...opening, time: at(s) / 1000 })),
    { ...opening, time: at('11:00') / 1000, open: 100.1, high: 100.3, low: 100, close: 100.2 }];
  const sent = [], queue = { async sendBatch(messages) { sent.push(...messages.map(m => m.body.id)); } };
  const scanner = createCloudScanner({ readiness: () => ({ markets: [{ id: 'thai', status: 'active' }] }),
    windowFor: () => ({ key: '2026-10-07', monitor: true, candidate: false, symbols: ['PTT'] }),
    runMarket: { thai: async now => {
      const before = await signalForSession('thai', 'PTT', '2026-10-07');
      const result = advanceThaiOrbPick(before, bars, now); await saveAdvance(result.pick, result.events);
      return { status: 'complete' };
    } } });
  t.mock.timers.setTime(at('11:30'));
  await scanner.scheduleScans(queue);
  assert.equal((await signalForSession('thai', 'PTT', '2026-10-07')).status, 'WAITING_FOR_ENTRY');
  assert.equal(sent.length, 1);
  await scanner.consumeScan(sent[0]);
  assert.equal((await signalForSession('thai', 'PTT', '2026-10-07')).status, 'OPEN');
});

test('database attempts and job age are bounded even across new Queue deliveries', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: at('12:00') });
  let calls = 0;
  const scanner = createCloudScanner({ readiness: () => ({ markets: [{ id: 'thai', status: 'active' }] }),
    windowFor: () => ({ key: '2026-10-07', monitor: true, candidate: false, symbols: ['PTT'] }),
    runMarket: { thai: async () => { calls++; throw Error('SOURCE_UNAVAILABLE'); } } });
  const id = 'b'.repeat(64), ageId = 'c'.repeat(64);
  const insert = async (key, createdAt) => storage.run(`INSERT INTO scanner_jobs(id,market,session_key,slot,payload_json,available_at,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?)`, key, 'thai', '2026-10-07', 'fixture', JSON.stringify({ symbols: ['PTT'] }), 0, createdAt, createdAt);
  await insert(id, new Date().toISOString());
  for (let i = 1; i <= MAX_SCAN_ATTEMPTS; i++) {
    if (i > 1) t.mock.timers.tick(300001);
    const result = await scanner.consumeScan(id);
    assert.equal(result.status, i === MAX_SCAN_ATTEMPTS ? 'failed' : 'retry');
  }
  assert.equal((await scanner.consumeScan(id)).status, 'ignored');
  assert.equal(calls, MAX_SCAN_ATTEMPTS);
  const failed = await storage.first('SELECT state,error_code,attempts FROM scanner_jobs WHERE id=?', id);
  assert.deepEqual({ ...failed }, { state: 'failed', error_code: 'RETRY_EXHAUSTED', attempts: MAX_SCAN_ATTEMPTS });
  await insert(ageId, new Date(Date.now() - 31 * 60000).toISOString());
  assert.equal((await scanner.consumeScan(ageId)).status, 'ignored');
  assert.equal((await storage.first('SELECT error_code FROM scanner_jobs WHERE id=?', ageId)).error_code, 'JOB_EXPIRED');
  assert.equal(calls, MAX_SCAN_ATTEMPTS);
});

test('Cloud heartbeat alone cannot certify a running scanner or successful consumer', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: at('14:00') });
  const keys = ['AUTO_PICK_ENABLED', 'AUTO_PICK_DR_ENABLED', 'AUTO_PICK_US_ENABLED', 'AUTO_PICK_RUN_SECRET', 'NODE_ENV'];
  const before = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    process.env.AUTO_PICK_ENABLED = 'false'; process.env.AUTO_PICK_DR_ENABLED = 'false'; process.env.AUTO_PICK_US_ENABLED = 'false';
    process.env.AUTO_PICK_RUN_SECRET = 'x'.repeat(32); process.env.NODE_ENV = 'test';
    await storage.run("DELETE FROM scanner_jobs");
    await storage.run("INSERT INTO cloud_scanner_state(id,last_scheduled_at,cron,dispatch_count) VALUES(1,?,'*/5 * * * *',0) ON CONFLICT(id) DO UPDATE SET last_scheduled_at=excluded.last_scheduled_at,last_consumed_at=NULL", new Date().toISOString());
    assert.equal((await cloudScannerProcessHealth()).status, 'disabled');
    process.env.AUTO_PICK_US_ENABLED = 'true';
    const initial = await cloudScannerProcessHealth();
    assert.equal(initial.scheduler.status, 'running');
    assert.equal(initial.consumer.status, 'awaiting-first-run');
    assert.equal(initial.status, 'idle');
    await storage.run('UPDATE cloud_scanner_state SET last_consumed_at=? WHERE id=1', new Date().toISOString());
    assert.equal((await cloudScannerProcessHealth()).status, 'running');
    t.mock.timers.tick(421000);
    assert.equal((await cloudScannerProcessHealth()).status, 'offline');
  } finally { for (const key of keys) if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
});

test('Thai health recognizes complete Cloud runs by timestamps, regardless of their slot prefix', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: at('14:00') });
  for (const symbol of [...SET100_SYMBOLS, ...MAI_INITIAL_SYMBOLS]) await recordScanProgress('thai', '2026-10-07', symbol, 'done');
  await storage.run(`INSERT INTO auto_pick_runs(id,market,slot,status,started_at,finished_at,scanned)
    VALUES('cloud-health-fixture','thai','cloud:opaque-job-id','COMPLETE',?,?,4)`, new Date(at('13:59')).toISOString(), new Date().toISOString());
  assert.equal((await scannerHealth()).status, 'healthy');
});
