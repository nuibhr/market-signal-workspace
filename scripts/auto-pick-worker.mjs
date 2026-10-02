import { runThaiAutoPick, runDrAutoPick, runUsAutoPick, autoPickReadiness } from '../src/auto-pick/runner.mjs';
import { heartbeatWorker, reconcileWatchPlans } from '../src/auto-pick/store.mjs';

const initialReadiness = autoPickReadiness();
if (!initialReadiness.enabled || !process.env.AUTO_PICK_RUN_SECRET || process.env.AUTO_PICK_RUN_SECRET.length < 32) {
  process.stderr.write('AutoPick is not configured. Check enabled market flags, data credentials/rights, persistent storage and AUTO_PICK_RUN_SECRET.\n');
  process.exitCode = 1;
} else {
  process.stdout.write(`AutoPick worker ready. Markets enabled: ${initialReadiness.markets.filter(item => item.status === 'active').map(item => item.id).join(', ')}.\n`);
  // Keep the liveness marker current while a long market scan is awaiting provider calls.
  setInterval(() => {
    try { heartbeatWorker(); }
    catch (error) { process.stderr.write(`${new Date().toISOString()} Worker heartbeat failed: ${error.message}\n`); }
  }, 30_000);
  let lastWake = Date.now();
  while (true) {
    heartbeatWorker();
    const now = Date.now();
    if (now - lastWake > 120_000) process.stderr.write(`${new Date(now).toISOString()} AutoPick resumed after a ${Math.round((now - lastWake) / 60_000)}m process pause.\n`);
    lastWake = now;
    const readiness = autoPickReadiness();
    const enabled = new Set(readiness.markets.filter(item => item.status === 'active').map(item => item.id));
    for (const [market, run] of [['thai', runThaiAutoPick], ['dr', runDrAutoPick], ['us', runUsAutoPick]]) {
      if (!enabled.has(market)) continue;
      try {
        const result = await run(Date.now());
        if (!['outside-session', 'already-run', 'waiting-eod'].includes(result.status))
          process.stdout.write(`${new Date().toISOString()} ${market} ${result.status} scanned=${result.scanned ?? 0} candidates=${result.candidates ?? 0}\n`);
      } catch (error) {
        process.stderr.write(`${new Date().toISOString()} ${market} AutoPick run failed: ${error.message}\n`);
      }
      heartbeatWorker();
    }
    reconcileWatchPlans([...enabled]);
    // Wake frequently so sleep/wake and clock changes cannot leave an old timer pending.
    await new Promise(resolve => setTimeout(resolve, 30_000));
  }
}
