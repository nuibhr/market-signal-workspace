import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { customerPreflight } from "../customer-preflight.mjs";

export function customerStartOptions(env = process.env) {
  const report = customerPreflight(env);
  if (!report.configuration_ready) return { ready: false, remaining: report.remaining };
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
