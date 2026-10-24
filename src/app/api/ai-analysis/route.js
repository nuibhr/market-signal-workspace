import { rateLimit, readJsonBody, requestErrorResponse } from '../../../security/request-guard.mjs';
import {parseSnapshot,generateChartAnalysis} from '../../../analysis/chart-ai.mjs';
import { currentMember, sameOrigin } from '../../../membership/server.mjs';
import { membershipFor } from '../../../membership/rights.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };
const CACHE_MS = 5 * 60_000;
const cache = new Map();
export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ status: 'forbidden', code: 'INVALID_ORIGIN' }, { status: 403, headers: NO_STORE });
  const member = await currentMember();
  if (!membershipFor(member).capabilities.manualDailyScan) {
    return Response.json({ status: 'forbidden', code: 'MEMBERSHIP_REQUIRED' }, { status: 403, headers: NO_STORE });
  }
  const limited = (await rateLimit('chart-ai', member.id, 6)); if (limited) return limited;
  let snapshot;
  try { snapshot = parseSnapshot(await readJsonBody(request,3000)); } catch (error) { return requestErrorResponse(error); }
  if (!snapshot) return Response.json({ status: 'unavailable', code: 'INVALID_INPUT' }, { status: 400, headers: NO_STORE });
  const ai=globalThis[Symbol.for('__cloudflare-context__')]?.env?.AI;
  const key = `${member.demo?'demo':'real'}:${JSON.stringify(snapshot)}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return Response.json(hit.payload, { headers: NO_STORE });
  try {
    const result = await generateChartAnalysis(snapshot,{ai,demo:Boolean(member.demo)});
    cache.set(key, { payload: result, expiresAt: Date.now() + CACHE_MS });
    if (cache.size > 50) cache.delete(cache.keys().next().value);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    const code = error?.name === 'TimeoutError' ? 'MODEL_TIMEOUT'
      : ['MODEL_UNAVAILABLE', 'INVALID_MODEL_RESPONSE', 'CLOUD_AI_NOT_CONFIGURED'].includes(error?.message) ? error.message : 'MODEL_UNAVAILABLE';
    return Response.json({ status: 'unavailable', code }, { status: 503, headers: NO_STORE });
  }
}
