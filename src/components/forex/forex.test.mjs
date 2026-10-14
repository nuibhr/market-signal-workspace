import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FOREX_SYMBOLS } from "../../markets/catalog.mjs";
import {
  BROKERS,
  SUPPORTED_BROKERS,
  getSupportedBroker,
  GUEST_CONNECTION,
  CONNECTION_STATES,
} from "./brokers.mjs";
import {
  FOREX_CATEGORIES,
  STARTER_SNAPSHOT,
  STARTER_UNIVERSE,
  filterUniverse,
  resolveInitialInstrument,
} from "./symbol-universe.mjs";

const root = new URL("../../../", import.meta.url);

test("guest universe preserves exactly the existing 19 symbols, without invented broker metadata", () => {
  assert.equal(STARTER_UNIVERSE.length, 19);
  assert.deepEqual(
    STARTER_UNIVERSE.map((item) => item.display_symbol),
    FOREX_SYMBOLS,
  );
  assert.equal(new Set(STARTER_UNIVERSE.map((item) => item.id)).size, 19);
  assert.equal(STARTER_SNAPSHOT.source, "starter");
  assert.equal(STARTER_SNAPSHOT.synced_at, null);
  const unknownFields = [
    "broker_id",
    "server",
    "broker_symbol",
    "digits",
    "point",
    "contract_size",
    "volume_min",
    "volume_max",
    "volume_step",
    "currency_margin",
    "trade_mode",
    "session",
  ];
  for (const item of STARTER_UNIVERSE) {
    for (const field of unknownFields)
      assert.equal(item[field], null, `${item.id}: ${field}`);
    assert.equal(item.canonical_symbol, item.display_symbol.replace("/", ""));
    assert.equal(item.currency_base, item.display_symbol.split("/")[0]);
    assert.equal(item.currency_profit, item.display_symbol.split("/")[1]);
  }
});

test("all nine categories exist and only actual fallback members have counts", () => {
  assert.deepEqual(
    FOREX_CATEGORIES.map((item) => item.id),
    [
      "fx",
      "metals",
      "indices",
      "energy",
      "commodities",
      "crypto_cfds",
      "share_cfds",
      "etfs",
      "bonds",
    ],
  );
  assert.equal(filterUniverse(STARTER_UNIVERSE, { category: "fx" }).length, 17);
  assert.equal(
    filterUniverse(STARTER_UNIVERSE, { category: "metals" }).length,
    2,
  );
  for (const category of FOREX_CATEGORIES.slice(2)) {
    assert.deepEqual(
      filterUniverse(STARTER_UNIVERSE, { category: category.id }),
      [],
    );
  }
});

test("search, category and favorite filters compose; exact broker suffixes remain searchable", () => {
  assert.equal(
    filterUniverse(STARTER_UNIVERSE, { query: " eurusd " })[0].display_symbol,
    "EUR/USD",
  );
  assert.equal(
    filterUniverse(STARTER_UNIVERSE, { query: "gold", category: "metals" })[0]
      .display_symbol,
    "XAU/USD",
  );
  assert.equal(
    filterUniverse(STARTER_UNIVERSE, { query: "gold", category: "fx" }).length,
    0,
  );
  assert.deepEqual(filterUniverse(STARTER_UNIVERSE, { favorites: [] }), []);
  assert.equal(
    filterUniverse(STARTER_UNIVERSE, {
      query: "usd",
      favorites: ["starter:XAU/USD"],
    }).length,
    1,
  );
  const future = {
    ...STARTER_UNIVERSE[0],
    id: "mt5:vantage:verified-server:EURUSD.a",
    source: "mt5",
    broker_symbol: "EURUSD.a",
  };
  assert.deepEqual(filterUniverse([future], { query: "eurusd.a" }), [future]);
});

test("deep links resolve the fallback universe and invalid input safely defaults", () => {
  assert.equal(resolveInitialInstrument("XAU/USD").canonical_symbol, "XAUUSD");
  assert.equal(resolveInitialInstrument("GBPUSD").display_symbol, "GBP/USD");
  assert.equal(resolveInitialInstrument("unknown").display_symbol, "EUR/USD");
  assert.equal(resolveInitialInstrument(null).display_symbol, "EUR/USD");
});

test("only Vantage is supported; all connection states are contracts for the opt-in read-only connector", () => {
  assert.deepEqual(
    SUPPORTED_BROKERS.map((item) => item.id),
    ["vantage"],
  );
  assert.equal(getSupportedBroker("other"), null);
  assert.equal(getSupportedBroker("vantage"), BROKERS.vantage);
  assert.equal(BROKERS.vantage.connectionAvailable, true);
  assert.deepEqual(BROKERS.vantage.verifiedServers, []);
  assert.equal(GUEST_CONNECTION.status, "disconnected");
  assert.deepEqual(Object.keys(CONNECTION_STATES), [
    "disconnected",
    "connecting",
    "connected",
    "syncing",
    "ready",
    "stale",
    "error",
    "unsupported",
  ]);
});

test("Forex uses its dedicated route while the other market routes retain their shared workspace", () => {
  for (const market of ["thai", "dr", "tfex", "us"]) {
    const path = `src/app/${market}/page.jsx`;
    const source = readFileSync(new URL(path, root), 'utf8');
    assert.match(source, /import Workspace from .*components\/workspace\.jsx/);
    assert.ok(source.includes(`marketId="${market}"`));
    assert.doesNotMatch(source, /ForexWorkspace/);
  }
  const route = readFileSync(new URL("src/app/forex/page.jsx", root), "utf8");
  assert.match(route, /import ForexWorkspace from/);
  assert.doesNotMatch(route, /components\/workspace\.jsx/);
});

test("presentation fixtures are explicitly demo-only and never alter the starter contract", async () => {
  const { demoQuote, demoBars, demoIndicators } = await import(
    "./terminal-demo.mjs"
  );
  for (const instrument of STARTER_UNIVERSE) {
    const quote = demoQuote(instrument);
    assert.equal(quote.source, "demo");
    assert.equal(quote.as_of, "2024-10-28T12:00:00Z");
    assert.ok(Number.isFinite(quote.price));
    for (const timeframe of ["15m", "1h", "4h", "1d"]) {
      const bars = demoBars(instrument, timeframe);
      assert.equal(bars.length, 100);
      assert.deepEqual(bars, demoBars(instrument, timeframe));
      assert.ok(Math.abs(bars.at(-1).close - quote.price) < 1e-8);
      for (let index = 0; index < bars.length; index++) {
        const bar = bars[index];
        assert.ok(bar.high >= Math.max(bar.open, bar.close));
        assert.ok(bar.low <= Math.min(bar.open, bar.close));
        assert.ok(bar.low > 0);
        if (index) assert.ok(bar.time > bars[index - 1].time);
      }
    }
    const indicators = demoIndicators(demoBars(instrument));
    assert.ok(indicators.rsi.every((value) => value >= 0 && value <= 100));
    assert.ok(indicators.macd.every(Number.isFinite));
    assert.equal(instrument.source, "starter");
    assert.equal(instrument.broker_symbol, null);
    assert.equal(instrument.contract_size, null);
  }
});

test("manual position planning validates inputs and uses supplied pip value without broker assumptions", async () => {
  const { calculateManualRisk } = await import("./terminal-demo.mjs");
  assert.deepEqual(
    calculateManualRisk({
      balance: "10000",
      riskPercent: "1",
      stopPips: "50",
      pipValue: "10",
    }),
    { riskAmount: 100, theoreticalLots: 0.2 },
  );
  assert.deepEqual(
    calculateManualRisk({
      balance: 5000,
      riskPercent: 2,
      stopPips: 100,
      pipValue: 5,
    }),
    { riskAmount: 100, theoreticalLots: 0.2 },
  );
  for (const field of ["balance", "riskPercent", "stopPips", "pipValue"]) {
    for (const value of ["", 0, -1, NaN, Infinity, "invalid"]) {
      assert.equal(
        calculateManualRisk({
          balance: 10000,
          riskPercent: 1,
          stopPips: 50,
          pipValue: 10,
          [field]: value,
        }),
        null,
      );
    }
  }
  assert.equal(
    calculateManualRisk({
      balance: 10000,
      riskPercent: 101,
      stopPips: 50,
      pipValue: 10,
    }),
    null,
  );
  assert.equal(
    calculateManualRisk({
      balance: 1e308,
      riskPercent: 100,
      stopPips: 1e-308,
      pipValue: 1e-308,
    }),
    null,
  );
});
