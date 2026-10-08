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
