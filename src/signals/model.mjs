import { createHash } from 'node:crypto';
import { analyzeCandles } from '../analysis/technical.mjs';
import { atr14 } from '../analysis/chart-levels.mjs';
import { thaiEquityTick } from '../analysis/thai-tick.mjs';
import { buildSwingResearchPlan, netRForExit } from '../analysis/swing-standard.mjs';
import { buildSwingEntries, confirmedSwings, RESEARCH_ENTRY_RULES } from '../backtest/swing-replay.mjs';
import { candleClosedAt } from '../market-data/delayed-candles.mjs';
import { newYorkParts } from '../market-data/fmp-us.mjs';

export const SIGNAL_RULE = 'swing-standard-forward-v1';
export const ACTIVE_SIGNAL_STATES = ['WAITING', 'OPEN', 'RUNNER'];
export const signalId = value => createHash('sha256').update(value).digest('hex');
const iso = seconds => new Date(seconds * 1000).toISOString();
const finite = value => typeof value === 'number' && Number.isFinite(value);
export const closedAvailable = (bars, frame, market, now) => bars.filter(bar => candleClosedAt(bar, frame, market) + 900000 <= now);
export function tickPrice(price, market, up = false) {
  const tick = market === 'us' ? price < 1 ? 0.0001 : 0.01 : thaiEquityTick(price);
  return Number(((up ? Math.ceil : Math.floor)(price / tick + (up ? -1e-9 : 1e-9)) * tick).toFixed(6));
}
export function signalPlan(context, entry, costs) {
  const stop = tickPrice(context.swingLow - context.atr, context.market);
  // Round each price at its own tier, including targets crossing a SET band.
  const plan = buildSwingResearchPlan({ entry, swingLow: context.swingLow, atr: context.atr,
    market: context.market, tickSize: 0.000001, costs });
  if (!plan.researchEligible) return plan;
  plan.stopLoss = stop;
  plan.stopPercent = (plan.estimatedEntryFill - stop) / plan.estimatedEntryFill * 100;
  if (!(stop > 0 && stop < plan.estimatedEntryFill) || plan.stopPercent > 8) return { code: 'STRUCTURAL_STOP_EXCEEDS_8_PERCENT' };
  const exitFactor = (1 - plan.friction.slip) * (1 - plan.friction.fee);
  plan.netRiskPerUnit = plan.entryBasis - stop * exitFactor;
  const atR = multiple => tickPrice((plan.entryBasis + multiple * plan.netRiskPerUnit) / exitFactor, context.market, true);
  plan.minimumTarget = atR(2); plan.targets = [{ price: plan.minimumTarget, netR: 2, fraction: 0.5 }]; plan.breakEvenStop = atR(0);
  const resistance = context.resistanceLevels.filter(price => price > entry).sort((a, b) => a - b)[0] ?? null;
  plan.roomNetR=resistance?(resistance*exitFactor-plan.entryBasis)/plan.netRiskPerUnit:null;
  if (resistance && resistance < plan.minimumTarget) return { ...plan,signalEligible:false,code: 'RESISTANCE_BEFORE_MINIMUM_NET_REWARD' };
  return { ...plan, signalEligible: true, liveEligible: false, tradeAllowed: false,
    status: 'reference-signal', ruleVersion: SIGNAL_RULE, nearestResistance: resistance };
}

export function inspectSignalBars(asset, dailyInput, fourInput, now = Date.now()) {
  const daily = closedAvailable(dailyInput, '1d', asset.id, now), four = closedAvailable(fourInput, '4h', asset.id, now);
  const base = { market: asset.id, symbol: asset.symbol, name: asset.name, instrumentId: asset.instrumentId,
    kind: asset.sectionId === 'US_ETFS' ? 'etf' : 'stock', checkedAt: new Date(now).toISOString(), ruleVersion: SIGNAL_RULE };
  if (daily.length < 55 || four.length < 55) return { ...base, status: 'UNAVAILABLE', code: 'D1_4H_55_BARS_REQUIRED' };
  const d = analyzeCandles(daily, null, '1D', { timeframe: '1d', now }), h = analyzeCandles(four, null, '4H', { timeframe: '4h', now });
  const current = four.at(-1), prior = four.at(-2), atr = atr14(four), swings = confirmedSwings(four), daySwings = confirmedSwings(daily);
  const minuteOf = seconds => {
    if(asset.id==='us')return newYorkParts(seconds*1000).minutes;
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(seconds*1000)).map(p=>[p.type,p.value]));
    return Number(p.hour)*60+Number(p.minute);
  };
  // Native 4H anchors can shift within a market session. Compare broad local
  // session phases rather than requiring an identical request-aligned hour.
  const phase=seconds=>asset.id==='us'?minuteOf(seconds):Math.floor(minuteOf(seconds)/360);
  const slot=phase(current.time),comparable=four.slice(0,-1).filter(b=>phase(b.time)===slot).slice(-20);
  const relative = comparable.length>=5?comparable.reduce((sum,bar)=>sum+bar.volume,0)/comparable.length:null;
  const entries = Object.fromEntries(['breakout', 'pullback'].map(mode => [mode, buildSwingEntries({ daily, fourHour: four.slice(-150), market: asset.id, mode, rules: RESEARCH_ENTRY_RULES }).signals.some(s => s.signalTime === current.time)]));
  const stale = now - candleClosedAt(current, '4h', asset.id) > 4 * 86400000 || now - candleClosedAt(daily.at(-1), '1d', asset.id) > 8 * 86400000;
  return { ...base, status: stale ? 'UNAVAILABLE' : 'AVAILABLE', code: stale ? 'STALE_BARS' : null,
    price: current.close, changePercent: (current.close - prior.close) / prior.close * 100, changeBasis: '4h-close-to-previous-4h',
    dailyChangePercent: (daily.at(-1).close / daily.at(-2).close - 1) * 100,
    priceAt: iso(candleClosedAt(current, '4h', asset.id) / 1000), latest4hTime: current.time,
    dailyDay: daily.at(-1).time, atr, atrPercent: atr / current.close * 100, volume: current.volume,
    relativeVolume: relative > 0 ? current.volume / relative : null, relativeVolumeSamples:comparable.length, rsiD1: d.rsi14, rsi4h: h.rsi14,
    trendD1: d.trend, trend4h: h.trend, support: swings.lows.at(-1) ?? h.support,
    resistance: daySwings.highs.filter(price => price > current.close).sort((a, b) => a - b)[0] ?? null,
    swingLow: swings.lows.at(-1) ?? null, resistanceLevels: daySwings.highs,
    trigger: { breakout: Math.max(...four.slice(-21, -1).map(b => b.high)), pullback: h.ema20 },
    matched: entries, source: asset.signalSource || 'native OHLCV', minimumDelayMinutes: 15 };
}
export function candidateViews(snapshot, costs) {
  return ['breakout', 'pullback'].map(mode => {
    const row = { ...snapshot, mode, state: 'WAIT', reasons: [] };
    if (snapshot.status !== 'AVAILABLE') return { ...row, state: 'UNAVAILABLE', reasons: [snapshot.code || 'SOURCE_UNAVAILABLE'] };
    if (!costs) return { ...row, reasons: ['COSTS_REQUIRED'] };
    if (!snapshot.swingLow || !snapshot.atr) return { ...row, state: 'REJECT', reasons: ['CONFIRMED_SWING_REQUIRED'] };
    const plan = signalPlan(snapshot, snapshot.price, costs);
    if (!plan.signalEligible) return { ...row, plan:plan.friction?plan:null, proposedStop:tickPrice(snapshot.swingLow-snapshot.atr,snapshot.market),state: 'REJECT', reasons: [plan.code] };
    row.plan = plan;
    if (snapshot.trendD1 !== 'up') row.reasons.push('D1_TREND_NOT_UP');
    if (!snapshot.matched[mode]) row.reasons.push(mode === 'breakout' ? 'WAIT_4H_BREAKOUT_CLOSE' : 'WAIT_4H_PULLBACK_CLOSE');
    if (!(snapshot.relativeVolume >= 1)) row.reasons.push('RELATIVE_VOLUME_BELOW_1');
    row.state = row.reasons.length ? 'WAIT' : 'PASS';
    return row;
  });
}
export function startReferenceSignal(view, profile, now) {
  const publishedAt = new Date(now).toISOString();
  return { id: signalId(`${SIGNAL_RULE}:${view.instrumentId}:${view.mode}:${profile}:${view.latest4hTime}`),
    ruleVersion: SIGNAL_RULE, market: view.market, symbol: view.symbol, name: view.name, mode: view.mode, profile,
    status: 'WAITING', publishedAt, updatedAt: publishedAt, expiresAt: new Date(now + 86400000).toISOString(),
    context: view, plan: view.plan, originalPlan: view.plan, stop: view.plan.stopLoss, stopState: 'INITIAL',
    remainingFraction: 1, fills: [], lastBar: null, latestPrice: view.price, latestPriceAt: view.priceAt,
    entryPrice: null, enteredAt: null, exitedAt: null, nearStopKey: null, referenceOnly: true };
}

// Expected regular-session slots between two observations. Missing overnight,
// lunch or weekend bars are not holes. No invented fill is made across a hole.
export function continuousSessionSlot(seconds, market) {
  if (market === 'us') { const c = newYorkParts(seconds * 1000); return !['Sat','Sun'].includes(c.weekday) && c.minutes >= 570 && c.minutes < 960; }
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(seconds * 1000));
  const c = Object.fromEntries(parts.map(part => [part.type, part.value])), minute = Number(c.hour) * 60 + Number(c.minute);
  return !['Sat','Sun'].includes(c.weekday) && (minute >= 600 && minute < 750 || minute >= 840 && minute < 990 || market === 'dr' && minute >= 1140)
    || market === 'dr' && !['Sun','Mon'].includes(c.weekday) && minute < 180;
}
export function advanceReferenceSignal(original, barsInput, snapshot, now = Date.now()) {
  const signal = structuredClone(original), events = [], bars = closedAvailable(barsInput, '15m', signal.market, now);
  const emit = (type, bar, price, detail) => events.push({ type, barTime: bar?.time ?? null, price,
    createdAt: new Date(now).toISOString(), priceAt: bar ? iso(bar.time + 900) : null, detail });
  const finish = (bar, price, fraction, reason) => {
    const netR = netRForExit(signal.plan, price);
    signal.fills.push({ barTime: bar.time, price, fraction, netR, reason });
    signal.remainingFraction = Math.max(0, signal.remainingFraction - fraction);
    if (signal.remainingFraction < 1e-8) {
      signal.status = reason === 'STOP' && signal.fills.length === 1 ? 'STOP' : 'CLOSED'; signal.exitedAt = iso(bar.time + 900);
      signal.netR = signal.fills.reduce((sum, fill) => sum + fill.fraction * fill.netR, 0);
      signal.returnPercent = signal.netR * signal.plan.netRiskPerUnit / signal.plan.entryBasis * 100;
    }
  };
  if (!ACTIVE_SIGNAL_STATES.includes(signal.status)) return { signal, events };
  const published = Date.parse(signal.publishedAt) / 1000;
  for (const bar of bars.filter(b => b.time >= published && (signal.lastBar === null || b.time > signal.lastBar))) {
    const previousBar = signal.lastBar ?? Math.ceil(published / 900) * 900 - 900;
    if (bar.time > previousBar + 900) {
      let missing = false;
      for (let t = previousBar + 900; t < bar.time; t += 900) if (continuousSessionSlot(t, signal.market)) { missing = true; break; }
      if (missing) { signal.status = 'REVIEW'; emit('DATA_GAP', bar, null, 'แท่งติดตามขาดช่วง ไม่สรุป fill ข้ามช่องว่าง'); break; }
    }
    signal.lastBar = bar.time; signal.latestPrice = bar.close; signal.latestPriceAt = iso(bar.time + 900);
    // Empty provider buckets carry a reference close but prove no trade at
    // entry/stop/target. They may occur during lunch or on illiquid listings.
    if (!(bar.volume > 0)) continue;
    if (signal.status === 'WAITING') {
      if ((bar.time + 900) * 1000 > Date.parse(signal.expiresAt)) { signal.status = 'EXPIRED'; emit('EXPIRED', bar, null, 'พ้นเวลารอยืนยัน 24 ชั่วโมง'); break; }
      if (bar.low <= signal.stop) { signal.status = 'EXPIRED'; emit('EXPIRED', bar, bar.low, 'หลุดโครงสร้างก่อนยืนยันเข้า'); break; }
      if (bar.close < signal.plan.entry || bar.close < bar.open) continue;
      if (now - (bar.time + 900) * 1000 > 45 * 60000) { signal.status = 'EXPIRED'; emit('EXPIRED', bar, bar.close, 'พบแท่งเข้าช้า ไม่ประกาศ entry ย้อนหลัง'); break; }
      if (bar.close - signal.plan.entry > signal.context.atr * 0.5) continue;
      const plan = signalPlan(signal.context, bar.close, signal.plan.friction.assumptions);
      if (!plan.signalEligible) continue;
      signal.plan = plan; signal.stop = plan.stopLoss; signal.entryPrice = bar.close; signal.enteredAt = iso(bar.time + 900);
      signal.confirmedAt = new Date(now).toISOString(); signal.status = 'OPEN';
      emit('ENTRY', bar, bar.close, 'ราคาอ้างอิงแท่งปิด 15m หลังเผยแพร่แผน ไม่ใช่ broker fill'); continue;
    }
    if (signal.status === 'RUNNER' && snapshot.status === 'AVAILABLE' && snapshot.swingLow && snapshot.atr &&
      candleClosedAt({ time: snapshot.latest4hTime }, '4h', signal.market) + 900000 <= bar.time * 1000) {
      const trail = tickPrice(snapshot.swingLow - snapshot.atr, signal.market);
      if (trail > signal.stop) { signal.stop = trail; signal.stopState = 'TRAIL'; emit('STOP_MOVED', bar, trail, 'เลื่อนตาม confirmed support − ATR ของ 4H ที่พร้อมก่อนแท่งนี้'); }
    }
    const target = signal.plan.targets[0].price, targetHit = signal.status === 'OPEN' && bar.high >= target, stopHit = bar.low <= signal.stop;
    if (targetHit && stopHit && bar.open > signal.stop && bar.open < target) { signal.status = 'REVIEW'; emit('AMBIGUOUS', bar, null, 'แท่งเดียวแตะ Stop/TP ไม่ทราบลำดับ ไม่นับผลชนะ'); break; }
    if (targetHit && bar.open >= target) {
      finish(bar, target, 0.5, 'TP1'); signal.status = 'RUNNER'; signal.stop = signal.plan.breakEvenStop; signal.stopState = 'BREAKEVEN';
      emit('TARGET', bar, target, 'TP1 2R สุทธิ 50% แล้วเลื่อน stop ของส่วนที่เหลือเป็นจุดคุ้มทุนรวมต้นทุน');
      if (bar.low <= signal.stop) { finish(bar, signal.stop, signal.remainingFraction, 'BREAKEVEN'); emit('EXIT', bar, signal.stop, 'ส่วนที่เหลือแตะจุดคุ้มทุน'); }
    } else if (stopHit) {
      const exit = Math.min(bar.open, signal.stop), fraction = signal.remainingFraction;
      finish(bar, exit, fraction, 'STOP'); emit(signal.status === 'STOP' ? 'STOP' : 'EXIT', bar, exit, 'แตะ stop อ้างอิง; gap ใช้ open ที่เสียเปรียบ');
    } else if (targetHit) {
      finish(bar, target, 0.5, 'TP1'); signal.status = 'RUNNER'; signal.stop = signal.plan.breakEvenStop; signal.stopState = 'BREAKEVEN';
      emit('TARGET', bar, target, 'ขายอ้างอิง 50% ที่ 2R สุทธิ เลื่อน stop คุ้มทุนรวมต้นทุน');
      if (bar.low <= signal.stop) { signal.status = 'REVIEW'; emit('AMBIGUOUS', bar, null, 'TP1 และ stop ใหม่อยู่ในแท่งเดียว ต้องตรวจลำดับ'); break; }
    }
    if (!ACTIVE_SIGNAL_STATES.includes(signal.status)) break;
    const distance = (bar.close - signal.stop) / signal.context.atr;
    if (distance > 0 && distance <= 0.5 && signal.nearStopKey !== String(signal.stop)) {
      signal.nearStopKey = String(signal.stop); emit('NEAR_STOP', bar, bar.close, 'ราคาอ้างอิงห่าง Stop ไม่เกิน 0.5 ATR');
    }
  }
  if (signal.status === 'WAITING' && now > Date.parse(signal.expiresAt)) { signal.status = 'EXPIRED'; emit('EXPIRED', null, null, 'พ้นเวลารอยืนยัน'); }
  signal.updatedAt = new Date(now).toISOString();
  return { signal, events };
}
export function summarizeSignals(records) {
  const closed = records.filter(s => ['STOP','CLOSED'].includes(s.status) && finite(s.netR)).sort((a,b) => a.exitedAt.localeCompare(b.exitedAt));
  let cumulative = 0, peak = 0, maxDrawdownR = 0;
  for (const s of closed) { cumulative += s.netR; peak = Math.max(peak, cumulative); maxDrawdownR = Math.max(maxDrawdownR, peak - cumulative); }
  const positive = closed.filter(s => s.netR > 0).reduce((sum,s) => sum+s.netR,0), negative = -closed.filter(s => s.netR < 0).reduce((sum,s) => sum+s.netR,0);
  return { closed: closed.length, wins: closed.filter(s=>s.netR>0).length, winRate: closed.length ? closed.filter(s=>s.netR>0).length/closed.length*100 : null,
    expectancyR: closed.length ? cumulative/closed.length : null, profitFactor: negative ? positive/negative : null,
    profitFactorBasis: 'equal-1R-per-signal', maxDrawdownR: closed.length ? maxDrawdownR : null,
    from: closed[0]?.enteredAt ?? null, to: closed.at(-1)?.exitedAt ?? null,
    review: records.filter(s=>s.status==='REVIEW').length, open: records.filter(s=>['OPEN','RUNNER'].includes(s.status)).length };
}
export function referenceMark(signal){
 if(!signal.entryPrice||!finite(signal.latestPrice))return {markNetR:null,markReturnPercent:null};
 const markNetR=signal.fills.reduce((sum,fill)=>sum+fill.fraction*fill.netR,0)+signal.remainingFraction*netRForExit(signal.plan,signal.latestPrice);
 return {markNetR,markReturnPercent:markNetR*signal.plan.netRiskPerUnit/signal.plan.entryBasis*100};
}
