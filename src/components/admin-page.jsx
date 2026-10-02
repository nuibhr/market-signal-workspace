'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Activity, ArrowLeft, Check, CircleAlert, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { AdminCreditGrant } from './ai-credits-panel.jsx';

const ERRORS = {
  FORBIDDEN: 'บัญชีนี้ไม่มีสิทธิผู้ดูแล', PORTFOLIO_MISMATCH: 'เลขพอร์ตไม่ตรงกับที่สมาชิกแจ้ง',
  REQUEST_UNAVAILABLE: 'รายการนี้ถูกจัดการไปแล้ว กรุณารีเฟรช', INVALID_CREDIT_AMOUNT: 'เครดิตต้องเป็นจำนวนเต็ม 1–1,000',
  SYSTEM_STATUS_UNAVAILABLE: 'อ่านสถานะระบบสแกนไม่ได้',
};
const MARKET_NAMES = { thai: 'หุ้นไทย', dr: 'DR', us: 'หุ้นสหรัฐฯ', tfex: 'TFEX', forex: 'Forex' };
const goodStatus = new Set(['active', 'healthy', 'running', 'outside-session', 'complete']);
function date(value) { return value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }) : '—'; }

export default function AdminPage() {
  const [tab, setTab] = useState('members');
  const [memberships, setMemberships] = useState(null);
  const [system, setSystem] = useState(null);
  const [numbers, setNumbers] = useState({});
  const [issuedCode, setIssuedCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const [memberResult, systemResult] = await Promise.allSettled([
      fetch('/api/admin/memberships', { cache: 'no-store' }),
      fetch('/api/admin/system', { cache: 'no-store' }),
    ]);
    if (memberResult.status === 'fulfilled' && memberResult.value.ok) setMemberships(await memberResult.value.json());
    else setError('โหลดรายชื่อสมาชิกไม่ได้ กรุณารีเฟรช');
    if (systemResult.status === 'fulfilled' && systemResult.value.ok) setSystem(await systemResult.value.json());
    else setSystem(null);
    setLoading(false);
  }, []);
  useEffect(() => { refresh().catch(() => { setError('โหลดข้อมูลหลังบ้านไม่ได้'); setLoading(false); }); }, [refresh]);

  async function act(body, success) {
    setBusy(true); setError(''); setMessage(''); setIssuedCode('');
    try {
      const response = await fetch('/api/admin/memberships', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok) { setError(ERRORS[payload.error] || 'ทำรายการไม่สำเร็จ'); return; }
      setMemberships(payload);
      setMessage(success);
      if (payload.code) setIssuedCode(payload.code);
      if (body.action === 'verify' || body.action === 'reject-portfolio') {
        setNumbers(current => { const next = { ...current }; delete next[body.memberId]; return next; });
      }
    } catch { setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); }
    finally { setBusy(false); }
  }

  const members = memberships?.members ?? [];
  const renewals = memberships?.renewals ?? [];
  const pendingPortfolios = members.filter(member => member.portfolio_status !== 'verified');

  return <div className="account-page admin-page">
    <header className="account-topbar"><a href="/" className="account-brand"><span><Image src="/nugaom-mascot.png" width={38} height={38} alt="" /></span><span><strong>Nugaom AI Pick</strong><small>OPERATIONS</small></span></a><a className="account-back" href="/account"><ArrowLeft size={16} /> บัญชีของฉัน</a></header>
    <div className="account-hero"><div className="account-hero-inner"><span className="account-kicker">ADMIN / OPERATIONS</span><h1>หลังบ้าน<em>ผู้ดูแล</em></h1><p>ตรวจสมาชิก ต่ออายุ และดูความพร้อมของระบบแจ้งเตือน</p></div></div>
    <div className="account-layout"><aside className="account-nav"><span className="account-nav-label">งานผู้ดูแล</span><button className={tab === 'members' ? 'selected' : ''} onClick={() => setTab('members')}><ShieldCheck size={17} />สมาชิกและสิทธิ {pendingPortfolios.length + renewals.length > 0 && <i>{pendingPortfolios.length + renewals.length}</i>}</button><button className={tab === 'system' ? 'selected' : ''} onClick={() => setTab('system')}><Activity size={17} />ระบบสแกน</button><a className="admin-nav-link" href="/account"><ArrowLeft size={17} />กลับหน้าบัญชี</a></aside>
      <main className="account-main" aria-live="polite">
        {error && <div className="account-alert error" role="alert"><CircleAlert size={17} />{error}</div>}
        {message && <div className="account-alert success" role="status"><Check size={17} />{message}</div>}
        {loading ? <div className="account-card account-skeleton"><span /><span /><span /></div> : tab === 'members' ? <>
          <section className="account-card"><div className="account-section-heading"><span className="account-icon gold"><ShieldCheck size={24} /></span><div><span className="account-kicker">MEMBERSHIP</span><h2>สมาชิกและสิทธิ</h2><p>สิทธิผู้ดูแลผูกกับ LINE user ID บนเซิร์ฟเวอร์</p></div></div>
            <div className="admin-metrics"><div><span>รอตรวจพอร์ต</span><strong>{pendingPortfolios.length}</strong></div><div><span>รอต่ออายุ</span><strong>{renewals.length}</strong></div><div><span>สมาชิกที่แจ้งพอร์ต</span><strong>{members.length}</strong></div></div>
            <div className="account-admin-head"><h3>บัญชีที่แจ้งพอร์ต</h3><button className="account-secondary" disabled={busy} onClick={refresh}><RefreshCw size={15} /> รีเฟรช</button></div>
            {members.length ? members.map(member => <div className="account-admin-row" key={member.id}><div><strong>{member.display_name}</strong><span>{member.broker} ·••{member.portfolio_last4} · {member.portfolio_status === 'verified' ? 'ตรวจแล้ว' : 'รอตรวจ'} · ทดลองถึง {date(member.trial_ends_at)}</span><span>สมาชิกถึง {date(member.subscription_ends_at)}</span></div><AdminCreditGrant member={member} busy={busy} onGrant={(memberId, amount) => act({ action: 'grant-ai-credits', memberId, amount }, 'เพิ่มเครดิต AI แล้ว')} />{member.portfolio_status !== 'verified' ? <div className="account-admin-review"><form onSubmit={event => { event.preventDefault(); act({ action: 'verify', memberId: member.id, number: numbers[member.id] }, 'ยืนยันเลขพอร์ตแล้ว'); }}><input aria-label={`เลขพอร์ตเต็มของ ${member.display_name}`} placeholder="เลขพอร์ตเต็มเพื่อเทียบ" value={numbers[member.id] || ''} onChange={event => setNumbers(value => ({ ...value, [member.id]: event.target.value }))} required autoComplete="off" /><button className="account-secondary" disabled={busy}>ตรวจตรงกัน</button></form><button className="account-secondary" disabled={busy} onClick={() => act({ action: 'reject-portfolio', memberId: member.id }, 'ปฏิเสธเลขพอร์ตแล้ว สมาชิกแจ้งใหม่ได้')}>ปฏิเสธ</button></div> : <button className="account-secondary" disabled={busy} onClick={() => act({ action: 'issue-code', memberId: member.id }, 'ออกโค้ดรายเดือนแล้ว')}><KeyRound size={15} /> ออกโค้ด</button>}</div>) : <p className="account-empty">ยังไม่มีบัญชีที่แจ้งพอร์ต</p>}
            {issuedCode && <div className="account-issued" role="status"><strong>โค้ดใหม่ · แสดงครั้งเดียว</strong><code>{issuedCode}</code><span>ส่งให้สมาชิกผ่านช่องทางที่ผู้ดูแลรับผิดชอบ</span></div>}
            <div className="account-admin-head"><h3>คำขอต่ออายุที่รอตรวจ</h3></div>{renewals.length ? renewals.map(item => <div className="account-admin-row" key={item.id}><div><strong>{item.display_name}</strong><span>{item.broker} ·••{item.portfolio_last4} · ขอเมื่อ {date(item.created_at)}</span></div><div className="account-admin-review"><button className="account-primary" disabled={busy} onClick={() => act({ action: 'approve-renewal', requestId: item.id }, 'อนุมัติต่ออายุรายเดือนแล้ว')}>ยืนยันรับชำระและเปิดสิทธิ</button><button className="account-secondary" disabled={busy} onClick={() => act({ action: 'reject-renewal', requestId: item.id }, 'ปฏิเสธคำขอแล้ว')}>ปฏิเสธ</button></div></div>) : <p className="account-empty">ไม่มีคำขอค้างตรวจ</p>}
            <p className="account-fineprint">ยืนยันเลขพอร์ตด้วยเลขเต็มจากหลักฐานภายนอก และอนุมัติต่ออายุเมื่อรับชำระเงินจริงแล้ว ระบบไม่ตรวจเงินอัตโนมัติ</p>
          </section>
        </> : <section className="account-card"><div className="account-section-heading"><span className="account-icon cyan"><Activity size={24} /></span><div><span className="account-kicker">SCANNER OPERATIONS</span><h2>ความพร้อมระบบสแกน</h2><p>อัปเดตล่าสุด {date(system?.updatedAt)}</p></div></div><button className="account-secondary" onClick={refresh} disabled={busy}><RefreshCw size={15} /> รีเฟรชสถานะ</button>
          {!system ? <p className="account-alert error">อ่านสถานะระบบไม่ได้ กรุณาตรวจเซิร์ฟเวอร์และรีเฟรช</p> : <><div className="admin-worker"><span>ตัวทำงานสแกน</span><strong className={system.workerProcess?.status === 'running' ? 'ok' : 'bad'}>{system.workerProcess?.status || 'ไม่ทราบ'}</strong><small>ติดต่อครั้งล่าสุด {date(system.workerProcess?.lastSeenAt)}</small></div><div className="admin-market-grid">{system.markets?.map(market => <article key={market.id} className="admin-market-card"><div><strong>{MARKET_NAMES[market.id] || market.label}</strong><span className={`admin-state ${goodStatus.has(market.status) ? 'ok' : 'bad'}`}>{market.status === 'active' ? 'พร้อมสแกน' : 'ยังไม่เปิดสแกน'}</span></div><p>{market.reason || market.mode || market.source}</p>{market.universeCount > 0 && <small>รายการ {market.universeCount} ตัว · {market.timeframe}</small>}{system.workers?.[market.id] && <small>สแกน: {system.workers[market.id].status} · ล่าสุด {date(system.workers[market.id].lastRunAt)}</small>}{system.coverage?.[market.id] && <small>รอบ {system.coverage[market.id].sessionKey} · ครบ {system.coverage[market.id].done + system.coverage[market.id].ineligible}/{system.coverage[market.id].expected} · ข้อมูลใช้ไม่ได้ {system.coverage[market.id].unavailable} · รอลองใหม่ {system.coverage[market.id].retry}</small>}{system.coverage?.[market.id]?.unavailableSymbols?.length > 0 && <details><summary>สินค้าที่ข้อมูลใช้ไม่ได้ ({system.coverage[market.id].unavailableSymbols.length})</summary><p>{system.coverage[market.id].unavailableSymbols.map(item => item.symbol).join(', ')}</p></details>}</article>)}</div><div className="account-admin-head"><h3>รอบสแกนล่าสุด</h3></div>{system.runs?.length ? <div className="admin-runs">{system.runs.map(run => <div key={run.id}><strong>{MARKET_NAMES[run.market] || run.market}</strong><span>{run.status} · ตรวจ {run.scanned} · พบแผน {run.candidates}</span><small>{date(run.finishedAt || run.startedAt)}{run.errorCode ? ` · ${run.errorCode}` : ''}</small></div>)}</div> : <p className="account-empty">ยังไม่มีรอบสแกน</p>}<p className="account-fineprint">ข้อมูลนี้แสดงสถานะการทำงานและความครบของแหล่งข้อมูล ไม่ใช่ผลตอบแทนหรือคำสั่งซื้อขาย</p></>}
        </section>}
      </main>
    </div><footer className="account-footer"><span>© 2026 Nugaom AI Pick</span><span>เฉพาะผู้ดูแลที่ได้รับสิทธิ</span></footer>
  </div>;
}
