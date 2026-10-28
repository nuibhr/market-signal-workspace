import { rateLimit, readJsonBody, requestErrorResponse, RequestError } from '../../../security/request-guard.mjs';
import { currentAccount, currentMember, errorResponse, privateHeaders, sameOrigin } from '../../../membership/server.mjs';
import { redeemCode, requestRenewal, submitPortfolio, startTrial } from '../../../membership/store.mjs';
import { requireDataOwner } from '../../../market-data/contracts/v1/owner-server.mjs';

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
  if(member.demo)return Response.json({error:'DEMO_READ_ONLY'},{status:403,headers:privateHeaders});
  const limited = (await rateLimit('account', member.id, 12)); if (limited) return limited;
  try {
    const body = await readJsonBody(request, 4096);
    if (body.action === 'start-trial') await startTrial(member);
    else if (body.action === 'portfolio') {
      const denied = await requireDataOwner(request);
      if (denied) return denied;
      await submitPortfolio(member, body.broker, body.number);
    }
    else if (body.action === 'redeem') (await redeemCode(member, body.code));
    else if (body.action === 'renewal') (await requestRenewal(member));
    else return Response.json({ error: 'INVALID_ACTION' }, { status: 400, headers: privateHeaders });
    return Response.json(await currentAccount(), { headers: privateHeaders });
  } catch (error) { return error instanceof RequestError ? requestErrorResponse(error) : errorResponse(error); }
}
