'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, BadgeCheck, BarChart3, CalendarClock, Check, CircleAlert, Clock3, Fingerprint, LayoutDashboard, LockKeyhole, LogOut, ShieldCheck, Sparkles, UserRound, Users, Radio, ExternalLink, Copy } from 'lucide-react';
import BillingPanel from './billing-panel.jsx';
import MemberAvatar from './member-avatar.jsx';
import AmbientLiquidGlass from './ambient-liquid-glass.jsx';
import { AiCreditsPanel } from './ai-credits-panel.jsx';
import MarketNavigation from './market-navigation.jsx';
import SoundMonitorPill from './monitor/sound-monitor-pill.jsx';

const NAV = [['overview', 'ภาพรวม', LayoutDashboard], ['ai-credits', 'โควตา AI / เครดิต', Sparkles], ['renewal', 'แพ็กเกจ / ต่ออายุ', CalendarClock], ['profile', 'โปรไฟล์', UserRound]];
const MARKET_LABELS = { thai: 'ไทย', dr: 'DR', us: 'US', tfex: 'TFEX', forex: 'Forex' };
const DEMO_LABELS = {
  trial: '🎁 ทดลองใช้ฟรี 14 วัน (Thai+DR · 3 หุ้น)',
  starter: '🟢 BASIC (159฿/ด.)',
  pro: '🔥 PRO VIP (399฿/ด.)',
  onboarding: '👤 สมาชิกใหม่ (Guest)',
  expired: '🔒 สิทธิหมดอายุ',
};
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
  const [telegramInvite, setTelegramInvite] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);

  const requestTelegramInvite = async () => {
    if (telegramLoading) return;
    setTelegramLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/alerts/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-invite' }),
      });
      const resData = await res.json();
      if (resData.ok && resData.inviteLink) {
        setTelegramInvite(resData.inviteLink);
        setMessage('สร้างลิงก์เข้ากลุ่ม Telegram VIP เฉพาะคุณสำเร็จแล้ว (1 สิทธิ์)');
      } else if (resData.error === 'MEMBERSHIP_REQUIRED') {
        setError('สิทธิ์สมาชิกหมดอายุแล้ว กรุณาต่ออายุแพ็กเกจเพื่อรับลิงก์');
      } else {
        setError(resData.error || 'ขอลิงก์เข้ากลุ่มไม่สำเร็จ');
      }
    } catch {
      setError('เชื่อมต่อระบบขอลิงก์ไม่สำเร็จ');
    } finally {
      setTelegramLoading(false);
    }
  };
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
  const scanCap=rights?.tier==='trial'?3:rights?.tier==='subscriber'?({starter:3,pro:8}[rights.planId]??(!rights.planId?(rights.limits?.dailyScanSymbols??8):0)):0;
  const unlockedMarketsText = Array.isArray(rights?.markets) && rights.markets.length
    ? rights.markets.map(m => MARKET_LABELS[m] || m).join(' · ')
    : 'ยังไม่ได้เปิดตลาด';
  const nav = NAV;
  return <div className="account-page">
    <AmbientLiquidGlass isLight={false} />
    <header className="account-topbar">
      <div className="account-topbar-inner">
        <a href="/" className="account-brand">
          <span><Image src="/nugaom-mascot.png" width={38} height={38} alt="Nugaom Logo" /></span>
          <span><strong>Nugaom AI Pick</strong><small>MEMBER PORTAL</small></span>
        </a>
        <div className="account-topbar-actions">
          <SoundMonitorPill />
          <a className="account-back" href="/"><ArrowLeft size={16} /> กลับแดชบอร์ด</a>
        </div>
      </div>
      <div className="account-nav-strip">
        <MarketNavigation current="account" />
      </div>
    </header>
    <div className="account-hero"><div className="account-hero-inner"><span className="account-kicker">YOUR ACCOUNT / สิทธิสมาชิก</span><h1>สวัสดี, <em>{account?.displayName || 'นักลงทุน'}</em></h1><p>ตรวจสิทธิสมาชิก โควตา AI และการต่ออายุในที่เดียว</p></div></div>
    <div className="account-layout"><aside className="account-nav"><span className="account-nav-label">บัญชีของคุณ</span>{nav.map(([id, label, Icon]) => <button key={id} className={section === id ? 'selected' : ''} onClick={() => { setSection(id); setError(''); setMessage(''); }}><Icon size={17} />{label}{id === 'renewal' && rights?.tier === 'expired' && <i>!</i>}</button>)}<a className="account-admin-link" href="/community"><Users size={17} />ห้องสมาชิกและคุยกับทีม</a><a className="account-admin-link" href="/open-account"><BadgeCheck size={17} />เปิดพอร์ต VIP ฟรี (3 โบรก)</a>{(account?.admin || account?.brokerStaff || account?.affiliate) && <a className="account-admin-link" href="/admin"><ShieldCheck size={17} />{account?.admin ? 'หลังบ้านผู้ดูแล' : account?.brokerStaff ? 'พอร์ทัลเจ้าหน้าที่ บล.' : 'พาร์ทเนอร์ Affiliate 30%'}</a>}{account && <button onClick={logout} disabled={busy}><LogOut size={17} />ออกจากระบบ</button>}<div className="account-nav-help"><LockKeyhole size={16} /><span>เชื่อมต่อ LINE ปลอดภัย · ไม่เข้าถึงเงินในพอร์ต</span></div></aside>
    <main className="account-main" aria-live="polite">
      {loading ? <div className="account-card account-skeleton"><span /><span /><span /></div> : <>
        {error && <div className="account-alert error" role="alert"><CircleAlert size={17} />{error}</div>}
        {message && <div className="account-alert success" role="status"><Check size={17} />{message}</div>}
        {data?.demoEnabled&&<section className="account-card account-demo">
          <span className="account-kicker">DEMO LOGIN / สลับทดลองสิทธิสมาชิก</span>
          <h2>ทดลองสิทธิสมาชิกตามแพ็กเกจจริง (159฿ vs 399฿)</h2>
          <p>คลิกเลือกเพื่อจำลองสถานะสมาชิกตามระดับราคาจริง · session สาธิตมีอายุ 2 ชั่วโมง · ทดสอบระบบสแกนและ AI ตามสิทธิแต่ละระดับ</p>
          <div className="account-demo-options">
            {['trial', 'starter', 'pro', 'onboarding', 'expired'].filter(r=>data.demoRoles.includes(r)).map(role=><button key={role} className={account?.demo?.role===role?'account-primary':'account-secondary'} disabled={busy} aria-pressed={account?.demo?.role===role} onClick={()=>changeDemo(role)}>{DEMO_LABELS[role]}</button>)}
          </div>

          {/* Active Entitlement Breakdown Box */}
          <div style={{ marginTop: '14px', padding: '14px 16px', background: 'rgba(15, 23, 42, 0.65)', border: "none", borderRadius: '12px' }}>
            {account?.demo?.role === 'starter' || rights?.planId === 'starter' ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <b style={{ color: '#34d399', fontSize: '14px' }}>🟢 สิทธิระดับ BASIC (฿159/เดือน · ฿1,590/ปี)</b>
                  <span style={{ fontSize: '10px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>สมาชิกเริ่มต้น</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '6px', fontSize: '11px' }}>
                  <span style={{ color: '#cbd5e1' }}>✅ สแกนหุ้นไทย EOD (SET100 / mai)</span>
                  <span style={{ color: '#cbd5e1' }}>✅ สแกนหุ้น DR80 ท็อปเทคโลก (NVIDIA, Apple)</span>
                  <span style={{ color: '#cbd5e1' }}>✅ จุดเข้า Buy Zone, Stop Loss, Target 2R</span>
                  <span style={{ color: '#cbd5e1' }}>✅ ถาม AI วิเคราะห์หุ้น 10 คำถาม/วัน</span>
                  <span style={{ color: '#94a3b8', textDecoration: 'line-through' }}>❌ บอทแจ้งเตือนเสียงสไตล์เพื่อน</span>
                  <span style={{ color: '#94a3b8', textDecoration: 'line-through' }}>❌ Telegram VIP Bot ส่งการบ้านเช้า</span>
                  <span style={{ color: '#94a3b8', textDecoration: 'line-through' }}>❌ DR Arbitrage Fair Value Alert</span>
                  <span style={{ color: '#94a3b8', textDecoration: 'line-through' }}>❌ ตลาดสัญญา TFEX / S50 Options</span>
                </div>
              </div>
            ) : account?.demo?.role === 'trial' || rights?.tier === 'trial' ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <b style={{ color: '#fbbf24', fontSize: '14px' }}>🎁 สิทธิทดลองใช้ฟรี 14 วัน (Thai + DR · 3 หุ้นเด่น)</b>
                  <span style={{ fontSize: '10px', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>TRIAL 14 วัน</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '6px', fontSize: '11px' }}>
                  <span style={{ color: '#cbd5e1' }}>✅ สแกนหุ้นไทย EOD &amp; DR80 สูงสุด 3 หุ้น/รอบ</span>
                  <span style={{ color: '#cbd5e1' }}>✅ จุดเข้า Buy Zone, Stop Loss, Target 2R</span>
                  <span style={{ color: '#cbd5e1' }}>✅ ถาม AI วิเคราะห์หุ้น 5 คำถาม/วัน</span>
                  <span style={{ color: '#94a3b8', textDecoration: 'line-through' }}>❌ Telegram VIP ส่งการบ้านหุ้นเข้ากลุ่ม</span>
                  <span style={{ color: '#94a3b8', textDecoration: 'line-through' }}>❌ เสียงแจ้งเตือนน้องนักออม AI</span>
                  <span style={{ color: '#94a3b8', textDecoration: 'line-through' }}>❌ ตลาด US Stocks / TFEX / Forex</span>
                </div>
              </div>
            ) : account?.demo?.role === 'pro' || rights?.planId === 'pro' || (rights?.tier === 'subscriber' && !rights?.planId) ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <b style={{ color: '#38bdf8', fontSize: '14px' }}>🔥 สิทธิระดับ PRO VIP (฿399/เดือน · ฿3,990/ปี)</b>
                  <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>ปลดล็อกครบ 100%</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '6px', fontSize: '11px' }}>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>✅ ปลดล็อกครบ 5 ตลาด (Thai + DR + US + TFEX + Forex) สูงสุด 8 หุ้น/รอบ</span>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>✅ <b>บอทแจ้งเตือนเสียงภาษาไทยสด</b> (Voice Alert)</span>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>✅ <b>Telegram VIP Bot</b> ส่งการบ้านหุ้นเด่นเข้ากลุ่ม</span>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>✅ <b>DR Arbitrage Shield</b> ดักจับพรีเมียมแพงเกิน</span>
                  <span style={{ color: '#cbd5e1' }}>✅ ถาม AI ลึกระดับ Pro 50 คำถาม/วัน</span>
                  <span style={{ color: '#cbd5e1' }}>✅ Trade Ledger บันทึกผลงานตามแผน 2R และการล็อกทุน</span>
                  <span style={{ color: '#cbd5e1' }}>✅ สิทธิ์โพสต์พูดคุยในห้อง VIP Community</span>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <b style={{ color: '#f59e0b', fontSize: '14px' }}>🔒 สถานะผู้เยี่ยมชม / สิทธิหมดอายุ</b>
                  <span style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>จำกัดการเข้าถึง</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                  ยังไม่สามารถเปิดดูกราฟแท่งเทียนสดหรือสัญญาณคัดกรองได้ กรุณาเลือก Demo สมาชิกด้านบน หรือกดรับสิทธิ์ทดลองใช้ฟรี 14 วัน
                </p>
              </div>
            )}
          </div>

          {account?.demo&&<><p role="status" style={{ marginTop: '10px' }}>กำลังดู Demo {DEMO_LABELS[account.demo.role]} · ใช้ Stripe Test mode ได้ ไม่มีการเรียกเก็บเงินจริง</p><div className="account-actions"><button className="account-secondary" disabled={busy} onClick={()=>changeDemo(null)}>ออกจาก Demo</button>{data.configured&&<a className="account-secondary" href="/api/auth/line/start">เข้าสู่ระบบ LINE จริง</a>}</div></>}
        </section>}
        {!data?.configured && !account && <div className="account-alert">ยังไม่ได้ตั้งค่า LINE Login สำหรับสภาพแวดล้อมนี้</div>}
        {!account ? <>
          {/* Standard LINE Login Section */}
          <section className="account-card account-login"><div className="account-icon green"><Fingerprint size={28} /></div><span className="account-kicker">STEP 01 · LINE LOGIN</span><h2>เข้าสู่ระบบด้วยบัญชี LINE</h2><p>เข้าสู่ระบบด้วย LINE เพื่อตรวจสิทธิ์ทดลอง 14 วัน โควตา AI และการเข้ากลุ่ม Telegram VIP</p><a className={data?.configured ? 'account-primary line' : 'account-primary disabled'} href={data?.configured ? '/api/auth/line/start' : undefined}>เข้าสู่ระบบด้วย LINE <ArrowRight size={16} /></a><small>ปลอดภัยผ่าน LINE Official · ไม่ขอรหัสผ่านและไม่เข้าถึงเงินในพอร์ต</small></section>
          <BillingPanel account={null} rights={rights} billing={data?.billing} onRefresh={refresh}/>
        </> : <>
          {section === 'overview' && <><section className="account-card account-status">
            <div className="account-status-header">
              <div>
                <span className="account-kicker">สถานะบัญชี</span>
                <h2>{account.demo?'Demo · ':''}{rights?.planId==='starter'?'🟢 BASIC (฿159/ด.)':rights?.planId==='pro'?'🔥 PRO VIP (฿399/ด.)':rights?.tier==='trial'?'🎁 ทดลองใช้ฟรี 14 วัน (Thai+DR · 3 หุ้น)':rights?.tier==='expired'?'🔒 สิทธิหมดอายุ':rights?.tier==='onboarding'?'👤 สมาชิกใหม่':rights.planName??rights.label}</h2>
                <p>{rights.tier === 'trial' ? `เหลือเวลาทดลองอีก ${daysLeft(rights.expiresAt)} วัน · สแกนตลาด Thai & DR สูงสุด 3 หุ้น/รอบ · ถาม AI 5 ครั้ง/วัน (อัปเกรด PRO VIP เพื่อปลดล็อกครบ 5 ตลาดและ Telegram VIP)` : rights.planId === 'starter' ? `สิทธิแพ็กเกจ BASIC ถึง ${date(rights.expiresAt)} · สแกนหุ้นไทยและ DR สูงสุด 3 หุ้น/รอบ · ถาม AI 10 ครั้ง/วัน (159 บาท/เดือน)` : rights.planId === 'pro' ? `สิทธิแพ็กเกจ PRO VIP ถึง ${date(rights.expiresAt)} · ปลดล็อกเสียงแจ้งเตือนสด, Telegram VIP, AI 50 ครั้ง/วัน และครบ 5 ตลาด (399 บาท/เดือน)` : rights.tier === 'subscriber' ? `สิทธิ VIP ถึง ${date(rights.expiresAt)} · เทียบเท่าระดับ PRO VIP ครบทุกตลาด (สูงสุด 8 หุ้น/รอบ · AI 50 ครั้ง/วัน · Telegram VIP)` : rights.tier === 'expired' ? 'หมดระยะทดลองใช้ฟรีแล้ว ต่ออายุหรือเปิดพอร์ตพาร์ทเนอร์เพื่อใช้งานต่อเนื่อง' : rights.tier === 'portfolio-fix' ? 'กรุณาติดต่อทีมงานเพื่อตรวจสอบสถานะพอร์ตพาร์ทเนอร์ของคุณ' : trial?.enabled ? 'เริ่มทดลอง 14 วันได้หนึ่งครั้งต่อบัญชี LINE (Thai + DR สูงสุด 3 หุ้น)' : 'เลือกแพ็กเกจหรือเปิดพอร์ตพาร์ทเนอร์เพื่อเริ่มใช้งาน'}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <span className={`account-tier ${active ? 'active' : ''}`}>{active ? <BadgeCheck size={18} /> : <Clock3 size={18} />}{rights?.planId==='starter'?'BASIC':rights?.planId==='pro'||(rights?.tier==='subscriber'&&!rights?.planId)?'PRO VIP':rights.tier.toUpperCase()}</span>
              </div>
            </div>
            {rights.expiresAt && <div className="account-expiry"><span>สิทธิสิ้นสุด</span><strong>{date(rights.expiresAt)}</strong></div>}
            {trial?.canStart && <div className="account-trial"><p>ทดลองฟรี 14 วัน นับจากเวลาที่กดเริ่ม · สแกนตลาด Thai &amp; DR สูงสุด 3 หุ้น/รอบ · ถาม AI 5 ครั้ง/วัน · ไม่มีการหักเงินอัตโนมัติ</p><p>ทดลองใช้งานได้ทันทีโดยไม่ต้องผูกบัตรเครดิต</p><button className="account-primary" disabled={busy} onClick={()=>action('/api/account',{action:'start-trial'},'เริ่มทดลอง 14 วันแล้ว')}>{busy?'กำลังเริ่มสิทธิ…':'เริ่มทดลอง 14 วัน'}</button></div>}
            <div className="account-metrics">
              <div><span>การเข้าสู่ระบบ</span><strong>บัญชี LINE</strong><small>ใช้งานได้ทุกอุปกรณ์ทันที</small></div>
              <div><span>โควตาสแกนต่อรอบ</span><strong>{rights.capabilities.manualDailyScan ? `${scanCap} หุ้น / ครั้ง` : 'ยังไม่เปิด'}</strong><small>{rights?.planId==='starter'?'แพ็กเกจเริ่มต้น':active?'ปลดล็อกตามระดับสิทธิ์':'กดเริ่มทดลองหรืออัปเกรด'}</small></div>
              <div><span>โควตาคำถาม AI</span><strong>{data?.aiQuota ? `${data.aiQuota.freeRemaining} / ${data.aiQuota.freeLimit} ครั้งวันนี้` : '—'}</strong><small>{data?.aiQuota?.credits ? `มีเครดิตสะสม ${data.aiQuota.credits} ครั้ง` : 'รีเซ็ตอัตโนมัติทุกวัน'}</small></div>
              <div><span>ตลาดที่ปลดล็อก</span><strong>{unlockedMarketsText}</strong><small>{rights?.markets?.length >= 5 ? 'ครบทุกตลาดหลัก' : 'อัปเกรด PRO VIP เพื่อเปิดครบ 5 ตลาด'}</small></div>
            </div>

            {/* Quick Access to Pro Tools */}
            <div className="account-pro-suite-strip">
              <div className="account-pro-suite-title">
                <strong><Sparkles size={15} style={{ color: '#38bdf8' }} /> ชุดเครื่องมือช่วยเทรดมือโปร (Pro Suite)</strong>
                <span style={{ fontSize: '11px', color: '#64748b' }}>คลิกเข้าใช้งานได้ทันที</span>
              </div>
              <div className="account-pro-grid">
                <a href="/risk" className="account-pro-link">
                  <BarChart3 size={16} style={{ color: '#0d9488' }} />
                  <span>🎛️ บริหารความเสี่ยง & คำนวณไม้ (2R Risk)</span>
                </a>
                <a href="/thai" className="account-pro-link">
                  <BadgeCheck size={16} style={{ color: '#059669' }} />
                  <span>📈 สแกนหุ้นขาขึ้นรอบใหญ่ (Stage 2)</span>
                </a>
                <a href="/us" className="account-pro-link">
                  <Sparkles size={16} style={{ color: '#38bdf8' }} />
                  <span>🇺🇸 สแกนหุ้นสหรัฐฯ (S&P 500)</span>
                </a>
                <a href="/calendar" className="account-pro-link">
                  <CalendarClock size={16} style={{ color: '#d97706' }} />
                  <span>📅 ปฏิทินเศรษฐกิจ & ข่าว (Macro)</span>
                </a>
                <a href="/daytrade" className="account-pro-link">
                  <Clock3 size={16} style={{ color: '#0284c7' }} />
                  <span>🚀 Daytrade Desk 15m (TFEX / หุ้นนอก)</span>
                </a>
              </div>
            </div>

            {/* Partner Volume / Revocation Notice */}
            {account.vipRevokedReason && (
              <div className="account-record" style={{ marginTop: '14px', background: 'rgba(239, 68, 68, 0.14)', border: '1px solid rgba(239, 68, 68, 0.35)', padding: '14px 18px', borderRadius: '14px' }}>
                <div>
                  <span className="account-kicker" style={{ color: '#fca5a5' }}>VIP ACCESS PAUSED</span>
                  <strong style={{ color: '#fecaca', display: 'block', marginTop: '2px' }}>
                    {account.vipRevokedReason === 'VOLUME_BELOW_TARGET'
                      ? `สิทธิ VIP พอร์ตพาร์ทเนอร์ถูกพัก (ค่าคอมเดือนนี้ยังไม่ถึงเกณฑ์ ${(Number(account.brokerVolumeTargetThb) || 1000).toLocaleString('en-US')} บาท/เดือน)`
                      : 'สิทธิ VIP พอร์ตพาร์ทเนอร์ถูกพักเนื่องจากไม่พบความเคลื่อนไหวการเทรดในรอบที่กำหนด'}
                  </strong>
                  <span style={{ fontSize: '12px', color: '#fecaca' }}>
                    หากมีค่าคอมครบเงื่อนไขแล้ว สามารถแจ้งเจ้าหน้าที่ บล. / แอดมินอัปเดตยอด หรือกรอกโค้ดต่อโปรใหม่ในหน้า "ต่ออายุ / ใช้โค้ด" หรือสมัครแพ็กเกจ Stripe PRO VIP
                  </span>
                </div>
              </div>
            )}

            {account.portfolioStatus === 'verified' && (
              <div className="account-record" style={{ marginTop: '14px', padding: '14px 18px', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.45)', border: '1px solid rgba(148, 163, 184, 0.25)', flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <span className="account-kicker">PARTNER COMMISSION MONITOR ({account.brokerVolumeMonth || 'เดือนนี้'})</span>
                    <strong style={{ display: 'block', fontSize: '14px' }}>
                      ค่าคอมพอร์ต {account.broker || 'Partner'}: ฿{(Number(account.brokerMonthlyVolumeThb) || 0).toLocaleString('en-US')} / ฿{(Number(account.brokerVolumeTargetThb) || 1000).toLocaleString('en-US')} บาท
                    </strong>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 700, background: account.volumeQualified ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: account.volumeQualified ? '#34d399' : '#fbbf24' }}>
                    {account.volumeQualified ? 'ผ่านเกณฑ์ VIP ≥ ฿1,000/ด.' : `ขาดอีก ฿${Math.max(0, (Number(account.brokerVolumeTargetThb) || 1000) - (Number(account.brokerMonthlyVolumeThb) || 0)).toLocaleString('en-US')}`}
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', borderRadius: '999px', background: 'rgba(148, 163, 184, 0.2)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.round(((Number(account.brokerMonthlyVolumeThb) || 0) / Math.max(1, Number(account.brokerVolumeTargetThb) || 1000)) * 100))}%`, height: '100%', background: account.volumeQualified ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #f59e0b, #fbbf24)', borderRadius: '999px' }} />
                </div>
              </div>
            )}

            {/* Telegram VIP Access Card */}
            <div className="account-record" style={{ marginTop: '18px', background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.35), rgba(15, 23, 42, 0.75))', padding: '18px 20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px', flexWrap: 'wrap', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ display: 'grid', placeItems: 'center', width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>
                    <Radio size={22} />
                  </span>
                  <div>
                    <strong style={{ fontSize: '15px', color: '#f8fafc', display: 'block' }}>ห้องสัญญาณเทรดสด Telegram VIP</strong>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                      {rights?.capabilities?.telegramVip ? 'สิทธิ์ PRO VIP / พอร์ตพาร์ทเนอร์: รับโพยหุ้นไทยเช้า 09:30 & เย็น 17:30, DR หุ้นนอก และสัญญาณ TFEX Real-time' : 'สงวนสิทธิ์เฉพาะสมาชิก PRO VIP (฿399/ด.) หรือสมาชิกพอร์ตพาร์ทเนอร์ค่าคอม ≥ 1,000 บาท/เดือน'}
                    </span>
                  </div>
                </div>
                {rights?.capabilities?.telegramVip ? (
                  <button
                    className="account-primary"
                    style={{ background: 'linear-gradient(100deg, #38bdf8, #0284c7)', color: '#031726', fontWeight: 800 }}
                    disabled={telegramLoading}
                    onClick={requestTelegramInvite}
                  >
                    <ExternalLink size={15} /> {telegramLoading ? 'กำลังสร้างลิงก์…' : telegramInvite ? 'ขอลิงก์ใหม่' : 'รับลิงก์เข้ากลุ่ม VIP (1 สิทธิ์)'}
                  </button>
                ) : (
                  <button className="account-secondary" onClick={() => setSection('renewal')}>
                    อัปเกรด PRO VIP / ใช้โค้ด <ArrowRight size={14} />
                  </button>
                )}
              </div>
              {telegramInvite && (
                <div style={{ marginTop: '6px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', width: '100%' }}>
                  <div style={{ wordBreak: 'break-all' }}>
                    <span style={{ fontSize: '11px', color: '#6ee7b7', display: 'block', fontWeight: 700 }}>🎉 ลิงก์เข้ากลุ่มเฉพาะคุณ (ใช้ได้ 1 ครั้ง):</span>
                    <code style={{ fontSize: '13px', color: '#38bdf8' }}>{telegramInvite}</code>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="account-secondary"
                      style={{ padding: '6px 12px', fontSize: '11px' }}
                      onClick={() => {
                        navigator.clipboard?.writeText(telegramInvite);
                        setCopiedInvite(true);
                        setTimeout(() => setCopiedInvite(false), 2000);
                      }}
                    >
                      {copiedInvite ? <Check size={14} /> : <Copy size={14} />} {copiedInvite ? 'คัดลอกแล้ว' : 'คัดลอก'}
                    </button>
                    <a
                      href={telegramInvite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="account-primary"
                      style={{ padding: '6px 14px', fontSize: '11px', textDecoration: 'none' }}
                    >
                      เข้ากลุ่มทันที ↗
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="account-record" style={{marginTop:'18px'}}><div><span className="account-kicker">NEXT ACTION</span><strong>{active?'พร้อมใช้งานสแกนหุ้น & สัญญาณแล้ว':'ยังไม่ได้เปิดใช้งานสิทธิ์ VIP'}</strong><span>{active?'เข้าห้องสแกนหุ้นไทย Stage 2, ดู DR หุ้นนอก หรือกดรับลิงก์ Telegram VIP ด้านบนได้เลย':'กดเริ่มทดลองใช้ฟรี 14 วัน เลือกแพ็กเกจด้านล่าง หรือเปิดพอร์ตพาร์ทเนอร์รับ VIP ฟรี'}</span></div></div><div className="account-actions"><a className="account-primary" href="/thai">เปิดโต๊ะสแกนหุ้นไทย <ArrowRight size={16}/></a><a className="account-secondary" href="/dr">โต๊ะ DR Strategy</a><button className="account-secondary" onClick={()=>setSection('renewal')}>กรอกโค้ด / จัดการแพ็กเกจ</button></div></section><BillingPanel account={account} rights={rights} billing={data.billing} onRefresh={refresh}/><section className="account-card account-steps"><span className="account-kicker">MEMBER JOURNEY</span><h3>ขั้นตอนการใช้งาน</h3><div><article><span>01</span><strong>เข้าสู่ระบบ LINE</strong><small>ระบุตัวตนปลอดภัยทุกอุปกรณ์</small></article><article><span>02</span><strong>เลือกสิทธิ์ใช้งาน</strong><small>ทดลอง 14 วัน สมัคร PRO VIP หรือเปิดพอร์ต</small></article><article><span>03</span><strong>สแกน & รับสัญญาณ</strong><small>เข้าห้อง Telegram VIP และวางแผนเทรด</small></article></div></section></>}
          {section === 'ai-credits' && <AiCreditsPanel quota={data?.aiQuota} onRefresh={refresh} />}
          {section === 'renewal' && <><BillingPanel account={account} rights={rights} billing={data.billing} onRefresh={refresh}/><section className="account-card"><div className="account-section-heading"><span className="account-icon gold"><CalendarClock size={24} /></span><div><span className="account-kicker">PROMO & PARTNER VIP ACCESS</span><h2>ต่ออายุสมาชิก / กรอกโค้ดต่อโปร</h2><p>สถานะปัจจุบัน: {rights.label}{rights.expiresAt ? ` · สิ้นสุด ${date(rights.expiresAt)}` : ''}</p></div></div><div className="account-renewal-grid"><div className="account-renewal-option"><span className="account-kicker">โค้ด VIP จากแอดมิน</span><h3>ใช้โค้ดต่อโปร / โค้ดรายเดือน (NUG-...)</h3><p>นำโค้ด 1-Time ที่ได้รับจากแอดมินมากรอกเพื่อเปิดหรือต่ออายุ PRO VIP ทันที (สิทธิ์พอร์ตพาร์ทเนอร์มีเกณฑ์ค่าคอม ≥ 1,000 บาท/เดือน)</p><form onSubmit={event => { event.preventDefault(); action('/api/account', { action: 'redeem', code }, 'ใช้โค้ดสำเร็จ เพิ่มสิทธิ VIP แล้ว'); setCode(''); }}><input value={code} onChange={event => setCode(event.target.value)} placeholder="NUG-••••••••••••••••••••••••" aria-label="โค้ดรายเดือน" required /><button className="account-primary" disabled={busy}>เปิดใช้งานโค้ด</button></form></div>{account.portfolioStatus==='verified' && <div className="account-renewal-option"><span className="account-kicker">พอร์ตพาร์ทเนอร์ ({account.broker || 'Verified'})</span><h3>ขอต่ออายุผ่านแอดมิน (ค่าคอม ≥ ฿1,000/ด.)</h3><p>ค่าคอมเดือนนี้: <strong>฿{(Number(account.brokerMonthlyVolumeThb) || 0).toLocaleString('en-US')}</strong> / ฿{(Number(account.brokerVolumeTargetThb) || 1000).toLocaleString('en-US')} บาท — เจ้าหน้าที่ บล. / แอดมินอัปเดตยอดแล้วต่ออายุ VIP ให้อัตโนมัติ</p><button className="account-secondary" disabled={busy || account.renewalPending} onClick={() => action('/api/account', { action: 'renewal' }, 'ส่งคำขอต่ออายุแล้ว รอแอดมินตรวจสอบ')}>{account.renewalPending ? 'ส่งคำขอแล้ว · รอตรวจ' : 'ส่งคำขอตรวจยอดต่ออายุ'} <ArrowRight size={15} /></button></div>}</div><p className="account-fineprint">แพ็กเกจ Stripe BASIC / PRO VIP สามารถสมัครหรือจัดการได้จากส่วนแพ็กเกจด้านบน · หากใช้สิทธิ์ฟรีผ่านพอร์ตพาร์ทเนอร์ กรุณารักษาค่าคอม ≥ 1,000 บาท/คน/เดือน</p></section></>}
          {section === 'profile' && <section className="account-card"><div className="account-section-heading"><span className="account-icon cyan"><UserRound size={24} /></span><div><span className="account-kicker">PROFILE</span><h2>โปรไฟล์</h2></div></div><div className="account-profile"><span className="account-profile-avatar"><MemberAvatar account={account} size={58} /></span><div><strong>{account.displayName}</strong><span>เชื่อมต่อ LINE แล้ว</span></div></div><div className="account-record"><ShieldCheck size={20} /><div><strong>ข้อมูลพอร์ตที่บันทึก</strong><span>{account.portfolioLast4 ? `${account.broker} ·••${account.portfolioLast4} · ${account.portfolioStatus === 'verified' ? 'ยืนยันแล้ว' : 'รอตรวจ'}` : 'บัญชีนี้ใช้งานได้โดยไม่ต้องแจ้งเลขพอร์ต'}</span></div></div><button className="account-secondary" onClick={logout} disabled={busy}><LogOut size={16} /> ออกจากระบบ</button></section>}
        </>}
      </>}
    </main></div><footer className="account-footer"><span>© 2026 Nugaom AI Pick</span><span>ข้อมูลตลาดเพื่อการศึกษา · ผู้ใช้ตัดสินใจลงทุนเอง</span></footer>
  </div>;
}
