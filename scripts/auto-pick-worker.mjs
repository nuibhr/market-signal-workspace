import { runThaiAutoPick, runDrAutoPick, runUsAutoPick, autoPickReadiness } from '../src/auto-pick/runner.mjs';
import { createLocalScanScheduler } from '../src/auto-pick/local-scheduler.mjs';
import { SCANNER_RUNTIME_VERSION } from '../src/auto-pick/runtime-version.mjs';
import { heartbeatWorker, reconcileWatchPlans, settleOutstandingScans } from '../src/auto-pick/store.mjs';

const initialReadiness = autoPickReadiness();
if (!initialReadiness.enabled || !process.env.AUTO_PICK_RUN_SECRET || process.env.AUTO_PICK_RUN_SECRET.length < 32) {
  process.stderr.write('AutoPick is not configured. Check enabled market flags, data credentials/rights, persistent storage and AUTO_PICK_RUN_SECRET.\n');
  process.exitCode = 1;
} else {
  process.stdout.write(`AutoPick worker ready. Markets enabled: ${initialReadiness.markets.filter(item => item.status === 'active').map(item => item.id).join(', ')}.\n`);
  // Keep the liveness marker current while a long market scan is awaiting provider calls.
  setInterval(async () => {
    try { (await heartbeatWorker({runtimeVersion:SCANNER_RUNTIME_VERSION})); }
    catch (error) { process.stderr.write(`${new Date().toISOString()} Worker heartbeat failed: ${error.message}\n`); }
  }, 30_000);
  const scheduler=createLocalScanScheduler({runners:{thai:runThaiAutoPick,dr:runDrAutoPick,us:runUsAutoPick},
    onResult(market,result){if(!['outside-session','already-run','waiting-eod'].includes(result.status))process.stdout.write(`${new Date().toISOString()} ${market} ${result.status} scanned=${result.scanned??0} candidates=${result.candidates??0}\n`);},
    onError(market){process.stderr.write(`${new Date().toISOString()} ${market} AutoPick run failed\n`);}});
  let lastWake=Date.now();
  while(true) {
    await heartbeatWorker({runtimeVersion:SCANNER_RUNTIME_VERSION});
    const now=Date.now();
    if(now-lastWake>120000)process.stderr.write(`${new Date(now).toISOString()} AutoPick resumed after process pause\n`);
    lastWake=now;
    const enabled=autoPickReadiness().markets.filter(m=>m.status==='active').map(m=>m.id);
    await settleOutstandingScans(enabled,now);
    scheduler.dispatch(enabled,now);
    (await reconcileWatchPlans(enabled));
    // Wake frequently so sleep/wake and clock changes cannot leave an old timer pending.
    await new Promise(resolve => setTimeout(resolve, 30_000));
  }
}
