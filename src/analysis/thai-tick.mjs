// SET equity tick table: https://www.set.or.th/en/market/information/trading-procedure/price-bands-and-tick-sizes
import { TRADE_PLAN_CONFIG } from './trade-plan.mjs';
const finite = value => typeof value === 'number' && Number.isFinite(value) && value > 0;

export function thaiEquityTick(price) {
  if (!finite(price)) return null;
  if (price < 2) return 0.01;
  if (price < 5) return 0.02;
  if (price < 10) return 0.05;
  if (price < 25) return 0.1;
  if (price < 100) return 0.25;
  if (price < 200) return 0.5;
  if (price < 400) return 1;
  return 2;
}

function roundTick(price, direction) {
  if (!finite(price)) return null;
  const tick = thaiEquityTick(price);
  const units = price / tick;
  const rounded = direction === 'up' ? Math.ceil(units - 1e-9) * tick : Math.floor(units + 1e-9) * tick;
  return Number(rounded.toFixed(2));
}

/** Conservative rounding: entry/stop move against reward; target moves toward entry. */
export function normalizeThaiTradePlan(plan) {
  if (!plan?.tradeAllowed || !finite(plan.entry) || !finite(plan.stopLoss) || !finite(plan.tp1)) return plan;
  const long = plan.side === 'LONG';
  const entry = roundTick(plan.entry, long ? 'up' : 'down');
  const stopLoss = roundTick(plan.stopLoss, long ? 'down' : 'up');
  const tp1 = roundTick(plan.tp1, long ? 'down' : 'up');
  const tp2 = finite(plan.tp2) ? roundTick(plan.tp2, long ? 'down' : 'up') : null;
  const risk = Math.abs(entry - stopLoss);
  const reward1 = long ? tp1 - entry : entry - tp1;
  const reward2 = tp2 === null ? null : long ? tp2 - entry : entry - tp2;
  const riskReward1 = risk > 0 ? reward1 / risk : null;
  const riskReward2 = risk > 0 && reward2 !== null ? reward2 / risk : null;
  const atr = plan.features?.atr14;
  const stopATR = atr > 0 ? risk / atr : null;
  const roomATR = atr > 0 ? reward1 / atr : null;
  const valid = risk > 0 && reward1 > 0 && riskReward1 >= TRADE_PLAN_CONFIG.minRiskReward
    && roomATR >= TRADE_PLAN_CONFIG.minRoomATR && stopATR <= TRADE_PLAN_CONFIG.maxStopATR;
  return {
    ...plan,
    id: `${plan.id}:set-tick-v1`,
    ruleVersion: `${plan.ruleVersion}/set-tick-v1`,
    entryZone: plan.entryZone ? { low: roundTick(plan.entryZone.low, 'down'), high: roundTick(plan.entryZone.high, 'up') } : null,
    entry, trigger: { ...plan.trigger, price: entry }, stopLoss, tp1, tp2,
    riskReward1, riskReward2, roomATR, stopDistanceATR: stopATR,
    features: plan.features ? { ...plan.features, entryToTPATR: roomATR,
      entryToSLATR: stopATR, riskReward: riskReward1 } : null,
    reasons: [...(plan.reasons ?? []).filter(reason => !reason.startsWith('แนวถัดไปให้ R:R')),
      `หลังปรับตาม tick SET: R:R ${riskReward1?.toFixed(2) ?? '—'}`],
    tradeAllowed: valid,
    status: valid ? plan.status : 'WAIT', classification: valid ? plan.classification : 'WAIT',
    blockers: valid ? plan.blockers : [...(plan.blockers ?? []), 'หลังปรับ tick SET ระยะ TP1 หรือ SL ไม่ผ่าน R:R / ATR ที่กำหนด'],
  };
}
