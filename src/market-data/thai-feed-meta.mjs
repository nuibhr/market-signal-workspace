import {nativeTradingDay} from '../daytrade/calendar.mjs';
import {candleClosedAt} from './delayed-candles.mjs';
const calendarSource='https://www.set.or.th/en/about/event-calendar/holiday?year=2026';
export function thaiSession(now=Date.now()) {
 const seconds=Math.floor(now/1000),day=nativeTradingDay(seconds);
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));
 const minute=Number(parts.hour)*60+Number(parts.minute);
 const scheduledSession=!day.calendarVerified?'UNKNOWN':day.closedReason?'CLOSED':minute<570?'CLOSED':minute<595?'PRE_OPEN':minute<600?'OPENING_AUCTION':minute<750?'CONTINUOUS':minute<810?'INTERMISSION':minute<835?'PRE_OPEN':minute<840?'OPENING_AUCTION':minute<990?'CONTINUOUS':minute<1000?'CLOSING_AUCTION':minute<1020?'OFF_HOUR':'CLOSED';
 return {...day,scheduledSession,timeZone:'Asia/Bangkok',basis:'exchange-calendar-schedule',calendarSource,checkedAt:new Date(now).toISOString(),note:'Scheduled session; random auction time and actual exchange state require provider confirmation.'};
}
export function closedThaiChartBars(bars,timeframe,now=Date.now(),market='thai') {
 const today=nativeTradingDay(Math.floor(now/1000)).day;
 // DR day/night sessions keep the original conservative previous-date policy.
 return bars.filter(bar=>candleClosedAt(bar,timeframe,market)<=now&&(market!=='dr'||timeframe!=='1d'||bar.time<today));
}
export function expectedThaiDailySession(now=Date.now()) {
 const today=nativeTradingDay(Math.floor(now/1000)).day;
 const close=Date.parse(today+'T17:00:00+07:00');
 for(let n=now>=close?0:1;n<15;n++) {
  const trading=nativeTradingDay((close-n*86400000)/1000);
  if(!trading.calendarVerified)return null;
  if(!trading.closedReason)return trading.day;
 }
 return null;
}
export function assessThaiDailyFeed(series,now=Date.now()) {
 const latestDay=series.bars.at(-1)?.time??null,expectedDay=expectedThaiDailySession(now);
 return {latestDay,expectedDay,freshness:!latestDay?'unavailable':!expectedDay?'unknown':latestDay===expectedDay?'recent':'stale',signalEligible:Boolean(latestDay&&expectedDay&&latestDay===expectedDay)};
}
export function thaiQuoteMetadata(quote,now=Date.now()) {
 if(quote?.status!=='available')return null;
 return {price:quote.price,change:quote.change,changePercent:quote.changePercent,high:quote.high,low:quote.low,volume:quote.volume,bid:quote.bid,ask:quote.ask,marketStatus:quote.marketStatus,observedAt:quote.observedAt,receivedAt:quote.receivedAt,latency:quote.latency,observedDelaySeconds:quote.observedAt?Math.max(0,(now-Date.parse(quote.observedAt))/1000):null};
}
