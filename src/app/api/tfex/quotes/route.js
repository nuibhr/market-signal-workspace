import {sharedDaily,sharedQuote} from '../../../../market-data/shared-policy.mjs';
import YahooFinance from 'yahoo-finance2';
import { createTfexClient, createSettradeClient } from '../../../../market-data/settrade.mjs';
import { ALL_ASSETS } from '../../../../markets/catalog.mjs';
import { buildTfexContracts } from '../../../../markets/tfex-contracts.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };
const QUOTE_TTL_MS = 45_000;
const MAX_SYMBOLS = 6;
const client = createTfexClient();
const yf = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  versionCheck: false,
  fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10_000) }),
  queue: { concurrency: 2 },
});
const quoteCache = new Map();
const pending = new Map();

function getTfexProxyTicker(symbol) {
  if (symbol.startsWith('S50')) return '^SET50.BK';
  if (symbol.startsWith('GO')) return 'GC=F';
  if (symbol.startsWith('SVF')) return 'SI=F';
  if (symbol.startsWith('USD')) return 'THB=X';
  return null;
}

async function fetchTfexQuote(symbol) {
  const asset = ALL_ASSETS.find(item => item.symbol === symbol && item.feed === 'tfex-quote');
  const instrumentId = asset?.instrumentId ?? `TFEX:${symbol}`;
  if(sharedDaily()){try{return await sharedQuote(asset);}catch{return {symbol,instrumentId,status:'unavailable',code:'SHARED_SNAPSHOT_PENDING'};}}
  const tfexAllowed = process.env.NODE_ENV !== 'production' || process.env.TFEX_DISPLAY_RIGHTS_CONFIRMED === 'true';
  const yahooAllowed = process.env.NODE_ENV !== 'production' || process.env.YAHOO_DISPLAY_RIGHTS_CONFIRMED === 'true';

  // 1. Try Settrade TFEX first if configured & permitted
  if (tfexAllowed && client.configuration.configured) {
    try {
      const quote = await client.getQuote(symbol);
      if (quote?.status === 'available') {
        return {
          instrumentId,
          symbol,
          status: 'available',
          source: quote.source,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          high: quote.high,
          low: quote.low,
          volume: quote.volume,
          openInterest: quote.openInterest,
          marketStatus: quote.marketStatus,
          observedAt: quote.observedAt,
          receivedAt: quote.receivedAt,
          sourceTimeKnown: Boolean(quote.observedAt),
          freshness: quote.observedAt && Date.now() - Date.parse(quote.observedAt) <= 15 * 60_000 ? 'recent' : 'unknown',
        };
      }
    } catch {}
  }

  // 2. Fall back to Yahoo Finance reference quote
  if (yahooAllowed) {
    const ticker = getTfexProxyTicker(symbol);
    if (ticker) {
      try {
        const q = await yf.quote(ticker);
        if (q && typeof q.regularMarketPrice === 'number' && q.regularMarketPrice > 0) {
          const observedAt = q.regularMarketTime ? new Date(q.regularMarketTime).toISOString() : new Date().toISOString();
          return {
            instrumentId,
            symbol,
            status: 'available',
            source: 'Yahoo Finance · Reference',
            price: q.regularMarketPrice,
            change: q.regularMarketChange ?? 0,
            changePercent: q.regularMarketChangePercent ?? 0,
            high: q.regularMarketDayHigh ?? null,
            low: q.regularMarketDayLow ?? null,
            volume: q.regularMarketVolume ?? 0,
            openInterest: 0,
            marketStatus: 'Closed',
            observedAt,
            receivedAt: new Date().toISOString(),
            sourceTimeKnown: Boolean(q.regularMarketTime),
            freshness: 'recent',
          };
        }
      } catch {}
    }
  }

  return { instrumentId, symbol, status: 'unavailable', error: 'SOURCE_UNAVAILABLE', code: 'SOURCE_UNAVAILABLE' };
}

async function quoteFor(symbol) {
  const cached = quoteCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.quote;
  if (!pending.has(symbol)) {
    pending.set(symbol, fetchTfexQuote(symbol));
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
  const allowedSymbols = new Set(buildTfexContracts().map(contract => contract.symbol));
  if (!symbols.length || symbols.length > MAX_SYMBOLS || symbols.some(symbol => !allowedSymbols.has(symbol))) {
    return Response.json({ status: 'unavailable', code: 'INVALID_SYMBOLS' }, { status: 400, headers: NO_STORE });
  }
  const tfexAllowed = process.env.NODE_ENV !== 'production' || process.env.TFEX_DISPLAY_RIGHTS_CONFIRMED === 'true';
  const yahooAllowed = process.env.NODE_ENV !== 'production' || process.env.YAHOO_DISPLAY_RIGHTS_CONFIRMED === 'true';
  if (!tfexAllowed && !yahooAllowed) {
    return Response.json({ status: 'unavailable', code: 'DISPLAY_RIGHTS_NOT_CONFIRMED' }, { status: 503, headers: NO_STORE });
  }
  if (!client.configuration.configured && !yahooAllowed) {
    return Response.json({ status: 'unavailable', code: 'SOURCE_NOT_CONFIGURED' }, { status: 503, headers: NO_STORE });
  }

  const quotes = await Promise.all(symbols.map(quoteFor));
  let underlying = null;
  if (!sharedDaily() && symbols.some(s => s.startsWith('S50'))) {
    if (tfexAllowed && client.configuration.configured) {
      underlying = await createSettradeClient().getQuote('SET50').catch(() => null);
    }
    if (!underlying || !(underlying.price > 0)) {
      if (yahooAllowed) {
        try {
          const q = await yf.quote('^SET50.BK');
          if (q?.regularMarketPrice > 0) {
            underlying = {
              symbol: 'SET50',
              price: q.regularMarketPrice,
              change: q.regularMarketChange ?? 0,
              changePercent: q.regularMarketChangePercent ?? 0,
              high: q.regularMarketDayHigh ?? null,
              low: q.regularMarketDayLow ?? null,
              source: 'Yahoo Finance · Reference',
            };
          }
        } catch {}
      }
    }
  }

  const hasAvailable = quotes.some(quote => quote.status === 'available');
  const source = quotes.find(q => q.status === 'available')?.source ?? 'TFEX Open API';
  return Response.json({
    status: hasAvailable ? 'available' : 'unavailable',
    source,
    receivedAt: new Date().toISOString(),
    sourceTimeKnown: quotes.some(quote => quote.sourceTimeKnown),
    quotes,
    underlying: underlying?.price > 0 ? underlying : null,
  }, { headers: NO_STORE });
}
