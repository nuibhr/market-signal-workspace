// Anonymous HTTP acceptance checks only. No session/cookie, provider POST, scan
// trigger, real order, member write, or deployment is performed by this script.
const origin = new URL(process.argv[2] || 'http://localhost:3000');
if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
    !['http:', 'https:'].includes(origin.protocol)) throw Error('Supply an origin without credentials or a path');
const results = [];
async function probe(path, expected, options = {}, inspect) {
  try {
    const response = await fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(35_000), ...options });
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch { /* HTML and redirects are expected. */ }
    const details = inspect?.({ response, text, data }) || {};
    results.push({ path, method: options.method || 'GET', http: response.status,
      passed: expected.includes(response.status) && details.valid !== false,
      cache: response.headers.get('cache-control'), ...details });
  } catch (error) { results.push({ path, method: options.method || 'GET', passed: false, error: error.name }); }
}
for (const path of ['/', '/markets', '/thai', '/dr', '/us', '/tfex', '/forex', '/account', '/coaches'])
  await probe(path, [200], {}, ({ text }) => ({ valid: text.includes('<main'),
    ...(['/', '/markets'].includes(path) ? { robot: text.includes('ng-landing') } : {}) }));
for (const path of ['/community', '/team', '/coach', '/admin'])
  await probe(path, [307], {}, ({ response }) => ({ valid: response.headers.get('location')?.startsWith('/account') === true }));
for (const path of ['/api/health', '/api/account', '/api/membership', '/api/auto-pick', '/api/auto-pick/results', '/api/coaches', '/api/forex/mt5', '/api/news', '/api/macro'])
  await probe(path, [200], {}, ({ data }) => ({ status: data?.status, configured: data?.configured,
    ...(path === '/api/account' ? { valid: data?.account === null } : {}),
    ...(path === '/api/auto-pick' ? { worker: data?.workerProcess, workers: data?.workers, coverage: data?.coverage } : {}),
    ...(path === '/api/forex/mt5' ? { valid: data?.authorized === false && data?.snapshot === null,
      receiverEnabled: data?.capabilities?.enabled, serverCount: data?.capabilities?.servers?.length } : {}) }));
for (const [path, expected] of [['/api/community', 401], ['/api/favorites', 401], ['/api/holdings', 403], ['/api/signals',403],
  ['/api/auto-pick/events', 403], ['/api/signal-backtest', 403], ['/api/technical-plan?symbol=PTT', 403],
  ['/api/admin/system', 403], ['/api/admin/audit', 403], ['/api/admin/memberships', 403]])
  await probe(path, [expected], {}, ({ data }) => ({ code: data?.error || data?.code || data?.status }));
for (const [path, expected] of [['/api/account', 401], ['/api/favorites', 401], ['/api/community', 401],
  ['/api/assistant', 401], ['/api/holdings', 403], ['/api/signals',403], ['/api/coaches', 403], ['/api/admin/memberships', 403], ['/api/forex/mt5', 401]]) {
  const body = JSON.stringify(path === '/api/forex/mt5' ? { action: 'pair', server: 'VantageMarkets-Demo' } : {});
  await probe(path, [expected], { method: 'POST', headers: { Origin: origin.origin, 'Content-Type': 'application/json' }, body },
    ({ data }) => ({ code: data?.error || data?.code }));
  await probe(path, [403], { method: 'POST', headers: { Origin: 'https://cross-origin.invalid', 'Content-Type': 'application/json' }, body },
    ({ data }) => ({ code: data?.error || data?.code }));
}
await probe('/api/auto-pick/run', [403], { method: 'POST' });
await probe('/api/us-bars?symbol=NVDA&timeframe=15m', [422], {}, ({ data }) => ({ code: data?.code }));
for (const path of ['/api/market-data?symbol=PTT&timeframe=15m', '/api/market-data?symbol=AAPL80&timeframe=15m',
  '/api/tfex/candles?symbol=S50Z26&timeframe=15m', '/api/us-bars?symbol=NVDA&timeframe=1d',
  '/api/history-bars?market=forex&symbol=EUR%2FUSD&timeframe=1h'])
  await probe(path, [200], {}, ({ data }) => ({ valid: data?.status === 'available' && data?.bars?.length > 0,
    status: data?.status, code: data?.code, source: data?.source, timeframe: data?.timeframe,
    bars: data?.bars?.length, latestBar: data?.bars?.at(-1)?.time, freshness: data?.freshness, receivedAt: data?.receivedAt }));
const report = { checkedAt: new Date().toISOString(), origin: origin.origin,
  scope: 'Anonymous HTTP, source feeds and guard checks; does not certify browser, LINE consent, audio, native MT5 or production launch',
  total: results.length, passed: results.filter(item => item.passed).length, results };
console.log(JSON.stringify(report, null, 2));
if (report.passed !== report.total) process.exitCode = 1;
