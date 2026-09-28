import { createPrivateKey, sign } from 'node:crypto';

const LOGIN_BASE = 'https://open-api.settrade.com/api/oam/v1';
const MARKET_BASE = 'https://marketapi.settrade.com/api';
const TIMEOUT_MS = 10_000;
const CANDLE_INTERVALS = Object.freeze({ '15m': '15m', '1h': '60m', '4h': '240m', '1d': '1d' });

export class SettradeDataError extends Error {
  constructor(code, status = null) {
    super(code);
    this.name = 'SettradeDataError';
    this.code = code;
    this.status = status;
  }
}

function getSettradeConfiguration(env = process.env, market = 'SET') {
  if (market === 'TFEX') {
    const brokerId = env.TFEX_BROKER_ID?.trim() || env.SETTRADE_BROKER_ID?.trim() || '';
    const appCode = env.TFEX_APP_CODE?.trim() || env.SETTRADE_APP_CODE?.trim() || '';
    const appId = env.TFEX_APP_ID?.trim() || '';
    const appSecret = env.TFEX_APP_SECRET?.trim() || env.TFEX_API_SECRET?.trim() || '';
    return {
      market, brokerId, appCode, appId, appSecret,
      missing: [
        ['TFEX_BROKER_ID or SETTRADE_BROKER_ID', brokerId],
        ['TFEX_APP_CODE or SETTRADE_APP_CODE', appCode],
        ['TFEX_APP_ID', appId],
        ['TFEX_APP_SECRET or TFEX_API_SECRET', appSecret],
      ].filter(([, value]) => !value).map(([name]) => name),
    };
  }
  const brokerId = env.SETTRADE_BROKER_ID?.trim() ?? '';
  const appCode = env.SETTRADE_APP_CODE?.trim() ?? '';
  const appId = env.BROKER_APP_ID?.trim() || env.SETTRADE_APP_ID?.trim() || '';
  const appSecret = env.BROKER_API_SECRET?.trim() || env.SETTRADE_APP_SECRET?.trim() || '';
  return {
    market,
    brokerId, appCode, appId, appSecret,
    missing: [
      ['SETTRADE_BROKER_ID', brokerId],
      ['SETTRADE_APP_CODE', appCode],
      ['BROKER_APP_ID or SETTRADE_APP_ID', appId],
      ['BROKER_API_SECRET or SETTRADE_APP_SECRET', appSecret],
    ].filter(([, value]) => !value).map(([name]) => name),
  };
}

function createSignature(appId, secret, timestamp) {
  const decoded = Buffer.from(secret, 'base64');
  const raw = decoded.length === 33 && decoded[0] === 0 ? decoded.subarray(1) : decoded;
  if (raw.length !== 32) throw new SettradeDataError('INVALID_CREDENTIAL_FORMAT');
  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from('3041020100301306072a8648ce3d020106082a8648ce3d0301070427', 'hex'),
      Buffer.from('30250201010420', 'hex'), raw,
    ]),
    format: 'der', type: 'pkcs8',
  });
  return sign('sha256', Buffer.from(`${appId}..${timestamp}`, 'utf8'), privateKey).toString('hex');
}

function parseTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isFinite(date.valueOf()) ? date.toISOString() : null;
  }
  if (typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/i.test(value)) {
    const date = new Date(value);
    return Number.isFinite(date.valueOf()) ? date.toISOString() : null;
  }
  return null;
}

function bangkokDate(iso) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function candleDay(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value ? value : null;
  }
  const iso = parseTimestamp(value);
  return iso ? bangkokDate(iso) : null;
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function numericValue(value) {
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return finiteNumber(value);
}

function unwrapQuote(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  for (const key of ['data', 'result', 'quote']) {
    const nested = raw[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested) && Object.keys(nested).length) return nested;
  }
  return raw;
}

function quoteValue(raw, keys) {
  for (const key of keys) if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  return null;
}

export function normalizeSettradeQuote(payload, symbol, receivedAt, market = 'SET') {
  const raw = unwrapQuote(payload);
  const receivedPrice = numericValue(quoteValue(raw, ['last', 'lastPrice', 'last_price', 'lastPaid']));
  const price = receivedPrice !== null && receivedPrice > 0 ? receivedPrice : null;
  const observedAt = parseTimestamp(quoteValue(raw, ['time', 'timestamp', 'quoteTime', 'updatedAt', 'lastUpdateTime']));
  const tfex = market === 'TFEX';
  return {
    instrumentId: `${tfex ? 'TFEX' : 'SET'}:${symbol}`,
    symbol,
    source: tfex ? 'TFEX Open API' : 'Settrade Market API',
    price,
    change: numericValue(quoteValue(raw, ['change', 'changePrice', 'priceChange', 'change_price'])),
    changePercent: numericValue(quoteValue(raw, ['percentChange', 'changePercent', 'pctChange', 'percent_change'])),
    high: numericValue(quoteValue(raw, ['high', 'highPrice', 'high_price'])),
    low: numericValue(quoteValue(raw, ['low', 'lowPrice', 'low_price'])),
    volume: numericValue(quoteValue(raw, ['totalVolume', 'volume', 'tradeVolume', 'total_volume'])),
    openInterest: numericValue(quoteValue(raw, ['openInterest', 'oi', 'open_interest'])),
    marketStatus: typeof quoteValue(raw, ['marketStatus', 'market_status', 'tradingStatus']) === 'string'
      ? quoteValue(raw, ['marketStatus', 'market_status', 'tradingStatus']) : null,
    observedAt,
    receivedAt,
    latency: observedAt ? 'source-timestamp-available' : 'unknown',
    status: price === null ? 'unavailable' : 'available',
  };
}

export function normalizeSettradeDailyCandles(raw, symbol, receivedAt) {
  const columns = ['time', 'open', 'high', 'low', 'close', 'volume'];
  const arrays = Object.fromEntries(columns.map(column => [column, Array.isArray(raw?.[column]) ? raw[column] : []]));
  const total = arrays.time.length;
  const byDay = new Map();
  const duplicatedDays = new Set();
  let rejected = 0;
  for (let index = 0; index < total; index += 1) {
    const time = candleDay(arrays.time[index]);
    const open = finiteNumber(arrays.open[index]);
    const high = finiteNumber(arrays.high[index]);
    const low = finiteNumber(arrays.low[index]);
    const close = finiteNumber(arrays.close[index]);
    const volume = finiteNumber(arrays.volume[index]);
    if (!time || open === null || high === null || low === null || close === null || volume === null
      || open <= 0 || close <= 0 || low <= 0 || volume < 0
      || high < Math.max(open, close, low) || low > Math.min(open, close)) {
      rejected += 1;
      continue;
    }
    // Duplicate trading days are ambiguous; never quietly choose one bar.
    if (byDay.has(time)) {
      byDay.delete(time);
      duplicatedDays.add(time);
      rejected += 2;
      continue;
    }
    if (duplicatedDays.has(time)) {
      rejected += 1;
      continue;
    }
    byDay.set(time, { time, open, high, low, close, volume });
  }
  return {
    instrumentId: `SET:${symbol}`,
    symbol,
    source: 'Settrade Market API',
    timeframe: '1d',
    receivedAt,
    bars: [...byDay.values()].sort((a, b) => a.time.localeCompare(b.time)),
    diagnostics: { received: total, rejected },
    status: byDay.size ? 'available' : 'unavailable',
  };
}

/** Intraday bars use UTC seconds, as required by Lightweight Charts. */
export function normalizeSettradeIntradayCandles(raw, symbol, receivedAt, timeframe) {
  const columns = ['time', 'open', 'high', 'low', 'close', 'volume'];
  const arrays = Object.fromEntries(columns.map(column => [column, Array.isArray(raw?.[column]) ? raw[column] : []]));
  const byTime = new Map();
  const duplicatedTimes = new Set();
  let rejected = 0;
  for (let index = 0; index < arrays.time.length; index += 1) {
    const timestamp = arrays.time[index];
    const time = Number.isInteger(timestamp) && timestamp > 1_000_000_000 && timestamp < 10_000_000_000 ? timestamp : null;
    const open = finiteNumber(arrays.open[index]);
    const high = finiteNumber(arrays.high[index]);
    const low = finiteNumber(arrays.low[index]);
    const close = finiteNumber(arrays.close[index]);
    const volume = finiteNumber(arrays.volume[index]);
    if (time === null || open === null || high === null || low === null || close === null || volume === null
      || open <= 0 || close <= 0 || low <= 0 || volume < 0
      || high < Math.max(open, close, low) || low > Math.min(open, close)) {
      rejected += 1;
      continue;
    }
    if (byTime.has(time)) {
      byTime.delete(time);
      duplicatedTimes.add(time);
      rejected += 2;
      continue;
    }
    if (duplicatedTimes.has(time)) { rejected += 1; continue; }
    byTime.set(time, { time, open, high, low, close, volume });
  }
  return {
    instrumentId: `SET:${symbol}`,
    symbol,
    source: 'Settrade Market API',
    timeframe,
    receivedAt,
    bars: [...byTime.values()].sort((a, b) => a.time - b.time),
    diagnostics: { received: arrays.time.length, rejected },
    status: byTime.size ? 'available' : 'unavailable',
  };
}

/** Older bars remain visible as history, but cannot qualify a new signal. */
export function assessDailySeries(series, now = Date.now(), maxAgeDays = 7) {
  const latestDay = series.bars.at(-1)?.time ?? null;
  if (!latestDay) return { freshness: 'unavailable', latestDay: null, ageDays: null, signalEligible: false };
  const latest = Date.parse(`${latestDay}T00:00:00.000Z`);
  const today = Date.parse(`${bangkokDate(new Date(now).toISOString())}T00:00:00.000Z`);
  const ageDays = Math.round((today - latest) / 86_400_000);
  const freshness = ageDays >= 0 && ageDays <= maxAgeDays ? 'recent' : 'stale';
  return { freshness, latestDay, ageDays, signalEligible: freshness === 'recent' };
}

export function assessIntradaySeries(series, now = Date.now(), maxAgeHours = 72) {
  const latestSeconds = series.bars.at(-1)?.time ?? null;
  if (!Number.isInteger(latestSeconds)) return { freshness: 'unavailable', latestDay: null, latestTime: null, ageHours: null, signalEligible: false };
  const latestTime = new Date(latestSeconds * 1000).toISOString();
  const ageHours = (now - latestSeconds * 1000) / 3_600_000;
  const freshness = ageHours >= 0 && ageHours <= maxAgeHours ? 'recent' : 'stale';
  return { freshness, latestDay: bangkokDate(latestTime), latestTime, ageHours, signalEligible: freshness === 'recent' };
}

function safeSymbol(symbol) {
  if (typeof symbol !== 'string' || !/^[A-Z0-9-]{1,24}$/.test(symbol)) {
    throw new SettradeDataError('INVALID_SYMBOL');
  }
  return symbol;
}

export function createSettradeClient(options = {}) {
  const { env = process.env, fetcher = fetch, now = Date.now, market = 'SET' } = options;
  const config = getSettradeConfiguration(env, market);
  let token = null;
  let expiresAt = 0;
  let loginPromise = null;
  async function request(url, init, code) {
    let response;
    try {
      response = await fetcher(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new SettradeDataError('NETWORK_UNAVAILABLE');
    }
    if (!response.ok) throw new SettradeDataError(code, response.status);
    try {
      return await response.json();
    } catch {
      throw new SettradeDataError('INVALID_RESPONSE');
    }
  }
  async function login() {
    if (config.missing.length) throw new SettradeDataError('NOT_CONFIGURED');
    if (token && expiresAt > now()) return token;
    if (!loginPromise) {
      loginPromise = (async () => {
        const timestamp = String(now());
        const signature = createSignature(config.appId, config.appSecret, timestamp);
        const payload = await request(
          `${LOGIN_BASE}/${encodeURIComponent(config.brokerId)}/broker-apps/${encodeURIComponent(config.appCode)}/login`,
          { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ apiKey: config.appId, params: '', signature, timestamp }) },
          'AUTH_FAILED',
        );
        if (typeof payload?.access_token !== 'string' || !payload.access_token) throw new SettradeDataError('INVALID_AUTH_RESPONSE');
        token = payload.access_token;
        expiresAt = now() + Math.max(0, (Number(payload.expires_in) || 3600) - 30) * 1000;
        return token;
      })();
    }
    try { return await loginPromise; } finally { loginPromise = null; }
  }
  async function marketRequest(path) {
    const accessToken = await login();
    try {
      return await request(`${MARKET_BASE}/${path}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` } }, 'MARKET_DATA_UNAVAILABLE');
    } catch (error) {
      if (!(error instanceof SettradeDataError) || error.status !== 401) throw error;
      token = null;
      const refreshed = await login();
      return request(`${MARKET_BASE}/${path}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${refreshed}` } }, 'MARKET_DATA_UNAVAILABLE');
    }
  }
  async function getQuote(symbol) {
    safeSymbol(symbol);
    const raw = await marketRequest(`marketdata/v3/${encodeURIComponent(config.brokerId)}/quote/${encodeURIComponent(symbol)}`);
    return normalizeSettradeQuote(raw, symbol, new Date(now()).toISOString(), market);
  }
  async function getCandles(symbol, timeframe = '1d') {
    if (market === 'TFEX') throw new SettradeDataError('HISTORICAL_ENDPOINT_NOT_VERIFIED');
    safeSymbol(symbol);
    const interval = CANDLE_INTERVALS[timeframe];
    if (!interval) throw new SettradeDataError('INVALID_TIMEFRAME');
    const raw = await marketRequest(`techchart/v3/${encodeURIComponent(config.brokerId)}/candlesticks?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=100`);
    const receivedAt = new Date(now()).toISOString();
    return timeframe === '1d'
      ? normalizeSettradeDailyCandles(raw, symbol, receivedAt)
      : normalizeSettradeIntradayCandles(raw, symbol, receivedAt, timeframe);
  }
  async function getDailyCandles(symbol) { return getCandles(symbol, '1d'); }
  return { configuration: { configured: config.missing.length === 0, missing: config.missing }, login, getQuote, getCandles, getDailyCandles };
}

export function createTfexClient(options = {}) {
  return createSettradeClient({ ...options, market: 'TFEX' });
}
