const BASE_URL = 'https://api.twelvedata.com';
const TIMEOUT_MS = 10_000;
const MAX_CANDLES = 5_000;
const INTERVALS = new Set(['1min', '5min', '15min', '30min', '45min', '1h', '2h', '4h', '1day', '1week', '1month']);

export class TwelveDataForexError extends Error {
  constructor(code, status = null) {
    super(code);
    this.name = 'TwelveDataForexError';
    this.code = code;
    this.status = status;
  }
}

function safeSymbol(symbol) {
  if (typeof symbol !== 'string' || !/^[A-Z]{3}\/[A-Z]{3}$/.test(symbol.trim().toUpperCase())) {
    throw new TwelveDataForexError('INVALID_SYMBOL');
  }
  return symbol.trim().toUpperCase();
}

function finiteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }
  return null;
}

function safeTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value.replace(' ', 'T')}Z`);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
}

function candleEndTime(timeIso, interval) {
  const start = new Date(timeIso);
  if (interval === '1month') return Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);
  const durations = {
    '1min': 60_000, '5min': 300_000, '15min': 900_000, '30min': 1_800_000,
    '45min': 2_700_000, '1h': 3_600_000, '2h': 7_200_000, '4h': 14_400_000,
    '1day': 86_400_000, '1week': 604_800_000,
  };
  return start.valueOf() + durations[interval];
}

function normalizeCandle(row, interval, currentTime) {
  const timeIso = safeTimestamp(row?.datetime);
  const open = finiteNumber(row?.open);
  const high = finiteNumber(row?.high);
  const low = finiteNumber(row?.low);
  const close = finiteNumber(row?.close);
  if (!timeIso || open === null || high === null || low === null || close === null
    || open <= 0 || high <= 0 || low <= 0 || close <= 0
    || high < Math.max(open, close, low) || low > Math.min(open, close)) return null;
  return {
    time: Math.floor(Date.parse(timeIso) / 1000),
    openTime: timeIso,
    open,
    high,
    low,
    close,
    volume: finiteNumber(row.volume),
    closed: candleEndTime(timeIso, interval) <= currentTime,
  };
}

export function createTwelveDataForexClient({ apiKey = process.env.TWELVE_DATA_API_KEY, fetcher = fetch, now = Date.now } = {}) {
  async function request(path, query, code) {
    if (typeof apiKey !== 'string' || !apiKey.trim()) throw new TwelveDataForexError('API_KEY_NOT_CONFIGURED');
    const url = new URL(path, BASE_URL);
    for (const [key, value] of Object.entries({ ...query, apikey: apiKey })) url.searchParams.set(key, String(value));
    let response;
    try {
      response = await fetcher(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new TwelveDataForexError('NETWORK_UNAVAILABLE');
    }
    if (!response.ok) throw new TwelveDataForexError(code, response.status);
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new TwelveDataForexError('INVALID_RESPONSE');
    }
    if (payload?.status === 'error' || payload?.code || payload?.message && !payload?.values && !payload?.rate) {
      throw new TwelveDataForexError(payload?.code === 4290 ? 'RATE_LIMITED' : 'PROVIDER_REJECTED');
    }
    return payload;
  }

  async function getForexPairs() {
    const payload = await request('/forex_pairs', {}, 'PAIR_LIST_UNAVAILABLE');
    if (!Array.isArray(payload?.data)) throw new TwelveDataForexError('INVALID_RESPONSE');
    return payload.data.filter(row => typeof row?.symbol === 'string').map(row => ({
      symbol: row.symbol.toUpperCase(),
      baseAsset: row.currency_base ?? row.symbol.split('/')[0],
      quoteAsset: row.currency_quote ?? row.symbol.split('/')[1],
      group: row.currency_group ?? null,
      venue: 'TWELVE_DATA_COMPOSITE',
      productType: 'spot-fx-reference',
      status: 'available',
      source: 'Twelve Data Forex Composite',
    }));
  }

  async function getQuote(symbol) {
    const requested = safeSymbol(symbol);
    const raw = await request('/exchange_rate', { symbol: requested, timezone: 'UTC' }, 'QUOTE_UNAVAILABLE');
    const price = finiteNumber(raw?.rate);
    const timestamp = finiteNumber(raw?.timestamp);
    return {
      instrumentId: `TWELVE_DATA:FX:${requested.replace('/', '_')}`,
      symbol: requested,
      venue: 'TWELVE_DATA_COMPOSITE',
      productType: 'spot-fx-reference',
      source: 'Twelve Data Forex Composite',
      price: price !== null && price > 0 ? price : null,
      priceBasis: 'provider-reference-rate',
      bid: null,
      ask: null,
      spread: null,
      observedAt: timestamp !== null && timestamp > 0 ? new Date(timestamp * 1000).toISOString() : null,
      receivedAt: new Date(now()).toISOString(),
      status: price !== null && price > 0 ? 'available' : 'unavailable',
    };
  }

  async function getCandles(symbol, interval = '5min', limit = 500) {
    const requested = safeSymbol(symbol);
    if (!INTERVALS.has(interval)) throw new TwelveDataForexError('INVALID_INTERVAL');
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CANDLES) throw new TwelveDataForexError('INVALID_LIMIT');
    const raw = await request('/time_series', {
      symbol: requested,
      interval,
      outputsize: limit,
      timezone: 'UTC',
      order: 'ASC',
    }, 'CANDLES_UNAVAILABLE');
    if (!Array.isArray(raw?.values)) throw new TwelveDataForexError('INVALID_RESPONSE');
    const byTime = new Map();
    const duplicateTimes = new Set();
    const currentTime = now();
    let rejected = 0;
    for (const row of raw.values) {
      const bar = normalizeCandle(row, interval, currentTime);
      if (!bar) { rejected += 1; continue; }
      if (byTime.has(bar.time)) {
        byTime.delete(bar.time);
        duplicateTimes.add(bar.time);
        rejected += 2;
        continue;
      }
      if (duplicateTimes.has(bar.time)) { rejected += 1; continue; }
      byTime.set(bar.time, bar);
    }
    const bars = [...byTime.values()].sort((a, b) => a.time - b.time);
    return {
      instrumentId: `TWELVE_DATA:FX:${requested.replace('/', '_')}`,
      symbol: requested,
      venue: 'TWELVE_DATA_COMPOSITE',
      productType: 'spot-fx-reference',
      source: 'Twelve Data Forex Composite',
      priceBasis: 'provider-reference-rate',
      timeframe: interval,
      receivedAt: new Date(now()).toISOString(),
      bars,
      diagnostics: { received: raw.values.length, rejected },
      status: bars.length ? 'available' : 'unavailable',
    };
  }

  return { getForexPairs, getQuote, getCandles };
}
