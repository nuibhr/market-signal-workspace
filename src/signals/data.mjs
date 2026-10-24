import { ALL_ASSETS } from '../markets/catalog.mjs';
import { createSettradeClient } from '../market-data/settrade.mjs';
import { getYahooHistory } from '../market-data/yahoo-history.mjs';
import { newYorkParts } from '../market-data/fmp-us.mjs';
import { candleClosedAt } from '../market-data/delayed-candles.mjs';
import {expectedThaiDailySession} from '../market-data/thai-feed-meta.mjs';
const fail = code => Object.assign(new Error(code), { code });
let nextRequest = 0;
const native = createSettradeClient({ fetcher: async (url, options) => {
  const slot = Math.max(Date.now(), nextRequest); nextRequest = slot + 450;
  if (slot > Date.now()) await new Promise(resolve => setTimeout(resolve, slot - Date.now()));
  const response = await fetch(url, options);
  if (response.status === 429) nextRequest = Math.max(nextRequest, Date.now() + 15000);
  return response;
} });
const cache = new Map(), pending = new Map();
export const signalUniverse = market => ALL_ASSETS.filter(a => a.id === market && ['thai','dr','us'].includes(a.id));

// Actual hourly OHLCV only. A missing constituent discards the bucket rather
// than fabricating a four-hour candle. Session tails are conservatively delayed
// until the full wall-clock 4h boundary, including the last US half-hour bar.
export function aggregateSession4h(bars, market) {
  const groups = new Map();
  for (const bar of bars) {
    let start, required;
    if (market === 'us') {
      const c = newYorkParts(bar.time * 1000);
      if (c.minutes < 570 || c.minutes >= 960 || c.minutes % 60 !== 30) continue;
      const offset = c.minutes < 810 ? c.minutes - 570 : c.minutes - 810;
      start = bar.time - offset * 60; required = c.minutes < 810 ? 4 : 3;
    } else {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(new Date(bar.time*1000)).map(p=>[p.type,p.value]));
      const minute = Number(parts.hour) * 60 + Number(parts.minute);
      if (Number(parts.minute) !== 0) continue;
      const bucket = minute >= 600 && minute < 780 ? 600 : minute >= 840 && minute < 1020 ? 840 : market === 'dr' && minute >= 1140 && minute < 1380 ? 1140 : market === 'dr' && (minute >= 1380 || minute < 180) ? 1380 : null;
      if (bucket === null) continue;
      start = bar.time - ((minute - bucket + 1440) % 1440) * 60; required = bucket < 1100 ? 3 : 4;
    }
    if (!groups.has(start)) groups.set(start, { required, bars: [] }); groups.get(start).bars.push(bar);
  }
  return [...groups].sort((a,b)=>a[0]-b[0]).flatMap(([time, group]) => {
    const rows = group.bars.sort((a,b)=>a.time-b.time);
    if (rows.length !== group.required || rows.some((b,i)=>b.time !== time+i*3600)) return [];
    return [{ time, open:rows[0].open, high:Math.max(...rows.map(b=>b.high)), low:Math.min(...rows.map(b=>b.low)),
      close:rows.at(-1).close, volume:rows.reduce((sum,b)=>sum+b.volume,0) }];
  });
}
export function signalProviderAllowed(market, env = process.env) {
  if (env.NODE_ENV !== 'production') return true;
  return market === 'us' ? env.YAHOO_DISPLAY_RIGHTS_CONFIRMED === 'true'
    : env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED === 'true' || env.YAHOO_DISPLAY_RIGHTS_CONFIRMED === 'true';
}
export async function loadSignalFrame(asset, frame, { now = Date.now(), fresh = false } = {}) {
  if (!['1d','4h','15m'].includes(frame) || !['thai','dr','us'].includes(asset.id)) throw fail('INVALID_SIGNAL_INSTRUMENT');
  if (!signalProviderAllowed(asset.id)) throw fail('DISPLAY_RIGHTS_NOT_CONFIRMED');
  const key = `${asset.instrumentId}:${frame}`, hit = cache.get(key);
  if (!fresh && hit?.until > now) return hit.series;
  if (pending.has(key)) return pending.get(key);
  const job = (async () => {
    let series;
    const nativeAllowed = process.env.NODE_ENV !== 'production' || process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED === 'true';
    if (asset.id !== 'us' && nativeAllowed && native.configuration.configured) {
      try { series = await native.getCandles(asset.symbol, frame, 1000); } catch { /* Check exact Yahoo ticker as a fallback below. */ }
    }
    if (!series) {
      if (process.env.NODE_ENV === 'production' && process.env.YAHOO_DISPLAY_RIGHTS_CONFIRMED !== 'true') throw fail('DISPLAY_RIGHTS_NOT_CONFIRMED');
      const history = await getYahooHistory(asset, frame === '4h' ? '1h' : frame);
      series = frame === '4h' ? { ...history, timeframe:'4h', bars:aggregateSession4h(history.bars,asset.id), source:`${history.source} · session 1H→4H` } : history;
    }
    const bars = series.bars.filter(bar => candleClosedAt(bar, frame, asset.id) + 900000 <= now);
    if (!bars.length) throw fail('NO_AVAILABLE_CLOSED_BARS');
    if(asset.id==='thai'&&frame==='1d'){
      const expectedDay=expectedThaiDailySession(now-900000);
      if(!expectedDay)throw fail('CALENDAR_NOT_VERIFIED');
      if(bars.at(-1).time!==expectedDay)throw fail('STALE_DAILY_BARS');
    }
    const result = { ...series, bars, source:series.source, quote:null, minimumDelayMinutes:15,
      use:'forward-reference-signals', dataAsOf:new Date(candleClosedAt(bars.at(-1),frame,asset.id)).toISOString() };
    cache.set(key, { until:now+(frame==='1d'?3600000:frame==='4h'?180000:45000), series:result });
    if (cache.size > 150) cache.delete(cache.keys().next().value);
    return result;
  })().finally(()=>pending.delete(key));
  pending.set(key,job); return job;
}
