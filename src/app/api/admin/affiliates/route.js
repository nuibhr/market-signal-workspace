import { currentMember, privateHeaders, sameOrigin } from '../../../../membership/server.mjs';
import { getBrokerStaffRole, isAdmin } from '../../../../membership/store.mjs';
import {
  createOrUpdateAffiliatePartner,
  getAffiliateProfile,
  listAffiliateDashboard,
  markAffiliateCommissionStatus,
  recordManualAffiliateCommission,
} from '../../../../membership/affiliates.mjs';
import { rateLimit, readJsonBody, requestErrorResponse } from '../../../../security/request-guard.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function canAccessAffiliateDashboard(member) {
  if (!member?.id) return false;
  if (isAdmin(member) || getBrokerStaffRole(member)) return true;
  const aff = await getAffiliateProfile(member);
  return aff?.status === 'active';
}

export async function GET(request) {
  let member = null;
  try { member = await currentMember(request); } catch {}
  if (!(await canAccessAffiliateDashboard(member))) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: privateHeaders });
  }
  const dashboard = await listAffiliateDashboard(member);
  return Response.json(dashboard, { headers: privateHeaders });
}

export async function POST(request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: 'INVALID_ORIGIN' }, { status: 403, headers: privateHeaders });
  }
  let member = null;
  try { member = await currentMember(request); } catch {}
  if (!isAdmin(member)) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: privateHeaders });
  }
  const limited = await rateLimit('admin-affiliates', member.id, 30);
  if (limited) return limited;

  let body;
  try {
    body = await readJsonBody(request, 8192);
  } catch (error) {
    return requestErrorResponse(error);
  }

  try {
    const action = body?.action;
    let outcome = null;
    if (action === 'create-partner') {
      outcome = await createOrUpdateAffiliatePartner(member, {
        memberId: body.memberId,
        code: body.code,
        commissionRatePct: body.commissionRatePct ?? 30,
        status: body.status || 'active',
        payoutNote: body.payoutNote || '',
      });
    } else if (action === 'mark-commission-status') {
      outcome = await markAffiliateCommissionStatus(member, body.commissionId, {
        status: body.status,
        payoutNote: body.payoutNote,
      });
    } else if (action === 'record-manual-commission') {
      outcome = await recordManualAffiliateCommission(member, {
        referredMemberId: body.referredMemberId,
        grossAmountThb: body.grossAmountThb,
        planId: body.planId || 'pro',
        interval: body.interval || 'month',
        note: body.note || '',
      });
    } else {
      return Response.json({ error: 'INVALID_ACTION' }, { status: 400, headers: privateHeaders });
    }

    const dashboard = await listAffiliateDashboard(member);
    return Response.json({ ok: true, outcome, ...dashboard }, { headers: privateHeaders });
  } catch (error) {
    const code = error?.message || 'AFFILIATE_ACTION_FAILED';
    const known400 = new Set([
      'INVALID_MEMBER_ID', 'MEMBER_NOT_FOUND', 'INVALID_REFERRAL_CODE',
      'INVALID_COMMISSION_RATE', 'INVALID_STATUS', 'REFERRAL_CODE_TAKEN',
      'INVALID_AMOUNT', 'NO_REFERRER', 'PARTNER_NOT_FOUND', 'COMMISSION_NOT_FOUND',
    ]);
    return Response.json(
      { error: code },
      { status: code === 'FORBIDDEN' ? 403 : known400.has(code) ? 400 : 500, headers: privateHeaders }
    );
  }
}
