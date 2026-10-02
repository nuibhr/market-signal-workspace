import { timingSafeEqual } from 'node:crypto';
import { autoPickReadiness, runThaiAutoPick, runDrAutoPick, runUsAutoPick } from '../../../../auto-pick/runner.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };

export async function POST(request) {
  const expected = process.env.AUTO_PICK_RUN_SECRET;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected ?? '');
  if (!expected || expected.length < 32 || suppliedBytes.length !== expectedBytes.length
    || !timingSafeEqual(suppliedBytes, expectedBytes)) {
    return Response.json({ status: 'forbidden' }, { status: 403, headers });
  }
  try {
    const readiness = autoPickReadiness();
    const jobs = [];
    if (readiness.markets.find(item => item.id === 'thai')?.status === 'active') jobs.push(['thai', runThaiAutoPick]);
    if (readiness.markets.find(item => item.id === 'dr')?.status === 'active') jobs.push(['dr', runDrAutoPick]);
    if (readiness.markets.find(item => item.id === 'us')?.status === 'active') jobs.push(['us', runUsAutoPick]);
    if (!jobs.length) return Response.json({ status: 'unavailable', code: 'AUTO_PICK_NOT_READY' }, { status: 503, headers });
    const results = {};
    for (const [market, run] of jobs) {
      try { results[market] = await run(); }
      catch { results[market] = { status: 'unavailable', code: 'AUTO_PICK_NOT_READY' }; }
    }
    if (jobs.length === 1) return Response.json(results[jobs[0][0]], { headers });
    const partial = Object.values(results).some(result => ['partial', 'unavailable'].includes(result.status));
    return Response.json({ status: partial ? 'partial' : 'complete', markets: results }, { headers });
  } catch {
    return Response.json({ status: 'unavailable', code: 'AUTO_PICK_NOT_READY' }, { status: 503, headers });
  }
}
