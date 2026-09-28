import { assessDailySeries } from '../../../market-data/settrade.mjs';
import { ALL_ASSETS } from '../../../markets/catalog.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'private, no-store' };
const TTL_MS = 30 * 60_000;
const cache = new Map();
const pending = new Map();
const finite = value => typeof value === 'number' && Number.isFinite(value);

function newYorkDay() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function fetchBars(asset, key) {
  const url = new URL('https://financialmodelingprep.com/stable/historical-price-eod/full');
  url.searchParams.set('symbol', asset.symbol);
  url.searchParams.set('from', new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10));
  url.searchParams.set('to', new Date().toISOString().slice(0, 10));
  url.searchParams.set('apikey', key);
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12_000) });
  if (!response.ok) {
    const error = new Error('SOURCE_UNAVAILABLE');
    error.code = response.status === 402 ? 'PLAN_REQUIRED' : response.status === 429 ? 'RATE_LIMITED' : 'SOURCE_UNAVAILABLE';
    throw error;
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error('INVALID_RESPONSE');
  const today = newYorkDay();
  const bars = payload.filter(row => row?.symbol === asset.symbol && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.date < today
    && [row.open, row.high, row.low, row.close, row.volume].every(finite)
    && row.open > 0 && row.high >= Math.max(row.open, row.close) && row.low <= Math.min(row.open, row.close) && row.low > 0 && row.volume >= 0)
    .map(row => ({ time: row.date, open: row.open, high: row.high, low: row.low, close: row.close, volume: row.volume }))
    .sort((a, b) => a.time.localeCompare(b.time)).slice(-300);
  if (!bars.length) { const error = new Error('BARS_UNAVAILABLE'); error.code = 'BARS_UNAVAILABLE'; throw error; }
  const assessment = assessDailySeries({ bars });
  const data = { status: 'available', instrumentId: asset.instrumentId, symbol: asset.symbol, market: 'US', source: 'Financial Modeling Prep · EOD',
    timeframe: '1d', receivedAt: new Date().toISOString(), latestDay: assessment.latestDay, latestTime: null, freshness: assessment.freshness,
    signalEligible: assessment.signalEligible, bars, quote: null, excludedCurrentDay: true };
  cache.set(asset.instrumentId, { data, expiresAt: Date.now() + TTL_MS });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return data;
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get('symbol')?.trim().toUpperCase() ?? '';
  const timeframe = params.get('timeframe') ?? '1d';
  if (timeframe !== '1d') return Response.json({ status: 'unavailable', code: 'TIMEFRAME_NOT_AVAILABLE' }, { status: 400, headers: HEADERS });
  const asset = ALL_ASSETS.find(item => item.id === 'us' && item.symbol === symbol);
  if (!asset) return Response.json({ status: 'unavailable', code: 'INSTRUMENT_NOT_CONNECTED' }, { status: 404, headers: HEADERS });
  if (process.env.NODE_ENV === 'production' && process.env.FMP_DISPLAY_RIGHTS_CONFIRMED !== 'true') {
    return Response.json({ status: 'unavailable', code: 'DISPLAY_RIGHTS_NOT_CONFIRMED' }, { status: 503, headers: HEADERS });
  }
  const key = process.env.FMP_API_KEY?.trim();
  if (!key) return Response.json({ status: 'unavailable', code: 'SOURCE_NOT_CONFIGURED' }, { status: 503, headers: HEADERS });
  const hit = cache.get(asset.instrumentId);
  if (hit?.expiresAt > Date.now()) return Response.json(hit.data, { headers: HEADERS });
  try {
    if (!pending.has(asset.instrumentId)) pending.set(asset.instrumentId, fetchBars(asset, key).finally(() => pending.delete(asset.instrumentId)));
    return Response.json(await pending.get(asset.instrumentId), { headers: HEADERS });
  } catch (error) {
    return Response.json({ status: 'unavailable', code: error?.code ?? 'SOURCE_UNAVAILABLE' }, { status: 503, headers: HEADERS });
  }
}
