import { signalEventPage } from '../../../../auto-pick/event-pages.mjs';
import { currentMember, privateHeaders } from '../../../../membership/server.mjs';
import { membershipFor } from '../../../../membership/rights.mjs';
import { rateLimit } from '../../../../security/request-guard.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const member = await currentMember();
  if (!membershipFor(member).capabilities.autoPickFeed)
    return Response.json({ error: 'MEMBERSHIP_REQUIRED' }, { status: 403, headers: privateHeaders });
  try {
    const limited = await rateLimit('signal-events', member.id, 120);
    if (limited) return limited;
    const url = new URL(request.url);
    return Response.json({ ...await signalEventPage({ after: url.searchParams.get('after'), limit: url.searchParams.get('limit') }),
      notificationScope: member.id }, { headers: privateHeaders });
  } catch (error) {
    const code = error.code ?? error.message;
    const status = code === 'EVENT_CURSOR_UNAVAILABLE' ? 409 : code === 'INVALID_EVENT_CURSOR' ? 400 : code === 'RATE_LIMITED' ? 429 : 503;
    return Response.json({ error: status === 503 ? 'EVENT_STORE_UNAVAILABLE' : code }, { status, headers: privateHeaders });
  }
}
