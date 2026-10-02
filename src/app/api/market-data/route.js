import { assessDailySeries, assessIntradaySeries, createSettradeClient, MAX_CANDLE_BARS, SettradeDataError } from '../../../market-data/settrade.mjs';
import { ALL_ASSETS, SETTRADE_SYMBOLS } from '../../../markets/catalog.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };
const client = createSettradeClient();

function bangkokToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get('symbol')?.toUpperCase() ?? '';
  const timeframe = params.get('timeframe') ?? '1d';
  if (!['15m', '1h', '4h', '1d'].includes(timeframe)) {
    return Response.json({ status: 'unavailable', code: 'INVALID_TIMEFRAME' }, { status: 400, headers: NO_STORE });
  }
  if (!SETTRADE_SYMBOLS.has(symbol)) {
    return Response.json({ status: 'unavailable', code: 'INSTRUMENT_NOT_CONNECTED' }, { status: 404, headers: NO_STORE });
  }
  const instrument = ALL_ASSETS.find(item => item.symbol === symbol && item.feed === 'settrade-daily');

  // Keep licensed data local until the account's public-display rights are confirmed.
  if (process.env.NODE_ENV === 'production' && process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED !== 'true') {
    return Response.json({ status: 'unavailable', code: 'DISPLAY_RIGHTS_NOT_CONFIRMED' }, { status: 503, headers: NO_STORE });
  }

  if (!client.configuration.configured) {
    return Response.json({ status: 'unavailable', code: 'SOURCE_NOT_CONFIGURED' }, { status: 503, headers: NO_STORE });
  }

  try {
    // This client caches a token after login; make the first login once per request.
    const series = await client.getCandles(symbol, timeframe, MAX_CANDLE_BARS);
    const quote = await client.getQuote(symbol).catch(() => null);
    const today = bangkokToday();
    const durations = { '15m': 900, '1h': 3600, '4h': 14_400 };
    const bars = series.bars.filter(bar => timeframe === '1d' ? bar.time < today
      : (bar.time + durations[timeframe]) * 1000 <= Date.now());
    const assessment = timeframe === '1d'
      ? assessDailySeries({ ...series, bars })
      : assessIntradaySeries({ ...series, bars });
    return Response.json({
      status: bars.length ? 'available' : 'unavailable',
      instrumentId: instrument.instrumentId,
      symbol,
      market: instrument.sectionId === 'DR80' ? 'DR' : instrument.sectionId === 'MAI_INITIAL' ? 'mai' : 'SET',
      source: series.source,
      timeframe: series.timeframe,
      receivedAt: series.receivedAt,
      latestDay: assessment.latestDay,
      latestTime: assessment.latestTime ?? null,
      freshness: assessment.freshness,
      signalEligible: assessment.signalEligible,
      requestedBars: MAX_CANDLE_BARS,
      availableBars: bars.length,
      bars,
      excludedFutureBars: series.bars.length - bars.length,
      quote: quote?.status === 'available' ? {
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        high: quote.high,
        low: quote.low,
        observedAt: quote.observedAt,
        receivedAt: quote.receivedAt,
      } : null,
    }, { headers: NO_STORE });
  } catch (error) {
    const code = error instanceof SettradeDataError ? error.code : 'SOURCE_UNAVAILABLE';
    return Response.json({ status: 'unavailable', code }, { status: 503, headers: NO_STORE });
  }
}
