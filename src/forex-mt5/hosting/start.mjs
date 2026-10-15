import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { customerPreflight } from "../customer-preflight.mjs";
import { existsSync, realpathSync } from "node:fs";

const actualPath = path => existsSync(resolve(path)) ? realpathSync(resolve(path)) : resolve(path);
// Keep filesystem checks in the Node hosting launcher. The shared preflight is
// also bundled by main's Cloudflare app and must remain runtime portable.
export function hostingPreflight(env = process.env) {
  const report = customerPreflight(env);
  const database = env.FOREX_MT5_DATABASE_PATH || "data/forex-mt5.sqlite";
  const checks = { ...report.checks,
    database_outside_managed_releases: !/(?:^|[\\/])(?:hbuilds|public_html|releases|\.next|\.next-review)(?:[\\/]|$)/i.test(database),
    separate_forex_database: actualPath(database) !== actualPath(env.DATABASE_PATH || "data/nugaom.sqlite"),
    separate_public_host_valid: !env.SITE_HOST || (Boolean(report.endpoint) && new URL(report.endpoint).host === env.SITE_HOST &&
      /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(env.SITE_HOST)),
  };
  return { ...report, checks, configuration_ready: Object.values(checks).every(Boolean),
    remaining: Object.keys(checks).filter(key => !checks[key]) };
}

export function launchReadiness(env = process.env) {
  const report = hostingPreflight(env);
  if (env.FOREX_MT5_PREVIEW !== "true") return { ready: report.configuration_ready, remaining: report.remaining };
  // A preview can run before LINE setup, but can never ingest or pair customer terminals.
  const checks = {
    production_node_runtime: report.checks.production_node_runtime,
    https_origin_configured: report.checks.https_origin_configured,
    separate_public_host_valid: report.checks.separate_public_host_valid,
    separate_forex_database: report.checks.separate_forex_database,
    database_outside_managed_releases: report.checks.database_outside_managed_releases,
    persistent_forex_database: report.checks.persistent_forex_database,
    local_shortcut_disabled: report.checks.local_shortcut_disabled,
    preview_ingestion_disabled: env.FOREX_MT5_ENABLED === "false",
  };
  return { ready: Object.values(checks).every(Boolean), remaining: Object.keys(checks).filter(key => !checks[key]) };
}
export function customerStartOptions(env = process.env) {
  const report = launchReadiness(env);
  if (!report.ready) return { ready: false, remaining: report.remaining };
  const port = env.PORT || "3000";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    return { ready: false, remaining: ["valid_port"] };
  return { ready: true, port, hostname: env.HOST || "127.0.0.1" };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = customerStartOptions();
  if (!options.ready) {
    console.error(JSON.stringify({ error: "CUSTOMER_SETUP_REQUIRED", remaining: options.remaining }));
    process.exitCode = 1;
  } else if (process.argv.includes("--check")) {
    console.log(JSON.stringify({ configuration_ready: true }));
  } else {
    const child = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start",
      "--hostname", options.hostname, "--port", options.port], { stdio: "inherit" });
    for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
    child.on("error", () => { console.error("CUSTOMER_SERVER_START_FAILED"); process.exitCode = 1; });
    child.on("exit", code => { process.exitCode = code ?? 1; });
  }
}
