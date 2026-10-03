import { assessDailySeries } from '../../../market-data/settrade.mjs';
import { newYorkParts } from '../../../market-data/fmp-us.mjs';
import { getUsDailyBars, usEodRights } from '../../../market-data/us-eod.mjs';
import { ALL_ASSETS } from '../../../markets/catalog.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const HEADERS = { 'Cache-Control': 'private, no-store' };
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get('symbol')?.trim().toUpperCase() ?? '';
  const timeframe = params.get('timeframe') ?? '1d';
  if (!['15m','1h','4h','1d'].includes(timeframe)) return Response.json({ status:'unavailable',code:'INVALID_TIMEFRAME' }, { status:400,headers:HEADERS });
  const asset = ALL_ASSETS.find(item => item.id === 'us' && item.symbol === symbol);
  if (!asset) return Response.json({status:'unavailable',code:'INSTRUMENT_NOT_CONNECTED'}, {status:404,headers:HEADERS});
  if (timeframe !== '1d') return Response.json({status:'unavailable',code:'TIMEFRAME_NOT_AVAILABLE'}, {status:422,headers:HEADERS});
  if (!usEodRights().fmp && !usEodRights().yahoo)
    return Response.json({status:'unavailable',code:'DISPLAY_RIGHTS_NOT_CONFIRMED'}, {status:503,headers:HEADERS});
  try {
    // The chart, scanner and holdings use the same validated closed daily bars.
    const series = await getUsDailyBars(symbol);
    const assessment = assessDailySeries(series);
    return Response.json({ ...series, status:'available', instrumentId:asset.instrumentId, market:'US',
      latestTime:null, freshness:assessment.freshness, signalEligible:assessment.signalEligible, quote:null,
      live:false, signalMode:'EOD_CLOSED_CANDLE',
      excludedCurrentDay:series.latestDay !== newYorkParts().day }, {headers:HEADERS});
  } catch (error) {
    const code = ['SOURCE_NOT_CONFIGURED','PLAN_REQUIRED','RATE_LIMITED','BARS_UNAVAILABLE','INVALID_RESPONSE','DISPLAY_RIGHTS_NOT_CONFIRMED'].includes(error?.code) ? error.code : 'SOURCE_UNAVAILABLE';
    return Response.json({status:'unavailable',code}, {status:503,headers:HEADERS});
  }
}
