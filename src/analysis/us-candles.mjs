const clock = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
const clockCache = new Map();
export function usClock(time) {
  if (clockCache.has(time)) return clockCache.get(time);
  const parts = Object.fromEntries(clock.formatToParts(new Date(time * 1000)).map(part => [part.type, part.value]));
  const value = { day: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute), weekday: parts.weekday };
  if (clockCache.size >= 5000) clockCache.clear();
  clockCache.set(time, value);
  return value;
}

/** Combine complete RTH minute buckets; missing minutes never become invented candles. */
export function aggregateMinutes(bars, minutes = 5) {
  if (minutes === 1) return bars;
  const groups = new Map();
  for (const bar of bars) {
    const { day, minute, weekday } = usClock(bar.time);
    if (['Sat', 'Sun'].includes(weekday) || minute < 570 || minute >= 960) continue;
    const offset = minute - 570, key = `${day}:${Math.floor(offset / minutes)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(bar);
  }
  const complete = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.time - b.time);
    if (group.length !== minutes || (usClock(group[0].time).minute - 570) % minutes
      || group.some((bar, i) => i && bar.time - group[i - 1].time !== 60)) continue;
    complete.push({ time: group[0].time, open: group[0].open, high: Math.max(...group.map(bar => bar.high)),
      low: Math.min(...group.map(bar => bar.low)), close: group.at(-1).close, volume: group.reduce((sum, bar) => sum + bar.volume, 0) });
  }
  return complete.sort((a, b) => a.time - b.time);
}
