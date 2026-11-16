import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'nugaom-eod-sync-route-'));
const prevDbPath = process.env.DATABASE_PATH;
const prevSecret = process.env.EOD_INGEST_SECRET;
const prevAdmins = process.env.ADMIN_LINE_IDS;
const prevSessionSecret = process.env.SESSION_SECRET;
const prevHashSecret = process.env.PORTFOLIO_HASH_SECRET;

process.env.DATABASE_PATH = join(tempDir, 'eod-sync.sqlite');
process.env.EOD_INGEST_SECRET = 'office-metabase-push-secret-key-2026-v1';
process.env.ADMIN_LINE_IDS = 'U_EOD_SUPER_ADMIN';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'eod-sync-session-secret-'.repeat(3);
process.env.PORTFOLIO_HASH_SECRET = process.env.PORTFOLIO_HASH_SECRET || 'eod-sync-portfolio-secret-'.repeat(3);

const { GET, POST } = await import('./route.js');
const { storage } = await import('../../../../storage/database.mjs');
const { sharedDatabase } = await import('../../../../storage/sqlite.mjs');
const { upsertLineMember, createSession } = await import('../../../../membership/store.mjs');
const { SESSION_COOKIE } = await import('../../../../membership/server.mjs');

test.after(() => {
  sharedDatabase().close();
  if (prevDbPath === undefined) delete process.env.DATABASE_PATH; else process.env.DATABASE_PATH = prevDbPath;
  if (prevSecret === undefined) delete process.env.EOD_INGEST_SECRET; else process.env.EOD_INGEST_SECRET = prevSecret;
  if (prevAdmins === undefined) delete process.env.ADMIN_LINE_IDS; else process.env.ADMIN_LINE_IDS = prevAdmins;
  if (prevSessionSecret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = prevSessionSecret;
  if (prevHashSecret === undefined) delete process.env.PORTFOLIO_HASH_SECRET; else process.env.PORTFOLIO_HASH_SECRET = prevHashSecret;
  rmSync(tempDir, { recursive: true, force: true });
});

test('POST /api/admin/eod-sync rejects unauthorized and invalid Bearer tokens', async () => {
  const unauth = await POST(new Request('http://localhost:3000/api/admin/eod-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ rows: [] }),
  }));
  assert.equal(unauth.status, 403);

  const wrongToken = await POST(new Request('http://localhost:3000/api/admin/eod-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong-token-value-1234567890123456' },
    body: JSON.stringify({ rows: [] }),
  }));
  assert.equal(wrongToken.status, 403);
});

test('Office Bearer push performs idempotent delta sync, drops 0.0 rows & unknown symbols, and updates changed bars', async () => {
  const sampleRows = [
    { symbol: 'PTT', time: '2026-11-12', open: 32.0, high: 32.5, low: 31.75, close: 32.25, volume: 25000000 },
    { symbol: 'PTT', time: '2026-11-13', open: 32.25, high: 33.0, low: 32.0, close: 32.75, volume: 30000000 },
    { symbol: 'DIF', time: '2026-11-13', open: 8.5, high: 8.6, low: 8.45, close: 8.55, volume: 4000000 },
    { symbol: '3K-BAT', time: '2026-11-13', open: 0, high: 0, low: 0, close: 0, volume: 0 }, // zero-price -> skippedInvalidRows
    { symbol: 'UNKNOWN_TINY', time: '2026-11-13', open: 1.1, high: 1.2, low: 1.0, close: 1.15, volume: 1000 }, // non-catalog -> skippedUnknownSymbols
  ];

  // First push writes 3 bars
  const firstRes = await POST(new Request('http://localhost:3000/api/admin/eod-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.EOD_INGEST_SECRET}` },
    body: JSON.stringify({ source: 'Metabase Office API', rows: sampleRows }),
  }));
  assert.equal(firstRes.status, 200);
  const first = await firstRes.json();
  assert.equal(first.writtenBars, 3);
  assert.equal(first.unchangedBars, 0);
  assert.equal(first.skippedInvalidRows, 1);
  assert.equal(first.skippedUnknownSymbols, 1);
  assert.equal(first.dbStatus.symbolCount, 2);
  assert.equal(first.dbStatus.maxDay, '2026-11-13');

  // Second identical push writes 0 bars (all unchanged)
  const secondRes = await POST(new Request('http://localhost:3000/api/admin/eod-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.EOD_INGEST_SECRET}` },
    body: JSON.stringify({ source: 'Metabase Office API', rows: sampleRows }),
  }));
  assert.equal(secondRes.status, 200);
  const second = await secondRes.json();
  assert.equal(second.writtenBars, 0);
  assert.equal(second.unchangedBars, 3);
});

test('Super Admin CSV upload via /api/admin/eod-sync parses Metabase CSV and GET reports DB status', async () => {
  const admin = await upsertLineMember({ lineId: process.env.ADMIN_LINE_IDS, displayName: 'Super Admin' });
  const session = await createSession(admin.id);

  const csvText = [
    '\uFEFFD_TRADE,N_SECURITY,Z_OPEN,Z_HIGH,Z_LOW,Z_CLOSE,Q_VOLUME',
    '2026-11-16,KBANK,150.0,152.5,149.5,152.0,5100000',
    '2026-11-16,A5,0.0,0.0,0.0,0.0,0.0',
  ].join('\n');

  const postRes = await POST(new Request('http://localhost:3000/api/admin/eod-sync?onlyKnown=true&source=Admin+CSV+Upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      Origin: 'http://localhost:3000',
      Cookie: `${SESSION_COOKIE}=${encodeURIComponent(session.value)}`,
    },
    body: csvText,
  }));
  assert.equal(postRes.status, 200);
  const postData = await postRes.json();
  assert.equal(postData.writtenBars, 1);
  assert.equal(postData.latestUpdatedDay, '2026-11-16');

  const getRes = await GET(new Request('http://localhost:3000/api/admin/eod-sync', {
    headers: { Cookie: `${SESSION_COOKIE}=${encodeURIComponent(session.value)}` },
  }));
  assert.equal(getRes.status, 200);
  const status = await getRes.json();
  assert.equal(status.maxDay, '2026-11-16');
  assert.equal(status.ingestSecretConfigured, true);
  assert.ok(status.totalBars >= 4);
  const kbank = await storage.first("SELECT bar_json FROM scanner_candles WHERE symbol='KBANK' AND time='2026-11-16'");
  assert.equal(JSON.parse(kbank.bar_json).close, 152);
});
