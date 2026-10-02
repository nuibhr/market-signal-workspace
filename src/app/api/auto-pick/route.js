import { customerFeed } from '../../../auto-pick/customer-view.mjs';
import { usEodSession } from '../../../market-data/fmp-us.mjs';
import { autoPickReadiness } from '../../../auto-pick/runner.mjs';
import { scanCoverage, scannerHealth, signalFeed, workerProcessHealth } from '../../../auto-pick/store.mjs';
import { thaiSession } from '../../../auto-pick/engine.mjs';
import { drSession } from '../../../auto-pick/dr-orb.mjs';
import { currentMember, privateHeaders } from '../../../membership/server.mjs';
import { membershipFor } from '../../../membership/rights.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const rawReadiness = autoPickReadiness();
  const readiness = {enabled:rawReadiness.enabled, markets:rawReadiness.markets.map(m=>({id:m.id,label:m.label,status:m.status,universeCount:m.universe?.length??0}))};
  const rights = membershipFor(await currentMember());
  let workers;
  try { workers = { thai: scannerHealth(), dr: scannerHealth(Date.now(), 'dr'), us: scannerHealth(Date.now(), 'us') }; }
  catch { workers = Object.fromEntries(['thai', 'dr', 'us'].map(market => [market, { status: 'unavailable', lastRunAt: null }])); }
  let workerProcess;
  try { workerProcess = workerProcessHealth(); }
  catch { workerProcess = { status: 'unavailable', lastSeenAt: null }; }
  let coverage = {};
  try {
    const now = Date.now();
    const thai = rawReadiness.markets.find(market => market.id === 'thai');
    const dr = rawReadiness.markets.find(market => market.id === 'dr');
    coverage = {
      thai: scanCoverage('thai', thaiSession(now).day, thai?.universe ?? [], now),
      dr: scanCoverage('dr', drSession(now).key, dr?.universe ?? [], now),
      us: scanCoverage('us', usEodSession(now).day, rawReadiness.markets.find(market => market.id === 'us')?.universe ?? [], now),
    };
    for (const [id, item] of Object.entries(coverage)) coverage[id] = Object.fromEntries(['expected','done','ineligible','unavailable','remaining'].map(key=>[key,item[key]]));
  } catch { coverage = {}; }
  if (!rights.capabilities.autoPickFeed) {
    return Response.json({ status: 'membership-required', readiness, workers, worker: workers.thai, workerProcess, coverage, signals: [], events: [], runs: [] }, { headers: privateHeaders });
  }
  try {
    return Response.json({ status: 'available', readiness, workers, worker: workers.thai, workerProcess, coverage, ...customerFeed(signalFeed()) }, { headers: privateHeaders });
  } catch {
    return Response.json({ status: 'unavailable', code: 'SIGNAL_STORE_UNAVAILABLE', readiness }, { status: 503, headers: privateHeaders });
  }
}
