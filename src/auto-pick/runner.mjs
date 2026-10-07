import { archiveCandles } from './history-store.mjs';
import { SET100_SYMBOLS, MAI_INITIAL_SYMBOLS, DR80_SYMBOLS, US_STOCKS } from '../markets/catalog.mjs';
import { US_SCAN_SYMBOLS, US_UNIVERSE_METADATA, usScanSlot } from '../markets/us-universe.mjs';
import { completedCandles } from '../analysis/pivots.mjs';
import { createSettradeClient } from '../market-data/settrade.mjs';
import { usEodSession } from '../market-data/fmp-us.mjs';
import { getUsDailyBars, usEodRights } from '../market-data/us-eod.mjs';
import { advancePick, bangkokParts, thaiSession } from './engine.mjs';
import { advanceThaiOrbPick, buildThaiOrbPlan, THAI_ORB_RULE_VERSION } from './thai-orb.mjs';
import { advanceDrOrbPick, buildDrOrbPlan, DR_ORB_RULE_VERSION, drSession } from './dr-orb.mjs';
import { advanceUsEodPick, buildUsEodPlan } from './us-engine.mjs';
import { activeSignals, claimRun, createSignal, finishRun, recordDecision, recordScanProgress, runForSlot, saveAdvance, scanCoverage, signalForSession } from './store.mjs';

let nextSourceRequestAt = 0;
const sourceClient = createSettradeClient({ fetcher: async (url, options) => {
  const scheduledAt = Math.max(Date.now(), nextSourceRequestAt);
  nextSourceRequestAt = scheduledAt + 400;
  if (scheduledAt > Date.now()) await new Promise(resolve => setTimeout(resolve, scheduledAt - Date.now()));
  const response = await fetch(url, options);
  if (response.status === 429) nextSourceRequestAt = Math.max(nextSourceRequestAt, Date.now() + 10_000);
  return response;
} });
const client = { ...sourceClient, async getCandles(...args) { const series = await sourceClient.getCandles(...args); (await archiveCandles(args[0], args[1] ?? '1d', series)); return series; } };
const SCAN_DAILY_BARS = 250;
const SCAN_INTRADAY_BARS = 120;
const SCAN_BUDGET_MS = 20_000;
const US_STOCK_SET = new Set(US_STOCKS.map(item => item.symbol));

export function drScanSymbols() {
  return [...new Set(DR80_SYMBOLS)];
}

export function thaiScanSymbols() {
  return [...new Set([...SET100_SYMBOLS, ...MAI_INITIAL_SYMBOLS])];
}

export function usScanSymbols() {
  return US_SCAN_SYMBOLS.filter(symbol => US_STOCK_SET.has(symbol));
}

export function autoPickReadiness() {
  const production = process.env.NODE_ENV === 'production';
  const storageReady = !production || process.env.AUTO_PICK_PERSISTENT_SERVER_CONFIRMED === 'true';
  const workerSecretReady = Boolean(process.env.AUTO_PICK_RUN_SECRET && process.env.AUTO_PICK_RUN_SECRET.length >= 32);
  const thaiReady = process.env.AUTO_PICK_ENABLED === 'true' && storageReady && client.configuration.configured
    && (!production || process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED === 'true') && workerSecretReady;
  const drReady = process.env.AUTO_PICK_DR_ENABLED === 'true' && storageReady && client.configuration.configured
    && drScanSymbols().length > 0 && (!production || process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED === 'true') && workerSecretReady;
  const usSymbols = usScanSymbols();
  const usRights = usEodRights();
  const usRightsReady = usRights.yahoo || usRights.fmp && Boolean(process.env.FMP_API_KEY?.trim());
  const usReady = process.env.AUTO_PICK_US_ENABLED === 'true' && storageReady
    && usRightsReady && usSymbols.length === US_SCAN_SYMBOLS.length && workerSecretReady;
  const usReason = !storageReady ? 'ต้องใช้เซิร์ฟเวอร์และฐานข้อมูลถาวร'
    : !usRightsReady ? 'ยังไม่ยืนยันสิทธิข้อมูล FMP หรือ Yahoo EOD สำหรับ production'
          : usSymbols.length !== US_SCAN_SYMBOLS.length ? `รายชื่อหุ้นในชุดสแกนยังไม่ครบ (${usSymbols.length}/${US_SCAN_SYMBOLS.length})`
            : process.env.AUTO_PICK_US_ENABLED !== 'true' ? 'ยังไม่เปิด AUTO_PICK_US_ENABLED'
              : !workerSecretReady ? 'ยังไม่ได้ตั้งค่า secret สำหรับ worker (อย่างน้อย 32 ตัวอักษร)' : null;
  return {
    enabled: thaiReady || drReady || usReady,
    markets: [
      { id: 'thai', label: 'หุ้นไทย · ภาคเช้า', status: thaiReady ? 'active' : 'blocked',
        reason: thaiReady ? null : !storageReady ? 'ต้องใช้เซิร์ฟเวอร์และฐานข้อมูลถาวร' : !client.configuration.configured ? 'ยังไม่ได้ตั้งค่าฟีด Settrade'
          : production && process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED !== 'true' ? 'ยังไม่ยืนยันสิทธิแสดงข้อมูล'
            : process.env.AUTO_PICK_ENABLED !== 'true' ? 'ยังไม่เปิด AUTO_PICK_ENABLED'
              : !workerSecretReady ? 'ยังไม่ได้ตั้งค่า secret สำหรับ worker (อย่างน้อย 32 ตัวอักษร)' : null,
        universe: thaiScanSymbols(), source: 'Settrade OHLC 15m/1d', timeframe: '15m',
        mode: 'SET100 + mai · กรอบเปิด + VWAP + มูลค่าซื้อขาย · เป้าไม่เกิน 4%' },
      { id: 'dr', label: 'DR · ภาคเช้าและค่ำ', status: drReady ? 'active' : 'blocked',
        reason: drReady ? null : !storageReady ? 'ต้องใช้เซิร์ฟเวอร์และฐานข้อมูลถาวร' : !client.configuration.configured ? 'ยังไม่ได้ตั้งค่าฟีด Settrade'
          : production && process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED !== 'true' ? 'ยังไม่ยืนยันสิทธิแสดงข้อมูล'
            : process.env.AUTO_PICK_DR_ENABLED !== 'true' ? 'ยังไม่เปิด AUTO_PICK_DR_ENABLED'
              : !workerSecretReady ? 'ยังไม่ได้ตั้งค่า secret สำหรับ worker' : 'ยังไม่มี DR ที่ยืนยันซื้อขายภาคค่ำ',
        universe: drScanSymbols(), source: 'Settrade DR OHLC 15m/1d · ราคาอ้างอิง ไม่มี bid/ask', timeframe: '15m',
        mode: 'DR ทุกตัวในรายการ · กลางคืนเฉพาะที่ quote ยืนยัน · ต้องตรวจ ask' },
      { id: 'tfex', label: 'TFEX', status: 'blocked', reason: 'กราฟและซีรีส์ Z พร้อมดู แต่ยังไม่เปิดสัญญาณก่อนยืนยันสัญญานำ สภาพคล่อง และกติกาความเสี่ยงแต่ละสินค้า', source: 'TFEX Open API · OHLC chart only' },
      { id: 'forex', label: 'Forex · 19 สินค้า', status: 'blocked', reason: 'ต้องมีฟีดแท่งและราคา bid/ask จากโบรกเกอร์พร้อมสิทธิใช้งาน', source: 'ยังไม่พร้อม' },
      { id: 'us', label: `หุ้นอเมริกา · ${usSymbols.length} ตัว`, status: usReady ? 'active' : 'blocked',
        reason: usReason, universe: usSymbols, source: 'หุ้นสภาพคล่องสูง 3 เดือน · FMP / Yahoo EOD 1D',
        timeframe: '1d', mode: 'สแกนหลังตลาดปิด · ยืนยัน ENTRY/TP/SL จากแท่งรายวัน', snapshotDate: US_UNIVERSE_METADATA.asOf },
    ],
  };
}

function requireReady(market = 'thai') {
  const readiness = autoPickReadiness();
  if (!readiness.markets.some(item => item.id === market && item.status === 'active')) throw new Error('AUTO_PICK_NOT_READY');
  if (!process.env.AUTO_PICK_RUN_SECRET || process.env.AUTO_PICK_RUN_SECRET.length < 32) throw new Error('AUTO_PICK_SECRET_MISSING');
  return readiness;
}

function latestCurrentQuarter(series, now, day) {
  const closed = completedCandles(series.bars, '15m', now);
  const latest = closed.at(-1);
  return latest && bangkokParts(latest.time * 1000).day === day && now - (latest.time + 900) * 1000 < 45 * 60_000;
}

const sourceDisposition = error => error?.status === 400 || error?.status === 404 ? 'unavailable' : 'retry';

async function settleMissingSessionData(market, key, symbols, reasons) {
  for (const item of (await scanCoverage(market, key, symbols)).unresolved) {
    if (reasons.includes(item.reason))
      (await recordScanProgress(market, key, item.symbol, 'ineligible', `${item.reason}_AT_CUTOFF`));
  }
}

export async function runThaiAutoPick(now = Date.now()) {
  requireReady('thai');
  const session = thaiSession(now);
  if (!session.monitorWindow) return { status: 'outside-session', day: session.day };
  if (!session.candidateWindow && session.minutes >= 675)
    (await settleMissingSessionData('thai', session.day, thaiScanSymbols(), ['NO_CURRENT_SESSION_CANDLE', 'OPENING_BAR_UNAVAILABLE']));
  const slot = `${new Date(Math.floor(now / 60_000) * 60_000).toISOString()}:${THAI_ORB_RULE_VERSION}`;
  const runId = (await claimRun('thai', slot));
  if (!runId) return { status: 'already-run', slot };
  let scanned = 0;
  let candidates = 0;
  const errors = [];
  try {
    await client.login();
    for (const pick of (await activeSignals('thai'))) {
      try {
        const fifteen = await client.getCandles(pick.symbol, '15m');
        const advanced = pick.plan?.setupType === 'OPENING_RANGE_BREAKOUT'
          ? advanceThaiOrbPick(pick, fifteen.bars, now)
          : advancePick(pick, (await client.getCandles(pick.symbol, '1h')).bars, fifteen.bars, now);
        if (advanced.events.length || advanced.pick.lastChecked15m !== pick.lastChecked15m) (await saveAdvance(advanced.pick, advanced.events));
      } catch { errors.push(`${pick.symbol}:MONITOR_SOURCE_UNAVAILABLE`); }
    }
    if (session.candidateWindow) {
      const deadline = Date.now() + SCAN_BUDGET_MS;
      const pending = (await scanCoverage('thai', session.day, thaiScanSymbols())).pending;
      for (const symbol of pending) {
        if (Date.now() >= deadline) break;
        if ((await signalForSession('thai', symbol, session.day))) {
          (await recordScanProgress('thai', session.day, symbol, 'done', 'SIGNAL_ALREADY_PUBLISHED'));
          continue;
        }
        scanned += 1;
        try {
          const fifteen = await client.getCandles(symbol, '15m', SCAN_INTRADAY_BARS);
          const daily = await client.getCandles(symbol, '1d', SCAN_DAILY_BARS);
          if (!latestCurrentQuarter(fifteen, now, session.day)) {
            (await recordDecision(runId, symbol, null, 'NO_CURRENT_SESSION_CANDLE'));
            (await recordScanProgress('thai', session.day, symbol, 'retry', 'NO_CURRENT_SESSION_CANDLE'));
            continue;
          }
          const plan = buildThaiOrbPlan({ symbol, instrumentId: `${SET100_SYMBOLS.includes(symbol) ? 'SET100' : 'MAI_INITIAL'}:${symbol}`,
            fifteenMinuteBars: fifteen.bars, dailyBars: daily.bars, now });
          (await recordDecision(runId, symbol, plan));
          (await recordScanProgress('thai', session.day, symbol,
            plan.code === 'OPENING_BAR_UNAVAILABLE' ? session.minutes >= 645 ? 'ineligible' : 'retry' : 'done', plan.code ?? null));
          if (plan.tradeAllowed) {
            candidates += 1;
            (await createSignal({ market: 'thai', symbol, sessionDay: session.day, plan, source: daily.source }));
          }
        } catch (error) {
          (await recordDecision(runId, symbol, null, 'SOURCE_UNAVAILABLE'));
          const disposition = sourceDisposition(error);
          (await recordScanProgress('thai', session.day, symbol, disposition, error?.status ? `SOURCE_HTTP_${error.status}` : 'SOURCE_UNAVAILABLE'));
          errors.push(`${symbol}:${disposition === 'retry' ? 'RETRY_SOURCE' : 'SOURCE_UNAVAILABLE'}`);
        }
      }
    }
    (await finishRun(runId, { scanned, candidates, errorCode: errors.length ? 'PARTIAL_SOURCE_UNAVAILABLE' : null }));
    return { status: errors.length ? 'partial' : 'complete', slot, scanned, candidates, errors };
  } catch {
    (await finishRun(runId, { scanned, candidates, errorCode: 'SOURCE_UNAVAILABLE' }));
    return { status: 'unavailable', slot, scanned, candidates, code: 'SOURCE_UNAVAILABLE' };
  }
}

export async function runDrAutoPick(now = Date.now()) {
  requireReady('dr');
  const session = drSession(now);
  if (!session.monitorWindow) return { status: 'outside-session', session: session.key };
  if (!session.candidateWindow || now / 1000 >= session.openingEnd + 3600)
    (await settleMissingSessionData('dr', session.key, drScanSymbols(), ['DR_SESSION_NOT_CONFIRMED', 'NO_FRESH_DR_CANDLE', 'OPENING_BAR_UNAVAILABLE']));
  const slot = `${new Date(Math.floor(now / 60_000) * 60_000).toISOString()}:${DR_ORB_RULE_VERSION}`;
  const runId = (await claimRun('dr', slot));
  if (!runId) return { status: 'already-run', slot };
  let scanned = 0;
  let candidates = 0;
  const errors = [];
  try {
    await client.login();
    for (const pick of (await activeSignals('dr'))) {
      try {
        const [fifteen, quote] = await Promise.all([client.getCandles(pick.symbol, '15m'), client.getQuote(pick.symbol)]);
        const advanced = advanceDrOrbPick(pick, fifteen.bars, quote, now);
        if (advanced.events.length || advanced.pick.lastChecked15m !== pick.lastChecked15m) (await saveAdvance(advanced.pick, advanced.events));
      } catch { errors.push(`${pick.symbol}:MONITOR_SOURCE_UNAVAILABLE`); }
    }
    if (session.candidateWindow) {
      const deadline = Date.now() + SCAN_BUDGET_MS;
      const pending = (await scanCoverage('dr', session.key, drScanSymbols())).pending;
      for (const symbol of pending) {
        if (Date.now() >= deadline) break;
        if ((await signalForSession('dr', symbol, session.key))) {
          (await recordScanProgress('dr', session.key, symbol, 'done', 'SIGNAL_ALREADY_PUBLISHED'));
          continue;
        }
        scanned += 1;
        try {
          const quote = await client.getQuote(symbol);
          const status = quote.marketStatus?.toLowerCase() ?? '';
          const sessionConfirmed = session.session === 'night' ? status === 'night'
            : status === 'day' || status === 'morning' || status.startsWith('open');
          if (!sessionConfirmed || quote.status !== 'available') {
            const disposition = now / 1000 >= session.openingEnd + 1800 ? 'ineligible' : 'retry';
            (await recordDecision(runId, symbol, null, 'DR_SESSION_NOT_CONFIRMED'));
            (await recordScanProgress('dr', session.key, symbol, disposition, 'DR_SESSION_NOT_CONFIRMED'));
            continue;
          }
          const fifteen = await client.getCandles(symbol, '15m', SCAN_INTRADAY_BARS);
          const daily = await client.getCandles(symbol, '1d', SCAN_DAILY_BARS);
          const latest = completedCandles(fifteen.bars, '15m', now).filter(bar => bar.time >= session.start && bar.time < session.end).at(-1);
          if (!latest || now - (latest.time + 900) * 1000 > 45 * 60_000) {
            (await recordDecision(runId, symbol, null, 'NO_FRESH_DR_CANDLE'));
            (await recordScanProgress('dr', session.key, symbol, now / 1000 >= session.openingEnd + 3600 ? 'ineligible' : 'retry', 'NO_FRESH_DR_CANDLE'));
            continue;
          }
          const plan = buildDrOrbPlan({ symbol, fifteenMinuteBars: fifteen.bars, dailyBars: daily.bars, session, now });
          (await recordDecision(runId, symbol, plan));
          (await recordScanProgress('dr', session.key, symbol,
            plan.code === 'OPENING_BAR_UNAVAILABLE'
              ? now / 1000 >= session.openingEnd + 3600 ? 'ineligible' : 'retry'
              : 'done', plan.code ?? null));
          if (plan.tradeAllowed) {
            candidates += 1;
            (await createSignal({ market: 'dr', symbol, sessionDay: session.key, plan, source: fifteen.source }));
          }
        } catch (error) {
          (await recordDecision(runId, symbol, null, 'SOURCE_UNAVAILABLE'));
          const disposition = sourceDisposition(error);
          (await recordScanProgress('dr', session.key, symbol, disposition, error?.status ? `SOURCE_HTTP_${error.status}` : 'SOURCE_UNAVAILABLE'));
          errors.push(`${symbol}:${disposition === 'retry' ? 'RETRY_SOURCE' : 'SOURCE_UNAVAILABLE'}`);
        }
      }
    }
    (await finishRun(runId, { scanned, candidates, errorCode: errors.length ? 'PARTIAL_SOURCE_UNAVAILABLE' : null }));
    return { status: errors.length ? 'partial' : 'complete', session: session.key, slot, scanned, candidates, errors };
  } catch {
    (await finishRun(runId, { scanned, candidates, errorCode: 'SOURCE_UNAVAILABLE' }));
    return { status: 'unavailable', session: session.key, slot, scanned, candidates, code: 'SOURCE_UNAVAILABLE' };
  }
}

export async function runUsAutoPick(now = Date.now()) {
  requireReady('us');
  const session = usEodSession(now);
  if (!session.scanWindow) return { status: 'outside-session', day: session.day };
  const scanSlot = usScanSlot(session.day);
  if ((await runForSlot('us', scanSlot))?.status === 'COMPLETE') return { status: 'already-run', day: session.day };

  let firstBars;
  try { firstBars = await getUsDailyBars('AAPL', { now }); }
  catch (error) {
    const slot = `${session.day}:wait:${Math.floor(now / 900_000)}`;
    const runId = (await claimRun('us', slot));
    if (runId) (await finishRun(runId, { errorCode: error?.code ?? 'SOURCE_UNAVAILABLE' }));
    return { status: 'unavailable', day: session.day, code: error?.code ?? 'SOURCE_UNAVAILABLE' };
  }
  (await archiveCandles('AAPL', '1d', firstBars));
  if (firstBars.latestDay !== session.day) {
    const slot = `${session.day}:wait:${Math.floor(now / 900_000)}`;
    const runId = (await claimRun('us', slot));
    if (runId) (await finishRun(runId, { errorCode: 'EOD_NOT_READY' }));
    return { status: 'waiting-eod', day: session.day, latestDay: firstBars.latestDay };
  }

  const runId = (await claimRun('us', scanSlot, { retryFailed: true }));
  if (!runId) return { status: 'already-run', day: session.day };
  let scanned = 0;
  let candidates = 0;
  const errors = [];
  const symbols = usScanSymbols();
  const barsBySymbol = new Map([['AAPL', firstBars]]);
  try {
    const active = (await activeSignals('us'));
    const activeSymbols = new Set(active.map(pick => pick.symbol));
    // Monitor existing plans before spending the bounded budget on new candidates.
    for (const pick of active) {
      try {
        const series = barsBySymbol.get(pick.symbol) ?? await getUsDailyBars(pick.symbol, { now });
        barsBySymbol.set(pick.symbol, series);
        (await archiveCandles(pick.symbol, '1d', series));
        const advanced = advanceUsEodPick(pick, series.bars);
        if (advanced.events.length || advanced.pick.lastChecked15m !== pick.lastChecked15m || advanced.pick.status !== pick.status)
          (await saveAdvance(advanced.pick, advanced.events));
      } catch (error) { errors.push(`${pick.symbol}:MONITOR_${error?.code ?? 'SOURCE_UNAVAILABLE'}`); }
    }
    const deadline = Date.now() + SCAN_BUDGET_MS;
    let published = 0;
    for (const symbol of (await scanCoverage('us', scanSlot, symbols)).pending) {
      if (Date.now() >= deadline) break;
      scanned += 1;
      try {
        const series = barsBySymbol.get(symbol) ?? await getUsDailyBars(symbol, { now });
        barsBySymbol.set(symbol, series);
        (await archiveCandles(symbol, '1d', series));
        if (series.latestDay !== session.day) {
          (await recordDecision(runId, symbol, null, 'NO_CURRENT_D1_BAR'));
          (await recordScanProgress('us', scanSlot, symbol, 'retry', 'NO_CURRENT_D1_BAR'));
          continue;
        }
        if ((await signalForSession('us', symbol, session.day)) || activeSymbols.has(symbol)) {
          (await recordScanProgress('us', scanSlot, symbol, 'done', 'ACTIVE_PLAN_EXISTS'));
          continue;
        }
        const plan = buildUsEodPlan({ symbol, instrumentId: `US_STOCKS:${symbol}`, bars: series.bars });
        (await recordDecision(runId, symbol, plan));
        (await recordScanProgress('us', scanSlot, symbol, 'done', plan.code ?? null));
        if (plan.tradeAllowed) {
          candidates += 1;
          if ((await createSignal({ market: 'us', symbol, sessionDay: session.day, plan, source: series.source }))) published += 1;
        }
      } catch (error) {
        const code = error?.code ?? 'SOURCE_UNAVAILABLE';
        (await recordDecision(runId, symbol, null, code));
        (await recordScanProgress('us', scanSlot, symbol, code === 'PLAN_REQUIRED' ? 'unavailable' : 'retry', code));
        errors.push(`${symbol}:${code}`);
      }
    }
    const coverage = (await scanCoverage('us', scanSlot, symbols));
    const errorCode = errors.length || coverage.unavailable ? 'PARTIAL_SOURCE_UNAVAILABLE' : coverage.remaining ? 'SCAN_IN_PROGRESS' : null;
    (await finishRun(runId, { scanned: coverage.done, candidates, errorCode }));
    return { status: errorCode ? 'partial' : 'complete', day: session.day, scanned, candidates,
      monitored: active.length, errors, published, coverage };

  } catch {
    (await finishRun(runId, { scanned, candidates, errorCode: 'SOURCE_UNAVAILABLE' }));
    return { status: 'unavailable', day: session.day, scanned, candidates, code: 'SOURCE_UNAVAILABLE' };
  }
}
