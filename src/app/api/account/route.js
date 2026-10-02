import { rateLimit, readJsonBody, requestErrorResponse, RequestError } from '../../../security/request-guard.mjs';
import { currentAccount, currentMember, errorResponse, privateHeaders, sameOrigin } from '../../../membership/server.mjs';
import { redeemCode, requestRenewal, submitPortfolio } from '../../../membership/store.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await currentAccount(), { headers: privateHeaders });
}
export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ error: 'INVALID_ORIGIN' }, { status: 403, headers: privateHeaders });
  if (Number(request.headers.get('content-length') || 0) > 4096) return Response.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413, headers: privateHeaders });
  const member = await currentMember();
  if (!member) return Response.json({ error: 'LOGIN_REQUIRED' }, { status: 401, headers: privateHeaders });
  const limited = rateLimit('account', member.id, 12); if (limited) return limited;
  try {
    const body = await readJsonBody(request, 4096);
    if (body.action === 'portfolio') submitPortfolio(member, body.broker, body.number);
    else if (body.action === 'redeem') redeemCode(member, body.code);
    else if (body.action === 'renewal') requestRenewal(member);
    else return Response.json({ error: 'INVALID_ACTION' }, { status: 400, headers: privateHeaders });
    return Response.json(await currentAccount(), { headers: privateHeaders });
  } catch (error) { return error instanceof RequestError ? requestErrorResponse(error) : errorResponse(error); }
}
