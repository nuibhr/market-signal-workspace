// Official 2026 SET/TFEX day-session holiday snapshot, including the 16 June amendment.
// https://www.set.or.th/en/about/event-calendar/holiday
// https://www.tfex.co.th/en/about/holiday
const holidays=new Set(['2026-01-01','2026-01-02','2026-03-03','2026-04-06','2026-04-13','2026-04-14','2026-04-15',
  '2026-05-01','2026-05-04','2026-06-01','2026-06-03','2026-07-28','2026-07-29','2026-08-12',
  '2026-10-13','2026-10-16','2026-10-23','2026-12-07','2026-12-10','2026-12-31']);
export function nativeTradingDay(seconds){
  const local=new Date((seconds+7*3600)*1000),day=local.toISOString().slice(0,10);
  return {day,closedReason:[0,6].includes(local.getUTCDay())?'WEEKEND':holidays.has(day)?'EXCHANGE_HOLIDAY':null,calendarVerified:day.startsWith('2026-')};
}
