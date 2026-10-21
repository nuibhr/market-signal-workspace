// Discovery and position monitoring have different jobs. Keep this policy
// shared by local/queued workers and the UI; waking a worker is not a scan.
export const DISCOVERY_INTERVAL_MS = 10 * 60_000;
export const ACTIVE_MONITOR_INTERVAL_MS = 60_000;
export const UI_POLL_INTERVAL_MS = 60_000;
export const discoveryIntervalMs = market => ['thai','dr'].includes(market)?DISCOVERY_INTERVAL_MS:5*60_000;
export function monitorDue(signal, now) {
  const checked = Date.parse(signal.updatedAt);
  return !Number.isFinite(checked) || now - checked >= ACTIVE_MONITOR_INTERVAL_MS;
}
