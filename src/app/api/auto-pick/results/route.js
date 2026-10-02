import { customerSignal } from '../../../../auto-pick/customer-view.mjs';
import { signalResults } from '../../../../auto-pick/store.mjs';
import { currentMember, privateHeaders } from '../../../../membership/server.mjs';
import { membershipFor } from '../../../../membership/rights.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const rights = membershipFor(await currentMember());
  if (!rights.capabilities.autoPickFeed) {
    return Response.json({ status: 'membership-required', signals: [], total: 0 }, { headers: privateHeaders });
  }
  const params = new URL(request.url).searchParams;
  try {
    const result = signalResults({
      market: params.get('market') ?? 'all',
      status: params.get('status') ?? 'all',
      scope: params.get('scope') ?? 'history',
      page: params.get('page') ?? 1,
      pageSize: 7,
    });
    return Response.json({status:'available', ...result, signals:result.signals.map(customerSignal)}, {headers:privateHeaders});
  } catch {
    return Response.json({ status: 'unavailable', code: 'SIGNAL_STORE_UNAVAILABLE' }, { status: 503, headers: privateHeaders });
  }
}
