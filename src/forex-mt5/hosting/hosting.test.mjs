import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, symlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { customerPreflight } from "../customer-preflight.mjs";
import { customerStartOptions } from "./start.mjs";
const env = { NODE_ENV: "production", APP_ORIGIN: "https://forex.example.com", SITE_HOST: "forex.example.com",
  FOREX_MT5_ENABLED: "true", FOREX_MT5_VANTAGE_SERVERS: "VantageMarkets-Demo",
  FOREX_MT5_DATABASE_PATH: "/var/lib/nugaom/forex/bridge.sqlite", FOREX_MT5_PERSISTENT_STORAGE: "true",
  LINE_REDIRECT_URI: "https://forex.example.com/api/auth/line/callback", LINE_CHANNEL_ID: "fixture",
  LINE_CHANNEL_SECRET: "fixture", SESSION_SECRET: "s".repeat(32), PORTFOLIO_HASH_SECRET: "p".repeat(32) };
test("customer launcher rejects incomplete host configuration before starting a web process", () => {
  assert.deepEqual(customerStartOptions(env), { ready: true, hostname: "127.0.0.1", port: "3000" });
  for (const extra of [{ APP_ORIGIN: "" }, { SITE_HOST: "other.example.com" }, { LINE_CHANNEL_SECRET: "" },
    { PORT: "0" }, { PORT: "65536" }, { PORT: "3000 --other" }, { FOREX_MT5_LOCAL_MODE: "true" }])
    assert.equal(customerStartOptions({ ...env, ...extra }).ready, false);
});
test("customer storage must differ from membership even through a symlink, and avoid managed deployment folders", () => {
  const folder = mkdtempSync(join(tmpdir(), "forex-preflight-"));
  try {
    const database = join(folder, "membership.sqlite"), alias = join(folder, "alias.sqlite");
    writeFileSync(database, "fixture"); symlinkSync(database, alias);
    for (const path of [database, alias]) assert.equal(customerPreflight({ ...env, DATABASE_PATH: database,
      FOREX_MT5_DATABASE_PATH: path }).checks.separate_forex_database, false);
  } finally { rmSync(folder, { recursive: true, force: true }); }
  for (const path of ["/home/user/domains/site/hbuilds/current/nodejs/data/db.sqlite",
    "/home/user/domains/site/public_html/db.sqlite", "/app/.next/db.sqlite"])
    assert.equal(customerPreflight({ ...env, FOREX_MT5_DATABASE_PATH: path }).checks.database_outside_managed_releases, false);
});
test("managed hosting preview keeps market ingestion and development pairing disabled", () => {
  const source = readFileSync(new URL("./hostinger-preview.env.example", import.meta.url), "utf8");
  assert.match(source, /^FOREX_MT5_ENABLED=false$/m);
  assert.match(source, /^FOREX_MT5_LOCAL_MODE=false$/m);
  assert.match(source, /^FOREX_MT5_PERSISTENT_STORAGE=false$/m);
});
