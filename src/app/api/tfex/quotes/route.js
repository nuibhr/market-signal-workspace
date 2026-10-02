import { createTfexClient } from '../../../../market-data/settrade.mjs';
import { ALL_ASSETS } from '../../../../markets/catalog.mjs';
import { buildTfexContracts } from '../../../../markets/tfex-contracts.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };
const QUOTE_TTL_MS = 45_000;
const MAX_SYMBOLS = 6;
const client = createTfexClient();
const quoteCache = new Map();
const pending = new Map();

async function quoteFor(symbol) {
  const cached = quoteCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.quote;
  if (!pending.has(symbol)) {
    pending.set(symbol, client.getQuote(symbol)
      .then(quote => {
        const asset = ALL_ASSETS.find(item => item.symbol === symbol && item.feed === 'tfex-quote');
        return {
          instrumentId: asset?.instrumentId ?? `TFEX:${symbol}`,
          symbol,
          status: quote.status,
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
      })
      .catch(() => ({ instrumentId: `TFEX:${symbol}`, symbol, status: 'unavailable' })));
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
  if (process.env.NODE_ENV === 'production' && process.env.TFEX_DISPLAY_RIGHTS_CONFIRMED !== 'true') {
    return Response.json({ status: 'unavailable', code: 'DISPLAY_RIGHTS_NOT_CONFIRMED' }, { status: 503, headers: NO_STORE });
  }
  if (!client.configuration.configured) {
    return Response.json({ status: 'unavailable', code: 'SOURCE_NOT_CONFIGURED' }, { status: 503, headers: NO_STORE });
  }

  const quotes = await Promise.all(symbols.map(quoteFor));
  return Response.json({
    status: quotes.some(quote => quote.status === 'available') ? 'available' : 'unavailable',
    source: 'TFEX Open API',
    receivedAt: new Date().toISOString(),
    sourceTimeKnown: quotes.some(quote => quote.sourceTimeKnown),
    quotes,
  }, { headers: NO_STORE });
}
