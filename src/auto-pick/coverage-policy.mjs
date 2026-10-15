import { newYorkParts, usEodSession } from '../market-data/fmp-us.mjs';
export const MAX_SOURCE_FAILURES=5;
export const isSourceFailure=reason=>/^(SOURCE_|NETWORK_|AUTH_|RATE_LIMITED$|INVALID_RESPONSE$)/.test(reason||'');
export function sourceDisposition(error) {
  return [400,404].includes(error?.status)||['PLAN_REQUIRED','BARS_UNAVAILABLE','INSTRUMENT_MISMATCH','INVALID_SYMBOL','SOURCE_NOT_CONFIGURED','DISPLAY_RIGHTS_NOT_CONFIRMED'].includes(error?.code)?'unavailable':'retry';
}
export function retryDelayMs(row) {return isSourceFailure(row.reason)?Math.min(300000,60000*2**Math.max(0,(row.sourceFailures||1)-1)):60000;}
function nyTime(day,minutes) {
  const base=Date.parse(`${day}T00:00:00Z`);
  for(let hours=0;hours<36;hours++) {const value=base+hours*3600000,p=newYorkParts(value);if(p.day===day&&p.minutes===minutes)return value;}
  return NaN;
}
export function scanWindowBounds(market,key) {
  const day=key?.slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))return null;
  if(market==='thai')return {start:Date.parse(`${day}T10:15:00+07:00`),end:Date.parse(`${day}T11:15:00+07:00`)};
  if(market==='dr') {const night=key.endsWith(':night'),start=Date.parse(`${day}T${night?'19:00':'10:00'}:00+07:00`);return {start:start+(night?3600000:1800000),end:start+(night?9000000:4500000)};}
  if(market==='us') {let next=new Date(Date.parse(`${day}T12:00:00Z`)+86400000);while([0,6].includes(next.getUTCDay()))next=new Date(next.getTime()+86400000);return {start:nyTime(day,990),end:nyTime(next.toISOString().slice(0,10),480)};}
  return null;
}
export function coveragePhase(market,key,now) {const bounds=scanWindowBounds(market,key);return !bounds?'unknown':now<bounds.start?'waiting':now>=bounds.end?'ended':market==='us'&&!usEodSession(now).scanWindow?'paused':'active';}
export function cutoffDisposition(reason) {
  return ['NO_CURRENT_SESSION_CANDLE','OPENING_BAR_UNAVAILABLE','DR_SESSION_NOT_CONFIRMED','NO_FRESH_DR_CANDLE'].includes(reason)?'ineligible':'unavailable';
}
