// Includes response-body parsing in the deadline. Never retry a pairing POST:
// a lost response may already have created/replaced the one-time upload key.
export async function mt5Json(url, options = {}, { fetcher = globalThis.fetch, timeoutMs = 15_000 } = {}) {
  const controller = new AbortController();
  let timer, cancel;
  const stopped = new Promise((_, reject) => {
    cancel = () => {
      controller.abort();
      reject(new DOMException('Request cancelled', 'AbortError'));
    };
    timer = setTimeout(() => {
      controller.abort();
      reject(new DOMException('MT5 request timed out', 'TimeoutError'));
    }, timeoutMs);
  });
  const signal = options.signal;
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  try {
    return await Promise.race([stopped, (async () => {
      if (controller.signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
      const response = await fetcher(url, { ...options, signal: controller.signal });
      return { ok: response.ok, status: response.status, data: await response.json() };
    })()]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

// Selection changes, a newer poll, or a mutation invalidate every older read,
// even when a transport completes after abort. Mutations refresh the latest selection.
export function createMt5Reader({ fetcher = globalThis.fetch, timeoutMs, onData }) {
  let selection = {}, revision = 0, active;
  function invalidate() {
    revision++;
    active?.abort();
    active = null;
  }
  function select(symbol, frame) {
    invalidate();
    selection = { symbol, frame };
  }
  async function refresh() {
    invalidate();
    const current = revision, controller = new AbortController();
    active = controller;
    const params = new URLSearchParams();
    if (selection.symbol) params.set('symbol', selection.symbol);
    if (selection.frame) params.set('frame', selection.frame);
    try {
      const result = await mt5Json(`/api/forex/mt5?${params}`, { cache: 'no-store', signal: controller.signal }, { fetcher, timeoutMs });
      if (current !== revision) return null;
      if (!result.ok) throw Error('ระบบรับข้อมูลไม่พร้อม กรุณาลองอีกครั้ง');
      onData(result.data);
      return result.data;
    } catch (error) {
      if (current !== revision) return null;
      throw error;
    } finally {
      if (active === controller) active = null;
    }
  }
  return { select, invalidate, refresh };
}

export function staleMt5Data(previous) {
  return { ...previous, status: previous.snapshot ? 'stale' : 'error',
    chart: previous.chart ? { ...previous.chart, stale: true } : null,
    quotes: Object.fromEntries(Object.entries(previous.quotes).map(([key, value]) => [key, { ...value, stale: true }])) };
}
