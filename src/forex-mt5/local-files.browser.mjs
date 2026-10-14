// Same-computer transport test: isolated owner/channel and synthetic market fixtures only.
import assert from "node:assert/strict";
import { writeFile, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
});
const base = process.env.FOREX_TEST_URL || "http://localhost:3100";
const directory = process.env.FOREX_MT5_LOCAL_FILES_PATH;
assert.ok(directory, "Supply the configured test Files directory");
let channel, context;
try {
  context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/forex`);
  await page
    .getByRole("navigation", { name: "Forex Command Center", exact: true })
    .getByRole("button", { name: "MT5 connection", exact: true })
    .click();
  await page
    .getByRole("button", { name: "เชื่อมผ่านไฟล์บน Mac", exact: true })
    .click();
  channel = await page
    .getByRole("textbox", { name: "LocalChannel สำหรับ EA" })
    .inputValue();
  assert.match(channel, /^[a-f0-9]{32}$/);
  assert.equal(
    await page.getByRole("textbox", { name: "BridgeToken สำหรับ EA" }).count(),
    0,
  );
  const packet = {
    schema_version: 1,
    broker_id: "vantage",
    server: "VantageMarkets-Demo",
    company: "Vantage Global Limited",
    sent_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    sequence: 1,
    kind: "universe",
    sync_id: 1,
    part: 0,
    parts: 1,
    instruments: [
      {
        broker_symbol: "LOCALTEST.a",
        canonical_symbol: null,
        category: "fx",
        description: "SYNTHETIC LOCAL FILE TEST",
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
      },
    ],
  };
  const temporary = join(directory, `${channel}.packet.tmp`),
    path = join(directory, `${channel}.packet.json`);
  await writeFile(temporary, JSON.stringify(packet));
  await rename(temporary, path);
  await page
    .getByText("1 สินทรัพย์จาก VantageMarkets-Demo", { exact: false })
    .waitFor();
  const reply = JSON.parse(
    await readFile(join(directory, `${channel}.reply.json`), "utf8"),
  );
  assert.equal(reply.sequence, "1");
  assert.equal(reply.status, "200");
  assert.equal(Object.hasOwn(reply, "token"), false);
  const outsider = await browser.newContext();
  const anonymous = await (
    await outsider.request.get(`${base}/api/forex/mt5`)
  ).json();
  assert.equal(anonymous.snapshot, null);
  assert.equal(anonymous.local_file, undefined);
  await outsider.close();
  await page.reload();
  await page
    .getByRole("navigation", { name: "Forex Command Center", exact: true })
    .getByRole("button", { name: "MT5 connection", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "LocalChannel สำหรับ EA" })
      .inputValue(),
    channel,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page
    .getByRole("button", { name: "ยกเลิกกุญแจและลบข้อมูลการเชื่อมต่อนี้" })
    .click();
  await page
    .getByRole("textbox", { name: "LocalChannel สำหรับ EA" })
    .waitFor({ state: "detached" });
  assert.equal(
    (await (await context.request.get(`${base}/api/forex/mt5`)).json())
      .local_file,
    null,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: one-click local file pairing, synthetic terminal-file → API → UI acknowledgement, reload, owner isolation, mobile and revocation.",
  );
} finally {
  if (context)
    await context.request.post(`${base}/api/forex/mt5`, {
      headers: { Origin: base },
      data: { action: "revoke" },
    });
  if (channel)
    for (const suffix of ["packet.json", "reply.json", "packet.tmp"])
      await rm(join(directory, `${channel}.${suffix}`), { force: true });
  await browser.close();
}
