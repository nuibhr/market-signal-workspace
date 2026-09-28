import { currentMember, errorResponse, privateHeaders, sameOrigin } from '../../../../membership/server.mjs';
import { approveRenewal, grantAiCredits, isAdmin, issueCode, listAdminMembers, listRenewals, rejectPortfolio, rejectRenewal, verifyPortfolio } from '../../../../membership/store.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const member = await currentMember();
  if (!isAdmin(member)) return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: privateHeaders });
  return Response.json({ members: listAdminMembers(), renewals: listRenewals() }, { headers: privateHeaders });
}
export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ error: 'INVALID_ORIGIN' }, { status: 403, headers: privateHeaders });
  const member = await currentMember();
  if (!isAdmin(member)) return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: privateHeaders });
  if (Number(request.headers.get('content-length') || 0) > 4096) return Response.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413, headers: privateHeaders });
  try {
    const body = await request.json();
    if (body.action === 'verify') verifyPortfolio(member, body.memberId, body.number);
    else if (body.action === 'reject-portfolio') rejectPortfolio(member, body.memberId);
    else if (body.action === 'approve-renewal') approveRenewal(member, body.requestId);
    else if (body.action === 'reject-renewal') rejectRenewal(member, body.requestId);
    else if (body.action === 'grant-ai-credits') grantAiCredits(member, body.memberId, body.amount);
    else if (body.action === 'issue-code') {
      const code = issueCode(member, body.memberId);
      return Response.json({ code, members: listAdminMembers(), renewals: listRenewals() }, { headers: privateHeaders });
    } else return Response.json({ error: 'INVALID_ACTION' }, { status: 400, headers: privateHeaders });
    return Response.json({ members: listAdminMembers(), renewals: listRenewals() }, { headers: privateHeaders });
  } catch (error) { return errorResponse(error); }
}
