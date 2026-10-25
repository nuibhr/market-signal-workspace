import {sharedDaily,sharedSeriesResponse} from '../../../market-data/shared-policy.mjs';
import { assessDailySeries, assessIntradaySeries, createSettradeClient, MAX_CANDLE_BARS, SettradeDataError } from '../../../market-data/settrade.mjs';
import { ALL_ASSETS, SETTRADE_SYMBOLS } from '../../../markets/catalog.mjs';
import { rememberChartSnapshot } from '../../../market-data/delayed-candles.mjs';
import { loadChartBackup } from '../../../market-data/chart-backup.mjs';
import {closedThaiChartBars,thaiSession,thaiQuoteMetadata,assessThaiDailyFeed} from '../../../market-data/thai-feed-meta.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };
const client = createSettradeClient();

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

  if(sharedDaily()&&instrument)return sharedSeriesResponse(instrument,timeframe,NO_STORE);
  if (!client.configuration.configured) {
    if (instrument) {
      try {
        const backup = await loadChartBackup(instrument, timeframe);
        if (backup?.status === 'available') return Response.json(backup, { headers: NO_STORE });
      } catch {}
    }
    return Response.json({ status: 'unavailable', code: 'SOURCE_NOT_CONFIGURED' }, { status: 503, headers: NO_STORE });
  }

  try {
    // This client caches a token after login; make the first login once per request.
    const series = await client.getCandles(symbol, timeframe, MAX_CANDLE_BARS);
    const quote = await client.getQuote(symbol).catch(() => null);
    const bars = closedThaiChartBars(series.bars, timeframe, Date.now(), instrument.id);
    const assessment = timeframe === '1d'
      ? instrument.id === 'thai' ? assessThaiDailyFeed({ ...series, bars }) : assessDailySeries({ ...series, bars })
      : assessIntradaySeries({ ...series, bars });
    const payload = {
      status: bars.length ? 'available' : 'unavailable',
      instrumentId: instrument.instrumentId,
      symbol,
      market: instrument.sectionId === 'DR80' ? 'DR' : instrument.sectionId === 'MAI_INITIAL' ? 'mai' : 'SET',
      source: series.source,
      timeframe: series.timeframe,
      receivedAt: series.receivedAt,
      latestDay: assessment.latestDay,
      expectedDay: assessment.expectedDay ?? null,
      latestTime: assessment.latestTime ?? null,
      freshness: assessment.freshness,
      signalEligible: assessment.signalEligible,
      requestedBars: MAX_CANDLE_BARS,
      availableBars: bars.length,
      bars,
      excludedFutureBars: series.bars.length - bars.length,
      quote: thaiQuoteMetadata(quote),
      session: instrument.id === 'thai' ? thaiSession() : null,
    };
    if (payload.status === 'available') await rememberChartSnapshot(payload, instrument, timeframe);
    return Response.json(payload, { headers: NO_STORE });
  } catch (error) {
    if (instrument) {
      try {
        const backup = await loadChartBackup(instrument, timeframe);
        if (backup?.status === 'available') return Response.json(backup, { headers: NO_STORE });
      } catch {}
    }
    const code = error instanceof SettradeDataError ? error.code : 'SOURCE_UNAVAILABLE';
    return Response.json({ status: 'unavailable', code }, { status: 503, headers: NO_STORE });
  }
}
