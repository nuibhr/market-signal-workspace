import { Cable, ShieldCheck } from "lucide-react";
import {
  CONNECTION_STATES,
  GUEST_CONNECTION,
  SUPPORTED_BROKERS,
} from "./brokers.mjs";
import styles from "./forex-workspace.module.css";

export default function ConnectionPanel() {
  const state = CONNECTION_STATES[GUEST_CONNECTION.status];
  return (
    <section
      id="forex-connection"
      className={styles.panel}
      aria-labelledby="connection-title"
    >
      <div className={styles.panelHeading}>
        <div>
          <span className={styles.eyebrow}>BROKER CONNECTION</span>
          <h2 id="connection-title">Vantage MT5</h2>
        </div>
        <Cable size={22} />
      </div>
      <div className={styles.connectionState}>
        <span className={styles.dot} />
        <strong>{state.label}</strong>
      </div>
      <p>{state.detail} · ยังไม่มีราคาและสเปรดจากบัญชีโบรกเกอร์</p>
      <dl className={styles.connectionFacts}>
        <div>
          <dt>โบรกเกอร์ที่รองรับ</dt>
          <dd>{SUPPORTED_BROKERS.map((broker) => broker.name).join(", ")}</dd>
        </div>
        <div>
          <dt>แพลตฟอร์ม</dt>
          <dd>MetaTrader 5</dd>
        </div>
        <div>
          <dt>ซิงก์ล่าสุด</dt>
          <dd>ยังไม่มี</dd>
        </div>
      </dl>
      <button
        className={styles.primaryButton}
        disabled
        aria-describedby="connection-note"
      >
        <Cable size={16} />
        Connect Vantage MT5 · เร็ว ๆ นี้
      </button>
      <p id="connection-note" className={styles.note}>
        การเชื่อมต่อยังไม่เปิดใช้งานในระยะนี้
        สำรวจรายการเริ่มต้นได้โดยไม่ต้องเชื่อมบัญชี
      </p>
      <div className={styles.readOnly}>
        <ShieldCheck size={17} />
        <span>ไม่มีการรับรหัสผ่านหรือส่งคำสั่งซื้อขาย</span>
      </div>
    </section>
  );
}
