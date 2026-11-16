import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTailEodPayload, pushEodPayload } from './office-eod-push.mjs';

test('prepareTailEodPayload keeps only trailing N calendar days and strips 0.0 bars', () => {
  const csv = [
    '\uFEFFD_TRADE,N_SECURITY,Z_OPEN,Z_HIGH,Z_LOW,Z_CLOSE,Q_VOLUME',
    '2026-10-01,PTT,30,31,29.5,30.5,1000000',
    '2026-11-10,PTT,32,33,31.5,32.5,2000000',
    '2026-11-13,PTT,32.5,33.5,32,33,2500000',
    '2026-11-13,3K-BAT,0,0,0,0,0',
  ].join('\n');

  const payload = prepareTailEodPayload(csv, { days: 7 });
  assert.equal(payload.stats.maxDay, '2026-11-13');
  assert.equal(payload.stats.skippedInvalidRows, 1);
  assert.equal(payload.rows.length, 2);
  assert.deepEqual(payload.rows.map(r => r.time), ['2026-11-10', '2026-11-13']);
});

test('pushEodPayload sends HTTPS Bearer token and tail JSON rows to /api/admin/eod-sync', async () => {
  let captured = null;
  const mockFetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ status: 'ok', writtenBars: 1 }), { status: 200 });
  };

  const result = await pushEodPayload({
    targetUrl: 'https://nugaom.example.com/',
    ingestSecret: 'secret-token-at-least-32-chars-long-1234',
    payload: { source: 'Metabase Office API', onlyKnown: true, rows: [{ symbol: 'PTT', time: '2026-11-13', open: 32, high: 33, low: 32, close: 33, volume: 100 }] },
    fetcher: mockFetch,
  });

  assert.equal(result.writtenBars, 1);
  assert.equal(captured.url, 'https://nugaom.example.com/api/admin/eod-sync');
  assert.equal(captured.init.headers.Authorization, 'Bearer secret-token-at-least-32-chars-long-1234');
});
