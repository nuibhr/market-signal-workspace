import { createHash } from 'node:crypto';
import { sharedDatabase } from '../membership/store.mjs';

let ready = false;
let cleanedAt = 0;
export function rateLimit(scope, identity, limit, windowMs = 60000) {
  const db = sharedDatabase();
  if (!ready) { db.exec('CREATE TABLE IF NOT EXISTS request_limits(bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at INTEGER NOT NULL)'); ready = true; }
  const now = Date.now();
  if (now - cleanedAt > 60000) { db.prepare('DELETE FROM request_limits WHERE expires_at<?').run(now); cleanedAt = now; }
  const bucket = createHash('sha256').update(`${scope}:${identity}:${Math.floor(now / windowMs)}`).digest('hex');
  const expires = (Math.floor(now / windowMs) + 1) * windowMs;
  const result = db.prepare(`INSERT INTO request_limits VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1 WHERE hits<? RETURNING hits`).get(bucket, expires, limit);
  return result ? null : Response.json({ error: 'RATE_LIMITED', code: 'RATE_LIMITED' }, { status: 429, headers: { 'Cache-Control': 'private, no-store', 'Retry-After': String(Math.max(1, Math.ceil((expires-now)/1000))) } });
}

export class RequestError extends Error { constructor(code, status) { super(code); this.status = status; } }
export async function readJsonBody(request, maximum = 4096) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new RequestError('CONTENT_TYPE_REQUIRED', 415);
  if (Number(request.headers.get('content-length')) > maximum) throw new RequestError('PAYLOAD_TOO_LARGE', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('INVALID_JSON', 400);
  const chunks = []; let size = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new RequestError('PAYLOAD_TOO_LARGE', 413); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(); return value;
  } catch { throw new RequestError('INVALID_JSON', 400); }
}
export function requestErrorResponse(error) {
  return Response.json({ error: error instanceof RequestError ? error.message : 'UNEXPECTED_ERROR' }, { status: error instanceof RequestError ? error.status : 500, headers: { 'Cache-Control': 'private, no-store' } });
}
