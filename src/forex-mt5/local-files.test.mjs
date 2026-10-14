import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  symlink,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ForexStore } from "./store.mjs";
import { LocalFilesBridge, localFileDirectory } from "./local-files.mjs";
const now = Date.now();
const config = { enabled: true, local: true, servers: ["VantageMarkets-Demo"] };
const metadata = (symbol) => ({
  broker_symbol: symbol,
  canonical_symbol: null,
  category: "fx",
  description: symbol,
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
  session: null,
});
const packet = (sequence, extra = {}) => ({
  schema_version: 1,
  broker_id: "vantage",
  server: "VantageMarkets-Demo",
  company: "Vantage Global Limited",
  sent_at: new Date(now).toISOString().replace(/\.\d{3}Z$/, "Z"),
  sequence,
  kind: "universe",
  sync_id: 1,
  part: 0,
  parts: 1,
  instruments: [metadata("EURUSD")],
  ...extra,
});
async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), "forex-local-files-"));
  const store = new ForexStore(),
    bridge = new LocalFilesBridge();
  const pairing = store.pair("alice", config.servers[0], config, now);
  const { channel } = await bridge.start("alice", pairing, directory, now);
  const path = join(directory, `${channel}.packet.json`),
    reply = join(directory, `${channel}.reply.json`);
  const pump = () => bridge.pump("alice", store, config, now);
  try {
    await run({
      directory,
      store,
      bridge,
      pairing,
      channel,
      path,
      reply,
      pump,
    });
  } finally {
    store.db.close();
    await rm(directory, { recursive: true, force: true });
  }
}
test("local file capability requires development/local opt-in and an absolute operator path", () => {
  const env = {
    NODE_ENV: "development",
    FOREX_MT5_LOCAL_MODE: "true",
    FOREX_MT5_LOCAL_FILES_PATH: "/tmp/mt5",
  };
  assert.equal(localFileDirectory(env), "/tmp/mt5");
  assert.equal(localFileDirectory({ ...env, NODE_ENV: "production" }), null);
  assert.equal(
    localFileDirectory({ ...env, FOREX_MT5_LOCAL_FILES_PATH: "../mt5" }),
    null,
  );
  assert.equal(
    localFileDirectory({ ...env, FOREX_MT5_LOCAL_MODE: "false" }),
    null,
  );
});
test("file handshake preserves atomic chunks, owner isolation, retry acknowledgement, and revocation without token files", async () => {
  await fixture(
    async ({ store, bridge, pairing, channel, path, reply, pump }) => {
      assert.match(channel, /^[a-f0-9]{32}$/);
      await writeFile(
        path,
        JSON.stringify(
          packet(1, {
            parts: 2,
            instruments: Array.from({ length: 100 }, (_, i) =>
              metadata(`TEST${i}`),
            ),
          }),
        ),
      );
      await pump();
      assert.equal(store.view("alice", config, {}, now).snapshot, null);
      assert.equal(JSON.parse(await readFile(reply)).status, "200");
      await rm(reply);
      await mkdir(reply); // Simulate a failed acknowledgement write.
      await pump();
      assert.equal(bridge.state("alice", now).error, "LOCAL_FILES_UNAVAILABLE");
      await rm(reply, { recursive: true });
      await pump(); // Lost acknowledgement must not become a replay rejection.
      assert.equal(JSON.parse(await readFile(reply)).status, "200");
      assert.equal(bridge.state("alice", now).error, null);
      await writeFile(path, JSON.stringify(packet(2, { part: 1, parts: 2 })));
      await pump();
      assert.equal(
        store.view("alice", config, {}, now).snapshot.instruments.length,
        101,
      );
      assert.equal(store.view("bob", config, {}, now).snapshot, null);
      assert.equal(bridge.state("bob", now), null);
      assert.ok(!(await readFile(reply, "utf8")).includes(pairing.token));
      assert.ok(!(await readFile(path, "utf8")).includes(pairing.token));
      store.revoke("alice");
      await writeFile(
        path,
        JSON.stringify(
          packet(3, {
            kind: "feed",
            sync_id: undefined,
            part: undefined,
            parts: undefined,
            instruments: undefined,
            quotes: [],
            chart: null,
          }),
        ),
      );
      await pump();
      assert.equal(JSON.parse(await readFile(reply)).status, "401");
      assert.equal(bridge.state("alice", now).error, "INVALID_CONNECTOR_TOKEN");
      bridge.stop("alice");
      assert.equal(bridge.state("alice", now), null);
    },
  );
});
test("files reject credential fields, foreign servers, oversized and symlink input; partial writes can recover", async () => {
  await fixture(async ({ store, bridge, directory, path, reply, pump }) => {
    await writeFile(path, '{"sequence":');
    await pump();
    assert.equal(bridge.state("alice", now).error, "INVALID_JSON");
    await writeFile(
      path,
      JSON.stringify(packet(1, { password: "synthetic forbidden field" })),
    );
    await pump();
    assert.equal(JSON.parse(await readFile(reply)).status, "400");
    await writeFile(path, JSON.stringify(packet(2, { server: "Other-Demo" })));
    await pump();
    assert.equal(JSON.parse(await readFile(reply)).status, "403");
    assert.equal(store.view("alice", config, {}, now).snapshot, null);
    await writeFile(path, "x".repeat(512001));
    await pump();
    assert.equal(bridge.state("alice", now).error, "INVALID_LOCAL_FILE");
    await rm(path);
    const external = join(directory, "external.json");
    await writeFile(external, JSON.stringify(packet(3)));
    await symlink(external, path);
    await pump();
    assert.equal(store.view("alice", config, {}, now).snapshot, null);
    await rm(path);
    await writeFile(path, JSON.stringify(packet(3)));
    await pump();
    assert.equal(
      store.view("alice", config, {}, now).snapshot.instruments.length,
      1,
    );
    assert.equal(bridge.state("alice", now).error, null);
    assert.equal(bridge.state("alice", now + 8 * 86400000), null);
  });
});
