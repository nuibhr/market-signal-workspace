// Run against `npm start -- --port 3100`. Use a local Playwright installation or
// set PLAYWRIGHT_MODULE to the absolute path of its ESM entry point.
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
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(`${base}/forex?symbol=XAU%2FUSD`);
  assert.equal(response.status(), 200);
  await page.getByRole("heading", { name: "XAU/USD", exact: true }).waitFor();
  assert.equal(await page.locator("tbody tr").count(), 19);
  assert.equal(
    await page
      .getByRole("link", { name: /Forex/ })
      .getAttribute("aria-current"),
    "page",
  );
  assert.equal(
    await page
      .getByRole("button", { name: /Connect Vantage MT5/ })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("textbox", { name: "ค้นหาสัญลักษณ์หรือชื่อสินทรัพย์" })
    .fill("gold");
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page
    .getByRole("button", { name: "รายการโปรด XAU/USD", exact: true })
    .click();
  await page.getByRole("button", { name: /รายการโปรด \(1\)/ }).click();
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByRole("button", { name: /^Indices/ }).click();
  await page
    .getByRole("heading", { name: "หมวดนี้ยังไม่มีในรายการเริ่มต้น" })
    .waitFor();
  await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();
  assert.equal(await page.locator("tbody tr").count(), 19);
  await page
    .locator("tbody")
    .getByRole("button", { name: /^USD\/JPY/ })
    .click();
  await page.getByRole("heading", { name: "USD/JPY", exact: true }).waitFor();
  await page
    .getByRole("navigation", { name: "มุมมอง Forex" })
    .getByRole("button", { name: "MT5 connection" })
    .click();
  assert.equal(await page.locator("#forex-connection").count(), 1);
  assert.equal(await page.locator("input[type=password]").count(), 0);
  await page
    .getByRole("navigation", { name: "มุมมอง Forex" })
    .getByRole("button", { name: "Overview" })
    .click();
  await page.evaluate(() => window.scrollTo(0, 0));
  if (process.env.FOREX_SCREENSHOT_DIR)
    await page.screenshot({
      path: `${process.env.FOREX_SCREENSHOT_DIR}/forex-desktop.png`,
    });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "สำรวจสินทรัพย์", exact: true })
      .isVisible(),
    true,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  if (process.env.FOREX_SCREENSHOT_DIR)
    await page.screenshot({
      path: `${process.env.FOREX_SCREENSHOT_DIR}/forex-mobile.png`,
      fullPage: true,
    });
  await page
    .getByRole("button", { name: "สำรวจสินทรัพย์", exact: true })
    .click();
  await page.getByRole("button", { name: /^Metals/ }).click();
  assert.equal(await page.locator("tbody tr").count(), 2);
  await page.reload();
  await page.getByRole("heading", { name: "XAU/USD", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: /รายการโปรด \(0\)/ }).count(),
    1,
  );
  assert.deepEqual(errors, []);
  // Route rendering smoke check. Source equality against the requested baseline
  // is enforced separately by forex.test.mjs (including shared workspace/styles).
  for (const market of ["thai", "dr", "tfex", "us"]) {
    const result = await page.goto(`${base}/${market}`);
    assert.equal(result.status(), 200, market);
    await page.locator(`.market-workspace.market-${market}`).waitFor();
    assert.equal(
      await page.getByRole("heading", { name: /Forex \/ CFD/ }).count(),
      0,
    );
  }
  console.log(
    "PASS: desktop/mobile Forex interactions, deep link, guest reset, disabled MT5 and all four protected market routes.",
  );
} finally {
  await browser.close();
}
