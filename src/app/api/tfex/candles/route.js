import { assessDailySeries, assessIntradaySeries, createTfexClient, MAX_CANDLE_BARS, SettradeDataError } from '../../../../market-data/settrade.mjs';
import { ALL_ASSETS, TFEX_SYMBOLS } from '../../../../markets/catalog.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };
const TIMEFRAMES = new Set(['15m', '1h', '4h', '1d']);
const INTRADAY_SECONDS = { '15m': 900, '1h': 3600, '4h': 14_400 };
const client = createTfexClient();

function bangkokNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { day: `${values.year}-${values.month}-${values.day}`, minutes: Number(values.hour) * 60 + Number(values.minute) };
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get('symbol')?.toUpperCase() ?? '';
  const timeframe = params.get('timeframe') ?? '1d';
  if (!TIMEFRAMES.has(timeframe)) {
    return Response.json({ status: 'unavailable', code: 'INVALID_TIMEFRAME' }, { status: 400, headers: NO_STORE });
  }
  if (!TFEX_SYMBOLS.includes(symbol)) {
    return Response.json({ status: 'unavailable', code: 'INSTRUMENT_NOT_CONNECTED' }, { status: 404, headers: NO_STORE });
  }
  const instrument = ALL_ASSETS.find(item => item.symbol === symbol && item.feed === 'tfex-quote');
  if (process.env.NODE_ENV === 'production' && process.env.TFEX_DISPLAY_RIGHTS_CONFIRMED !== 'true') {
    return Response.json({ status: 'unavailable', code: 'DISPLAY_RIGHTS_NOT_CONFIRMED' }, { status: 503, headers: NO_STORE });
  }
  if (!client.configuration.configured) {
    return Response.json({ status: 'unavailable', code: 'SOURCE_NOT_CONFIGURED' }, { status: 503, headers: NO_STORE });
  }

  try {
    const series = await client.getCandles(symbol, timeframe, MAX_CANDLE_BARS);
    const now = Date.now();
    const local = bangkokNow();
    const bars = timeframe === '1d'
      ? series.bars.filter(bar => bar.time < local.day || (bar.time === local.day && local.minutes >= 17 * 60))
      : series.bars.filter(bar => (bar.time + INTRADAY_SECONDS[timeframe]) * 1000 <= now);
    const assessment = timeframe === '1d'
      ? assessDailySeries({ ...series, bars }, now)
      : assessIntradaySeries({ ...series, bars }, now);
    return Response.json({
      status: bars.length ? 'available' : 'unavailable',
      instrumentId: instrument?.instrumentId ?? `TFEX:${symbol}`,
      symbol,
      market: 'TFEX',
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
      excludedIncompleteBars: series.bars.length - bars.length,
    }, { headers: NO_STORE });
  } catch (error) {
    const code = error instanceof SettradeDataError ? error.code : 'SOURCE_UNAVAILABLE';
    return Response.json({ status: 'unavailable', code }, { status: 503, headers: NO_STORE });
  }
}
