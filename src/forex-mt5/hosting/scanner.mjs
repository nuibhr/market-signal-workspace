import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function scannerReadiness(readiness, allowed) {
  const active = readiness.markets.filter(m => ["thai", "dr", "us"].includes(m.id) && m.status === "active");
  return { ready: active.length > 0 && active.every(m => allowed(m.id)),
    markets: active.map(m => ({ market: m.id, sourceReady: allowed(m.id) })) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { autoPickReadiness } = await import("../../auto-pick/runner.mjs");
  const { signalProviderAllowed } = await import("../../signals/data.mjs");
  const report = scannerReadiness(autoPickReadiness(), signalProviderAllowed);
  if (!report.ready) {
    console.error(JSON.stringify({ error: "SIGNAL_SOURCES_NOT_READY", ...report }));
    process.exitCode = 1;
  } else if (process.argv.includes("--check")) {
    console.log(JSON.stringify(report));
  } else {
    await import("../../../scripts/signal-worker.mjs");
  }
}
