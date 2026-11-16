import { rateLimit, readJsonBody, requestErrorResponse, RequestError } from '../../../../security/request-guard.mjs';
import { currentMember, errorResponse, privateHeaders, sameOrigin } from '../../../../membership/server.mjs';
import { approveRenewal, digest, extendVipSubscription, grantAiCredits, isAdmin, issueCode, recordBrokerTradeActivity, rejectPortfolio, rejectRenewal, revokeCode, revokePartnerVip, verifyPartnerBrokerByAdmin, verifyPortfolio } from '../../../../membership/store.mjs';
import { adminMemberships } from '../../../../admin/operations.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const member = await currentMember();
  if (!isAdmin(member)) return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: privateHeaders });
  try {
    const params=new URL(request.url).searchParams;
    return Response.json(await adminMemberships(member,Object.fromEntries(['q','filter','page','limit','renewalState','renewalPage'].map(key=>[key,params.get(key)]))),{headers:privateHeaders});
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
    if (['verify','reject-portfolio','grant-ai-credits','issue-code','revoke-code','record-broker-trade','revoke-vip','link-partner-broker','extend-vip'].includes(body.action)
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
    else if (body.action === 'record-broker-trade') {
      const outcome=await recordBrokerTradeActivity(member,body.memberId,{
        tradedAt:body.tradedAt,
        monthlyVolumeThb:body.monthlyVolumeThb,
        volumeMonth:body.volumeMonth,
        targetThb:body.targetThb,
        note:body.note||'',
      });
      return Response.json({ok:true,...outcome},{headers:privateHeaders});
    }
    else if (body.action === 'link-partner-broker') {
      const outcome=await verifyPartnerBrokerByAdmin(member,body.memberId,{
        broker:body.broker,
        accountNo:body.accountNo,
        targetThb:body.targetThb,
        monthlyVolumeThb:body.monthlyVolumeThb,
        volumeMonth:body.volumeMonth,
        note:body.note||'',
      });
      return Response.json({ok:true,...outcome},{headers:privateHeaders});
    }
    else if (body.action === 'extend-vip') {
      const outcome=await extendVipSubscription(member,body.memberId,{
        days:body.days,
        reason:body.reason||'PARTNER_VOLUME_QUALIFIED',
        note:body.note||'',
      });
      return Response.json({ok:true,...outcome},{headers:privateHeaders});
    }
    else if (body.action === 'revoke-vip') {
      const outcome=await revokePartnerVip(member,body.memberId,{reason:body.reason||'NO_TRADING_ACTIVITY'});
      return Response.json({ok:true,...outcome},{headers:privateHeaders});
    }
    else if (body.action === 'issue-code') {
      const grantType=body.grantType==='promo_vip'?'promo_vip':'partner_vip';
      const durationDays=body.durationDays??30;
      const minVolumeThb=body.minVolumeThb??(grantType==='partner_vip'?1_000:0);
      const code = (await issueCode(member, body.memberId,body.operationId,{
        grantType,
        durationDays,
        minVolumeThb,
        note:body.note||'',
        allowUnverified:body.allowUnverified===true,
      }));
      return Response.json({ ok:true,code,codeId:digest(code),grantType,durationDays:Number(durationDays)||30,minVolumeThb }, { headers: privateHeaders });
    } else return Response.json({ error: 'INVALID_ACTION' }, { status: 400, headers: privateHeaders });
    return Response.json({ ok:true }, { headers: privateHeaders });
  } catch (error) { return error instanceof RequestError ? requestErrorResponse(error) : errorResponse(error); }
}
