import { createHash } from 'node:crypto';
import { sharedDatabase } from '../membership/store.mjs';

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
      event_type TEXT NOT NULL, bar_time INTEGER, price REAL, detail TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS auto_pick_events_recent ON auto_pick_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS auto_pick_signals_status ON auto_pick_signals(status,market);`);
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

export function claimRun(market, slot) {
  const db = database();
  const id = hash(`${market}:${slot}`);
  const result = db.prepare(`INSERT OR IGNORE INTO auto_pick_runs
    (id,market,slot,status,started_at) VALUES (?,?,?,?,?)`).run(id, market, slot, 'RUNNING', new Date().toISOString());
  return result.changes ? id : null;
}

export function finishRun(id, { scanned = 0, candidates = 0, errorCode = null } = {}) {
  database().prepare(`UPDATE auto_pick_runs SET status=?,finished_at=?,scanned=?,candidates=?,error_code=? WHERE id=?`)
    .run(errorCode ? 'FAILED' : 'COMPLETE', new Date().toISOString(), scanned, candidates, errorCode, id);
}

export function recordDecision(runId, symbol, plan, reason = null) {
  database().prepare(`INSERT OR REPLACE INTO auto_pick_decisions
    (run_id,symbol,decision,score,reason,source_time) VALUES (?,?,?,?,?,?)`).run(
    runId, symbol, plan?.tradeAllowed ? 'CANDIDATE' : 'REJECTED',
    plan?.signalScore ?? null, reason ?? plan?.code ?? plan?.blockers?.join(' · ') ?? null,
    plan?.referenceCandles?.oneHourTimestamp ? new Date(plan.referenceCandles.oneHourTimestamp * 1000).toISOString() : null,
  );
}

export function signalForSession(market, symbol, day) {
  return parse(database().prepare('SELECT * FROM auto_pick_signals WHERE market=? AND symbol=? AND session_day=?').get(market, symbol, day));
}

export function createSignal({ market, symbol, sessionDay, plan, source }) {
  const db = database();
  const id = hash(`${market}:${symbol}:${sessionDay}:${plan.id}`);
  const publishedAt = new Date().toISOString();
  const result = db.prepare(`INSERT OR IGNORE INTO auto_pick_signals
    (id,market,symbol,session_day,status,published_at,source,plan_json,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(id, market, symbol, sessionDay, 'WAITING_FOR_ENTRY', publishedAt, source, json(plan), publishedAt);
  if (result.changes) insertEvent(db, id, { type: 'PICK_READY', barTime: plan.referenceCandles?.oneHourTimestamp ?? null,
    price: plan.entry, detail: 'พบแผนที่ผ่านกติกา รอแท่งปิดยืนยันราคาเข้า' });
  return result.changes ? signalForSession(market, symbol, sessionDay) : null;
}

function insertEvent(db, pickId, event) {
  const id = hash(`${pickId}:${event.type}:${event.barTime ?? 'none'}`);
  db.prepare(`INSERT OR IGNORE INTO auto_pick_events
    (id,pick_id,event_type,bar_time,price,detail,created_at) VALUES (?,?,?,?,?,?,?)`).run(
    id, pickId, event.type, event.barTime ?? null, event.price ?? null,
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
    db.prepare(`UPDATE auto_pick_signals SET status=?,entry_price=?,entered_at=?,exit_price=?,exited_at=?,last_checked_15m=?,updated_at=? WHERE id=?`)
      .run(pick.status, pick.entryPrice ?? null, pick.enteredAt ?? null, pick.exitPrice ?? null,
        pick.exitedAt ?? null, pick.lastChecked15m ?? null, new Date().toISOString(), pick.id);
    for (const item of events) insertEvent(db, pick.id, item);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function signalFeed() {
  const db = database();
  return {
    signals: db.prepare('SELECT * FROM auto_pick_signals ORDER BY published_at DESC LIMIT 30').all().map(parse),
    events: db.prepare(`SELECT e.id,e.pick_id AS pickId,e.event_type AS type,e.bar_time AS barTime,
      e.price,e.detail,e.created_at AS createdAt,s.market,s.symbol
      FROM auto_pick_events e JOIN auto_pick_signals s ON s.id=e.pick_id
      ORDER BY e.created_at DESC LIMIT 50`).all(),
    runs: db.prepare('SELECT id,market,slot,status,started_at AS startedAt,finished_at AS finishedAt,scanned,candidates,error_code AS errorCode FROM auto_pick_runs ORDER BY started_at DESC LIMIT 8').all(),
    decisions: db.prepare(`SELECT symbol,decision,score,reason,source_time AS sourceTime FROM auto_pick_decisions
      WHERE run_id=(SELECT id FROM auto_pick_runs ORDER BY started_at DESC LIMIT 1)
      ORDER BY decision DESC,score DESC,symbol`).all(),
    outcomes: Object.fromEntries(db.prepare('SELECT status,COUNT(*) AS count FROM auto_pick_signals GROUP BY status').all()
      .map(row => [row.status, row.count])),
  };
}
