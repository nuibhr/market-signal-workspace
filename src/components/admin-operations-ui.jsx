'use client';
import { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, Check, ChevronLeft, ChevronRight, CircleAlert, KeyRound, PlusCircle, ShieldCheck, TrendingUp, X } from 'lucide-react';
import MemberAvatar from './member-avatar.jsx';
import WebullSdkStatus from './webull-sdk-status.jsx';
import { useAdminResource } from './use-admin-resource.mjs';
export const MARKET_NAMES={thai:'หุ้นไทย',dr:'DR',us:'หุ้นสหรัฐฯ',tfex:'TFEX',forex:'Forex'};
export const SIGNAL_NAMES={WAITING_FOR_ENTRY:'รอเข้าเงื่อนไข',OPEN:'เข้าแล้ว',TARGET:'ถึงเป้าหมาย',STOP:'ตัดขาดทุน',EXIT:'ปิดตามแผน',EXPIRED:'หมดเวลารอเข้า',REVIEW:'รอตรวจข้อมูล',AMBIGUOUS:'แท่งแตะทั้งเป้าและจุดตัดขาดทุน'};
const WORKER_NAMES={healthy:'ทำงานปกติ',running:'กำลังทำงาน',disabled:'ยังไม่เปิด',idle:'รอรอบตลาด','awaiting-consumer':'รอตัวประมวลผล','outside-session':'นอกเวลาสแกน',complete:'ตรวจครบ','candidate-degraded':'รอบคัดหุ้นตรวจไม่ครบหรือข้อมูลไม่พร้อม',degraded:'ข้อมูลขัดข้อง',stale:'รอบสแกนล่าช้า',offline:'ไม่ติดต่อ','not-running':'ยังไม่ทำงาน','awaiting-first-run':'รอรอบแรก'};
const AUDIT_NAMES={portfolio_submitted:'แจ้งบัญชีหุ้น',portfolio_verified:'ยืนยันบัญชีหุ้น',portfolio_rejected:'ปฏิเสธบัญชีหุ้น',partner_broker_verified_admin:'แอดมินผูกพอร์ตพาร์ทเนอร์',broker_trade_verified:'บันทึกยอดเทรดพาร์ทเนอร์',vip_extended:'ต่ออายุ VIP โดยแอดมิน',vip_extended_admin:'ต่ออายุ VIP โดยแอดมิน',vip_revoked:'ระงับสิทธิ์ VIP และเตะกลุ่ม',code_issued:'ออกโค้ด VIP',code_redeemed:'ใช้โค้ด VIP',code_revoked:'ยกเลิกโค้ด',renewal_requested:'ขอต่ออายุ',renewal_approved:'อนุมัติต่ออายุ',renewal_rejected:'ปฏิเสธต่ออายุ','admin-grant':'เพิ่มเครดิต AI','ai-question':'ใช้เครดิตถาม AI','interrupted-question-refund':'คืนเครดิตเมื่อคำถามขัดข้อง'};
export function date(value){return value&&Number.isFinite(new Date(value).valueOf())?new Date(value).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}):'—';}
export function thb(value){const n=Number(value)||0;return `฿${n.toLocaleString('en-US',{maximumFractionDigits:0})}`;}
export function price(value){return Number.isFinite(value)?value.toLocaleString('en-US',{maximumFractionDigits:6}):'—';}
export function Status({value,children}){return <span className={`admin-pill ${['ready','healthy','running','subscriber','verified','active','TARGET','approved'].includes(value)?'positive':['blocked','expired','kicked','STOP','REVIEW','AMBIGUOUS','rejected','VOLUME_BELOW_TARGET','NO_TRADING_ACTIVITY'].includes(value)?'negative':'neutral'}`}>{children||value}</span>;}
export function MemberIdentity({member}){return <div className="admin-member-identity"><span className="admin-avatar"><MemberAvatar account={{pictureUrl:member.picture_url,displayName:member.display_name}} size={42}/></span><div><strong>{member.display_name}</strong><small>{member.portfolio_last4?`${member.broker} · ••${member.portfolio_last4}`:'ยังไม่แจ้งบัญชีหุ้น'}</small></div></div>;}
export function Pager({data,onPage,loading}){if(!data)return null;const pages=Math.max(1,Math.ceil(data.total/data.pageSize));return <nav className="admin-pager" aria-label="แบ่งหน้ารายการ"><span>{data.total.toLocaleString()} รายการ · หน้า {data.page}/{pages}</span><div><button className="account-secondary" disabled={loading||data.page<=1} onClick={()=>onPage(data.page-1)} aria-label="หน้าก่อน"><ChevronLeft size={16}/></button><button className="account-secondary" disabled={loading||data.page>=pages} onClick={()=>onPage(data.page+1)} aria-label="หน้าถัดไป"><ChevronRight size={16}/></button></div></nav>;}
export function ResourceNotice({resource}){return resource.loading&&!resource.data?<div className="account-card account-skeleton"><span/><span/><span/></div>:resource.error?<div className="account-alert error" role="alert"><CircleAlert size={17}/>{resource.error==='FORBIDDEN'?'สิทธิผู้ดูแลไม่พร้อม กรุณาเข้าสู่ระบบ LINE อีกครั้ง':'อ่านข้อมูลไม่ได้ กรุณาลองใหม่'}<button className="account-secondary" onClick={resource.reload}>ลองใหม่</button></div>:null;}
function Modal({title,onClose,children,compact=false}){const dialog=useRef(null);useEffect(()=>{const element=dialog.current;if(!element.open)element.showModal();return ()=>{if(element.open)element.close();};},[]);return <dialog className={`admin-dialog account-page ${compact?'compact':''}`} ref={dialog} aria-label={title} onCancel={event=>{event.preventDefault();onClose();}}><div className="admin-dialog-head"><h2>{title}</h2><button className="account-secondary" onClick={onClose} aria-label="ปิดหน้าต่าง"><X size={18}/></button></div>{children}</dialog>;}
function eventDetail(event){if(!event.details)return '';try{const data=JSON.parse(event.details);if(data.subscriptionEndsAt)return `สิทธิถึง ${date(data.subscriptionEndsAt)}${data.reference?` · อ้างอิง ${data.reference}`:''}`;}catch{/* Older audit entries are text. */}return event.details.length>200?`${event.details.slice(0,200)}…`:event.details;}
export function AuditList({events=[]}){return events.length?<div className="admin-audit-list">{events.map(event=><article key={`${event.event_type}:${event.id}`}><span className="admin-audit-dot"/><div><strong>{AUDIT_NAMES[event.event_type]||'รายการบัญชี'}</strong><p>{event.member_name} · {event.actor_name?`โดย ${event.actor_name}`:'ระบบอัตโนมัติ'}</p>{event.amount!==null&&<small>{event.amount>0?'+':''}{event.amount} เครดิต · หลังรายการ {event.balance_after}</small>}{(event.note||event.details)&&<small>{event.note||eventDetail(event)}</small>}<time>{date(event.created_at)}</time></div></article>)}</div>:<p className="account-empty">ยังไม่มีประวัติรายการ</p>;}
export function MemberDialog({id,onClose,onReview,version,message}){
  const resource=useAdminResource(`/api/admin/members/${encodeURIComponent(id)}?v=${version}`);
  const [number,setNumber]=useState(''),[amount,setAmount]=useState('10'),[note,setNote]=useState('');
  const [brokerCode,setBrokerCode]=useState('PI'),[accountNo,setAccountNo]=useState('');
  const [volumeInput,setVolumeInput]=useState('1000'),[targetInput,setTargetInput]=useState('1000'),[tradeNote,setTradeNote]=useState('');
  const [codeGrantType,setCodeGrantType]=useState('partner_vip'),[codeDays,setCodeDays]=useState('30'),[codeMinVol,setCodeMinVol]=useState('1000'),[codeNote,setCodeNote]=useState('');
  useEffect(()=>{setNumber('');setNote('');},[version]);
  const data=resource.data,member=data?.member;
  useEffect(()=>{
    if(!member)return;
    setVolumeInput(String(member.monthlyVolumeThb??0));
    setTargetInput(String(member.volumeTargetThb??1000));
    if(member.portfolio_status==='verified'){
      setCodeGrantType('partner_vip');
      setCodeMinVol(String(member.volumeTargetThb??1000));
    }else{
      setCodeGrantType('promo_vip');
      setCodeMinVol('0');
    }
  },[member?.id,member?.portfolio_status,member?.monthlyVolumeThb,member?.volumeTargetThb]);
  const review=(body,title,detail)=>onReview({body:{...body,memberId:id},title,detail,memberName:member.display_name});
  return <Modal title="รายละเอียด & มอนิเตอร์สมาชิก" onClose={onClose}>{message&&<div className="account-alert success" role="status"><Check size={17}/>{message}</div>}<ResourceNotice resource={resource}/>{member&&<>
    <div className="admin-detail-intro"><MemberIdentity member={member}/><Status value={member.tier}>{member.tierLabel}</Status></div>
    <div className="admin-detail-grid">
      <div><span>เริ่มทดลอง</span><strong>{date(member.trial_started_at)}</strong></div>
      <div><span>ทดลองถึง</span><strong>{date(member.trial_ends_at)}</strong></div>
      <div><span>สมาชิกถึง</span><strong>{date(member.subscription_ends_at)}{member.daysRemaining!==null?` (${member.daysRemaining>0?`เหลือ ${member.daysRemaining} วัน`:'หมดแล้ว'})`:''}</strong></div>
      <div><span>ค่าคอมเดือน {member.broker_volume_month||'ปัจจุบัน'}</span><strong>{thb(member.monthlyVolumeThb)} / {thb(member.volumeTargetThb)} ({member.volumeProgressPct}%)</strong></div>
      <div><span>Telegram VIP</span><strong>{member.tg_status==='active'?`✅ Active (${member.telegram_username?`@${member.telegram_username}`:member.telegram_user_id})`:member.tg_status==='kicked'?`🚫 Kicked (${member.tg_kick_reason||'expired'})`:'ยังไม่เข้ากลุ่ม'}</strong></div>
      <div><span>สถานะระงับ VIP</span><strong>{member.vip_revoked_reason?`${member.vip_revoked_reason} (${date(member.vip_revoked_at)})`:'ปกติ'}</strong></div>
    </div>

    <section className="admin-detail-section">
      <h3>บัญชีหุ้นพาร์ทเนอร์ &amp; เกณฑ์ค่าคอม {thb(member.volumeTargetThb)}/เดือน</h3>
      <p>{member.portfolio_status==='verified'?`ยืนยันแล้ว (${member.broker || 'Partner'} ·••${member.portfolio_last4 || '0000'}) · เทรดล่าสุด ${date(member.broker_last_trade_at)}`:member.portfolio_status==='pending'?'รอตรวจสอบ':'ยังไม่ได้ผูกพอร์ตพาร์ทเนอร์'}</p>
      {member.portfolio_status==='pending'&&<>
        <form className="admin-inline-form" onSubmit={event=>{event.preventDefault();review({action:'verify',number},'ยืนยันบัญชีหุ้น','เลขเต็มต้องตรงกับหลักฐานที่ตรวจสอบ');}}>
          <label>เลขพอร์ตเต็มจากหลักฐาน<input value={number} onChange={event=>setNumber(event.target.value)} autoComplete="off" required minLength={5} maxLength={30} placeholder="ใช้เทียบกับเลขที่ลูกค้าแจ้ง"/></label>
          <button className="account-primary" disabled={resource.loading}>ตรวจเลขพอร์ต</button>
        </form>
        <button className="account-secondary" disabled={resource.loading} onClick={()=>review({action:'reject-portfolio'},'ปฏิเสธบัญชีหุ้น','ลูกค้าจะแจ้งเลขพอร์ตใหม่ได้ ระยะทดลองเดิมยังนับต่อ')}>เลขพอร์ตไม่ผ่าน</button>
      </>}
      {member.portfolio_status!=='verified'&&member.portfolio_status!=='pending'&&(
        <form className="admin-credit-form" onSubmit={event=>{event.preventDefault();review({action:'link-partner-broker',broker:brokerCode,accountNo,targetThb:Number(targetInput)||1000,monthlyVolumeThb:Number(volumeInput)||0,note:tradeNote},'ผูก & ยืนยันพอร์ตพาร์ทเนอร์',`ผูกพอร์ต ${brokerCode} (${accountNo}) พร้อมเป้าหมายค่าคอม ${thb(targetInput)}/เดือน`);}}>
          <label>โบรกเกอร์พาร์ทเนอร์<select value={brokerCode} onChange={e=>setBrokerCode(e.target.value)}><option value="PI">บล.พาย (Pi · 003)</option><option value="TRINITY">บล.ทรีนีตี้ (022)</option><option value="ASL">บล.เอเอสแอล (050)</option><option value="OTHER">พาร์ทเนอร์อื่น</option></select></label>
          <label>เลขพอร์ตพาร์ทเนอร์<input required minLength={5} maxLength={30} value={accountNo} onChange={e=>setAccountNo(e.target.value)} placeholder="กรอกเลขพอร์ตจากโบรกเกอร์"/></label>
          <label>ค่าคอมเริ่มต้นเดือนนี้ (บาท)<input type="number" min="0" value={volumeInput} onChange={e=>setVolumeInput(e.target.value)}/></label>
          <button className="account-primary" disabled={resource.loading}><ShieldCheck size={16}/>ผูกและยืนยันพอร์ตทันที</button>
        </form>
      )}
      {member.portfolio_status==='verified'&&(
        <>
          <form className="admin-credit-form" style={{marginTop:'10px'}} onSubmit={event=>{event.preventDefault();review({action:'record-broker-trade',monthlyVolumeThb:Number(volumeInput)||0,targetThb:Number(targetInput)||1000,note:tradeNote},'บันทึกค่าคอมประจำเดือน',`อัปเดตค่าคอม ${thb(volumeInput)} / เป้าหมาย ${thb(targetInput)} บาท/เดือน`);}}>
            <label>ค่าคอมเดือนนี้ (บาท)<input type="number" min="0" step="100" required value={volumeInput} onChange={e=>setVolumeInput(e.target.value)}/></label>
            <label>เป้าหมายขั้นต่ำ (บาท/เดือน)<input type="number" min="0" step="100" required value={targetInput} onChange={e=>setTargetInput(e.target.value)}/></label>
            <label>หมายเหตุ<input maxLength={180} value={tradeNote} onChange={e=>setTradeNote(e.target.value)} placeholder="เช่น ยอดค่าคอม Pi เดือนนี้"/></label>
            <button className="account-primary" disabled={resource.loading}><TrendingUp size={16}/>บันทึกค่าคอม (บาท)</button>
          </form>
          <div className="admin-row-actions" style={{marginTop:'10px'}}>
            <button className="account-secondary" disabled={resource.loading} onClick={()=>review({action:'extend-vip',days:30,reason:'PARTNER_VOLUME_QUALIFIED',note:'ต่อโปร +30 วันโดยแอดมิน'},'ต่ออายุ VIP +30 วัน','เพิ่มสิทธิ์ PRO VIP 30 วันและปลดสถานะระงับ (ถ้ามี)')}><PlusCircle size={15}/>ต่ออายุ VIP +30 วัน</button>
            {member.tier==='subscriber'&&<button className="account-secondary" style={{color:'#fb7185'}} disabled={resource.loading} onClick={()=>review({action:'revoke-vip',reason:member.volumeQualified?'NO_TRADING_ACTIVITY':'VOLUME_BELOW_TARGET'},'ระงับ VIP & เตะ Telegram','ปิดสิทธิ์บนเว็บและเตะออกจากกลุ่ม Telegram VIP ทันที')}>🚫 ระงับ VIP + เตะกลุ่ม</button>}
          </div>
        </>
      )}
    </section>

    <section className="admin-detail-section">
      <h3>ออกโค้ดต่อโปร / โค้ด VIP (1-Time Code)</h3>
      <p>เลือกได้ทั้งโค้ดพอร์ตพาร์ทเนอร์ (เกณฑ์ค่าคอม ≥ ฿1,000/ด.) หรือโค้ดโปรพิเศษ (Promo VIP ไม่ต้องรอผูกพอร์ต)</p>
      <form className="admin-credit-form" onSubmit={event=>{event.preventDefault();const allowUnverified=codeGrantType==='promo_vip';review({action:'issue-code',grantType:codeGrantType,durationDays:Number(codeDays)||30,minVolumeThb:Number(codeMinVol)||0,note:codeNote,allowUnverified},'ออกโค้ด VIP ใหม่',`ประเภท ${codeGrantType==='promo_vip'?'Promo VIP':'Partner VIP ≥฿1,000'} · อายุสิทธิ์ ${codeDays} วัน · เกณฑ์ค่าคอม ${thb(codeMinVol)}/เดือน`);}}>
        <label>ประเภทโค้ด<select value={codeGrantType} onChange={e=>{const val=e.target.value;setCodeGrantType(val);if(val==='promo_vip')setCodeMinVol('0');else setCodeMinVol(String(member.volumeTargetThb||1000));}}><option value="partner_vip" disabled={member.portfolio_status!=='verified'}>Partner VIP (ต้องยืนยันพอร์ต)</option><option value="promo_vip">Promo VIP (ต่อโปรพิเศษได้เลย)</option></select></label>
        <label>จำนวนวัน VIP<select value={codeDays} onChange={e=>setCodeDays(e.target.value)}><option value="7">7 วัน (ทดลองพิเศษ)</option><option value="14">14 วัน</option><option value="30">30 วัน (1 เดือน)</option><option value="90">90 วัน (3 เดือน)</option></select></label>
        <label>เกณฑ์ค่าคอมขั้นต่ำ (บาท/เดือน)<input type="number" min="0" step="100" value={codeMinVol} onChange={e=>setCodeMinVol(e.target.value)}/></label>
        <label>หมายเหตุโค้ด<input maxLength={160} value={codeNote} onChange={e=>setCodeNote(e.target.value)} placeholder="เช่น ต่อโปรลูกค้า VIP เดือน พ.ย."/></label>
        <button className="account-primary" disabled={resource.loading}><KeyRound size={16}/>ออกโค้ด NUG-...</button>
      </form>
    </section>

    <section className="admin-detail-section"><h3>เครดิตน้องนักออม AI</h3><p>คงเหลือ {data.quota.credits} เครดิต · คำถามฟรีวันนี้ใช้ไป {member.aiUsedToday ?? data.quota.freeUsed}/{member.aiDailyLimit ?? data.quota.freeLimit} (เหลือ {data.quota.freeRemaining})</p><form className="admin-credit-form" onSubmit={event=>{event.preventDefault();review({action:'grant-ai-credits',amount:Number(amount),note},'เพิ่มเครดิต AI',`เพิ่ม ${amount} เครดิตให้สมาชิกคนนี้`);}}><label>จำนวนเครดิต<input type="number" min="1" max="1000" required value={amount} onChange={event=>setAmount(event.target.value)}/></label><label>หมายเหตุ / อ้างอิงรายการ<input maxLength={200} value={note} onChange={event=>setNote(event.target.value)} placeholder="ระบุเพื่อค้นประวัติภายหลัง"/></label><button className="account-secondary" disabled={resource.loading}>ตรวจรายการเพิ่มเครดิต</button></form></section>
    <section className="admin-detail-section"><h3>โค้ดรายเดือนล่าสุด</h3>{data.codes.length?data.codes.map(code=><div key={code.id} className="admin-code-row"><div><Status value={code.status}>{({available:'ยังใช้ได้',redeemed:'ใช้แล้ว',revoked:'ยกเลิกแล้ว',expired:'หมดอายุ'})[code.status]}</Status><small>อ้างอิง {code.id.slice(0,8)} · {code.grant_type==='promo_vip'?'Promo VIP':'Partner ≥฿1,000'} · {code.duration_days||30} วัน{Number(code.min_volume_thb)>0?` · เกณฑ์ ${thb(code.min_volume_thb)}/ด.`:''} · ออก {date(code.created_at)}{code.note?` · ${code.note}`:''}</small></div>{code.status==='available'&&<button className="account-secondary" disabled={resource.loading} onClick={()=>review({action:'revoke-code',codeId:code.id},'ยกเลิกโค้ดรายเดือน','โค้ดนี้จะใช้ต่ออายุไม่ได้ โดยไม่กระทบสิทธิสมาชิกปัจจุบัน')}>ยกเลิกโค้ด</button>}</div>):<p className="account-empty">ยังไม่เคยออกโค้ด</p>}</section>
    <section className="admin-detail-section"><h3>การใช้งานที่บันทึก</h3><div className="admin-detail-grid"><div><span>หุ้นโปรด</span><strong>{data.workspace.favorites} ตัว</strong></div><div><span>รายการพอร์ต</span><strong>{data.workspace.holdings} ตัว</strong></div><div><span>การเข้าสู่ระบบที่ยังมีอายุ</span><strong>{data.workspace.sessions}</strong></div><div><span>สมัครครั้งแรก</span><strong>{date(member.created_at)}</strong></div></div></section>
    <section className="admin-detail-section"><h3>ประวัติล่าสุด</h3><AuditList events={data.audit.events}/><small>แสดง {data.audit.events.length} จาก {data.audit.total} รายการ</small></section>
  </>}</Modal>;
}

export function VipMonitorPanel({
  data,
  loading,
  filter,
  onFilter,
  query,
  setQuery,
  onSearch,
  onPage,
  onSelectMember,
  onReview,
  onRunVolumeSweep,
  sweepResult,
  sweepBusy,
}) {
  const [minVolumeThb, setMinVolumeThb] = useState(1000);
  const [graceDays, setGraceDays] = useState(7);
  const [inactivityDays, setInactivityDays] = useState(30);
  const summary = data?.summary;
  const membersList = data?.members || [];

  const filterChips = [
    ['all', `ทั้งหมด (${summary?.total ?? 0})`],
    ['partner_vip', `พอร์ตพาร์ทเนอร์ (${summary?.partnerVipCount ?? 0})`],
    ['volume_pass', `ค่าคอมผ่าน ≥฿1,000 (${summary?.volumePassedCount ?? 0})`],
    ['volume_risk', `เสี่ยงไม่ถึง ฿1,000 (${summary?.volumeRiskCount ?? 0})`],
    ['expiring_7d', `ใกล้หมด ≤7วัน (${summary?.expiring7dCount ?? 0})`],
    ['stripe_pro', `Stripe PRO (${summary?.stripeProCount ?? 0})`],
    ['stripe_starter', `Stripe BASIC (${summary?.stripeStarterCount ?? 0})`],
    ['telegram_active', `ผูก TG VIP (${summary?.telegramActiveCount ?? 0})`],
    ['revoked', `ถูกระงับ (${summary?.revokedCount ?? 0})`],
  ];

  return (
    <>
      {summary && (
        <div className="admin-stat-grid compact" style={{ marginBottom: '16px' }}>
          <article>
            <span>Stripe Revenue (Est. MRR)</span>
            <strong style={{ color: '#38bdf8' }}>{thb(summary.estimatedMrrThb)}/ด.</strong>
            <small>PRO {summary.stripeProCount ?? 0} · BASIC {summary.stripeStarterCount ?? 0}</small>
          </article>
          <article>
            <span>Partner VIP ({summary.currentMonth || 'เดือนนี้'})</span>
            <strong style={{ color: '#34d399' }}>{summary.partnerVipCount ?? 0} ราย</strong>
            <small>ค่าคอม ≥฿1,000: {summary.volumePassedCount ?? 0} · เสี่ยง: {summary.volumeRiskCount ?? 0}</small>
          </article>
          <article>
            <span>ใกล้หมดอายุ (≤ 7 วัน)</span>
            <strong style={{ color: (summary.expiring7dCount ?? 0) > 0 ? '#fbbf24' : '#94a3b8' }}>{summary.expiring7dCount ?? 0} ราย</strong>
            <small>เตรียมส่งโค้ดต่อโปร</small>
          </article>
          <article>
            <span>Telegram VIP Active</span>
            <strong style={{ color: '#c084fc' }}>{summary.telegramActiveCount ?? 0} ราย</strong>
            <small>Auto-Kick เชื่อม Join-Request</small>
          </article>
          <article>
            <span>โค้ดต่อโปรพร้อมใช้</span>
            <strong>{summary.availableCodesCount ?? 0} โค้ด</strong>
            <small>ยังไม่ถูกใช้งาน/ยกเลิก</small>
          </article>
          <article>
            <span>AI ถามฟรีวันนี้รวม</span>
            <strong>{summary.aiUsedTodayTotal ?? 0} ครั้ง</strong>
            <small>ใช้งานระบบ AI วันนี้</small>
          </article>
        </div>
      )}

      {/* Sweep Policy & ฿1,000 Commission Enforcement */}
      <div style={{ padding: '14px 16px', borderRadius: '14px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.28)', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#fbbf24' }}>
              <AlertTriangle size={16} /> ตรวจเกณฑ์ค่าคอมพอร์ตพาร์ทเนอร์ (≥ {thb(minVolumeThb)}/คน/เดือน) &amp; Auto-Kick Telegram VIP
            </strong>
            <small style={{ color: '#cbd5e1', display: 'block', marginTop: '2px' }}>
              สแกนเฉพาะสมาชิกพอร์ตพาร์ทเนอร์ / โค้ดฟรี (ยกเว้น Admin และลูกค้าจ่ายเงิน Stripe ที่ยังไม่หมดอายุ)
            </small>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              ค่าคอมขั้นต่ำ (฿):
              <input type="number" min={0} step={100} value={minVolumeThb} onChange={e => setMinVolumeThb(Number(e.target.value) || 0)} style={{ width: '90px', padding: '4px 8px', borderRadius: '8px' }} />
            </label>
            <label style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              ยกเว้นพอร์ตใหม่ (วัน):
              <input type="number" min={0} max={90} value={graceDays} onChange={e => setGraceDays(Number(e.target.value) || 0)} style={{ width: '60px', padding: '4px 8px', borderRadius: '8px' }} />
            </label>
            <label style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              ไม่เทรดเกิน (วัน):
              <input type="number" min={1} max={365} value={inactivityDays} onChange={e => setInactivityDays(Number(e.target.value) || 30)} style={{ width: '60px', padding: '4px 8px', borderRadius: '8px' }} />
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="account-secondary"
            disabled={sweepBusy}
            onClick={() => onRunVolumeSweep({ requireMinVolume: true, minMonthlyVolumeThb: minVolumeThb, graceDays, inactivityDays, dryRun: true })}
          >
            {sweepBusy ? 'กำลังสแกน…' : `🔍 ทดสอบสแกนหาผู้ค่าคอม < ${thb(minVolumeThb)} (Dry-Run)`}
          </button>
          <button
            type="button"
            className="account-primary"
            style={{ background: 'linear-gradient(135deg, #b45309, #dc2626)' }}
            disabled={sweepBusy}
            onClick={() => {
              if (confirm(`ยืนยันระงับ VIP บนเว็บ และเตะออกจาก Telegram สำหรับพอร์ตที่ค่าคอมต่ำกว่า ${thb(minVolumeThb)}/คน/เดือน หรือไม่เทรดเกิน ${inactivityDays} วัน?`)) {
                onRunVolumeSweep({ requireMinVolume: true, minMonthlyVolumeThb: minVolumeThb, graceDays, inactivityDays, dryRun: false });
              }
            }}
          >
            🚫 บังคับระงับสิทธิ์ &amp; เตะกลุ่มผู้ไม่ถึงเกณฑ์ทันที
          </button>
        </div>
        {sweepResult && (
          <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.55)', fontSize: '12px' }}>
            <strong>
              {sweepResult.dryRun
                ? `ผลทดสอบสแกน (${sweepResult.volumeMonth || ''}): พบไม่ผ่านเกณฑ์ ${sweepResult.matchedCount} ราย (ยังไม่ดำเนินการจริง)`
                : `ดำเนินการแล้ว: พบ ${sweepResult.matchedCount} ราย · ระงับบนเว็บ ${sweepResult.revokedCount} ราย · เตะ Telegram ${sweepResult.kickedCount} ราย`}
            </strong>
            {Array.isArray(sweepResult.candidates) && sweepResult.candidates.length > 0 && (
              <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {sweepResult.candidates.slice(0, 8).map(c => (
                  <div key={c.memberId} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', color: '#e2e8f0' }}>
                    <span>• {c.displayName} ({c.broker || 'No Broker'}) — <b>{c.reason === 'VOLUME_BELOW_TARGET' ? 'ค่าคอมไม่ถึงเป้า' : 'ไม่มีเทรด >30ด.'}</b></span>
                    <span>ค่าคอม {thb(c.monthlyVolumeThb)} / {thb(c.targetThb)} (ขาด {thb(c.deficitThb)}) {c.telegramUserId ? `· TG #${c.telegramUserId}` : '· ไม่มี TG'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Pills + Search */}
      <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <form className="admin-search" onSubmit={event => { event.preventDefault(); onSearch(); }}>
          <input aria-label="ค้นหาสมาชิก VIP" value={query} maxLength={80} onChange={e => setQuery(e.target.value)} placeholder="ค้นหาชื่อ, โบรกเกอร์, เลขพอร์ตท้าย, @Telegram" />
          <button className="account-secondary">ค้นหา</button>
        </form>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {filterChips.map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => onFilter(val)}
              style={{
                padding: '6px 12px',
                borderRadius: '999px',
                border: '1px solid rgba(148,163,184,0.25)',
                background: filter === val ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255,255,255,0.03)',
                color: filter === val ? '#38bdf8' : '#cbd5e1',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Member Monitor Cards */}
      <div className="admin-member-list">
        {membersList.map(member => (
          <article key={member.id} style={{ alignItems: 'center' }}>
            <MemberIdentity member={member} />
            <div className="admin-member-meta" style={{ flex: '1 1 280px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Status value={member.tier}>{member.tierLabel}</Status>
                <Status value={member.tg_status || 'neutral'}>
                  {member.tg_status === 'active' ? `TG ${member.telegram_username ? `@${member.telegram_username}` : 'Active'}` : member.tg_status === 'kicked' ? 'TG Kicked' : 'ยังไม่ผูก TG'}
                </Status>
                {member.daysRemaining !== null && (
                  <small style={{ color: member.daysRemaining <= 7 ? '#fbbf24' : '#94a3b8', fontWeight: 700 }}>
                    {member.daysRemaining > 0 ? `เหลือ ${member.daysRemaining} วัน` : 'หมดอายุแล้ว'}
                  </small>
                )}
              </div>
              {/* ฿1,000 Commission Bar */}
              <div style={{ marginTop: '6px', width: '100%', maxWidth: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                  <span>ค่าคอมเดือนนี้: <strong>{thb(member.monthlyVolumeThb)}</strong> / {thb(member.volumeTargetThb)}</span>
                  <span style={{ color: member.volumeQualified ? '#34d399' : '#fbbf24', fontWeight: 700 }}>{member.volumeProgressPct}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', borderRadius: '999px', background: 'rgba(148,163,184,0.2)', overflow: 'hidden' }}>
                  <div style={{ width: `${member.volumeProgressPct}%`, height: '100%', background: member.volumeQualified ? '#10b981' : '#f59e0b' }} />
                </div>
              </div>
              <small>AI วันนี้ {member.aiUsedToday ?? 0}/{member.aiDailyLimit ?? 3} · เครดิต {member.ai_credits}{member.vip_revoked_reason ? ` · ⚠️ ${member.vip_revoked_reason}` : ''}</small>
            </div>
            <div className="admin-row-actions">
              <button
                type="button"
                className="account-primary"
                disabled={loading}
                onClick={() => onReview({
                  body: {
                    action: 'issue-code',
                    memberId: member.id,
                    grantType: member.portfolio_status === 'verified' ? 'partner_vip' : 'promo_vip',
                    durationDays: 30,
                    minVolumeThb: member.portfolio_status === 'verified' ? 1000 : 0,
                    allowUnverified: member.portfolio_status !== 'verified',
                    note: 'ต่อโปร 30 วันจาก Admin Monitor',
                  },
                  title: member.portfolio_status === 'verified' ? 'ออกโค้ดพอร์ต (ค่าคอม ≥ ฿1,000/ด.)' : 'ออกโค้ดโปร VIP (30 วัน)',
                  detail: 'ออกโค้ด NUG-... ใช้ได้ 1 ครั้งสำหรับส่งให้ลูกค้ารายนี้',
                  memberName: member.display_name,
                })}
              >
                <KeyRound size={14} /> ออกโค้ดโปร
              </button>
              <button
                type="button"
                className="account-secondary"
                disabled={loading}
                onClick={() => onReview({
                  body: { action: 'extend-vip', memberId: member.id, days: 30, reason: 'PARTNER_VOLUME_QUALIFIED', note: 'ต่ออายุ +30 วันจาก Admin Monitor' },
                  title: 'ต่ออายุ VIP +30 วัน',
                  detail: 'เพิ่มสิทธิ PRO VIP 30 วันทันที (พร้อมปลดระงับหากถูกพักอยู่)',
                  memberName: member.display_name,
                })}
              >
                +30 วัน
              </button>
              <button type="button" className="account-secondary" disabled={loading} onClick={() => onSelectMember(member.id)}>
                จัดการ / กรอกค่าคอม
              </button>
            </div>
          </article>
        ))}
      </div>
      {!membersList.length && <p className="account-empty">ไม่พบสมาชิกในตัวกรองนี้</p>}
      <Pager data={data} onPage={onPage} loading={loading} />
    </>
  );
}
export function ReviewDialog({draft,busy,error,onClose,onConfirm}){const [payment,setPayment]=useState(false),[reference,setReference]=useState('');return <Modal title={draft.title} onClose={()=>{if(!busy)onClose();}} compact><form className="admin-review-form" onSubmit={event=>{event.preventDefault();onConfirm({...draft.body,...(draft.body.action==='approve-renewal'?{paymentConfirmed:payment,reference}:{})});}}><strong>{draft.memberName}</strong><p>{draft.detail}</p>{draft.body.action==='approve-renewal'&&<><label>อ้างอิงยอดรับชำระ<input maxLength={160} value={reference} onChange={event=>setReference(event.target.value)} placeholder="เลขรายการหรือหมายเหตุ"/></label><label className="admin-checkbox"><input type="checkbox" checked={payment} onChange={event=>setPayment(event.target.checked)} required/>ตรวจสอบว่าได้รับชำระแล้ว</label></>}{error&&<div className="account-alert error" role="alert">{error}</div>}<div className="admin-review-actions"><button type="button" className="account-secondary" disabled={busy} onClick={onClose}>กลับไปแก้ไข</button><button className="account-primary" disabled={busy}>{busy?'กำลังบันทึก…':'ยืนยันรายการ'}<Check size={16}/></button></div></form></Modal>;}
export function LaunchPanel({launch}){return <section className="admin-launch"><div><ShieldCheck size={22}/><div><h3>{launch?.ready?'ผ่านรายการตรวจการตั้งค่าแล้ว':'ความพร้อมก่อนเปิดรับลูกค้า'}</h3><p>{launch?.ready?'ยังต้องตรวจข้อมูลที่ย้ายขึ้นคลาวด์ สิทธิใช้งานจริง LINE และเสียงบนอุปกรณ์ก่อนเปิดลูกค้า':'ตรวจรายการที่ยังไม่พร้อมด้านล่างก่อนเปิดรับลูกค้า'}</p></div></div><div className="admin-launch-checks">{launch?.checks?.map(check=><article key={check.id}><Status value={check.status}>{check.status==='ready'?'พร้อม':check.status==='configured'?'ตั้งค่าแล้ว':'ยังไม่พร้อม'}</Status><div><strong>{check.label}</strong><small>{check.detail}</small></div></article>)}</div></section>;}
export function SystemPanel({system}){return <>
  <LaunchPanel launch={system.launch}/><div className="admin-worker"><Activity size={18}/><span>ตัวทำงานสแกน</span><strong className={system.workerProcess?.status==='running'?'ok':'bad'}>{WORKER_NAMES[system.workerProcess?.status]||'ไม่ทราบสถานะ'}</strong><small>ติดต่อ {date(system.workerProcess?.lastSeenAt)}</small></div>
  {system.workerProcess?.runtime==='cloudflare'&&<div className="admin-detail-grid"><div><span>Cron · ทุก 5 นาที</span><strong>{WORKER_NAMES[system.workerProcess.scheduler.status]||'ไม่ทราบสถานะ'}</strong><small>{date(system.workerProcess.scheduler.lastSeenAt)}</small></div><div><span>ตัวประมวลผลสำเร็จล่าสุด</span><strong>{WORKER_NAMES[system.workerProcess.consumer.status]||'ไม่ทราบสถานะ'}</strong><small>{date(system.workerProcess.consumer.lastSeenAt)}</small></div><div><span>งานรอ / ลองซ้ำ / กำลังทำ</span><strong>{system.workerProcess.queue.pending} / {system.workerProcess.queue.retry} / {system.workerProcess.queue.running}</strong></div><div><span>งานที่พักเพราะทำไม่สำเร็จ</span><strong>{system.workerProcess.queue.failed}</strong><small>ต้องตรวจสาเหตุก่อนเริ่มรอบใหม่</small></div></div>}
  <div className="admin-market-grid">{system.markets.map(market=>{const coverage=system.coverage[market.id],worker=system.workers[market.id];return <article className="admin-market-card" key={market.id}><div><strong>{MARKET_NAMES[market.id]}</strong><Status value={market.status==='active'?'ready':'blocked'}>{market.status==='active'?'เปิดสแกน':'ยังไม่เปิดสแกน'}</Status></div><p>{market.reason||market.mode}</p>{worker&&<small>{WORKER_NAMES[worker.status]||'ต้องตรวจสถานะ'} · ล่าสุด {date(worker.lastRunAt)}</small>}{coverage&&<><div className="admin-progress"><span style={{width:`${Math.min(100,(coverage.done+coverage.ineligible+coverage.unavailable+(coverage.missed||0))/Math.max(1,coverage.expected)*100)}%`}}/></div><p>ปิดสถานะ {coverage.done+coverage.ineligible+coverage.unavailable+(coverage.missed||0)}/{coverage.expected} ตัว</p><small>ประเมินได้ {coverage.done} · ไม่เหมาะรอบนี้ {coverage.ineligible} · ข้อมูลใช้ไม่ได้ {coverage.unavailable} · พลาดรอบ {coverage.missed||0} · ยังไม่เคยลอง {coverage.neverChecked||0} · รอลองใหม่ {coverage.retry}</small>{coverage.remaining>0&&<small>ยังค้าง {coverage.remaining} ตัว</small>}{(coverage.unavailableSymbols?.length>0||coverage.retrySymbols?.length>0||coverage.missedSymbols?.length>0)&&<details><summary>ดูรายการที่ต้องตรวจ</summary>{[...(coverage.unavailableSymbols||[]),...(coverage.retrySymbols||[]),...(coverage.missedSymbols||[])].map(item=><p key={item.symbol}>{item.symbol} · {item.reason||'แหล่งข้อมูลยังไม่พร้อม'}</p>)}</details>}</>}</article>;})}</div>
  <h3>รอบสแกนล่าสุด</h3><div className="admin-runs">{system.runs.map(run=><div key={run.id}><strong>{MARKET_NAMES[run.market]}</strong><span>{run.errorCode?'ข้อมูลบางส่วนขัดข้อง':run.status==='COMPLETE'?'จบรอบ':'กำลังตรวจ'} · ตรวจ {run.scanned} · พบแผน {run.candidates}</span><small>{date(run.finishedAt||run.startedAt)}</small></div>)}</div><details className="admin-detail-section"><summary>การเชื่อมต่อ Webull</summary><WebullSdkStatus data={system.webull}/></details>
</>;}
export function SignalsPanel({data,onPage,loading}){return <><div className="admin-stat-grid compact"><article><span>เข้าแล้วทั้งหมด</span><strong>{data.summary.entered}</strong></article><article><span>ปิดและมีราคาเข้า–ออก</span><strong>{data.summary.closed}/100</strong></article><article><span>ชนะ / แพ้</span><strong>{data.summary.wins} / {data.summary.losses}</strong></article><article><span>อัตราชนะจากไม้ที่ปิด</span><strong>{data.summary.winRate===null?'—':`${data.summary.winRate.toFixed(1)}%`}</strong></article></div><p className="admin-explainer">คำนวณจากสัญญาณที่เข้าและปิดจริงในบันทึกล่าสุดไม่เกิน 100 ไม้ ราคาอ้างอิงจากแท่ง ไม่ใช่ผลซื้อขายในพอร์ตลูกค้า ตัวรอเข้า/หมดเวลารอไม่ถูกนับเป็นแพ้</p><div className="admin-signal-list">{data.signals.map(signal=><article key={signal.id}><header><div><strong>{signal.symbol}</strong><small>{MARKET_NAMES[signal.market]}</small></div><Status value={signal.status}>{SIGNAL_NAMES[signal.status]||signal.status}</Status></header><div className="admin-signal-prices"><div><span>{signal.enteredAt?'ราคาเข้าในบันทึก':'จุดเข้าตามแผน'}</span><strong>{price(signal.entryPrice??signal.plannedEntry)}</strong></div><div><span>ราคาออกในบันทึก</span><strong>{price(signal.exitPrice)}</strong></div><div><span>เป้าหมาย</span><strong>{price(signal.target)}</strong></div><div><span>ตัดขาดทุน</span><strong>{price(signal.stopLoss)}</strong></div></div><details><summary>ลำดับเหตุการณ์ · เผยแพร่ {date(signal.publishedAt)}</summary>{signal.events.map((event,index)=><p key={`${event.type}:${index}`}><strong>{({PICK_READY:'พบแผน',ENTRY:'เข้าเงื่อนไข',TARGET:'ถึงเป้าหมาย',STOP:'ตัดขาดทุน',EXIT:'ปิดตามแผน',EXPIRED:'หมดเวลารอเข้า',DATA_GAP:'ข้อมูลขาดช่วง',AMBIGUOUS:'ไม่ทราบลำดับการแตะราคา'})[event.type]||'เหตุการณ์สัญญาณ'}</strong> · {price(event.price)} · {date(event.createdAt)}<small>{event.detail}</small></p>)}</details></article>)}</div>{!data.signals.length&&<p className="account-empty">ยังไม่มีสัญญาณในตัวกรองนี้</p>}<Pager data={data} onPage={onPage} loading={loading}/></>;}
