import { SET100_SYMBOLS } from '../markets/catalog.mjs';
import { buildTradePlan } from '../analysis/trade-plan.mjs';
import { normalizeThaiTradePlan } from '../analysis/thai-tick.mjs';
import { completedCandles } from '../analysis/pivots.mjs';
import { createSettradeClient } from '../market-data/settrade.mjs';
import { advancePick, bangkokParts, thaiSession } from './engine.mjs';
import { activeSignals, claimRun, createSignal, finishRun, recordDecision, saveAdvance, signalForSession } from './store.mjs';

const client = createSettradeClient();
const DEFAULT_THAI = ['PTT', 'AOT', 'CPALL', 'ADVANC', 'KBANK', 'SCB', 'DELTA', 'GULF'];

export function thaiScanSymbols() {
  const requested = process.env.AUTO_PICK_THAI_SYMBOLS?.split(',').map(value => value.trim().toUpperCase()).filter(Boolean) ?? DEFAULT_THAI;
  const allowed = new Set(SET100_SYMBOLS);
  return [...new Set(requested)].filter(symbol => allowed.has(symbol)).slice(0, 8);
}

export function autoPickReadiness() {
  const production = process.env.NODE_ENV === 'production';
  const storageReady = !production || process.env.AUTO_PICK_PERSISTENT_SERVER_CONFIRMED === 'true';
  const thaiReady = process.env.AUTO_PICK_ENABLED === 'true' && storageReady && client.configuration.configured
    && (!production || process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED === 'true');
  return {
    enabled: thaiReady,
    markets: [
      { id: 'thai', label: 'หุ้นไทย · ภาคเช้า', status: thaiReady ? 'active' : 'blocked',
        reason: thaiReady ? null : !storageReady ? 'ต้องใช้เซิร์ฟเวอร์และฐานข้อมูลถาวร' : !client.configuration.configured ? 'ยังไม่ได้ตั้งค่าฟีด Settrade'
          : production && process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED !== 'true' ? 'ยังไม่ยืนยันสิทธิแสดงข้อมูล' : 'ยังไม่เปิด AUTO_PICK_ENABLED',
        universe: thaiScanSymbols(), source: 'Settrade OHLC 15m/1h/4h/1d' },
      { id: 'tfex', label: 'TFEX', status: 'blocked', reason: 'ยังไม่มีแท่งย้อนหลังและเวลาราคาจากต้นทางที่ตรวจสอบได้ รวมทั้งการเลือกสัญญาปัจจุบัน', source: 'TFEX Open API' },
      { id: 'forex', label: 'Forex · 19 สินค้า', status: 'blocked', reason: 'ต้องมีฟีดแท่งและราคา bid/ask จากโบรกเกอร์พร้อมสิทธิใช้งาน', source: 'ยังไม่พร้อม' },
      { id: 'us', label: 'Nasdaq-100 · ภาคค่ำ', status: 'blocked', reason: 'ยังไม่มีฟีด intraday และรายชื่อองค์ประกอบ Nasdaq-100 ปัจจุบันที่ยืนยันได้', source: 'FMP 1D เท่านั้น' },
    ],
  };
}

function requireReady() {
  const readiness = autoPickReadiness();
  if (!readiness.enabled) throw new Error('AUTO_PICK_NOT_READY');
  if (!process.env.AUTO_PICK_RUN_SECRET || process.env.AUTO_PICK_RUN_SECRET.length < 32) throw new Error('AUTO_PICK_SECRET_MISSING');
  return readiness;
}

function latestCurrentQuarter(series, now, day) {
  const closed = completedCandles(series.bars, '15m', now);
  const latest = closed.at(-1);
  return latest && bangkokParts(latest.time * 1000).day === day && now - (latest.time + 900) * 1000 < 45 * 60_000;
}

export async function runThaiAutoPick(now = Date.now()) {
  requireReady();
  const session = thaiSession(now);
  if (!session.monitorWindow) return { status: 'outside-session', day: session.day };
  const slot = new Date(Math.floor(now / 900_000) * 900_000).toISOString();
  const runId = claimRun('thai', slot);
  if (!runId) return { status: 'already-run', slot };
  let scanned = 0;
  let candidates = 0;
  const errors = [];
  try {
    await client.login();
    for (const pick of activeSignals('thai')) {
      try {
        const [oneHour, fifteen] = await Promise.all([client.getCandles(pick.symbol, '1h'), client.getCandles(pick.symbol, '15m')]);
        const advanced = advancePick(pick, oneHour.bars, fifteen.bars, now);
        if (advanced.events.length || advanced.pick.lastChecked15m !== pick.lastChecked15m) saveAdvance(advanced.pick, advanced.events);
      } catch { errors.push(`${pick.symbol}:MONITOR_SOURCE_UNAVAILABLE`); }
    }
    if (session.candidateWindow) {
      for (const symbol of thaiScanSymbols()) {
        if (signalForSession('thai', symbol, session.day)) continue;
        scanned += 1;
        try {
          const [fifteen, oneHour, fourHour, daily] = await Promise.all([
            client.getCandles(symbol, '15m'), client.getCandles(symbol, '1h'),
            client.getCandles(symbol, '4h'), client.getCandles(symbol, '1d'),
          ]);
          if (!latestCurrentQuarter(fifteen, now, session.day)) {
            recordDecision(runId, symbol, null, 'NO_CURRENT_SESSION_CANDLE');
            continue;
          }
          const plan = normalizeThaiTradePlan(buildTradePlan({ symbol, instrumentId: `SET100:${symbol}`, dailyBars: daily.bars,
            fourHourBars: fourHour.bars, oneHourBars: oneHour.bars, now, allowShort: false }));
          recordDecision(runId, symbol, plan);
          if (plan.tradeAllowed) {
            candidates += 1;
            createSignal({ market: 'thai', symbol, sessionDay: session.day, plan, source: daily.source });
          }
        } catch {
          recordDecision(runId, symbol, null, 'SOURCE_UNAVAILABLE');
          errors.push(`${symbol}:SOURCE_UNAVAILABLE`);
        }
      }
    }
    finishRun(runId, { scanned, candidates, errorCode: errors.length ? 'PARTIAL_SOURCE_UNAVAILABLE' : null });
    return { status: errors.length ? 'partial' : 'complete', slot, scanned, candidates, errors };
  } catch {
    finishRun(runId, { scanned, candidates, errorCode: 'SOURCE_UNAVAILABLE' });
    return { status: 'unavailable', slot, scanned, candidates, code: 'SOURCE_UNAVAILABLE' };
  }
}
