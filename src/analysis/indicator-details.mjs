import { calculatePivots, completedCandles } from './pivots.mjs';

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function stochasticAt(bars, index, period = 14) {
  const window = bars.slice(index - period + 1, index + 1);
  const low = Math.min(...window.map(bar => bar.low));
  const high = Math.max(...window.map(bar => bar.high));
  return high === low ? 50 : (bars[index].close - low) / (high - low) * 100;
}

export function analyzeIndicatorDetails(bars, timeframe = '1d', now = Date.now()) {
  if (!Array.isArray(bars) || bars.length < 50) return null;
  const latest = bars.at(-1);
  const reference = completedCandles(bars, timeframe, now).at(-1);
  const pivots = calculatePivots(reference);
  const closes20 = bars.slice(-20).map(bar => bar.close);
  const recent20 = bars.slice(-20);
  const trueRanges = bars.slice(1).map((bar, index) => Math.max(
    bar.high - bar.low,
    Math.abs(bar.high - bars[index].close),
    Math.abs(bar.low - bars[index].close),
  ));
  let atr14 = mean(trueRanges.slice(0, 14));
  for (const range of trueRanges.slice(14)) atr14 = (atr14 * 13 + range) / 14;
  let obv = 0;
  for (let index = 1; index < bars.length; index += 1) {
    if (bars[index].close > bars[index - 1].close) obv += bars[index].volume;
    else if (bars[index].close < bars[index - 1].close) obv -= bars[index].volume;
  }
  const priorVolume20 = mean(bars.slice(-21, -1).map(bar => bar.volume));
  return {
    sma20: mean(closes20),
    atr14,
    atrPercent: atr14 / latest.close * 100,
    stochasticK: stochasticAt(bars, bars.length - 1),
    stochasticD: mean([0, 1, 2].map(offset => stochasticAt(bars, bars.length - 1 - offset))),
    donchianUpper: Math.max(...recent20.map(bar => bar.high)),
    donchianLower: Math.min(...recent20.map(bar => bar.low)),
    pivots,
    pivot: pivots?.standard.pivot ?? null,
    pivotR1: pivots?.standard.r1 ?? null,
    pivotS1: pivots?.standard.s1 ?? null,
    volume: latest.volume,
    volumeAverage20: priorVolume20,
    relativeVolume: priorVolume20 > 0 ? latest.volume / priorVolume20 : null,
    obv,
  };
}
