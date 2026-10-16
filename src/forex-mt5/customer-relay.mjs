// Optional customer-side transport for MT5 Desktop on Mac/Windows without WebRequest.
// Node 22+. Reads only the chosen channel in MQL5/Files/NugaomBridge. No account/trade APIs.
import { constants } from "node:fs";
import { open, lstat, realpath, writeFile, rename, rm } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";

export function relayConfig(value) {
  if (!value || Object.keys(value).some(key => !["endpoint", "token", "channel", "server", "expires_at"].includes(key)))
    throw Error("INVALID_CONFIG");
  const url = new URL(value.endpoint);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
    url.pathname !== "/api/forex/mt5" || !/^[A-Za-z0-9_-]{43}$/.test(value.token) ||
    !/^[a-f0-9]{32}$/.test(value.channel) || typeof value.server !== "string" ||
    !value.server || /[\x00-\x1f\x7f]/.test(value.server) || !Number.isFinite(Date.parse(value.expires_at)))
    throw Error("INVALID_CONFIG");
  return value;
}
async function boundedRead(path, max) {
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.size > max) throw Error("INVALID_FILE");
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > max) throw Error("INVALID_FILE");
    const buffer = Buffer.alloc(max + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (bytesRead > max) throw Error("INVALID_FILE");
    return buffer.subarray(0, bytesRead).toString("utf8").replace(/^\uFEFF/, "");
  } finally { await file.close(); }
}
export class CustomerRelay {
  constructor(config, directory, send = fetch) {
    this.config = relayConfig(config); this.directory = directory; this.send = send;
    this.digest = null; this.reply = null;
  }
  async pump(now = Date.now()) {
    if (Date.parse(this.config.expires_at) <= now) throw Error("PAIRING_EXPIRED");
    if (!isAbsolute(this.directory)) throw Error("ABSOLUTE_FILES_DIRECTORY_REQUIRED");
    const packetText = await boundedRead(join(this.directory, `${this.config.channel}.packet.json`), 512000);
    const packet = JSON.parse(packetText);
    if (packet.server !== this.config.server || !Number.isSafeInteger(packet.sequence)) throw Error("SERVER_MISMATCH");
    const hash = createHash("sha256").update(packetText).digest("hex");
    if (hash !== this.digest) {
      const response = await this.send(this.config.endpoint, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": "application/json", "X-Forex-Retry": "same-packet",
          Authorization: `Bearer ${this.config.token}` }, body: packetText,
      });
      if (!response.ok) {
        // Retry transient errors without acknowledging them. Fatal auth/policy errors stop the EA.
        if (![400, 401, 403, 409].includes(response.status)) throw Error("RECEIVER_UNAVAILABLE");
        this.reply = { sequence: String(packet.sequence), status: String(response.status) };
      } else {
        const result = JSON.parse(await response.text());
        if (result.accepted !== true) throw Error("INVALID_RECEIVER_REPLY");
        this.reply = { sequence: String(packet.sequence), status: "200",
          requested_symbol_hex: result.requested_symbol_hex, requested_frame: result.requested_frame,
          requested_utc_offset_minutes: result.requested_utc_offset_minutes,
          requested_history_since: result.requested_history_since,
          requested_scan_symbols_hex: result.requested_scan_symbols_hex };
      }
      this.digest = hash;
    }
    const target = join(this.directory, `${this.config.channel}.reply.json`);
    const temporary = `${target}.${randomBytes(8).toString("hex")}.tmp`;
    try { await writeFile(temporary, JSON.stringify(this.reply), { flag: "wx", mode: 0o600 });
      await rename(temporary, target);
    } finally { await rm(temporary, { force: true }); }
    if (this.reply.status !== "200") throw Error(`RECEIVER_${this.reply.status}`);
    return "รับข้อมูลแล้ว · เปิด MT5 และหน้าต่างนี้ไว้";
  }
}
async function main() {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log("Nugaom MT5 · ส่งข้อมูลตลาดเท่านั้น · ไม่ต้องใช้รหัสผ่าน MT5");
    const configPath = (await terminal.question("ลากไฟล์ NugaomRelay.json มาที่นี่ แล้วกด Enter: ")).trim().replace(/^['"]|['"]$/g, "");
    const config = relayConfig(JSON.parse(await boundedRead(configPath, 4096)));
    const directory = (await terminal.question("วางที่อยู่ MT5 Data Folder/MQL5/Files/NugaomBridge แล้วกด Enter: ")).trim().replace(/^['"]|['"]$/g, "");
    if (!isAbsolute(directory)) throw Error("ABSOLUTE_FILES_DIRECTORY_REQUIRED");
    const relay = new CustomerRelay(config, await realpath(directory));
    console.log("พร้อม · โหลด NugaomMT5.set ใน EA แล้วเปิด MT5 ไว้ · กด Ctrl+C เพื่อหยุด");
    let last = "";
    while (true) {
      let message;
      try { message = await relay.pump(); } catch (error) {
        message = ["PAIRING_EXPIRED", "RECEIVER_400", "RECEIVER_401", "RECEIVER_403", "RECEIVER_409"].includes(error.message)
          ? error.message : "รอไฟล์จาก EA หรือกำลังลองเชื่อมต่อใหม่";
        if (message === error.message) { console.log(message); break; }
      }
      if (message !== last) { console.log(message); last = message; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } finally { terminal.close(); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]))
  main().catch(() => { console.error("เปิดไม่สำเร็จ · ตรวจไฟล์ตั้งค่าและโฟลเดอร์ MT5"); process.exitCode = 1; });
