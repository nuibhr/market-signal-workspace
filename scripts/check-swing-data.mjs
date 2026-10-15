import { inspectSwingManifest } from '../src/backtest/dataset.mjs';
if (!process.argv[2]) {
  console.log('Usage: node scripts/check-swing-data.mjs /absolute/dataset/manifest.json');
  console.log('Requires native D1/4H/15m CSV files, 200 daily warmup bars, trading calendar, adjustment metadata, entry mode and costs. This checks data only; it does not run or certify a backtest.');
  process.exitCode = 1;
} else {
  try {
    const report = inspectSwingManifest(process.argv[2]); console.log(JSON.stringify(report, null, 2));
    if (report.blocked.length) process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ status: 'blocked', code: error.code || 'MANIFEST_OR_DATA_UNAVAILABLE' }));
    process.exitCode = 1;
  }
}
