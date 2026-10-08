// Integration uses synthetic connector packets, never an MT5 account or market data provider.
import assert from "node:assert/strict";
const { chromium, request } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHANNEL
    ? { channel: process.env.PLAYWRIGHT_CHANNEL }
    : {}),
});
const base = process.env.FOREX_TEST_URL || "http://localhost:3100";
let token, context, connector;
try {
  // Exercise failures with synthetic responses; never generate real keys here.
  const setupContext = await browser.newContext();
  const setupPage = await setupContext.newPage();
  const setupState = {
    capabilities: {
      enabled: true,
      servers: ["VantageMarkets-Demo"],
      local: false,
    },
    authorized: false,
    status: "disconnected",
    snapshot: null,
    quotes: {},
    chart: null,
  };
  let failSession = true,
    paired = false;
  const setupActions = [];
  await setupPage.route("**/api/forex/mt5*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: paired ? 503 : 200, json: setupState });
      return;
    }
    const action = route.request().postDataJSON().action;
    setupActions.push(action);
    if (action === "local-session" && failSession) {
      await route.fulfill({ status: 403, json: { error: "LOCAL_ONLY" } });
      return;
    }
    if (action === "pair") paired = true;
    await route.fulfill({
      json:
        action === "pair"
          ? { token: "synthetic-ui-key", expires_at: "2026-10-14T00:00:00Z" }
          : { ok: true },
    });
  });
  const openSetup = async () => {
    await setupPage.goto(`${base}/forex`);
    await setupPage
      .getByRole("navigation", { name: "Forex Command Center", exact: true })
      .getByRole("button", { name: "MT5 connection", exact: true })
      .click();
  };
  await openSetup();
  assert.equal(
    await setupPage
      .getByRole("button", { name: "สร้างกุญแจผ่าน WebRequest" })
      .isDisabled(),
    true,
  );
  await setupPage
    .getByText("เข้าสู่ระบบด้วย LINE ตามปกติก่อนสร้างกุญแจจับคู่")
    .waitFor();
  assert.deepEqual(setupActions, []);
  setupState.capabilities.local = true;
  await openSetup();
  const setupButton = setupPage.getByRole("button", {
    name: "สร้างกุญแจผ่าน WebRequest",
  });
  await setupButton.click();
  await setupPage.locator("#forex-connection").getByRole("alert").waitFor();
  assert.deepEqual(setupActions, ["local-session"]); // Don't attempt pairing after session failure.
  assert.equal(await setupButton.isEnabled(), true);
  failSession = false;
  await setupButton.click();
  await setupPage
    .getByRole("textbox", { name: "BridgeToken สำหรับ EA" })
    .waitFor();
  assert.deepEqual(setupActions, ["local-session", "local-session", "pair"]);
  assert.equal(
    await setupPage
      .getByRole("textbox", { name: "BridgeToken สำหรับ EA" })
      .inputValue(),
    "synthetic-ui-key",
  );
  await setupPage
    .getByText("ดำเนินการแล้ว แต่โหลดสถานะไม่ได้ กรุณาเก็บกุญแจที่แสดงไว้")
    .waitFor();
  await setupContext.close();
  context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/forex`);
  const nav = (name) =>
    page
      .getByRole("navigation", { name: "Forex Command Center", exact: true })
      .getByRole("button", { name, exact: true })
      .click();
  await nav("MT5 connection");
  await page.getByRole("button", { name: "สร้างกุญแจผ่าน WebRequest" }).click();
  token = await page
    .getByRole("textbox", { name: "BridgeToken สำหรับ EA" })
    .inputValue();
  assert.equal(token.length, 43);
  assert.equal(await page.locator("input[type=password]").count(), 0);
  const badOrigin = await context.request.post(`${base}/api/forex/mt5`, {
    headers: { Origin: "https://other.example" },
    data: { action: "revoke" },
  });
  assert.equal(badOrigin.status(), 403);
  connector = await request.newContext();
  let sequence = 0;
  const send = (extra) =>
    connector.post(`${base}/api/forex/mt5`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        schema_version: 1,
        broker_id: "vantage",
        server: "VantageMarkets-Demo",
        company: "Vantage Global Limited",
        sent_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
        sequence: ++sequence,
        ...extra,
      },
    });
  const foreign = await send({
    kind: "feed",
    company: "Other broker",
    quotes: [],
    chart: null,
  });
  assert.equal(foreign.status(), 403);
  const categories = [
    "fx",
    "metals",
    "indices",
    "energy",
    "commodities",
    "crypto_cfds",
    "share_cfds",
    "etfs",
    "bonds",
    null,
  ];
  const rows = Array.from({ length: 305 }, (_, index) => ({
    broker_symbol: index === 0 ? "EURUSD.a" : `TEST${index}.a`,
    canonical_symbol: null,
    category: categories[index % 10],
    description: `SYNTHETIC PROTOCOL TEST ${index}`,
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
  }));
  for (let part = 0; part < 4; part++) {
    const response = await send({
      kind: "universe",
      sync_id: 1,
      part,
      parts: 4,
      instruments: rows.slice(part * 100, (part + 1) * 100),
    });
    assert.equal(response.status(), 200, await response.text());
  }
  const now = Math.floor(Date.now() / 1000);
  const chart = {
    broker_symbol: "EURUSD.a",
    timeframe: "1h",
    utc_offset_minutes: 180,
    bars: Array.from({ length: 24 }, (_, index) => ({
      time: now - (24 - index) * 3600,
      open: 1.08,
      high: 1.09,
      low: 1.07,
      close: 1.083,
      volume: 120,
    })),
  };
  assert.equal(
    (
      await send({
        kind: "feed",
        quotes: [
          { broker_symbol: "EURUSD.a", bid: 1.08345, ask: 1.08355, time: now },
        ],
        chart,
      })
    ).status(),
    200,
  );
  await page
    .getByText("305 สินทรัพย์จาก VantageMarkets-Demo", { exact: false })
    .waitFor();
  await nav("Scanner");
  assert.equal(await page.locator("#forex-universe tbody tr").count(), 100);
  assert.equal(
    await page
      .getByRole("button", { name: "เรียงคะแนน AI ตัวอย่าง" })
      .isDisabled(),
    true,
  );
  assert.ok(
    (await page.locator("#forex-universe tbody").textContent()).includes(
      "1.08345",
    ),
  );
  assert.equal(
    await page
      .locator("#forex-universe tbody")
      .getByText("LONG", { exact: true })
      .count(),
    0,
  );
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  assert.equal(await page.locator("#forex-universe tbody tr").count(), 100);
  await page.getByRole("button", { name: /^Bonds/ }).click();
  assert.equal(await page.locator("#forex-universe tbody tr").count(), 30);
  await page.getByRole("button", { name: /^Unclassified/ }).click();
  assert.equal(await page.locator("#forex-universe tbody tr").count(), 30);
  await page
    .getByRole("textbox", { name: "ค้นหาสัญลักษณ์หรือชื่อสินทรัพย์" })
    .fill("EURUSD.a");
  await page.getByRole("button", { name: /^All markets/ }).click();
  assert.equal(await page.locator("#forex-universe tbody tr").count(), 1);
  await page
    .locator("tbody")
    .getByRole("button", { name: /^EURUSD.a/ })
    .click();
  await page
    .getByLabel("กราฟ MT5 EURUSD.a เวลา UTC")
    .locator("canvas")
    .first()
    .waitFor();
  await page
    .getByRole("combobox", { name: "สินทรัพย์บนกราฟ" })
    .selectOption({ label: "TEST1.a" });
  await page
    .getByText("ยังไม่มีแท่งราคาสำหรับกราฟนี้", { exact: true })
    .waitFor();
  await page
    .getByRole("combobox", { name: "สินทรัพย์บนกราฟ" })
    .selectOption({ label: "EURUSD.a" });
  await page.getByRole("button", { name: "4H", exact: true }).click();
  await page
    .getByText("ยังไม่มีแท่งราคาสำหรับกราฟนี้", { exact: true })
    .waitFor();
  const status = await context.request.get(
    `${base}/api/forex/mt5?symbol=EURUSD.a&frame=4h`,
  );
  assert.equal((await status.json()).chart, null);
  const response = await send({
    kind: "feed",
    quotes: [],
    chart: { ...chart, timeframe: "4h", bars: [chart.bars[0]] },
  });
  const desired = await response.json();
  assert.equal(desired.requested_frame, "4h");
  await page
    .getByLabel("กราฟ MT5 EURUSD.a เวลา UTC")
    .locator("canvas")
    .first()
    .waitFor();
  assert.equal(await page.getByText("RSI 14").count(), 1); // One bar must not crash indicator rendering.
  // Owner isolation: a second browser cannot see the connection or its market payloads.
  const other = await browser.newContext();
  const anonymous = await other.request.get(`${base}/api/forex/mt5`);
  assert.equal((await anonymous.json()).snapshot, null);
  const unauthorized = await other.request.post(`${base}/api/forex/mt5`, {
    headers: { Origin: base },
    data: { action: "revoke" },
  });
  assert.equal(unauthorized.status(), 401);
  await other.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("combobox", { name: "หน้าเครื่องมือ Forex" })
    .selectOption("connection");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page
    .getByRole("button", { name: "ยกเลิกกุญแจและลบข้อมูลการเชื่อมต่อนี้" })
    .click();
  assert.equal(
    (await send({ kind: "feed", quotes: [], chart: null })).status(),
    401,
  );
  await page.reload();
  await page
    .getByRole("combobox", { name: "หน้าเครื่องมือ Forex" })
    .selectOption("scanner");
  assert.equal(await page.locator("#forex-universe tbody tr").count(), 19);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: pairing/cookie/origin checks, exact Vantage policy, atomic 305-symbol sync, pagination, quotes, suffixes, all categories, chart frame request, one-bar rendering, owner isolation, mobile, revoke and 19-symbol fallback. Synthetic packets only.",
  );
} finally {
  if (token && context)
    await context.request.post(`${base}/api/forex/mt5`, {
      headers: { Origin: base },
      data: { action: "revoke" },
    });
  await connector?.dispose();
  await browser.close();
}
