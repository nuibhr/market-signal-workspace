'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import MarketNavigation from './market-navigation.jsx';
import { Activity, Bell, BookOpen, CalendarDays, CandlestickChart, ChartNoAxesCombined, ChevronDown, CircleHelp, Compass, Gauge, GraduationCap, LayoutDashboard, LockKeyhole, Newspaper, Radar, RefreshCw, Search, ShieldCheck, Sparkles, Star, Wallet } from 'lucide-react';
import MemberAvatar from './member-avatar.jsx';
import { ALL_ASSETS } from '../markets/catalog.mjs';

// Keep every destination in one map so desktop and mobile expose the same tools.
const GROUPS = [
  { id: 'today', label: 'เริ่มวันนี้', icon: Compass, items: [['overview', 'หน้าต้อนรับ', LayoutDashboard], ['daily', 'สำรวจวันนี้', Radar], ['autopick', 'จังหวะที่ระบบพบ', Bell]] },
  { id: 'explore', label: 'สำรวจราคา', icon: CandlestickChart, items: [['watchlist', 'มุมโฟกัส', Star], ['search', 'ค้นหาสินทรัพย์', Search], ['chart', 'กราฟและตัวชี้วัด', CandlestickChart], ['analysis-tools', 'ชุดสแกนเชิงลึก', Activity], ['signals', 'แผนจากกราฟ', Sparkles]] },
  { id: 'context', label: 'ก่อนตัดสินใจ', icon: Newspaper, items: [['news', 'ข่าวไทยและสหรัฐฯ', Newspaper], ['calendar', 'วันข่าวเศรษฐกิจ', CalendarDays], ['dividends', 'ปันผลและ XD', CalendarDays], ['news-guide', 'อ่านข่าวอย่างไร', BookOpen]] },
  { id: 'plan', label: 'ผลสัญญาณ', icon: Wallet, items: [['results', 'ผลงานสัญญาณ', ChartNoAxesCombined], ['financial', 'คำนวณความเสี่ยง', Gauge]] },
  { id: 'more', label: 'เพิ่มเติม', icon: CircleHelp, items: [['learn', 'วิธีเริ่มใช้', GraduationCap], ['roadmap', 'สถานะระบบ', Compass]] },
];

export function WorkspaceSidebar({ marketId, activeNav, onNavigate, rights, account, loginHref = '/account', hasRealBars, favoriteCount }) {
  const [expanded, setExpanded] = useState(['today', 'explore']);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const group = GROUPS.find(item => item.items.some(([id]) => id === activeNav));
    if (group) setExpanded(current => current.includes(group.id) ? current : [...current, group.id]);
  }, [activeNav]);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);
  const toggle = id => setExpanded(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const mobileNavigate = id => { setMobileOpen(false); onNavigate(id); };
  const isGuest = rights?.tier === 'guest' || !rights;
  return <><aside className="sidebar hub-sidebar">
    <div className="hub-sidebar-scroll">
      <Link href="/" className="brand" aria-label="Nugaom กลับเลือกตลาด"><div className="brand-mark"><Image src="/nugaom-mascot.png" width={52} height={52} alt="มาสคอต Nugaom AI Pick" /></div><div><strong>Nugaom</strong><small>AI PICK · พื้นที่ดูตลาด</small></div></Link>
      <a className="hub-account-card" href={loginHref}><span className="hub-account-avatar"><MemberAvatar account={isGuest ? null : account} size={40} /></span><span><strong>{isGuest ? 'เริ่มด้วย LINE' : account?.displayName || 'มุมสมาชิกของฉัน'}</strong><small>{isGuest ? 'เชื่อมบัญชี · แจ้งพอร์ต · ทดลอง 14 วัน' : rights?.label}</small></span><span className="hub-account-arrow">↗</span></a>
      <MarketNavigation current={marketId}/><div className="hub-sidebar-caption">เครื่องมือประจำตลาด</div>
      <nav className="hub-group-list" aria-label="เมนูหลัก">
        {GROUPS.map((group, index) => <section key={group.id} className="hub-menu-group"><button className="hub-group-toggle" aria-expanded={expanded.includes(group.id)} onClick={() => toggle(group.id)}><span className="hub-group-index">0{index + 1}</span><span className="hub-nav-glyph"><group.icon size={17} strokeWidth={1.9} /></span><span>{group.label}</span><ChevronDown size={14} className={expanded.includes(group.id) ? 'hub-chevron open' : 'hub-chevron'} /></button>{expanded.includes(group.id) && <div className="hub-group-items">{group.items.map(([id, label, Icon]) => <button key={id} className={activeNav === id ? 'hub-subnav active' : 'hub-subnav'} onClick={() => onNavigate(id)}><Icon size={15} strokeWidth={1.9} /><span>{label}</span>{id === 'watchlist' && favoriteCount > 0 && <em>{favoriteCount}</em>}{id === 'analysis-tools' && <em>3 เครื่องมือ</em>}</button>)}</div>}</section>)}
      </nav>
      <div className="engine-card"><div className="engine-heading">สถานะข้อมูล <span className={hasRealBars ? 'real-pill' : 'demo-pill'}>{hasRealBars ? 'OHLC จริง' : 'รอฟีด'}</span></div><p>ราคาและผลสัญญาณแสดงเฉพาะข้อมูลที่เชื่อมได้ พร้อมที่มาและเวลา</p></div>
    </div>
    <div className="sidebar-foot">NUGAOM <span>ทุกวัน เริ่มจากข้อมูล</span></div>
  </aside><nav className="hub-mobile-dock" aria-label="เมนูมือถือ"><button className={activeNav === 'overview' ? 'active' : ''} onClick={() => onNavigate('overview')}><LayoutDashboard size={20} /><span>วันนี้</span></button><button className={activeNav === 'daily' ? 'active' : ''} onClick={() => onNavigate('daily')}><Radar size={20} /><span>สำรวจ</span></button><button className={activeNav === 'autopick' ? 'active' : ''} onClick={() => onNavigate('autopick')}><Bell size={20} /><span>จังหวะ</span></button><a className="hub-mobile-line" href={loginHref}><span className="hub-line-icon">LINE</span><span>{isGuest ? 'เข้า LINE' : 'บัญชี'}</span></a><button onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen}><Compass size={20} /><span>ทั้งหมด</span></button></nav>{mobileOpen && <div className="hub-mobile-scrim" onClick={() => setMobileOpen(false)}><div className="hub-mobile-sheet" role="dialog" aria-modal="true" aria-label="เครื่องมือทั้งหมดของ Nugaom" onClick={event => event.stopPropagation()}><div className="hub-mobile-sheet-head"><strong>เครื่องมือทั้งหมด</strong><button onClick={() => setMobileOpen(false)} aria-label="ปิดเมนู">×</button></div><a className="hub-mobile-membership" href={loginHref}><span className="hub-line-icon">LINE</span><span>{isGuest ? 'เข้าสู่ระบบด้วย LINE · ทดลอง 14 วัน' : `มุมสมาชิก · ${rights?.label}`}</span><span>↗</span></a><MarketNavigation current={marketId}/>{GROUPS.map((group, index) => <div key={group.id} className="hub-mobile-group"><strong>0{index + 1} / {group.label}</strong><div>{group.items.map(([id, label, Icon]) => <button key={id} className={activeNav === id ? 'active' : ''} onClick={() => mobileNavigate(id)}><Icon size={18} />{label}</button>)}</div></div>)}</div></div>}</>;
}

const PRESETS = [
  { id: 'leaders', label: 'หุ้นใหญ่', symbols: ['PTT', 'AOT', 'CPALL', 'ADVANC', 'GULF', 'DELTA'] },
  { id: 'banks', label: 'ธนาคาร', symbols: ['KBANK', 'SCB', 'BBL', 'KTB', 'TTB', 'TISCO'] },
  { id: 'dr', label: 'DR เทค', symbols: ['AAPL80', 'NVDA80', 'MSFT80', 'GOOG80', 'AMD80', 'META80'] },
];

function formatTimestamp(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function DailyDesk({ favorites, onSelect, rights, marketId='thai' }) {
  const [preset, setPreset] = useState(marketId==='dr'?'dr':'leaders');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const favoriteSymbols = useMemo(() => favorites.filter(symbol => ALL_ASSETS.some(item => item.symbol === symbol && item.feed === 'settrade-daily'&&item.id===marketId)).slice(0, 8), [favorites,marketId]);
  const choices = preset === 'favorites' ? favoriteSymbols : PRESETS.find(item => item.id === preset)?.symbols ?? PRESETS[0].symbols;
  async function runScan() {
    if (!choices.length || busy) return;
    setBusy(true); setError(''); setReport(null);
    try {
      const response = await fetch(`/api/daily-scan?symbols=${encodeURIComponent(choices.join(','))}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) { setError(payload.code === 'SOURCE_NOT_CONFIGURED' ? 'ยังไม่ได้ตั้งค่าแหล่งข้อมูล Settrade บนเซิร์ฟเวอร์' : payload.code === 'DISPLAY_RIGHTS_NOT_CONFIRMED' ? 'สิทธิแสดงข้อมูล Settrade บนเว็บยังไม่ยืนยัน' : payload.code === 'AUTH_FAILED' ? 'Settrade ปฏิเสธการเข้าสู่ระบบ กรุณาตรวจสิทธิและข้อมูลเชื่อมต่อ' : `สแกนไม่ได้: ${payload.code ?? 'SOURCE_UNAVAILABLE'}`); return; }
      setReport(payload);
    } catch { setError('เชื่อมเซิร์ฟเวอร์สแกนไม่ได้ กรุณาลองใหม่'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!rights?.capabilities?.manualDailyScan) return;
    let stopped = false;
    fetch('/api/daily-scan?saved=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (!stopped && d?.status === 'complete') setReport(d); }).catch(() => {});
    return () => { stopped = true; };
  }, [rights?.capabilities?.manualDailyScan]);
  const reportRows=(report?.results??[]).filter(r=>ALL_ASSETS.some(a=>a.symbol===r.symbol&&a.id===marketId));
  const available = reportRows.filter(item => item.status === 'available');
  return <section id="section-daily" className="daily-desk" aria-labelledby="daily-desk-title">
    <div className="daily-desk-heading"><span className="hub-heading-icon"><Radar size={21} /></span><div><span className="eyebrow">DAILY ROUTINE / SETTRADE 1D</span><h2 id="daily-desk-title">สแกนตลาดวันนี้</h2><p>เลือกชุดสินทรัพย์ อ่านเงื่อนไขจากแท่งรายวัน แล้วเปิดกราฟเพื่อตรวจด้วยตัวเอง</p></div><span className="daily-membership-link"><ShieldCheck size={14} /> {rights?.label ?? 'กำลังอ่านสิทธิ'}</span></div>
    <div className="daily-desk-controls"><div className="daily-presets" role="group" aria-label="ชุดสินทรัพย์สำหรับสแกน">{PRESETS.filter(p=>marketId==='dr'?p.id==='dr':p.id!=='dr').map(item => <button key={item.id} className={preset === item.id ? 'selected' : ''} onClick={() => { setPreset(item.id); setReport(null); }}>{item.label}</button>)}<button className={preset === 'favorites' ? 'selected' : ''} onClick={() => { setPreset('favorites'); setReport(null); }}>★ คู่โปรด {favoriteSymbols.length}</button></div>{rights?.capabilities?.manualDailyScan ? <button className="daily-run" disabled={busy || !choices.length} onClick={runScan}><RefreshCw size={15} className={busy ? 'spin' : ''} />{busy ? 'กำลังสแกน…' : 'สแกนวันนี้'}</button> : <a className="daily-run" href="/account"><LockKeyhole size={15} />เปิดสิทธิสแกน</a>}</div>
    <div className="daily-symbols">{choices.length ? choices.map(symbol => <span key={symbol}>{symbol}</span>) : <span>ยังไม่มีคู่โปรดจากฟีด Settrade — ปักหมุดใน Watchlist ก่อน</span>}</div>
    {busy && <div className="daily-loading" aria-busy="true"><span className="ui-skeleton-line" /><span className="ui-skeleton-line" /><span className="ui-skeleton-line" /></div>}
    {error && <div className="daily-callout" role="status"><CircleHelp size={17} /><span>{error} · ยังไม่มีผลสแกนสำหรับชุดนี้</span></div>}
    {reportRows.length > 0 && <><div className="daily-result-head"><span><b>{available.length}</b> / {reportRows.length} อ่านแท่งได้</span><span>สแกน {formatTimestamp(report.scannedAt)} · แท่ง 1D</span></div><div className="daily-results">{reportRows.map(item => { const asset = ALL_ASSETS.find(candidate => candidate.symbol === item.symbol && candidate.feed === 'settrade-daily'); return <div className="daily-result" key={item.symbol}><div><strong>{item.symbol}</strong><small>{item.latestDay ? `${item.latestDay} · ${item.freshness === 'recent' ? 'ล่าสุด' : 'ข้อมูลเก่า'}` : item.code ?? 'ไม่มีข้อมูลล่าสุด'}</small></div><span className={item.trend === 'up' ? 'daily-trend up' : item.trend === 'down' ? 'daily-trend down' : 'daily-trend'}>{item.status !== 'available' ? 'ไม่มีฟีด' : item.freshness !== 'recent' ? 'ข้อมูลเก่า' : item.trend === 'up' ? 'ขึ้น' : item.trend === 'down' ? 'ลง' : 'แกว่ง'}</span><span className="daily-price">{typeof item.price === 'number' ? item.price.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—'}</span><span className="daily-event">{item.status === 'available' && item.freshness !== 'recent' ? 'ตรวจข้อมูลล่าสุดก่อนใช้' : item.conditions?.[0]?.label ?? (item.status === 'available' ? 'ยังไม่มีเงื่อนไขเด่น' : 'รอแหล่งข้อมูล')}</span><span className="daily-plan-summary"><b>{item.summary?.score == null ? 'ไม่มีคะแนน' : `${item.summary.score}/100 · ${item.summary.label}`}</b><small>{item.summary?.text}</small></span><button disabled={!asset || item.status !== 'available'} onClick={() => onSelect(asset)}>เปิดกราฟ ↗</button></div>; })}</div></>}
    {!reportRows.length && !busy && !error && <div className="daily-empty"><Compass size={19} /><span>เริ่มจากชุดหุ้นที่สนใจ แล้วกด “สแกนวันนี้”</span></div>}
    <div className="daily-desk-foot"><span>ข้อมูลจาก Settrade เมื่อเชื่อมต่อและได้รับสิทธิแสดงผล · คะแนนเทคนิคจากกติกา 5 ข้อ ไม่ใช่เปอร์เซ็นต์ชนะ</span></div>
  </section>;
}

export function FinancialCheck() {
  const [capital, setCapital] = useState('100000');
  const [risk, setRisk] = useState('1');
  const [entry, setEntry] = useState('100');
  const [stop, setStop] = useState('95');
  const budget = Number(capital) * Number(risk) / 100;
  const gap = Math.abs(Number(entry) - Number(stop));
  const valid = Number(capital) > 0 && Number(risk) > 0 && Number(risk) <= 100 && Number(entry) > 0 && Number(stop) > 0 && gap > 0;
  const units = valid ? Math.floor(budget / gap) : 0;
  return <div className="hub-panel financial-panel"><div className="hub-intro"><span className="hub-heading-icon"><Gauge size={23} /></span><div><h3>Financial Check · หุ้นไทย</h3><p>คำนวณจำนวนหุ้นจากเงินที่ยอมเสียได้ต่อหนึ่งแผน ใช้สำหรับวางกรอบความเสี่ยง</p></div></div><div className="financial-form"><label>เงินทุน (บาท) <input type="number" min="0" value={capital} onChange={event => setCapital(event.target.value)} /></label><label>ความเสี่ยงต่อแผน (%) <input type="number" min="0" max="100" step="0.1" value={risk} onChange={event => setRisk(event.target.value)} /></label><label>ราคาเข้า (บาท/หุ้น) <input type="number" min="0" step="any" value={entry} onChange={event => setEntry(event.target.value)} /></label><label>จุดหยุดขาดทุน (บาท/หุ้น) <input type="number" min="0" step="any" value={stop} onChange={event => setStop(event.target.value)} /></label></div><div className="financial-results"><div><small>ขาดทุนสูงสุดตามแผน</small><strong>{valid ? budget.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</strong></div><div><small>ระยะห่าง Entry → SL</small><strong>{valid ? gap.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—'}</strong></div><div><small>จำนวนหุ้นโดยประมาณ</small><strong>{valid ? units.toLocaleString('en-US') : '—'}</strong></div></div><p className="modal-footnote">ใช้สำหรับหุ้นไทยแบบหนึ่งหุ้นต่อหนึ่งหน่วยเท่านั้น · ยังไม่ปัด board lot และไม่รวมค่าธรรมเนียม/สลิปเพจ · TFEX, Forex และหุ้นต่างประเทศต้องมีตัวคูณสัญญา สเปรด และอัตราแลกเปลี่ยนก่อนคำนวณ · คำนวณในเบราว์เซอร์</p></div>;
}

export function LearningPanel({ onOpen }) {
  const lessons = [
    ['01', 'เลือกตลาดและสินทรัพย์', 'ใช้ Watchlist หรือค้นหาสัญลักษณ์ ดูแหล่งข้อมูลก่อนอ่านราคา', 'search'],
    ['02', 'สแกนด้วยกติกา', 'เลือกชุดหุ้น เปิดสแกนรายวัน แล้วตรวจเงื่อนไขที่ปรากฏ', 'daily'],
    ['03', 'ยืนยันหลายกรอบเวลา', 'เทียบแนวโน้ม 15m ถึง 1D และอ่านแนวรับแนวต้าน', 'multi-tf'],
    ['04', 'กำหนดความเสี่ยง', 'วาง Entry และ Stop ก่อนคำนวณจำนวนหน่วย', 'financial'],
    ['05', 'ทบทวนผล', 'ดูราคาเข้า ราคาออก และผลของสัญญาณที่ระบบบันทึกจริง', 'results'],
  ];
  return <div className="hub-panel learning-panel"><div className="hub-intro"><span className="hub-heading-icon"><GraduationCap size={23} /></span><div><h3>เส้นทางใช้งานประจำวัน</h3><p>เริ่มจากข้อมูลที่มีที่มา ตรวจกราฟ แล้วค่อยวางแผนความเสี่ยง</p></div></div><div className="learning-steps">{lessons.map(([num, title, copy, target]) => <button key={num} onClick={() => onOpen(target)}><em>{num}</em><span><strong>{title}</strong><small>{copy}</small></span><span>↗</span></button>)}</div><div className="daily-callout"><CircleHelp size={17} /><span>สัญญาณและกราฟเป็นเครื่องมือช่วยอ่านตลาด ตรวจแหล่งข้อมูลและเวลาของแท่งทุกครั้งก่อนใช้ประกอบการตัดสินใจ</span></div></div>;
}

export function RoadmapPanel({ onOpen }) {
  const items = [
    ['นำร่อง', 'สแกนรายวันและ AutoPick หุ้นไทย', 'อ่านแท่ง Settrade ได้ในเครื่อง · ต้องยืนยันสิทธิข้อมูล เซิร์ฟเวอร์ถาวร และผลรันวันทำการก่อนเปิดให้สมาชิก', 'autopick'],
    ['พร้อมใช้', 'Watchlist + กราฟ + วิเคราะห์เทคนิค', 'บันทึกคู่โปรดในเครื่อง เปิดกราฟและตรวจเงื่อนไขจากแท่งที่เชื่อมได้', 'watchlist'],
    ['พร้อมตั้งค่า', 'บัญชี LINE และสิทธิสมาชิก', 'ทดลอง 14 วัน ตรวจพอร์ต และต่ออายุผ่านแอดมิน · รอค่า LINE และฐานข้อมูลถาวร', 'account'],
    ['ขั้นถัดไป', 'ชำระเงินอัตโนมัติ', 'ปัจจุบันแอดมินตรวจและอนุมัติการต่ออายุ · ระบบชำระเงินอัตโนมัติยังไม่เชื่อม', 'account'],
    ['นำร่อง', 'แจ้งเตือนในเว็บ', 'บันทึกเหตุการณ์เข้า/TP/SL และแสดงขณะเปิดเว็บ · ต้องยืนยันความเสถียรและการอ่านย้อนหลัง', 'autopick'],
    ['บันทึกผล', 'ผลงานสัญญาณ', 'สรุป 100 ไม้ที่ปิดล่าสุดจากราคาเข้า/ออกที่บันทึกไว้ · ไม้รอเข้าและข้อมูลไม่ครบไม่นับเป็นชนะหรือแพ้', 'results'],
    ['บางส่วน', 'ข่าว ปฏิทินเศรษฐกิจ และ XD', 'ข่าวไทย/สหรัฐฯ จาก MarketDX · วันประกาศและตัวเลขสหรัฐฯ จาก FRED · XD เปิดดูต้นทาง SET', 'calendar'],
    ['รอข้อมูล', 'TFEX · Forex AutoPick', 'TFEX มีกราฟ OHLC แล้ว แต่ยังต้องยืนยันสัญญานำและกติกาความเสี่ยง · Forex รอฟีด bid/ask กับแท่งจริง', 'autopick'],
    ['ขั้นถัดไป', 'ช่องคุยกับทีมและชุมชน', 'ซ่อนหน้าจอสนทนา DEMO แล้ว · ต้องมีระบบส่งข้อความและทีมรับจริงก่อนเปิดเมนู', 'learn'],
  ];
  return <div className="hub-panel roadmap-panel"><div className="hub-intro"><span className="hub-heading-icon"><Compass size={23} /></span><div><h3>สถานะระบบและสิ่งที่ยังขาด</h3><p>รายการนี้ช่วยแยกของที่ใช้ได้ตอนนี้ออกจากงาน fullstack ที่ต้องเชื่อมก่อนเปิดจริง</p></div></div><div className="roadmap-list">{items.map(([status, title, copy, target]) => <button key={title} onClick={() => onOpen(target)}><span className={status === 'พร้อมใช้' ? 'roadmap-state ready' : 'roadmap-state'}>{status}</span><span><strong>{title}</strong><small>{copy}</small></span><span>↗</span></button>)}</div></div>;
}

export function CalendarPanel({ onOpenGuide }) {
  const [state, setState] = useState({ status: 'loading', releases: [], indicators: [] });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/macro', { signal: controller.signal, cache: 'no-store' })
      .then(response => response.json())
      .then(data => { if (!controller.signal.aborted) setState(data); })
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'unavailable', releases: [], indicators: [] }); });
    return () => controller.abort();
  }, [revision]);
  const dateLabel = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('th-TH', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
  const ready = ['available', 'partial', 'stale'].includes(state.status);
  return <div className="hub-panel community-panel fred-calendar">
    <div className="fred-heading"><span className="hub-heading-icon"><CalendarDays size={23} /></span><div><h3>วันประกาศเศรษฐกิจสหรัฐฯ</h3><p>วันประกาศและตัวเลขล่าสุดจาก FRED · อ่านคู่กับข่าวหุ้นและกราฟ</p></div><button className="feature-refresh" onClick={() => { setState(current => ({ ...current, status: 'loading' })); setRevision(value => value + 1); }} aria-label="โหลดข้อมูลเศรษฐกิจใหม่"><RefreshCw size={15} /> โหลดใหม่</button></div>
    <p className="fred-legal">This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis. <a href="https://fred.stlouisfed.org/docs/api/terms_of_use.html" target="_blank" rel="noopener noreferrer">FRED API Terms of Use ↗</a></p>
    {state.status === 'loading' && <div className="fred-message" role="status">กำลังอ่านข้อมูลจาก FRED…</div>}
    {!ready && state.status !== 'loading' && <div className="fred-message" role="status">{state.status === 'unconfigured' ? 'ยังไม่ได้ตั้งค่าคีย์ FRED บนเซิร์ฟเวอร์' : state.code === 'DISPLAY_RIGHTS_UNCONFIRMED' ? 'รอยืนยันสิทธิการแสดงข้อมูล FRED ต่อสมาชิก' : 'ข้อมูล FRED ยังไม่พร้อม ลองโหลดใหม่ภายหลัง'}</div>}
    {ready && <>
      {state.status === 'stale' && <div className="fred-message" role="status">แสดงข้อมูลล่าสุดที่เก็บไว้ เพราะ FRED ตอบกลับไม่ได้ชั่วคราว</div>}
      {state.status === 'partial' && <div className="fred-message" role="status">ข้อมูลบางชุดยังไม่พร้อม แสดงเฉพาะชุดที่ดึงได้</div>}
      <div className="fred-section-head"><strong>ตัวเลขล่าสุดที่เผยแพร่แล้ว</strong><small>วันที่ใต้ตัวเลขคือช่วงข้อมูล ไม่ใช่เวลาเผยแพร่</small></div>
      <div className="fred-indicators">{state.indicators?.map(item => <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="fred-indicator"><span>{item.label}</span><strong>{item.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}{item.suffix}</strong><small>ข้อมูล {dateLabel(item.observationDate)} · {item.id} ↗</small></a>)}</div>
      <div className="fred-section-head"><strong>วันประกาศที่กำลังจะมาถึง</strong><small>วันที่ตามปฏิทินสหรัฐฯ · ไม่ระบุชั่วโมง</small></div>
      {state.releases?.length ? <div className="fred-release-list">{state.releases.map(item => <a href={item.url} target="_blank" rel="noopener noreferrer" key={item.id}><span className="fred-release-date">{dateLabel(item.date)}</span><strong>{item.label}</strong><small>ดูต้นทาง FRED ↗</small></a>)}</div> : <div className="fred-message">ยังไม่มีวันประกาศใน 45 วันข้างหน้าจากชุดข้อมูลที่ติดตาม</div>}
      <p className="fred-source">FRED · Federal Reserve Bank of St. Louis · ดึงล่าสุด {state.receivedAt ? new Date(state.receivedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) : '—'}</p>
    </>}
    <div className="daily-callout"><CircleHelp size={17} /><span>FRED ให้วันประกาศและค่าที่เผยแพร่แล้ว ไม่ใช่ฟีดพาดหัวข่าว ไม่มีค่า forecast หรือเวลาออกข่าวในข้อมูลชุดนี้ วันประกาศอาจเปลี่ยนได้และข้อมูลอาจถูกปรับย้อนหลัง</span></div>
    <div className="calendar-source-links"><a href="https://www.bot.or.th/en/our-roles/monetary-policy/mpc-meeting.html" target="_blank" rel="noopener noreferrer">ธปท. · กำหนดประชุม กนง. ↗</a><a href="https://www.bls.gov/schedule/" target="_blank" rel="noopener noreferrer">BLS · เวลาออกข่าวสหรัฐฯ ↗</a></div>
    <button className="feature-primary" onClick={onOpenGuide}>อ่านวิธีใช้ข่าวประกอบกราฟ ↗</button>
  </div>;
}

export function DividendCalendarPanel() {
  return <div className="hub-panel community-panel"><span className="hub-heading-icon"><CalendarDays size={23} /></span><h3>ปันผลหุ้นไทย · XD</h3><p>ดูวันขึ้น XD, วันกำหนดสิทธิ, วันจ่าย และจำนวนเงินต่อหุ้นจากปฏิทินหลักทรัพย์ของ SET ได้โดยตรง ข้อมูลบางรายการอาจยังเป็นกำหนดการเบื้องต้น ให้ตรวจประกาศล่าสุดก่อนใช้วางแผน</p><a className="feature-primary" href="https://www.set.or.th/th/market/stock-calendar/x-calendar" target="_blank" rel="noopener noreferrer">เปิดปฏิทิน XD ของ SET ↗</a><div className="daily-callout"><CircleHelp size={17} /><span>ตอนนี้แอปยังไม่ดึงรายการ XD มาคัดกรองหรือแจ้งเตือนอัตโนมัติ ต้องได้ฟีด Corporate Action และสิทธิแสดงผลก่อน</span></div></div>;
}
