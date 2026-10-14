import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm, symlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CustomerRelay, relayConfig } from "./customer-relay.mjs";
import { makeRelayConfig } from "../components/forex/connection-setup.mjs";
const now = Date.now();
const config = { endpoint: "https://example.com/api/forex/mt5", token: "t".repeat(43),
  channel: "a".repeat(32), server: "VantageMarkets-Demo", expires_at: new Date(now + 60000).toISOString() };
const packet = { server: config.server, sequence: 1 };
const accepted = { accepted: true, requested_symbol_hex: "455552555344", requested_frame: "1h",
  requested_utc_offset_minutes: "180", requested_history_since: String(Math.floor(now / 1000)) };
async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), "customer-relay-"));
  const path = join(directory, `${config.channel}.packet.json`), reply = join(directory, `${config.channel}.reply.json`);
  try { await writeFile(path, JSON.stringify(packet)); await run({ directory, path, reply }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}
test("customer relay preset/config keep upload token outside EA files; only HTTPS and bounded config allowed", () => {
  const value = JSON.parse(makeRelayConfig({ ...config, relay_channel: config.channel }));
  assert.deepEqual(relayConfig(value), config);
  for (const extra of [{ endpoint: "http://localhost:3100/api/forex/mt5" }, { endpoint: "https://example.com/api/forex/mt5?token=x" },
    { token: "bad" }, { channel: "../other" }, { password: "forbidden" }])
    assert.throws(() => relayConfig({ ...config, ...extra }));
});
test("relay sends one packet, retries lost acknowledgements locally, and never writes a token into MT5 Files", async () => {
  await fixture(async ({ directory, path, reply }) => {
    let calls = 0;
    const relay = new CustomerRelay(config, directory, async (endpoint, options) => {
      calls++; assert.equal(endpoint, config.endpoint);
      assert.equal(options.headers.Authorization, `Bearer ${config.token}`);
      assert.equal(options.headers["X-Forex-Retry"], "same-packet");
      assert.equal(options.redirect, "error");
      return Response.json(accepted);
    });
    await mkdir(reply);
    await assert.rejects(relay.pump(now)); // Received HTTP ACK; file replacement failed.
    await rm(reply, { recursive: true });
    await relay.pump(now); assert.equal(calls, 1);
    const body = await readFile(reply, "utf8"); assert.ok(!body.includes(config.token));
    assert.equal(JSON.parse(body).requested_utc_offset_minutes, "180");
    await writeFile(path, JSON.stringify({ ...packet, sequence: 2 }));
    await relay.pump(now); assert.equal(calls, 2);
    await assert.rejects(relay.pump(now + 60001), /PAIRING_EXPIRED/);
  });
});
test("transient network errors receive no file ACK and retry the identical packet", async () => {
  await fixture(async ({ directory, reply }) => {
    let calls = 0;
    const relay = new CustomerRelay(config, directory, async () => {
      calls++; if (calls === 1) throw Error("network"); return Response.json(accepted);
    });
    await assert.rejects(relay.pump(now)); await assert.rejects(readFile(reply));
    await relay.pump(now); assert.equal(calls, 2);
    assert.equal(JSON.parse(await readFile(reply)).status, "200");
  });
});
test("relay rejects symlinks, oversized files and a different server before sending", async () => {
  await fixture(async ({ directory, path, reply }) => {
    let calls = 0;
    const relay = new CustomerRelay(config, directory, async () => { calls++; return Response.json(accepted); });
    await writeFile(path, JSON.stringify({ ...packet, server: "Other-Demo" }));
    await assert.rejects(relay.pump(now), /SERVER_MISMATCH/);
    await writeFile(path, "x".repeat(512001)); await assert.rejects(relay.pump(now), /INVALID_FILE/);
    await rm(path); const other = join(directory, "other.json");
    await writeFile(other, JSON.stringify(packet)); await symlink(other, path);
    await assert.rejects(relay.pump(now), /INVALID_FILE/); assert.equal(calls, 0);
    await assert.rejects(readFile(reply));
  });
});
