// Registry is keyed by broker ID so future adapters do not depend on Vantage UI.
// This is product configuration, not terminal/server identity verification.
export const BROKERS = Object.freeze({
  vantage: Object.freeze({
    id: "vantage",
    name: "Vantage",
    platform: "MT5",
    supported: true,
    connectionAvailable: false,
    adapter: "mt5",
    verifiedServers: Object.freeze([]),
  }),
});
export const SUPPORTED_BROKERS = Object.freeze(
  Object.values(BROKERS).filter((broker) => broker.supported),
);
export const getSupportedBroker = (id) =>
  BROKERS[id]?.supported ? BROKERS[id] : null;

export const CONNECTION_STATES = Object.freeze({
  disconnected: {
    label: "ยังไม่ได้เชื่อม MT5",
    detail: "กำลังใช้รายการเริ่มต้น 19 สัญลักษณ์",
  },
  connecting: {
    label: "กำลังตรวจการเชื่อมต่อ",
    detail: "รอข้อมูลจาก MT5 Connector",
  },
  connected: {
    label: "MT5 เชื่อมต่อแล้ว",
    detail: "รอซิงก์รายการสินทรัพย์จากโบรกเกอร์",
  },
  syncing: { label: "กำลังซิงก์สินทรัพย์", detail: "กำลังอ่านรายการจาก MT5" },
  ready: { label: "รายการสินทรัพย์พร้อม", detail: "ซิงก์ข้อมูลจาก MT5 แล้ว" },
  stale: {
    label: "การเชื่อมต่อขาดช่วง",
    detail: "ข้อมูลล่าสุดอาจไม่เป็นปัจจุบัน",
  },
  error: {
    label: "เชื่อมต่อไม่สำเร็จ",
    detail: "ตรวจการเชื่อมต่อกับ MT5 Connector",
  },
  unsupported: {
    label: "ไม่รองรับโบรกเกอร์นี้",
    detail: "ขณะนี้รองรับเฉพาะ Vantage",
  },
});

/**
 * Future read-only adapter contract. No passwords, credentials or order methods.
 * @typedef {Object} Mt5Connection
 * @property {keyof typeof CONNECTION_STATES} status
 * @property {string|null} broker_id
 * @property {string|null} server Terminal-reported server, verified by a future backend.
 * @property {string|null} last_seen_at ISO UTC timestamp
 * @property {string|null} last_sync_at ISO UTC timestamp
 * @property {string|null} error_code Safe machine-readable error, never raw terminal logs.
 */
export const GUEST_CONNECTION = Object.freeze({
  status: "disconnected",
  broker_id: null,
  server: null,
  last_seen_at: null,
  last_sync_at: null,
  error_code: null,
});
