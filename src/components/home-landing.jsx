import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, BellRing, Bookmark, ChartNoAxesCombined, Check, ScanLine, ShieldCheck } from 'lucide-react';
import LandingRobot from './landing-robot.jsx';
import ProductsShowcase from './products-showcase.jsx';
import MobileDock from './mobile-dock.jsx';
import '../app/landing.css';

const markets = [
  { id: 'thai', number: '01', name: 'หุ้นไทย', en: 'THAI EQUITIES', detail: 'จากหุ้นที่สนใจ สู่จังหวะที่มีแผน', tags: 'สแกนตลาด · สัญญาณ · หุ้นโปรด · ปันผล', tone: '#c8e3a0', glyph: 'TH' },
  { id: 'dr', number: '02', name: 'DR', en: 'GLOBAL, CLOSE TO HOME', detail: 'ติดตามสินทรัพย์โลก ในกระดานของคุณ', tags: 'Strategy Tracker · Camarilla · Indicative Bridge', tone: '#edd5a3', glyph: 'DR' },
  { id: 'tfex', number: '03', name: 'TFEX', en: 'FUTURES WORKSPACE', detail: 'มองกราฟ แยกสัญญา จับภาพตลาด', tags: 'กราฟ · ซีรีส์สัญญา · เครื่องมือวิเคราะห์', tone: '#e9bfb1', glyph: 'FX' },
  { id: 'us', number: '04', name: 'หุ้นสหรัฐฯ & Global ETFs', en: 'US 500 & THEMATIC ETFS', detail: 'สแกนหุ้นผู้นำ Stage 2 และเมกะเทรนด์โลก', tags: 'Stage 2 Leaders · ETF Rotation · USD/THB Hedge', tone: '#38bdf8', glyph: 'US' },
  { id: 'forex', number: '05', name: 'Forex / CFD', en: 'VANTAGE MT5 COMMAND CENTER', detail: 'ค้นหาตลาด และเชื่อมข้อมูลจาก Vantage MT5', tags: 'Scanner · กราฟ · เครื่องมือจัดการความเสี่ยง', tone: '#cbc1df', glyph: '↔' },
];

export default function HomeLanding() {
  return <main className="ng-landing">
    <a className="ng-skip" href="#discover">ข้ามไปเลือกตลาด</a>
    <header className="ng-header">
      <Link href="/" className="ng-brand" aria-label="Nugaom AI Pick หน้าแรก"><Image src="/nugaom-mascot.png" width={40} height={40} alt="" priority /><span>NUGAOM<small>AI PICK / MARKET INTELLIGENCE</small></span></Link>
      <nav aria-label="เมนูหลัก">
        <Link href="/us" style={{ color: '#38bdf8', fontWeight: '800', background: 'rgba(56, 189, 248, 0.12)', padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.35)' }}>🇺🇸 หุ้นสหรัฐฯ &amp; ETFs</Link>
        <Link href="/dr" style={{ color: '#f59e0b', fontWeight: '800', background: 'rgba(245, 158, 11, 0.12)', padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>🎯 DR Strategy</Link>
        <Link href="/tfex" style={{ color: '#ff9970', fontWeight: '800' }}>⚡ TFEX</Link>
        <Link href="/thai" style={{ color: '#72dfb3', fontWeight: '800' }}>🇹🇭 หุ้นไทย</Link>
        <a href="#discover">เลือกตลาด</a>
        <a href="#products-suite">ผลิตภัณฑ์ทั้งหมด</a>
        <a href="#pro-analysis-suite" style={{ color: '#0284c7', fontWeight: '700' }}>เครื่องมือสถาบัน ⚡</a>
        <Link href="/thai#section-results">ผลงานสัญญาณ</Link>
        <Link href="/community">ชุมชนและทีม</Link>
      </nav>
      <Link href="/account" className="ng-login">เข้าใช้ด้วย LINE / ทดลอง <ArrowUpRight size={16} aria-hidden="true" /></Link>
    </header>
    <div style={{ maxWidth: '1200px', margin: '14px auto 0', padding: '0 20px' }}>
      <div style={{ background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.18) 0%, rgba(168, 85, 247, 0.18) 100%)', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '16px', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ background: '#38bdf8', color: '#0f172a', fontWeight: '900', fontSize: '11px', padding: '3px 8px', borderRadius: '6px' }}>NEW LAUNCH</span>
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff' }}>เปิดตัวศูนย์บัญชาการหุ้นสหรัฐฯ S&amp;P 500 &amp; Thematic ETFs (Stage 2 Leaderboard) แล้ว!</span>
        </div>
        <Link href="/us" style={{ background: '#38bdf8', color: '#0f172a', fontWeight: '800', fontSize: '13px', padding: '8px 18px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
          เปิดโต๊ะ US 500 &amp; Thematic ETFs ทันที <span>→</span>
        </Link>
      </div>
    </div>
    <LandingRobot />
    <div className="ng-principles"><span><ScanLine size={15} /> เห็นเงื่อนไขก่อนตัดสินใจ</span><span><BellRing size={15} /> ติดตามสัญญาณผ่านเว็บ</span><span><ShieldCheck size={15} /> ทบทวนจากบันทึกเข้า–ออก</span></div>

    <section id="discover" className="ng-section ng-markets" tabIndex={-1} aria-labelledby="ng-markets-title">
      <div className="ng-section-heading"><div><span className="ng-kicker">01 / FIND YOUR FOCUS</span><h2 id="ng-markets-title">คนละตลาด<br /><span>จังหวะในแบบคุณ</span></h2></div><p>แยกพื้นที่ให้โฟกัสได้ง่ายขึ้น<br />เลือกตลาด แล้วไปต่อกับเครื่องมือที่คุณคุ้นเคย</p></div>
      <div className="ng-market-grid">{markets.map(market => <Link key={market.id} href={`/${market.id}`} className={`ng-market ng-market-${market.id}`} style={{ '--market-tint': market.tone }}>
        <div className="ng-market-top"><span>{market.number} / {market.en}</span><ArrowUpRight size={22} /></div>
        <div className="ng-market-art" aria-hidden="true"><span>{market.glyph}</span><svg viewBox="0 0 360 110"><path d="M0 93 35 82 58 91 92 54 121 67 155 37 180 51 211 23 239 40 274 15 300 31 335 10 360 15" /><path d="M0 108 360 108M0 71 360 71M0 35 360 35" className="ng-art-grid" /></svg></div>
        <div className="ng-market-copy"><h3>{market.name}</h3><p>{market.detail}</p><small>{market.tags}</small></div>
      </Link>)}</div>
      <p className="ng-data-note">ความสามารถและความถี่ข้อมูลต่างกันในแต่ละตลาด · โฟกัสหลักที่กระดานหุ้นไทยและ DR · Forex / CFD แยก Demo จากข้อมูลที่รับผ่าน MT5 · TFEX และ Forex AutoPick ยังไม่เปิดใช้งาน</p>
    </section>

    {/* Section 02: Products & Analysis Suite */}
    <ProductsShowcase />

    <section id="how-it-works" className="ng-section ng-process" tabIndex={-1} aria-labelledby="ng-process-title">
      <div className="ng-section-heading"><div><span className="ng-kicker">03 / FROM SIGNAL TO STORY</span><h2 id="ng-process-title">ไม่จบที่สัญญาณ<br /><span>เห็นเส้นทางของทุกจังหวะ</span></h2></div><Link href="/thai#section-auto-pick" className="ng-text-link">เปิดกระดานสัญญาณ <ArrowUpRight size={18} /></Link></div>
      <div className="ng-process-grid">
        <div className="ng-signal-preview" aria-label="ภาพอธิบายขั้นตอนสัญญาณ ไม่ใช่รายการซื้อขายจริง">
          <div className="ng-preview-head"><span><i /> SIGNAL JOURNEY</span><small>ภาพอธิบายการทำงาน</small></div>
          <div className="ng-orbit" aria-hidden="true"><div className="ng-orbit-ring" /><div className="ng-orbit-ring ng-orbit-ring-two" /><Image src="/nugaom-mascot.png" width={138} height={138} alt="" /><span className="ng-orbit-tag">น้องนักออม AI</span></div>
          <ol className="ng-journey"><li><span>01</span><div><b>รอเข้า</b><small>พบแผนที่เข้าเงื่อนไขสแกน</small></div></li><li><span>02</span><div><b>เข้าเงื่อนไข</b><small>บันทึกราคาและเวลาเข้าสัญญาณ</small></div><BellRing size={18} /></li><li><span>03</span><div><b>ปิดผล</b><small>ถึงเป้า ตัดขาดทุน หรือครบเงื่อนไขออก</small></div><Check size={18} /></li></ol>
        </div>
        <div className="ng-features">
          <article><span className="ng-feature-icon"><ScanLine /></span><div><h3>ให้ระบบช่วยคัด ให้คุณตัดสินใจ</h3><p>ติดตามจังหวะที่เข้าเงื่อนไข พร้อมจุดเข้า เป้าหมาย และจุดตัดขาดทุน เปิดกราฟดูบริบทก่อนตัดสินใจด้วยตัวเอง</p></div></article>
          <article><span className="ng-feature-icon"><BellRing /></span><div><h3>จังหวะสำคัญ มีเสียงบอก</h3><p>แจ้งเตือนผ่านหน้าเว็บเมื่อสัญญาณเปลี่ยนสถานะ เปิดเสียงในแอปเพื่อให้น้องนักออมช่วยอ่านเหตุการณ์ให้ฟัง</p><small>ต้องเปิดหน้าเว็บและอนุญาตเสียง การแจ้งเตือนขึ้นกับข้อมูลที่ระบบได้รับ</small></div></article>
          <article><span className="ng-feature-icon"><ChartNoAxesCombined /></span><div><h3>เปิดดูผลงานได้ทั้งฝั่งชนะและแพ้</h3><p>ทบทวนผลจากราคาเข้า–ออกที่ระบบบันทึก แยกสัญญาณที่ยังรอเข้า และแยกผลจำลองย้อนหลังให้ดูได้ชัดเจน</p></div></article>
          <article><span className="ng-feature-icon"><Bookmark /></span><div><h3>พื้นที่สำหรับหุ้นที่คุณสนใจ</h3><p>บันทึกหุ้นโปรด กลับมาดูกราฟและแผนได้ง่าย พร้อมผู้ช่วย AI สำหรับถามต่อจากข้อมูลในระบบ</p></div></article>
        </div>
      </div>
    </section>

    <section className="ng-section ng-start" aria-labelledby="ng-start-title"><div><span className="ng-kicker">04 / MAKE IT YOUR SPACE</span><h2 id="ng-start-title">เปิดมุมมองใหม่<br />ให้การลงทุนของคุณ</h2><p>ใช้บัญชี LINE ของคุณเริ่มต้น<br />แล้วเลือกตลาดที่อยากติดตาม</p><div className="ng-actions"><Link href="/account" className="ng-button ng-button-dark">เริ่มต้นด้วย LINE <ArrowUpRight size={20} /></Link><a href="#discover" className="ng-text-link">สำรวจเครื่องมือก่อน →</a></div></div><div className="ng-start-note"><span>NUGAOM / AI PICK</span><p>ข้อมูลช่วยให้เห็นภาพ<br />แผนช่วยให้มีทิศทาง<br /><b>การตัดสินใจเป็นของคุณ</b></p><span>RESEARCH. PLAN. REFLECT.</span></div></section>

    <section className="ng-section ng-faq" aria-labelledby="ng-faq-title"><div><span className="ng-kicker">GOOD TO KNOW</span><h2 id="ng-faq-title">ก่อนเริ่มใช้งาน</h2></div><div>
      <details><summary>ระบบส่งคำสั่งซื้อขายให้หรือไม่?</summary><p>แอปนี้ใช้สแกน วิเคราะห์ และแจ้งเตือน ไม่มีการส่งคำสั่งซื้อขายแทนคุณ สัญญาณเป็นข้อมูลประกอบการตัดสินใจ</p></details>
      <details><summary>ราคาที่เห็นเป็นเรียลไทม์ทุกตลาดไหม?</summary><p>แต่ละตลาดใช้แหล่งข้อมูลและช่วงเวลาต่างกัน ตรวจแหล่งข้อมูล เวลาอัปเดต และกรอบเวลาที่แสดงในหน้าตลาดก่อนใช้งาน ความถี่สแกนไม่ได้ทำให้ข้อมูลล่าช้ากลายเป็นข้อมูลเรียลไทม์</p></details>
      <details><summary>ผลงานสัญญาณกับพอร์ตโค้ชต่างกันอย่างไร?</summary><p>ผลงานสัญญาณนับจากรายการและราคาเข้า–ออกที่ระบบบันทึก ส่วนผลจำลองและพอร์ตโค้ชแบบ Paper Trade แสดงป้ายแยกไว้ ผลย้อนหลังไม่ได้รับประกันผลในอนาคต</p></details>
      <details><summary>เข้าสู่ระบบและเริ่มทดลองอย่างไร?</summary><p>กดเข้าใช้ด้วย LINE แล้วทำขั้นตอนในหน้าบัญชีให้ครบ ตรวจสถานะทดลองใช้ 14 วันและสิทธิสมาชิกได้จากหน้านั้น</p></details>
    </div></section>
    <footer className="ng-footer"><div><Link href="/" className="ng-footer-brand">NUGAOM AI PICK<span>YOUR MARKET. YOUR MOMENT.</span></Link><div><a href="#discover">เลือกตลาด</a><Link href="/thai">หุ้นไทย</Link><Link href="/dr">DR</Link><Link href="/tfex">TFEX</Link><Link href="/us">หุ้นสหรัฐฯ &amp; ETFs</Link><Link href="/forex">Forex / CFD</Link><Link href="/community">ชุมชนและทีม</Link><Link href="/coaches">พอร์ตโค้ช · Paper</Link><Link href="/account">บัญชีของฉัน</Link></div></div><p>เครื่องมือช่วยวิเคราะห์ ไม่ใช่คำแนะนำในการลงทุน การลงทุนมีความเสี่ยง ผู้ใช้งานควรศึกษาข้อมูลและตัดสินใจด้วยตนเอง</p><small>© {new Date().getFullYear()} Nugaom AI Pick <span>3D: Nugaom / Three.js · <a href="/landing-pages/licenses/THREE-LICENSE">MIT License</a></span></small></footer>

    {/* Mobile Navigation Dock */}
    <MobileDock />
  </main>;
}
