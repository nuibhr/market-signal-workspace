const fault = code => Object.assign(new Error(code), { code });
const denied = code => ['MEMBERSHIP_REQUIRED','AUTHENTICATION_REQUIRED','OWNER_ONLY','FORBIDDEN','DISPLAY_RIGHTS_NOT_CONFIRMED','INVALID_SYMBOL','INVALID_MARKET','INVALID_DATA_REQUEST','RATE_LIMITED'].includes(code);
async function read(url, signal, fetcher, timeoutMs) {
  const controller = new AbortController();
  let timer, stop;
  const cancelled = new Promise((_, reject) => {
    stop = () => { controller.abort(); reject(new DOMException('Cancelled', 'AbortError')); };
    timer = setTimeout(() => { controller.abort(); reject(fault('SOURCE_TIMEOUT')); }, timeoutMs);
  });
  signal?.addEventListener('abort', stop, { once: true });
  if (signal?.aborted) stop();
  try {
    return await Promise.race([cancelled, (async () => {
      if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const response = await fetcher(url, { cache: 'no-store', signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) throw fault(payload?.error?.code || payload?.code || 'SOURCE_UNAVAILABLE');
      return payload;
    })()]);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', stop); }
}
const usable = (value, asset, frame) => value?.status === 'available' && value.instrumentId === asset.instrumentId && value.timeframe === frame && Array.isArray(value.bars) && value.bars.length > 0;
const latest = value => typeof value?.bars?.at(-1)?.time === 'number' ? value.bars.at(-1).time * 1000 : Date.parse(value?.bars?.at(-1)?.time);

export async function loadChartCandles(asset, timeframe, { signal, fetcher = globalThis.fetch, timeoutMs = 25000, ownerPreview = false } = {}) {
  if(ownerPreview){
    if(timeframe!=='1d')throw fault('INVALID_DATA_REQUEST');
    const query=new URLSearchParams({market:asset.id,symbol:asset.symbol,timeframe,view:'chart'});
    const value=await read('/api/owner-preview?'+query,signal,fetcher,timeoutMs);
    if(!usable(value,asset,timeframe)||value.disclosureScope!=='OWNER_INTERNAL'||value.signalEligible!==false)throw fault('INVALID_SERIES');
    return value;
  }
  const route = asset.feed === 'settrade-daily' ? '/api/market-data' : asset.feed === 'tfex-quote' ? '/api/tfex/candles'
    : asset.id === 'us' && timeframe === '1d' ? '/api/us-bars' : '/api/history-bars';
  const query = new URLSearchParams({ symbol: asset.symbol, market: asset.id, timeframe });
  let primary;
  try {
    primary = await read(`${route}?${query}`, signal, fetcher, timeoutMs);
    if (!usable(primary, asset, timeframe)) throw fault('INVALID_SERIES');
    if (primary.freshness !== 'stale' || route === '/api/history-bars') return primary;
  } catch (error) {
    if (signal?.aborted || denied(error.code) || route === '/api/history-bars') throw error;
    primary = null;
  }
  try {
    const backup = await read(`/api/history-bars?${query}`, signal, fetcher, timeoutMs);
    if (!usable(backup, asset, timeframe) || !backup.chartOnly || backup.signalEligible !== false) throw fault('INVALID_BACKUP_SERIES');
    return primary && latest(primary) > latest(backup) ? primary : backup;
  } catch (error) {
    if (signal?.aborted || denied(error.code) || !primary) throw error;
    return primary; // Preserve honest stale candles if every newer source fails.
  }
}
