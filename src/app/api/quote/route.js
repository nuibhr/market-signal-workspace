import { ALL_ASSETS } from '../../../markets/catalog.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'private, no-store' };
const cache = new Map();
const pending = new Map();

function finite(value) { return typeof value === 'number' && Number.isFinite(value); }

async function loadQuote(asset) {
  const providerSymbol = asset.id === 'forex' ? asset.symbol.replace('/', '') : asset.symbol;
  const url = new URL('https://financialmodelingprep.com/stable/quote');
  url.searchParams.set('symbol', providerSymbol);
  url.searchParams.set('apikey', process.env.FMP_API_KEY);
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000), cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 402 ? 'PLAN_REQUIRED' : 'SOURCE_UNAVAILABLE');
  const data = await response.json();
  const row = Array.isArray(data) ? data.find(item => item?.symbol === providerSymbol) : null;
  if (!row || !finite(row.price) || row.price <= 0) throw new Error('QUOTE_UNAVAILABLE');
  const timestamp = finite(row.timestamp) ? row.timestamp * 1000 : null;
  const observedAt = timestamp && timestamp > 0 && timestamp < Date.now() + 60_000 ? new Date(timestamp).toISOString() : null;
  return {
    status: 'available', symbol: asset.symbol, instrumentId: asset.instrumentId,
    source: 'Financial Modeling Prep', kind: 'quote-snapshot', price: row.price,
    changePercent: finite(row.changePercentage) ? row.changePercentage : null,
    high: finite(row.dayHigh) ? row.dayHigh : null,
    low: finite(row.dayLow) ? row.dayLow : null,
    volume: finite(row.volume) ? row.volume : null,
    observedAt, receivedAt: new Date().toISOString(),
    freshness: observedAt && Date.now() - Date.parse(observedAt) <= 15 * 60_000 ? 'recent' : 'delayed-or-closed',
  };
}

export async function GET(request) {
  const symbol = new URL(request.url).searchParams.get('symbol')?.trim().toUpperCase() ?? '';
  const asset = ALL_ASSETS.find(item => item.symbol === symbol && item.feed === 'fmp-quote');
  if (!asset) return Response.json({ status: 'unavailable', code: 'INSTRUMENT_NOT_CONNECTED' }, { status: 404, headers: HEADERS });
  if (!process.env.FMP_API_KEY) return Response.json({ status: 'unavailable', code: 'SOURCE_NOT_CONFIGURED' }, { status: 503, headers: HEADERS });
  if (process.env.NODE_ENV === 'production' && process.env.FMP_DISPLAY_RIGHTS_CONFIRMED !== 'true') {
    return Response.json({ status: 'unavailable', code: 'DISPLAY_RIGHTS_NOT_CONFIRMED' }, { status: 503, headers: HEADERS });
  }
  const hit = cache.get(asset.instrumentId);
  if (hit && hit.expiresAt > Date.now()) return Response.json(hit.data, { headers: HEADERS });
  try {
    if (!pending.has(asset.instrumentId)) pending.set(asset.instrumentId, loadQuote(asset));
    const data = await pending.get(asset.instrumentId);
    cache.set(asset.instrumentId, { data, expiresAt: Date.now() + 60_000 });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return Response.json(data, { headers: HEADERS });
  } catch (error) {
    const code = ['PLAN_REQUIRED', 'QUOTE_UNAVAILABLE'].includes(error.message) ? error.message : 'SOURCE_UNAVAILABLE';
    return Response.json({ status: 'unavailable', code }, { status: 503, headers: HEADERS });
  } finally { pending.delete(asset.instrumentId); }
}
