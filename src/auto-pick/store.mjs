import { createHash, randomUUID } from 'node:crypto';
import { storage, operation as op } from '../storage/database.mjs';
import { thaiSession } from './engine.mjs';
import { drSession, DR_ORB_RULE_VERSION } from './dr-orb.mjs';
import { THAI_ORB_RULE_VERSION } from './thai-orb.mjs';
import { DR80_SYMBOLS, MAI_INITIAL_SYMBOLS, SET100_SYMBOLS } from '../markets/catalog.mjs';
import { US_SCAN_SYMBOLS, US_UNIVERSE_VERSION, usScanSlot } from '../markets/us-universe.mjs';
import { usEodSession } from '../market-data/fmp-us.mjs';
import { PERFORMANCE_WINDOW, recordedOutcome, summarizeRecordedTrades } from './signal-performance.mjs';

const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);
const json = value => JSON.stringify(value ?? null);
const parse = row => row && ({
  revision: row.revision, id: row.id, market: row.market, symbol: row.symbol, sessionDay: row.session_day,
  status: row.status, publishedAt: row.published_at, entryPrice: row.entry_price,
  enteredAt: row.entered_at, exitPrice: row.exit_price, exitedAt: row.exited_at,
  lastChecked15m: row.last_checked_15m, source: row.source, plan: JSON.parse(row.plan_json),
});

export async function heartbeatWorker() {
  (await storage.run(`INSERT INTO auto_pick_worker_heartbeat (id,last_seen_at) VALUES (1,?)
    ON CONFLICT(id) DO UPDATE SET last_seen_at=excluded.last_seen_at`,new Date().toISOString()));
}

export async function workerProcessHealth(now = Date.now()) {
  const lastSeenAt = (await storage.first('SELECT last_seen_at AS lastSeenAt FROM auto_pick_worker_heartbeat WHERE id=1'))?.lastSeenAt ?? null;
  const age = lastSeenAt ? now - Date.parse(lastSeenAt) : Infinity;
  const intervalMinutes=process.env.AUTO_PICK_RUNTIME==='cloudflare'?5:1;
  return { status: Number.isFinite(age) && age >= 0 && age <= (intervalMinutes===5?420_000:300_000) ? 'running' : 'offline', lastSeenAt, intervalMinutes };
}

export async function claimRun(market, slot, { retryFailed = false, staleMs = 900_000 } = {}) {
  const id = hash(`${market}:${slot}`);
  const result = (await storage.run(`INSERT OR IGNORE INTO auto_pick_runs
    (id,market,slot,status,started_at) VALUES (?,?,?,?,?)`,id, market, slot, 'RUNNING', new Date().toISOString()));
  if (result.changes) return id;
  if (retryFailed) {
    const retry = (await storage.run(`UPDATE auto_pick_runs SET status='RUNNING',started_at=?,finished_at=NULL,error_code=NULL
      WHERE id=? AND ((status='FAILED' AND finished_at<?) OR (status='RUNNING' AND started_at<?))`,new Date().toISOString(), id, new Date(Date.now()-60_000).toISOString(), new Date(Date.now()-staleMs).toISOString()));
    if (retry.changes) return id;
  }
  return null;
}

export async function finishRun(id, { scanned = 0, candidates = 0, errorCode = null } = {}) {
  (await storage.run(`UPDATE auto_pick_runs SET status=?,finished_at=?,scanned=?,candidates=?,error_code=? WHERE id=?`,errorCode ? 'FAILED' : 'COMPLETE', new Date().toISOString(), scanned, candidates, errorCode, id));
}

export async function recordDecision(runId, symbol, plan, reason = null) {
  const sourceTimestamp = plan?.referenceCandles?.fifteenMinuteTimestamp ?? plan?.referenceCandles?.oneHourTimestamp;
  const sourceTime = sourceTimestamp
    ? new Date(sourceTimestamp * 1000).toISOString()
    : plan?.referenceCandles?.dailyDay ?? null;
  (await storage.run(`INSERT OR REPLACE INTO auto_pick_decisions
    (run_id,symbol,decision,score,reason,source_time) VALUES (?,?,?,?,?,?)`,runId, symbol, plan?.tradeAllowed ? 'CANDIDATE' : 'REJECTED',
    plan?.signalScore ?? null, reason ?? plan?.code ?? plan?.blockers?.join(' · ') ?? null,
    sourceTime,));
}

export async function recordScanProgress(market, sessionKey, symbol, state, reason = null) {
  const ruleVersion = market === 'thai' ? THAI_ORB_RULE_VERSION : market === 'dr' ? DR_ORB_RULE_VERSION : null;
  (await storage.run(`INSERT INTO auto_pick_scan_progress
    (market,session_key,symbol,state,reason,rule_version,attempts,updated_at) VALUES (?,?,?,?,?,?,1,?)
    ON CONFLICT(market,session_key,symbol) DO UPDATE SET
      state=excluded.state,reason=excluded.reason,rule_version=excluded.rule_version,
      attempts=auto_pick_scan_progress.attempts+1,updated_at=excluded.updated_at`,market, sessionKey, symbol, state, reason, ruleVersion, new Date().toISOString()));
}

export async function scanCoverage(market, sessionKey, symbols, now = Date.now()) {
  const allowed = new Set(symbols);
  const ruleVersion = market === 'thai' ? THAI_ORB_RULE_VERSION : market === 'dr' ? DR_ORB_RULE_VERSION : null;
  const rows = (await storage.all(`SELECT symbol,state,reason,rule_version AS ruleVersion,attempts,updated_at AS updatedAt
    FROM auto_pick_scan_progress WHERE market=? AND session_key=?`,market, sessionKey))
    .filter(row => allowed.has(row.symbol) && (!ruleVersion || row.ruleVersion === ruleVersion));
  const bySymbol = new Map(rows.map(row => [row.symbol, row]));
  const done = rows.filter(row => row.state === 'done').length;
  const ineligible = rows.filter(row => row.state === 'ineligible').length;
  const unavailable = rows.filter(row => row.state === 'unavailable').length;
  const retry = rows.filter(row => row.state === 'retry').length;
  const unavailableSymbols = rows.filter(row => row.state === 'unavailable')
    .map(row => ({ symbol: row.symbol, reason: row.reason ?? 'SOURCE_UNAVAILABLE' }));
  return {
    expected: symbols.length, done, ineligible, unavailable, retry,
    unavailableSymbols,
    remaining: symbols.length - done - ineligible - unavailable,
    pending: symbols.filter(symbol => {
      const row = bySymbol.get(symbol);
      return !row || row.state === 'retry' && now - Date.parse(row.updatedAt) >= 60_000;
    }),
    unresolved: rows.filter(row => row.state === 'retry').map(row => ({ symbol: row.symbol, reason: row.reason, attempts: row.attempts })),
  };
}

export async function signalForSession(market, symbol, day) {
  return parse((await storage.first('SELECT * FROM auto_pick_signals WHERE market=? AND symbol=? AND session_day=?',market, symbol, day)));
}

export async function runForSlot(market, slot) {
  return (await storage.first('SELECT id,status FROM auto_pick_runs WHERE market=? AND slot=?',market, slot)) ?? null;
}

export async function createSignal({ market, symbol, sessionDay, plan, source }) {
  const id=hash(`${market}:${symbol}:${sessionDay}:${plan.id}`),publishedAt=new Date().toISOString(),mutation=randomUUID();
  const detail=market==='dr' ? `15m DR ${plan.features?.session==='night'?'ภาคค่ำ':'ภาคเช้า'} · รอปิดเหนือกรอบและ VWAP พร้อมมูลค่าซื้อขาย · ต้องตรวจ ask ก่อนซื้อ`
    : market==='us' ? 'พบแผนรายวัน · รอแท่ง D1 ปิดยืนยันราคาเข้า' : plan.setupType==='OPENING_RANGE_BREAKOUT'
    ? '15m ORB · รอแท่งปิดเหนือกรอบและ VWAP พร้อมมูลค่าซื้อขาย' : 'พบแผนที่ผ่านกติกา รอแท่งปิดยืนยันราคาเข้า';
  const results=await storage.batch([
    op(`INSERT OR IGNORE INTO auto_pick_signals (id,market,symbol,session_day,status,published_at,source,plan_json,updated_at,mutation_key)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,id,market,symbol,sessionDay,'WAITING_FOR_ENTRY',publishedAt,source,json(plan),publishedAt,mutation),
    eventOperation(id,{type:'PICK_READY',barTime:plan.referenceCandles?.fifteenMinuteTimestamp??plan.referenceCandles?.oneHourTimestamp??null,
      barDay:plan.referenceCandles?.dailyDay??null,price:plan.entry,detail},mutation),
  ]);
  return results[0].changes ? signalForSession(market,symbol,sessionDay) : null;
}
function eventOperation(pickId,event,mutation) {
  const id=hash(`${pickId}:${event.type}:${event.barDay??event.barTime??'none'}`);
  return op(`INSERT OR IGNORE INTO auto_pick_events (id,pick_id,event_type,bar_time,bar_day,price,detail,created_at)
    SELECT ?,id,?,?,?,?,?,? FROM auto_pick_signals WHERE id=? AND mutation_key=?`,
    id,event.type,event.barTime??null,event.barDay??null,event.price??null,event.detail??null,new Date().toISOString(),pickId,mutation);
}

export async function activeSignals(market = 'thai') {
  return (await storage.all(`SELECT * FROM auto_pick_signals WHERE market=? AND status IN ('WAITING_FOR_ENTRY','OPEN') ORDER BY published_at`,market)).map(parse);
}

export async function saveAdvance(pick,events) {
  // Competing monitor jobs cannot overwrite a newer state or append events for a failed update.
  const mutation=randomUUID();
  const results=await storage.batch([
    op(`UPDATE auto_pick_signals SET status=?,entry_price=COALESCE(entry_price,?),entered_at=COALESCE(entered_at,?),
      exit_price=COALESCE(exit_price,?),exited_at=COALESCE(exited_at,?),last_checked_15m=?,updated_at=?,plan_json=?,revision=revision+1,mutation_key=?
      WHERE id=? AND revision=?`,pick.status,pick.entryPrice??null,pick.enteredAt??null,pick.exitPrice??null,pick.exitedAt??null,
      pick.lastChecked15m??pick.lastCheckedBar??null,new Date().toISOString(),json(pick.plan),mutation,pick.id,pick.revision??0),
    ...events.map(event=>eventOperation(pick.id,event,mutation)),
  ]);
  return Boolean(results[0].changes);
}

export async function signalFeed() {
  return {
    signals: (await storage.all("SELECT * FROM auto_pick_signals WHERE status IN ('WAITING_FOR_ENTRY','OPEN') ORDER BY published_at DESC LIMIT 500")).map(parse),
    events: (await storage.all(`SELECT e.id,e.pick_id AS pickId,e.event_type AS type,e.bar_time AS barTime,e.bar_day AS barDay,
      e.price,e.detail,e.created_at AS createdAt,s.market,s.symbol,s.plan_json AS planJson
      FROM auto_pick_events e JOIN auto_pick_signals s ON s.id=e.pick_id
      ORDER BY e.created_at DESC LIMIT 50`)).map(({ planJson, ...row }) => {
        const plan = JSON.parse(planJson);
        return { ...row, entryCeiling: plan?.features?.maxChase ?? null, stopLoss: plan?.stopLoss ?? null,
          tp1: plan?.tp1 ?? null, session: plan?.features?.session ?? null };
      }),
    runs: (await storage.all('SELECT id,market,slot,status,started_at AS startedAt,finished_at AS finishedAt,scanned,candidates,error_code AS errorCode FROM auto_pick_runs ORDER BY started_at DESC LIMIT 8')),
    decisions: (await storage.all(`SELECT symbol,decision,score,reason,source_time AS sourceTime FROM auto_pick_decisions
      WHERE run_id=(SELECT id FROM auto_pick_runs ORDER BY started_at DESC LIMIT 1)
      ORDER BY decision DESC,score DESC,symbol`)),
    marketOutcomes: Object.fromEntries(await Promise.all(['thai','dr','us','tfex','forex'].map(async market=>[market,Object.fromEntries((await storage.all('SELECT status,COUNT(*) AS count FROM auto_pick_signals WHERE market=? GROUP BY status',market)).map(row=>[row.status,row.count]))]))),
    outcomes: Object.fromEntries((await storage.all('SELECT status,COUNT(*) AS count FROM auto_pick_signals GROUP BY status'))
      .map(row => [row.status, row.count])),
  };
}

/** Every published scanner signal, including picks that never entered. Prices are OHLC references, not fills. */
export async function signalPerformance(market='all') {
  const specific=['thai','dr','us','tfex','forex'].includes(market),trades=[];
  // Page by closure time so a request never loads the entire ledger into memory.
  let offset=0;
  while(trades.length<PERFORMANCE_WINDOW) {
    const rows=await storage.all(`SELECT * FROM auto_pick_signals WHERE status IN ('TARGET','STOP','EXIT')
      AND entry_price>0 AND exit_price>0 AND entered_at IS NOT NULL AND exited_at IS NOT NULL ${specific?'AND market=?':''}
      ORDER BY exited_at DESC,id DESC LIMIT 100 OFFSET ?`,...(specific?[market]:[]),offset);
    for(const row of rows) {
      let signal;try{signal=parse(row);}catch{continue;}
      const result=recordedOutcome(signal);if(!result)continue;
      trades.push({id:signal.id,symbol:signal.symbol,market:signal.market,status:signal.status,entryPrice:signal.entryPrice,
        exitPrice:signal.exitPrice,enteredAt:signal.enteredAt,exitedAt:signal.exitedAt,...result});
      if(trades.length===PERFORMANCE_WINDOW)break;
    }
    if(rows.length<100)break;offset+=100;
  }
  return {summary:summarizeRecordedTrades(trades),recentTrades:trades};
}

export async function signalResults({ market = 'all', status = 'all', scope = 'history', page = 1, pageSize = 7 } = {}) {
  const performance = (await signalPerformance(market));
  const markets = new Set(['thai', 'dr', 'us', 'tfex', 'forex']);
  const statuses = new Set(['WAITING_FOR_ENTRY', 'OPEN', 'TARGET', 'STOP', 'EXIT', 'EXPIRED', 'REVIEW', 'AMBIGUOUS']);
  const where = [];
  const params = [];
  if (markets.has(market)) { where.push('market=?'); params.push(market); }
  if (statuses.has(status)) { where.push('status=?'); params.push(status); }
  if (scope === 'closed') {
    if (performance.recentTrades.length) {
      where.push('id IN (SELECT value FROM json_each(?))');
      params.push(JSON.stringify(performance.recentTrades.map(row=>row.id)));
    } else where.push('0=1');
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const safePage = Math.max(1, Math.min(100_000, Number.parseInt(page, 10) || 1));
  const safeSize = Math.max(1, Math.min(100, Number.parseInt(pageSize, 10) || 7));
  const total = (await storage.first(`SELECT COUNT(*) AS count FROM auto_pick_signals ${clause}`,...params)).count;
  const signals = (await storage.all(`SELECT * FROM auto_pick_signals ${clause} ORDER BY ${scope === 'closed' ? 'exited_at' : 'published_at'} DESC,id DESC LIMIT ? OFFSET ?`,...params, safeSize, (safePage - 1) * safeSize)).map(parse);
  if (signals.length) {
    const placeholders = 'SELECT value FROM json_each(?)';
    const events = (await storage.all(`SELECT pick_id AS pickId,event_type AS type,bar_time AS barTime,
      bar_day AS barDay,price,detail,created_at AS createdAt
      FROM auto_pick_events WHERE pick_id IN (${placeholders}) ORDER BY created_at ASC,rowid ASC`,JSON.stringify(signals.map(signal => signal.id))));
    const byPick = new Map(signals.map(signal => [signal.id, []]));
    for (const { pickId, ...event } of events) byPick.get(pickId)?.push(event);
    for (const signal of signals) signal.events = byPick.get(signal.id) ?? [];
  }
  const marketClause = markets.has(market) ? 'WHERE market=?' : '';
  const marketParams = markets.has(market) ? [market] : [];
  const counts = Object.fromEntries((await storage.all(`SELECT status,COUNT(*) AS count FROM auto_pick_signals ${marketClause} GROUP BY status`,...marketParams))
    .map(row => [row.status, row.count]));
  const actual = (await storage.first(`SELECT SUM(CASE WHEN entry_price>0 AND entered_at IS NOT NULL THEN 1 ELSE 0 END) AS entered FROM auto_pick_signals ${marketClause}`,...marketParams));
  return {
    signals, total, page: safePage, pageSize: safeSize, counts, scope: scope === 'closed' ? 'closed' : 'history',
    recentTrades: performance.recentTrades,
    summary: { ...performance.summary, entered: actual.entered ?? 0 },
  };
}

/** Configuration alone cannot show whether the scanner process is alive. */
export async function scannerHealth(now = Date.now(), market = 'thai') {
  if (market === 'us') return usScannerHealth(now);
  if (market === 'dr') return drScannerHealth(now);
  const session = thaiSession(now);
  const row = (await storage.first(`SELECT status,started_at,finished_at,error_code FROM auto_pick_runs
    WHERE market='thai' ORDER BY started_at DESC LIMIT 1`));
  if (!row) return { status: session.monitorWindow ? 'not-running' : 'awaiting-first-run', lastRunAt: null };
  const lastRunAt = row.finished_at ?? row.started_at;
  const ageMinutes = (now - Date.parse(lastRunAt)) / 60_000;
  if (!session.monitorWindow) return { status: 'outside-session', lastRunAt };
  if (row.status === 'RUNNING') return { status: ageMinutes > 5 ? 'stuck' : 'running', lastRunAt };
  if (!Number.isFinite(ageMinutes) || ageMinutes > 20 || ageMinutes < -2) return { status: 'not-running', lastRunAt };
  if (row.status === 'FAILED') return { status: 'degraded', lastRunAt, errorCode: row.error_code };
  if (session.candidateWindow && (await scanCoverage('thai', session.day, [...SET100_SYMBOLS, ...MAI_INITIAL_SYMBOLS], now)).remaining > 0)
    return { status: 'scanning-incomplete', lastRunAt };
  if (session.minutes >= 675) {
    if ((await scanCoverage('thai', session.day, [...SET100_SYMBOLS, ...MAI_INITIAL_SYMBOLS], now)).remaining > 0)
      return { status: 'candidate-degraded', lastRunAt, errorCode: 'SCAN_UNIVERSE_INCOMPLETE' };
    const start = new Date(Date.parse(`${session.day}T00:00:00+07:00`)).toISOString();
    const end = new Date(Date.parse(start) + 86_400_000).toISOString();
    const candidate = (await storage.first(`SELECT status,finished_at,error_code FROM auto_pick_runs
      WHERE market='thai' AND slot>=? AND slot<? AND scanned>0 ORDER BY slot DESC LIMIT 1`,start, end));
    if (!candidate) return { status: 'missed-candidate-window', lastRunAt };
    if (candidate.status !== 'COMPLETE') return { status: 'candidate-degraded', lastRunAt, errorCode: candidate.error_code };
  }
  return { status: 'healthy', lastRunAt };
}

async function drScannerHealth(now) {
  const session = drSession(now);
  const row = (await storage.first(`SELECT status,started_at,finished_at,error_code FROM auto_pick_runs
    WHERE market='dr' ORDER BY started_at DESC LIMIT 1`));
  const lastRunAt = row?.finished_at ?? row?.started_at ?? null;
  if (!session.monitorWindow) return { status: 'outside-session', lastRunAt };
  if (!row) return { status: 'not-running', lastRunAt };
  const ageMinutes = (now - Date.parse(lastRunAt)) / 60_000;
  if (row.status === 'RUNNING') return { status: ageMinutes > 5 ? 'stuck' : 'running', lastRunAt };
  if (!Number.isFinite(ageMinutes) || ageMinutes > 20 || ageMinutes < -2) return { status: 'not-running', lastRunAt };
  if (row.status === 'FAILED') return { status: 'degraded', lastRunAt, errorCode: row.error_code };
  if (session.candidateWindow && (await scanCoverage('dr', session.key, DR80_SYMBOLS, now)).remaining > 0)
    return { status: 'scanning-incomplete', lastRunAt };
  if (!session.candidateWindow && now / 1000 >= session.entryEnd
    && (await scanCoverage('dr', session.key, DR80_SYMBOLS, now)).remaining > 0)
    return { status: 'candidate-degraded', lastRunAt, errorCode: 'SCAN_UNIVERSE_INCOMPLETE' };
  return { status: 'healthy', lastRunAt };
}

async function usScannerHealth(now) {
  const session = usEodSession(now);
  const { day } = session;
  const fullRun = (await storage.first(`SELECT id,status,scanned,finished_at AS finishedAt FROM auto_pick_runs
    WHERE market='us' AND slot LIKE ? AND slot NOT LIKE '%:wait:%' ORDER BY started_at DESC LIMIT 1`,`%:${US_UNIVERSE_VERSION}`));
  const planRequired = fullRun ? (await storage.first("SELECT COUNT(*) AS count FROM auto_pick_decisions WHERE run_id=? AND reason='PLAN_REQUIRED'",fullRun.id))?.count ?? 0 : 0;
  const scanUnverified = !fullRun || fullRun.status !== 'COMPLETE' || fullRun.scanned < US_SCAN_SYMBOLS.length;
  const lastFullRunAt = fullRun?.finishedAt ?? null;
  const verification = { scanUnverified, planRequired, lastFullRunAt };
  const row = (await storage.first(`SELECT id,status,slot,started_at,finished_at,error_code FROM auto_pick_runs
    WHERE market='us' AND slot=?`,usScanSlot(day))) ?? (await storage.first(`SELECT id,status,slot,started_at,finished_at,error_code FROM auto_pick_runs
    WHERE market='us' ORDER BY started_at DESC LIMIT 1`));
  if (!row) return { status: session.scanWindow ? 'awaiting-first-run' : 'outside-session', lastRunAt: null, ...verification };
  const lastRunAt = row.finished_at ?? row.started_at;
  const ageMinutes = (now - Date.parse(lastRunAt)) / 60_000;
  if (row.status === 'RUNNING') return { status: ageMinutes > 30 ? 'stuck' : 'running', lastRunAt, ...verification };
  if (!session.scanWindow) return { status: 'outside-session', lastRunAt, ...verification };
  if (row.slot.startsWith(`${day}:wait:`) && row.error_code === 'EOD_NOT_READY')
    return { status: session.afterDeadline ? 'eod-data-delayed' : 'awaiting-eod-data', lastRunAt, ...verification };
  if (row.slot.startsWith(`${day}:wait:`) && row.status === 'FAILED')
    return { status: 'degraded', lastRunAt, errorCode: row.error_code, ...verification };
  if (row.slot !== usScanSlot(day) || !Number.isFinite(ageMinutes) || ageMinutes < -2)
    return { status: session.afterDeadline ? 'missed-candidate-window' : 'awaiting-first-run', lastRunAt, ...verification };
  if (row.status === 'FAILED') {
    return { status: 'degraded', lastRunAt,
      errorCode: planRequired ? 'FMP_PLAN_REQUIRED_FOR_UNIVERSE' : row.error_code,
      ...verification };
  }
  return { status: 'healthy', lastRunAt, ...verification };
}

// Hide terminal watch plans from today's feed, retaining an immutable audit trail.
export async function reconcileWatchPlans(enabledMarkets, now = Date.now()) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(now));
  for (const row of (await storage.all("SELECT * FROM auto_pick_signals WHERE status IN ('WAITING_FOR_ENTRY','EXPIRED') AND entry_price IS NULL AND market IN ('thai','dr')"))) {
    const pick = parse(row);
    const disabled = !enabledMarkets.includes(pick.market);
    const deadline = pick.market === 'thai' ? Date.parse(`${pick.sessionDay}T11:30:00+07:00`)
      : pick.market === 'dr' ? pick.plan.features.entryEnd * 1000 : Infinity;
    if (!disabled && now < deadline) continue;
    const lateExpiry = pick.status === 'EXPIRED' && Date.parse(row.updated_at) > deadline + 20 * 60000;
    if (pick.status === 'EXPIRED' && !lateExpiry && (pick.lastChecked15m ?? 0) * 1000 + 900000 >= deadline) continue;
    const lastClose = (pick.lastChecked15m ?? 0) * 1000 + 900000;
    const verified = !disabled && !lateExpiry && !pick.plan.monitoringIncomplete && lastClose >= deadline;
    (await saveAdvance({ ...pick, status: verified ? 'EXPIRED' : 'REVIEW' }, [{ type: verified ? 'EXPIRED' : 'DATA_GAP',
      detail: disabled ? 'ตลาดนี้ปิดการติดตาม ยุติรายการเฝ้าเดิม ไม่สรุปว่าพลาดเงื่อนไข' : verified
        ? 'ตรวจแท่งครบถึงเส้นตายแล้ว ไม่เข้าเงื่อนไข' : 'หมดหน้าต่างเข้า แต่ติดตามแท่งไม่ครบ ไม่สามารถยืนยันว่าไม่เข้าเงื่อนไข', price: null }]));
  }
  (await storage.run("UPDATE auto_pick_runs SET status='FAILED',error_code='WORKER_INTERRUPTED',finished_at=? WHERE status='RUNNING' AND started_at<?",new Date(now).toISOString(), new Date(now - 10 * 60000).toISOString()));
}
