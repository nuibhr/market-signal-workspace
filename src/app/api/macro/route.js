import { fredMacroSnapshot } from '../../../market-data/fred.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let cached = null;
let pending = null;
const TTL = 30 * 60_000;
const STALE = 24 * 60 * 60_000;

export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (process.env.NODE_ENV === 'production' && process.env.FRED_PUBLIC_DISPLAY_RIGHTS_CONFIRMED !== 'true')
    return Response.json({ status: 'unavailable', code: 'DISPLAY_RIGHTS_UNCONFIRMED', releases: [], indicators: [] }, { status: 503, headers });
  const key = process.env.FRED_API_KEY?.trim();
  if (!key) return Response.json({ status: 'unconfigured', code: 'FRED_NOT_CONFIGURED', releases: [], indicators: [] }, { status: 503, headers });
  if (cached?.expiresAt > Date.now()) return Response.json(cached.data, { headers });
  try {
    if (!pending) pending = fredMacroSnapshot({ key }).finally(() => { pending = null; });
    const data = await pending;
    if (data.status === 'unavailable') throw new Error('SOURCE_UNAVAILABLE');
    cached = { data, expiresAt: Date.now() + TTL };
    return Response.json(data, { headers });
  } catch {
    if (cached && Date.now() - Date.parse(cached.data.receivedAt) < STALE)
      return Response.json({ ...cached.data, status: 'stale', code: 'SOURCE_UNAVAILABLE' }, { headers });
    return Response.json({ status: 'unavailable', code: 'SOURCE_UNAVAILABLE', releases: [], indicators: [] }, { status: 503, headers });
  }
}
