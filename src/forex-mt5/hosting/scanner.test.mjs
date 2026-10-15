import test from "node:test";
import assert from "node:assert/strict";
import { scannerReadiness } from "./scanner.mjs";

test("continuous Swing worker requires both main readiness and the actual signal data provider", () => {
  const readiness = { markets: [{ id: "us", status: "active" }, { id: "tfex", status: "blocked" }] };
  // An EOD-only FMP configuration cannot supply the US Swing intraday frames.
  assert.equal(scannerReadiness(readiness, () => false).ready, false);
  assert.deepEqual(scannerReadiness(readiness, m => m === "us"), {
    ready: true, markets: [{ market: "us", sourceReady: true }],
  });
  assert.equal(scannerReadiness({ markets: [] }, () => true).ready, false);
  assert.equal(scannerReadiness({ markets: [{ id: "thai", status: "blocked" }] }, () => true).ready, false);
});
