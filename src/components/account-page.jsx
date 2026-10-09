'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarClock, Check, CircleAlert, Clock3, Fingerprint, LayoutDashboard, LockKeyhole, LogOut, ShieldCheck, Sparkles, UserRound, Users, Wallet } from 'lucide-react';
import MemberAvatar from './member-avatar.jsx';
import { AiCreditsPanel } from './ai-credits-panel.jsx';

const NAV = [['overview', 'ภาพรวม', LayoutDashboard], ['portfolio', 'บัญชีหุ้น', Wallet], ['ai-credits', 'เครดิต AI', Sparkles], ['renewal', 'ต่ออายุสมาชิก', CalendarClock], ['profile', 'โปรไฟล์', UserRound]];
const MESSAGES = {
  INVALID_PORTFOLIO: 'เลขพอร์ตต้องมีอักษรหรือตัวเลข 5–24 ตัว', INVALID_BROKER: 'กรุณาระบุชื่อโบรกเกอร์',
  PORTFOLIO_ALREADY_USED: 'เลขพอร์ตนี้ถูกผูกกับบัญชีอื่นแล้ว', PORTFOLIO_CHANGE_REQUIRES_ADMIN: 'เปลี่ยนเลขพอร์ตที่แจ้งแล้วต้องให้แอดมินดำเนินการ',
  PORTFOLIO_NOT_VERIFIED: 'แอดมินยังไม่ยืนยันบัญชีหุ้นนี้', PORTFOLIO_MISMATCH: 'เลขพอร์ตไม่ตรงกับที่สมาชิกแจ้ง',
  CODE_UNAVAILABLE: 'โค้ดไม่ถูกต้อง หมดอายุ หรือถูกใช้แล้ว', INVALID_CODE: 'รูปแบบโค้ดไม่ถูกต้อง',
  REQUEST_UNAVAILABLE: 'รายการนี้ถูกจัดการไปแล้ว กรุณารีเฟรชข้อมูล',
  INVALID_CREDIT_AMOUNT: 'จำนวนเครดิตต้องเป็นจำนวนเต็ม 1–1,000',
  LOGIN_REQUIRED: 'กรุณาเข้าสู่ระบบ LINE อีกครั้ง', FORBIDDEN: 'บัญชีนี้ไม่มีสิทธิแอดมิน',
};
function date(value) { return value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }) : '—'; }
function daysLeft(value) { return value ? Math.max(0, Math.ceil((Date.parse(value) - Date.now()) / 86_400_000)) : 0; }
function notice(error) { return MESSAGES[error] || 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่'; }

export default function AccountPage() {
  const [section, setSection] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [broker, setBroker] = useState('');
  const [portfolio, setPortfolio] = useState('');
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
    if (status === 'ok') setMessage('เข้าสู่ระบบ LINE สำเร็จ');
  }, []);
  async function action(path, body, success) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) { setError(notice(payload.error)); return; }
      setData(payload);
      setMessage(success);
      if (body.action === 'portfolio') setPortfolio('');
      if (body.action === 'redeem') setCode('');
    } catch { setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('LOGOUT_FAILED');
      window.location.href = '/account';
    } catch { setError('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่'); setBusy(false); }
  }
  const account = data?.account;
  const rights = data?.rights;
  const active = rights?.tier === 'trial' || rights?.tier === 'subscriber';
  const nav = NAV;
  return <div className="account-page">
    <header className="account-topbar"><a href="/" className="account-brand"><span><Image src="/nugaom-mascot.png" width={38} height={38} alt="" /></span><span><strong>Nugaom AI Pick</strong><small>MEMBER CENTER</small></span></a><a className="account-back" href="/"><ArrowLeft size={16} /> กลับแดชบอร์ด</a></header>
    <div className="account-hero"><div className="account-hero-inner"><span className="account-kicker">YOUR ACCOUNT / สิทธิสมาชิก</span><h1>สวัสดี, <em>{account?.displayName || 'นักลงทุน'}</em></h1><p>จัดการบัญชีหุ้น สิทธิทดลอง และการต่ออายุในที่เดียว</p></div></div>
    <div className="account-layout"><aside className="account-nav"><span className="account-nav-label">บัญชีของคุณ</span>{nav.map(([id, label, Icon]) => <button key={id} className={section === id ? 'selected' : ''} onClick={() => { setSection(id); setError(''); setMessage(''); }}><Icon size={17} />{label}{id === 'renewal' && rights?.tier === 'expired' && <i>!</i>}</button>)}<a className="account-admin-link" href="/coaches"><Users size={17} />ติดตามพอร์ตโค้ช</a>{account?.coach && <a className="account-admin-link" href="/coach"><Users size={17} />พอร์ตจำลองของฉัน</a>}{account?.admin && <a className="account-admin-link" href="/admin"><ShieldCheck size={17} />หลังบ้านผู้ดูแล</a>}{account && <button onClick={logout} disabled={busy}><LogOut size={17} />ออกจากระบบ</button>}<div className="account-nav-help"><LockKeyhole size={16} /><span>การสแกนแบบสมาชิกตรวจสิทธิบนเซิร์ฟเวอร์ทุกครั้ง</span></div></aside>
    <main className="account-main" aria-live="polite">
      {loading ? <div className="account-card account-skeleton"><span /><span /><span /></div> : <>
        {error && <div className="account-alert error" role="alert"><CircleAlert size={17} />{error}</div>}
        {message && <div className="account-alert success" role="status"><Check size={17} />{message}</div>}
        {!data?.configured && <div className="account-alert"><CircleAlert size={17} />ยังไม่ได้ตั้งค่า LINE Login และฐานข้อมูลสมาชิกสำหรับสภาพแวดล้อมนี้</div>}
        {!account ? <section className="account-card account-login"><div className="account-icon green"><Fingerprint size={28} /></div><span className="account-kicker">STEP 01 · LINE LOGIN</span><h2>เริ่มต้นด้วยบัญชี LINE</h2><p>เข้าสู่ระบบด้วย LINE แล้วแจ้งเลขพอร์ตหุ้นเพื่อเริ่มทดลองใช้ฟรี 14 วัน</p><a className={data?.configured ? 'account-primary line' : 'account-primary disabled'} href={data?.configured ? '/api/auth/line/start' : undefined}>เข้าสู่ระบบด้วย LINE <ArrowRight size={16} /></a><small>เราจะไม่ขอรหัสผ่าน LINE และจะไม่ส่งคำสั่งซื้อขายผ่านบัญชีหุ้นของคุณ</small></section> : <>
          {section === 'overview' && <><section className="account-card account-status"><div className="account-status-header"><div><span className="account-kicker">สถานะบัญชี</span><h2>{rights.label}</h2><p>{rights.tier === 'trial' ? `เหลือเวลาทดลองอีก ${daysLeft(rights.expiresAt)} วัน` : rights.tier === 'subscriber' ? `ต่ออายุภายใน ${date(rights.expiresAt)}` : rights.tier === 'expired' ? 'หมดระยะทดลองใช้ฟรีแล้ว ต่ออายุเพื่อใช้เครื่องมือสแกนสมาชิก' : rights.tier === 'portfolio-fix' ? 'เลขพอร์ตไม่ผ่านการตรวจ กรุณาแจ้งใหม่ · ระยะทดลองยังนับจากวันเริ่มเดิม' : 'แจ้งเลขพอร์ตเพื่อเริ่มทดลองใช้ฟรี 14 วัน'}</p></div><span className={`account-tier ${active ? 'active' : ''}`}>{active ? <BadgeCheck size={18} /> : <Clock3 size={18} />}{rights.tier.toUpperCase()}</span></div>{rights.expiresAt && <div className="account-expiry"><span>สิทธิสิ้นสุด</span><strong>{date(rights.expiresAt)}</strong></div>}<div className="account-metrics"><div><span>บัญชีหุ้น</span><strong>{account.portfolioLast4 ? `${account.broker} ·••${account.portfolioLast4}` : 'ยังไม่แจ้ง'}</strong><small>{account.portfolioStatus === 'verified' ? 'ยืนยันแล้ว' : account.portfolioStatus === 'pending' ? 'รอแอดมินตรวจ' : 'เริ่มที่ขั้นตอนนี้'}</small></div><div><span>สิทธิสแกนรายวัน</span><strong>{rights.capabilities.manualDailyScan ? `${rights.limits.dailyScanSymbols} หุ้น / ครั้ง` : 'ยังไม่เปิด'}</strong><small>ตรวจสิทธิฝั่งเซิร์ฟเวอร์</small></div></div><div className="account-actions"><button className="account-primary" onClick={() => setSection(account.portfolioLast4 ? 'renewal' : 'portfolio')}>{account.portfolioLast4 ? 'จัดการการต่ออายุ' : 'แจ้งเลขพอร์ตหุ้น'} <ArrowRight size={16} /></button><a className="account-secondary" href="/">กลับไปสแกนหุ้น</a></div></section><section className="account-card account-steps"><span className="account-kicker">MEMBER JOURNEY</span><h3>ขั้นตอนการใช้งาน</h3><div><article><span>01</span><strong>เข้าสู่ระบบ LINE</strong><small>ระบุตัวตนในทุกอุปกรณ์</small></article><article><span>02</span><strong>แจ้งเลขพอร์ต</strong><small>เริ่มทดลอง 14 วันหนึ่งครั้งต่อพอร์ต</small></article><article><span>03</span><strong>ต่ออายุรายเดือน</strong><small>แอดมินตรวจและเปิดสิทธิ หรือออกโค้ดให้</small></article></div></section></>}
          {section === 'ai-credits' && <AiCreditsPanel quota={data?.aiQuota} onRefresh={refresh} />}
          {section === 'portfolio' && <section className="account-card"><div className="account-section-heading"><span className="account-icon cyan"><Wallet size={24} /></span><div><span className="account-kicker">BROKERAGE ACCOUNT</span><h2>บัญชีหุ้นของคุณ</h2><p>กรอกชื่อโบรกเกอร์และเลขพอร์ตที่ใช้สมัคร</p></div></div>{account.portfolioLast4 ? <div className="account-record"><BadgeCheck size={20} /><div><strong>{account.broker} ·••{account.portfolioLast4}</strong><span>{account.portfolioStatus === 'verified' ? 'แอดมินตรวจสอบแล้ว' : 'แจ้งแล้ว · รอแอดมินตรวจสอบ'}</span></div></div> : <form className="account-form" onSubmit={event => { event.preventDefault(); action('/api/account', { action: 'portfolio', broker, number: portfolio }, 'แจ้งเลขพอร์ตแล้ว เริ่มทดลองใช้ฟรี 14 วัน'); }}><label>โบรกเกอร์<input value={broker} onChange={event => setBroker(event.target.value)} required maxLength={40} placeholder="เช่น KASIKORN SECURITIES" /></label><label>เลขพอร์ตหุ้น<input value={portfolio} onChange={event => setPortfolio(event.target.value)} required minLength={5} maxLength={30} autoComplete="off" placeholder="เลขบัญชีซื้อขายหลักทรัพย์" /></label><button className="account-primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'แจ้งเลขพอร์ตและเริ่มทดลอง'} <ArrowRight size={16} /></button></form>}<p className="account-fineprint">ระบบเก็บแฮชและ 4 หลักท้ายของเลขพอร์ต แอดมินต้องมีเลขเต็มจากหลักฐานภายนอกมาเทียบก่อนยืนยัน ไม่เชื่อมบัญชีเพื่อส่งคำสั่งเทรด</p></section>}
          {section === 'renewal' && <><section className="account-card"><div className="account-section-heading"><span className="account-icon gold"><CalendarClock size={24} /></span><div><span className="account-kicker">MONTHLY ACCESS</span><h2>ต่ออายุสมาชิก</h2><p>สถานะปัจจุบัน: {rights.label}{rights.expiresAt ? ` · สิ้นสุด ${date(rights.expiresAt)}` : ''}</p></div></div><div className="account-renewal-grid"><div className="account-renewal-option"><span className="account-kicker">ทางเลือก 01</span><h3>ขอต่ออายุผ่านแอดมิน</h3><p>แอดมินตรวจบัญชีหุ้นและการชำระเงินจากช่องทางที่ตกลงกัน แล้วเปิดสิทธิรายเดือนให้</p><button className="account-primary" disabled={busy || account.portfolioStatus !== 'verified' || account.renewalPending} onClick={() => action('/api/account', { action: 'renewal' }, 'ส่งคำขอต่ออายุแล้ว รอแอดมินตรวจสอบ')}>{account.renewalPending ? 'ส่งคำขอแล้ว · รอตรวจ' : 'ส่งคำขอต่ออายุ'} <ArrowRight size={15} /></button></div><div className="account-renewal-option"><span className="account-kicker">ทางเลือก 02</span><h3>ใช้โค้ดรายเดือน</h3><p>โค้ดออกโดยแอดมินให้บัญชีที่ยืนยันแล้ว ใช้ได้ครั้งเดียวและผูกกับบัญชีนี้</p><form onSubmit={event => { event.preventDefault(); action('/api/account', { action: 'redeem', code }, 'ใช้โค้ดสำเร็จ เพิ่มสิทธิรายเดือนแล้ว'); }}><input value={code} onChange={event => setCode(event.target.value)} placeholder="NUG-••••••••••••••••••••••••" aria-label="โค้ดรายเดือน" required /><button className="account-secondary" disabled={busy || account.portfolioStatus !== 'verified'}>ใช้โค้ด</button></form></div></div><p className="account-fineprint">ขณะนี้ระบบรับคำขอและอนุมัติแบบแอดมิน ยังไม่มีหน้าจ่ายเงินออนไลน์หรือการหักเงินอัตโนมัติ</p></section></>}
          {section === 'profile' && <section className="account-card"><div className="account-section-heading"><span className="account-icon cyan"><UserRound size={24} /></span><div><span className="account-kicker">PROFILE</span><h2>โปรไฟล์</h2></div></div><div className="account-profile"><span className="account-profile-avatar"><MemberAvatar account={account} size={58} /></span><div><strong>{account.displayName}</strong><span>เชื่อมต่อ LINE แล้ว</span></div></div><div className="account-record"><ShieldCheck size={20} /><div><strong>ข้อมูลพอร์ตที่บันทึก</strong><span>{account.portfolioLast4 ? `${account.broker} ·••${account.portfolioLast4} · ${account.portfolioStatus === 'verified' ? 'ยืนยันแล้ว' : 'รอตรวจ'}` : 'ยังไม่แจ้งเลขพอร์ต'}</span></div></div><button className="account-secondary" onClick={logout} disabled={busy}><LogOut size={16} /> ออกจากระบบ</button></section>}
        </>}
      </>}
    </main></div><footer className="account-footer"><span>© 2026 Nugaom AI Pick</span><span>ข้อมูลตลาดเพื่อการศึกษา · ผู้ใช้ตัดสินใจลงทุนเอง</span></footer>
  </div>;
}
