'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, BadgeCheck, BarChart3, CalendarClock, Check, CircleAlert, Clock3, Fingerprint, LayoutDashboard, LockKeyhole, LogOut, ShieldCheck, Sparkles, UserRound, Users } from 'lucide-react';
import BillingPanel from './billing-panel.jsx';
import MemberAvatar from './member-avatar.jsx';
import { AiCreditsPanel } from './ai-credits-panel.jsx';

const NAV = [['overview', 'ภาพรวม', LayoutDashboard], ['ai-credits', 'โควตา AI / เครดิต', Sparkles], ['renewal', 'แพ็กเกจ / ต่ออายุ', CalendarClock], ['profile', 'โปรไฟล์', UserRound]];
const DEMO_LABELS={onboarding:'สมาชิกใหม่',trial:'ทดลองใช้ฟรี',starter:'Starter',pro:'Pro',ultimate:'Ultimate',expired:'หมดอายุ'};
const MESSAGES = {
  TRIAL_ENROLLMENT_CLOSED:'ยังไม่เปิดรับสิทธิทดลองใหม่ กรุณาตรวจอีกครั้งเมื่อเปิดบริการ',
  TRIAL_ALREADY_USED:'บัญชีนี้เริ่มทดลองไปแล้ว ไม่สามารถเริ่มระยะใหม่ได้',
  TRIAL_NOT_AVAILABLE:'บัญชีนี้ไม่เข้าเงื่อนไขเริ่มทดลองใหม่',
  INVALID_PORTFOLIO: 'เลขพอร์ตต้องมีอักษรหรือตัวเลข 5–24 ตัว', INVALID_BROKER: 'กรุณาระบุชื่อโบรกเกอร์',
  PORTFOLIO_ALREADY_USED: 'เลขพอร์ตนี้ถูกผูกกับบัญชีอื่นแล้ว', PORTFOLIO_CHANGE_REQUIRES_ADMIN: 'เปลี่ยนเลขพอร์ตที่แจ้งแล้วต้องให้แอดมินดำเนินการ',
  PORTFOLIO_NOT_VERIFIED: 'แอดมินยังไม่ยืนยันบัญชีหุ้นนี้', PORTFOLIO_MISMATCH: 'เลขพอร์ตไม่ตรงกับที่สมาชิกแจ้ง',
  CODE_UNAVAILABLE: 'โค้ดไม่ถูกต้อง หมดอายุ หรือถูกใช้แล้ว', INVALID_CODE: 'รูปแบบโค้ดไม่ถูกต้อง',
  REQUEST_UNAVAILABLE: 'รายการนี้ถูกจัดการไปแล้ว กรุณารีเฟรชข้อมูล',
  INVALID_CREDIT_AMOUNT: 'จำนวนเครดิตต้องเป็นจำนวนเต็ม 1–1,000',
  LOGIN_REQUIRED: 'กรุณาเข้าสู่ระบบ LINE อีกครั้ง', FORBIDDEN: 'บัญชีนี้ไม่มีสิทธิแอดมิน',
  DEMO_READ_ONLY:'โหมด Demo ใช้ดูสิทธิสมาชิก กรุณาเข้าสู่ระบบ LINE เพื่อจัดการบัญชีจริง',
};
function date(value) { return value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }) : '—'; }
function daysLeft(value) { return value ? Math.max(0, Math.ceil((Date.parse(value) - Date.now()) / 86_400_000)) : 0; }
function notice(error) { return MESSAGES[error] || 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่'; }

export default function AccountPage({initialData=null}) {
  const [section, setSection] = useState('overview');
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const refresh = useCallback(async () => {
    const response = await fetch('/api/account', { cache: 'no-store' });
    const payload = await response.json();
    setData(payload);
    setLoading(false);
    return payload;
  }, []);
  useEffect(() => { refresh().catch(() => { setError('โหลดข้อมูลบัญชีไม่ได้'); setLoading(false); }); }, [refresh]);
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('auth');
    if (status === 'cancelled') setError('ยกเลิกการเข้าสู่ระบบ LINE แล้ว');
    if (status === 'failed') setError('เข้าสู่ระบบ LINE ไม่สำเร็จ กรุณาลองใหม่');
    if (status === 'ok' && data?.account) setMessage('เข้าสู่ระบบ LINE สำเร็จ');
  }, [data?.account?.id]);
  async function action(path, body, success) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) { setError(notice(payload.error)); return; }
      setData(payload);
      setMessage(success);
      if (body.action === 'redeem') setCode('');
    } catch { setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try {
      const response=await fetch(data?.account?.demo?'/api/auth/demo':'/api/auth/logout', { method:data?.account?.demo?'DELETE':'POST' });
      if(!response.ok)throw Error('LOGOUT_FAILED');
      window.location.href = '/account';
    } catch { setError('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่'); setBusy(false); }
  }
  const account = data?.account;
  async function changeDemo(role){
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/auth/demo',{method:role?'POST':'DELETE',headers:{'Content-Type':'application/json'},...(role?{body:JSON.stringify({role})}:{})});
      if(!response.ok)throw Error('DEMO_UNAVAILABLE');
      window.location.assign('/account');
    }catch{setError('เปิด Demo ไม่สำเร็จ กรุณาลองใหม่');setBusy(false);}
  }
  const rights = data?.rights;
  const trial = data?.trialEnrollment;
  const active = rights?.tier === 'trial' || rights?.tier === 'subscriber';
  const scanCap=rights?.tier==='trial'?8:rights?.tier==='subscriber'?({starter:3,pro:5,ultimate:8}[rights.planId]??(!rights.planId&&rights.limits?.dailyScanSymbols===8?8:0)):0;
  const nav = NAV;
  return <div className="account-page">
    <header className="account-topbar"><a href="/" className="account-brand"><span><Image src="/nugaom-mascot.png" width={38} height={38} alt="" /></span><span><strong>Nugaom AI Pick</strong><small>MEMBER CENTER</small></span></a><a className="account-back" href="/"><ArrowLeft size={16} /> กลับแดชบอร์ด</a></header>
    <div className="account-hero"><div className="account-hero-inner"><span className="account-kicker">YOUR ACCOUNT / สิทธิสมาชิก</span><h1>สวัสดี, <em>{account?.displayName || 'นักลงทุน'}</em></h1><p>ตรวจสิทธิสมาชิก โควตา AI และการต่ออายุในที่เดียว</p></div></div>
    <div className="account-layout"><aside className="account-nav"><span className="account-nav-label">บัญชีของคุณ</span>{nav.map(([id, label, Icon]) => <button key={id} className={section === id ? 'selected' : ''} onClick={() => { setSection(id); setError(''); setMessage(''); }}><Icon size={17} />{label}{id === 'renewal' && rights?.tier === 'expired' && <i>!</i>}</button>)}<a className="account-admin-link" href="/community"><Users size={17} />ห้องสมาชิกและคุยกับทีม</a><a className="account-admin-link" href="/coaches"><Users size={17} />ติดตามพอร์ตโค้ช</a>{account?.coach && <a className="account-admin-link" href="/coach"><Users size={17} />พอร์ตจำลองของฉัน</a>}{account?.admin && <a className="account-admin-link" href="/admin"><ShieldCheck size={17} />หลังบ้านผู้ดูแล</a>}{account && <button onClick={logout} disabled={busy}><LogOut size={17} />ออกจากระบบ</button>}<div className="account-nav-help"><LockKeyhole size={16} /><span>การสแกนแบบสมาชิกตรวจสิทธิบนเซิร์ฟเวอร์ทุกครั้ง</span></div></aside>
    <main className="account-main" aria-live="polite">
      {loading ? <div className="account-card account-skeleton"><span /><span /><span /></div> : <>
        {error && <div className="account-alert error" role="alert"><CircleAlert size={17} />{error}</div>}
        {message && <div className="account-alert success" role="status"><Check size={17} />{message}</div>}
        {data?.demoEnabled&&<section className="account-card account-demo"><span className="account-kicker">DEMO LOGIN</span><h2>ทดลองสิทธิสมาชิกทุกระดับ</h2><p>เลือกแล้วเข้าใช้งานได้ทันที · session สาธิตมีอายุ 2 ชั่วโมง · แชต AI ใช้ Bigdata จริงตามโควตาระดับที่เลือก</p><div className="account-demo-options">{data.demoRoles.map(role=><button key={role} className={account?.demo?.role===role?'account-primary':'account-secondary'} disabled={busy} aria-pressed={account?.demo?.role===role} onClick={()=>changeDemo(role)}>{DEMO_LABELS[role]}</button>)}</div>{account?.demo&&<><p role="status">กำลังดู Demo {DEMO_LABELS[account.demo.role]} · ใช้ Stripe Test mode ได้ ไม่มีการเรียกเก็บเงินจริง</p><div className="account-actions"><button className="account-secondary" disabled={busy} onClick={()=>changeDemo(null)}>ออกจาก Demo</button>{data.configured&&<a className="account-secondary" href="/api/auth/line/start">เข้าสู่ระบบ LINE จริง</a>}</div></>}</section>}
        {!data?.configured && !account && <div className="account-alert">ยังไม่ได้ตั้งค่า LINE Login สำหรับสภาพแวดล้อมนี้</div>}
        {!account ? <>
          {/* Standard LINE Login Section */}
          <section className="account-card account-login"><div className="account-icon green"><Fingerprint size={28} /></div><span className="account-kicker">STEP 01 · LINE LOGIN</span><h2>เข้าสู่ระบบด้วยบัญชี LINE</h2><p>เข้าสู่ระบบด้วย LINE เพื่อดูสถานะและสิทธิสมาชิก</p><a className={data?.configured ? 'account-primary line' : 'account-primary disabled'} href={data?.configured ? '/api/auth/line/start' : undefined}>เข้าสู่ระบบด้วย LINE <ArrowRight size={16} /></a><small>เราจะไม่ขอรหัสผ่าน LINE และจะไม่ส่งคำสั่งซื้อขายผ่านบัญชีหุ้นของคุณ</small></section>
        </> : <>
          {section === 'overview' && <><BillingPanel account={account} rights={rights} billing={data.billing} onRefresh={refresh}/><section className="account-card account-status">
            <div className="account-status-header">
              <div>
                <span className="account-kicker">สถานะบัญชี</span>
                <h2>{account.demo?'Demo · ':''}{rights.planName??rights.label}</h2>
                <p>{rights.tier === 'trial' ? `เหลือเวลาทดลองอีก ${daysLeft(rights.expiresAt)} วัน` : rights.tier === 'subscriber' ? `${rights.billingSource==='stripe'?'สิทธิ์ที่ชำระแล้วถึง':'ต่ออายุภายใน'} ${date(rights.expiresAt)}` : rights.tier === 'expired' ? 'หมดระยะทดลองใช้ฟรีแล้ว ต่ออายุเพื่อใช้เครื่องมือสแกนสมาชิก' : rights.tier === 'portfolio-fix' ? 'กรุณาติดต่อผู้ดูแลเพื่อตรวจสถานะสิทธิเดิม' : trial?.enabled ? 'เริ่มทดลอง 14 วันได้หนึ่งครั้งต่อบัญชี LINE' : 'ยังไม่เปิดรับสิทธิทดลองใหม่'}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <span className={`account-tier ${active ? 'active' : ''}`}>{active ? <BadgeCheck size={18} /> : <Clock3 size={18} />}{rights.tier.toUpperCase()}</span>
              </div>
            </div>
            {rights.expiresAt && <div className="account-expiry"><span>สิทธิสิ้นสุด</span><strong>{date(rights.expiresAt)}</strong></div>}
            {trial?.canStart && <div className="account-trial"><p>ทดลอง 14 วัน นับจากเวลาที่กดเริ่ม · สูงสุด 8 รายการต่อการสแกนตลาดที่เลือก · ไม่มีการเรียกเก็บเงินอัตโนมัติ</p><p>ดูข้อมูลได้เฉพาะตลาดและแหล่งข้อมูลที่พร้อมและยืนยันสิทธิ์แล้ว</p><button className="account-primary" disabled={busy} onClick={()=>action('/api/account',{action:'start-trial'},'เริ่มทดลอง 14 วันแล้ว')}>{busy?'กำลังเริ่มสิทธิ…':'เริ่มทดลอง 14 วัน'}</button></div>}
            <div className="account-metrics">
              <div><span>การเข้าสู่ระบบ</span><strong>บัญชี LINE</strong><small>ไม่ต้องเชื่อมต่อโบรกเกอร์</small></div>
              <div><span>สิทธิต่อการสแกนตลาดที่เลือก</span><strong>{rights.capabilities.manualDailyScan ? `${scanCap} หุ้น / ครั้ง` : 'ยังไม่เปิด'}</strong><small>ตรวจสิทธิฝั่งเซิร์ฟเวอร์</small></div>
              <div><span>โควตาคำถาม AI</span><strong>{data?.aiQuota ? `${data.aiQuota.freeRemaining} / ${data.aiQuota.freeLimit} ครั้งวันนี้` : '—'}</strong><small>{data?.aiQuota?.credits ? `มีเครดิตสะสม ${data.aiQuota.credits} ครั้ง` : 'ไม่มีเครดิตสะสม'}</small></div>
              <div><span>ขอบเขตตลาด</span><strong>ตามแหล่งที่พร้อม</strong><small>ตรวจสิทธิข้อมูลแยกแต่ละตลาด</small></div>
            </div>

            {/* Quick Access to Pro Institutional Tools */}
            <div className="account-pro-suite-strip">
              <div className="account-pro-suite-title">
                <strong><Sparkles size={15} style={{ color: '#38bdf8' }} /> ชุดเครื่องมือวิเคราะห์เชิงลึกระดับสถาบัน (Pro Suite)</strong>
                <span style={{ fontSize: '11px', color: '#64748b' }}>คลิกเข้าใช้งานได้ทันที</span>
              </div>
              <div className="account-pro-grid">
                <a href="/risk" className="account-pro-link">
                  <BarChart3 size={16} style={{ color: '#0d9488' }} />
                  <span>🎛️ บริหารความเสี่ยง (2R Risk)</span>
                </a>
                <a href="/calendar" className="account-pro-link">
                  <CalendarClock size={16} style={{ color: '#d97706' }} />
                  <span>📅 ปฏิทินเศรษฐกิจ (Macro)</span>
                </a>
                <a href="/developers" className="account-pro-link">
                  <Fingerprint size={16} style={{ color: '#7c3aed' }} />
                  <span>⚡ SMC Structure API</span>
                </a>
                <a href="/daytrade" className="account-pro-link">
                  <Clock3 size={16} style={{ color: '#0284c7' }} />
                  <span>🚀 Daytrade Desk 15m</span>
                </a>
                <a href="/thai" className="account-pro-link">
                  <BadgeCheck size={16} style={{ color: '#059669' }} />
                  <span>🎯 สแกนเนอร์ตลาดไทย</span>
                </a>
              </div>
            </div>

            <div className="account-record" style={{marginTop:'18px'}}><div><span className="account-kicker">NEXT ACTION</span><strong>{active?'เปิดดูข้อมูลตามสิทธิสมาชิก':'ตรวจสถานะสิทธิสมาชิกกับผู้ดูแล'}</strong><span>อ่านข้อมูลตลาดตามแหล่งที่พร้อมและสิทธิที่ยืนยันแล้ว ไม่ต้องกรอกข้อมูลเชื่อมต่อโบรกเกอร์</span></div></div><div className="account-actions"><button className="account-primary" onClick={()=>setSection('renewal')}>จัดการสมาชิก <ArrowRight size={16}/></button><a className="account-secondary" href="/thai">เปิดโต๊ะสแกนหุ้นไทย</a><a className="account-secondary" href="/dr">โต๊ะ DR Strategy</a></div></section><section className="account-card account-steps"><span className="account-kicker">MEMBER JOURNEY</span><h3>ขั้นตอนการใช้งาน</h3><div><article><span>01</span><strong>เข้าสู่ระบบ LINE</strong><small>ระบุตัวตนในทุกอุปกรณ์</small></article><article><span>02</span><strong>ตรวจสิทธิสมาชิก</strong><small>กดเริ่มทดลองได้เมื่อเปิดรับสิทธิใหม่</small></article><article><span>03</span><strong>เปิดข้อมูลตลาด</strong><small>อ่านตามสิทธิและแหล่งข้อมูลที่พร้อม</small></article></div></section></>}
          {section === 'ai-credits' && <AiCreditsPanel quota={data?.aiQuota} onRefresh={refresh} />}
          {section === 'renewal' && <><BillingPanel account={account} rights={rights} billing={data.billing} onRefresh={refresh}/><section className="account-card"><div className="account-section-heading"><span className="account-icon gold"><CalendarClock size={24} /></span><div><span className="account-kicker">MONTHLY ACCESS</span><h2>ต่ออายุสมาชิก</h2><p>สถานะปัจจุบัน: {rights.label}{rights.expiresAt ? ` · สิ้นสุด ${date(rights.expiresAt)}` : ''}</p></div></div>{account.portfolioStatus==='verified' && <div className="account-renewal-grid"><div className="account-renewal-option"><span className="account-kicker">ทางเลือก 01</span><h3>ขอต่ออายุผ่านแอดมิน</h3><p>แอดมินตรวจบัญชีหุ้นและการชำระเงินจากช่องทางที่ตกลงกัน แล้วเปิดสิทธิรายเดือนให้</p><button className="account-primary" disabled={busy || account.portfolioStatus !== 'verified' || account.renewalPending} onClick={() => action('/api/account', { action: 'renewal' }, 'ส่งคำขอต่ออายุแล้ว รอแอดมินตรวจสอบ')}>{account.renewalPending ? 'ส่งคำขอแล้ว · รอตรวจ' : 'ส่งคำขอต่ออายุ'} <ArrowRight size={15} /></button></div><div className="account-renewal-option"><span className="account-kicker">ทางเลือก 02</span><h3>ใช้โค้ดรายเดือน</h3><p>โค้ดออกโดยแอดมินให้บัญชีที่ยืนยันแล้ว ใช้ได้ครั้งเดียวและผูกกับบัญชีนี้</p><form onSubmit={event => { event.preventDefault(); action('/api/account', { action: 'redeem', code }, 'ใช้โค้ดสำเร็จ เพิ่มสิทธิรายเดือนแล้ว'); }}><input value={code} onChange={event => setCode(event.target.value)} placeholder="NUG-••••••••••••••••••••••••" aria-label="โค้ดรายเดือน" required /><button className="account-secondary" disabled={busy || account.portfolioStatus !== 'verified'}>ใช้โค้ด</button></form></div></div>}<p className="account-fineprint">ส่วนนี้สำหรับการต่ออายุผ่านแอดมินเดิม แพ็กเกจ Stripe จัดการได้จากส่วนแพ็กเกจด้านบน</p></section></>}
          {section === 'profile' && <section className="account-card"><div className="account-section-heading"><span className="account-icon cyan"><UserRound size={24} /></span><div><span className="account-kicker">PROFILE</span><h2>โปรไฟล์</h2></div></div><div className="account-profile"><span className="account-profile-avatar"><MemberAvatar account={account} size={58} /></span><div><strong>{account.displayName}</strong><span>เชื่อมต่อ LINE แล้ว</span></div></div><div className="account-record"><ShieldCheck size={20} /><div><strong>ข้อมูลพอร์ตที่บันทึก</strong><span>{account.portfolioLast4 ? `${account.broker} ·••${account.portfolioLast4} · ${account.portfolioStatus === 'verified' ? 'ยืนยันแล้ว' : 'รอตรวจ'}` : 'บัญชีนี้ใช้งานได้โดยไม่ต้องแจ้งเลขพอร์ต'}</span></div></div><button className="account-secondary" onClick={logout} disabled={busy}><LogOut size={16} /> ออกจากระบบ</button></section>}
        </>}
      </>}
    </main></div><footer className="account-footer"><span>© 2026 Nugaom AI Pick</span><span>ข้อมูลตลาดเพื่อการศึกษา · ผู้ใช้ตัดสินใจลงทุนเอง</span></footer>
  </div>;
}
