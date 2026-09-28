import { timingSafeEqual } from 'node:crypto';
import { runThaiAutoPick } from '../../../../auto-pick/runner.mjs';

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
    const result = await runThaiAutoPick();
    return Response.json(result, { headers });
  } catch {
    return Response.json({ status: 'unavailable', code: 'AUTO_PICK_NOT_READY' }, { status: 503, headers });
  }
}
