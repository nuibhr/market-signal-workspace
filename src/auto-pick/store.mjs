import { createHash } from 'node:crypto';
import { sharedDatabase } from '../membership/store.mjs';
import { thaiSession } from './engine.mjs';
import { drSession, DR_ORB_RULE_VERSION } from './dr-orb.mjs';
import { THAI_ORB_RULE_VERSION } from './thai-orb.mjs';
import { DR80_SYMBOLS, MAI_INITIAL_SYMBOLS, SET100_SYMBOLS } from '../markets/catalog.mjs';
import { NASDAQ100_SYMBOLS } from '../markets/nasdaq-100.mjs';
import { usEodSession } from '../market-data/fmp-us.mjs';

let ready = false;
function database() {
  const db = sharedDatabase();
  if (!ready) {
    db.exec(`CREATE TABLE IF NOT EXISTS auto_pick_runs (
      id TEXT PRIMARY KEY, market TEXT NOT NULL, slot TEXT NOT NULL, status TEXT NOT NULL,
      started_at TEXT NOT NULL, finished_at TEXT, scanned INTEGER NOT NULL DEFAULT 0,
      candidates INTEGER NOT NULL DEFAULT 0, error_code TEXT
    );
    CREATE TABLE IF NOT EXISTS auto_pick_decisions (
      run_id TEXT NOT NULL REFERENCES auto_pick_runs(id), symbol TEXT NOT NULL,
      decision TEXT NOT NULL, score REAL, reason TEXT, source_time TEXT,
      PRIMARY KEY (run_id,symbol)
    );
    CREATE TABLE IF NOT EXISTS auto_pick_signals (
      id TEXT PRIMARY KEY, market TEXT NOT NULL, symbol TEXT NOT NULL,
      session_day TEXT NOT NULL, status TEXT NOT NULL, published_at TEXT NOT NULL,
      entry_price REAL, entered_at TEXT, exit_price REAL, exited_at TEXT,
      last_checked_15m INTEGER, source TEXT NOT NULL, plan_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(market,symbol,session_day)
    );
    CREATE TABLE IF NOT EXISTS auto_pick_events (
      id TEXT PRIMARY KEY, pick_id TEXT NOT NULL REFERENCES auto_pick_signals(id),
      event_type TEXT NOT NULL, bar_time INTEGER, bar_day TEXT, price REAL, detail TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS auto_pick_events_recent ON auto_pick_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS auto_pick_signals_status ON auto_pick_signals(status,market);
    CREATE TABLE IF NOT EXISTS auto_pick_scan_progress (
      market TEXT NOT NULL, session_key TEXT NOT NULL, symbol TEXT NOT NULL,
      state TEXT NOT NULL, reason TEXT, rule_version TEXT, attempts INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL, PRIMARY KEY (market,session_key,symbol)
    );
    CREATE TABLE IF NOT EXISTS auto_pick_worker_heartbeat (
      id INTEGER PRIMARY KEY CHECK (id=1), last_seen_at TEXT NOT NULL
    );`);
    const eventColumns = new Set(db.prepare('PRAGMA table_info(auto_pick_events)').all().map(column => column.name));
    if (!eventColumns.has('bar_day')) db.exec('ALTER TABLE auto_pick_events ADD COLUMN bar_day TEXT');
    const progressColumns = new Set(db.prepare('PRAGMA table_info(auto_pick_scan_progress)').all().map(column => column.name));
    if (!progressColumns.has('rule_version')) db.exec('ALTER TABLE auto_pick_scan_progress ADD COLUMN rule_version TEXT');
    ready = true;
  }
  return db;
}

const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);
const json = value => JSON.stringify(value ?? null);
const parse = row => row && ({
  id: row.id, market: row.market, symbol: row.symbol, sessionDay: row.session_day,
  status: row.status, publishedAt: row.published_at, entryPrice: row.entry_price,
  enteredAt: row.entered_at, exitPrice: row.exit_price, exitedAt: row.exited_at,
  lastChecked15m: row.last_checked_15m, source: row.source, plan: JSON.parse(row.plan_json),
});

export function heartbeatWorker() {
  database().prepare(`INSERT INTO auto_pick_worker_heartbeat (id,last_seen_at) VALUES (1,?)
    ON CONFLICT(id) DO UPDATE SET last_seen_at=excluded.last_seen_at`).run(new Date().toISOString());
}

export function workerProcessHealth(now = Date.now()) {
  const lastSeenAt = database().prepare('SELECT last_seen_at AS lastSeenAt FROM auto_pick_worker_heartbeat WHERE id=1').get()?.lastSeenAt ?? null;
  const age = lastSeenAt ? now - Date.parse(lastSeenAt) : Infinity;
  return { status: Number.isFinite(age) && age >= 0 && age <= 300_000 ? 'running' : 'offline', lastSeenAt };
}

export function claimRun(market, slot, { retryFailed = false } = {}) {
  const db = database();
  const id = hash(`${market}:${slot}`);
  const result = db.prepare(`INSERT OR IGNORE INTO auto_pick_runs
    (id,market,slot,status,started_at) VALUES (?,?,?,?,?)`).run(id, market, slot, 'RUNNING', new Date().toISOString());
  if (result.changes) return id;
  if (retryFailed) {
    const retry = db.prepare(`UPDATE auto_pick_runs SET status='RUNNING',started_at=?,finished_at=NULL,error_code=NULL
      WHERE id=? AND ((status='FAILED' AND finished_at<?) OR (status='RUNNING' AND started_at<?))`)
      .run(new Date().toISOString(), id, new Date(Date.now()-60_000).toISOString(), new Date(Date.now()-900_000).toISOString());
    if (retry.changes) return id;
  }
  return null;
}

export function finishRun(id, { scanned = 0, candidates = 0, errorCode = null } = {}) {
  database().prepare(`UPDATE auto_pick_runs SET status=?,finished_at=?,scanned=?,candidates=?,error_code=? WHERE id=?`)
    .run(errorCode ? 'FAILED' : 'COMPLETE', new Date().toISOString(), scanned, candidates, errorCode, id);
}

export function recordDecision(runId, symbol, plan, reason = null) {
  const sourceTimestamp = plan?.referenceCandles?.fifteenMinuteTimestamp ?? plan?.referenceCandles?.oneHourTimestamp;
  const sourceTime = sourceTimestamp
    ? new Date(sourceTimestamp * 1000).toISOString()
    : plan?.referenceCandles?.dailyDay ?? null;
  database().prepare(`INSERT OR REPLACE INTO auto_pick_decisions
    (run_id,symbol,decision,score,reason,source_time) VALUES (?,?,?,?,?,?)`).run(
    runId, symbol, plan?.tradeAllowed ? 'CANDIDATE' : 'REJECTED',
    plan?.signalScore ?? null, reason ?? plan?.code ?? plan?.blockers?.join(' · ') ?? null,
    sourceTime,
  );
}

export function recordScanProgress(market, sessionKey, symbol, state, reason = null) {
  const ruleVersion = market === 'thai' ? THAI_ORB_RULE_VERSION : market === 'dr' ? DR_ORB_RULE_VERSION : null;
  database().prepare(`INSERT INTO auto_pick_scan_progress
    (market,session_key,symbol,state,reason,rule_version,attempts,updated_at) VALUES (?,?,?,?,?,?,1,?)
    ON CONFLICT(market,session_key,symbol) DO UPDATE SET
      state=excluded.state,reason=excluded.reason,rule_version=excluded.rule_version,
      attempts=auto_pick_scan_progress.attempts+1,updated_at=excluded.updated_at`)
    .run(market, sessionKey, symbol, state, reason, ruleVersion, new Date().toISOString());
}

export function scanCoverage(market, sessionKey, symbols, now = Date.now()) {
  const allowed = new Set(symbols);
  const ruleVersion = market === 'thai' ? THAI_ORB_RULE_VERSION : market === 'dr' ? DR_ORB_RULE_VERSION : null;
  const rows = database().prepare(`SELECT symbol,state,reason,rule_version AS ruleVersion,attempts,updated_at AS updatedAt
    FROM auto_pick_scan_progress WHERE market=? AND session_key=?`).all(market, sessionKey)
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

export function signalForSession(market, symbol, day) {
  return parse(database().prepare('SELECT * FROM auto_pick_signals WHERE market=? AND symbol=? AND session_day=?').get(market, symbol, day));
}

export function runForSlot(market, slot) {
  return database().prepare('SELECT id,status FROM auto_pick_runs WHERE market=? AND slot=?').get(market, slot) ?? null;
}

export function createSignal({ market, symbol, sessionDay, plan, source }) {
  const db = database();
  const id = hash(`${market}:${symbol}:${sessionDay}:${plan.id}`);
  const publishedAt = new Date().toISOString();
  const result = db.prepare(`INSERT OR IGNORE INTO auto_pick_signals
    (id,market,symbol,session_day,status,published_at,source,plan_json,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(id, market, symbol, sessionDay, 'WAITING_FOR_ENTRY', publishedAt, source, json(plan), publishedAt);
  if (result.changes) insertEvent(db, id, { type: 'PICK_READY', barTime: plan.referenceCandles?.fifteenMinuteTimestamp ?? plan.referenceCandles?.oneHourTimestamp ?? null,
    barDay: plan.referenceCandles?.dailyDay ?? null, price: plan.entry, detail: market === 'dr'
      ? `15m DR ${plan.features?.session === 'night' ? 'ภาคค่ำ' : 'ภาคเช้า'} · รอปิดเหนือกรอบและ VWAP พร้อมมูลค่าซื้อขาย · ต้องตรวจ ask ก่อนซื้อ`
      : market === 'us'
      ? 'พบแผนรายวัน · รอแท่ง D1 ปิดยืนยันราคาเข้า' : plan.setupType === 'OPENING_RANGE_BREAKOUT'
        ? '15m ORB · รอแท่งปิดเหนือกรอบและ VWAP พร้อมมูลค่าซื้อขาย' : 'พบแผนที่ผ่านกติกา รอแท่งปิดยืนยันราคาเข้า' });
  return result.changes ? signalForSession(market, symbol, sessionDay) : null;
}

function insertEvent(db, pickId, event) {
  const id = hash(`${pickId}:${event.type}:${event.barDay ?? event.barTime ?? 'none'}`);
  db.prepare(`INSERT OR IGNORE INTO auto_pick_events
    (id,pick_id,event_type,bar_time,bar_day,price,detail,created_at) VALUES (?,?,?,?,?,?,?,?)`).run(
    id, pickId, event.type, event.barTime ?? null, event.barDay ?? null, event.price ?? null,
    event.detail ?? null, new Date().toISOString(),
  );
}

export function activeSignals(market = 'thai') {
  return database().prepare(`SELECT * FROM auto_pick_signals WHERE market=? AND status IN ('WAITING_FOR_ENTRY','OPEN') ORDER BY published_at`)
    .all(market).map(parse);
}

export function saveAdvance(pick, events) {
  const db = database();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE auto_pick_signals SET status=?,entry_price=?,entered_at=?,exit_price=?,exited_at=?,last_checked_15m=?,updated_at=?,plan_json=? WHERE id=?`)
      .run(pick.status, pick.entryPrice ?? null, pick.enteredAt ?? null, pick.exitPrice ?? null,
        pick.exitedAt ?? null, pick.lastChecked15m ?? pick.lastCheckedBar ?? null, new Date().toISOString(), json(pick.plan), pick.id);
    for (const item of events) insertEvent(db, pick.id, item);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function signalFeed() {
  const db = database();
  return {
    signals: db.prepare("SELECT * FROM auto_pick_signals WHERE status IN ('WAITING_FOR_ENTRY','OPEN') ORDER BY published_at DESC LIMIT 500").all().map(parse),
    events: db.prepare(`SELECT e.id,e.pick_id AS pickId,e.event_type AS type,e.bar_time AS barTime,e.bar_day AS barDay,
      e.price,e.detail,e.created_at AS createdAt,s.market,s.symbol,s.plan_json AS planJson
      FROM auto_pick_events e JOIN auto_pick_signals s ON s.id=e.pick_id
      ORDER BY e.created_at DESC LIMIT 50`).all().map(({ planJson, ...row }) => {
        const plan = JSON.parse(planJson);
        return { ...row, entryCeiling: plan?.features?.maxChase ?? null, stopLoss: plan?.stopLoss ?? null,
          tp1: plan?.tp1 ?? null, session: plan?.features?.session ?? null };
      }),
    runs: db.prepare('SELECT id,market,slot,status,started_at AS startedAt,finished_at AS finishedAt,scanned,candidates,error_code AS errorCode FROM auto_pick_runs ORDER BY started_at DESC LIMIT 8').all(),
    decisions: db.prepare(`SELECT symbol,decision,score,reason,source_time AS sourceTime FROM auto_pick_decisions
      WHERE run_id=(SELECT id FROM auto_pick_runs ORDER BY started_at DESC LIMIT 1)
      ORDER BY decision DESC,score DESC,symbol`).all(),
    marketOutcomes: Object.fromEntries(['thai','dr','us','tfex','forex'].map(market=>[market,Object.fromEntries(db.prepare('SELECT status,COUNT(*) AS count FROM auto_pick_signals WHERE market=? GROUP BY status').all(market).map(row=>[row.status,row.count]))])),
    outcomes: Object.fromEntries(db.prepare('SELECT status,COUNT(*) AS count FROM auto_pick_signals GROUP BY status').all()
      .map(row => [row.status, row.count])),
  };
}

/** Every published scanner signal, including picks that never entered. Prices are OHLC references, not fills. */
export function signalResults({ market = 'all', status = 'all', page = 1, pageSize = 7 } = {}) {
  const db = database();
  const markets = new Set(['thai', 'dr', 'us', 'tfex', 'forex']);
  const statuses = new Set(['WAITING_FOR_ENTRY', 'OPEN', 'TARGET', 'STOP', 'EXIT', 'EXPIRED', 'REVIEW', 'AMBIGUOUS']);
  const where = [];
  const params = [];
  if (markets.has(market)) { where.push('market=?'); params.push(market); }
  if (statuses.has(status)) { where.push('status=?'); params.push(status); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const safePage = Math.max(1, Math.min(100_000, Number.parseInt(page, 10) || 1));
  const safeSize = Math.max(1, Math.min(100, Number.parseInt(pageSize, 10) || 7));
  const total = db.prepare(`SELECT COUNT(*) AS count FROM auto_pick_signals ${clause}`).get(...params).count;
  const signals = db.prepare(`SELECT * FROM auto_pick_signals ${clause} ORDER BY published_at DESC,id DESC LIMIT ? OFFSET ?`)
    .all(...params, safeSize, (safePage - 1) * safeSize).map(parse);
  if (signals.length) {
    const placeholders = signals.map(() => '?').join(',');
    const events = db.prepare(`SELECT pick_id AS pickId,event_type AS type,bar_time AS barTime,
      bar_day AS barDay,price,detail,created_at AS createdAt
      FROM auto_pick_events WHERE pick_id IN (${placeholders}) ORDER BY created_at ASC,rowid ASC`)
      .all(...signals.map(signal => signal.id));
    const byPick = new Map(signals.map(signal => [signal.id, []]));
    for (const { pickId, ...event } of events) byPick.get(pickId)?.push(event);
    for (const signal of signals) signal.events = byPick.get(signal.id) ?? [];
  }
  const marketClause = markets.has(market) ? 'WHERE market=?' : '';
  const marketParams = markets.has(market) ? [market] : [];
  const counts = Object.fromEntries(db.prepare(`SELECT status,COUNT(*) AS count FROM auto_pick_signals ${marketClause} GROUP BY status`).all(...marketParams)
    .map(row => [row.status, row.count]));
  const settled = db.prepare(`SELECT status,entry_price AS entryPrice,exit_price AS exitPrice,plan_json AS planJson
    FROM auto_pick_signals WHERE status IN ('TARGET','STOP','EXIT')
      AND entry_price > 0 AND exit_price > 0 AND entered_at IS NOT NULL AND exited_at IS NOT NULL
      ${markets.has(market) ? 'AND market=?' : ''}`).all(...marketParams);
  const results = settled.map(row => {
    const plan = JSON.parse(row.planJson);
    const direction = plan?.side === 'SHORT' ? -1 : 1;
    const returnPercent = direction * (row.exitPrice - row.entryPrice) / row.entryPrice * 100;
    const risk = Math.abs(row.entryPrice - Number(plan?.stopLoss));
    const rMultiple = Number.isFinite(risk) && risk > 0 ? direction * (row.exitPrice - row.entryPrice) / risk : null;
    return { returnPercent, rMultiple };
  });
  const actual = db.prepare(`SELECT SUM(CASE WHEN entry_price>0 AND entered_at IS NOT NULL THEN 1 ELSE 0 END) AS entered, MIN(published_at) AS oldest, MAX(updated_at) AS latest FROM auto_pick_signals ${marketClause}`).get(...marketParams);
  const wins = results.filter(row => row.returnPercent > 0).length;
  const losses = results.filter(row => row.returnPercent < 0).length;
  return {
    signals, total, page: safePage, pageSize: safeSize, counts,
    summary: {
      entered: actual.entered ?? 0, from: actual.oldest ?? null, to: actual.latest ?? null,
      closed: results.length, wins, losses, flat: results.length - wins - losses,
      winRate: results.length ? wins / results.length * 100 : null,
      averageReturnPercent: results.length ? results.reduce((sum, row) => sum + row.returnPercent, 0) / results.length : null,
      averageR: results.some(row => row.rMultiple !== null)
        ? results.filter(row => row.rMultiple !== null).reduce((sum, row) => sum + row.rMultiple, 0) / results.filter(row => row.rMultiple !== null).length : null,
    },
  };
}

/** Configuration alone cannot show whether the scanner process is alive. */
export function scannerHealth(now = Date.now(), market = 'thai') {
  if (market === 'us') return usScannerHealth(now);
  if (market === 'dr') return drScannerHealth(now);
  const session = thaiSession(now);
  const db = database();
  const row = db.prepare(`SELECT status,started_at,finished_at,error_code FROM auto_pick_runs
    WHERE market='thai' ORDER BY started_at DESC LIMIT 1`).get();
  if (!row) return { status: session.monitorWindow ? 'not-running' : 'awaiting-first-run', lastRunAt: null };
  const lastRunAt = row.finished_at ?? row.started_at;
  const ageMinutes = (now - Date.parse(lastRunAt)) / 60_000;
  if (!session.monitorWindow) return { status: 'outside-session', lastRunAt };
  if (row.status === 'RUNNING') return { status: ageMinutes > 5 ? 'stuck' : 'running', lastRunAt };
  if (!Number.isFinite(ageMinutes) || ageMinutes > 20 || ageMinutes < -2) return { status: 'not-running', lastRunAt };
  if (row.status === 'FAILED') return { status: 'degraded', lastRunAt, errorCode: row.error_code };
  if (session.candidateWindow && scanCoverage('thai', session.day, [...SET100_SYMBOLS, ...MAI_INITIAL_SYMBOLS], now).remaining > 0)
    return { status: 'scanning-incomplete', lastRunAt };
  if (session.minutes >= 675) {
    if (scanCoverage('thai', session.day, [...SET100_SYMBOLS, ...MAI_INITIAL_SYMBOLS], now).remaining > 0)
      return { status: 'candidate-degraded', lastRunAt, errorCode: 'SCAN_UNIVERSE_INCOMPLETE' };
    const start = new Date(Date.parse(`${session.day}T00:00:00+07:00`)).toISOString();
    const end = new Date(Date.parse(start) + 86_400_000).toISOString();
    const candidate = db.prepare(`SELECT status,finished_at,error_code FROM auto_pick_runs
      WHERE market='thai' AND slot>=? AND slot<? AND scanned>0 ORDER BY slot DESC LIMIT 1`).get(start, end);
    if (!candidate) return { status: 'missed-candidate-window', lastRunAt };
    if (candidate.status !== 'COMPLETE') return { status: 'candidate-degraded', lastRunAt, errorCode: candidate.error_code };
  }
  return { status: 'healthy', lastRunAt };
}

function drScannerHealth(now) {
  const session = drSession(now);
  const row = database().prepare(`SELECT status,started_at,finished_at,error_code FROM auto_pick_runs
    WHERE market='dr' ORDER BY started_at DESC LIMIT 1`).get();
  const lastRunAt = row?.finished_at ?? row?.started_at ?? null;
  if (!session.monitorWindow) return { status: 'outside-session', lastRunAt };
  if (!row) return { status: 'not-running', lastRunAt };
  const ageMinutes = (now - Date.parse(lastRunAt)) / 60_000;
  if (row.status === 'RUNNING') return { status: ageMinutes > 5 ? 'stuck' : 'running', lastRunAt };
  if (!Number.isFinite(ageMinutes) || ageMinutes > 20 || ageMinutes < -2) return { status: 'not-running', lastRunAt };
  if (row.status === 'FAILED') return { status: 'degraded', lastRunAt, errorCode: row.error_code };
  if (session.candidateWindow && scanCoverage('dr', session.key, DR80_SYMBOLS, now).remaining > 0)
    return { status: 'scanning-incomplete', lastRunAt };
  if (!session.candidateWindow && now / 1000 >= session.entryEnd
    && scanCoverage('dr', session.key, DR80_SYMBOLS, now).remaining > 0)
    return { status: 'candidate-degraded', lastRunAt, errorCode: 'SCAN_UNIVERSE_INCOMPLETE' };
  return { status: 'healthy', lastRunAt };
}

function usScannerHealth(now) {
  const session = usEodSession(now);
  const { day } = session;
  const db = database();
  const fullRun = db.prepare(`SELECT id,status,scanned,finished_at AS finishedAt FROM auto_pick_runs
    WHERE market='us' AND slot NOT LIKE '%:wait:%' ORDER BY started_at DESC LIMIT 1`).get();
  const planRequired = fullRun ? db.prepare("SELECT COUNT(*) AS count FROM auto_pick_decisions WHERE run_id=? AND reason='PLAN_REQUIRED'").get(fullRun.id)?.count ?? 0 : 0;
  const scanUnverified = !fullRun || fullRun.status !== 'COMPLETE' || fullRun.scanned < NASDAQ100_SYMBOLS.length;
  const lastFullRunAt = fullRun?.finishedAt ?? null;
  const verification = { scanUnverified, planRequired, lastFullRunAt };
  const row = db.prepare(`SELECT id,status,slot,started_at,finished_at,error_code FROM auto_pick_runs
    WHERE market='us' AND slot=?`).get(day) ?? db.prepare(`SELECT id,status,slot,started_at,finished_at,error_code FROM auto_pick_runs
    WHERE market='us' ORDER BY started_at DESC LIMIT 1`).get();
  if (!row) return { status: session.scanWindow ? 'awaiting-first-run' : 'outside-session', lastRunAt: null, ...verification };
  const lastRunAt = row.finished_at ?? row.started_at;
  const ageMinutes = (now - Date.parse(lastRunAt)) / 60_000;
  if (row.status === 'RUNNING') return { status: ageMinutes > 30 ? 'stuck' : 'running', lastRunAt, ...verification };
  if (!session.scanWindow) return { status: 'outside-session', lastRunAt, ...verification };
  if (row.slot.startsWith(`${day}:wait:`) && row.error_code === 'EOD_NOT_READY')
    return { status: session.afterDeadline ? 'eod-data-delayed' : 'awaiting-eod-data', lastRunAt, ...verification };
  if (row.slot.startsWith(`${day}:wait:`) && row.status === 'FAILED')
    return { status: 'degraded', lastRunAt, errorCode: row.error_code, ...verification };
  if (row.slot !== day || !Number.isFinite(ageMinutes) || ageMinutes < -2)
    return { status: session.afterDeadline ? 'missed-candidate-window' : 'awaiting-first-run', lastRunAt, ...verification };
  if (row.status === 'FAILED') {
    return { status: 'degraded', lastRunAt,
      errorCode: planRequired ? 'FMP_PLAN_REQUIRED_FOR_UNIVERSE' : row.error_code,
      ...verification };
  }
  return { status: 'healthy', lastRunAt, ...verification };
}

// Hide terminal watch plans from today's feed, retaining an immutable audit trail.
export function reconcileWatchPlans(enabledMarkets, now = Date.now()) {
  const db = database();
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(now));
  for (const row of db.prepare("SELECT * FROM auto_pick_signals WHERE status IN ('WAITING_FOR_ENTRY','EXPIRED') AND entry_price IS NULL AND market IN ('thai','dr')").all()) {
    const pick = parse(row);
    const disabled = !enabledMarkets.includes(pick.market);
    const deadline = pick.market === 'thai' ? Date.parse(`${pick.sessionDay}T11:30:00+07:00`)
      : pick.market === 'dr' ? pick.plan.features.entryEnd * 1000 : Infinity;
    if (!disabled && now < deadline) continue;
    const lateExpiry = pick.status === 'EXPIRED' && Date.parse(row.updated_at) > deadline + 20 * 60000;
    if (pick.status === 'EXPIRED' && !lateExpiry && (pick.lastChecked15m ?? 0) * 1000 + 900000 >= deadline) continue;
    const lastClose = (pick.lastChecked15m ?? 0) * 1000 + 900000;
    const verified = !disabled && !lateExpiry && !pick.plan.monitoringIncomplete && lastClose >= deadline;
    saveAdvance({ ...pick, status: verified ? 'EXPIRED' : 'REVIEW' }, [{ type: verified ? 'EXPIRED' : 'DATA_GAP',
      detail: disabled ? 'ตลาดนี้ปิดการติดตาม ยุติรายการเฝ้าเดิม ไม่สรุปว่าพลาดเงื่อนไข' : verified
        ? 'ตรวจแท่งครบถึงเส้นตายแล้ว ไม่เข้าเงื่อนไข' : 'หมดหน้าต่างเข้า แต่ติดตามแท่งไม่ครบ ไม่สามารถยืนยันว่าไม่เข้าเงื่อนไข', price: null }]);
  }
  db.prepare("UPDATE auto_pick_runs SET status='FAILED',error_code='WORKER_INTERRUPTED',finished_at=? WHERE status='RUNNING' AND started_at<?")
    .run(new Date(now).toISOString(), new Date(now - 10 * 60000).toISOString());
}
