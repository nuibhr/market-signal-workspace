// Only verified, attributed events belong in the production calendar.
export const MACRO_EVENTS=Object.freeze([]);
export const CALENDAR_STATUS='unconfigured';
export function filterMacroEvents({impact='all',market='all'}={},events=MACRO_EVENTS) {
  return events.filter(e=>(impact==='all'||e.impact===impact)&&(market==='all'||e.affectedMarkets.includes(market)));
}
