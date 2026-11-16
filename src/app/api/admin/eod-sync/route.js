import { timingSafeEqual } from 'node:crypto';
import { currentMember, privateHeaders, sameOrigin } from '../../../../membership/server.mjs';
import { isAdmin } from '../../../../membership/store.mjs';
import { storage } from '../../../../storage/database.mjs';
import { rateLimit } from '../../../../security/request-guard.mjs';
import { getEodSyncStatus, syncEodCandlesDelta } from '../../../../market-data/eod-sync.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CSV_BYTES = 52 * 1024 * 1024;
const MAX_JSON_BYTES = 16 * 1024 * 1024;

function hasValidIngestToken(request) {
  const expected = process.env.EOD_INGEST_SECRET;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!expected || expected.length < 32 || !supplied) return false;
  const suppliedBuf = Buffer.from(supplied, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  return suppliedBuf.length === expectedBuf.length && timingSafeEqual(suppliedBuf, expectedBuf);
}

async function readBoundedText(request, maxBytes) {
  const declaredLen = Number(request.headers.get('content-length') || 0);
  if (declaredLen > maxBytes) {
    throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), { status: 413 });
  }
  const reader = request.body?.getReader();
  if (!reader) throw Object.assign(new Error('EMPTY_BODY'), { status: 400 });
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), { status: 413 });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function GET(request) {
  let member = null;
  try {
    member = await currentMember(request);
  } catch {}
  if (!isAdmin(member)) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: privateHeaders });
  }
  const status = await getEodSyncStatus(storage);
  return Response.json(status, { headers: privateHeaders });
}

export async function POST(request) {
  const bearerAuthorized = hasValidIngestToken(request);
  let adminActor = null;
  if (!bearerAuthorized) {
    if (!sameOrigin(request)) {
      return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: privateHeaders });
    }
    try {
      adminActor = await currentMember(request);
    } catch {}
    if (!isAdmin(adminActor)) {
      return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: privateHeaders });
    }
  }

  const rateKey = bearerAuthorized ? 'office-eod-push' : adminActor.id;
  const limited = await rateLimit('admin-eod-sync', rateKey, 15);
  if (limited) return limited;

  const contentType = String(request.headers.get('content-type') || '').toLowerCase();
  try {
    let payload;
    if (contentType.includes('application/json')) {
      const raw = await readBoundedText(request, MAX_JSON_BYTES);
      payload = JSON.parse(raw);
    } else if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
      const csvText = await readBoundedText(request, MAX_CSV_BYTES);
      const url = new URL(request.url);
      payload = {
        csvText,
        onlyKnown: url.searchParams.get('onlyKnown') !== 'false',
        maxDaysBack: url.searchParams.has('maxDaysBack') ? Number(url.searchParams.get('maxDaysBack')) : null,
        source: url.searchParams.get('source') || (bearerAuthorized ? 'Metabase Office Push' : 'Admin CSV Upload'),
      };
    } else {
      return Response.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, { status: 415, headers: privateHeaders });
    }

    const result = await syncEodCandlesDelta(payload, {
      storage,
      onlyKnown: payload?.onlyKnown !== false,
      maxDaysBack: Number.isFinite(Number(payload?.maxDaysBack)) ? Number(payload.maxDaysBack) : null,
      source: typeof payload?.source === 'string' && payload.source.trim()
        ? payload.source.trim().slice(0, 60)
        : bearerAuthorized ? 'Metabase Office Push' : 'Admin CSV Upload',
    });

    const dbStatus = await getEodSyncStatus(storage);
    return Response.json({ ...result, dbStatus }, { headers: privateHeaders });
  } catch (error) {
    const code = error?.message || 'EOD_SYNC_FAILED';
    const status = error?.status || (['UNRECOGNIZED_EOD_CSV_HEADER', 'EMPTY_EOD_CSV', 'ROWS_ARRAY_REQUIRED'].includes(code) ? 400 : 500);
    return Response.json({ error: code }, { status, headers: privateHeaders });
  }
}
