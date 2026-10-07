import { FOREX_CATEGORIES } from "../components/forex/symbol-universe.mjs";

export class BridgeError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.status = status;
  }
}
export const fail = (condition, code = "INVALID_PACKET", status = 400) => {
  if (!condition) throw new BridgeError(code, status);
};
const categories = new Set(FOREX_CATEGORIES.map((item) => item.id));
export const FRAMES = Object.freeze({
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
});
export function textValue(value, max = 128) {
  fail(
    typeof value === "string" &&
      value.length > 0 &&
      value.length <= max &&
      !/[\x00-\x1f\x7f]/.test(value),
  );
  return value;
}
function exactKeys(value, keys) {
  fail(value && typeof value === "object" && !Array.isArray(value));
  fail(
    Object.keys(value).every((key) => keys.includes(key)),
    "UNSUPPORTED_FIELDS",
  );
}
function finite(value, min = 0, max = 1e15) {
  fail(
    typeof value === "number" &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max,
  );
  return value;
}
const optionalNumber = (value, min = 0, max = 1e15) =>
  value === null ? null : finite(value, min, max);
const optionalString = (value) => (value === null ? null : textValue(value));
export function configuration(env = process.env) {
  const servers = [
    ...new Set(
      (env.FOREX_MT5_VANTAGE_SERVERS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  return {
    enabled: env.FOREX_MT5_ENABLED === "true",
    servers,
    local:
      env.NODE_ENV === "development" && env.FOREX_MT5_LOCAL_MODE === "true",
    databasePath: env.FOREX_MT5_DATABASE_PATH || "data/forex-mt5.sqlite",
  };
}
export function assertIdentity(server, company, config) {
  textValue(server);
  textValue(company);
  fail(
    config.servers.includes(server) && /\bvantage\b/i.test(company),
    "BROKER_NOT_ALLOWED",
    403,
  );
}
export function instrument(row, server) {
  const keys = [
    "broker_symbol",
    "canonical_symbol",
    "category",
    "description",
    "digits",
    "point",
    "contract_size",
    "volume_min",
    "volume_max",
    "volume_step",
    "currency_base",
    "currency_profit",
    "currency_margin",
    "trade_mode",
    "session",
  ];
  exactKeys(row, keys);
  fail(keys.every((key) => Object.hasOwn(row, key)));
  const symbol = textValue(row.broker_symbol);
  fail(row.category === null || categories.has(row.category));
  fail(row.digits === null || Number.isInteger(row.digits));
  fail(row.trade_mode === null || Number.isInteger(row.trade_mode));
  const result = {
    ...row,
    id: `mt5:${encodeURIComponent("vantage")}:${encodeURIComponent(server)}:${encodeURIComponent(symbol)}`,
    source: "mt5",
    broker_id: "vantage",
    server,
    display_symbol: symbol,
    canonical_symbol: optionalString(row.canonical_symbol),
    description: textValue(row.description, 512),
    digits: optionalNumber(row.digits, 0, 12),
    point: optionalNumber(row.point, 1e-12),
    contract_size: optionalNumber(row.contract_size),
    volume_min: optionalNumber(row.volume_min),
    volume_max: optionalNumber(row.volume_max),
    volume_step: optionalNumber(row.volume_step),
    currency_base: optionalString(row.currency_base),
    currency_profit: optionalString(row.currency_profit),
    currency_margin: optionalString(row.currency_margin),
    trade_mode: optionalNumber(row.trade_mode, 0, 4),
  };
  fail(
    result.volume_min === null ||
      result.volume_max === null ||
      result.volume_min <= result.volume_max,
  );
  if (row.session !== null) {
    exactKeys(row.session, ["timezone", "intervals"]);
    fail(
      row.session.timezone === "broker-server" &&
        Array.isArray(row.session.intervals) &&
        row.session.intervals.length <= 100,
    );
    for (const interval of row.session.intervals) {
      exactKeys(interval, ["day", "open", "close"]);
      fail(
        Number.isInteger(interval.day) &&
          interval.day >= 0 &&
          interval.day <= 6,
      );
      fail(
        [interval.open, interval.close].every(
          (value) =>
            typeof value === "string" &&
            /^(?:(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d|24:00:00)$/.test(value),
        ),
      );
    }
  }
  return result;
}
export function validatePacket(packet, config, now = Date.now()) {
  exactKeys(packet, [
    "schema_version",
    "broker_id",
    "server",
    "company",
    "sent_at",
    "sequence",
    "kind",
    "sync_id",
    "part",
    "parts",
    "instruments",
    "quotes",
    "chart",
  ]);
  fail(packet.schema_version === 1 && packet.broker_id === "vantage");
  assertIdentity(packet.server, packet.company, config);
  fail(Number.isSafeInteger(packet.sequence) && packet.sequence > 0);
  fail(
    typeof packet.sent_at === "string" &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(packet.sent_at),
  );
  const stamp = Date.parse(packet.sent_at);
  fail(
    Number.isFinite(stamp) && stamp >= now - 120000 && stamp <= now + 30000,
    "CLOCK_OUT_OF_RANGE",
  );
  if (packet.kind === "universe") {
    fail(Number.isSafeInteger(packet.sync_id) && packet.sync_id > 0);
    fail(
      Number.isInteger(packet.parts) && packet.parts > 0 && packet.parts <= 200,
    );
    fail(
      Number.isInteger(packet.part) &&
        packet.part >= 0 &&
        packet.part < packet.parts,
    );
    fail(
      Array.isArray(packet.instruments) &&
        packet.instruments.length > 0 &&
        packet.instruments.length <= 100,
    );
    fail(
      packet.part === packet.parts - 1 || packet.instruments.length === 100,
      "INCONSISTENT_SYNC",
    );
    fail(!Object.hasOwn(packet, "quotes") && !Object.hasOwn(packet, "chart"));
    return {
      ...packet,
      instruments: packet.instruments.map((row) =>
        instrument(row, packet.server),
      ),
    };
  }
  fail(
    packet.kind === "feed" &&
      !["sync_id", "part", "parts", "instruments"].some((key) =>
        Object.hasOwn(packet, key),
      ),
  );
  fail(Array.isArray(packet.quotes) && packet.quotes.length <= 100);
  for (const quote of packet.quotes) {
    exactKeys(quote, ["broker_symbol", "bid", "ask", "time"]);
    textValue(quote.broker_symbol);
    finite(quote.bid, Number.MIN_VALUE);
    finite(quote.ask, quote.bid);
    fail(
      Number.isSafeInteger(quote.time) &&
        quote.time > 0 &&
        quote.time * 1000 <= now + 30000,
    );
  }
  if (packet.chart !== null) {
    exactKeys(packet.chart, [
      "broker_symbol",
      "timeframe",
      "bars",
      "utc_offset_minutes",
    ]);
    textValue(packet.chart.broker_symbol);
    fail(Object.hasOwn(FRAMES, packet.chart.timeframe));
    fail(
      Number.isInteger(packet.chart.utc_offset_minutes) &&
        Math.abs(packet.chart.utc_offset_minutes) <= 840,
    );
    fail(
      Array.isArray(packet.chart.bars) &&
        packet.chart.bars.length > 0 &&
        packet.chart.bars.length <= 300,
    );
    let previous = 0;
    for (const bar of packet.chart.bars) {
      exactKeys(bar, ["time", "open", "high", "low", "close", "volume"]);
      fail(
        Number.isSafeInteger(bar.time) &&
          bar.time > previous &&
          bar.time * 1000 <= now + 30000,
      );
      previous = bar.time;
      for (const key of ["open", "high", "low", "close"])
        finite(bar[key], Number.MIN_VALUE);
      finite(bar.volume);
      fail(
        bar.low <= Math.min(bar.open, bar.close) &&
          bar.high >= Math.max(bar.open, bar.close),
      );
    }
  }
  return packet;
}
