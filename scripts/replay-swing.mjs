import { loadSwingManifest } from '../src/backtest/dataset.mjs';
import { runStandardResearch } from '../src/backtest/swing-replay.mjs';
if (!process.argv[2]) {
  console.log('Usage: node scripts/replay-swing.mjs /absolute/dataset/manifest.json');
  console.log('Research Standard only. Incomplete data returns blocked with no performance metrics. No live orders or database writes.');
  process.exitCode = 1;
} else {
  try {
    const { manifest, frames, report } = loadSwingManifest(process.argv[2]);
    const result = runStandardResearch(manifest, frames, report);
    console.log(JSON.stringify(result, null, 2));
    if (result.status === 'blocked') process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ status: 'blocked', strategyValidated: false, metrics: null,
      code: /^[A-Z][A-Z0-9_]+$/.test(error.code || '') ? error.code : 'MANIFEST_OR_REPLAY_UNAVAILABLE' }));
    process.exitCode = 1;
  }
}
