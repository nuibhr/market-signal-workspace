import { useState } from "react";
import { Cable, ShieldCheck, Download, Copy } from "lucide-react";
import { CONNECTION_STATES } from "./brokers.mjs";
import { makePreset, utf16Preset, makeRelayConfig } from "./connection-setup.mjs";
import styles from "./forex-workspace.module.css";
export default function ConnectionPanel({ bridge }) {
  const [key, setKey] = useState(null),
    [copied, setCopied] = useState(false),
    [server, setServer] = useState(""),
    [platform, setPlatform] = useState("windows"),
    [transport, setTransport] = useState("webrequest"),
    [downloadError, setDownloadError] = useState(null);
  const state = CONNECTION_STATES[bridge.status] ?? CONNECTION_STATES.error;
  const available = bridge.capabilities.servers;
  const selectedServer = [server, bridge.server].find(value => available.includes(value)) || available[0] || "";
  const canPair =
    bridge.capabilities.enabled &&
    selectedServer &&
    (bridge.authorized || bridge.capabilities.local);
  const localFile = key?.channel ? key : bridge.local_file;
  const pair = async () => {
    const result = await bridge.action("pair", selectedServer);
    if (result) {
      const relay_channel = transport === "relay" ? Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("") : null;
      setKey({ ...result, server: selectedServer, endpoint: bridge.capabilities.endpoint, relay_channel });
      setCopied(false);
    }
  };
  const downloadPreset = (pairing) => {
    try {
      const text = makePreset({ ...pairing, channel: pairing.channel || pairing.relay_channel,
        endpoint: pairing.endpoint || bridge.capabilities.endpoint,
        server: pairing.server || bridge.server });
      const url = URL.createObjectURL(new Blob([utf16Preset(text)], { type: "application/octet-stream" }));
      const link = document.createElement("a"); link.href = url; link.download = "NugaomMT5.set";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setDownloadError(null);
    } catch (error) { setDownloadError(error.message); }
  };
  const downloadRelayConfig = () => {
    try {
      const url = URL.createObjectURL(new Blob([makeRelayConfig(key)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "NugaomRelay.json";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setDownloadError(null);
    } catch (error) { setDownloadError(error.message); }
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
            CONNECT YOUR MT5 · READ-ONLY
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
      <div className={styles.bridgeActions} role="group" aria-label="ระบบปฏิบัติการของ MT5">
        {["windows", "mac"].map(value => <button key={value}
          className={platform === value ? styles.primaryButton : styles.secondaryButton}
          aria-pressed={platform === value} onClick={() => setPlatform(value)}>
          {value === "mac" ? "Mac" : "Windows"}
        </button>)}
      </div>
      <div className={styles.bridgeActions} role="group" aria-label="วิธีส่งข้อมูลจาก MT5">
        <button aria-pressed={transport === "webrequest"} className={transport === "webrequest" ? styles.primaryButton : styles.secondaryButton}
          onClick={() => setTransport("webrequest")}>ส่งจาก EA โดยตรง</button>
        <button aria-pressed={transport === "relay"} className={transport === "relay" ? styles.primaryButton : styles.secondaryButton}
          onClick={() => setTransport("relay")}>ส่งผ่านไฟล์ · ไม่ใช้ช่อง URL</button>
      </div>
      {transport === "relay" && <p className={styles.note}>ใช้ตัวส่งไฟล์บนเครื่องลูกค้า เปิดคู่กับ MT5
        ต้องติดตั้ง Node.js รุ่น 22 ขึ้นไป และเชื่อมกับเว็บ HTTPS ของระบบ</p>}
      <p>เลือก Server ตามที่แสดงในบัญชี MT5 ของคุณ · รองรับ {available.length} Server</p>
      {bridge.clock && <p className={styles.note}>
        {bridge.clock.status === "ready" ? `ตรวจเวลาปัจจุบันแล้ว · UTC ${bridge.clock.offset_minutes >= 0 ? "+" : ""}${bridge.clock.offset_minutes / 60}` :
          bridge.clock.status === "awaiting_connector" ? "อัปเดต Connector เพื่อให้ตรวจเวลาและรับราคาอัตโนมัติ" :
          "กำลังรอราคาล่าสุดจาก MT5 เพื่อตรวจเวลา · ถ้าตลาดปิดจะพักการตรวจไว้"}
      </p>}
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
          เลือกวิธีเชื่อมต่อได้เลย ระบบจะเริ่มการเชื่อมต่อบนเครื่องนี้ให้อัตโนมัติ
        </p>
      )}
      {bridge.capabilities.enabled && !selectedServer && (
        <p className={styles.note}>ต้องกำหนด Vantage Server ก่อนสร้างกุญแจ</p>
      )}
      {!bridge.authorized &&
        !bridge.capabilities.local &&
        bridge.capabilities.enabled && (
          <p className={styles.note}>
            {bridge.capabilities.memberLoginConfigured === false
              ? "เว็บทดสอบพร้อมแล้ว · กำลังเตรียมการเข้าสู่ระบบก่อนเปิดให้ลูกค้าผูก MT5"
              : "เข้าสู่ระบบด้วย LINE ตามปกติก่อนสร้างกุญแจจับคู่"}
          </p>
        )}
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
                setKey({ ...result, server: selectedServer, endpoint: bridge.capabilities.endpoint });
                setCopied(false);
              }
            }}
          >
            เชื่อมผ่านไฟล์บน Mac
          </button>
          {localFile && (
            <>
              <p>
                คัดลอกรหัสเต็ม 32 ตัวด้านล่างไปใส่ใน EA ช่อง LocalChannel
                ไม่ใช้กุญแจ WebRequest
              </p>
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
                ลาก EA รุ่นใหม่ลงกราฟบัญชี Vantage → Inputs:
                LocalFiles = true และ LocalChannel = รหัสด้านบน ปล่อย
                BridgeToken ว่างได้
              </p>
              <p>
                ถ้ารีสตาร์ตเว็บเซิร์ฟเวอร์ ให้กดเชื่อมใหม่และเปลี่ยน
                LocalChannel ใน EA
              </p>
              <button className={styles.secondaryButton} onClick={() => downloadPreset(localFile)}>
                <Download size={14} /> ดาวน์โหลดค่าตั้งสำหรับไฟล์บนเครื่องนี้
              </button>
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
      <div className={styles.bridgeActions}>
        <button
          className={
            bridge.capabilities.localFiles
              ? styles.secondaryButton
              : styles.primaryButton
          }
          disabled={!canPair || bridge.busy || (transport === "relay" && !bridge.capabilities.endpoint?.startsWith("https://"))}
          onClick={pair}
        >
          <Cable size={16} />{" "}
          {bridge.busy ? "กำลังดำเนินการ…" : transport === "relay" ? "สร้างกุญแจสำหรับตัวส่งไฟล์" : "สร้างกุญแจผ่าน WebRequest"}
        </button>
        <a className={styles.secondaryButton} href="/api/forex/mt5/connector?format=ex5">
          <Download size={16} /> ดาวน์โหลด EA พร้อมใช้ (.ex5)
        </a>
      </div>
      {key?.token && (
        <div className={styles.pairingKey}>
          <strong>
            กุญแจแสดงครั้งเดียว · หมดอายุ{" "}
            {new Date(key.expires_at).toLocaleDateString("th-TH")}
          </strong>
          <button className={styles.primaryButton} onClick={() => downloadPreset(key)}>
            <Download size={16} /> ดาวน์โหลดค่าตั้ง MT5 (.set)
          </button>
          <p>ใน MT5 เปิด EA → Inputs → Load แล้วเลือก NugaomMT5.set → OK
            ไฟล์นี้มีกุญแจของคุณ เก็บไว้กับตัวเอง สร้างกุญแจใหม่ได้เมื่อหมดอายุ</p>
          {key.relay_channel && <>
            <button className={styles.secondaryButton} onClick={downloadRelayConfig}>
              <Download size={14} /> ดาวน์โหลดค่าตั้งตัวส่งไฟล์ (.json)
            </button>
            <a className={styles.secondaryButton} href="/api/forex/mt5/connector?format=relay">
              ดาวน์โหลดตัวส่งไฟล์ Mac / Windows (.zip)
            </a>
            <p>แตก ZIP ติดตั้ง Node.js รุ่น 22 ขึ้นไป แล้วเปิดตัวส่งไฟล์ตามคู่มือใน ZIP
              เลือก NugaomRelay.json และโฟลเดอร์ MQL5/Files/NugaomBridge ของ MT5
              โหลด .set ใน EA · วิธีนี้ไม่ต้องเพิ่ม WebRequest URL</p>
          </>}
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
      {downloadError && <p role="alert" className={styles.negative}>{downloadError}</p>}
      <h3>ผูก MT5 ด้วยตัวเอง · {platform === "mac" ? "Mac" : "Windows"}</h3>
      <ol className={styles.bridgeSteps}>
        <li>เข้าสู่ระบบบัญชี Vantage ใน MT5 Desktop แล้วเลือก Server เดียวกันบนหน้านี้
          {platform === "mac" && <p>ใช้ MT5 Desktop ที่มี MetaEditor และ Expert Advisors
            แอป iPhone/iPad บน Mac ใช้ EA ไม่ได้</p>}
        </li>
        <li>ดาวน์โหลด EA พร้อมใช้ เปิด MT5 → File → Open Data Folder → MQL5 → Experts
          แล้ววางไฟล์ NugaomReadOnlyBridge.ex5
          {platform === "mac" && <p>หากหาโฟลเดอร์ไม่เจอ ให้เปิดผ่านเมนู File ของ MT5 โดยตรง</p>}
          กลับ MT5 → Navigator → Expert Advisors → คลิกขวา Refresh
          <p><a href="/api/forex/mt5/connector">ดาวน์โหลดไฟล์ต้นฉบับ .mq5</a> สำหรับเปิดและ Compile ใน MetaEditor หาก EA ใช้กับรุ่น MT5 นี้ไม่ได้</p>
        </li>
        <li>กดสร้างกุญแจตามวิธีที่เลือก แล้วดาวน์โหลดค่าตั้ง .set
          ลาก EA ลงกราฟเพียงหนึ่งกราฟ → Inputs → Load → เลือก NugaomMT5.set
        </li>
        <li>{transport === "webrequest" ? <>เปิด Tools → Options → Expert Advisors → Allow WebRequest
          แล้วเพิ่ม URL <code>{bridge.capabilities.endpoint ? new URL(bridge.capabilities.endpoint).origin : "HTTPS ของเว็บนี้"}</code>
          <p>ช่องเพิ่ม URL ต้องดับเบิลคลิกก่อนพิมพ์หรือวาง หากยังพิมพ์ไม่ได้บน Mac
            ให้เลือกวิธีส่งผ่านไฟล์ด้านบน</p></> : <>ดาวน์โหลดตัวส่งไฟล์กับค่าตั้ง .json แล้วเปิดตัวส่งไฟล์ตามคู่มือ ไม่ต้องเพิ่ม WebRequest URL</>}
        </li>
        <li>กด OK แล้วกลับหน้านี้ ระบบจะแสดงสถานะและจำนวนสินทรัพย์เมื่อรับครบ
          ราคาจะเริ่มหลังตรวจเวลาปัจจุบันได้ กราฟจะสะสมแท่งที่ปิดหลังเริ่มตรวจเวลา
          เปิด MT5 และ EA ทิ้งไว้ระหว่างใช้งาน
        </li>
      </ol>
      {bridge.capabilities.local && <p className={styles.note}>
        ขณะนี้เป็นระบบบนเครื่องนี้ ลูกค้าบนเครื่องอื่นต้องเข้าผ่านเว็บ HTTPS ที่เปิดใช้งานแล้ว
        การเชื่อมผ่านไฟล์บน Mac ใช้ได้เฉพาะ MT5 กับเว็บที่รันบนเครื่องเดียวกัน
      </p>}
      <div className={styles.readOnly}>
        <ShieldCheck size={17} />
        <span>
          อ่านตลาดเท่านั้น · ไม่มีรหัสผ่าน MT5 ข้อมูลพอร์ต หรือคำสั่งซื้อขาย
        </span>
      </div>
    </section>
  );
}
