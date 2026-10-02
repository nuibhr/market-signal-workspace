import { completedCandles } from '../analysis/pivots.mjs';
import { thaiEquityTick } from '../analysis/thai-tick.mjs';
import { dailyHistoryContext } from '../analysis/daily-history.mjs';
import { nearestSwingHigh } from '../analysis/resistance.mjs';
import { bangkokParts } from './engine.mjs';

const VERSION = 'dr-orb-v3-swing-resistance-unvalidated';
export const DR_ORB_RULE_VERSION = VERSION;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const at = (day, time) => Date.parse(`${day}T${time}:00+07:00`) / 1000;
const nextDay = day => new Date(Date.parse(`${day}T12:00:00+07:00`) + 86_400_000).toISOString().slice(0, 10);
const previousDay = day => new Date(Date.parse(`${day}T12:00:00+07:00`) - 86_400_000).toISOString().slice(0, 10);
const tickRound = (price, direction) => {
  const tick = thaiEquityTick(price);
  if (!tick) return null;
  return Number(((direction === 'up' ? Math.ceil(price / tick - 1e-9) : Math.floor(price / tick + 1e-9)) * tick).toFixed(2));
};
const event = (type, bar, price, detail) => ({ type, barTime: bar?.time ?? null, price: finite(price) ? price : null, detail });

export function drSession(now = Date.now()) {
  const clock = bangkokParts(now);
  const night = clock.minutes >= 19 * 60 || clock.minutes < 3 * 60;
  const day = night && clock.minutes < 3 * 60 ? previousDay(clock.day) : clock.day;
  const weekday = new Date(`${day}T12:00:00+07:00`).getUTCDay();
  const businessDay = weekday >= 1 && weekday <= 5;
  const session = night ? 'night' : 'day';
  const start = at(day, night ? '19:00' : '10:00');
  const end = night ? at(nextDay(day), '02:45') : at(day, '12:30');
  const openingEnd = start + (night ? 3600 : 1800);
  const timestamp = now / 1000;
  return {
    day, session, key: `${day}:${session}`, start, end, openingEnd,
    monitorWindow: businessDay && timestamp >= start && timestamp < end + 900,
    candidateWindow: businessDay && timestamp >= openingEnd && timestamp < start + (night ? 9000 : 4500),
    entryEnd: start + (night ? 4 * 3600 : 90 * 60),
  };
}

const inSession = (bars, session) => bars.filter(bar => bar.time >= session.start && bar.time < session.end);
function sessionVwap(bars) {
  const volume = bars.reduce((sum, bar) => sum + bar.volume, 0);
  return volume > 0 ? bars.reduce((sum, bar) => sum + (bar.high + bar.low + bar.close) / 3 * bar.volume, 0) / volume : null;
}
const wait = (base, code, reason) => ({ ...base, status: 'WAIT', classification: 'WAIT', tradeAllowed: false, code, blockers: [reason], reasons: [] });

export function buildDrOrbPlan({ symbol, fifteenMinuteBars, dailyBars, session, now = Date.now() }) {
  const intraday = completedCandles(fifteenMinuteBars, '15m', now).sort((a, b) => a.time - b.time);
  const opening = inSession(intraday, session).filter(bar => bar.time < session.openingEnd && bar.volume > 0);
  const previous = completedCandles(dailyBars, '1d', now).filter(bar => bar.time < (session.session === 'night' ? nextDay(session.day) : session.day));
  const base = { symbol, instrumentId: `DR:${symbol}`, id: `DR:${symbol}:${session.key}:${VERSION}`,
    ruleVersion: VERSION, timeframe: '15m', signalTimeframe: '15m', setupType: 'DR_ORB_15M', side: 'LONG',
    referenceCandles: { fifteenMinuteTimestamp: opening.at(-1)?.time ?? null, dailyDay: previous.at(-1)?.time ?? null },
    features: { session: session.session, openingStart: session.start, openingEnd: session.openingEnd, sessionEnd: session.end, entryEnd: session.entryEnd },
    timeframeContext: { daily: previous.length, fifteenMinute: intraday.length } };
  if (!opening.length) return wait(base, 'OPENING_BAR_UNAVAILABLE', 'ไม่มีแท่งซื้อขายในกรอบเปิด');
  if (previous.length < 25) return wait(base, 'INSUFFICIENT_DAILY_BARS', 'ข้อมูลรายวันไม่ครบ 25 วัน');
  const lastDaily = previous.at(-1);
  if (session.start * 1000 - Date.parse(`${lastDaily.time}T00:00:00+07:00`) > 8 * 86_400_000)
    return wait(base, 'STALE_DAILY_BARS', 'ข้อมูลรายวันเก่าเกิน 8 วัน');
  const tradedValue = opening.reduce((sum, bar) => sum + bar.close * bar.volume, 0);
  const minOpeningValue = session.session === 'night' ? 300_000 : 150_000;
  if (tradedValue < minOpeningValue) return wait(base, 'OPENING_VALUE_TOO_LOW', `มูลค่าซื้อขายกรอบเปิดต่ำกว่า ${minOpeningValue.toLocaleString()} บาท`);
  const high = Math.max(...opening.map(bar => bar.high));
  const low = Math.min(...opening.map(bar => bar.low));
  if ((high - low) / high > 0.035) return wait(base, 'OPENING_RANGE_TOO_WIDE', 'กรอบเปิดกว้างเกิน 3.5%');
  const entry = tickRound(high + thaiEquityTick(high), 'up');
  if (!entry) return wait(base, 'INVALID_TICK', 'คำนวณช่วงราคาไม่ได้');
  const closes = previous.map(bar => bar.close);
  const history = dailyHistoryContext(previous);
  const average20 = closes.slice(-20).reduce((sum, close) => sum + close, 0) / 20;
  if (lastDaily.close < average20 * 0.98) return wait(base, 'DAILY_TREND_NOT_UP', 'ราคาปิดวันล่าสุดต่ำกว่าเฉลี่ย 20 วันเกิน 2%');
  const overhead = nearestSwingHigh(previous.slice(-30), entry);
  const nearestDailyHigh = previous.slice(-30).map(bar => bar.high).filter(price => price > entry).sort((a, b) => a - b)[0] ?? null;
  const target = tickRound(Math.min(entry * 1.04, overhead ?? Infinity), 'down');
  const reward = target - entry;
  if (reward / entry < 0.012) return wait(base, 'TARGET_TOO_CLOSE', 'แนวต้านถัดไปเหลือระยะทำกำไรต่ำกว่า 1.2%');
  const stopLoss = tickRound(entry - Math.min(entry * 0.02, reward / 1.7), 'up');
  const risk = entry - stopLoss;
  if (!(risk > 0 && reward / risk >= 1.5)) return wait(base, 'RISK_REWARD_TOO_LOW', 'R:R หลังปัด tick ต่ำกว่า 1.5');
  const maxChase = tickRound(Math.min(entry + thaiEquityTick(entry), (target + 1.5 * stopLoss) / 2.5, stopLoss / 0.98), 'down');
  if (maxChase < entry) return wait(base, 'ENTRY_CEILING_TOO_LOW', 'เพดานราคาเสนอขายทำให้ R:R ต่ำกว่าเกณฑ์');
  return { ...base, status: 'WAITING_FOR_ENTRY', classification: 'DR ORB WATCH', tradeAllowed: true,
    createdAt: new Date(session.openingEnd * 1000).toISOString(), bias: 'BULLISH', biasScore: 65,
    entryZone: { low: high, high: entry }, entry, trigger: { type: 'CANDLE_CLOSE', operator: '>=', price: entry, timeframe: '15m' },
    stopLoss, tp1: target, tp2: null, riskReward1: reward / risk, riskReward2: null, signalScore: 65, blockers: [],
    targetMethod: overhead && overhead < entry * 1.04 ? 'nearest-daily-swing-high' : '4-percent-ceiling',
    reasons: [`DR ภาค${session.session === 'night' ? 'ค่ำ' : 'เช้า'} กรอบเปิดมูลค่า ${Math.round(tradedValue).toLocaleString()} บาท`,
      'รอแท่ง 15 นาทีปิดเหนือกรอบและ VWAP พร้อมมูลค่าซื้อขาย', 'ราคาเข้าเป็นเพียงราคาอ้างอิง ต้องตรวจ ask ก่อนซื้อ'],
    features: { ...base.features, orbHigh: high, orbLow: low, openingValue: tradedValue,
      minEntryBarValue: session.session === 'night' ? 200_000 : 100_000,
      maxChase,
      overheadResistance: overhead, nearestDailyHigh, dailyHistory: history } };
}

export function advanceDrOrbPick(pick, fifteenMinuteBars, quote, now = Date.now()) {
  const next = { ...pick };
  const events = [];
  const plan = pick.plan;
  if (plan?.setupType !== 'DR_ORB_15M' || !plan.tradeAllowed) return { pick: next, events };
  const bounds = { start: plan.features.openingStart, end: plan.features.sessionEnd };
  const bars = inSession(completedCandles(fifteenMinuteBars, '15m', now).sort((a, b) => a.time - b.time), bounds);
  const sessionLabel = plan.features.session === 'night' ? 'ภาคค่ำ' : 'ภาคเช้า';
  if (next.status === 'WAITING_FOR_ENTRY') {
    for (const bar of bars.filter(item => item.time >= plan.features.openingEnd && item.time > (next.lastChecked15m ?? 0))) {
      next.lastChecked15m = bar.time;
      if (bar.time >= plan.features.entryEnd) break;
      const closeAt = (bar.time + 900) * 1000;
      if (closeAt <= Date.parse(pick.publishedAt)) continue;
      if (now - closeAt > 20 * 60_000) { next.plan = { ...next.plan, monitoringIncomplete: true }; continue; }
      const vwap = sessionVwap(bars.filter(item => item.time <= bar.time));
      const value = bar.close * bar.volume;
      const risk = bar.close - plan.stopLoss;
      const reward = plan.tp1 - bar.close;
      const status = quote?.marketStatus?.toLowerCase();
      const quoteMatches = (plan.features.session === 'night' ? status === 'night' : status === 'day' || status === 'morning' || status?.startsWith('open'))
        && finite(quote.price) && Math.abs(quote.price - bar.close) / bar.close <= 0.005;
      next.plan = { ...next.plan, latestEntryCheck: { at: new Date(closeAt).toISOString(), price: bar.close, gates: [
        { label: 'ปิดเหนือจุดเข้า', passed: bar.close >= plan.entry }, { label: 'ไม่ไล่ราคา', passed: bar.close <= plan.features.maxChase },
        { label: 'เหนือ VWAP', passed: bar.close > vwap }, { label: 'มูลค่าซื้อขาย', passed: value >= plan.features.minEntryBarValue },
        { label: 'แท่งไม่แดง', passed: bar.close >= bar.open }, { label: 'R:R ≥ 1.5', passed: risk > 0 && reward / risk >= 1.5 },
        { label: 'quote ยืนยันภาคตลาด', passed: Boolean(quoteMatches) },
      ] } };
      if (!(bar.close >= plan.entry && bar.close <= plan.features.maxChase && bar.close > vwap
        && value >= plan.features.minEntryBarValue && bar.close >= bar.open && risk > 0 && reward / risk >= 1.5
        && quoteMatches)) continue;
      next.status = 'OPEN';
      next.entryPrice = bar.close;
      next.enteredAt = new Date(closeAt).toISOString();
      events.push(event('ENTRY', bar, bar.close,
        `15m DR ${sessionLabel} · ปิดเหนือกรอบ/VWAP · มูลค่าแท่ง ${Math.round(value).toLocaleString()} บาท · ราคาอ้างอิง ไม่ใช่ราคาเสนอขาย`));
      break;
    }
    if (next.status === 'WAITING_FOR_ENTRY' && now / 1000 >= plan.features.entryEnd) {
      const verified = !next.plan.monitoringIncomplete && ((next.lastChecked15m ?? 0) + 900) * 1000 >= plan.features.entryEnd * 1000;
      next.status = verified ? 'EXPIRED' : 'REVIEW';
      events.push(event(verified ? 'EXPIRED' : 'DATA_GAP', null, null, verified ? 'ตรวจถึงหมดเวลาแล้ว ไม่ครบเงื่อนไขเข้า' : 'ติดตามแท่งไม่ครบก่อนหมดเวลา ไม่สรุปว่าไม่เข้าเงื่อนไข'));
    }
  }
  if (next.status === 'OPEN') {
    const entered = Date.parse(next.enteredAt) / 1000;
    let last = next.lastChecked15m ?? plan.referenceCandles.fifteenMinuteTimestamp;
    for (const bar of bars.filter(item => item.time >= entered && item.time > last)) {
      if (bar.time - last > 1800) {
        next.status = 'REVIEW';
        events.push(event('DATA_GAP', bar, null, 'DR ไม่มีแท่งซื้อขายต่อเนื่อง ตรวจผลก่อนสรุป'));
        break;
      }
      const target = bar.high >= plan.tp1;
      const stop = bar.low <= plan.stopLoss;
      if (target && stop) {
        next.status = 'AMBIGUOUS';
        events.push(event('AMBIGUOUS', bar, null, 'แท่งเดียวแตะ TP และ SL ไม่ทราบลำดับ'));
      } else if (target || stop) {
        next.status = target ? 'TARGET' : 'STOP';
        next.exitPrice = target ? Math.max(bar.open, plan.tp1) : Math.min(bar.open, plan.stopLoss);
        next.exitedAt = new Date((bar.time + 900) * 1000).toISOString();
        events.push(event(target ? 'TARGET' : 'STOP', bar, next.exitPrice, 'แตะระดับตามแท่ง DR ไม่ใช่ราคา fill'));
      } else if (bar.time + 900 >= plan.features.sessionEnd) {
        next.status = 'EXIT';
        next.exitPrice = bar.close;
        next.exitedAt = new Date((bar.time + 900) * 1000).toISOString();
        events.push(event('EXIT', bar, bar.close, `จบ${sessionLabel} · ราคาปิดแท่งอ้างอิง`));
      }
      last = bar.time;
      next.lastChecked15m = last;
      if (next.status !== 'OPEN') break;
    }
    if (next.status === 'OPEN' && now / 1000 >= plan.features.sessionEnd) {
      next.status = 'REVIEW';
      events.push(event('SESSION_END', null, null, `จบ${sessionLabel}โดยไม่ทราบราคาออก ต้องตรวจด้วยมือ`));
    }
  }
  return { pick: next, events };
}
