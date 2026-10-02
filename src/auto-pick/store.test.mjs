import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('signal ledger links recorded entries, exits, and events without counting unentered plans', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'nugaom-signal-results-'));
  process.env.DATABASE_PATH = join(directory, 'test.sqlite');
  const { createSignal, saveAdvance, signalForSession, signalResults, signalPerformance, heartbeatWorker, workerProcessHealth, claimRun, finishRun, recordScanProgress, scanCoverage } = await import('./store.mjs');
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

    // Closing order decides the window, including exits at a loss. Old records remain in full history.
    for (let index = 0; index < 103; index += 1) {
      const signal = createSignal({ market: 'thai', symbol: `REC${index}`, sessionDay: '2026-10-01', plan, source: 'TEST OHLC' });
      saveAdvance({ ...signal, status: index % 2 ? 'TARGET' : index === 102 ? 'EXIT' : 'STOP',
        entryPrice: 100, enteredAt: '2026-10-01T03:00:00.000Z', exitPrice: index % 2 ? 104 : 98,
        exitedAt: new Date(Date.parse('2026-10-01T03:01:00.000Z') + index * 60_000).toISOString() }, []);
    }
    const invalid = createSignal({ market: 'thai', symbol: 'INVALID', sessionDay: '2026-10-02', plan, source: 'TEST OHLC' });
    saveAdvance({ ...invalid, status: 'TARGET', entryPrice: 100, exitPrice: 200,
      enteredAt: '2026-10-02T04:00:00.000Z', exitedAt: '2026-10-02T03:00:00.000Z' }, []);
    const review = createSignal({ market: 'thai', symbol: 'REVIEW', sessionDay: '2026-10-02', plan, source: 'TEST OHLC' });
    saveAdvance({ ...review, status: 'AMBIGUOUS', entryPrice: 100, exitPrice: 104,
      enteredAt: '2026-10-02T03:00:00.000Z', exitedAt: '2026-10-02T04:00:00.000Z' }, []);
    const recent = signalResults({ market: 'thai', scope: 'closed' });
    assert.equal(recent.total, 100);
    assert.equal(recent.signals.length, 7);
    assert.equal(recent.summary.closed, 100);
    assert.equal(recent.summary.wins, 50);
    assert.equal(recent.summary.losses, 50);
    assert.equal(recent.summary.winRate, 50);
    assert.equal(recent.summary.averageReturnPercent, 1);
    assert.equal(recent.summary.averageR, .5);
    assert.equal(recent.recentTrades[0].symbol, 'REC102');
    assert.equal(recent.recentTrades.at(-1).symbol, 'REC3');
    assert.equal(recent.recentTrades[0].status, 'EXIT');
    assert.deepEqual(recent.recentTrades, signalPerformance('thai').recentTrades);
    assert.equal(signalResults({ market: 'thai', scope: 'closed', status: 'STOP' }).summary.losses, 50);
    assert.equal(signalResults({ market: 'thai', scope: 'history' }).total, 107);
    assert.equal(signalForSession('thai', 'TEST', '2026-09-30').exitPrice, 104);
    const empty = signalResults({market:'dr',scope:'closed'});
    assert.equal(empty.total,0);assert.equal(empty.summary.winRate,null);
  } finally {
    sharedDatabase().close();
    rmSync(directory, { recursive: true, force: true });
  }
});
