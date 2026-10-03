import { usEodSession } from '../../../../market-data/fmp-us.mjs';
import { usScanSlot } from '../../../../markets/us-universe.mjs';
import { currentMember, privateHeaders } from '../../../../membership/server.mjs';
import { isAdmin } from '../../../../membership/store.mjs';
import { autoPickReadiness } from '../../../../auto-pick/runner.mjs';
import { scanCoverage, scannerHealth, signalFeed, workerProcessHealth } from '../../../../auto-pick/store.mjs';
import { thaiSession } from '../../../../auto-pick/engine.mjs';
import { drSession } from '../../../../auto-pick/dr-orb.mjs';
import { webullSdkHealth } from '../../../../market-data/webull-status.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const member = await currentMember();
  if (!isAdmin(member)) return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: privateHeaders });
  try {
    const now = Date.now();
    const readiness = autoPickReadiness();
    const markets = readiness.markets.map(({ universe, ...market }) => ({ ...market, universeCount: universe?.length ?? 0 }));
    const coverage = {};
    for (const market of readiness.markets.filter(item => ['thai', 'dr', 'us'].includes(item.id))) {
      const key = market.id === 'thai' ? thaiSession(now).day : market.id === 'dr' ? drSession(now).key : usScanSlot(usEodSession(now).day);
      const { pending, unresolved, ...summary } = scanCoverage(market.id, key, market.universe ?? [], now);
      coverage[market.id] = { ...summary, sessionKey: key, retrySymbols: unresolved };
    }
    const workers = Object.fromEntries(['thai', 'dr', 'us'].map(id => [id, scannerHealth(now, id)]));
    const { runs, outcomes } = signalFeed();
    const webull = await webullSdkHealth();
    return Response.json({ updatedAt: new Date(now).toISOString(), markets, coverage, workers, workerProcess: workerProcessHealth(now), runs, outcomes, webull }, { headers: privateHeaders });
  } catch {
    return Response.json({ error: 'SYSTEM_STATUS_UNAVAILABLE' }, { status: 503, headers: privateHeaders });
  }
}
