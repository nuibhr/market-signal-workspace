import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ForexStore } from "./store.mjs";
import { configuration, instrument, validatePacket } from "./protocol.mjs";
export const NOW = Date.parse("2026-10-07T10:00:00Z");
export const config = {
  enabled: true,
  servers: ["VantageMarkets-Demo"],
  local: true,
};
export const metadata = (symbol = "EURUSD.a") => ({
  broker_symbol: symbol,
  canonical_symbol: null,
  category: "fx",
  description: "Euro / US Dollar",
  digits: 5,
  point: 0.00001,
  contract_size: 100000,
  volume_min: 0.01,
  volume_max: 50,
  volume_step: 0.01,
  currency_base: "EUR",
  currency_profit: "USD",
  currency_margin: "EUR",
  trade_mode: 4,
  session: {
    timezone: "broker-server",
    intervals: [{ day: 1, open: "00:00:00", close: "23:59:59" }],
  },
});
export const packet = (sequence = 1, extra = {}, now = NOW) => ({
  schema_version: 1,
  broker_id: "vantage",
  server: "VantageMarkets-Demo",
  company: "Vantage Global Limited",
  sent_at: new Date(now).toISOString().replace(".000", ""),
  sequence,
  kind: "universe",
  sync_id: 1,
  part: 0,
  parts: 1,
  instruments: [metadata()],
  ...extra,
});
export const feed = (sequence = 2, extra = {}, now = NOW) => {
  const { sync_id, part, parts, instruments, ...base } = packet(
    sequence,
    {},
    now,
  );
  return {
    ...base,
    kind: "feed",
    quotes: [
      {
        broker_symbol: "EURUSD.a",
        bid: 1.08345,
        ask: 1.08355,
        time: Math.floor(now / 1000),
      },
    ],
    chart: null,
    ...extra,
  };
};
function fixture() {
  const store = new ForexStore();
  const { token } = store.pair("alice", config.servers[0], config, NOW);
  return { store, token };
}

test("exact server allowlist and opt-in config; local shortcut is impossible in production", () => {
  assert.deepEqual(configuration({}), {
    enabled: false,
    servers: [],
    local: false,
    databasePath: "data/forex-mt5.sqlite",
  });
  assert.equal(
    configuration({ NODE_ENV: "production", FOREX_MT5_LOCAL_MODE: "true" })
      .local,
    false,
  );
  const { store, token } = fixture();
  for (const extra of [
    { server: "Other-Demo" },
    { server: "VantageMarkets-Demo-copy" },
    { company: "NotVantageBroker" },
    { company: "" },
    { broker_id: "other" },
  ])
    assert.throws(() => store.ingest(token, packet(1, extra), config, NOW));
  assert.equal(store.view("alice", config, {}, NOW).snapshot, null);
  store.db.close();
});
test("a complete thirteen-part revision recovers from missing first chunk without publishing partial data", () => {
  const { store, token } = fixture();
  let sequence = 0;
  const rowsFor = (part) => Array.from(
    { length: part === 12 ? 1 : 100 },
    (_, i) => metadata(`BROKER${part * 100 + i}.a`),
  );
  // Reproduce the native EA bug: the first packet's revision changed while waiting for its ACK.
  store.ingest(token, packet(++sequence, { parts: 13, sync_id: 1, instruments: rowsFor(0) }), config, NOW);
  for (let part = 1; part < 13; part++)
    store.ingest(token, packet(++sequence, { parts: 13, sync_id: 2, part, instruments: rowsFor(part) }), config, NOW);
  store.ingest(token, feed(++sequence, { quotes: [], chart: null }), config, NOW);
  assert.equal(store.view("alice", config, {}, NOW).snapshot, null);
  assert.equal(store.view("alice", config, {}, NOW).status, "syncing");
  // A reloaded connector sends a stable revision; commit only after all thirteen parts arrive.
  for (let part = 0; part < 13; part++) {
    store.ingest(token, packet(++sequence, { parts: 13, sync_id: 3, part, instruments: rowsFor(part) }), config, NOW);
    if (part < 12) assert.equal(store.view("alice", config, {}, NOW).snapshot, null);
  }
  const view = store.view("alice", config, {}, NOW);
  assert.equal(view.status, "ready");
  assert.equal(view.snapshot.instruments.length, 1201);
  assert.equal(new Set(view.snapshot.instruments.map(i => i.broker_symbol)).size, 1201);
  store.db.close();
});
test("atomic multipart universe and exact suffixed names/specs; filters can classify future CFDs", () => {
  const { store, token } = fixture();
  // Real EA chunks contain 100 rows, except the last chunk.
  const rows = Array.from({ length: 100 }, (_, i) => metadata(`FX${i}.a`));
  store.ingest(token, packet(1, { parts: 2, instruments: rows }), config, NOW);
  assert.equal(store.view("alice", config, {}, NOW).status, "syncing");
  assert.equal(store.view("alice", config, {}, NOW).snapshot, null);
  store.ingest(
    token,
    packet(2, { parts: 2, part: 1, instruments: [metadata()] }),
    config,
    NOW,
  );
  const view = store.view("alice", config, {}, NOW);
  assert.equal(view.status, "ready");
  assert.equal(view.snapshot.instruments.length, 101);
  const row = view.snapshot.instruments.at(-1);
  assert.equal(row.broker_symbol, "EURUSD.a");
  assert.equal(row.canonical_symbol, null);
  assert.equal(row.contract_size, 100000);
  assert.equal(row.volume_step, 0.01);
  assert.equal(row.digits, 5);
  assert.equal(row.id, "mt5:vantage:VantageMarkets-Demo:EURUSD.a");
  store.ingest(
    token,
    packet(3, { sync_id: 2, parts: 2, instruments: rows }),
    config,
    NOW,
  );
  assert.equal(
    store.view("alice", config, {}, NOW).snapshot.instruments.length,
    101,
  );
  store.db.close();
});
test("duplicate symbols, inconsistent parts and old revisions cannot overwrite final snapshot", () => {
  const { store, token } = fixture();
  store.ingest(token, packet(), config, NOW);
  assert.throws(
    () =>
      store.ingest(
        token,
        packet(2, { sync_id: 2, instruments: [metadata(), metadata()] }),
        config,
        NOW,
      ),
    /DUPLICATE_SYMBOL/,
  );
  assert.equal(
    store.view("alice", config, {}, NOW).snapshot.instruments.length,
    1,
  );
  assert.throws(
    () =>
      store.ingest(
        token,
        packet(2, { sync_id: 1, instruments: [metadata("OTHER")] }),
        config,
        NOW,
      ),
    /INCONSISTENT_SYNC/,
  );
  // Exact retry of a completed chunk acknowledges safely after a lost network response.
  assert.equal(store.ingest(token, packet(2), config, NOW).accepted, true);
  store.db.close();
});
test("owner isolation, hashing, token expiry and immediate revocation", () => {
  const { store, token } = fixture();
  store.ingest(token, packet(), config, NOW);
  assert.equal(store.view("bob", config, {}, NOW).snapshot, null);
  assert.ok(
    !JSON.stringify(store.view("alice", config, {}, NOW)).includes(token),
  );
  const record = store.connection("alice");
  assert.notEqual(record.token_hash, token);
  assert.throws(
    () => store.ingest("X".repeat(43), feed(), config, NOW),
    /INVALID_CONNECTOR_TOKEN/,
  );
  assert.throws(
    () =>
      store.ingest(
        token,
        feed(2, {}, NOW + 8 * 86400000),
        config,
        NOW + 8 * 86400000,
      ),
    /INVALID_CONNECTOR_TOKEN/,
  );
  store.revoke("bob");
  assert.equal(store.view("alice", config, {}, NOW).status, "ready");
  store.revoke("alice");
  assert.equal(store.view("alice", config, {}, NOW).snapshot, null);
  assert.throws(
    () => store.ingest(token, feed(), config, NOW),
    /INVALID_CONNECTOR_TOKEN/,
  );
  store.db.close();
});
test("replay, identity switching and clock drift are rejected without advancing connection state", () => {
  const { store, token } = fixture();
  store.ingest(token, packet(), config, NOW);
  assert.throws(
    () => store.ingest(token, packet(), config, NOW),
    /REPLAYED_PACKET/,
  );
  assert.throws(
    () =>
      store.ingest(token, feed(2, { company: "Vantage Changed" }), config, NOW),
    /TERMINAL_CHANGED/,
  );
  assert.throws(
    () => store.ingest(token, feed(2, {}, NOW - 121000), config, NOW),
    /CLOCK_OUT_OF_RANGE/,
  );
  assert.throws(
    () => store.ingest(token, feed(2, {}, NOW + 31000), config, NOW),
    /CLOCK_OUT_OF_RANGE/,
  );
  assert.equal(store.connection("alice").sequence, 1);
  store.db.close();
});
test("bid/ask spread, stale market quotes and retained snapshots when connector falls silent", () => {
  const { store, token } = fixture();
  store.ingest(token, packet(), config, NOW);
  store.ingest(token, feed(), config, NOW);
  let view = store.view("alice", config, {}, NOW);
  assert.ok(Math.abs(view.quotes["EURUSD.a"].spread_points - 10) < 1e-8);
  assert.equal(view.quotes["EURUSD.a"].stale, false);
  view = store.view("alice", config, {}, NOW + 31000);
  assert.equal(view.status, "stale");
  assert.equal(view.quotes["EURUSD.a"].stale, true);
  assert.equal(view.snapshot.instruments.length, 1);
  store.ingest(
    token,
    feed(
      3,
      {
        quotes: [
          {
            broker_symbol: "EURUSD.a",
            bid: 1.08345,
            ask: 1.08355,
            time: NOW / 1000,
          },
        ],
      },
      NOW + 40000,
    ),
    config,
    NOW + 40000,
  );
  view = store.view("alice", config, {}, NOW + 40000);
  assert.equal(view.status, "ready");
  assert.equal(view.quotes["EURUSD.a"].stale, true);
  assert.throws(
    () =>
      store.ingest(
        token,
        feed(
          4,
          {
            quotes: [
              { broker_symbol: "UNKNOWN", bid: 1, ask: 2, time: NOW / 1000 },
            ],
          },
          NOW + 40000,
        ),
        config,
        NOW + 40000,
      ),
    /UNKNOWN_SYMBOL/,
  );
  assert.equal(
    store.view("alice", { ...config, servers: [] }, {}, NOW + 40000).status,
    "unsupported",
  );
  store.db.close();
});
test("OHLC validation, ordering and selected symbol/frame request are scoped to known universe", () => {
  const { store, token } = fixture();
  store.ingest(token, packet(), config, NOW);
  const bar = {
    time: NOW / 1000 - 3600,
    open: 1.08,
    high: 1.09,
    low: 1.07,
    close: 1.083,
    volume: 120,
  };
  const chart = {
    broker_symbol: "EURUSD.a",
    timeframe: "1h",
    bars: [bar],
    utc_offset_minutes: 180,
  };
  store.ingest(token, feed(2, { chart }), config, NOW);
  assert.deepEqual(
    store.view("alice", config, { symbol: "EURUSD.a", frame: "1h" }, NOW).chart
      .bars,
    [bar],
  );
  assert.throws(() =>
    store.ingest(
      token,
      feed(3, { chart: { ...chart, bars: [{ ...bar, low: 2 }] } }),
      config,
      NOW,
    ),
  );
  assert.throws(() =>
    store.ingest(
      token,
      feed(3, { chart: { ...chart, bars: [bar, bar] } }),
      config,
      NOW,
    ),
  );
  store.view("alice", config, { symbol: "EURUSD.a", frame: "4h" }, NOW);
  const request = store.ingest(token, feed(3), config, NOW);
  assert.equal(
    Buffer.from(request.requested_symbol_hex, "hex").toString(),
    "EURUSD.a",
  );
  assert.equal(request.requested_frame, "4h");
  store.view("alice", config, { symbol: "FAKE", frame: "bad" }, NOW);
  assert.equal(store.connection("alice").wanted_symbol, "EURUSD.a");
  store.db.close();
});
test("strict protocol rejects credentials, private account fields, oversized/invalid metadata", () => {
  for (const extra of [
    { password: "secret" },
    { login: 123 },
    { balance: 100 },
    { positions: [] },
    { instruments: Array.from({ length: 101 }, () => metadata()) },
  ])
    assert.throws(() => validatePacket(packet(1, extra), config, NOW));
  for (const extra of [
    { digits: 13 },
    { point: 0 },
    { category: "fake" },
    { volume_min: 100 },
    { session: { timezone: "UTC", intervals: [] } },
    { broker_symbol: "bad\nname" },
    { contract_size: NaN },
  ])
    assert.throws(() =>
      instrument({ ...metadata(), ...extra }, config.servers[0]),
    );
});
test("local browser capability expires and pairing limit applies independently of membership storage", () => {
  const store = new ForexStore(),
    token = store.localSession(NOW);
  assert.match(store.localOwner(token, NOW), /^local:/);
  assert.equal(store.localOwner("fake", NOW), null);
  assert.equal(store.localOwner(token, NOW + 86400001), null);
  for (let i = 0; i < 5; i++)
    store.pair("alice", config.servers[0], config, NOW);
  assert.throws(
    () => store.pair("alice", config.servers[0], config, NOW),
    /RATE_LIMITED/,
  );
  store.db.close();
});
test("Mac connector is an EA with timer/WebRequest and contains no credential reading or trading methods", () => {
  const source = readFileSync(
    new URL("./connector.mq5", import.meta.url),
    "utf8",
  );
  assert.match(source, /void OnTimer/);
  assert.match(source, /SymbolsTotal\(false\)/);
  assert.match(source, /WebRequest\("POST"/);
  assert.doesNotMatch(
    source,
    /\b(?:OrderSend|OrderSendAsync|CTrade|ACCOUNT_LOGIN|ACCOUNT_BALANCE|ACCOUNT_EQUITY|PositionsTotal|OrdersTotal|HistorySelect)\b/,
  );
});

test("backend retains exact approved server labels after EA padding/case normalization", () => {
  assert.throws(
    () =>
      validatePacket(
        packet(1, { server: "  Vantagemarkets-Demo" }),
        config,
        NOW,
      ),
    /BROKER_NOT_ALLOWED/,
  );
  assert.throws(
    () =>
      validatePacket(
        packet(1, { server: "VantageMarkets-Live 15" }),
        config,
        NOW,
      ),
    /BROKER_NOT_ALLOWED/,
  );
  assert.equal(
    validatePacket(packet(), config, NOW).server,
    "VantageMarkets-Demo",
  );
});

const clockSample = (now, offset = 180, used = null, lag = 0) => ({
  utc_seconds: Math.floor(now / 1000),
  server_seconds: Math.floor(now / 1000) + offset * 60,
  last_tick_seconds: Math.floor(now / 1000) + offset * 60 - lag,
  used_offset_minutes: used,
});
test("automatic clock requires fresh repeated observations; prices wait for the approved offset", () => {
  const { store, token } = fixture();
  const first = store.ingest(token, packet(1, { clock: clockSample(NOW) }), config, NOW);
  assert.equal(first.requested_utc_offset_minutes, "10000");
  store.ingest(token, feed(2, { clock: clockSample(NOW + 5000) }, NOW + 5000), config, NOW + 5000);
  assert.deepEqual(store.view("alice", config, {}, NOW + 5000).quotes, {});
  const ready = store.ingest(token, feed(3, { clock: clockSample(NOW + 10000) }, NOW + 10000), config, NOW + 10000);
  assert.equal(ready.requested_utc_offset_minutes, "180");
  assert.equal(store.view("alice", config, {}, NOW + 10000).clock.status, "ready");
  store.ingest(token, feed(4, { clock: clockSample(NOW + 15000, 180, 180) }, NOW + 15000), config, NOW + 15000);
  assert.equal(store.view("alice", config, {}, NOW + 15000).quotes["EURUSD.a"].bid, 1.08345);
  assert.equal(store.view("bob", config, {}, NOW + 15000).clock, undefined);
  const paused = store.ingest(token, feed(5, { clock: clockSample(NOW + 20000, 180, 180, 60) }, NOW + 20000), config, NOW + 20000);
  assert.equal(paused.requested_utc_offset_minutes, "10000");
  assert.deepEqual(store.view("alice", config, {}, NOW + 20000).quotes, {});
  assert.equal(store.view("alice", config, {}, NOW + 20000).clock.status, "unavailable");
  store.db.close();
});
test("clock changes reset observations and exclude bars before the observed offset period", () => {
  const { store, token } = fixture();
  store.ingest(token, packet(1, { clock: clockSample(NOW) }), config, NOW);
  for (let n = 1; n <= 3; n++) store.ingest(token,
    feed(n + 1, { clock: clockSample(NOW + n * 5000, 180, 180) }, NOW + n * 5000), config, NOW + n * 5000);
  assert.ok(store.view("alice", config, {}, NOW + 15000).quotes["EURUSD.a"]);
  store.ingest(token, feed(5, { clock: clockSample(NOW + 20000, 120) }, NOW + 20000), config, NOW + 20000);
  assert.deepEqual(store.view("alice", config, {}, NOW + 20000).quotes, {});
  for (let n = 5; n <= 6; n++) store.ingest(token,
    feed(n + 1, { clock: clockSample(NOW + n * 5000, 120) }, NOW + n * 5000), config, NOW + n * 5000);
  assert.equal(store.view("alice", config, {}, NOW + 30000).clock.offset_minutes, 120);
  const chart = { broker_symbol: "EURUSD.a", timeframe: "15m", utc_offset_minutes: 120,
    bars: [{ time: NOW / 1000, open: 1, high: 2, low: 1, close: 2, volume: 1 }] };
  store.ingest(token, feed(8, { chart, clock: clockSample(NOW + 35000, 120, 120) }, NOW + 35000), config, NOW + 35000);
  assert.equal(store.view("alice", config, { symbol: "EURUSD.a", frame: "15m" }, NOW + 35000).chart, null);
  chart.bars[0].time = NOW / 1000 + 20;
  store.ingest(token, feed(9, { chart, clock: clockSample(NOW + 40000, 120, 120) }, NOW + 40000), config, NOW + 40000);
  assert.equal(store.view("alice", config, { symbol: "EURUSD.a", frame: "15m" }, NOW + 40000).chart.bars.length, 1);
  assert.equal(store.view("alice", config, {}, NOW + 80000).clock.status, "unavailable");
  store.revoke("alice");
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM forex_clock").get().n, 0);
  store.db.close();
});
test("clock schema rejects private fields and clock timestamps unrelated to packet UTC", () => {
  for (const clock of [ { ...clockSample(NOW), password: "forbidden" },
    { ...clockSample(NOW), utc_seconds: NOW / 1000 + 3 },
    { ...clockSample(NOW), used_offset_minutes: 10000 },
    { ...clockSample(NOW), last_tick_seconds: 0 } ])
    assert.throws(() => validatePacket(packet(1, { clock }), config, NOW));
});

test("opt-in HTTP retry returns only the exact last receipt without replaying clock or writes", () => {
  const { store, token } = fixture();
  const input = packet(1, { clock: clockSample(NOW) });
  const first = store.ingest(token, input, config, NOW, true);
  assert.deepEqual(store.ingest(token, input, config, NOW + 5000, true), first);
  assert.equal(store.clock(store.connection("alice").id).samples, 1);
  assert.equal(store.connection("alice").last_seen, NOW);
  assert.throws(() => store.ingest(token, { ...input, company: "Vantage Changed" }, config, NOW + 5000, true), /TERMINAL_CHANGED/);
  assert.throws(() => store.ingest(token, { ...input, sync_id: 2 }, config, NOW + 5000, true), /REPLAYED_PACKET/);
  store.ingest(token, feed(2, { clock: clockSample(NOW + 5000), quotes: [] }, NOW + 5000), config, NOW + 5000, true);
  assert.throws(() => store.ingest(token, input, config, NOW + 5000, true), /REPLAYED_PACKET/);
  store.revoke("alice");
  assert.throws(() => store.ingest(token, input, config, NOW + 5000, true), /INVALID_CONNECTOR_TOKEN/);
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM forex_receipts").get().n, 0);
  store.db.close();
});
