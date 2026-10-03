const FRAME_SECONDS = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14_400 };

function bangkokDay(now) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** The provider's intraday timestamp is treated as the candle start; uncertain bars are excluded. */
export function completedCandles(bars, timeframe, now = Date.now()) {
  if (!Array.isArray(bars)) return [];
  const frame = String(timeframe).toLowerCase();
  const duration = FRAME_SECONDS[frame];
  const today = bangkokDay(now);
  return bars.filter(bar => {
    if (!bar || ![bar.open, bar.high, bar.low, bar.close].every(value => typeof value === 'number' && Number.isFinite(value) && value > 0)
      || bar.high < Math.max(bar.open, bar.close) || bar.low > Math.min(bar.open, bar.close) || bar.high < bar.low) return false;
    if (frame === '1d') return typeof bar.time === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bar.time) && bar.time < today;
    return Boolean(duration && Number.isInteger(bar.time) && (bar.time + duration) * 1000 <= now);
  });
}

/** Standard, Camarilla and Woodie levels from one completed OHLC candle. */
export function calculatePivots(reference) {
  if (!reference) return null;
  const { high, low, close } = reference;
  if (![high, low, close].every(value => typeof value === 'number' && Number.isFinite(value) && value > 0)
    || high <= low || close < low || close > high) return null;
  const range = high - low;
  const standardPivot = (high + low + close) / 3;
  const woodiePivot = (high + low + 2 * close) / 4;
  const standard = {
    pivot: standardPivot, r1: 2 * standardPivot - low, s1: 2 * standardPivot - high,
    r2: standardPivot + range, s2: standardPivot - range,
    r3: high + 2 * (standardPivot - low), s3: low - 2 * (high - standardPivot),
  };
  const camarilla = {
    r1: close + range * 1.1 / 12, s1: close - range * 1.1 / 12,
    r2: close + range * 1.1 / 6, s2: close - range * 1.1 / 6,
    r3: close + range * 1.1 / 4, s3: close - range * 1.1 / 4,
    r4: close + range * 1.1 / 2, s4: close - range * 1.1 / 2,
  };
  const woodie = {
    pivot: woodiePivot, r1: 2 * woodiePivot - low, s1: 2 * woodiePivot - high,
    r2: woodiePivot + range, s2: woodiePivot - range,
    r3: high + 2 * (woodiePivot - low), s3: low - 2 * (high - woodiePivot),
  };
  return { reference: { time: reference.time, high, low, close }, standard, camarilla, woodie };
}
