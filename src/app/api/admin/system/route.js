import { usEodSession } from '../../../../market-data/fmp-us.mjs';
import { usScanSlot } from '../../../../markets/us-universe.mjs';
import { currentMember, privateHeaders } from '../../../../membership/server.mjs';
import { isAdmin } from '../../../../membership/store.mjs';
import { autoPickReadiness } from '../../../../auto-pick/runner.mjs';
import { scanCoverage, scannerHealth, workerProcessHealth } from '../../../../auto-pick/store.mjs';
import { thaiSession } from '../../../../auto-pick/engine.mjs';
import { drSession } from '../../../../auto-pick/dr-orb.mjs';
import { webullSdkHealth } from '../../../../market-data/webull-status.mjs';
import { storage } from '../../../../storage/database.mjs';
import { adminLaunchReadiness } from '../../../../admin/readiness.mjs';

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
      const { pending, unresolved, ...summary } = (await scanCoverage(market.id, key, market.universe ?? [], now));
      coverage[market.id] = { ...summary, sessionKey: key, retrySymbols: unresolved };
    }
    const workers = Object.fromEntries(await Promise.all(['thai', 'dr', 'us'].map(async id => [id, (await scannerHealth(now, id))])));
    const [runs,outcomeRows,workerProcess,webull]=await Promise.all([
      storage.all('SELECT id,market,slot,status,started_at AS startedAt,finished_at AS finishedAt,scanned,candidates,error_code AS errorCode FROM auto_pick_runs ORDER BY started_at DESC LIMIT 7'),
      storage.all('SELECT status,COUNT(*) AS count FROM auto_pick_signals GROUP BY status'),
      workerProcessHealth(now),webullSdkHealth().catch(()=>null),
    ]);
    const launch=await adminLaunchReadiness(workerProcess);
    return Response.json({ updatedAt: new Date(now).toISOString(), markets, coverage, workers, workerProcess, runs,
      outcomes:Object.fromEntries(outcomeRows.map(row=>[row.status,row.count])),webull,launch }, { headers: privateHeaders });
  } catch {
    return Response.json({ error: 'SYSTEM_STATUS_UNAVAILABLE' }, { status: 503, headers: privateHeaders });
  }
}
