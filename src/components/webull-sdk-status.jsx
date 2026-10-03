const STATES = {
  verified: 'ตรวจผ่าน', partial: 'ผ่านบางส่วน', failed: 'เชื่อมต่อไม่สำเร็จ',
  'not-checked': 'ยังไม่มีผลตรวจของคีย์ชุดนี้', 'not-configured': 'ยังไม่ได้ตั้งคีย์',
  'invalid-config': 'ภูมิภาคหรือสภาพแวดล้อมไม่ถูกต้อง',
};
const date = value => value ? new Date(value).toLocaleString('th-TH', {
  timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short',
}) : '—';

export default function WebullSdkStatus({ data }) {
  if (!data) return null;
  return <article className="admin-market-card admin-webull-status" aria-label="ผลตรวจ Webull SDK">
    <div><strong>Webull SDK · {data.environment === 'sandbox' ? 'Sandbox' : 'Production'}</strong>
      <span className={`admin-state ${data.status === 'verified' ? 'ok' : 'bad'}`}>{STATES[data.status] || 'ไม่ทราบสถานะ'}</span></div>
    <p>ผลการลองเชื่อมต่อครั้งล่าสุด · ภูมิภาค {data.region?.toUpperCase()}</p>
    {data.snapshot && <small>{data.snapshot.symbol} · ราคาอ้างอิง ${data.snapshot.price.toFixed(2)} · เวลาตลาด {date(data.snapshot.observedAt)} · คำขอตอบกลับ {data.snapshot.responseMs} ms</small>}
    {data.bars && <small>แท่ง {data.bars.timeframe} ที่ตรวจใช้ได้ {data.bars.count.toLocaleString('th-TH')} แท่ง · ล่าสุด {date(data.bars.latestTime)}</small>}
    {data.stream && <small>MQTT {data.stream.status === 'verified' ? `รับราคาจริง ${data.stream.pricedMessages} ข้อความระหว่างตรวจ` : 'ยังไม่ยืนยันการรับราคา'} · ตรวจเมื่อ {date(data.stream.checkedAt)}</small>}
    <p>{data.environment === 'sandbox'
      ? 'เป็นผลจากระบบทดสอบ ยังไม่ใช้ยิงสัญญาณลูกค้า และไม่ได้เปิดสตรีมค้างไว้'
      : 'ยังไม่เชื่อมเข้าระบบสัญญาณลูกค้า ผลตรวจนี้ไม่ใช่สถานะสตรีมที่รันต่อเนื่อง'}</p>
    {data.production?.checkedAt && <p>Production ตรวจเมื่อ {date(data.production.checkedAt)} · {data.production.status === 'unauthorized'
      ? 'คีย์ยังเข้าระบบจริงไม่ได้ (401)'
      : data.production.status === 'data-verified' ? 'อ่านราคาและแท่งผ่าน · ยังต้องยืนยันฟีดสดและสิทธิแสดงให้ลูกค้า'
        : data.production.status === 'approval-required' ? 'ต้องยืนยันการเข้าถึงในแอป Webull' : 'ยังอ่านข้อมูลจริงไม่ผ่าน'}</p>}
    <a href="https://developer.webull.com/apis/docs/market-data-api/subscribe-quotes/" target="_blank" rel="noopener noreferrer">วิธีเปิดสิทธิ OpenAPI Market Data ↗</a>
    {data.environment === 'sandbox' && <a className="account-secondary" href="/admin/webull">เปิดห้องทดลองกราฟและสแกนหุ้นสหรัฐฯ 500 ตัว →</a>}
  </article>;
}
