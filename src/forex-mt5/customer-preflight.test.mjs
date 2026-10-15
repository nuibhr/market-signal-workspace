import test from "node:test";
import assert from "node:assert/strict";
import { customerPreflight } from "./customer-preflight.mjs";
import { VANTAGE_SERVER_CATALOG } from "./vantage-servers.mjs";
const env = { NODE_ENV: "production", APP_ORIGIN: "https://example.com", FOREX_MT5_ENABLED: "true",
  FOREX_MT5_VANTAGE_SERVERS: VANTAGE_SERVER_CATALOG.join(","), FOREX_MT5_DATABASE_PATH: "/var/lib/nugaom/forex-mt5.sqlite",
  FOREX_MT5_PERSISTENT_STORAGE: "true", LINE_REDIRECT_URI: "https://example.com/api/auth/line/callback",
  LINE_CHANNEL_ID: "example", LINE_CHANNEL_SECRET: "secret", SESSION_SECRET: "s".repeat(32), PORTFOLIO_HASH_SECRET: "p".repeat(32) };
test("customer preflight requires HTTPS, existing LINE configuration, explicit servers and persistent Node storage", () => {
  assert.equal(customerPreflight(env).configuration_ready, true);
  for (const extra of [{ NODE_ENV: "development" }, { APP_ORIGIN: "http://localhost:3100" },
    { FOREX_MT5_VANTAGE_SERVERS: "VantageMarkets-Live*" }, { LINE_REDIRECT_URI: "https://other.com/api/auth/line/callback" },
    { SESSION_SECRET: "" }, { FOREX_MT5_LOCAL_MODE: "true" }, { FOREX_MT5_DATABASE_PATH: "data/forex.sqlite" },
    { FOREX_MT5_PERSISTENT_STORAGE: "false" }]) assert.equal(customerPreflight({ ...env, ...extra }).configuration_ready, false);
  const report = JSON.stringify(customerPreflight(env));
  assert.ok(!report.includes(env.SESSION_SECRET)); assert.ok(!report.includes(env.PORTFOLIO_HASH_SECRET));
  assert.ok(customerPreflight({}).remaining.includes("https_origin_configured"));
});
