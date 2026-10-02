import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('signal ledger links recorded entries, exits, and events without counting unentered plans', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'nugaom-signal-results-'));
  process.env.DATABASE_PATH = join(directory, 'test.sqlite');
  const { createSignal, saveAdvance, signalForSession, signalResults, heartbeatWorker, workerProcessHealth, claimRun, finishRun, recordScanProgress, scanCoverage } = await import('./store.mjs');
  const { sharedDatabase } = await import('../membership/store.mjs');
  try {
    const plan = { id: 'test-plan', side: 'LONG', entry: 100, stopLoss: 98, tp1: 104 };
    const entered = createSignal({ market: 'thai', symbol: 'TEST', sessionDay: '2026-09-30', plan, source: 'TEST OHLC' });
    saveAdvance({ ...entered, status: 'TARGET', entryPrice: 101, enteredAt: '2026-09-30T03:00:00.000Z',
      exitPrice: 104, exitedAt: '2026-09-30T03:15:00.000Z' }, [
      { type: 'ENTRY', barTime: 1790737200, price: 101, detail: 'bar close' },
      { type: 'TARGET', barTime: 1790738100, price: 104, detail: 'target touched' },
    ]);
    const waiting = createSignal({ market: 'thai', symbol: 'WAIT', sessionDay: '2026-09-30', plan, source: 'TEST OHLC' });
    saveAdvance({ ...waiting, status: 'EXPIRED' }, [{ type: 'EXPIRED', price: null, detail: 'no entry' }]);
    const result = signalResults({ market: 'thai', pageSize: 10 });
    assert.equal(result.total, 2);
    assert.equal(result.summary.closed, 1);
    assert.equal(result.summary.wins, 1);
    assert.equal(result.summary.winRate, 100);
    assert.equal(result.counts.EXPIRED, 1);
    assert.equal(result.counts.TARGET, 1);
    assert.equal(signalForSession('thai', 'WAIT', '2026-09-30').entryPrice, null);
    const trade = result.signals.find(signal => signal.symbol === 'TEST');
    assert.equal(trade.entryPrice, 101);
    assert.equal(trade.exitPrice, 104);
    assert.deepEqual(trade.events.map(event => event.type), ['PICK_READY', 'ENTRY', 'TARGET']);
    const runId = claimRun('us', '2026-10-01');
    assert.ok(runId);
    assert.equal(claimRun('us', '2026-10-01', { retryFailed: true }), null);
    finishRun(runId, { errorCode: 'SCAN_IN_PROGRESS' });
    sharedDatabase().prepare('UPDATE auto_pick_runs SET finished_at=? WHERE id=?').run(new Date(Date.now()-61000).toISOString(), runId);
    assert.equal(claimRun('us', '2026-10-01', { retryFailed: true }), runId);
    recordScanProgress('us', '2026-10-01', 'TEST', 'done');
    recordScanProgress('us', '2026-10-01', 'RETRY', 'retry', 'SOURCE_UNAVAILABLE');
    const coverage = scanCoverage('us', '2026-10-01', ['TEST','RETRY','NEW'], Date.now()+61000);
    assert.deepEqual(coverage.pending, ['RETRY','NEW']);
    assert.equal(coverage.done,1);
    finishRun(runId);
    assert.equal(claimRun('us', '2026-10-01', { retryFailed: true }), null);
    heartbeatWorker();
    const health = workerProcessHealth();
    assert.equal(health.status, 'running');
    assert.equal(workerProcessHealth(Date.parse(health.lastSeenAt) + 301_000).status, 'offline');
  } finally {
    sharedDatabase().close();
    rmSync(directory, { recursive: true, force: true });
  }
});
