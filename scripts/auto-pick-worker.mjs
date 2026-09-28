import { runThaiAutoPick, autoPickReadiness } from '../src/auto-pick/runner.mjs';

if (!autoPickReadiness().enabled || !process.env.AUTO_PICK_RUN_SECRET || process.env.AUTO_PICK_RUN_SECRET.length < 32) {
  process.stderr.write('AutoPick is not configured. Check AUTO_PICK_ENABLED, persistent storage, Settrade rights and AUTO_PICK_RUN_SECRET.\n');
  process.exitCode = 1;
} else {
  process.stdout.write('AutoPick worker ready. Thai market scans run every 15 minutes during the configured session.\n');
  while (true) {
    const now = Date.now();
    try {
      const result = await runThaiAutoPick(now);
      if (result.status !== 'outside-session' && result.status !== 'already-run')
        process.stdout.write(`${new Date().toISOString()} ${result.status} scanned=${result.scanned ?? 0} candidates=${result.candidates ?? 0}\n`);
    } catch (error) {
      process.stderr.write(`${new Date().toISOString()} AutoPick run failed: ${error.message}\n`);
    }
    const delay = Math.max(1000, Math.ceil(Date.now() / 900_000) * 900_000 - Date.now() + 3000);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
