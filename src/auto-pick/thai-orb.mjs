import { completedCandles } from '../analysis/pivots.mjs';
import { thaiEquityTick } from '../analysis/thai-tick.mjs';
import { dailyHistoryContext } from '../analysis/daily-history.mjs';
import { nearestSwingHigh } from '../analysis/resistance.mjs';
import { bangkokParts } from './engine.mjs';

const VERSION = 'thai-orb-v3-swing-resistance-unvalidated';
export const THAI_ORB_RULE_VERSION = VERSION;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;

function tickRound(price, direction) {
  const tick = thaiEquityTick(price);
  if (!tick) return null;
  const units = direction === 'up' ? Math.ceil(price / tick - 1e-9) : Math.floor(price / tick + 1e-9);
  return Number((units * tick).toFixed(2));
}

function ema20(closes) {
  if (closes.length < 20) return null;
  let value = mean(closes.slice(0, 20));
  for (const close of closes.slice(20)) value += (close - value) * 2 / 21;
  return value;
}

function sessionBars(bars, day) {
  return bars.filter(bar => bangkokParts(bar.time * 1000).day === day
    && bangkokParts(bar.time * 1000).minutes >= 600
    && bangkokParts(bar.time * 1000).minutes < 750);
}

function sessionVwap(bars) {
  const usable = bars.filter(bar => finite(bar.volume) && bar.volume > 0);
  const totalVolume = usable.reduce((sum, bar) => sum + bar.volume, 0);
  return totalVolume > 0 ? usable.reduce((sum, bar) => sum + (bar.high + bar.low + bar.close) / 3 * bar.volume, 0) / totalVolume : null;
}

function sameSlotVolumeRatio(bars, current) {
  const { day, minutes } = bangkokParts(current.time * 1000);
  const history = bars.filter(bar => {
    const time = bangkokParts(bar.time * 1000);
    return time.day !== day && time.minutes === minutes && finite(bar.volume) && bar.volume > 0;
  }).slice(-4);
  return history.length >= 2 ? current.volume / mean(history.map(bar => bar.volume)) : null;
}

function wait(base, code, reason) {
  return { ...base, status: 'WAIT', classification: 'WAIT', tradeAllowed: false, code, blockers: [reason], reasons: [] };
}

/** Publish a watch plan after the first regular-market 15m bar closes. */
export function buildThaiOrbPlan({ symbol, instrumentId = `SET100:${symbol}`, fifteenMinuteBars, dailyBars, now = Date.now() }) {
  const day = bangkokParts(now).day;
  const intraday = completedCandles(fifteenMinuteBars, '15m', now).sort((a, b) => a.time - b.time);
  const daily = completedCandles(dailyBars, '1d', now).sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const opening = sessionBars(intraday, day).find(bar => bangkokParts(bar.time * 1000).minutes === 600);
  const referenceCandles = { fifteenMinuteTimestamp: opening?.time ?? null, dailyDay: daily.at(-1)?.time ?? null };
  const base = { symbol, instrumentId, id: `${instrumentId}:${day}:${VERSION}`, ruleVersion: VERSION, timeframe: '15m',
    signalTimeframe: '15m', setupType: 'OPENING_RANGE_BREAKOUT', side: 'LONG', referenceCandles,
    timeframeContext: { daily: daily.length, fifteenMinute: intraday.length } };
  if (!opening) return wait(base, 'OPENING_BAR_UNAVAILABLE', 'ยังไม่มีแท่ง 10:00–10:15 ที่ปิดแล้ว');
  if (daily.length < 25) return wait(base, 'INSUFFICIENT_DAILY_BARS', 'ต้องมีแท่งรายวันอย่างน้อย 25 วัน');
  const previous = daily.filter(bar => bar.time < day);
  if (previous.length < 25) return wait(base, 'INSUFFICIENT_DAILY_BARS', 'ต้องมีข้อมูลรายวันก่อนวันสแกนอย่างน้อย 25 วัน');
  if (Date.parse(`${day}T00:00:00+07:00`) - Date.parse(`${previous.at(-1).time}T00:00:00+07:00`) > 7 * 86_400_000)
    return wait(base, 'STALE_DAILY_BARS', 'แท่งรายวันล่าสุดเก่าเกิน 7 วัน');
  if (!finite(opening.volume) || opening.volume <= 0) return wait(base, 'OPENING_VOLUME_UNAVAILABLE', 'แท่งเปิดไม่มีปริมาณซื้อขาย');
  const minOpeningValue = instrumentId.startsWith('MAI_INITIAL:') ? 300_000 : 750_000;
  if (opening.close * opening.volume < minOpeningValue) return wait(base, 'OPENING_VALUE_TOO_LOW', `มูลค่าซื้อขายแท่งเปิดต่ำกว่า ${minOpeningValue.toLocaleString()} บาท`);
  if ((opening.high - opening.low) / opening.close > 0.03) return wait(base, 'OPENING_RANGE_TOO_WIDE', 'กรอบแท่งเปิดกว้างเกิน 3%');
  const closes = previous.map(bar => bar.close);
  const history = dailyHistoryContext(previous);
  const trend = ema20(closes);
  const entry = tickRound(opening.high + (thaiEquityTick(opening.high) ?? 0), 'up');
  if (!entry || !(closes.at(-1) >= trend * 0.98)) return wait(base, 'DAILY_TREND_NOT_UP', 'ราคาปิดล่าสุดต่ำกว่า EMA20 รายวันเกิน 2%');
  const overhead = nearestSwingHigh(previous.slice(-25), entry);
  const nearestDailyHigh = previous.slice(-25).map(bar => bar.high).filter(price => price > entry).sort((a, b) => a - b)[0] ?? null;
  const target = tickRound(Math.min(entry * 1.04, overhead ?? Infinity), 'down');
  const potentialReward = target - entry;
  if (potentialReward < entry * 0.012) return wait(base, 'TARGET_TOO_CLOSE', 'แนวต้านถัดไปเหลือระยะทำกำไรต่ำกว่า 1.2%');
  const riskBudget = Math.min(entry * 0.02, potentialReward / 1.7);
  const stopLoss = tickRound(entry - riskBudget, 'up');
  const risk = entry - stopLoss;
  const riskReward = risk > 0 ? potentialReward / risk : null;
  if (!(risk > 0 && riskReward >= 1.5)) return wait(base, 'RISK_REWARD_TOO_LOW', 'หลังปัดราคาตาม tick แล้ว R:R ต่ำกว่า 1.5');
  return { ...base, createdAt: new Date((opening.time + 900) * 1000).toISOString(), status: 'WAITING_FOR_ENTRY',
    classification: 'ORB WATCH', tradeAllowed: true, bias: 'BULLISH', biasScore: 65, marketRegime: 'DAILY_ABOVE_EMA20',
    entryZone: { low: opening.high, high: entry }, entry,
    trigger: { type: 'CANDLE_CLOSE', operator: '>=', price: entry, timeframe: '15m' }, stopLoss, tp1: target, tp2: null,
    riskReward1: riskReward, riskReward2: null, signalScore: 65, blockers: [],
    targetMethod: overhead && overhead < entry * 1.04 ? 'nearest-daily-swing-high' : '4-percent-ceiling',
    reasons: ['กรอบเปิดตลาด 10:00–10:15', 'ราคาปิดวันก่อนใกล้ EMA20 รายวัน',
      `เฝ้าแท่ง 15 นาทีปิดเหนือ ${entry} พร้อม VWAP · มูลค่าซื้อขาย`,
      `แนวต้าน/เป้าหมาย ${target} · Stop ${stopLoss} · R:R ${riskReward.toFixed(2)}`],
    features: { orbHigh: opening.high, orbLow: opening.low, dailyEma20: trend, priorClose: closes.at(-1),
      overheadResistance: overhead, nearestDailyHigh, minEntryBarValue: instrumentId.startsWith('MAI_INITIAL:') ? 200_000 : 500_000,
      entry, stopLoss, tp1: target, riskReward1: riskReward,
      dailyHistory: history } };
}

const event = (type, bar, price, detail) => ({ type, barTime: bar?.time ?? null, price: finite(price) ? price : null, detail });

/** Closed bars only: signals are reference prices, never account fills. */
export function advanceThaiOrbPick(pick, fifteenMinuteBars, now = Date.now()) {
  const next = { ...pick };
  const events = [];
  const plan = pick.plan;
  if (plan?.setupType !== 'OPENING_RANGE_BREAKOUT' || !plan.tradeAllowed) return { pick: next, events };
  const bars = completedCandles(fifteenMinuteBars, '15m', now).sort((a, b) => a.time - b.time);
  const today = sessionBars(bars, pick.sessionDay);
  if (next.status === 'WAITING_FOR_ENTRY') {
    const fresh = today.filter(bar => bar.time > plan.referenceCandles.fifteenMinuteTimestamp
      && bar.time > (next.lastChecked15m ?? 0));
    for (const bar of fresh) {
      const minute = bangkokParts(bar.time * 1000).minutes;
      next.lastChecked15m = bar.time;
      if (minute >= 675) break;
      const barClosedAt = (bar.time + 900) * 1000;
      if (barClosedAt <= Date.parse(pick.publishedAt)) continue;
      if (now - barClosedAt > 20 * 60_000) { next.plan = { ...next.plan, monitoringIncomplete: true }; continue; }
      const vwap = sessionVwap(today.filter(item => item.time <= bar.time));
      const volumeRatio = sameSlotVolumeRatio(bars, bar);
      const tradedValue = bar.close * bar.volume;
      const risk = bar.close - plan.stopLoss;
      const reward = plan.tp1 - bar.close;
      next.plan = { ...next.plan, latestEntryCheck: { at: new Date(barClosedAt).toISOString(), price: bar.close, gates: [
        { label: 'ปิดเหนือจุดเข้า', passed: bar.close >= plan.entry }, { label: 'เหนือ VWAP', passed: bar.close > vwap },
        { label: 'มูลค่าซื้อขาย', passed: tradedValue >= (plan.features.minEntryBarValue ?? 500000) },
        { label: 'แท่งไม่แดง', passed: bar.close >= bar.open }, { label: 'ความเสี่ยงไม่เกิน 2%', passed: risk > 0 && risk / bar.close <= .02 },
        { label: 'R:R ≥ 1.5', passed: risk > 0 && reward / risk >= 1.5 },
        { label: 'ไม่ไล่ราคา', passed: bar.close - plan.entry <= Math.max(thaiEquityTick(plan.entry), (plan.entry-plan.stopLoss)*.25) },
      ] } };
      if (!(bar.close >= plan.entry && bar.close > vwap && tradedValue >= (plan.features.minEntryBarValue ?? 500_000)
        && bar.close >= bar.open && risk > 0 && risk / bar.close <= 0.02 && reward / risk >= 1.5
        && bar.close - plan.entry <= Math.max(thaiEquityTick(plan.entry), (plan.entry - plan.stopLoss) * 0.25))) continue;
      next.status = 'OPEN';
      next.entryPrice = bar.close;
      next.enteredAt = new Date((bar.time + 900) * 1000).toISOString();
      events.push(event('ENTRY', bar, bar.close, `15m ORB · VWAP ${vwap.toFixed(2)} · มูลค่า ${Math.round(tradedValue).toLocaleString()} บาท${volumeRatio === null ? '' : ` · Vol ${volumeRatio.toFixed(2)}x`}`));
      break;
    }
    const clock = bangkokParts(now);
    if (next.status === 'WAITING_FOR_ENTRY' && (clock.day > pick.sessionDay || clock.day === pick.sessionDay && clock.minutes >= 690)) {
      const verified = !next.plan.monitoringIncomplete && ((next.lastChecked15m ?? 0) + 900) * 1000 >= Date.parse(`${pick.sessionDay}T11:30:00+07:00`);
      next.status = verified ? 'EXPIRED' : 'REVIEW';
      events.push(event(verified ? 'EXPIRED' : 'DATA_GAP', null, null, verified ? 'ตรวจถึงหมดเวลาแล้ว ไม่ครบเงื่อนไขเข้า' : 'ติดตามแท่งไม่ครบก่อนหมดเวลา ไม่สรุปว่าไม่เข้าเงื่อนไข'));
    }
  }
  if (next.status === 'OPEN') {
    const entered = Date.parse(next.enteredAt) / 1000;
    let lastChecked = next.lastChecked15m ?? plan.referenceCandles.fifteenMinuteTimestamp;
    for (const bar of bars.filter(item => item.time >= entered && item.time > lastChecked)) {
      if (bar.time - lastChecked > 900) {
        next.status = 'REVIEW';
        events.push(event('DATA_GAP', bar, null, 'ข้อมูลแท่ง 15 นาทีขาดช่วง'));
        break;
      }
      const target = bar.high >= plan.tp1;
      const stop = bar.low <= plan.stopLoss;
      if (target && stop) {
        next.status = 'AMBIGUOUS';
        events.push(event('AMBIGUOUS', bar, null, 'แท่งเดียวแตะทั้ง TP และ SL'));
      } else if (target || stop) {
        next.status = target ? 'TARGET' : 'STOP';
        const threshold = target ? plan.tp1 : plan.stopLoss;
        next.exitPrice = target ? bar.open >= threshold ? bar.open : threshold : bar.open <= threshold ? bar.open : threshold;
        next.exitedAt = new Date((bar.time + 900) * 1000).toISOString();
        events.push(event(target ? 'TARGET' : 'STOP', bar, next.exitPrice, 'ราคาจากช่วงแท่ง 15 นาที ไม่ใช่ราคา fill'));
      } else {
        const minutesHeld = (bar.time + 900 - entered) / 60;
        const risk = next.entryPrice - plan.stopLoss;
        const vwap = sessionVwap(today.filter(item => item.time <= bar.time));
        const minute = bangkokParts(bar.time * 1000).minutes;
        const exitReason = minute >= 720 ? 'จบภาคเช้า 12:15'
          : minutesHeld >= 30 && bar.close < next.entryPrice + risk * 0.25 ? 'Time Stop 30 นาที'
            : bar.close > next.entryPrice + risk * 0.5 && finite(vwap) && bar.close < vwap ? 'กำไรเริ่มกลับลงใต้ VWAP' : null;
        if (exitReason) {
          next.status = 'EXIT';
          next.exitPrice = bar.close;
          next.exitedAt = new Date((bar.time + 900) * 1000).toISOString();
          events.push(event('EXIT', bar, bar.close, `15m ${exitReason} · ราคาปิดแท่งอ้างอิง ไม่ใช่ราคา fill`));
        }
      }
      lastChecked = bar.time;
      next.lastChecked15m = lastChecked;
      if (next.status !== 'OPEN') break;
    }
    const clock = bangkokParts(now);
    if (next.status === 'OPEN' && (clock.day > pick.sessionDay || clock.day === pick.sessionDay && clock.minutes >= 765)) {
      next.status = 'REVIEW';
      events.push(event('SESSION_END', null, null, 'จบภาคเช้าโดยไม่ถึง TP/SL · ตรวจราคาออกด้วยมือ'));
    }
  }
  return { pick: next, events };
}
