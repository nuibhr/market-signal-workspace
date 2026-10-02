import { calculatePivots, completedCandles } from './pivots.mjs';

const finite = n => Number.isFinite(n) && n > 0;
const dayAt = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(now));
function weekStart(day) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}
const keyFor = (day, period) => period === 'month' ? day.slice(0, 7) : period === 'week' ? weekStart(day) : day;
export function atr14(bars) {
  if (bars.length < 15) return null;
  const ranges = bars.slice(1).map((bar, i) => Math.max(bar.high - bar.low, Math.abs(bar.high - bars[i].close), Math.abs(bar.low - bars[i].close)));
  let atr = ranges.slice(0, 14).reduce((sum, n) => sum + n, 0) / 14;
  for (const range of ranges.slice(14)) atr = (atr * 13 + range) / 14;
  return finite(atr) ? atr : null;
}

/** TradingView Auto anchors: <=15m daily, >15m intraday weekly, D1 monthly. */
export function chartPivotLevels({ dailyBars = [], timeframe = '1d', price, atr, now = Date.now() }) {
  const period = timeframe === '1d' ? 'month' : timeframe === '15m' || timeframe === '5m' || timeframe === '1m' ? 'day' : 'week';
  const daily = completedCandles(dailyBars, '1d', now).sort((a, b) => a.time.localeCompare(b.time));
  const current = keyFor(dayAt(now), period);
  const prior = daily.filter(bar => keyFor(bar.time, period) < current);
  const key = prior.length ? keyFor(prior.at(-1).time, period) : null;
  const referenceBars = prior.filter(bar => keyFor(bar.time, period) === key);
  const empty = { method: 'Traditional Pivot · Auto', period, support: null, resistance: null, pivots: null, rrPlan: null };
  if (!referenceBars.length) return empty;
  // Do not aggregate a clipped first week/month from a short historical feed.
  if (period !== 'day' && !daily.some(bar => keyFor(bar.time, period) < key)) return empty;
  const reference = { time: key, high: Math.max(...referenceBars.map(b => b.high)), low: Math.min(...referenceBars.map(b => b.low)), close: referenceBars.at(-1).close };
  const pivots = calculatePivots(reference);
  if (!pivots || !finite(price)) return empty;
  const values = pivots.standard;
  const supports = ['s1', 's2', 's3'].map(name => ({ name, price: values[name] })).filter(v => finite(v.price) && v.price < price).sort((a, b) => b.price - a.price);
  const resistances = ['r1', 'r2', 'r3'].map(name => ({ name, price: values[name] })).filter(v => finite(v.price) && v.price > price).sort((a, b) => a.price - b.price);
  const support = supports[0]?.price ?? null;
  const resistance = resistances[0]?.price ?? null;
  let rrPlan = null;
  if (finite(support) && finite(atr)) {
    const stop = Math.min(support - atr * .25, price - atr);
    const risk = price - stop;
    const target = price + risk * 2;
    if (finite(stop)) rrPlan = { entry: price, stop, target, risk, reward: risk * 2, ratio: 2,
      blocked: resistance !== null && resistance < target, resistance,
      status: resistance !== null && resistance < target ? 'WAIT_RESISTANCE' : resistance === null ? 'UNCONFIRMED_ROOM' : 'ROOM_2R',
      basis: 'Stop ใต้ Pivot support 0.25 ATR และห่างอย่างน้อย 1 ATR · TP = Entry + 2 × (Entry − Stop)' };
  }
  return { ...empty, support, resistance, supportLabel: supports[0]?.name.toUpperCase(), resistanceLabel: resistances[0]?.name.toUpperCase(),
    pivots, rrPlan, referenceFrom: referenceBars[0].time, referenceTo: referenceBars.at(-1).time };
}
