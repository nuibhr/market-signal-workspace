/** A daily swing high must stand above the two bars on either side. */
export function nearestSwingHigh(bars, entry) {
  const highs = bars.map(bar => bar.high);
  const pivots = [];
  for (let index = 2; index < highs.length - 2; index += 1) {
    const high = highs[index];
    if (high > entry && high > highs[index - 1] && high > highs[index - 2]
      && high >= highs[index + 1] && high >= highs[index + 2]) pivots.push(high);
  }
  return pivots.length ? Math.min(...pivots) : null;
}
