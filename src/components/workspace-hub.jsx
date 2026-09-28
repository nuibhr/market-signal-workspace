'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Activity, Bell, BookOpen, CalendarDays, CandlestickChart, ChartNoAxesCombined, ChevronDown, CircleHelp, Clock3, Compass, FlaskConical, Gauge, GraduationCap, LayoutDashboard, LockKeyhole, MessageCircle, Newspaper, Radar, RefreshCw, Search, ShieldCheck, Sparkles, Star, TrendingUp, Wallet, Waves } from 'lucide-react';
import { ALL_ASSETS } from '../markets/catalog.mjs';

const GROUPS = [
  { id: 'analysis', label: 'วิเคราะห์ตลาด', icon: ChartNoAxesCombined, items: [['overview', 'ภาพรวมตลาด', LayoutDashboard], ['daily', 'สแกนวันนี้', Radar], ['analysis-tools', 'สแกน · Multi-TF · Volume', Search], ['signals', 'แผนสัญญาณ', Sparkles]] },
  { id: 'trade', label: 'ระบบเทรด', icon: Activity, items: [['autopick', 'AutoPick · แจ้งเตือน', Bell], ['terminal', 'สมุดแผน · DEMO', Wallet], ['history', 'ประวัติ · DEMO', Clock3], ['stats', 'สถิติ · DEMO', ChartNoAxesCombined]] },
  { id: 'markets', label: 'ตลาด', icon: TrendingUp, items: [['watchlist', 'Watchlist', Star], ['search', 'ค้นหาสินทรัพย์', Search], ['chart', 'กราฟราคา', CandlestickChart]] },
  { id: 'lab', label: 'MY LAB', icon: FlaskConical, items: [['financial', 'Financial Check', Gauge]] },
  { id: 'news', label: 'ข่าวสาร & เศรษฐกิจ', icon: Newspaper, items: [['news', 'ข่าวตลาด', Newspaper], ['calendar', 'ปฏิทินเศรษฐกิจ', CalendarDays], ['dividends', 'ปันผลหุ้นไทย · XD', CalendarDays], ['news-guide', 'คู่มืออ่านข่าว', BookOpen]] },
  { id: 'community', label: 'ชุมชน', icon: MessageCircle, items: [['community', 'พื้นที่ชุมชน', MessageCircle], ['contact', 'ติดต่อทีม · DEMO', CircleHelp]] },
  { id: 'learn', label: 'เรียนรู้', icon: GraduationCap, items: [['learn', 'เริ่มต้นใช้งาน', BookOpen], ['roadmap', 'แผนพัฒนาระบบ', Compass]] },
];

export function WorkspaceSidebar({ activeNav, onNavigate, rights, hasRealBars, favoriteCount }) {
  const [expanded, setExpanded] = useState(['analysis', 'trade', 'markets']);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggle = id => setExpanded(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const mobileNavigate = id => { setMobileOpen(false); onNavigate(id); };
  return <><aside className="sidebar hub-sidebar">
    <div className="hub-sidebar-scroll">
      <div className="brand"><div className="brand-mark"><Image src="/nugaom-mascot.png" width={52} height={52} alt="มาสคอต Nugaom AI Pick" /></div><div><strong>Nugaom AI Pick</strong><small>MARKET INTELLIGENCE</small></div></div>
      <button className="hub-account-card" onClick={() => onNavigate('account')}><span className="hub-account-avatar"><Image src="/nugaom-mascot.png" width={40} height={40} alt="" /></span><span><strong>บัญชีของฉัน</strong><small>{rights?.label ?? 'กำลังอ่านสิทธิ…'}</small></span><ShieldCheck size={16} /></button>
      <div className="hub-sidebar-caption">WORKSPACE</div>
      <nav className="hub-group-list" aria-label="เมนูหลัก">
        {GROUPS.map(group => <section key={group.id} className="hub-menu-group"><button className="hub-group-toggle" aria-expanded={expanded.includes(group.id)} onClick={() => toggle(group.id)}><span className="hub-nav-glyph"><group.icon size={17} strokeWidth={1.9} /></span><span>{group.label}</span><ChevronDown size={14} className={expanded.includes(group.id) ? 'hub-chevron open' : 'hub-chevron'} /></button>{expanded.includes(group.id) && <div className="hub-group-items">{group.items.map(([id, label, Icon]) => <button key={id} className={activeNav === id ? 'hub-subnav active' : 'hub-subnav'} onClick={() => onNavigate(id)}><Icon size={15} strokeWidth={1.9} /><span>{label}</span>{id === 'watchlist' && favoriteCount > 0 && <em>{favoriteCount}</em>}{id === 'analysis-tools' && <em>3-in-1</em>}</button>)}</div>}</section>)}
      </nav>
      <div className="engine-card"><div className="engine-heading">DATA STATUS <span className={hasRealBars ? 'real-pill' : 'demo-pill'}>{hasRealBars ? 'REAL OHLC' : 'MIXED'}</span></div><p>หุ้นไทย / DR: Settrade · หุ้นสหรัฐฯ 1D: FMP EOD<br />สถิติผลลัพธ์: DEMO · สแกนด้วยกติกา</p></div>
    </div>
    <div className="sidebar-foot">NUGAOM AI PICK <span>v0.4</span></div>
  </aside><nav className="hub-mobile-dock" aria-label="เมนูมือถือ"><button onClick={() => onNavigate('overview')}><LayoutDashboard size={18} /><span>ภาพรวม</span></button><button onClick={() => onNavigate('daily')}><Radar size={18} /><span>สแกน</span></button><button onClick={() => onNavigate('analysis-tools')}><Search size={18} /><span>วิเคราะห์</span></button><button onClick={() => onNavigate('watchlist')}><Star size={18} /><span>คู่โปรด</span></button><button onClick={() => setMobileOpen(true)}><Compass size={18} /><span>เมนู</span></button></nav>{mobileOpen && <div className="hub-mobile-scrim" onClick={() => setMobileOpen(false)}><div className="hub-mobile-sheet" role="dialog" aria-modal="true" aria-label="เมนู Nugaom AI Pick" onClick={event => event.stopPropagation()}><div className="hub-mobile-sheet-head"><strong>Nugaom AI Pick</strong><button onClick={() => setMobileOpen(false)} aria-label="ปิดเมนู">×</button></div><button className="hub-mobile-membership" onClick={() => mobileNavigate('account')}><ShieldCheck size={16} /> บัญชีของฉัน · {rights?.label ?? 'กำลังอ่านสิทธิ'}</button>{GROUPS.map(group => <div key={group.id} className="hub-mobile-group"><strong>{group.label}</strong><div>{group.items.map(([id, label, Icon]) => <button key={id} onClick={() => mobileNavigate(id)}><Icon size={16} />{label}</button>)}</div></div>)}</div></div>}</>;
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

export function DailyDesk({ favorites, onSelect, rights }) {
  const [preset, setPreset] = useState('leaders');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const favoriteSymbols = useMemo(() => favorites.filter(symbol => ALL_ASSETS.some(item => item.symbol === symbol && item.feed === 'settrade-daily')).slice(0, 8), [favorites]);
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
  const available = report?.results?.filter(item => item.status === 'available') ?? [];
  return <section id="section-daily" className="daily-desk" aria-labelledby="daily-desk-title">
    <div className="daily-desk-heading"><span className="hub-heading-icon"><Radar size={21} /></span><div><span className="eyebrow">DAILY ROUTINE / SETTRADE 1D</span><h2 id="daily-desk-title">สแกนตลาดวันนี้</h2><p>เลือกชุดสินทรัพย์ อ่านเงื่อนไขจากแท่งรายวัน แล้วเปิดกราฟเพื่อตรวจด้วยตัวเอง</p></div><span className="daily-membership-link"><ShieldCheck size={14} /> {rights?.label ?? 'กำลังอ่านสิทธิ'}</span></div>
    <div className="daily-desk-controls"><div className="daily-presets" role="group" aria-label="ชุดสินทรัพย์สำหรับสแกน">{PRESETS.map(item => <button key={item.id} className={preset === item.id ? 'selected' : ''} onClick={() => { setPreset(item.id); setReport(null); }}>{item.label}</button>)}<button className={preset === 'favorites' ? 'selected' : ''} onClick={() => { setPreset('favorites'); setReport(null); }}>★ คู่โปรด {favoriteSymbols.length}</button></div>{rights?.capabilities?.manualDailyScan ? <button className="daily-run" disabled={busy || !choices.length} onClick={runScan}><RefreshCw size={15} className={busy ? 'spin' : ''} />{busy ? 'กำลังสแกน…' : 'สแกนวันนี้'}</button> : <a className="daily-run" href="/account"><LockKeyhole size={15} />เปิดสิทธิสแกน</a>}</div>
    <div className="daily-symbols">{choices.length ? choices.map(symbol => <span key={symbol}>{symbol}</span>) : <span>ยังไม่มีคู่โปรดจากฟีด Settrade — ปักหมุดใน Watchlist ก่อน</span>}</div>
    {busy && <div className="daily-loading" aria-busy="true"><span className="ui-skeleton-line" /><span className="ui-skeleton-line" /><span className="ui-skeleton-line" /></div>}
    {error && <div className="daily-callout" role="status"><CircleHelp size={17} /><span>{error} · ยังไม่มีผลสแกนสำหรับชุดนี้</span></div>}
    {report && <><div className="daily-result-head"><span><b>{available.length}</b> / {report.results.length} อ่านแท่งได้</span><span>สแกน {formatTimestamp(report.scannedAt)} · แท่ง 1D</span></div><div className="daily-results">{report.results.map(item => { const asset = ALL_ASSETS.find(candidate => candidate.symbol === item.symbol && candidate.feed === 'settrade-daily'); return <div className="daily-result" key={item.symbol}><div><strong>{item.symbol}</strong><small>{item.latestDay ? `${item.latestDay} · ${item.freshness === 'recent' ? 'ล่าสุด' : 'ข้อมูลเก่า'}` : item.code ?? 'ไม่มีข้อมูลล่าสุด'}</small></div><span className={item.trend === 'up' ? 'daily-trend up' : item.trend === 'down' ? 'daily-trend down' : 'daily-trend'}>{item.status !== 'available' ? 'ไม่มีฟีด' : item.freshness !== 'recent' ? 'ข้อมูลเก่า' : item.trend === 'up' ? 'ขึ้น' : item.trend === 'down' ? 'ลง' : 'แกว่ง'}</span><span className="daily-price">{typeof item.price === 'number' ? item.price.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—'}</span><span className="daily-event">{item.status === 'available' && item.freshness !== 'recent' ? 'ตรวจข้อมูลล่าสุดก่อนใช้' : item.conditions?.[0]?.label ?? (item.status === 'available' ? 'ยังไม่มีเงื่อนไขเด่น' : 'รอแหล่งข้อมูล')}</span><button disabled={!asset || item.status !== 'available'} onClick={() => onSelect(asset)}>เปิดกราฟ ↗</button></div>; })}</div></>}
    {!report && !busy && !error && <div className="daily-empty"><Compass size={19} /><span>เริ่มจากชุดหุ้นที่สนใจ แล้วกด “สแกนวันนี้”</span></div>}
    <div className="daily-desk-foot"><span>ข้อมูลจาก Settrade เมื่อเชื่อมต่อและได้รับสิทธิแสดงผล · ไม่มีคะแนน AI หรืออัตราชนะที่ยังไม่ได้วัด</span></div>
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
    ['05', 'ทบทวนผล', 'บันทึกแผนและแยกข้อมูลตัวอย่างออกจากผลจริง', 'terminal'],
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
    ['บางส่วน', 'ข่าว ปฏิทินเศรษฐกิจ และ XD', 'ข่าวไทย/สหรัฐฯ มีฟีด · ปฏิทินเศรษฐกิจยังไม่มีรายการในเว็บ · XD เปิดดูต้นทาง SET ได้', 'calendar'],
    ['รอข้อมูล', 'TFEX · Forex · Nasdaq-100 AutoPick', 'ต้องมีแท่ง intraday เวลาต้นทาง รายชื่อ/สัญญาปัจจุบัน และต้นทุนเทรดของแต่ละตลาด', 'autopick'],
    ['ขั้นถัดไป', 'ชุมชนและบทเรียน', 'โปรไฟล์ การกลั่นกรองเนื้อหา และคอร์สที่มีข้อมูลอ้างอิง', 'learn'],
  ];
  return <div className="hub-panel roadmap-panel"><div className="hub-intro"><span className="hub-heading-icon"><Compass size={23} /></span><div><h3>สถานะระบบและสิ่งที่ยังขาด</h3><p>รายการนี้ช่วยแยกของที่ใช้ได้ตอนนี้ออกจากงาน fullstack ที่ต้องเชื่อมก่อนเปิดจริง</p></div></div><div className="roadmap-list">{items.map(([status, title, copy, target]) => <button key={title} onClick={() => onOpen(target)}><span className={status === 'พร้อมใช้' ? 'roadmap-state ready' : 'roadmap-state'}>{status}</span><span><strong>{title}</strong><small>{copy}</small></span><span>↗</span></button>)}</div></div>;
}

export function CommunityPanel({ onOpenContact }) {
  return <div className="hub-panel community-panel"><span className="hub-heading-icon"><MessageCircle size={23} /></span><h3>พื้นที่ชุมชน</h3><p>ตอนนี้ยังไม่มีโพสต์หรือห้องสนทนาสมาชิกในระบบ Nugaom AI Pick การเปิดชุมชนจริงต้องมีบัญชีผู้ใช้ กติกาเนื้อหา และเครื่องมือดูแลข้อความ</p><button className="feature-primary" onClick={onOpenContact}>ดูช่องทางติดต่อใน DEMO ↗</button></div>;
}

export function CalendarPanel({ onOpenGuide }) {
  return <div className="hub-panel community-panel"><span className="hub-heading-icon"><CalendarDays size={23} /></span><h3>ปฏิทินเศรษฐกิจ · รอฟีดข้อมูล</h3><p>ยังไม่มีรายการเหตุการณ์เศรษฐกิจในแอปที่ตรวจเวลา ประเทศ ความสำคัญ และตัวเลขก่อนหน้า/คาดการณ์/จริงได้ ขณะนี้แสดงทางไปยังปฏิทินของหน่วยงานต้นทางเพื่อให้ตรวจข้อมูลได้ทันที</p><div className="calendar-source-links"><a href="https://www.bot.or.th/en/our-roles/monetary-policy/mpc-meeting.html" target="_blank" rel="noopener noreferrer">ธปท. · กำหนดประชุม กนง. ↗</a><a href="https://www.bls.gov/schedule/2026/" target="_blank" rel="noopener noreferrer">BLS · กำหนดประกาศข้อมูลสหรัฐฯ ↗</a></div><div className="daily-callout"><CircleHelp size={17} /><span>เวลาในเว็บต้นทางอาจใช้คนละโซนเวลา เมื่อมีฟีดที่มีสิทธิแสดงผล จะจัดเวลาเป็น Asia/Bangkok และแสดงสถานะข้อมูลล่าสุดในแอป</span></div><button className="feature-primary" onClick={onOpenGuide}>อ่านวิธีใช้ข่าวประกอบกราฟ ↗</button></div>;
}

export function DividendCalendarPanel() {
  return <div className="hub-panel community-panel"><span className="hub-heading-icon"><CalendarDays size={23} /></span><h3>ปันผลหุ้นไทย · XD</h3><p>ดูวันขึ้น XD, วันกำหนดสิทธิ, วันจ่าย และจำนวนเงินต่อหุ้นจากปฏิทินหลักทรัพย์ของ SET ได้โดยตรง ข้อมูลบางรายการอาจยังเป็นกำหนดการเบื้องต้น ให้ตรวจประกาศล่าสุดก่อนใช้วางแผน</p><a className="feature-primary" href="https://www.set.or.th/th/market/stock-calendar/x-calendar" target="_blank" rel="noopener noreferrer">เปิดปฏิทิน XD ของ SET ↗</a><div className="daily-callout"><CircleHelp size={17} /><span>ตอนนี้แอปยังไม่ดึงรายการ XD มาคัดกรองหรือแจ้งเตือนอัตโนมัติ ต้องได้ฟีด Corporate Action และสิทธิแสดงผลก่อน</span></div></div>;
}
