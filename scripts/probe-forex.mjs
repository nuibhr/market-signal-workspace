import { createTwelveDataForexClient, TwelveDataForexError } from '../src/market-data/twelve-data-forex.mjs';

const symbols = process.argv.slice(2).map(symbol => symbol.toUpperCase());
if (!symbols.length) {
  process.stdout.write('Pass one or more configured pairs, for example: EUR/USD USD/JPY\n');
  process.exit(1);
}

const client = createTwelveDataForexClient();
const safeError = error => error instanceof TwelveDataForexError
  ? { state: error.code, httpStatus: error.status }
  : { state: 'UNEXPECTED_FAILURE' };

for (const symbol of symbols) {
  try {
    const quote = await client.getQuote(symbol);
    const candles = await client.getCandles(symbol, '1day', 2);
    process.stdout.write(`${JSON.stringify({
      symbol,
      venue: quote.venue,
      productType: quote.productType,
      quoteState: quote.status,
      sourceTimestampKnown: quote.observedAt !== null,
      bidAskAvailable: quote.bid !== null && quote.ask !== null,
      dailyBarsState: candles.status,
      dailyBars: candles.bars.length,
      rejectedBars: candles.diagnostics.rejected,
    })}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ symbol, ...safeError(error) })}\n`);
  }
}
