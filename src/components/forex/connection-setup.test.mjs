import test from "node:test";
import assert from "node:assert/strict";
import { connectorEndpoint, makePreset, utf16Preset } from "./connection-setup.mjs";
import { VANTAGE_SERVER_CATALOG } from "../../forex-mt5/vantage-servers.mjs";

test("customer server catalog preserves all nineteen screenshot labels without inventing missing numbers", () => {
  assert.equal(VANTAGE_SERVER_CATALOG.length, 19);
  assert.equal(new Set(VANTAGE_SERVER_CATALOG).size, 19);
  assert.ok(VANTAGE_SERVER_CATALOG.includes("VantageMarkets-Live 21"));
  assert.ok(VANTAGE_SERVER_CATALOG.includes("VantageMarkets-Demo"));
  assert.ok(!VANTAGE_SERVER_CATALOG.includes("VantageMarkets-Live 16"));
});
test("customer preset binds the issued key and exact server; UTF16 BOM/CRLF loads in MT5", () => {
  const token = "t".repeat(43);
  const text = makePreset({ endpoint: "https://example.com/api/forex/mt5",
    server: "VantageMarkets-Live 15", token });
  assert.match(text, /LocalFiles=false\r\n/);
  assert.match(text, /ExpectedServer=VantageMarkets-Live 15\r\n/);
  assert.ok(text.includes(`BridgeToken=${token}\r\n`));
  assert.match(text, /AutoDetectServerTime=true/);
  const bytes = utf16Preset(text);
  assert.deepEqual([...bytes.slice(0, 2)], [255, 254]);
  assert.equal(new TextDecoder("utf-16le").decode(bytes), text);
  const local = makePreset({ endpoint: "http://localhost:3100/api/forex/mt5",
    server: "VantageMarkets-Demo", channel: "f".repeat(32), token });
  assert.match(local, /LocalFiles=true\r\n/);
  assert.match(local, /BridgeToken=\r\n/);
  assert.ok(!local.includes(token));
});
test("presets prevent line injection, credential URLs and non-HTTPS remote endpoints", () => {
  for (const origin of ["http://example.com", "https://example.com/path", "https://u:p@example.com",
    "https://example.com?token=x", "https://example.com#x", "https://example.com\n", "http://localhost:3100"])
    assert.throws(() => connectorEndpoint(origin));
  assert.equal(connectorEndpoint("http://localhost:3100", true), "http://localhost:3100/api/forex/mt5");
  for (const extra of [{ server: "VantageMarkets-Demo\r\nLocalFiles=true" },
    { token: "invalid" }, { endpoint: "https://example.com/api/forex/mt5?token=x" },
    { channel: "../foreign" }]) assert.throws(() => makePreset({
      server: "VantageMarkets-Demo", token: "t".repeat(43),
      endpoint: "https://example.com/api/forex/mt5", ...extra }));
});
