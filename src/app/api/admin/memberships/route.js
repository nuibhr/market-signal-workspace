import { rateLimit, readJsonBody, requestErrorResponse, RequestError } from '../../../../security/request-guard.mjs';
import { currentMember, errorResponse, privateHeaders, sameOrigin } from '../../../../membership/server.mjs';
import { approveRenewal, digest, grantAiCredits, isAdmin, issueCode, rejectPortfolio, rejectRenewal, revokeCode, verifyPortfolio } from '../../../../membership/store.mjs';
import { adminMemberships } from '../../../../admin/operations.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const member = await currentMember();
  if (!isAdmin(member)) return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: privateHeaders });
  try {
    const params=new URL(request.url).searchParams;
    return Response.json(await adminMemberships(member,Object.fromEntries(['q','filter','page','renewalState','renewalPage'].map(key=>[key,params.get(key)]))),{headers:privateHeaders});
  } catch {return Response.json({error:'MEMBERSHIPS_UNAVAILABLE'},{status:503,headers:privateHeaders});}
}
export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ error: 'INVALID_ORIGIN' }, { status: 403, headers: privateHeaders });
  const member = await currentMember();
  if (!isAdmin(member)) return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: privateHeaders });
  if (Number(request.headers.get('content-length') || 0) > 4096) return Response.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413, headers: privateHeaders });
  const limited = (await rateLimit('admin-write', member.id, 30)); if (limited) return limited;
  try {
    const body = await readJsonBody(request, 4096);
    if (['verify','reject-portfolio','grant-ai-credits','issue-code','revoke-code'].includes(body.action)
      && (typeof body.memberId!=='string'||!/^[-_a-zA-Z0-9]{16,100}$/.test(body.memberId))) throw new RequestError('INVALID_MEMBER_ID',400);
    if (['approve-renewal','reject-renewal'].includes(body.action)
      && (typeof body.requestId!=='string'||!/^[-_a-zA-Z0-9]{16,100}$/.test(body.requestId))) throw new RequestError('INVALID_REQUEST_ID',400);
    if (['grant-ai-credits','issue-code'].includes(body.action)
      && (typeof body.operationId!=='string'||!/^[-_a-zA-Z0-9]{16,100}$/.test(body.operationId))) throw new RequestError('INVALID_REQUEST_ID',400);
    if (body.action === 'verify') (await verifyPortfolio(member, body.memberId, body.number));
    else if (body.action === 'reject-portfolio') (await rejectPortfolio(member, body.memberId));
    else if (body.action === 'approve-renewal') {
      if(body.paymentConfirmed!==true)throw new RequestError('PAYMENT_CONFIRMATION_REQUIRED',400);
      (await approveRenewal(member, body.requestId,body.reference));
    }
    else if (body.action === 'reject-renewal') (await rejectRenewal(member, body.requestId));
    else if (body.action === 'grant-ai-credits') (await grantAiCredits(member, body.memberId, body.amount,body.operationId,body.note));
    else if (body.action === 'revoke-code') (await revokeCode(member,body.memberId,body.codeId));
    else if (body.action === 'issue-code') {
      const code = (await issueCode(member, body.memberId,body.operationId));
      return Response.json({ ok:true,code,codeId:digest(code) }, { headers: privateHeaders });
    } else return Response.json({ error: 'INVALID_ACTION' }, { status: 400, headers: privateHeaders });
    return Response.json({ ok:true }, { headers: privateHeaders });
  } catch (error) { return error instanceof RequestError ? requestErrorResponse(error) : errorResponse(error); }
}
