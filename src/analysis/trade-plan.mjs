import { calculatePivots, completedCandles } from './pivots.mjs';

export const TRADE_PLAN_CONFIG = Object.freeze({
  version: 'technical-plan-v1', minBars: 55, levelClusterATR: 0.25,
  entryZoneBufferATR: 0.15, breakoutBufferATR: 0.10, stopBufferATR: 0.20,
  minStopATR: 0.60, maxStopATR: 1.50, minRiskReward: 2.00, preferredRiskReward: 2.00,
  minRoomATR: 1.00, maxEntryDistanceATR: 0.60,
  levelWeights: { swing4h: 25, daily: 20, pivot: 15, fibonacci: 10, touches: 10, volume: 10, round: 5, rejection: 5 },
});

const finite = value => typeof value === 'number' && Number.isFinite(value);
const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const last = values => values.at(-1);

function ema(values, period) {
  let current = null;
  return values.map((value, index) => {
    if (index === period - 1) current = average(values.slice(0, period));
    else if (index >= period) current = current + (value - current) * 2 / (period + 1);
    return current;
  });
}

function rsi14(closes) {
  if (closes.length < 15) return null;
  let gain = 0, loss = 0;
  for (let index = 1; index <= 14; index += 1) {
    const change = closes[index] - closes[index - 1];
    gain += Math.max(change, 0); loss += Math.max(-change, 0);
  }
  gain /= 14; loss /= 14;
  for (let index = 15; index < closes.length; index += 1) {
    const change = closes[index] - closes[index - 1];
    gain = (gain * 13 + Math.max(change, 0)) / 14;
    loss = (loss * 13 + Math.max(-change, 0)) / 14;
  }
  return loss === 0 ? gain === 0 ? 50 : 100 : 100 - 100 / (1 + gain / loss);
}

export function atr14(bars) {
  if (!Array.isArray(bars) || bars.length < 15) return null;
  const ranges = bars.slice(1).map((bar, index) => Math.max(bar.high - bar.low,
    Math.abs(bar.high - bars[index].close), Math.abs(bar.low - bars[index].close)));
  let value = average(ranges.slice(0, 14));
  for (const range of ranges.slice(14)) value = (value * 13 + range) / 14;
  return value > 0 ? value : null;
}

function adx14(bars) {
  if (bars.length < 42) return null;
  const ranges = [], plus = [], minus = [];
  for (let index = 1; index < bars.length; index += 1) {
    const bar = bars[index], previous = bars[index - 1];
    const up = bar.high - previous.high, down = previous.low - bar.low;
    ranges.push(Math.max(bar.high - bar.low, Math.abs(bar.high - previous.close), Math.abs(bar.low - previous.close)));
    plus.push(up > down && up > 0 ? up : 0);
    minus.push(down > up && down > 0 ? down : 0);
  }
  let tr = ranges.slice(0, 14).reduce((a, b) => a + b, 0);
  let p = plus.slice(0, 14).reduce((a, b) => a + b, 0);
  let m = minus.slice(0, 14).reduce((a, b) => a + b, 0);
  const dx = [];
  for (let index = 14; index < ranges.length; index += 1) {
    tr = tr - tr / 14 + ranges[index];
    p = p - p / 14 + plus[index];
    m = m - m / 14 + minus[index];
    const denominator = p + m;
    dx.push(denominator > 0 ? Math.abs(p - m) / denominator * 100 : 0);
  }
  if (dx.length < 14) return null;
  let value = average(dx.slice(0, 14));
  for (const point of dx.slice(14)) value = (value * 13 + point) / 14;
  return value;
}

function swings(bars) {
  const highs = [], lows = [];
  for (let index = 2; index < bars.length - 2; index += 1) {
    const window = bars.slice(index - 2, index + 3);
    if (window.every(bar => bar.high <= bars[index].high)) highs.push({ price: bars[index].high, index });
    if (window.every(bar => bar.low >= bars[index].low)) lows.push({ price: bars[index].low, index });
  }
  return { highs, lows };
}

function structure(bars) {
  const { highs, lows } = swings(bars);
  if (highs.length < 2 || lows.length < 2) return 'UNCLEAR';
  const higherHigh = highs.at(-1).price > highs.at(-2).price;
  const higherLow = lows.at(-1).price > lows.at(-2).price;
  const lowerHigh = highs.at(-1).price < highs.at(-2).price;
  const lowerLow = lows.at(-1).price < lows.at(-2).price;
  return higherHigh && higherLow ? 'HH_HL' : lowerHigh && lowerLow ? 'LH_LL' : 'MIXED';
}

function dailyBias(bars) {
  const closes = bars.map(bar => bar.close);
  const e20 = ema(closes, 20), e50 = ema(closes, 50), close = last(closes);
  const slope = last(e20) - e20.at(-6);
  const rsi = rsi14(closes), marketStructure = structure(bars);
  const bull = (close > last(e20) ? 20 : 0) + (last(e20) > last(e50) ? 20 : 0) + (slope > 0 ? 20 : 0)
    + (rsi > 50 ? 20 : 0) + (marketStructure === 'HH_HL' ? 20 : 0);
  const bear = (close < last(e20) ? 20 : 0) + (last(e20) < last(e50) ? 20 : 0) + (slope < 0 ? 20 : 0)
    + (rsi < 50 ? 20 : 0) + (marketStructure === 'LH_LL' ? 20 : 0);
  const bias = bull >= 60 && bull > bear ? 'BULLISH' : bear >= 60 && bear > bull ? 'BEARISH' : 'NEUTRAL';
  return { bias, score: bias === 'BULLISH' ? bull : bias === 'BEARISH' ? bear : Math.max(bull, bear),
    ema20: last(e20), ema50: last(e50), ema20Slope: slope, rsi14: rsi, adx14: adx14(bars), atr14: atr14(bars),
    marketStructure, donchianUpper: Math.max(...bars.slice(-20).map(bar => bar.high)),
    donchianLower: Math.min(...bars.slice(-20).map(bar => bar.low)) };
}

function roundStep(price) {
  const magnitude = 10 ** Math.floor(Math.log10(price));
  return magnitude / 10;
}

/** Merge nearby evidence, keeping the nearest barrier even when its score is weak. */
export function clusterLevels(candidates, atr, bars, config = TRADE_PLAN_CONFIG) {
  if (!finite(atr) || atr <= 0) return [];
  const gap = atr * config.levelClusterATR;
  const sorted = candidates.filter(item => finite(item.price) && item.price > 0).sort((a, b) => a.price - b.price);
  const groups = [];
  for (const item of sorted) {
    const previous = groups.at(-1);
    if (previous && item.price - previous.high <= gap) {
      previous.high = item.price; previous.evidence.push(item);
    } else groups.push({ low: item.price, high: item.price, evidence: [item] });
  }
  const volumes = bars.map(bar => bar.volume).filter(finite);
  const averageVolume = volumes.length ? average(volumes) : 0;
  return groups.map(group => {
    const center = (group.low + group.high) / 2;
    const touches = bars.filter(bar => Math.abs(bar.high - center) <= gap || Math.abs(bar.low - center) <= gap);
    const categories = new Set(group.evidence.map(item => item.category));
    const recent = bars.slice(-8);
    const rejection = recent.some(bar => Math.abs(bar.high - center) <= gap && bar.close < center
      || Math.abs(bar.low - center) <= gap && bar.close > center);
    const volumeConfluence = averageVolume > 0 && touches.some(bar => bar.volume > averageVolume * 1.3);
    const step = roundStep(center);
    const round = Math.abs(center - Math.round(center / step) * step) <= Math.min(gap, step * 0.1);
    const weights = config.levelWeights;
    const score = Math.min(100, (categories.has('swing4h') ? weights.swing4h : 0)
      + (categories.has('daily') ? weights.daily : 0) + (categories.has('pivot') ? weights.pivot : 0)
      + (categories.has('fibonacci') ? weights.fibonacci : 0) + (touches.length >= 2 ? weights.touches : 0)
      + (volumeConfluence ? weights.volume : 0) + (round ? weights.round : 0)
      + (rejection ? weights.rejection : 0));
    return { low: group.low, high: group.high, center, score, touches: touches.length,
      sources: [...new Set(group.evidence.map(item => item.label))], rejection, volumeConfluence };
  });
}

function levelCandidates(daily, fourHour) {
  const candidates = [];
  const add = (price, category, label) => { if (finite(price) && price > 0) candidates.push({ price, category, label }); };
  const fourSwings = swings(fourHour), dailySwings = swings(daily);
  for (const item of [...fourSwings.highs.slice(-14), ...fourSwings.lows.slice(-14)]) add(item.price, 'swing4h', '4H swing');
  for (const item of [...dailySwings.highs.slice(-8), ...dailySwings.lows.slice(-8)]) add(item.price, 'daily', 'D1 swing');
  const day = last(daily), four = last(fourHour);
  for (const [bar, label] of [[day, 'D1 high/low'], [four, '4H high/low']]) { add(bar.high, label.startsWith('D1') ? 'daily' : 'swing4h', label); add(bar.low, label.startsWith('D1') ? 'daily' : 'swing4h', label); }
  const pivot = calculatePivots(day);
  if (pivot) for (const [name, levels] of Object.entries(pivot)) {
    if (name === 'reference') continue;
    for (const key of ['pivot', 'r1', 'r2', 'r3', 'r4', 's1', 's2', 's3', 's4']) add(levels[key], 'pivot', `${name} ${key.toUpperCase()}`);
  }
  const recent = fourHour.slice(-20);
  const high = Math.max(...recent.map(bar => bar.high)), low = Math.min(...recent.map(bar => bar.low));
  add(high, 'swing4h', '4H Donchian 20'); add(low, 'swing4h', '4H Donchian 20');
  for (const ratio of [0.382, 0.5, 0.618]) add(low + (high - low) * ratio, 'fibonacci', `4H Fib ${ratio}`);
  const closes = fourHour.map(bar => bar.close);
  add(last(ema(closes, 20)), 'other', '4H EMA20'); add(last(ema(closes, 50)), 'other', '4H EMA50');
  return candidates;
}

/** The first real opposing zone is the target; RR only rejects it, never moves it. */
export function evaluateRoomToTarget({ side, entry, stop, target, atr }, config = TRADE_PLAN_CONFIG) {
  const risk = side === 'LONG' ? entry - stop : stop - entry;
  const reward = side === 'LONG' ? target - entry : entry - target;
  const valid = [entry, stop, target, atr].every(finite) && atr > 0 && risk > 0 && reward > 0;
  const riskReward = valid ? reward / risk : null;
  const roomATR = valid ? reward / atr : null;
  return { risk, reward, riskReward, roomATR, tradeAllowed: valid && riskReward >= config.minRiskReward && roomATR >= config.minRoomATR };
}

function featureObject({ daily, fourHour, oneHour, dailyState, atr, entry, stop, tp1, support, resistance, side }) {
  const close = last(oneHour).close, previous = oneHour.at(-2), candle = last(oneHour);
  const closes = oneHour.map(bar => bar.close);
  const e20 = last(ema(closes, 20)), e50 = last(ema(closes, 50));
  const volumes = oneHour.slice(-21, -1).map(bar => bar.volume).filter(finite);
  const avgVolume = volumes.length ? average(volumes) : null;
  const range = Math.max(0, candle.high - candle.low);
  const dailyRange = dailyState.donchianUpper - dailyState.donchianLower;
  return {
    ema20Distance: (close - e20) / atr, ema50Distance: (close - e50) / atr,
    ema20Slope: dailyState.ema20Slope / dailyState.atr14, adx14: dailyState.adx14,
    atr14: atr, atrPercent: atr / close * 100, rsi14: rsi14(closes),
    rsiSlope: rsi14(closes) - rsi14(oneHour.slice(0, -3).map(bar => bar.close)),
    distanceToSupportATR: support ? (close - support.high) / atr : null,
    distanceToResistanceATR: resistance ? (resistance.low - close) / atr : null,
    marketStructure: structure(fourHour), donchianPosition: dailyRange > 0 ? (last(daily).close - dailyState.donchianLower) / dailyRange : null,
    candleBodyATR: Math.abs(candle.close - candle.open) / atr,
    upperWickATR: (candle.high - Math.max(candle.open, candle.close)) / atr,
    lowerWickATR: (Math.min(candle.open, candle.close) - candle.low) / atr,
    volumeRatio: avgVolume > 0 ? candle.volume / avgVolume : null,
    entryToTPATR: finite(tp1) ? Math.abs(tp1 - entry) / atr : null,
    entryToSLATR: Math.abs(entry - stop) / atr,
    riskReward: finite(tp1) ? Math.abs(tp1 - entry) / Math.abs(entry - stop) : null,
    previousClose: previous.close, candleRangeATR: range / atr, side,
  };
}

function candidateForZone({ type, side, zone, zones, price, atr, dailyState, fourStructure, oneHour, allowShort, daily, fourHour, config }) {
  const long = side === 'LONG';
  const entry = long ? zone.high + config.entryZoneBufferATR * atr : zone.low - config.entryZoneBufferATR * atr;
  const stop = long ? zone.low - config.stopBufferATR * atr : zone.high + config.stopBufferATR * atr;
  const barriers = zones.filter(item => long ? item.low > entry : item.high < entry)
    .sort((a, b) => long ? a.low - b.low : b.high - a.high);
  const first = barriers[0], second = barriers[1];
  const tp1 = first ? long ? first.low : first.high : null;
  const tp2 = second ? long ? second.low : second.high : null;
  const room = evaluateRoomToTarget({ side, entry, stop, target: tp1, atr }, config);
  const lastBar = last(oneHour), previous = oneHour.at(-2);
  const oneCloses = oneHour.map(bar => bar.close), oneEma20 = last(ema(oneCloses, 20));
  const improving = long ? lastBar.close > previous.close && lastBar.close > oneEma20
    : lastBar.close < previous.close && lastBar.close < oneEma20;
  const biasAligned = dailyState.bias === (long ? 'BULLISH' : 'BEARISH');
  const structureAligned = fourStructure === (long ? 'HH_HL' : 'LH_LL');
  const nearZone = long ? price >= zone.low - config.entryZoneBufferATR * atr && price <= zone.high + config.maxEntryDistanceATR * atr
    : price <= zone.high + config.entryZoneBufferATR * atr && price >= zone.low - config.maxEntryDistanceATR * atr;
  const recentBreakout = oneHour.slice(-9, -1).some((bar, index) => {
    const prior = oneHour[oneHour.length - 10 + index];
    return prior && (long ? prior.close <= zone.high && bar.close > zone.high + config.breakoutBufferATR * atr
      : prior.close >= zone.low && bar.close < zone.low - config.breakoutBufferATR * atr);
  });
  const breakout = recentBreakout && (long
    ? previous.close > zone.high + config.breakoutBufferATR * atr && lastBar.low <= zone.high + config.entryZoneBufferATR * atr && lastBar.close >= zone.high
    : previous.close < zone.low - config.breakoutBufferATR * atr && lastBar.high >= zone.low - config.entryZoneBufferATR * atr && lastBar.close <= zone.low);
  const body = Math.max(Math.abs(lastBar.close - lastBar.open), atr * 0.05);
  const wick = long ? Math.min(lastBar.open, lastBar.close) - lastBar.low : lastBar.high - Math.max(lastBar.open, lastBar.close);
  const rejection = wick >= body && (long ? lastBar.close > lastBar.open : lastBar.close < lastBar.open);
  const oscillator = rsi14(oneCloses);
  const camarillaExtreme = zone.sources.some(source => source === `camarilla ${long ? 'S3' : 'R3'}`
    || source === `camarilla ${long ? 'S4' : 'R4'}`);
  const majorFourHourLevel = zone.sources.some(source => source === '4H swing' || source === '4H high/low');
  const reversalEvidence = zone.score >= 65 && majorFourHourLevel && camarillaExtreme && rejection
    && (long ? oscillator <= 40 : oscillator >= 60) && zone.volumeConfluence;
  const setupConfirmed = type === 'TREND_PULLBACK' ? biasAligned && structureAligned && nearZone && improving
    : type === 'BREAKOUT_RETEST' ? biasAligned && breakout && improving
      : nearZone && reversalEvidence;
  const stopATR = room.risk / atr;
  const blockers = [];
  if (!allowShort && !long) blockers.push('ฝั่ง SHORT ยังไม่เปิดสำหรับตลาดนี้');
  if (!setupConfirmed) blockers.push(type === 'TREND_PULLBACK' ? 'ยังไม่ครบ Bias D1, โครงสร้าง 4H และการกลับตัว 1H'
    : type === 'BREAKOUT_RETEST' ? 'ยังไม่เห็นแท่ง 1H breakout แล้ว retest ที่ยืนยัน' : 'หลักฐาน reversal ยังไม่ครบ');
  if (stopATR < config.minStopATR || stopATR > config.maxStopATR) blockers.push('Stop ตามโครงสร้างอยู่นอกช่วง 0.60–1.50 ATR');
  if (!first) blockers.push('ยังไม่พบแนวต้าน/แนวรับถัดไปที่ยืนยันจากแท่งจริง');
  else if (!room.tradeAllowed) blockers.push(`ระยะถึงโซนถัดไปไม่พอ: R:R ${room.riskReward?.toFixed(2) ?? '—'} · ${room.roomATR?.toFixed(2) ?? '—'} ATR`);
  const reasons = [];
  if (biasAligned) reasons.push(`D1 ${dailyState.bias} · คะแนน ${dailyState.score}`);
  if (structureAligned) reasons.push(`4H ${fourStructure}`);
  reasons.push(`โซน ${zone.low.toFixed(4)}–${zone.high.toFixed(4)} · ความแข็งแรง ${zone.score}/100 · ${zone.sources.slice(0, 3).join(', ')}`);
  if (improving) reasons.push('โมเมนตัม 1H เริ่มกลับตามฝั่งแผน');
  if (type === 'BREAKOUT_RETEST' && breakout) reasons.push('1H ปิดทะลุแล้วกลับทดสอบโซน');
  if (type === 'REVERSAL' && reversalEvidence) reasons.push('1H rejection + RSI + volume ยืนยัน');
  if (room.tradeAllowed) reasons.push(`แนวถัดไปให้ R:R ${room.riskReward.toFixed(2)} · ${room.roomATR.toFixed(2)} ATR`);
  const score = Math.min(100, (biasAligned ? 20 : 0) + (structureAligned ? 20 : 0)
    + Math.round(zone.score * 0.2) + (setupConfirmed ? 15 : 0) + (improving ? 10 : 0)
    + (stopATR >= config.minStopATR && stopATR <= config.maxStopATR ? 5 : 0) + (room.tradeAllowed ? 10 : 0));
  if (score < 70) blockers.push(`Technical Score ${score}/100 ต่ำกว่าเกณฑ์ 70`);
  const tradeAllowed = blockers.length === 0 && score >= 70;
  const features = featureObject({ daily, fourHour, oneHour, dailyState, atr, entry, stop, tp1, support: long ? zone : first,
    resistance: long ? first : zone, side });
  return { type, side, zone, entry, stop, tp1, tp2, targetZone: first ?? null, riskReward1: room.riskReward,
    riskReward2: finite(tp2) ? Math.abs(tp2 - entry) / room.risk : null,
    stopDistanceATR: stopATR, roomATR: room.roomATR, score, tradeAllowed, blockers, reasons, features };
}

/** Plan step 02 only: no entry monitoring, order placement, outcome or probability. */
export function buildTradePlan({ symbol, instrumentId, dailyBars, fourHourBars, oneHourBars, now = Date.now(), allowShort = false }, config = TRADE_PLAN_CONFIG) {
  const daily = completedCandles(dailyBars, '1d', now).slice(-100);
  const fourHour = completedCandles(fourHourBars, '4h', now).slice(-100);
  const oneHour = completedCandles(oneHourBars, '1h', now).slice(-100);
  const referenceCandles = { dailyTimestamp: last(daily)?.time ?? null, fourHourTimestamp: last(fourHour)?.time ?? null, oneHourTimestamp: last(oneHour)?.time ?? null };
  const base = { symbol, instrumentId, ruleVersion: config.version, referenceCandles,
    timeframeContext: { daily: daily.length, fourHour: fourHour.length, oneHour: oneHour.length } };
  if ([daily, fourHour, oneHour].some(bars => bars.length < config.minBars))
    return { ...base, status: 'WAIT', classification: 'WAIT', tradeAllowed: false, code: 'INSUFFICIENT_CLOSED_BARS', reasons: ['ต้องมีแท่งที่ปิดแล้วอย่างน้อย 55 แท่งต่อกรอบ D1, 4H และ 1H'] };
  const dailyAge = now - Date.parse(`${last(daily).time}T00:00:00.000Z`);
  const intradayAge = now - last(oneHour).time * 1000;
  if (dailyAge > 8 * 86_400_000 || intradayAge > 96 * 3_600_000)
    return { ...base, status: 'WAIT', classification: 'WAIT', tradeAllowed: false, code: 'STALE_CANDLES', reasons: ['แท่งล่าสุดเก่าเกินเกณฑ์สำหรับแผนใหม่'] };
  const dailyState = dailyBias(daily);
  const atr = atr14(oneHour);
  if (!atr) return { ...base, status: 'WAIT', classification: 'WAIT', tradeAllowed: false, code: 'ATR_UNAVAILABLE', reasons: ['ATR 1H คำนวณไม่ได้'] };
  const currentPrice = last(oneHour).close;
  const allZones = clusterLevels(levelCandidates(daily, fourHour), atr, fourHour, config);
  const supports = allZones.filter(zone => zone.high < currentPrice).sort((a, b) => b.high - a.high);
  const resistances = allZones.filter(zone => zone.low > currentPrice).sort((a, b) => a.low - b.low);
  const fourStructure = structure(fourHour);
  const sides = dailyState.bias === 'BULLISH' ? ['LONG'] : dailyState.bias === 'BEARISH' ? ['SHORT'] : ['LONG', 'SHORT'];
  const candidates = [];
  for (const side of sides) {
    const zones = side === 'LONG' ? supports.slice(0, 2) : resistances.slice(0, 2);
    for (const zone of zones) for (const type of ['TREND_PULLBACK', 'BREAKOUT_RETEST', 'REVERSAL'])
      candidates.push(candidateForZone({ type, side, zone, zones: allZones, price: currentPrice, atr,
        dailyState, fourStructure, oneHour, allowShort, daily, fourHour, config }));
  }
  candidates.sort((a, b) => Number(b.tradeAllowed) - Number(a.tradeAllowed) || b.score - a.score
    || (b.riskReward1 ?? -1) - (a.riskReward1 ?? -1));
  const chosen = candidates[0];
  const tradeAllowed = Boolean(chosen?.tradeAllowed);
  const hardBlocked = chosen?.blockers.some(reason => reason.startsWith('Stop ') || reason.startsWith('ยังไม่พบแนวต้าน')
    || reason.startsWith('ระยะถึงโซนถัดไป') || reason.startsWith('ฝั่ง SHORT'));
  const classification = tradeAllowed ? chosen.score >= 80 ? 'STRONG SETUP' : 'SETUP'
    : hardBlocked ? 'WAIT' : chosen?.score >= 60 ? 'WATCH' : 'WAIT';
  return {
    ...base, id: `${instrumentId}:${referenceCandles.dailyTimestamp}:${referenceCandles.fourHourTimestamp}:${referenceCandles.oneHourTimestamp}:${config.version}`,
    createdAt: new Date(referenceCandles.oneHourTimestamp * 1000).toISOString(),
    status: tradeAllowed ? 'WAITING_FOR_ENTRY' : 'WAIT', classification, tradeAllowed,
    bias: dailyState.bias, biasScore: dailyState.score, marketRegime: dailyState.adx14 >= 25 ? 'TRENDING' : 'RANGE_OR_WEAK_TREND',
    setupType: chosen?.type ?? null, side: chosen?.side ?? null,
    entryZone: chosen ? { low: chosen.zone.low, high: chosen.zone.high } : null,
    entry: chosen?.entry ?? null,
    trigger: chosen ? { type: 'CANDLE_CLOSE', operator: chosen.side === 'LONG' ? '>' : '<', price: chosen.entry, timeframe: '1h' } : null,
    stopLoss: chosen?.stop ?? null, stopDistanceATR: chosen?.stopDistanceATR ?? null,
    tp1: chosen?.tp1 ?? null, tp2: chosen?.tp2 ?? null,
    tp1Zone: chosen?.targetZone ?? null,
    riskReward1: chosen?.riskReward1 ?? null, riskReward2: chosen?.riskReward2 ?? null,
    supports: supports.slice(0, 3), resistances: resistances.slice(0, 3),
    signalScore: chosen?.score ?? 0, reasons: chosen?.reasons ?? [], blockers: chosen?.blockers ?? ['ยังไม่พบโซนที่ใช้ประเมินแผนได้'],
    features: chosen?.features ?? null,
  };
}
