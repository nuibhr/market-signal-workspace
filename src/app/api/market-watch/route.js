import YahooFinance from 'yahoo-finance2';
import { createSettradeClient } from '../../../market-data/settrade.mjs';
import { SETTRADE_SYMBOLS } from '../../../markets/catalog.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };
const QUOTE_TTL_MS = 55_000;
const MAX_SYMBOLS = 6;
const client = createSettradeClient();
const yf = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  versionCheck: false,
  fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10_000) }),
  queue: { concurrency: 2 },
});
const quoteCache = new Map();
const pending = new Map();

async function fetchQuote(symbol) {
  const settradeAllowed = process.env.NODE_ENV !== 'production' || process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED === 'true';
  const yahooAllowed = process.env.NODE_ENV !== 'production' || process.env.YAHOO_DISPLAY_RIGHTS_CONFIRMED === 'true';

  // 1. Try Settrade if configured & permitted
  if (settradeAllowed && client.configuration.configured) {
    try {
      const quote = await client.getQuote(symbol);
      if (quote?.status === 'available' && typeof quote.price === 'number') {
        return {
          symbol,
          status: 'available',
          source: 'Settrade Market API',
          price: quote.price,
          changePercent: quote.changePercent,
          high: quote.high,
          low: quote.low,
          volume: quote.volume,
          observedAt: quote.observedAt,
          receivedAt: quote.receivedAt,
        };
      }
    } catch {}
  }

  // 2. Fall back to Yahoo Finance
  if (yahooAllowed) {
    try {
      const q = await yf.quote(`${symbol}.BK`);
      if (q && typeof q.regularMarketPrice === 'number' && q.regularMarketPrice > 0) {
        return {
          symbol,
          status: 'available',
          source: 'Yahoo Finance · Reference',
          price: q.regularMarketPrice,
          changePercent: q.regularMarketChangePercent ?? 0,
          high: q.regularMarketDayHigh ?? null,
          low: q.regularMarketDayLow ?? null,
          volume: q.regularMarketVolume ?? null,
          observedAt: q.regularMarketTime ? new Date(q.regularMarketTime).toISOString() : new Date().toISOString(),
          receivedAt: new Date().toISOString(),
        };
      }
    } catch {}
  }

  return { symbol, status: 'unavailable', error: 'SOURCE_UNAVAILABLE', code: 'SOURCE_UNAVAILABLE' };
}

async function quoteFor(symbol) {
  const cached = quoteCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.quote;
  if (!pending.has(symbol)) {
    pending.set(symbol, fetchQuote(symbol));
  }
  try {
    const quote = await pending.get(symbol);
    quoteCache.set(symbol, { quote, expiresAt: Date.now() + QUOTE_TTL_MS });
    if (quoteCache.size > 100) quoteCache.delete(quoteCache.keys().next().value);
    return quote;
  } finally {
    pending.delete(symbol);
  }
}

export async function GET(request) {
  const raw = new URL(request.url).searchParams.get('symbols') ?? '';
  const symbols = [...new Set(raw.split(',').map(value => value.trim().toUpperCase()).filter(Boolean))];
  if (!symbols.length || symbols.length > MAX_SYMBOLS || symbols.some(symbol => !SETTRADE_SYMBOLS.has(symbol))) {
    return Response.json({ status: 'unavailable', code: 'INVALID_SYMBOLS' }, { status: 400, headers: NO_STORE });
  }
  const settradeAllowed = process.env.NODE_ENV !== 'production' || process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED === 'true';
  const yahooAllowed = process.env.NODE_ENV !== 'production' || process.env.YAHOO_DISPLAY_RIGHTS_CONFIRMED === 'true';
  if (!settradeAllowed && !yahooAllowed) {
    return Response.json({ status: 'unavailable', code: 'DISPLAY_RIGHTS_NOT_CONFIRMED' }, { status: 503, headers: NO_STORE });
  }
  if (!client.configuration.configured && !yahooAllowed) {
    return Response.json({ status: 'unavailable', code: 'SOURCE_NOT_CONFIGURED' }, { status: 503, headers: NO_STORE });
  }

  const quotes = await Promise.all(symbols.map(quoteFor));
  const hasAvailable = quotes.some(quote => quote.status === 'available');
  const source = quotes.find(q => q.status === 'available')?.source ?? 'Settrade Market API';
  return Response.json({
    status: hasAvailable ? 'available' : 'unavailable',
    source,
    receivedAt: new Date().toISOString(),
    quotes,
  }, { headers: NO_STORE });
}
