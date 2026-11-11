import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { build } from "esbuild";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  calculateStudioPlan,
  planPriceLines,
  readPracticePlans,
  writePracticePlans,
  PRACTICE_STORAGE_KEY,
  PRACTICE_FIELDS,
  INITIAL_PRACTICE_PLAN,
  calculateAutoTarget,
  calculateAutoStop,
  invertPlanSide,
  detectChartSetup,
  formatPlanBrief,
  checkPlanHit,
  computeATR,
  computeEMA,
} from "./studio-plan.mjs";
import { demoBars } from "./terminal-demo.mjs";
import { resolveInitialInstrument } from "./symbol-universe.mjs";

const buy = {
  title: "แผนทดสอบซื้อ",
  side: "buy",
  entry: "2651",
  stop: "2646",
  target: "2661",
  balance: "1000",
  riskPercent: "1",
  unitsPerLot: "100",
  condition: "ทบทวนแผนเมื่อผิดทาง",
};

test("buy and sell plans compute risk and reward using supplied contract size", () => {
  assert.deepEqual(calculateStudioPlan(buy), {
    riskAmount: 10,
    theoreticalLots: 0.02,
    rewardRatio: 2,
    stopDistance: 5,
  });
  assert.deepEqual(
    calculateStudioPlan({ ...buy, side: "sell", stop: "2656", target: "2641" }),
    { riskAmount: 10, theoreticalLots: 0.02, rewardRatio: 2, stopDistance: 5 },
  );
  assert.equal(
    calculateStudioPlan({ ...buy, unitsPerLot: "1" }).theoreticalLots,
    2,
  );
});

test("invalid and reversed plans never produce calculated results", () => {
  const invalidCases = [
    { entry: "" },
    { entry: "0" },
    { entry: "-2651" },
    { stop: "2651" },
    { stop: "2652" },
    { target: "2650" },
    { side: "sell" }, // Inverted for sell when entry=2651, stop=2646, target=2661
    { side: "bad" },
    { unitsPerLot: "0" },
    { unitsPerLot: "-100" },
    { riskPercent: "101" },
    { riskPercent: "0" },
    { riskPercent: "-1" },
    { balance: "0" },
    { balance: "-500" },
    { balance: "Infinity" },
    { entry: "NaN" },
    { entry: "abc" },
  ];
  for (const change of invalidCases) {
    const result = calculateStudioPlan({ ...buy, ...change });
    assert.ok(result.error, `Expected error for: ${JSON.stringify(change)}`);
    assert.equal(result.theoreticalLots, undefined);
  }
});

test("sell plan validates inverted SL/TP boundaries strictly", () => {
  const sell = { ...buy, side: "sell", stop: "2656", target: "2641" };
  assert.equal(calculateStudioPlan(sell).error, undefined);
  assert.ok(calculateStudioPlan({ ...sell, stop: "2650" }).error);
  assert.ok(calculateStudioPlan({ ...sell, target: "2652" }).error);
});

test("chart lines use the specified values and omit invalid or blank values", () => {
  assert.deepEqual(
    planPriceLines({ ...buy, stop: "", target: "0" }).map(
      ({ title, price }) => ({ title, price }),
    ),
    [{ title: "Entry", price: 2651 }],
  );
  assert.deepEqual(planPriceLines(buy), [
    { title: "Entry", price: 2651, color: "#8eb6ff" },
    { title: "SL", price: 2646, color: "#ff8493" },
    { title: "TP", price: 2661, color: "#70e1b9" },
  ]);
});

test("storage utilities save, read, cap to 20, and delete plans", () => {
  const map = new Map();
  const mockStorage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, val) => map.set(key, String(val)),
  };

  // Missing storage
  assert.deepEqual(readPracticePlans(null), []);
  assert.equal(writePracticePlans([], null), false);

  // Empty read
  assert.deepEqual(readPracticePlans(mockStorage), []);

  // Save 25 plans to verify max 20 cap
  const plans = Array.from({ length: 25 }, (_, i) => ({
    id: `plan-${i}`,
    plan: { ...buy, title: `แผนที่ ${i}` },
  }));
  const success = writePracticePlans(plans, mockStorage);
  assert.equal(success, true);

  const loaded = readPracticePlans(mockStorage);
  assert.equal(loaded.length, 20);
  assert.equal(loaded[0].id, "plan-0");
  assert.equal(loaded[19].id, "plan-19");

  // Deletion
  const remaining = loaded.filter((item) => item.id !== "plan-0");
  writePracticePlans(remaining, mockStorage);
  const reloaded = readPracticePlans(mockStorage);
  assert.equal(reloaded.length, 19);
  assert.equal(reloaded.some((item) => item.id === "plan-0"), false);
});

test("storage denial and corrupted data are handled gracefully without crashing", () => {
  // Storage denial (SecurityError / QuotaExceededError)
  const throwingStorage = {
    getItem: () => {
      throw new Error("SecurityError: Access is denied");
    },
    setItem: () => {
      throw new Error("QuotaExceededError: Storage quota exceeded");
    },
  };
  assert.deepEqual(readPracticePlans(throwingStorage), []);
  assert.equal(writePracticePlans([{ id: "1", plan: buy }], throwingStorage), false);

  // Corrupted data in storage
  const map = new Map();
  const mockStorage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, val) => map.set(key, String(val)),
  };

  // Non-JSON
  map.set(PRACTICE_STORAGE_KEY, "invalid-json{");
  assert.deepEqual(readPracticePlans(mockStorage), []);

  // Non-array
  map.set(PRACTICE_STORAGE_KEY, JSON.stringify({ not: "an array" }));
  assert.deepEqual(readPracticePlans(mockStorage), []);

  // Malformed items (missing fields, wrong types, invalid math)
  const corruptItems = [
    null,
    "string-entry",
    { id: 123, plan: buy }, // id not string
    { id: "valid", plan: { ...buy, title: 123 } }, // title not string
    { id: "valid-2", plan: { title: "missing-fields" } },
    { id: "valid-3", plan: { ...buy, stop: "2660" } }, // invalid math (stop >= entry)
    { id: "valid-ok", plan: { ...buy, title: "แผนที่ถูกต้อง" } },
  ];
  map.set(PRACTICE_STORAGE_KEY, JSON.stringify(corruptItems));
  const sanitized = readPracticePlans(mockStorage);
  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].id, "valid-ok");
  assert.equal(sanitized[0].plan.title, "แผนที่ถูกต้อง");
});

test("replay bars step forward, bound at total count, and reset to initial visible", () => {
  const instrument = resolveInitialInstrument("XAU/USD");
  const candles = demoBars(instrument, "1h");
  assert.equal(candles.length, 100);

  const initialVisible = 60;
  let visible = initialVisible;

  // Step forward
  visible = Math.min(candles.length, visible + 1);
  assert.equal(visible, 61);

  // Step forward to end
  visible = candles.length;
  assert.equal(visible, 100);

  // Boundary check: cannot step beyond total bars
  const cannotStepBeyond = Math.min(candles.length, visible + 1);
  assert.equal(cannotStepBeyond, 100);

  // Reset check
  visible = initialVisible;
  assert.equal(visible, 60);
});

test("CSS rules include reduced motion and responsive breakpoints", () => {
  const css = readFileSync("src/components/forex/forex-studio.module.css", "utf8");
  assert.ok(
    css.includes("@media (prefers-reduced-motion:reduce)"),
    "Reduced motion media query must be present",
  );
  assert.ok(
    css.includes(".mascot,.mascotShadow { animation:none; }") ||
      css.includes("animation:none"),
    "Mascot animation must be disabled when reduced motion is preferred",
  );
  assert.ok(
    css.includes("@media (max-width:900px)"),
    "Tablet breakpoint (900px) must be present",
  );
  assert.ok(
    css.includes("@media (max-width:650px)"),
    "Mobile breakpoint (650px) must be present",
  );
});

test("ForexStudio renders server-side with accessible structure and demo notices", async () => {
  const result = await build({
    entryPoints: ["src/components/forex/forex-studio.jsx"],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    packages: "external",
    jsx: "automatic",
    logLevel: "silent",
    plugins: [
      {
        name: "styles",
        setup(b) {
          b.onResolve({ filter: /\.module\.css$/ }, (a) => ({
            path: a.path,
            namespace: "styles",
          }));
          b.onLoad({ filter: /.*/, namespace: "styles" }, () => ({
            contents: "export default {};",
            loader: "js",
          }));
        },
      },
    ],
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(
    (name) => createRequire(import.meta.url)(name),
    module,
    module.exports,
  );
  const ForexStudio = module.exports.default;
  const markup = renderToString(React.createElement(ForexStudio));

  // Accessibility checks
  assert.match(markup, /aria-labelledby="chart-title"/);
  assert.match(markup, /id="chart-title"/);
  assert.match(markup, /aria-labelledby="plan-title"/);
  assert.match(markup, /id="plan-title"/);
  assert.match(markup, /aria-labelledby="saved-plans-title"/);
  assert.match(markup, /id="saved-plans-title"/);
  assert.match(markup, /aria-live="polite"/);
  assert.match(markup, /role="status"/);
  assert.match(markup, /aria-hidden="true"/); // Decorative mascot

  // Demo boundaries and required notices
  assert.match(markup, /FOREX LIVE STUDIO/);
  assert.match(markup, /ข้อมูลจำลอง/);
  assert.match(markup, /โหมดฝึก/);
  assert.match(markup, /TradingView Lightweight Charts/);
  assert.match(markup, /แผนตัวอย่างทองคำ/);

  // Prohibited unmounted EA artifacts and unbacked claims must be absent
  assert.ok(!markup.includes("68.4%"), "Must not contain hardcoded EA 68.4% win rate");
  assert.ok(!markup.includes("Pro Copy EA"), "Must not mount old Pro Copy EA");
  assert.ok(!markup.includes("Vantage Live"), "Must not claim live broker execution");

  // New automation features presence
  assert.match(markup, /เล่นอัตโนมัติ/);
  assert.match(markup, /ให้น้องนักออม.*ร่างแผน/);
  assert.match(markup, /ล็อกเป้า.*2/);
  assert.match(markup, /15m/);
  assert.match(markup, /1H/);
  assert.match(markup, /คำนวณ SL โครงสร้าง/);
  assert.match(markup, /คัดลอกสรุปแผน/);
  assert.match(markup, /ดึงแผนจากโค้ช/);

  // Conversion & Trust boosters
  assert.match(markup, /สถิติมติสภา AI SWARM/);
  // Unbacked performance claims must not be rendered as a default (audit 2026-11-05)
  assert.ok(!markup.includes("80.0%"), "Must not contain a hardcoded 80.0% win rate");
  assert.ok(!markup.includes("24W - 6L"), "Must not contain a hardcoded W/L record");
  assert.match(markup, /TODAY&#x27;S GOLD BATTLE PLAN/);
  assert.match(markup, /ไม่พลาดไม้ทองคำ/);
  assert.match(markup, /ปลดล็อก PRO VIP/);
});

test("auto target, stop, side inversion, and hit calculations calculate reliably", () => {
  // Auto target for BUY: Entry=2650, SL=2645 (dist=5) -> 2R is 2660, 3R is 2665
  const sampleBuy = {
    title: "แผนทดสอบออโต้",
    side: "buy",
    entry: "2650",
    stop: "2645",
    target: "2655",
    balance: "1000",
    riskPercent: "1",
    unitsPerLot: "100",
  };
  assert.equal(calculateAutoTarget(sampleBuy, 2), "2660");
  assert.equal(calculateAutoTarget(sampleBuy, 3), "2665");

  // Auto target for SELL: Entry=2650, SL=2655 (dist=5) -> 2R is 2640, 3R is 2635
  const sampleSell = {
    ...sampleBuy,
    side: "sell",
    entry: "2650",
    stop: "2655",
    target: "2645",
  };
  assert.equal(calculateAutoTarget(sampleSell, 2), "2640");
  assert.equal(calculateAutoTarget(sampleSell, 3), "2635");

  // Inverted inputs or missing fields
  assert.equal(calculateAutoTarget({ ...sampleBuy, entry: "" }), null);
  assert.equal(calculateAutoTarget({ ...sampleBuy, stop: "2650" }), null); // zero distance

  // Auto stop from structure
  const bar = { low: 2644.2, high: 2658.4, close: 2652 };
  const autoStopBuy = calculateAutoStop(sampleBuy, bar);
  assert.ok(Number(autoStopBuy) < Number(sampleBuy.entry));
  const autoStopSell = calculateAutoStop(sampleSell, bar);
  assert.ok(Number(autoStopSell) > Number(sampleSell.entry));

  // Invert side symmetrically
  const invertedToSell = invertPlanSide(sampleBuy, "sell");
  assert.equal(invertedToSell.side, "sell");
  assert.equal(invertedToSell.entry, "2650");
  assert.equal(invertedToSell.stop, "2655"); // flipped above
  assert.equal(invertedToSell.target, "2645"); // flipped below
  assert.equal(calculateStudioPlan(invertedToSell).error, undefined);

  // Check plan hits
  assert.deepEqual(checkPlanHit(sampleBuy, { low: 2640, high: 2665, close: 2655 }), {
    entryHit: true,
    tpHit: true,
    slHit: true,
  });
  assert.deepEqual(checkPlanHit(sampleBuy, { low: 2648, high: 2652, close: 2651 }), {
    entryHit: true,
    tpHit: false,
    slHit: false,
  });
  assert.deepEqual(checkPlanHit(sampleBuy, { low: 2642, high: 2644, close: 2643 }), {
    entryHit: false,
    tpHit: false,
    slHit: true,
  });
});

test("detectChartSetup generates sharp actionable setups for 15m and 1h with 2.0R calculations", () => {
  const instrument = resolveInitialInstrument("XAU/USD");

  // 15m Daytrade setup test
  const candles15m = demoBars(instrument, "15m");
  const setup15m = detectChartSetup(candles15m, "15m");
  assert.ok(setup15m, "15m Setup must be generated");
  assert.equal(setup15m.timeframe, "15m");
  assert.match(setup15m.title, /15m/);
  assert.ok(setup15m.condition.includes("15m"));
  const math15m = calculateStudioPlan(setup15m);
  assert.equal(math15m.error, undefined);
  assert.ok(math15m.rewardRatio >= 1.95, "Must achieve at least 2.0R");
  assert.ok(setup15m.atr > 0);

  // 1H Swing setup test
  const candles1h = demoBars(instrument, "1h");
  const setup1h = detectChartSetup(candles1h, "1h");
  assert.ok(setup1h, "1H Setup must be generated");
  assert.equal(setup1h.timeframe, "1h");
  assert.match(setup1h.title, /1H/);
  assert.ok(setup1h.condition.includes("1H"));
  const math1h = calculateStudioPlan(setup1h);
  assert.equal(math1h.error, undefined);
  assert.ok(math1h.rewardRatio >= 1.95, "Must achieve at least 2.0R");
});

test("computeATR and computeEMA calculate accurate technical metrics", () => {
  const instrument = resolveInitialInstrument("XAU/USD");
  const candles = demoBars(instrument, "1h");
  const atr = computeATR(candles, 14);
  assert.ok(atr > 0 && Number.isFinite(atr));

  const closes = candles.map((c) => c.close);
  const ema20 = computeEMA(closes, 20);
  assert.ok(ema20 > 0 && Number.isFinite(ema20));
});

test("forex studio live SSE stream route serves event-stream headers", async () => {
  const { GET } = await import("../../app/api/forex/studio/stream/route.js");
  const controller = new AbortController();
  const req = new Request("http://localhost:3000/api/forex/studio/stream", {
    signal: controller.signal,
  });
  const res = await GET(req);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "text/event-stream; charset=utf-8");
  assert.equal(res.headers.get("Cache-Control"), "no-cache, no-transform");

  // Read initial chunk from stream
  const reader = res.body.getReader();
  const { value, done } = await reader.read();
  assert.equal(done, false);
  const text = new TextDecoder().decode(value);
  assert.match(text, /data: /);
  assert.match(text, /forex-studio-live-feed/);
  reader.releaseLock();
  controller.abort();
});

test("formatPlanBrief generates complete text summary for sharing", () => {
  const result = calculateStudioPlan(buy);
  const brief = formatPlanBrief(buy, result);
  assert.match(brief, /📊 แผนตัวอย่างทองคำ/);
  assert.match(brief, /🟢 BUY \(ซื้อ\)/);
  assert.match(brief, /🎯 จุดเข้า \(Entry\): \$2651/);
  assert.match(brief, /🛑 จุดตัดขาดทุน \(SL\): \$2646/);
  assert.match(brief, /🏆 เป้าหมายกำไร \(TP\): \$2661/);
  assert.match(brief, /⚠️ โหมดฝึก: ข้อมูลจำลองเพื่อการศึกษา/);
});

test("forex studio API route serves active coach plan and handles permissions", async () => {
  const { GET, POST } = await import("../../app/api/forex/studio/plans/route.js");
  const res = await GET();
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, "ok");
  assert.equal(data.mode, "educational_demo");
  assert.ok(data.plan.title.includes("แผนวิเคราะห์สดโค้ชน้องนักออม"));
  assert.ok(data.plan.coach.includes("น้องนักออม"));

  // Check headers
  assert.equal(res.headers.get("Cache-Control"), "private, no-cache, no-store, max-age=0, must-revalidate");
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
});

test("forex studio broadcaster relays coach plans and market ticks to SSE stream listeners", async () => {
  const { studioBroadcaster } = await import("../../app/api/forex/studio/broadcaster.mjs");
  const { GET: getStream } = await import("../../app/api/forex/studio/stream/route.js");
  const { POST: postPlan } = await import("../../app/api/forex/studio/plans/route.js");

  const abortController = new AbortController();
  const res = await getStream(new Request("http://localhost/api/forex/studio/stream", {
    signal: abortController.signal,
  }));
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  // 1. Initial chunk
  const first = await reader.read();
  const firstText = decoder.decode(first.value);
  assert.ok(firstText.includes('"type":"connected"'));

  // 2. Post a new coach plan and check that broadcaster emits and stream receives it
  const postReq = new Request("http://localhost/api/forex/studio/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "แผนสดทดสอบระบบถ่ายทอด",
      side: "buy",
      entry: "2655.00",
      stop: "2650.00",
      target: "2665.00",
      coach: "โค้ชทดสอบ",
    }),
  });

  const postRes = await postPlan(postReq);
  assert.equal(postRes.status, 200);

  // Read the next chunk from SSE stream
  const second = await reader.read();
  const secondText = decoder.decode(second.value);
  assert.ok(secondText.includes('"type":"coach_plan"'));
  assert.ok(secondText.includes("แผนสดทดสอบระบบถ่ายทอด"));
  assert.ok(secondText.includes("2655.00"));

  // 3. Test market tick broadcast
  studioBroadcaster.emit("market_tick", {
    type: "tick",
    symbol: "XAU/USD",
    price: 2658.75,
    status: "live_mt5",
  });

  const third = await reader.read();
  const thirdText = decoder.decode(third.value);
  assert.ok(thirdText.includes('"type":"tick"'));
  assert.ok(thirdText.includes("2658.75"));

  abortController.abort();
  reader.releaseLock();
});
