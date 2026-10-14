import { resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { receiverConfiguration } from "./runtime-policy.mjs";
import { connectorEndpoint } from "../components/forex/connection-setup.mjs";
import { VANTAGE_SERVER_CATALOG } from "./vantage-servers.mjs";

// Read-only release checks. A passing report is not proof of DNS/TLS/login/remote terminal operation.
export function customerPreflight(env = process.env) {
  const config = receiverConfiguration(env);
  let endpoint = null, lineReady = false;
  try {
    endpoint = connectorEndpoint(env.APP_ORIGIN);
    const redirect = new URL(env.LINE_REDIRECT_URI);
    lineReady = redirect.protocol === "https:" && redirect.origin === new URL(env.APP_ORIGIN).origin &&
      redirect.pathname === "/api/auth/line/callback" && !redirect.search && !redirect.hash &&
      Boolean(env.LINE_CHANNEL_ID && env.LINE_CHANNEL_SECRET && env.SESSION_SECRET?.length >= 32 && env.PORTFOLIO_HASH_SECRET?.length >= 32);
  } catch { /* Configuration not yet ready. No secret values enter this report. */ }
  const checks = {
    production_node_runtime: env.NODE_ENV === "production",
    forex_receiver_enabled: config.enabled,
    https_origin_configured: Boolean(endpoint),
    explicit_known_servers: config.servers.length > 0 && config.servers.every(s => VANTAGE_SERVER_CATALOG.includes(s)),
    existing_line_login_configured: lineReady,
    persistent_forex_database: isAbsolute(config.databasePath) && env.FOREX_MT5_PERSISTENT_STORAGE === "true",
    local_shortcut_disabled: env.FOREX_MT5_LOCAL_MODE !== "true" && env.FOREX_MT5_MEMBER_LOCAL_FILES !== 'true' && !env.FOREX_MT5_LOCAL_FILES_PATH,
  };
  return { configuration_ready: Object.values(checks).every(Boolean), checks,
    endpoint, server_count: config.servers.length,
    remaining: Object.keys(checks).filter(key => !checks[key]),
    remote_verification_required: ["DNS/TLS", "existing LINE sign-in and member isolation", "Mac and Windows customer terminal ingestion", "persistent storage and backup restore"] };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const report = customerPreflight(); console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.configuration_ready ? 0 : 1;
}
