// Owner data must never appear in an anonymous health check.
try {
  const response = await fetch("http://127.0.0.1:3000/api/forex/mt5", { signal: AbortSignal.timeout(5000) });
  const data = await response.json();
  if (!response.ok || !data.capabilities?.enabled || !data.capabilities.memberLoginConfigured ||
    data.capabilities.local || data.capabilities.localFiles || data.authorized || data.snapshot ||
    Object.keys(data.quotes || {}).length || data.chart) process.exitCode = 1;
} catch { process.exitCode = 1; }
