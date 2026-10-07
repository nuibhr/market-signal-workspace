import { refreshNextBacktest, backtestSummary } from '../src/auto-pick/backtest-summary.mjs';
const limit = Math.max(1, Math.min(500, Number(process.argv[2]) || 10));
for (let index=0;index<limit;index++) {
  const next=await refreshNextBacktest(); if (!next) break;
  process.stdout.write(`Historical summary updated: ${next.market}/${next.symbol}\n`);
}
const report=(await backtestSummary());
process.stdout.write(`Processed ${report.summary.processed}/${report.summary.expected}; entered ${report.summary.entries}; closed ${report.summary.closed}; complete history ${report.summary.completeHistory}.\n`);
