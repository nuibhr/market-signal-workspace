// Owner data must never appear in an anonymous health check, in either launch mode.
export function healthyBridge(data, preview = false) {
  return data.capabilities?.enabled === !preview &&
    (preview || data.capabilities.memberLoginConfigured === true) &&
    !data.capabilities.local && !data.capabilities.localFiles && data.authorized === false &&
    data.snapshot === null && data.chart === null && Object.keys(data.quotes || {}).length === 0;
}
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const response = await fetch("http://127.0.0.1:3000/api/forex/mt5", { signal: AbortSignal.timeout(5000) });
    if (!response.ok || !healthyBridge(await response.json(), process.env.FOREX_MT5_PREVIEW === "true")) process.exitCode = 1;
  } catch { process.exitCode = 1; }
}
