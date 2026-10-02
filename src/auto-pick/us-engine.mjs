const VERSION = 'us-eod-breakout-v0.2-unvalidated';
export const US_EOD_RULE_VERSION = VERSION;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

function ema(values, period) {
  let current = null;
  return values.map((value, index) => {
    if (index === period - 1) current = average(values.slice(0, period));
    else if (index >= period) current += (value - current) * 2 / (period + 1);
    return current;
  });
}

function atr14(bars) {
  if (bars.length < 15) return null;
  const ranges = bars.slice(1).map((bar, index) => Math.max(bar.high - bar.low,
    Math.abs(bar.high - bars[index].close), Math.abs(bar.low - bars[index].close)));
  let value = average(ranges.slice(0, 14));
  for (const range of ranges.slice(14)) value = (value * 13 + range) / 14;
  return value > 0 ? value : null;
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

/** Daily close breakout plan. This is an unvalidated pilot rule, not a backtest. */
export function buildUsEodPlan({ symbol, instrumentId = `us:${symbol}`, bars }) {
  const daily = Array.isArray(bars) ? [...bars].filter(bar => typeof bar?.time === 'string'
    && [bar.open, bar.high, bar.low, bar.close, bar.volume].every(finite)
    && bar.low > 0 && bar.open > 0 && bar.high >= Math.max(bar.open, bar.close) && bar.low <= Math.min(bar.open, bar.close))
    .sort((a, b) => a.time.localeCompare(b.time)) : [];
  const latest = daily.at(-1) ?? null;
  const referenceCandles = { dailyDay: latest?.time ?? null };
  const base = { symbol, instrumentId, ruleVersion: VERSION, timeframe: '1d', signalTimeframe: '1d', referenceCandles,
    timeframeContext: { daily: daily.length } };
  const fail = (code, reason) => ({ ...base, id: `${instrumentId}:${latest?.time ?? 'none'}:${VERSION}`,
    status: 'WAIT', classification: 'WAIT', tradeAllowed: false, code, reasons: [], blockers: [reason] });
  if (daily.length < 60) return fail('INSUFFICIENT_CLOSED_BARS', 'ต้องมีแท่งรายวันที่ปิดแล้วอย่างน้อย 60 วันทำการ');
  if (latest.close < 50) return fail('PRICE_BELOW_50', 'รุ่นนี้สแกนหุ้นสหรัฐฯ ราคาปิดตั้งแต่ $50');
  const closes = daily.map(bar => bar.close);
  const ema20 = ema(closes, 20), ema50 = ema(closes, 50);
  const atr = atr14(daily), rsi = rsi14(closes);
  if (!atr || !finite(rsi)) return fail('INDICATORS_UNAVAILABLE', 'คำนวณ ATR หรือ RSI จากแท่งรายวันไม่ได้');
  const close = latest.close;
  const avgDollarVolume = average(daily.slice(-21, -1).map(bar => bar.close * bar.volume));
  const volumeRatio = average(daily.slice(-21, -1).map(bar => bar.volume)) > 0
    ? latest.volume / average(daily.slice(-21, -1).map(bar => bar.volume)) : null;
  const high = latest.high, low = latest.low;
  const closeStrength = high > low ? (close - low) / (high - low) : 0.5;
  const entry = high + 0.10 * atr;
  const supportLow = Math.min(...daily.slice(-11, -1).map(bar => bar.low));
  const stopLoss = supportLow - 0.10 * atr;
  const risk = entry - stopLoss;
  const riskATR = risk / atr;
  const overhead = daily.slice(-61, -1).map(bar => bar.high).filter(price => price > entry).sort((a, b) => a - b)[0] ?? null;
  const projectedTarget = entry + 2 * risk;
  const tp1 = overhead ? Math.min(overhead, projectedTarget) : projectedTarget;
  const riskReward = risk > 0 ? (tp1 - entry) / risk : null;

  const checks = [
    { ok: close > ema20.at(-1), score: 15, reason: 'ราคาปิดอยู่เหนือ EMA20' },
    { ok: ema20.at(-1) > ema50.at(-1), score: 20, reason: 'EMA20 อยู่เหนือ EMA50' },
    { ok: ema20.at(-1) > ema20.at(-6), score: 15, reason: 'EMA20 มีความชันขึ้นในช่วง 5 วัน' },
    { ok: rsi >= 48 && rsi <= 75, score: 15, reason: 'RSI อยู่ในช่วง 48–75' },
    { ok: closeStrength >= 0.65, score: 10, reason: 'แท่งล่าสุดปิดใกล้ด้านบนของช่วงราคา' },
    { ok: finite(volumeRatio) && volumeRatio >= 0.8, score: 10, reason: 'ปริมาณซื้อขายไม่น้อยกว่า 80% ของค่าเฉลี่ย 20 วัน' },
    { ok: finite(avgDollarVolume) && avgDollarVolume >= 10_000_000, score: 15, reason: 'มูลค่าซื้อขายเฉลี่ย 20 วันอย่างน้อย $10M' },
  ];
  const score = checks.reduce((total, check) => total + (check.ok ? check.score : 0), 0);
  const blockers = [];
  if (!(close > ema20.at(-1) && ema20.at(-1) > ema50.at(-1))) blockers.push('ราคาปิดยังไม่เหนือ EMA20 และ EMA20 ยังไม่เหนือ EMA50');
  if (rsi < 48 || rsi > 75) blockers.push('RSI อยู่นอกช่วง 48–75');
  if (!finite(avgDollarVolume) || avgDollarVolume < 10_000_000) blockers.push('มูลค่าซื้อขายเฉลี่ย 20 วันต่ำกว่า $10M');
  if (riskATR < 0.50 || riskATR > 2.50) blockers.push('ระยะ stop จาก swing low อยู่นอกช่วง 0.50–2.50 ATR');
  if (!finite(riskReward) || riskReward < 1.80) blockers.push(`ระยะถึงเป้าให้ R:R ต่ำกว่า 1.80 (${riskReward?.toFixed(2) ?? '—'})`);
  if (score < 65) blockers.push(`คะแนนรูปแบบ ${score}/100 ต่ำกว่าเกณฑ์ 65`);
  const tradeAllowed = blockers.length === 0;
  const reasons = checks.filter(check => check.ok).map(check => check.reason);
  reasons.push(`แท่ง D1 ล่าสุด ${latest.time} · ปิด $${close.toFixed(2)} · ATR14 $${atr.toFixed(2)} · RSI14 ${rsi.toFixed(1)}`);
  reasons.push(overhead ? `TP1 อิงแนวต้านย้อนหลังหรือเป้า 2R แล้วแต่ระดับที่ใกล้กว่า ($${tp1.toFixed(2)})` : 'ไม่มีแนวต้านย้อนหลังเหนือจุดเข้า · ใช้เป้าคำนวณ 2R');
  return { ...base, id: `${instrumentId}:${latest.time}:${VERSION}`, createdAt: latest.time,
    status: tradeAllowed ? 'WAITING_FOR_ENTRY' : 'WAIT', classification: tradeAllowed ? 'DAILY BREAKOUT WATCH' : score >= 50 ? 'WATCH' : 'WAIT',
    tradeAllowed, bias: 'BULLISH', biasScore: score, setupType: 'DAILY_CLOSE_BREAKOUT', side: 'LONG',
    entryZone: { low: latest.high, high: entry }, entry,
    trigger: { type: 'CANDLE_CLOSE', operator: '>', price: entry, timeframe: '1d' },
    stopLoss, stopDistanceATR: riskATR, tp1, tp2: projectedTarget, targetMethod: overhead ? 'nearest-overhead-level-or-2R' : '2R-projection',
    riskReward1: riskReward, riskReward2: 2, signalScore: score, reasons, blockers,
    features: { close, ema20: ema20.at(-1), ema50: ema50.at(-1), ema20Slope5: ema20.at(-1) - ema20.at(-6), atr14: atr,
      atrPercent: atr / close * 100, rsi14: rsi, volumeRatio, averageDollarVolume20: avgDollarVolume,
      closeStrength, trigger: entry, stopLoss, tp1, riskReward1: riskReward },
    maxEntryBars: 1,
  };
}

function epochForDay(day) { return Math.floor(Date.parse(`${day}T00:00:00Z`) / 1000); }
function event(type, bar, price, detail) { return { type, barTime: null, barDay: bar?.time ?? null, price: finite(price) ? price : null, detail }; }

/** Evaluate only completed daily bars. If one D1 range hits both exits, leave it unresolved. */
export function advanceUsEodPick(pick, bars) {
  const next = { ...pick };
  const events = [];
  const daily = [...(bars ?? [])].sort((a, b) => a.time.localeCompare(b.time));
  const plan = pick.plan;
  if (!plan?.tradeAllowed || plan.timeframe !== '1d' || !finite(plan.entry) || !finite(plan.stopLoss) || !finite(plan.tp1)) return { pick: next, events };
  const referenceDay = plan.referenceCandles?.dailyDay ?? pick.sessionDay;
  const referenceIndex = daily.findIndex(bar => bar.time === referenceDay);
  const enteredIndex = daily.findIndex(bar => bar.time === next.enteredAt);

  if (next.status === 'WAITING_FOR_ENTRY') {
    const maxEntryBars = 1; // A D1 plan gets one following trading day to confirm.
    for (const bar of daily.filter(item => item.time > referenceDay)) {
      const index = daily.indexOf(bar);
      if (referenceIndex >= 0 && index - referenceIndex > maxEntryBars) {
        next.status = 'EXPIRED';
        events.push(event('EXPIRED', bar, null, 'หมดอายุแผนหนึ่งวันซื้อขายโดยยังไม่ยืนยันจุดเข้า'));
        break;
      }
      if (bar.close <= plan.trigger.price) {
        next.status = 'EXPIRED';
        events.push(event('EXPIRED', bar, null, 'วันซื้อขายถัดจากแผนไม่ปิดเหนือจุดยืนยัน'));
        break;
      }
      const actualRisk = bar.close - plan.stopLoss;
      const reward = plan.tp1 - bar.close;
      const rr = actualRisk > 0 ? reward / actualRisk : 0;
      if (bar.open > plan.trigger.price + Math.abs(plan.entry - plan.stopLoss) * 0.2
        || reward <= 0 || rr < 1.8) {
        next.status = 'EXPIRED';
        events.push(event('ENTRY_SKIPPED', bar, bar.close, 'แท่ง D1 ปิดยืนยันช้า/ไกลเกินแผน หรือ R:R ต่ำกว่า 1.8'));
        break;
      }
      next.status = 'OPEN';
      next.entryPrice = bar.close;
      next.enteredAt = bar.time;
      next.lastChecked15m = epochForDay(bar.time);
      events.push(event('ENTRY', bar, bar.close, `แท่ง D1 ปิดเหนือจุดยืนยัน · ราคาอ้างอิง $${bar.close.toFixed(2)}`));
      break;
    }
  }

  if (next.status === 'OPEN') {
    const entryDay = next.enteredAt;
    let lastCheckedDay = daily.find(bar => epochForDay(bar.time) === next.lastChecked15m)?.time ?? entryDay;
    for (const bar of daily.filter(item => item.time > entryDay && epochForDay(item.time) > (next.lastChecked15m ?? epochForDay(entryDay)))) {
      const gapDays = (Date.parse(`${bar.time}T00:00:00Z`) - Date.parse(`${lastCheckedDay}T00:00:00Z`)) / 86_400_000;
      if (gapDays > 6) {
        next.status = 'REVIEW';
        events.push(event('DATA_GAP', bar, null, 'ข้อมูลแท่ง D1 ขาดช่วงเกิน 6 วันปฏิทิน · ต้องตรวจราคาที่เกิดระหว่างช่วง'));
        break;
      }
      const target = bar.high >= plan.tp1;
      const stop = bar.low <= plan.stopLoss;
      if (target && stop) {
        next.status = 'AMBIGUOUS';
        events.push(event('AMBIGUOUS', bar, null, 'แท่ง D1 เดียวแตะทั้ง TP1 และ SL · ไม่มีข้อมูล intraday ระบุลำดับ'));
      } else if (target || stop) {
        next.status = target ? 'TARGET' : 'STOP';
        const threshold = target ? plan.tp1 : plan.stopLoss;
        const gapPrice = target ? bar.open >= threshold : bar.open <= threshold;
        next.exitPrice = gapPrice ? bar.open : threshold;
        next.exitedAt = bar.time;
        events.push(event(target ? 'TARGET' : 'STOP', bar, next.exitPrice, gapPrice ? 'เปิดแท่ง D1 เลยระดับ · อ้างอิงราคาเปิด' : 'ระดับราคาแตะในช่วงแท่ง D1'));
      } else {
        const entryRowIndex = daily.findIndex(item => item.time === entryDay);
        if (entryRowIndex >= 0 && daily.indexOf(bar) - entryRowIndex >= 20) {
          next.status = 'REVIEW';
          events.push(event('SESSION_END', bar, null, 'ถือครบ 20 แท่งรายวันแล้วยังไม่ถึง TP1 หรือ SL · ตรวจแผนใหม่'));
        }
      }
      next.lastChecked15m = epochForDay(bar.time);
      lastCheckedDay = bar.time;
      if (next.status !== 'OPEN') break;
    }
  }
  return { pick: next, events };
}
