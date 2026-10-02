const finite = value => typeof value === 'number' && Number.isFinite(value);

/** Context from completed, sorted daily OHLCV bars only. Never includes the current session. */
export function dailyHistoryContext(bars) {
  const history = Array.isArray(bars) ? bars : [];
  const closes = history.map(bar => bar.close);
  const recent200 = closes.slice(-200);
  const sma200 = recent200.length === 200 && recent200.every(finite)
    ? recent200.reduce((sum, close) => sum + close, 0) / 200 : null;
  let atr14 = null;
  if (history.length >= 15) {
    const ranges = history.slice(1).map((bar, index) => Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - history[index].close),
      Math.abs(bar.low - history[index].close),
    ));
    if (ranges.every(finite)) {
      atr14 = ranges.slice(0, 14).reduce((sum, range) => sum + range, 0) / 14;
      for (const range of ranges.slice(14)) atr14 = (atr14 * 13 + range) / 14;
    }
  }
  return { completedDailyBars: history.length, lastDay: history.at(-1)?.time ?? null,
    sma200, atr14, atr14Percent: atr14 && closes.at(-1) > 0 ? atr14 / closes.at(-1) * 100 : null };
}
