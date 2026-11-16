import { NextResponse } from 'next/server.js';
import { currentMember, privateHeaders, sameOrigin, secureCookie } from '../../../membership/server.mjs';
import { attributeReferralToMember, findActiveAffiliateByCode, REFERRAL_COOKIE } from '../../../membership/affiliates.mjs';
import { readJsonBody, requestErrorResponse } from '../../../security/request-guard.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!sameOrigin(request)) {
    return Response.json({ ok: false, error: 'INVALID_ORIGIN' }, { status: 403, headers: privateHeaders });
  }
  let body;
  try {
    body = await readJsonBody(request, 1024);
  } catch (error) {
    return requestErrorResponse(error);
  }

  const partner = await findActiveAffiliateByCode(body?.code);
  if (!partner) {
    return Response.json({ ok: false, error: 'INVALID_REFERRAL_CODE' }, { status: 404, headers: privateHeaders });
  }

  let attribution = null;
  try {
    const member = await currentMember(request);
    if (member?.id) {
      attribution = await attributeReferralToMember(member.id, partner.code);
    }
  } catch {}

  const response = NextResponse.json(
    { ok: true, code: partner.code, commissionRatePct: partner.commission_rate_pct, attribution },
    { headers: privateHeaders }
  );
  response.cookies.set(REFERRAL_COOKIE, partner.code, {
    httpOnly: true,
    secure: secureCookie(request),
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 86400,
  });
  return response;
}
