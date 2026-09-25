const BASE_URL = 'https://data-api.binance.vision';
const TIMEOUT_MS = 10_000;
const MAX_CANDLES = 1_000;
const INTERVALS = new Set(['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M']);

export class BinanceSpotDataError extends Error {
  constructor(code, status = null) {
    super(code);
    this.name = 'BinanceSpotDataError';
    this.code = code;
    this.status = status;
  }
}

function safeSymbol(symbol) {
  if (typeof symbol !== 'string' || !/^[A-Z0-9]{2,24}$/.test(symbol)) {
    throw new BinanceSpotDataError('INVALID_SYMBOL');
  }
  return symbol;
}

function finiteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }
  return null;
}

function normalizeCandle(row, currentTime) {
  if (!Array.isArray(row) || row.length < 7) return null;
  const openTime = finiteNumber(row[0]);
  const open = finiteNumber(row[1]);
  const high = finiteNumber(row[2]);
  const low = finiteNumber(row[3]);
  const close = finiteNumber(row[4]);
  const volume = finiteNumber(row[5]);
  const closeTime = finiteNumber(row[6]);
  if (openTime === null || closeTime === null || open === null || high === null || low === null
    || close === null || volume === null || open <= 0 || close <= 0 || low <= 0 || volume < 0
    || high < Math.max(open, close, low) || low > Math.min(open, close) || closeTime < openTime) return null;
  return {
    time: Math.floor(openTime / 1000),
    openTime: new Date(openTime).toISOString(),
    closeTime: new Date(closeTime).toISOString(),
    open,
    high,
    low,
    close,
    volume,
    trades: Number.isInteger(Number(row[8])) ? Number(row[8]) : null,
    closed: closeTime < currentTime,
  };
}

export function createBinanceSpotClient({ fetcher = fetch, now = Date.now } = {}) {
  async function request(path, query, code) {
    const url = new URL(path, BASE_URL);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
    let response;
    try {
      response = await fetcher(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new BinanceSpotDataError('NETWORK_UNAVAILABLE');
    }
    if (!response.ok) throw new BinanceSpotDataError(code, response.status);
    try {
      return await response.json();
    } catch {
      throw new BinanceSpotDataError('INVALID_RESPONSE');
    }
  }

  async function getSpotSymbols() {
    const payload = await request('/api/v3/exchangeInfo', {}, 'EXCHANGE_INFO_UNAVAILABLE');
    if (!Array.isArray(payload?.symbols)) throw new BinanceSpotDataError('INVALID_RESPONSE');
    return payload.symbols
      .filter(row => row?.status === 'TRADING' && row.isSpotTradingAllowed !== false)
      .map(row => ({
        symbol: row.symbol,
        venue: 'BINANCE',
        productType: 'spot',
        baseAsset: typeof row.baseAsset === 'string' ? row.baseAsset : null,
        quoteAsset: typeof row.quoteAsset === 'string' ? row.quoteAsset : null,
        status: 'TRADING',
        source: 'Binance Spot',
      }));
  }

  async function getExchangeInfo(symbol) {
    const requested = safeSymbol(symbol);
    const payload = await request('/api/v3/exchangeInfo', { symbol: requested }, 'EXCHANGE_INFO_UNAVAILABLE');
    const row = Array.isArray(payload?.symbols) ? payload.symbols.find(item => item?.symbol === requested) : null;
    if (!row) return { symbol: requested, venue: 'BINANCE', productType: 'spot', status: 'unavailable', source: 'Binance Spot' };
    return {
      symbol: row.symbol,
      venue: 'BINANCE',
      productType: 'spot',
      baseAsset: typeof row.baseAsset === 'string' ? row.baseAsset : null,
      quoteAsset: typeof row.quoteAsset === 'string' ? row.quoteAsset : null,
      status: row.status === 'TRADING' && row.isSpotTradingAllowed !== false ? 'available' : 'unavailable',
      source: 'Binance Spot',
    };
  }

  async function getQuote(symbol) {
    const requested = safeSymbol(symbol);
    const raw = await request('/api/v3/ticker/24hr', { symbol: requested }, 'QUOTE_UNAVAILABLE');
    const price = finiteNumber(raw?.lastPrice);
    const receivedAt = new Date(now()).toISOString();
    return {
      instrumentId: `BINANCE:SPOT:${requested}`,
      symbol: requested,
      venue: 'BINANCE',
      productType: 'spot',
      source: 'Binance Spot',
      price: price !== null && price > 0 ? price : null,
      change: finiteNumber(raw?.priceChange),
      changePercent: finiteNumber(raw?.priceChangePercent),
      high: finiteNumber(raw?.highPrice),
      low: finiteNumber(raw?.lowPrice),
      baseVolume: finiteNumber(raw?.volume),
      quoteVolume: finiteNumber(raw?.quoteVolume),
      observedAt: null,
      receivedAt,
      status: price !== null && price > 0 ? 'available' : 'unavailable',
    };
  }

  async function getCandles(symbol, interval = '1d', limit = 500) {
    const requested = safeSymbol(symbol);
    if (!INTERVALS.has(interval)) throw new BinanceSpotDataError('INVALID_INTERVAL');
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CANDLES) throw new BinanceSpotDataError('INVALID_LIMIT');
    const raw = await request('/api/v3/klines', { symbol: requested, interval, limit }, 'CANDLES_UNAVAILABLE');
    if (!Array.isArray(raw)) throw new BinanceSpotDataError('INVALID_RESPONSE');

    const barsByOpenTime = new Map();
    const duplicateTimes = new Set();
    const currentTime = now();
    let rejected = 0;
    for (const row of raw) {
      const bar = normalizeCandle(row, currentTime);
      if (!bar) { rejected += 1; continue; }
      if (barsByOpenTime.has(bar.time)) {
        barsByOpenTime.delete(bar.time);
        duplicateTimes.add(bar.time);
        rejected += 2;
      } else if (duplicateTimes.has(bar.time)) {
        rejected += 1;
      } else {
        barsByOpenTime.set(bar.time, bar);
      }
    }
    const bars = [...barsByOpenTime.values()].sort((a, b) => a.time - b.time);
    return {
      instrumentId: `BINANCE:SPOT:${requested}`,
      symbol: requested,
      venue: 'BINANCE',
      productType: 'spot',
      source: 'Binance Spot',
      timeframe: interval,
      receivedAt: new Date(now()).toISOString(),
      bars,
      diagnostics: { received: raw.length, rejected },
      status: bars.length ? 'available' : 'unavailable',
    };
  }

  return { getSpotSymbols, getExchangeInfo, getQuote, getCandles };
}
