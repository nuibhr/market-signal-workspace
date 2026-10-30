'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight,Check,RefreshCw,X,Sparkles} from 'lucide-react';
const ERRORS={DEMO_BILLING_TEST_ONLY:'Demo เปิดได้เฉพาะ Stripe Test mode กรุณาเข้าสู่ระบบ LINE เพื่อชำระเงินจริง',STRIPE_NOT_CONFIGURED:'กำลังเตรียมระบบชำระเงิน Stripe',INVALID_STRIPE_PRICE:'ราคาใน Stripe ยังไม่ตรงกับแพ็กเกจ กรุณาให้ผู้ดูแลตรวจสอบ',INVALID_BILLING_CONFIG:'การตั้งค่าแพ็กเกจยังไม่ครบ',SUBSCRIPTION_EXISTS:'บัญชีนี้มีสมาชิกหรือรายการชำระเงินอยู่แล้ว กรุณาเปิดจัดการสมาชิก',CHECKOUT_ALREADY_OPEN:'มีหน้าชำระเงินแพ็กเกจอื่นเปิดอยู่ กรุณาดำเนินการหรือรอรายการเดิมหมดอายุ',CHECKOUT_PENDING:'กำลังเตรียมหน้าชำระเงิน ลองอีกครั้งในสักครู่',LOGIN_REQUIRED:'กรุณาเข้าสู่ระบบ LINE ก่อนเลือกแพ็กเกจ',BILLING_CUSTOMER_REQUIRED:'ยังไม่มีบัญชีการชำระเงิน Stripe',RATE_LIMITED:'ส่งคำขอบ่อยเกินไป กรุณารอสักครู่'};
const statusLabel={active:'ใช้งานอยู่',past_due:'ชำระเงินไม่สำเร็จ',canceled:'ยกเลิกแล้ว',incomplete:'รอยืนยันการชำระเงิน',unpaid:'ค้างชำระ',paused:'พักสมาชิก',incomplete_expired:'รายการหมดอายุ'};

export default function BillingPanel({account,rights,billing,onRefresh}){
 const managed=Boolean(billing?.subscription&&!['canceled','incomplete_expired'].includes(billing.subscription.status));
 const [catalog,setCatalog]=useState(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[returned,setReturned]=useState(null);
 const [billingCycle,setBillingCycle]=useState('month'); // 'month' | 'year'

 useEffect(()=>{const controller=new AbortController();fetch('/api/billing/plans',{cache:'no-store',signal:controller.signal}).then(r=>r.json()).then(setCatalog).catch(()=>{if(!controller.signal.aborted)setError('โหลดแพ็กเกจไม่สำเร็จ');});setReturned(new URLSearchParams(window.location.search).get('billing'));return()=>controller.abort();},[]);
 // Recheck actual server entitlement after checkout; the return URL never grants membership.
 useEffect(()=>{if(returned!=='success'||rights?.billingSource==='stripe')return;const id=setInterval(()=>{if(document.visibilityState==='visible')onRefresh().catch(()=>{});},4000);const stop=setTimeout(()=>clearInterval(id),60000);return()=>{clearInterval(id);clearTimeout(stop);};},[returned,rights?.billingSource,onRefresh]);

 async function go(kind,planId){setBusy(planId||kind);setError('');try{const r=await fetch(`/api/billing/${kind}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planId})});const data=await r.json();if(!r.ok)throw Error(data.error);const url=new URL(data.url);if(url.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com'].includes(url.hostname))throw Error('STRIPE_UNAVAILABLE');window.location.assign(url.href);}catch(e){setError(ERRORS[e.message]??'เชื่อมต่อ Stripe ไม่สำเร็จ กรุณาลองใหม่');setBusy('');}}

 const starterPlan=catalog?.plans?.find(p=>p.id==='starter')||{id:'starter',amount:15900,ready:true};
 const proPlan=catalog?.plans?.find(p=>p.id==='pro')||{id:'pro',amount:39900,ready:true};

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
    <span className="package-ai-quota">โควตาถาม AI: 15 คำถาม / วัน</span>
    <ul className="package-feature-list">
     <li><Check size={16} className="feat-icon-ok"/> สแกนหุ้นขาขึ้น Stage 2 (หุ้น SET100)</li>
     <li><Check size={16} className="feat-icon-ok"/> ค้นหาแนวรับ-แนวต้านด่วน 10 ตัว / วัน</li>
     <li><Check size={16} className="feat-icon-ok"/> โต๊ะคำนวณไม้ 2R Position Sizing พื้นฐาน</li>
     <li><Check size={16} className="feat-icon-ok"/> ดูกราฟเทคนิค &amp; อินดิเคเตอร์ D1/4H</li>
     <li className="is-disabled"><X size={16} className="feat-icon-no"/> การบ้านหุ้นเด่นส่งเข้า LINE Notify</li>
     <li className="is-disabled"><X size={16} className="feat-icon-no"/> ปลดล็อก DR80, หุ้นสหรัฐฯ, TFEX</li>
     <li className="is-disabled"><X size={16} className="feat-icon-no"/> เสียงแจ้งเตือน Real-Time ทันที</li>
     <li className="is-disabled"><X size={16} className="feat-icon-no"/> สิทธิ์เข้ากลุ่มปิด VIP Community</li>
    </ul>
    {!account?<a href="/api/auth/line/start" className="account-secondary">เข้าสู่ระบบ LINE</a>:<button className="account-secondary" disabled={Boolean(busy)||!catalog?.configured} onClick={()=>go(managed?'portal':'checkout',starterPlan.id)}>{busy===starterPlan.id?'กำลังเปิด…':rights?.planId==='starter'?'แพ็กเกจปัจจุบัน':managed?'เปลี่ยนเป็น BASIC':'สมัครแพ็กเกจ BASIC'} <ArrowUpRight size={15}/></button>}
   </article>

   {/* Tier 2: PRO VIP (Hero) */}
   <article className={`package-card highlight ${rights?.planId==='pro'?'selected':''}`}>
    <span className="package-badge-popular">🌟 ยอดนิยม แนะนำ</span>
    <div className="package-head">
     <h3 className="package-title">👑 PRO VIP</h3>
     <p className="package-subtitle">สายลุยทำกำไร · ปลดล็อกครบทุกตลาด + รับหุ้นเด่นเข้า LINE</p>
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
    <span className="package-ai-quota">โควตาถาม AI: 60 คำถาม / วัน</span>
    <ul className="package-feature-list">
     <li><Check size={16} className="feat-icon-ok"/> <b>ปลดล็อกครบทุกตลาด:</b> หุ้นไทย + DR80 + US + TFEX</li>
     <li><Check size={16} className="feat-icon-ok"/> <b>การบ้านหุ้นเด่นส่งเข้า LINE ทุกเย็น 17:00 น.</b></li>
     <li><Check size={16} className="feat-icon-ok"/> <b>ค้นหาแนวรับ-แนวต้านด่วน ไม่จำกัดตัว</b></li>
     <li><Check size={16} className="feat-icon-ok"/> <b>เสียงแจ้งเตือนสไตล์เพื่อนกัน Real-Time ทันที</b></li>
     <li><Check size={16} className="feat-icon-ok"/> โต๊ะคำนวณไม้ 2R Full Option คุมความเสี่ยง</li>
     <li><Check size={16} className="feat-icon-ok"/> ระบบเกราะคุ้มครองเงินต้น (เตือนหุ้นดอย Stage 4)</li>
     <li><Check size={16} className="feat-icon-ok"/> <b>สิทธิ์เข้ากลุ่มปิด VIP LINE Community</b></li>
     <li><Check size={16} className="feat-icon-ok"/> สิทธิ์ขอเพิ่มฟีเจอร์ก่อนใคร</li>
    </ul>
    {!account?<a href="/api/auth/line/start" className="account-primary">เข้าสู่ระบบ LINE</a>:<button className="account-primary" disabled={Boolean(busy)||!catalog?.configured} onClick={()=>go(managed?'portal':'checkout',proPlan.id)}>{busy===proPlan.id?'กำลังเปิด…':rights?.planId==='pro'?'แพ็กเกจปัจจุบัน':managed?'อัปเกรดเป็น PRO VIP':'สมัคร PRO VIP'} <ArrowUpRight size={15}/></button>}
   </article>
  </div>

  {/* ── Clear Feature Comparison Matrix Table ── */}
  <section className="comparison-section" aria-label="ตารางเปรียบเทียบฟีเจอร์อย่างละเอียด">
   <div className="comparison-heading">
    <h3>📊 ตารางเปรียบเทียบสิทธิประโยชน์อย่างละเอียด</h3>
    <p>ดูชัดๆ ว่าแต่ละระดับได้รับและไม่ได้รับฟีเจอร์อะไรบ้าง เพื่อความโปร่งใสสูงสุด</p>
   </div>
   <div className="comparison-table-wrap">
    <table className="comparison-table">
     <thead>
      <tr>
       <th>ความสามารถ / ฟีเจอร์</th>
       <th>🟢 BASIC (159 บ.)</th>
       <th>👑 PRO VIP (399 บ.)</th>
      </tr>
     </thead>
     <tbody>
      <tr>
       <td><b>จักรวาลหุ้นที่สแกนได้</b></td>
       <td className="col-basic">เฉพาะ SET100</td>
       <td className="col-vip">SET100 + mai + DR80 + หุ้นนอก</td>
      </tr>
      <tr>
       <td><b>เช็คแนวรับ-แนวต้านด่วน (Stock Doctor)</b></td>
       <td className="col-basic">จำกัด 10 ตัว / วัน</td>
       <td className="col-vip"><span className="check-yes"><Check size={14}/> ไม่จำกัดตัว</span></td>
      </tr>
      <tr>
       <td><b>การบ้านหุ้นเด่นส่งเข้า LINE Notify</b></td>
       <td className="col-basic"><span className="cross-no"><X size={14}/> ไม่ได้รับ</span></td>
       <td className="col-vip"><span className="check-yes"><Check size={14}/> ส่งทุกเย็น 17:00 น.</span></td>
      </tr>
      <tr>
       <td><b>เสียงแจ้งเตือนจุดซื้อ/เป้าขาย (Real-Time)</b></td>
       <td className="col-basic">ฟีดหน่วง 15 นาที</td>
       <td className="col-vip"><span className="check-yes"><Check size={14}/> แจ้งเตือนสดทันที</span></td>
      </tr>
      <tr>
       <td><b>โต๊ะคำนวณไม้ 2R Position Sizing</b></td>
       <td className="col-basic">คำนวณพื้นฐาน</td>
       <td className="col-vip"><span className="check-yes"><Check size={14}/> Full Option (5 ตลาด)</span></td>
      </tr>
      <tr>
       <td><b>เกราะคุ้มครองเงินต้น (เตือนหุ้นดอย Stage 4)</b></td>
       <td className="col-basic"><span className="check-yes"><Check size={14}/> ได้รับ</span></td>
       <td className="col-vip"><span className="check-yes"><Check size={14}/> ได้รับ</span></td>
      </tr>
      <tr>
       <td><b>โควตาถามคำถามน้องนักออม AI</b></td>
       <td className="col-basic">15 คำถาม / วัน</td>
       <td className="col-vip">60 คำถาม / วัน</td>
      </tr>
      <tr>
       <td><b>สิทธิ์เข้าถึงตลาด DR, หุ้นสหรัฐฯ, TFEX</b></td>
       <td className="col-basic"><span className="cross-no"><X size={14}/> ไม่ได้รับ</span></td>
       <td className="col-vip"><span className="check-yes"><Check size={14}/> ปลดล็อกครบทุกตลาด</span></td>
      </tr>
      <tr>
       <td><b>สิทธิ์เข้ากลุ่มปิด VIP LINE Community</b></td>
       <td className="col-basic"><span className="cross-no"><X size={14}/> ไม่ได้รับ</span></td>
       <td className="col-vip"><span className="check-yes"><Check size={14}/> สิทธิ์เข้ากลุ่มทันที</span></td>
      </tr>
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

