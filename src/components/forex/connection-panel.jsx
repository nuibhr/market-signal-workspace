import { useState } from "react";
import { Cable, ShieldCheck, Download, Copy } from "lucide-react";
import { CONNECTION_STATES } from "./brokers.mjs";
import styles from "./forex-workspace.module.css";
export default function ConnectionPanel({ bridge }) {
  const [key, setKey] = useState(null),
    [copied, setCopied] = useState(false),
    [server, setServer] = useState("");
  const state = CONNECTION_STATES[bridge.status] ?? CONNECTION_STATES.error;
  const selectedServer = server || bridge.capabilities.servers[0] || "";
  const canPair =
    bridge.capabilities.enabled &&
    selectedServer &&
    (bridge.authorized || bridge.capabilities.local);
  const localFile = key?.channel ? key : bridge.local_file;
  const pair = async () => {
    const result = await bridge.action("pair", selectedServer);
    if (result) {
      setKey(result);
      setCopied(false);
    }
  };
  return (
    <section
      id="forex-connection"
      className={styles.panel}
      aria-labelledby="connection-title"
    >
      <div className={styles.panelHeading}>
        <div>
          <span className={styles.eyebrow}>
            READ-ONLY BROKER BRIDGE / PHASE 02
          </span>
          <h2 id="connection-title">Vantage MT5</h2>
        </div>
        <Cable size={22} />
      </div>
      <div className={styles.connectionState}>
        <span className={styles.dot} />
        <strong>{state.label}</strong>
      </div>
      <p>{state.detail}</p>
      <dl className={styles.connectionFacts}>
        <div>
          <dt>โบรกเกอร์</dt>
          <dd>Vantage · {bridge.company ?? "รอข้อมูลจาก Terminal"}</dd>
        </div>
        <div>
          <dt>Server</dt>
          <dd>{bridge.server ?? "ยังไม่ได้จับคู่"}</dd>
        </div>
        <div>
          <dt>สินทรัพย์ที่ซิงก์</dt>
          <dd>{bridge.snapshot?.instruments.length ?? "—"}</dd>
        </div>
        <div>
          <dt>ซิงก์ล่าสุด</dt>
          <dd>
            {bridge.last_sync_at
              ? new Date(bridge.last_sync_at).toLocaleString("th-TH")
              : "ยังไม่มี"}
          </dd>
        </div>
      </dl>
      <label className={styles.bridgeField}>
        Vantage Server
        <select
          aria-label="Vantage Server"
          value={selectedServer}
          onChange={(event) => setServer(event.target.value)}
          disabled={bridge.busy}
        >
          {!bridge.capabilities.servers.length && (
            <option value="">ยังไม่ได้กำหนด Server</option>
          )}
          {bridge.capabilities.servers.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      {!bridge.authorized && bridge.capabilities.local && (
        <p className={styles.note}>
          กดสร้างกุญแจได้เลย ระบบจะเริ่มการเชื่อมต่อบนเครื่องนี้ให้อัตโนมัติ
        </p>
      )}
      {bridge.capabilities.enabled && !selectedServer && (
        <p className={styles.note}>ต้องกำหนด Vantage Server ก่อนสร้างกุญแจ</p>
      )}
      {!bridge.authorized &&
        !bridge.capabilities.local &&
        bridge.capabilities.enabled && (
          <p className={styles.note}>
            เข้าสู่ระบบด้วย LINE ตามปกติก่อนสร้างกุญแจจับคู่
          </p>
        )}
      <div className={styles.bridgeActions}>
        <button
          className={styles.primaryButton}
          disabled={!canPair || bridge.busy}
          onClick={pair}
        >
          <Cable size={16} />{" "}
          {bridge.busy ? "กำลังดำเนินการ…" : "สร้างกุญแจเชื่อม Vantage MT5"}
        </button>
        <a className={styles.secondaryButton} href="/api/forex/mt5/connector">
          <Download size={16} /> ดาวน์โหลด Connector EA
        </a>
      </div>
      {bridge.capabilities.localFiles && (
        <div className={styles.pairingKey}>
          <strong>ทางเลือกสำหรับ Mac · เชื่อมผ่านไฟล์ในเครื่อง</strong>
          <p>
            ใช้แทน WebRequest ได้ ไม่ต้องกรอก URL ใน MT5 เปิดหน้า Forex
            นี้ไว้ระหว่างซิงก์
          </p>
          <button
            className={styles.primaryButton}
            disabled={!canPair || bridge.busy}
            onClick={async () => {
              const result = await bridge.action("local-file", selectedServer);
              if (result) {
                setKey(result);
                setCopied(false);
              }
            }}
          >
            เชื่อมผ่านไฟล์บน Mac
          </button>
          {localFile && (
            <>
              <label>
                LocalChannel{" "}
                <input
                  aria-label="LocalChannel สำหรับ EA"
                  value={localFile.channel}
                  readOnly
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <button
                className={styles.secondaryButton}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(localFile.channel);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                <Copy size={14} />
                {copied ? "คัดลอกแล้ว" : "คัดลอกรหัส LocalChannel"}
              </button>
              <p>
                ลาก EA รุ่นใหม่ (NugaomLocalFileBridge) ลงกราฟ Demo → Inputs:
                LocalFiles = true และ LocalChannel = รหัสด้านบน ปล่อย
                BridgeToken ว่างได้
              </p>
              <p>
                ถ้ารีสตาร์ตเว็บเซิร์ฟเวอร์ ให้กดเชื่อมใหม่และเปลี่ยน
                LocalChannel ใน EA
              </p>
              {localFile.error && (
                <p role="alert" className={styles.negative}>
                  อ่านไฟล์ยังไม่สำเร็จ ({localFile.error}) · ตรวจว่า EA
                  ใช้บัญชีและ Server ที่เลือก
                </p>
              )}
            </>
          )}
        </div>
      )}
      {key?.token && (
        <div className={styles.pairingKey}>
          <strong>
            กุญแจแสดงครั้งเดียว · หมดอายุ{" "}
            {new Date(key.expires_at).toLocaleDateString("th-TH")}
          </strong>
          <label>
            BridgeToken{" "}
            <input
              aria-label="BridgeToken สำหรับ EA"
              value={key.token}
              readOnly
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button
            className={styles.secondaryButton}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(key.token);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            <Copy size={14} />
            {copied ? "คัดลอกแล้ว" : "คัดลอกกุญแจ"}
          </button>
          <p>
            ใช้เฉพาะ EA ของคุณ กุญแจนี้อนุญาตส่งข้อมูลตลาดเข้าระบบ
            และไม่ใช่รหัสผ่านบัญชี MT5
          </p>
          <button className={styles.textButton} onClick={() => setKey(null)}>
            ซ่อนกุญแจ
          </button>
        </div>
      )}
      {bridge.status !== "disconnected" && (
        <button
          className={styles.textButton}
          disabled={bridge.busy}
          onClick={async () => {
            if (await bridge.action("revoke")) setKey(null);
          }}
        >
          ยกเลิกกุญแจและลบข้อมูลการเชื่อมต่อนี้
        </button>
      )}
      {bridge.error && (
        <p role="alert" className={styles.negative}>
          {bridge.error}
        </p>
      )}
      {!bridge.capabilities.enabled && (
        <p className={styles.note}>
          ระบบรับข้อมูลยังไม่ได้เปิดใช้งาน · ใช้ Guest 19 สัญลักษณ์หรือทดลอง
          Demo ได้
        </p>
      )}
      <h3>วิธีเชื่อมผ่าน WebRequest · อีกทางเลือก</h3>
      <ol className={styles.bridgeSteps}>
        <li>
          ใช้{" "}
          <a
            href="https://www.metatrader5.com/en/terminal/help/start_advanced/install_mac"
            target="_blank"
            rel="noreferrer"
          >
            MT5 Desktop สำหรับ Mac
          </a>{" "}
          รุ่นที่มี MetaEditor และ Expert Advisors (แอป iPhone/iPad บน Mac ใช้
          EA ไม่ได้)
        </li>
        <li>
          เปิดไฟล์ Connector ใน MetaEditor แล้ว Compile จากนั้นเพิ่ม EA
          บนกราฟบัญชี Vantage
        </li>
        <li>
          ใน Tools → Options → Expert Advisors อนุญาต WebRequest ไปยัง URL
          ของเว็บนี้
        </li>
        <li>
          กรอก Endpoint เป็น{" "}
          <code>
            {typeof window !== "undefined"
              ? window.location.origin
              : "URL ของเว็บ"}
            /api/forex/mt5
          </code>{" "}
          พร้อม BridgeToken และ ExpectedServer
        </li>
        <li>
          ยืนยันค่า ServerUtcOffsetMinutes ให้ตรงกับนาฬิกา Server
          ก่อนเปิดราคาหรือกราฟ หากยังไม่ระบุจะซิงก์เฉพาะรายการสินทรัพย์
        </li>
      </ol>
      <div className={styles.readOnly}>
        <ShieldCheck size={17} />
        <span>
          อ่านตลาดเท่านั้น · ไม่มีรหัสผ่าน MT5 ข้อมูลพอร์ต หรือคำสั่งซื้อขาย
        </span>
      </div>
    </section>
  );
}
