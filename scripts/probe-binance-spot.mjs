import { createBinanceSpotClient, BinanceSpotDataError } from '../src/market-data/binance-spot.mjs';

const symbols = process.argv.slice(2).map(symbol => symbol.toUpperCase());
if (!symbols.length) {
  process.stdout.write('Pass one or more configured spot pairs, for example: BTCUSDT ETHUSDT\n');
  process.exit(1);
}

const client = createBinanceSpotClient();
const safeError = error => error instanceof BinanceSpotDataError
  ? { state: error.code, httpStatus: error.status }
  : { state: 'UNEXPECTED_FAILURE' };

for (const symbol of symbols) {
  try {
    const instrument = await client.getExchangeInfo(symbol);
    const quote = await client.getQuote(symbol);
    const candles = await client.getCandles(symbol, '1d', 2);
    process.stdout.write(`${JSON.stringify({
      symbol,
      venue: instrument.venue,
      productType: instrument.productType,
      instrumentStatus: instrument.status,
      quoteState: quote.status,
      priceAvailable: quote.price !== null,
      sourceTimestampKnown: quote.observedAt !== null,
      dailyBarsState: candles.status,
      dailyBars: candles.bars.length,
      rejectedBars: candles.diagnostics.rejected,
    })}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ symbol, ...safeError(error) })}\n`);
  }
}
