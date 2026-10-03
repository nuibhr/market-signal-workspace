import { analyzeCandles } from '../analysis/technical.mjs';
import { atr14 } from '../analysis/chart-levels.mjs';

export const LAB_RULE_VERSION = 'us-orb15-5m-sandbox-v1';
import { aggregateMinutes, usClock } from '../analysis/us-candles.mjs';

function sessionVwap(bars) {
  let total = 0, value = 0;
  return bars.map(bar => {
    value += (bar.high + bar.low + bar.close) / 3 * bar.volume; total += bar.volume;
    return { time: bar.time, value: total > 0 ? value / total : null };
  }).filter(point => Number.isFinite(point.value));
}
function technical(bars, now) {
  const value = analyzeCandles(bars, null, '5 นาที', { timeframe: '5m', now });
  if (!value) return null;
  const day = usClock(bars.at(-1).time).day;
  value.vwapSeries = sessionVwap(bars.filter(bar => usClock(bar.time).day === day));
  return value;
}
const upCent = price => Math.ceil((price - 1e-9) * 100) / 100;
const downCent = price => Math.floor((price + 1e-9) * 100) / 100;

/** Every feature is computed only from the supplied prefix of CLOSED bars. */
export function evaluateLabPlan(symbol, bars, now = Date.now()) {
  const latest = bars.at(-1), previous = bars.at(-2);
  const base = { symbol, ruleVersion: LAB_RULE_VERSION, timeframe: '5m', signalEligible: false,
    status: 'WAIT', score: 0, entry: null, stop: null, target: null, checks: [], blockers: [],
    barTime: latest?.time ?? null, entryConfirmed: false };
  if (bars.length < 55) return { ...base, blockers: ['แท่งปิด 5 นาทีไม่พอ 55 แท่ง'] };
  const analysis = technical(bars, now), atr = atr14(bars);
  if (!analysis || !atr) return { ...base, blockers: ['อินดิเคเตอร์ยังไม่ครบ'] };
  const { day, minute } = usClock(latest.time);
  const session = bars.filter(bar => usClock(bar.time).day === day);
  const opening = session.filter(bar => usClock(bar.time).minute < 585);
  const contiguous = session.every((bar, i) => !i || bar.time - session[i - 1].time === 300);
  const openingComplete = opening.length === 3 && usClock(opening[0].time).minute === 570;
  const orbHigh = openingComplete ? Math.max(...opening.map(bar => bar.high)) : null;
  const vwap = analysis.vwapSeries.at(-1)?.value ?? null;
  const averageVolume = bars.slice(-21, -1).reduce((sum, bar) => sum + bar.volume, 0) / 20;
  const volumeRatio = averageVolume > 0 ? latest.volume / averageVolume : null;
  const trigger = orbHigh ? upCent(orbHigh + Math.max(0.01, atr * 0.05)) : null;
  const entry = latest.close;
  const swingLow = Math.min(...bars.slice(-10).map(bar => bar.low));
  const stop = downCent(Math.min(entry - atr * 1.2, swingLow - atr * 0.1));
  const risk = entry - stop, target = upCent(entry + 2 * risk);
  const overhead = bars.slice(-121, -1).map(bar => bar.high).filter(price => price > entry + atr * 0.1).sort((a, b) => a - b)[0] ?? null;
  const checks = [
    { label: 'แนวโน้มขึ้น', ok: entry > analysis.ema20 && analysis.ema20 > analysis.ema50, weight: 20 },
    { label: 'ปิดทะลุกรอบเปิดตลาด', ok: Boolean(trigger && previous.close <= trigger && entry > trigger && usClock(previous.time).day === day), weight: 25 },
    { label: 'ยืนเหนือ VWAP วันนี้', ok: Boolean(vwap && entry > vwap), weight: 15 },
    { label: 'Volume ยืนยัน', ok: volumeRatio >= 1.2, weight: 15 },
    { label: 'RSI ไม่ร้อนเกินไป', ok: analysis.rsi14 >= 50 && analysis.rsi14 <= 75, weight: 10 },
    { label: 'มีระยะทำกำไร 2R', ok: stop > 0 && risk > 0 && risk / atr <= 2.5 && risk / entry <= 0.02 && (!overhead || overhead >= target), weight: 15 },
  ];
  const blockers = checks.filter(check => !check.ok).map(check => check.label);
  if (entry < 50) blockers.push('รุ่นทดลองรับหุ้นราคาตั้งแต่ $50');
  if (!openingComplete || !contiguous) blockers.push('ข้อมูลช่วงเปิดตลาดไม่ครบหรือมีช่องว่าง');
  if (minute < 585 || minute > 925) blockers.push('อยู่นอกช่วงยืนยัน 09:45–15:25 นิวยอร์ก');
  const confirmed = blockers.length === 0;
  const age = (now / 1000 - latest.time - 300) / 60;
  const current = usClock(Math.floor(now / 1000));
  const recent = current.day === day && current.minute >= 585 && current.minute < 960 && age >= 0 && age <= 20;
  return { ...base, status: confirmed ? recent ? 'MATCH' : 'HISTORICAL_MATCH' : 'WAIT',
    entryConfirmed: confirmed, recent, score: checks.reduce((sum, check) => sum + (check.ok ? check.weight : 0), 0),
    entry, stop, target, riskReward: risk > 0 ? (target - entry) / risk : null, checks, blockers,
    trigger, orbHigh, vwap, atr, rsi: analysis.rsi14, volumeRatio, overhead, barAgeMinutes: Math.max(0, age),
    summary: confirmed ? 'แท่งปิดยืนยันครบ · จุดเข้าอ้างอิงราคาปิด · เป้าคำนวณ 2R'
      : `รอ ${blockers.slice(0, 2).join(' และ ')} · ${checks.filter(check => check.ok).length}/${checks.length} เงื่อนไข`,
    speech: confirmed ? `ผลทดลองแซนด์บ็อกซ์ ${symbol} แท่งปิดเข้าเงื่อนไขแล้ว ราคา ${entry.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ดอลลาร์ เป้าหมาย ${target.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ตัดขาดทุน ${stop.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null };
}

/** Local replay only. No customer signal ledger, no look-ahead or invented fills. */
export function replayLab(symbol, bars, now = Date.now()) {
  const trades = [], usedDays = new Set();
  let open = null;
  for (let i = 54; i < bars.length; i += 1) {
    const bar = bars[i], day = usClock(bar.time).day, minute = usClock(bar.time).minute;
    if (open) {
      const stopHit = bar.low <= open.stop, targetHit = bar.high >= open.target;
      let status = null, exit = null;
      // Never infer an intrabar path or fabricate execution through missing minutes.
      if (day !== open.day || bar.time - bars[i - 1].time !== 300) status = 'DATA_GAP';
      else if (bar.open <= open.stop) { status = 'STOP'; exit = bar.open; }
      else if (bar.open >= open.target) { status = 'TARGET'; exit = bar.open; }
      else if (stopHit && targetHit) status = 'AMBIGUOUS';
      else if (stopHit || targetHit) { status = stopHit ? 'STOP' : 'TARGET'; exit = stopHit ? open.stop : open.target; }
      else if (minute >= 950) { status = 'TIME_EXIT'; exit = bar.close; }
      if (status) {
        trades.push({ ...open, status, exit, exitTime: bar.time,
          returnPercent: exit === null ? null : (exit - open.entry) / open.entry * 100 });
        open = null;
      }
    }
    if (!open && !usedDays.has(day) && minute >= 585 && minute <= 925) {
      const plan = evaluateLabPlan(symbol, bars.slice(0, i + 1), now);
      if (plan.entryConfirmed) {
        usedDays.add(day);
        open = { symbol, day, entry: plan.entry, stop: plan.stop, target: plan.target, entryTime: bar.time };
      }
    }
  }
  if (open) trades.push({ ...open, status: 'OPEN', exit: null, exitTime: null, returnPercent: null });
  const resolved = trades.filter(trade => Number.isFinite(trade.returnPercent));
  const wins = resolved.filter(trade => trade.returnPercent > 0).length;
  return { trades: trades.slice(-100), entries: trades.length, resolved: resolved.length, wins,
    losses: resolved.filter(trade => trade.returnPercent < 0).length,
    unresolved: trades.length - resolved.length, winRate: resolved.length ? wins / resolved.length * 100 : null,
    sampleStart: bars[0]?.time ?? null, sampleEnd: bars.at(-1)?.time ?? null, feesIncluded: false, source: 'sandbox-replay' };
}

export function labEvaluation(symbol, minutes, now = Date.now()) {
  const bars = aggregateMinutes(minutes, 5);
  const plan = evaluateLabPlan(symbol, bars, now);
  return { plan, replay: replayLab(symbol, bars, now), fiveMinuteCount: bars.length };
}
