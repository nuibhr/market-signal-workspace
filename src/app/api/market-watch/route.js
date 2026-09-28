import { createSettradeClient } from '../../../market-data/settrade.mjs';
import { SETTRADE_SYMBOLS } from '../../../markets/catalog.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };
const QUOTE_TTL_MS = 55_000;
const MAX_SYMBOLS = 6;
const client = createSettradeClient();
const quoteCache = new Map();
const pending = new Map();

async function quoteFor(symbol) {
  const cached = quoteCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.quote;
  if (!pending.has(symbol)) {
    pending.set(symbol, client.getQuote(symbol)
      .then(quote => ({
        symbol,
        status: quote.status,
        price: quote.price,
        changePercent: quote.changePercent,
        high: quote.high,
        low: quote.low,
        volume: quote.volume,
        observedAt: quote.observedAt,
        receivedAt: quote.receivedAt,
      }))
      .catch(() => ({ symbol, status: 'unavailable' })));
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
  if (process.env.NODE_ENV === 'production' && process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED !== 'true') {
    return Response.json({ status: 'unavailable', code: 'DISPLAY_RIGHTS_NOT_CONFIRMED' }, { status: 503, headers: NO_STORE });
  }
  if (!client.configuration.configured) {
    return Response.json({ status: 'unavailable', code: 'SOURCE_NOT_CONFIGURED' }, { status: 503, headers: NO_STORE });
  }

  const quotes = await Promise.all(symbols.map(quoteFor));
  return Response.json({
    status: quotes.some(quote => quote.status === 'available') ? 'available' : 'unavailable',
    source: 'Settrade Market API',
    receivedAt: new Date().toISOString(),
    quotes,
  }, { headers: NO_STORE });
}
