'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight,Check,RefreshCw,X,Sparkles} from 'lucide-react';
const ERRORS={DEMO_BILLING_TEST_ONLY:'Demo เปิดได้เฉพาะ Stripe Test mode กรุณาเข้าสู่ระบบ LINE เพื่อชำระเงินจริง',STRIPE_NOT_CONFIGURED:'กำลังเตรียมระบบชำระเงิน Stripe',INVALID_STRIPE_PRICE:'ราคาใน Stripe ยังไม่ตรงกับแพ็กเกจ กรุณาให้ผู้ดูแลตรวจสอบ',INVALID_BILLING_CONFIG:'การตั้งค่าแพ็กเกจยังไม่ครบ',SUBSCRIPTION_EXISTS:'บัญชีนี้มีสมาชิกหรือรายการชำระเงินอยู่แล้ว กรุณาเปิดจัดการสมาชิก',CHECKOUT_ALREADY_OPEN:'มีหน้าชำระเงินแพ็กเกจอื่นเปิดอยู่ กรุณาดำเนินการหรือรอรายการเดิมหมดอายุ',CHECKOUT_PENDING:'กำลังเตรียมหน้าชำระเงิน ลองอีกครั้งในสักครู่',LOGIN_REQUIRED:'กรุณาเข้าสู่ระบบ LINE ก่อนเลือกแพ็กเกจ',BILLING_CUSTOMER_REQUIRED:'ยังไม่มีบัญชีการชำระเงิน Stripe',RATE_LIMITED:'ส่งคำขอบ่อยเกินไป กรุณารอสักครู่'};
const statusLabel={active:'ใช้งานอยู่',past_due:'ชำระเงินไม่สำเร็จ',canceled:'ยกเลิกแล้ว',incomplete:'รอยืนยันการชำระเงิน',unpaid:'ค้างชำระ',paused:'พักสมาชิก',incomplete_expired:'รายการหมดอายุ'};

const COMPARISON_ROWS = [
  {
    feature: 'ขอบเขตตลาดหลัก',
    trial: { type: 'text', label: 'ไทย + DR80 (2 ตลาด)' },
    basic: { type: 'text', label: 'ไทย + DR80 (2 ตลาด)' },
    vip: { type: 'yes', label: 'ครบ 5 ตลาด (ไทย · DR80 · US · TFEX · Forex)' },
  },
  {
    feature: 'โควตาสแกนหุ้นเด่น (Stage 2 / DR)',
    trial: { type: 'text', label: 'สูงสุด 3 หุ้น / รอบ' },
    basic: { type: 'text', label: 'สูงสุด 3 หุ้น / รอบ' },
    vip: { type: 'yes', label: 'สูงสุด 8 หุ้น / รอบ' },
  },
  {
    feature: 'โพยหุ้นเด่นเช้า 09:30 & การบ้านเย็น 17:30',
    trial: { type: 'text', label: 'ดูได้ (ไทย / DR 3 ตัว)' },
    basic: { type: 'text', label: 'ดูได้ (ไทย / DR 3 ตัว)' },
    vip: { type: 'yes', label: 'ครบทุกตลาด (สูงสุด 8 ตัว ไม่ซ้ำรอบ)' },
  },
  {
    feature: 'Instant Stock Doctor (แนวรับ-ต้าน-จุดคัท)',
    trial: { type: 'yes', label: 'ปลดล็อก (ไทย + DR80)' },
    basic: { type: 'yes', label: 'ปลดล็อก (ไทย + DR80)' },
    vip: { type: 'yes', label: 'ไม่จำกัดตัว + ครบทุกตลาด' },
  },
  {
    feature: 'DR Arbitrage Fair Value & Indicative Bridge',
    trial: { type: 'text', label: 'ดูข้อมูลพื้นฐาน' },
    basic: { type: 'no', label: 'ไม่รวม Alert เต็มระบบ' },
    vip: { type: 'yes', label: 'คำนวณ Fair Value & ส่วนต่างเต็มระบบ' },
  },
  {
    feature: 'ห้องแจ้งเตือน Telegram VIP (ลิงก์ 1 สิทธิ์เฉพาะตัว)',
    trial: { type: 'no', label: 'ไม่ได้รับ' },
    basic: { type: 'no', label: 'ไม่ได้รับ' },
    vip: { type: 'yes', label: 'โพยเช้า 09:30, เย็น 17:30, DR & TFEX สด' },
  },
  {
    feature: 'เสียงพากย์สด "น้องนักออม AI" (Voice Alerts)',
    trial: { type: 'no', label: 'ไม่ได้รับ' },
    basic: { type: 'no', label: 'ไม่ได้รับ' },
    vip: { type: 'yes', label: 'เสียงพากย์ไทยสดทันทีเมื่อเกิดสัญญาณ' },
  },
  {
    feature: 'โควตาถามคำถาม "น้องนักออม AI"',
    trial: { type: 'text', label: '5 คำถาม / วัน' },
    basic: { type: 'text', label: '10 คำถาม / วัน' },
    vip: { type: 'yes', label: '50 คำถาม / วัน' },
  },
  {
    feature: 'โต๊ะคำนวณไม้ 2R Risk & เกราะเตือนหุ้นขาลง Stage 4',
    trial: { type: 'text', label: 'พื้นฐาน (ไทย + DR80)' },
    basic: { type: 'text', label: 'พื้นฐาน (ไทย + DR80)' },
    vip: { type: 'yes', label: 'Full Option ครบ 5 ตลาด + ล็อกทุน' },
  },
  {
    feature: 'Daytrade 15m · TFEX S50 & Options · Macro AI',
    trial: { type: 'no', label: 'ล็อกตลาด TFEX / US / Forex' },
    basic: { type: 'no', label: 'ล็อกตลาด TFEX / US / Forex' },
    vip: { type: 'yes', label: 'ปลดล็อกครบทุกเครื่องมือ Pro Suite' },
  },
  {
    feature: 'ห้องพูดคุยโค้ช & VIP Community (/community, /coaches)',
    trial: { type: 'text', label: 'อ่านอย่างเดียว' },
    basic: { type: 'text', label: 'อ่านอย่างเดียว (โพสต์ไม่ได้)' },
    vip: { type: 'yes', label: 'โพสต์พูดคุย ถาม-ตอบทีมโค้ชเต็มรูปแบบ' },
  },
  {
    feature: 'ช่องทางรับสิทธิ์ & ค่าบริการ',
    trial: { type: 'text', label: 'ฟรี 14 วัน (ล็อกอิน LINE)' },
    basic: { type: 'text', label: '฿159/ด. (รายปี ฿1,590)' },
    vip: { type: 'yes', label: '฿399/ด. หรือ ฟรีพอร์ต Pi/Trinity/ASL (ค่าคอม ≥ ฿1,000/ด.)' },
  },
];

function ComparisonCell({ cell }) {
  if (cell.type === 'yes') return <span className="check-yes"><Check size={14} /> {cell.label}</span>;
  if (cell.type === 'no') return <span className="cross-no"><X size={14} /> {cell.label}</span>;
  return <span>{cell.label}</span>;
}

export default function BillingPanel({account,rights,billing,onRefresh}){
 const managed=Boolean(billing?.subscription&&!['canceled','incomplete_expired'].includes(billing.subscription.status));
 const [catalog,setCatalog]=useState(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[returned,setReturned]=useState(null);
 const [billingCycle,setBillingCycle]=useState('month'); // 'month' | 'year'

 useEffect(()=>{const controller=new AbortController();fetch('/api/billing/plans',{cache:'no-store',signal:controller.signal}).then(r=>r.json()).then(setCatalog).catch(()=>{if(!controller.signal.aborted)setError('โหลดแพ็กเกจไม่สำเร็จ');});setReturned(new URLSearchParams(window.location.search).get('billing'));return()=>controller.abort();},[]);
 // Recheck actual server entitlement after checkout; the return URL never grants membership.
 useEffect(()=>{if(returned!=='success'||rights?.billingSource==='stripe')return;const id=setInterval(()=>{if(document.visibilityState==='visible')onRefresh().catch(()=>{});},4000);const stop=setTimeout(()=>clearInterval(id),60000);return()=>{clearInterval(id);clearTimeout(stop);};},[returned,rights?.billingSource,onRefresh]);

 async function go(kind,planId){setBusy(planId||kind);setError('');try{const r=await fetch(`/api/billing/${kind}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(kind==='checkout'?{planId,interval:billingCycle}:{planId})});const data=await r.json();if(!r.ok)throw Error(data.error);const url=new URL(data.url);if(url.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com'].includes(url.hostname))throw Error('STRIPE_UNAVAILABLE');window.location.assign(url.href);}catch(e){setError(ERRORS[e.message]??'เชื่อมต่อ Stripe ไม่สำเร็จ กรุณาลองใหม่');setBusy('');}}

 const starterPlan=catalog?.plans?.find(p=>p.id==='starter')||{id:'starter',amount:15900,ready:true};
 const proPlan=catalog?.plans?.find(p=>p.id==='pro')||{id:'pro',amount:39900,ready:true};
 const starterAnnualUnavailable=billingCycle==='year'&&!managed&&Boolean(catalog?.configured)&&starterPlan.annualPriceReady===false;
 const proAnnualUnavailable=billingCycle==='year'&&!managed&&Boolean(catalog?.configured)&&proPlan.annualPriceReady===false;

 return <section className="account-card account-billing" id="membership-plans">
  <div className="account-section-heading">
   <div>
    <span className="account-kicker">MEMBERSHIP TIERS / เลือกระดับสมาชิก</span>
    <h2>แพ็กเกจและน้องนักออม AI · สิทธิประโยชน์</h2>
    <p>เลือกแผนที่เหมาะกับสไตล์การเทรดของคุณ · ยกเลิกหรือเปลี่ยนแผนได้ตลอดเวลา</p>
   </div>
  </div>

  {/* ── Billing Cycle Switch (Monthly / Annual 2 Months Free) ── */}
  <div className="billing-cycle-wrap">
   <div className="billing-cycle-switch" role="group" aria-label="เลือกรอบบิล">
    <button
     type="button"
     className={`cycle-btn ${billingCycle==='month'?'active':''}`}
     onClick={()=>setBillingCycle('month')}
    >
     ชำระรายเดือน
    </button>
    <button
     type="button"
     className={`cycle-btn ${billingCycle==='year'?'active':''}`}
     onClick={()=>setBillingCycle('year')}
    >
     ชำระรายปี <span className="annual-pill">ฟรี 2 เดือน 🔥</span>
    </button>
   </div>
  </div>

  {returned==='success'&&<p className="account-alert" role="status">{rights?.billingSource==='stripe'?'ระบบยืนยันสิทธิ์แพ็กเกจแล้ว':'กลับจากหน้าชำระเงินแล้ว กำลังรอ Stripe ยืนยันสถานะ สิทธิ์จะอัปเดตหลังระบบตรวจสอบ'}</p>}
  {catalog?.configured&&catalog.mode==='test'&&<p className="account-billing-note">Stripe โหมดทดสอบ · ไม่มีการเรียกเก็บเงินจริง</p>}
  {returned==='cancelled'&&<p className="account-alert">คุณออกจากหน้าชำระเงิน สามารถเลือกแพ็กเกจอีกครั้งได้</p>}
  {billing?.subscription&&<div className="account-billing-current"><b>{rights?.planName??'สมาชิก Stripe'}</b><span>{statusLabel[billing.subscription.status]??'กำลังตรวจสอบสถานะ'}{billing.subscription.cancelAtPeriodEnd?' · ยกเลิกต่ออายุเมื่อจบรอบ':''}</span>{billing.subscription.paidUntil&&<small>สิทธิ์ที่ชำระแล้วถึง {new Date(billing.subscription.paidUntil).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</small>}</div>}
  {!catalog?.configured&&<p className="account-billing-note">{catalog?ERRORS[catalog.error]??'ระบบชำระเงินยังไม่พร้อมใช้งาน':'กำลังโหลดแพ็กเกจ…'} · ราคาด้านล่างเป็นแพ็กเกจที่กำหนดไว้ ปุ่มสมัครจะเปิดเมื่อเชื่อม Stripe พร้อมแล้ว</p>}
  {error&&<p className="account-alert error" role="alert">{error}</p>}

  {/* ── 2 Main Tier Cards ── */}
  <div className="account-package-grid-2">
   {/* Tier 1: BASIC */}
   <article className={`package-card ${rights?.planId==='starter'?'selected':''}`}>
    <div className="package-head">
     <h3 className="package-title">🟢 BASIC</h3>
     <p className="package-subtitle">สายเริ่มต้น · เหมาะสำหรับเช็คหุ้น ทำการบ้านรายวัน</p>
    </div>
    <div className="package-price-wrap">
     <div className="package-price-num">
      {billingCycle==='month'?'฿159':'฿1,590'}
      <small>/{billingCycle==='month'?'เดือน':'ปี'}</small>
     </div>
     {billingCycle==='year'&&(
      <p className="package-savings-note">✨ จ่าย 10 เดือน ได้ใช้ 12 เดือน (ประหยัด 318 บาท)</p>
     )}
    </div>
    <span className="package-ai-quota">โควตาถาม AI: 10 คำถาม / วัน</span>
    <ul className="package-feature-list">
     <li><Check size={16} className="feat-icon-ok"/> สแกนหุ้นขาขึ้น Stage 2 (SET100 &amp; DR พื้นฐาน 3 หุ้น/รอบ)</li>
     <li><Check size={16} className="feat-icon-ok"/> ค้นหาแนวรับ-แนวต้านด่วน (Stock Doctor)</li>
     <li><Check size={16} className="feat-icon-ok"/> โต๊ะคำนวณไม้ 2R Position Sizing พื้นฐาน</li>
     <li><Check size={16} className="feat-icon-ok"/> ดูกราฟเทคนิค &amp; อินดิเคเตอร์ D1/4H</li>
     <li className="is-disabled"><X size={16} className="feat-icon-no"/> การบ้านหุ้นเด่นส่งเข้า Telegram VIP</li>
     <li className="is-disabled"><X size={16} className="feat-icon-no"/> DR Arbitrage Fair Value Alert เต็มระบบ</li>
     <li className="is-disabled"><X size={16} className="feat-icon-no"/> เสียงแจ้งเตือนน้องนักออม AI ทันที</li>
     <li className="is-disabled"><X size={16} className="feat-icon-no"/> สิทธิ์ปลดล็อกโควตา AI 50 คำถาม/วัน</li>
    </ul>
    {!account?<a href="/api/auth/line/start" className="account-secondary">เข้าสู่ระบบ LINE</a>:<button className="account-secondary" disabled={Boolean(busy)||!catalog?.configured||starterAnnualUnavailable} onClick={()=>go(managed?'portal':'checkout',starterPlan.id)}>{busy===starterPlan.id?'กำลังเปิด…':starterAnnualUnavailable?'รายปียังไม่เปิดใช้':rights?.planId==='starter'?'แพ็กเกจปัจจุบัน':managed?'เปลี่ยนเป็น BASIC':billingCycle==='year'?'สมัคร BASIC รายปี':'สมัครแพ็กเกจ BASIC'} <ArrowUpRight size={15}/></button>}
   </article>

   {/* Tier 2: PRO VIP (Hero) */}
   <article className={`package-card highlight ${rights?.planId==='pro'?'selected':''}`}>
    <span className="package-badge-popular">🌟 ยอดนิยม แนะนำ</span>
    <div className="package-head">
     <h3 className="package-title">👑 PRO VIP</h3>
     <p className="package-subtitle">สายลุยทำกำไร · ปลดล็อกครบทุกตลาด + การบ้านหุ้นส่งเข้า Telegram VIP</p>
    </div>
    <div className="package-price-wrap">
     <div className="package-price-num">
      {billingCycle==='month'?'฿399':'฿3,990'}
      <small>/{billingCycle==='month'?'เดือน':'ปี'}</small>
     </div>
     {billingCycle==='year'&&(
      <p className="package-savings-note">🔥 ฟรี 2 เดือนเต็ม! (ประหยัดทันที 798 บาท · เฉลี่ย ฿332/ด.)</p>
     )}
    </div>
    <span className="package-ai-quota">โควตาถาม AI: 50 คำถาม / วัน</span>
    <ul className="package-feature-list">
     <li><Check size={16} className="feat-icon-ok"/> <b>ปลดล็อกครบ 5 ตลาด:</b> หุ้นไทย + DR80 + US + TFEX + Forex (สูงสุด 8 หุ้น/รอบ)</li>
     <li><Check size={16} className="feat-icon-ok"/> <b>Telegram VIP Bot:</b> โพยหุ้นเช้า 09:30, การบ้านเย็น 17:30, DR &amp; TFEX สด</li>
     <li><Check size={16} className="feat-icon-ok"/> <b>ค้นหาแนวรับ-แนวต้านด่วน ไม่จำกัดตัว + ครบทุกตลาด</b></li>
     <li><Check size={16} className="feat-icon-ok"/> <b>เสียงแจ้งเตือนน้องนักออม AI ภาษาไทยสดทันที</b> (Voice Alerts)</li>
     <li><Check size={16} className="feat-icon-ok"/> <b>DR Arbitrage Shield</b> คำนวณ Fair Value &amp; ส่วนต่างเต็มระบบ</li>
     <li><Check size={16} className="feat-icon-ok"/> Daytrade Desk 15m, TFEX S50 Options &amp; โต๊ะคำนวณไม้ 2R ครบ 5 ตลาด</li>
     <li><Check size={16} className="feat-icon-ok"/> <b>สิทธิ์โพสต์พูดคุยในห้องโค้ช &amp; VIP Community</b></li>
     <li><Check size={16} className="feat-icon-ok"/> โควตาถาม AI ลึกระดับ Pro 50 คำถาม/วัน (หรือรับฟรีเมื่อเปิดพอร์ต ค่าคอม ≥ ฿1,000/ด.)</li>
    </ul>
    {!account?<a href="/api/auth/line/start" className="account-primary">เข้าสู่ระบบ LINE</a>:<button className="account-primary" disabled={Boolean(busy)||!catalog?.configured||proAnnualUnavailable} onClick={()=>go(managed?'portal':'checkout',proPlan.id)}>{busy===proPlan.id?'กำลังเปิด…':proAnnualUnavailable?'รายปียังไม่เปิดใช้':rights?.planId==='pro'?'แพ็กเกจปัจจุบัน':managed?'อัปเกรดเป็น PRO VIP':billingCycle==='year'?'สมัคร PRO VIP รายปี':'สมัคร PRO VIP'} <ArrowUpRight size={15}/></button>}
   </article>
  </div>

  {/* ── Partner Broker VIP Privilege Strip (Pi 003, Trinity 022 & ASL 050) ── */}
  <div style={{ margin: '18px 0 24px', padding: '18px 22px', borderRadius: '18px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(56, 189, 248, 0.14) 100%)', boxShadow: 'inset 0 1px 1px rgba(114, 223, 179, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
   <div>
    <span style={{ fontSize: '11px', fontWeight: 800, color: '#34d399', letterSpacing: '0.8px', display: 'block', marginBottom: '4px' }}>🏛️ PARTNER BROKER VIP PRIVILEGE</span>
    <strong style={{ color: '#ffffff', fontSize: '15px', display: 'block' }}>เปิดพอร์ตกับ บล.พาย (003), บล.ทรีนีตี้ (022) หรือ บล.เอเอสแอล (050) รับสิทธิ์ PRO VIP ฟรี!</strong>
    <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#cbd5e1' }}>เพียงมียอดค่าคอม ≥ 1,000 บาท/เดือน เจ้าหน้าที่ บล. ยืนยันสิทธิ์เปิด PRO VIP + ห้อง Telegram VIP 30 วันให้ทันที (หรือรับโค้ด NUG-... จากแอดมิน)</p>
   </div>
   <a href="/open-account" className="account-secondary" style={{ whiteSpace: 'nowrap' }}>ยื่นเปิดพอร์ต / ผูกสิทธิ์ VIP ฟรี ↗</a>
  </div>

  {/* ── Clear Feature Comparison Matrix Table ── */}
  <section className="comparison-section" aria-label="ตารางเปรียบเทียบฟีเจอร์อย่างละเอียด">
   <div className="comparison-heading">
    <h3>📊 ตารางเปรียบเทียบสิทธิประโยชน์อย่างละเอียด</h3>
    <p>เทียบชัดทุกระดับ: ทดลองฟรี 14 วัน vs BASIC (159 บ.) vs PRO VIP (399 บ.) / พอร์ตพาร์ทเนอร์</p>
   </div>
   <div className="comparison-table-wrap">
    <table className="comparison-table">
     <thead>
      <tr>
       <th>ความสามารถ / ฟีเจอร์จริงในระบบ</th>
       <th>🎁 ทดลอง 14 วัน<small>ฟรี (LINE Login)</small></th>
       <th>🟢 BASIC<small>฿159/ด. · ฿1,590/ปี</small></th>
       <th className="th-vip">👑 PRO VIP &amp; พอร์ตพาร์ทเนอร์<small>฿399/ด. หรือ ค่าคอม ≥ ฿1,000/ด.</small></th>
      </tr>
     </thead>
     <tbody>
      {COMPARISON_ROWS.map(row => (
       <tr key={row.feature}>
        <td><b>{row.feature}</b></td>
        <td className="col-trial"><ComparisonCell cell={row.trial} /></td>
        <td className="col-basic"><ComparisonCell cell={row.basic} /></td>
        <td className="col-vip"><ComparisonCell cell={row.vip} /></td>
       </tr>
      ))}
     </tbody>
    </table>
   </div>
  </section>

  <div className="account-actions">
   {account&&billing?.hasCustomer&&<button className="account-secondary" disabled={Boolean(busy)} onClick={()=>go('portal')}>จัดการบัตร / ใบเสร็จ / ยกเลิกต่ออายุ <ArrowUpRight size={15}/></button>}
   <button className="account-secondary" onClick={onRefresh}><RefreshCw size={14}/>ตรวจสิทธิ์ล่าสุด</button>
  </div>
  <p className="account-fineprint">สมัครผ่านระบบ Stripe ที่ปลอดภัยระดับสากล ยกเลิกการต่ออายุได้ตลอดเวลาในหน้าจัดการสมาชิก สิทธิ์จะยังคงใช้ได้จนถึงวันสิ้นสุดรอบบิลที่คุณชำระไว้</p>
 </section>;
}

