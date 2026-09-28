import { autoPickReadiness } from '../../../auto-pick/runner.mjs';
import { signalFeed } from '../../../auto-pick/store.mjs';
import { currentMember, privateHeaders } from '../../../membership/server.mjs';
import { membershipFor } from '../../../membership/rights.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const readiness = autoPickReadiness();
  const rights = membershipFor(await currentMember());
  if (!rights.capabilities.autoPickFeed) {
    return Response.json({ status: 'membership-required', readiness, signals: [], events: [], runs: [] }, { headers: privateHeaders });
  }
  try {
    return Response.json({ status: 'available', readiness, ...signalFeed() }, { headers: privateHeaders });
  } catch {
    return Response.json({ status: 'unavailable', code: 'SIGNAL_STORE_UNAVAILABLE', readiness }, { status: 503, headers: privateHeaders });
  }
}
