// Run against `npm start -- --port 3100`, with Playwright or PLAYWRIGHT_MODULE.
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHANNEL
    ? { channel: process.env.PLAYWRIGHT_CHANNEL }
    : {}),
});
const base = process.env.FOREX_TEST_URL || "http://localhost:3100";
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  const errors = [],
    apiRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  const navigate = async (name) => {
    await page
      .getByRole("navigation", { name: "Forex Command Center", exact: true })
      .getByRole("button", { name, exact: true })
      .click();
  };
  const response = await page.goto(`${base}/forex?symbol=XAU%2FUSD`);
  assert.equal(response.status(), 200);
  await page.locator("canvas").first().waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "FOREX COMMAND CENTER", exact: true })
      .count(),
    1,
  );
  assert.equal(
    await page
      .getByRole("navigation", { name: "Forex Command Center", exact: true })
      .getByRole("button")
      .count(),
    10,
  );
  assert.equal(
    await page.getByRole("combobox", { name: "สินทรัพย์บนกราฟ" }).inputValue(),
    "starter:XAU/USD",
  );
  assert.equal(
    await page
      .getByRole("link", { name: /Forex/ })
      .getAttribute("aria-current"),
    "page",
  );
  await navigate("Scanner");
  assert.equal(await page.locator("#forex-universe tbody tr").count(), 19);
  await page.getByRole("button", { name: "เรียงคะแนน AI ตัวอย่าง" }).click();
  const scores = await page
    .locator("#forex-universe tbody tr td:nth-child(5)")
    .allTextContents();
  assert.ok(
    scores.every(
      (value, index) =>
        index === 0 || Number(scores[index - 1]) >= Number(value),
    ),
  );
  await page.getByRole("button", { name: "เรียงคะแนน AI ตัวอย่าง" }).click();
  await page
    .getByRole("textbox", { name: "ค้นหาสัญลักษณ์หรือชื่อสินทรัพย์" })
    .fill("gold");
  assert.equal(await page.locator("#forex-universe tbody tr").count(), 1);
  await page
    .getByRole("button", { name: "รายการโปรด XAU/USD", exact: true })
    .click();
  await page.getByRole("button", { name: /รายการโปรด \(1\)/ }).click();
  await page.getByRole("button", { name: /^Indices/ }).click();
  await page
    .getByRole("heading", { name: "หมวดนี้ยังไม่มีในรายการเริ่มต้น" })
    .waitFor();
  await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();
  assert.equal(await page.locator("#forex-universe tbody tr").count(), 19);
  await page
    .locator("tbody")
    .getByRole("button", { name: /^USDJPY/ })
    .click();
  assert.equal(
    await page.getByRole("combobox", { name: "สินทรัพย์บนกราฟ" }).inputValue(),
    "starter:USD/JPY",
  );
  await page.getByRole("button", { name: "4H", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "4H", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "เปลี่ยนกราฟแท่งหรือเส้น" }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "เปลี่ยนกราฟแท่งหรือเส้น" })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: /DEMO PREVIEW/ }).click();
  await page
    .getByText("ยังไม่มีแท่งราคาสำหรับกราฟนี้", { exact: true })
    .waitFor();
  await navigate("Scanner");
  assert.equal(await page.locator("#forex-universe tbody tr").count(), 19);
  assert.equal(
    await page
      .locator("#forex-universe tbody")
      .getByText("WAIT", { exact: true })
      .count(),
    19,
  );
  assert.equal(
    await page
      .locator("#forex-universe tbody")
      .getByText("LONG", { exact: true })
      .count(),
    0,
  );
  await page.getByRole("button", { name: /GUEST \/ NO FEED/ }).click();
  await navigate("MT5 connection");
  const bridgeState = await (
    await page.request.get(`${base}/api/forex/mt5`)
  ).json();
  assert.equal(
    await page
      .getByRole("button", { name: "สร้างกุญแจเชื่อม Vantage MT5" })
      .isEnabled(),
    Boolean(
      bridgeState.capabilities.enabled &&
        bridgeState.capabilities.servers.length &&
        (bridgeState.authorized || bridgeState.capabilities.local),
    ),
  );
  assert.equal(
    await page.getByRole("link", { name: "ดาวน์โหลด Connector EA" }).count(),
    1,
  );
  assert.equal(await page.locator("input[type=password]").count(), 0);
  assert.equal(await page.getByText("Connected", { exact: true }).count(), 0);
  await navigate("Risk Management");
  await page.getByRole("button", { name: "คำนวณ Position Size" }).click();
  await page
    .getByRole("status")
    .getByText("0.2000 lots", { exact: true })
    .waitFor();
  await page
    .getByRole("spinbutton", { name: "Stop distance (pips)" })
    .fill("100");
  assert.equal(await page.getByText("0.2000 lots", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "คำนวณ Position Size" }).click();
  await page
    .getByRole("status")
    .getByText("0.1000 lots", { exact: true })
    .waitFor();
  await navigate("Trade Journal");
  await page.getByRole("button", { name: "บันทึกแผน", exact: true }).click();
  await page
    .getByRole("textbox", { name: "บันทึกแผนการเทรด" })
    .fill("ทบทวนแผนก่อนเข้าเทรด <script>example</script>");
  await page.getByRole("button", { name: "บันทึกในหน้านี้" }).click();
  await page
    .getByText("ทบทวนแผนก่อนเข้าเทรด <script>example</script>", { exact: true })
    .waitFor();
  await navigate("AI Alerts");
  await page.getByRole("switch", { name: "ตัวอย่าง Price alert" }).click();
  assert.equal(
    await page
      .getByRole("switch", { name: "ตัวอย่าง Price alert" })
      .getAttribute("aria-checked"),
    "true",
  );
  await navigate("Trade Journal");
  assert.equal(
    await page
      .getByText("ทบทวนแผนก่อนเข้าเทรด <script>example</script>", {
        exact: true,
      })
      .count(),
    1,
  );
  await navigate("AI Alerts");
  assert.equal(
    await page
      .getByRole("switch", { name: "ตัวอย่าง Price alert" })
      .getAttribute("aria-checked"),
    "true",
  );
  await navigate("News & Calendar");
  await page.getByRole("button", { name: "EUR", exact: true }).click();
  assert.equal(await page.locator("tbody tr").count(), 1);
  await navigate("Positions");
  await page.getByRole("button", { name: "Pending", exact: true }).click();
  await page.getByText(/ยังไม่มีข้อมูล Pending/).waitFor();
  await navigate("AI Analysis");
  await page.locator("canvas").first().waitFor();
  await navigate("Overview");
  await page.evaluate(() => scrollTo(0, 0));
  if (process.env.FOREX_SCREENSHOT_DIR)
    await page.screenshot({
      path: `${process.env.FOREX_SCREENSHOT_DIR}/forex-terminal-overview.png`,
      fullPage: true,
    });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.equal(
    await page
      .getByRole("combobox", { name: "หน้าเครื่องมือ Forex" })
      .isVisible(),
    true,
  );
  if (process.env.FOREX_SCREENSHOT_DIR)
    await page.screenshot({
      path: `${process.env.FOREX_SCREENSHOT_DIR}/forex-terminal-mobile.png`,
      fullPage: true,
    });
  await page
    .getByRole("combobox", { name: "หน้าเครื่องมือ Forex" })
    .selectOption("scanner");
  await page.getByRole("button", { name: /^Metals/ }).click();
  assert.equal(await page.locator("#forex-universe tbody tr").count(), 2);
  await page.setViewportSize({ width: 1440, height: 1080 });
  await navigate("Advanced Chart");
  await page.evaluate(() => scrollTo(0, 0));
  if (process.env.FOREX_SCREENSHOT_DIR)
    await page.screenshot({
      path: `${process.env.FOREX_SCREENSHOT_DIR}/forex-terminal-chart.png`,
    });
  await page.reload();
  await navigate("Scanner");
  assert.equal(
    await page.getByRole("button", { name: /รายการโปรด \(0\)/ }).count(),
    1,
  );
  await navigate("Trade Journal");
  assert.equal(
    await page.getByText("ยังไม่มีรายการบันทึก", { exact: true }).count(),
    1,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(
    apiRequests.filter(
      (url) => !new URL(url).pathname.startsWith("/api/forex/mt5"),
    ),
    [],
    "Forex may call only its isolated read-only MT5 API.",
  );
  // Navigate from Forex to a protected route to also exercise CSS isolation.
  await page.getByRole("link", { name: /หุ้นไทย/ }).click();
  await page.locator(".market-workspace.market-thai").waitFor();
  for (const market of ["thai", "dr", "tfex", "us"]) {
    const result = await page.goto(`${base}/${market}`);
    assert.equal(result.status(), 200, market);
    await page.locator(`.market-workspace.market-${market}`).waitFor();
    assert.equal(
      await page.getByRole("button", { name: /DEMO PREVIEW/ }).count(),
      0,
    );
  }
  console.log(
    "PASS: ten Forex views, interactive chart, scanner, demo/guest isolation, manual risk, local journal/alerts, mobile layout, only isolated MT5 API calls, and four protected routes.",
  );
} finally {
  await browser.close();
}
