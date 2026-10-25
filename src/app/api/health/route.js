import { storage } from '../../../storage/database.mjs';
import { workerProcessHealth } from '../../../auto-pick/store.mjs';
import {dailyWindow} from '../../../scanner/daily.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    await storage.first('SELECT 1');
    const worker = (await workerProcessHealth());
    const signalWorker=await storage.first('SELECT MAX(heartbeat_ms) AS lastSeen FROM signal_desk_leases');
    const idleAfterMs=process.env.AUTO_PICK_RUNTIME==='cloudflare'?420000:180000;
    const active=signalWorker?.lastSeen&&Date.now()-signalWorker.lastSeen<idleAfterMs;
    const daily=process.env.SHARED_MARKET_DATA_MODE==='daily',window=daily?dailyWindow():null;
    const scanner=active?'running':daily?'scheduled':'offline';
    return Response.json({ status: 'ok', storage: 'available', scanner,legacyScanner:worker.status,signalRule:'swing-standard-forward-v1',dataMode:daily?'daily-snapshot':'continuous',nextDailyRunAt:window?new Date(window.next).toISOString():null }, { headers });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
