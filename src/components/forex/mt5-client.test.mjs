import test from 'node:test';
import assert from 'node:assert/strict';
import { createMt5Reader, mt5Json, staleMt5Data } from './mt5-client.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const response = data => ({ ok: true, status: 200, json: async () => data });

test('changing symbol/frame ignores a late response body from the previous selection', async () => {
  const oldBody = deferred(), published = [], calls = [];
  const reader = createMt5Reader({ onData: data => published.push(data), fetcher: async url => {
    calls.push(url);
    return calls.length === 1 ? { ok: true, json: () => oldBody.promise } : response({ chart: { broker_symbol: 'XAUUSD+', timeframe: '15m' } });
  } });
  reader.select('EURUSD+', '1h');
  const old = reader.refresh();
  await Promise.resolve();
  reader.select('XAUUSD+', '15m');
  await reader.refresh();
  oldBody.resolve({ chart: { broker_symbol: 'EURUSD+', timeframe: '1h' } });
  assert.equal(await old, null);
  assert.deepEqual(published, [{ chart: { broker_symbol: 'XAUUSD+', timeframe: '15m' } }]);
  assert.match(calls[1], /symbol=XAUUSD%2B&frame=15m/);
});

test('revoke invalidates an in-flight poll so it cannot restore a connected snapshot', async () => {
  const old = deferred(), published = [];
  let calls = 0;
  const reader = createMt5Reader({ onData: data => published.push(data), fetcher: async () => ++calls === 1 ? old.promise : response({ status: 'disconnected', snapshot: null }) });
  reader.select('EURUSD', '1h');
  const poll = reader.refresh();
  reader.invalidate(); // The hook calls this before sending the revoke POST.
  await reader.refresh();
  old.resolve(response({ status: 'connected', snapshot: { instruments: ['old'] } }));
  assert.equal(await poll, null);
  assert.deepEqual(published, [{ status: 'disconnected', snapshot: null }]);
});

test('a deadline covers stalled fetch and stalled JSON without retrying a one-time pairing POST', async () => {
  for (const phase of ['fetch', 'body']) {
    let calls = 0, requestSignal;
    const fetcher = async (_, options) => {
      calls++; requestSignal = options.signal;
      if (phase === 'fetch') return new Promise(() => {});
      return { ok: true, json: () => new Promise(() => {}) };
    };
    await assert.rejects(mt5Json('/api/forex/mt5', { method: 'POST', body: '{"action":"pair"}' }, { fetcher, timeoutMs: 15 }), { name: 'TimeoutError' });
    assert.equal(calls, 1); assert.equal(requestSignal.aborted, true);
  }
});

test('an aborted/unmounted reader cannot publish; a fresh read recovers after timeout', async () => {
  let calls = 0;
  const published = [], reader = createMt5Reader({ timeoutMs: 15, onData: data => published.push(data), fetcher: async () => {
    if (++calls === 1) return new Promise(() => {});
    return response({ status: 'connected' });
  } });
  await assert.rejects(reader.refresh(), { name: 'TimeoutError' });
  await reader.refresh();
  assert.deepEqual(published, [{ status: 'connected' }]);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(mt5Json('/api/forex/mt5', { signal: controller.signal }, { fetcher: async () => { throw Error('must not send'); } }), { name: 'AbortError' });
});

test('failed reads retain context but mark every quote and the chart stale', () => {
  const previous = { status: 'connected', snapshot: { instruments: ['EURUSD'] }, quotes: { EURUSD: { price: 1.1, stale: false } }, chart: { bars: [], stale: false } };
  const stale = staleMt5Data(previous);
  assert.equal(stale.status, 'stale'); assert.equal(stale.chart.stale, true);
  assert.equal(stale.quotes.EURUSD.stale, true); assert.equal(stale.snapshot, previous.snapshot);
  assert.equal(previous.quotes.EURUSD.stale, false);
});
