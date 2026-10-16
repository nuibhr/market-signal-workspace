import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { assertIdentity, fail, FRAMES, validatePacket } from "./protocol.mjs";

import { observeClock, publicClock } from "./clock.mjs";
import { initializeDaytrade, scanJobs, ingestScanCharts } from "../daytrade/store.mjs";
import { historyFloor } from './history-window.mjs';

const digest = (token) => createHash("sha256").update(token).digest("hex");
const secret = () => randomBytes(32).toString("base64url");
const iso = (time) => new Date(time).toISOString();
export class ForexStore {
  constructor(path = ":memory:") {
    if (path !== ":memory:") {
      path = resolve(path);
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    }
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS forex_connections (
        id TEXT PRIMARY KEY, owner TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
        server TEXT NOT NULL, company TEXT, expires INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0,
        last_seen INTEGER, sequence INTEGER NOT NULL DEFAULT 0, sync_id INTEGER NOT NULL DEFAULT 0,
        snapshot TEXT, quotes TEXT NOT NULL DEFAULT '{}', charts TEXT NOT NULL DEFAULT '{}',
        wanted_symbol TEXT, wanted_frame TEXT NOT NULL DEFAULT '1h', created INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS forex_owner ON forex_connections(owner, created);
      CREATE TABLE IF NOT EXISTS forex_chunks (
        connection_id TEXT NOT NULL, sync_id INTEGER NOT NULL, part INTEGER NOT NULL, parts INTEGER NOT NULL,
        body TEXT NOT NULL, PRIMARY KEY(connection_id, sync_id, part));
      CREATE TABLE IF NOT EXISTS forex_receipts (connection_id TEXT PRIMARY KEY, digest TEXT NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS forex_clock (connection_id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS forex_local_sessions (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS forex_limits (bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires INTEGER NOT NULL);`);
    initializeDaytrade(this.db);
  }
  limit(scope, identity, count, window = 60000, now = Date.now()) {
    this.db.prepare("DELETE FROM forex_limits WHERE expires < ?").run(now);
    const bucket = digest(`${scope}:${identity}:${Math.floor(now / window)}`);
    const result = this.db
      .prepare(
        `INSERT INTO forex_limits VALUES(?,1,?) ON CONFLICT(bucket)
      DO UPDATE SET hits=hits+1 WHERE hits < ? RETURNING hits`,
      )
      .get(bucket, now + window, count);
    fail(result, "RATE_LIMITED", 429);
  }
  localSession(now = Date.now()) {
    this.db
      .prepare("DELETE FROM forex_local_sessions WHERE expires < ?")
      .run(now);
    const token = secret();
    this.db
      .prepare("INSERT INTO forex_local_sessions VALUES(?,?)")
      .run(digest(token), now + 86400000);
    return token;
  }
  localOwner(token, now = Date.now()) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const hash = digest(token);
    return this.db
      .prepare(
        "SELECT hash FROM forex_local_sessions WHERE hash=? AND expires>?",
      )
      .get(hash, now)
      ? `local:${hash}`
      : null;
  }
  pair(owner, server, config, now = Date.now()) {
    fail(config.servers.includes(server), "BROKER_NOT_ALLOWED", 403);
    this.limit("pair", owner, 5, 3600000, now);
    const token = secret(),
      id = randomUUID(),
      expires = now + 7 * 86400000;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.revoke(owner);
      this.db
        .prepare(
          "INSERT INTO forex_connections(id,owner,token_hash,server,expires,created) VALUES(?,?,?,?,?,?)",
        )
        .run(id, owner, digest(token), server, expires, now);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return { token, expires_at: iso(expires) };
  }
  revoke(owner) {
    this.db.prepare("DELETE FROM forex_receipts WHERE connection_id IN (SELECT id FROM forex_connections WHERE owner=?)").run(owner);
    this.db.prepare("DELETE FROM forex_clock WHERE connection_id IN (SELECT id FROM forex_connections WHERE owner=?)").run(owner);
    this.db
      .prepare(
        "DELETE FROM forex_chunks WHERE connection_id IN (SELECT id FROM forex_connections WHERE owner=?)",
      )
      .run(owner);
    this.db
      .prepare(
        "UPDATE forex_connections SET revoked=1, snapshot=NULL, quotes='{}', charts='{}' WHERE owner=?",
      )
      .run(owner);
  }
  connection(owner) {
    return this.db
      .prepare(
        "SELECT * FROM forex_connections WHERE owner=? AND revoked=0 ORDER BY created DESC LIMIT 1",
      )
      .get(owner);
  }
  view(owner, config, { symbol, frame = "1h" } = {}, now = Date.now()) {
    const row = this.connection(owner);
    if (!row || row.expires <= now)
      return {
        status: "disconnected",
        error_code: row ? "PAIRING_EXPIRED" : null,
        snapshot: null,
        quotes: {},
        chart: null,
      };
    const allowed =
      config.servers.includes(row.server) &&
      (!row.company || /\bvantage\b/i.test(row.company));
    if (!allowed)
      return {
        status: "unsupported",
        error_code: "BROKER_NOT_ALLOWED",
        snapshot: null,
        quotes: {},
        chart: null,
      };
    const snapshot = row.snapshot ? JSON.parse(row.snapshot) : null;
    if (
      symbol &&
      snapshot?.instruments.some((item) => item.broker_symbol === symbol) &&
      Object.hasOwn(FRAMES, frame)
    ) {
      this.db
        .prepare(
          "UPDATE forex_connections SET wanted_symbol=?,wanted_frame=? WHERE id=?",
        )
        .run(symbol, frame, row.id);
    }
    const syncing = this.db
      .prepare("SELECT 1 FROM forex_chunks WHERE connection_id=? LIMIT 1")
      .get(row.id);
    const stale = row.last_seen !== null && now - row.last_seen > 30000;
    const quotes = JSON.parse(row.quotes);
    for (const quote of Object.values(quotes))
      quote.stale = stale || now - quote.time * 1000 > 30000;
    const chart =
      JSON.parse(row.charts)[`${symbol ?? row.wanted_symbol}|${frame}`] ?? null;
    return {
      status: stale
        ? "stale"
        : syncing
          ? "syncing"
          : snapshot
            ? "ready"
            : row.last_seen
              ? "connected"
              : "connecting",
      broker_id: "vantage",
      server: row.server,
      company: row.company,
      last_seen_at: row.last_seen ? iso(row.last_seen) : null,
      last_sync_at: snapshot?.synced_at ?? null,
      expires_at: iso(row.expires),
      error_code: null,
      snapshot,
      clock: publicClock(this.clock(row.id), now),
      quotes,
      chart: chart
        ? {
            ...chart,
            stale: stale || now - Date.parse(chart.received_at) > 30000,
          }
        : null,
    };
  }
  clock(id) {
    const row = this.db.prepare("SELECT body FROM forex_clock WHERE connection_id=?").get(id);
    return row ? JSON.parse(row.body) : null;
  }
  ingest(token, input, config, now = Date.now(), retry = false) {
    fail(
      typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token),
      "INVALID_CONNECTOR_TOKEN",
      401,
    );
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db
        .prepare(
          "SELECT * FROM forex_connections WHERE token_hash=? AND revoked=0 AND expires>?",
        )
        .get(digest(token), now);
      fail(row, "INVALID_CONNECTOR_TOKEN", 401);
      this.limit("ingest", row.id, 120, 60000, now);
      const packet = validatePacket(input, config, now);
      assertIdentity(row.server, packet.company, config);
      fail(
        packet.server === row.server &&
          (!row.company || packet.company === row.company),
        "TERMINAL_CHANGED",
        403,
      );
      const hash = digest(JSON.stringify(input));
      if (retry && packet.sequence === row.sequence) {
        const receipt = this.db.prepare("SELECT digest,body FROM forex_receipts WHERE connection_id=?").get(row.id);
        fail(receipt?.digest === hash, "REPLAYED_PACKET", 409);
        this.db.exec("COMMIT");
        return JSON.parse(receipt.body); // Lost HTTP response: exact last packet, no duplicate ingest/clock samples.
      }
      fail(packet.sequence > row.sequence, "REPLAYED_PACKET", 409);
      let clock = this.clock(row.id);
      if (packet.clock) {
        const old = clock;
        clock = observeClock(clock, packet.clock, now);
        this.db.prepare("INSERT INTO forex_clock VALUES(?,?) ON CONFLICT(connection_id) DO UPDATE SET body=excluded.body")
          .run(row.id, JSON.stringify(clock));
        if (clock.status !== "ready" || old?.offset_minutes !== clock.offset_minutes) {
          this.db.prepare("UPDATE forex_connections SET quotes='{}',charts='{}' WHERE id=?").run(row.id);
          row.quotes = "{}"; row.charts = "{}";
        }
      }
      fail(!(packet.scan_charts?.length) || Boolean(clock), "CLOCK_OBSERVATION_REQUIRED");
      const historySince=historyFloor(clock,config,now);
      if (packet.kind === "universe") this.universe(row, packet, now);
      else if (!clock || (packet.clock && clock.status === "ready" &&
        packet.clock.used_offset_minutes === clock.offset_minutes &&
        (!packet.chart || (packet.chart.utc_offset_minutes === clock.offset_minutes &&
          packet.chart.bars.every(bar => bar.time >= historySince))) &&
        (packet.scan_charts||[]).every(chart=>chart.utc_offset_minutes===clock.offset_minutes && chart.bars.every(bar=>bar.time>=historySince)))) this.feed(row, packet, now);
      this.db
        .prepare(
          "UPDATE forex_connections SET company=?,last_seen=?,sequence=? WHERE id=?",
        )
        .run(packet.company, now, packet.sequence, row.id);
      const current = this.db
        .prepare(
          "SELECT wanted_symbol,wanted_frame FROM forex_connections WHERE id=?",
        )
        .get(row.id);
      // Hex avoids requiring a JSON parser for arbitrary broker symbols in MQL5.
      const receipt = {
        accepted: true,
        requested_symbol_hex: Buffer.from(current.wanted_symbol || "").toString(
          "hex",
        ),
        requested_frame: current.wanted_frame,
        requested_utc_offset_minutes: String(clock?.offset_minutes ?? 10000),
        requested_history_since: String(clock?historySince:0),
        requested_scan_symbols_hex: clock?.status === "ready" &&
          (packet.kind==='feed'||packet.part===packet.parts-1) ? scanJobs(this.db,this.connection(row.owner),now) : "",
      };
      this.db.prepare("INSERT INTO forex_receipts VALUES(?,?,?) ON CONFLICT(connection_id) DO UPDATE SET digest=excluded.digest,body=excluded.body")
        .run(row.id, hash, JSON.stringify(receipt));
      this.db.exec("COMMIT");
      return receipt;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  universe(row, packet, now) {
    if (packet.sync_id === row.sync_id && row.snapshot) {
      const committed = JSON.parse(row.snapshot).instruments;
      fail(
        packet.parts === Math.ceil(committed.length / 100) &&
          JSON.stringify(
            committed.slice(packet.part * 100, (packet.part + 1) * 100),
          ) === JSON.stringify(packet.instruments),
        "INCONSISTENT_SYNC",
        409,
      );
      return; // The prior response may have been lost after an atomic commit.
    }
    fail(packet.sync_id > row.sync_id, "OLD_SYNC", 409);
    const active = this.db
      .prepare(
        "SELECT sync_id,parts FROM forex_chunks WHERE connection_id=? LIMIT 1",
      )
      .get(row.id);
    if (active && active.sync_id > packet.sync_id) fail(false, "OLD_SYNC", 409);
    if (active && active.sync_id < packet.sync_id)
      this.db
        .prepare("DELETE FROM forex_chunks WHERE connection_id=?")
        .run(row.id);
    if (active?.sync_id === packet.sync_id)
      fail(active.parts === packet.parts, "INCONSISTENT_SYNC");
    const existing = this.db
      .prepare(
        "SELECT body FROM forex_chunks WHERE connection_id=? AND sync_id=? AND part=?",
      )
      .get(row.id, packet.sync_id, packet.part);
    const body = JSON.stringify(packet.instruments);
    fail(!existing || existing.body === body, "INCONSISTENT_SYNC");
    this.db
      .prepare("INSERT OR IGNORE INTO forex_chunks VALUES(?,?,?,?,?)")
      .run(row.id, packet.sync_id, packet.part, packet.parts, body);
    const chunks = this.db
      .prepare(
        "SELECT body FROM forex_chunks WHERE connection_id=? AND sync_id=? ORDER BY part",
      )
      .all(row.id, packet.sync_id);
    if (chunks.length !== packet.parts) return;
    const instruments = chunks.flatMap((chunk) => JSON.parse(chunk.body));
    fail(
      new Set(instruments.map((item) => item.broker_symbol)).size ===
        instruments.length,
      "DUPLICATE_SYMBOL",
    );
    const snapshot = {
      schema_version: 1,
      source: "mt5",
      broker_id: "vantage",
      server: row.server,
      synced_at: iso(now),
      instruments,
    };
    // Retain a prior snapshot until the whole next universe arrives. Discard old quote/chart caches on commit.
    this.db
      .prepare(
        "UPDATE forex_connections SET snapshot=?,sync_id=?,quotes='{}',charts='{}',wanted_symbol=? WHERE id=?",
      )
      .run(
        JSON.stringify(snapshot),
        packet.sync_id,
        instruments.some((i) => i.broker_symbol === row.wanted_symbol)
          ? row.wanted_symbol
          : instruments[0].broker_symbol,
        row.id,
      );
    this.db
      .prepare("DELETE FROM forex_chunks WHERE connection_id=?")
      .run(row.id);
  }
  feed(row, packet, now) {
    const snapshot = row.snapshot ? JSON.parse(row.snapshot) : null;
    const known = new Set(
      snapshot?.instruments.map((item) => item.broker_symbol),
    );
    fail(
      packet.quotes.every((q) => known.has(q.broker_symbol)) &&
        (!packet.chart || known.has(packet.chart.broker_symbol)) &&
        (packet.scan_charts||[]).every(c=>known.has(c.broker_symbol)),
      "UNKNOWN_SYMBOL",
    );
    fail(
      new Set(packet.quotes.map((q) => q.broker_symbol)).size ===
        packet.quotes.length,
      "DUPLICATE_SYMBOL",
    );
    const quotes = JSON.parse(row.quotes),
      charts = JSON.parse(row.charts);
    for (const quote of packet.quotes) {
      fail(
        !Object.hasOwn(quotes, quote.broker_symbol) ||
          quote.time >= quotes[quote.broker_symbol].time,
        "OLD_QUOTE",
        409,
      );
      const metadata = snapshot.instruments.find(
        (item) => item.broker_symbol === quote.broker_symbol,
      );
      Object.defineProperty(quotes, quote.broker_symbol, {
        value: {
          ...quote,
          price: quote.bid,
          source: "mt5",
          spread_points: metadata.point
            ? (quote.ask - quote.bid) / metadata.point
            : null,
          received_at: iso(now),
        },
        enumerable: true,
        configurable: true,
      });
    }
    if (packet.chart) {
      const key = `${packet.chart.broker_symbol}|${packet.chart.timeframe}`;
      const old = charts[key];
      fail(
        !old || packet.chart.bars.at(-1).time >= old.bars.at(-1).time,
        "OLD_CHART",
        409,
      );
      charts[key] = { ...packet.chart, source: "mt5", received_at: iso(now) };
      for (const key of Object.keys(charts).slice(0, -8)) delete charts[key];
    }
    ingestScanCharts(this.db,row,[...(packet.chart?[packet.chart]:[]),...(packet.scan_charts||[])],packet.quotes,now);
    this.db
      .prepare("UPDATE forex_connections SET quotes=?,charts=? WHERE id=?")
      .run(JSON.stringify(quotes), JSON.stringify(charts), row.id);
  }
}
let singleton;
export const storeFor = (config) =>
  (singleton ??= new ForexStore(config.databasePath));
