import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeftRight,
  ArrowUpRight,
  BellRing,
  Bookmark,
  CandlestickChart,
  ChartNoAxesCombined,
  Check,
  Compass,
  ExternalLink,
  Globe,
  Globe2,
  Layers3,
  MessageCircle,
  Play,
  Radio,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import LandingRobot from './landing-robot.jsx';
import ProductsShowcase from './products-showcase.jsx';
import MobileDock from './mobile-dock.jsx';
import '../app/landing.css';

const markets = [
  {
    id: 'thai',
    number: '01',
    name: 'หุ้นไทย (SET100 & mai)',
    en: 'THAI EQUITY COMMAND DESK',
    badge: 'ยอดนิยม · SETTRADE API',
    detail: 'สแกนหุ้นขาขึ้น Stage 2 เรดาร์สัญญาณสด และเชื่อมต่อพอร์ตพันธมิตร บล.พาย (003) & บล.ทรีนีตี้ (022)',
    tags: 'Stage 2 Screener · Settrade API · หุ้นปันผล SETHD · บันทึกผลงาน 100 ไม้',
    tone: '#72dfb3',
    rgb: '114, 223, 179',
    glyph: 'TH',
    featured: true,
  },
  {
    id: 'dr',
    number: '02',
    name: 'DR หุ้นโลกกระดานไทย',
    en: 'GLOBAL DR STRATEGY TRACKER',
    badge: 'GLOBAL · AI SCORE 16',
    detail: 'ลงทุนหุ้นเทคโนโลยีระดับโลกผ่านกระดานไทยด้วยเงินบาท พร้อมระบบคำนวณ Indicative Arbitrage สด',
    tags: 'DR80 / DR23 · Camarilla 8 Levels · EMA 25/50/75 · Fair Value Bridge',
    tone: '#f2be62',
    rgb: '242, 190, 98',
    glyph: 'DR',
    featured: true,
  },
  {
    id: 'forex',
    number: '03',
    name: 'Forex & Gold CFD',
    en: 'VANTAGE MT5 COMMAND CENTER',
    badge: '24H LIVE · MT5 BRIDGE',
    detail: 'สแกนคู่เงินหลักและทองคำ (XAUUSD) ตลอด 24 ชั่วโมง เชื่อมต่อข้อมูล MT5 แบบ Read-Only ปลอดภัย 100%',
    tags: '24H Currency & Gold Scanner · MT5 Telemetry · Dynamic 2R Sizing',
    tone: '#bc9bff',
    rgb: '188, 155, 255',
    glyph: 'FX',
    featured: true,
  },
  {
    id: 'tfex',
    number: '04',
    name: 'TFEX Derivatives',
    en: 'FUTURES & OPTIONS WORKSPACE',
    badge: 'DERIVATIVES DESK',
    detail: 'อ่านโครงสร้างสัญญา SET50 Index Futures, Gold Online และ Silver แยกซีรีส์เดือนสัญญาชัดเจน',
    tags: 'S50 / GO / SVF · กราฟเทคนิค · ซีรีส์สัญญา · คำนวณหลักประกัน',
    tone: '#ff9970',
    rgb: '255, 153, 112',
    glyph: 'TF',
  },
  {
    id: 'us',
    number: '05',
    name: 'หุ้นสหรัฐฯ & Global ETFs',
    en: 'WALL STREET STAGE 2 DESK',
    badge: 'S&P 500 & ETFS',
    detail: 'เกาะติดหุ้นผู้นำตลาดสหรัฐฯ S&P 500, Nasdaq และ Thematic ETFs พร้อมตัวคำนวณความเสี่ยงค่าเงิน USD/THB',
    tags: 'Stage 2 Leaderboard · Sector Rotation · USD/THB FX Hedge',
    tone: '#38bdf8',
    rgb: '56, 189, 248',
    glyph: 'US',
  },
];

const OFFICIAL_CHANNELS = [
  {
    id: 'youtube',
    name: 'YouTube Official',
    handle: '@Noomnugaom',
    role: 'VIDEO RESEARCH & LIVE TRADING',
    desc: 'คลังวิดีโอเจาะลึกกราฟเทคนิค สอนใช้งานระบบสแกนหุ้นไทย DR Forex และไลฟ์วิเคราะห์จังหวะตลาดแบบเจาะลึกทุกสัปดาห์',
    href: 'https://www.youtube.com/@Noomnugaom',
    accent: '#ff3355',
    rgb: '255, 51, 85',
    badge: 'YOUTUBE CHANNEL',
    cta: 'เปิดช่อง YouTube @Noomnugaom',
    icon: Play,
  },
  {
    id: 'tiktok',
    name: 'TikTok Official',
    handle: '@noomnugaom',
    role: 'SHORT-FORM MARKET INSIGHTS',
    desc: 'สรุปจังหวะตลาดหุ้นไทย DR และเทคนิคอ่านกราฟไวภายใน 1 นาที อัปเดตเทรนด์การลงทุนและไอเดียเทรดสดใหม่ทุกวัน',
    href: 'https://www.tiktok.com/@noomnugaom',
    accent: '#00f2fe',
    rgb: '0, 242, 254',
    badge: 'TIKTOK CREATOR',
    cta: 'ติดตาม TikTok @noomnugaom',
    icon: Video,
  },
  {
    id: 'facebook',
    name: 'Facebook Official Page',
    handle: 'facebook.com/noomnugaom',
    role: 'DAILY MARKET UPDATES & COMMUNITY',
    desc: 'เพจหลักสำหรับติดตามบทวิเคราะห์ตลาดรายวัน สรุปข่าวเศรษฐกิจมหภาค และพูดคุยแลกเปลี่ยนมุมมองกับเพื่อนนักลงทุน',
    href: 'https://www.facebook.com/noomnugaom/',
    accent: '#38bdf8',
    rgb: '56, 189, 248',
    badge: 'FACEBOOK PAGE',
    cta: 'ไปที่เพจ Facebook Noom Nugaom',
    icon: MessageCircle,
  },
  {
    id: 'instagram',
    name: 'Instagram Official',
    handle: '@nnugaom',
    role: 'VISUAL CHARTS & INFOGUIDES',
    desc: 'อินโฟกราฟิกสรุปความรู้การเทรด แผนผังหุ้นขาขึ้น Stage 2 สรุปงบการเงินเข้าใจง่าย และไลฟ์สไตล์การลงทุนยุคใหม่',
    href: 'https://www.instagram.com/nnugaom',
    accent: '#f472b6',
    rgb: '244, 114, 182',
    badge: 'INSTAGRAM FEED',
    cta: 'ติดตาม Instagram @nnugaom',
    icon: Compass,
  },
];

export default function HomeLanding() {
  return (
    <main className="ng-landing">
      <a className="ng-skip" href="#discover">ข้ามไปเลือกตลาด</a>

      {/* Top Floating Liquid Glass Navigation Header */}
      <header className="ng-header">
        <Link href="/" className="ng-brand" aria-label="Nugaom AI Pick หน้าแรก">
          <div className="ng-brand-avatar">
            <Image src="/nugaom-mascot.png" width={42} height={42} alt="" priority />
          </div>
          <span>
            NUGAOM
            <small>AI PICK · MARKET INTELLIGENCE</small>
          </span>
        </Link>

        <nav className="ng-nav-capsule" aria-label="เมนูหลัก">
          {/* Trio Champions First: หุ้นไทย, DR, Forex */}
          <Link href="/thai" className="ng-nav-link is-featured nav-thai">
            <CandlestickChart size={16} />
            <span>หุ้นไทย</span>
            <em className="ng-nav-badge"><i />ยอดนิยม</em>
          </Link>
          <Link href="/dr" className="ng-nav-link is-featured nav-dr">
            <Globe2 size={16} />
            <span>DR</span>
            <em className="ng-nav-badge"><i />GLOBAL</em>
          </Link>
          <Link href="/forex" className="ng-nav-link is-featured nav-forex">
            <ArrowLeftRight size={16} />
            <span>Forex</span>
            <em className="ng-nav-badge"><i />24H LIVE</em>
          </Link>

          <span className="ng-nav-divider" aria-hidden="true" />

          {/* Secondary Markets & Tools */}
          <Link href="/tfex" className="ng-nav-link">
            <Layers3 size={15} />
            <span>TFEX</span>
          </Link>
          <Link href="/us" className="ng-nav-link">
            <ChartNoAxesCombined size={15} />
            <span>หุ้นสหรัฐฯ</span>
          </Link>
          <Link href="/risk" className="ng-nav-link nav-pro">
            <Sparkles size={15} />
            <span>Pro Suite</span>
          </Link>
          <a href="#products-suite" className="ng-nav-link">
            <span>ผลิตภัณฑ์</span>
          </a>
          <a href="#official-channels" className="ng-nav-link">
            <Globe size={15} />
            <span>ช่องทางติดต่อ</span>
          </a>
          <Link href="/community" className="ng-nav-link">
            <Users size={15} />
            <span>ชุมชน</span>
          </Link>
        </nav>

        <div className="ng-header-actions">
          <a
            href="https://noomnugaom.pages.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="ng-portal-pill"
            title="เว็บไซต์หลัก Noom Nugaom Official"
          >
            <Globe size={14} />
            <span>noomnugaom.pages.dev</span>
            <ExternalLink size={12} />
          </a>
          <Link href="/account" className="ng-login">
            <span>เข้าใช้ด้วย LINE</span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* Top Live Ecosystem Spotlight Strip */}
      <div className="ng-spotlight-wrap">
        <div className="ng-spotlight-strip">
          <div className="ng-spotlight-left">
            <span className="ng-spotlight-badge">
              <span className="ng-spotlight-dot" />
              LIVE ECOSYSTEM
            </span>
            <p className="ng-spotlight-text">
              ยกระดับศูนย์บัญชาการ <b>หุ้นไทย (Settrade API · บล.พาย &amp; ทรีนีตี้)</b> · <b>DR หุ้นโลก</b> · <b>Forex MT5</b> พร้อมระบบสแกนครบวงจร!
            </p>
          </div>
          <div className="ng-spotlight-actions">
            <Link href="/thai" className="ng-spotlight-cta-primary">
              เปิดกระดานหุ้นไทย <span>→</span>
            </Link>
            <Link href="/thai#section-portfolio" className="ng-spotlight-cta-secondary">
              เชื่อมพอร์ต / เปิดบัญชีพันธมิตร ↗
            </Link>
          </div>
        </div>
      </div>

      {/* 3D Interactive Robot Hero */}
      <LandingRobot />

      {/* Core Principles Bar */}
      <div className="ng-principles">
        <span><ScanLine size={16} /> เห็นเงื่อนไขชัดเจนก่อนตัดสินใจ</span>
        <span><BellRing size={16} /> เสียงแจ้งเตือนน้องนักออม AI ผ่านเว็บ</span>
        <span><ShieldCheck size={16} /> เชื่อมพอร์ตปลอดภัย · บันทึกผลงานโปร่งใส</span>
        <span><Globe size={16} /> ครบทุกตลาด: หุ้นไทย · DR · Forex · TFEX · US</span>
      </div>

      {/* Section 01: Flagship Markets Bento Grid */}
      <section id="discover" className="ng-section ng-markets" tabIndex={-1} aria-labelledby="ng-markets-title">
        <div className="ng-section-heading">
          <div>
            <span className="ng-kicker">01 / FLAGSHIP MARKET DESKS</span>
            <h2 id="ng-markets-title">
              เลือกตลาดที่ใช่<br />
              <span>ในจังหวะที่เป็นของคุณ</span>
            </h2>
          </div>
          <p>
            โฟกัส 3 ตลาดเรือธง <b>หุ้นไทย · DR · Forex</b> และขยายสู่อนุพันธ์ TFEX กับหุ้นสหรัฐฯ
            ทุกกระดานเชื่อมต่อด้วยบัญชี LINE เดียวกัน
          </p>
        </div>

        <div className="ng-market-grid">
          {markets.map((market) => (
            <Link
              key={market.id}
              href={`/${market.id}`}
              className={`ng-market ng-market-${market.id}${market.featured ? ' is-featured-card' : ''}`}
              style={{ '--market-tint': market.tone, '--market-rgb': market.rgb }}
            >
              <div className="ng-market-top">
                <span>{market.number} / {market.en}</span>
                <div className="ng-market-top-right">
                  {market.badge && <em className="ng-market-pill-badge">{market.badge}</em>}
                  <ArrowUpRight size={20} />
                </div>
              </div>
              <div className="ng-market-art" aria-hidden="true">
                <span>{market.glyph}</span>
                <svg viewBox="0 0 360 110">
                  <path d="M0 93 35 82 58 91 92 54 121 67 155 37 180 51 211 23 239 40 274 15 300 31 335 10 360 15" />
                  <path d="M0 108 360 108M0 71 360 71M0 35 360 35" className="ng-art-grid" />
                </svg>
              </div>
              <div className="ng-market-copy">
                <h3>{market.name}</h3>
                <p>{market.detail}</p>
                <small>{market.tags}</small>
              </div>
            </Link>
          ))}
        </div>

        <p className="ng-data-note">
          ความสามารถและความถี่ข้อมูลออกแบบตามมาตรฐานแต่ละตลาด · กระดานหุ้นไทยรองรับการเชื่อมต่อพอร์ต Settrade Open API และบริการเปิดพอร์ตพันธมิตร (บล.พาย 003 &amp; บล.ทรีนีตี้ 022) · ระบบเป็นเครื่องมือวิเคราะห์และช่วยตัดสินใจ ไม่มีการส่งคำสั่งซื้อขายอัตโนมัติแทนผู้ใช้งาน
        </p>
      </section>

      {/* Section 02: Products & Analysis Suite */}
      <ProductsShowcase />

      {/* Section 03: Signal Journey */}
      <section id="how-it-works" className="ng-section ng-process" tabIndex={-1} aria-labelledby="ng-process-title">
        <div className="ng-section-heading">
          <div>
            <span className="ng-kicker">03 / FROM SIGNAL TO STORY</span>
            <h2 id="ng-process-title">
              ไม่จบแค่สัญญาณ<br />
              <span>เห็นเส้นทางของทุกจังหวะ</span>
            </h2>
          </div>
          <Link href="/thai#section-auto-pick" className="ng-text-link">
            เปิดกระดานสัญญาณหุ้นไทย <ArrowUpRight size={18} />
          </Link>
        </div>

        <div className="ng-process-grid">
          <div className="ng-signal-preview" aria-label="ภาพอธิบายขั้นตอนสัญญาณ ไม่ใช่รายการซื้อขายจริง">
            <div className="ng-preview-head">
              <span><i /> SIGNAL JOURNEY</span>
              <small>ระบบติดตามสถานะอัตโนมัติ</small>
            </div>
            <div className="ng-orbit" aria-hidden="true">
              <div className="ng-orbit-ring" />
              <div className="ng-orbit-ring ng-orbit-ring-two" />
              <Image src="/nugaom-mascot.png" width={138} height={138} alt="" />
              <span className="ng-orbit-tag">น้องนักออม AI</span>
            </div>
            <ol className="ng-journey">
              <li>
                <span>01</span>
                <div>
                  <b>รอเข้า (Watch / Pending)</b>
                  <small>พบแผนที่เข้าเงื่อนไขสแกน พร้อมกรอบราคาที่ชัดเจน</small>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <b>เข้าเงื่อนไข (Triggered / Active)</b>
                  <small>บันทึกราคาและเวลาเข้าสัญญาณตามแท่งเทียนจริง</small>
                </div>
                <BellRing size={18} />
              </li>
              <li>
                <span>03</span>
                <div>
                  <b>ปิดผลลัพธ์ (Target / Stop / Expired)</b>
                  <small>บันทึกสถิติลงสมุดบัญชี Immutable Ledger โปร่งใส 100%</small>
                </div>
                <Check size={18} />
              </li>
            </ol>
          </div>

          <div className="ng-features">
            <article>
              <span className="ng-feature-icon"><ScanLine /></span>
              <div>
                <h3>ให้ระบบช่วยคัด ให้คุณตัดสินใจ</h3>
                <p>ติดตามจังหวะที่เข้าเงื่อนไข พร้อมจุดเข้า เป้าหมาย 2R และจุดตัดขาดทุน เปิดกราฟดูบริบทก่อนตัดสินใจด้วยตัวเอง</p>
              </div>
            </article>
            <article>
              <span className="ng-feature-icon"><BellRing /></span>
              <div>
                <h3>จังหวะสำคัญ มีเสียงน้องนักออมบอก</h3>
                <p>แจ้งเตือนผ่านหน้าเว็บเมื่อสัญญาณเปลี่ยนสถานะ เปิดเสียงในแอปเพื่อให้น้องนักออมช่วยอ่านเหตุการณ์ให้ฟังแบบไม่ต้องเฝ้าจอ</p>
                <small>รองรับการเปิดหน้าเว็บและอนุญาตเสียง การแจ้งเตือนอ้างอิงตามข้อมูลที่ระบบได้รับ</small>
              </div>
            </article>
            <article>
              <span className="ng-feature-icon"><ChartNoAxesCombined /></span>
              <div>
                <h3>เปิดดูผลงานได้ทั้งฝั่งชนะและแพ้</h3>
                <p>ทบทวนผลจากราคาเข้า–ออกที่ระบบบันทึกจริง ไม่มี Synthetic Win แยกสัญญาณที่ยังรอเข้า และแยกผลจำลองย้อนหลังชัดเจน</p>
              </div>
            </article>
            <article>
              <span className="ng-feature-icon"><Bookmark /></span>
              <div>
                <h3>เชื่อมพอร์ตหุ้นไทย &amp; พันธมิตรโบรกเกอร์</h3>
                <p>ตรวจสุขภาพพอร์ต Stage 2 เฝ้าระวังจุด Trailing Stop และลงทะเบียนเปิดพอร์ตใหม่กับพันธมิตร บล.พาย (003) และ บล.ทรีนีตี้ (022)</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Section 04: Official Global Channels & Community Hub */}
      <section id="official-channels" className="ng-section ng-channels-section" tabIndex={-1} aria-labelledby="ng-channels-title">
        <div className="ng-section-heading">
          <div>
            <span className="ng-kicker">04 / OFFICIAL ECOSYSTEM &amp; SOCIAL CHANNELS</span>
            <h2 id="ng-channels-title">
              เชื่อมต่อทุกช่องทางระดับโลก<br />
              <span>กับ Noom Nugaom Official</span>
            </h2>
          </div>
          <p>
            ติดตามบทวิเคราะห์ตลาด คลิปสอนเทคนิคการเทรด อินโฟกราฟิกหุ้นเด่น
            และอัปเดตเครื่องมือใหม่ล่าสุดผ่านช่องทางอย่างเป็นทางการทั้งหมดของเรา
          </p>
        </div>

        {/* Flagship Official Website Portal Banner */}
        <a
          href="https://noomnugaom.pages.dev/"
          target="_blank"
          rel="noopener noreferrer"
          className="ng-official-portal-card"
        >
          <div className="ng-portal-card-glow" aria-hidden="true" />
          <div className="ng-portal-card-left">
            <div className="ng-portal-badge-row">
              <span className="ng-portal-live-pill">
                <Radio size={13} /> OFFICIAL WEB PORTAL
              </span>
              <span className="ng-portal-domain">https://noomnugaom.pages.dev/</span>
            </div>
            <h3>Noom Nugaom Official Website &amp; Knowledge Hub</h3>
            <p>
              ศูนย์กลางข้อมูลอย่างเป็นทางการ รวบรวมบทความวิจัยกลยุทธ์ คู่มือการลงทุนหุ้นไทย DR Forex
              คลังความรู้การอ่านกราฟ Stage 2 และทางเข้าใช้งานระบบนิเวศ Nugaom ทั้งหมดในที่เดียว
            </p>
          </div>
          <div className="ng-portal-card-right">
            <span className="ng-portal-launch-btn">
              <span>เข้าสู่เว็บไซต์หลัก</span>
              <ArrowUpRight size={18} />
            </span>
          </div>
        </a>

        {/* 4 Social Media Interactive Liquid Glass Cards */}
        <div className="ng-social-grid">
          {OFFICIAL_CHANNELS.map((ch) => {
            const Icon = ch.icon;
            return (
              <a
                key={ch.id}
                href={ch.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`ng-social-card ng-social-${ch.id}`}
                style={{ '--social-accent': ch.accent, '--social-rgb': ch.rgb }}
              >
                <div className="ng-social-top">
                  <span className="ng-social-badge">{ch.badge}</span>
                  <div className="ng-social-icon-box">
                    <Icon size={20} />
                  </div>
                </div>
                <div className="ng-social-body">
                  <h3>{ch.name}</h3>
                  <strong className="ng-social-handle">{ch.handle}</strong>
                  <span className="ng-social-role">{ch.role}</span>
                  <p>{ch.desc}</p>
                </div>
                <div className="ng-social-foot">
                  <span>{ch.cta}</span>
                  <ArrowUpRight size={16} />
                </div>
              </a>
            );
          })}
        </div>

        {/* Partner Broker & VIP Concierge Strip */}
        <div className="ng-concierge-strip">
          <div className="ng-concierge-info">
            <span className="ng-concierge-tag">VIP PARTNER CONCIERGE</span>
            <h4>ต้องการเปิดพอร์ตหุ้นไทย/DR กับพันธมิตร หรือปรึกษาทีมงานโดยตรง?</h4>
            <p>
              เรามีทีมผู้แนะนำการลงทุนมืออาชีพจาก <b>บล.พาย (Pi Securities 003)</b> และ <b>บล.ทรีนีตี้ (Trinity Securities 022)</b> พร้อมดูแลและเชื่อมต่อระบบวิเคราะห์พอร์ตให้ครบวงจร
            </p>
          </div>
          <div className="ng-concierge-actions">
            <Link href="/thai#section-portfolio" className="ng-concierge-primary">
              เปิดพอร์ตพันธมิตร / เชื่อมพอร์ต ↗
            </Link>
            <Link href="/community" className="ng-concierge-secondary">
              เข้าห้องคอมมูนิตี้สมาชิก →
            </Link>
          </div>
        </div>
      </section>

      {/* Section 05: CTA Banner */}
      <section className="ng-section ng-start" aria-labelledby="ng-start-title">
        <div>
          <span className="ng-kicker">05 / MAKE IT YOUR COMMAND DESK</span>
          <h2 id="ng-start-title">
            เปิดมุมมองใหม่<br />
            ให้การลงทุนของคุณวันนี้
          </h2>
          <p>
            เริ่มต้นใช้งานง่ายๆ ด้วยบัญชี LINE ของคุณ<br />
            เลือกกระดานหุ้นไทย DR หรือ Forex แล้วให้ข้อมูลนำทางการตัดสินใจ
          </p>
          <div className="ng-actions">
            <Link href="/account" className="ng-button ng-button-dark">
              เริ่มต้นด้วย LINE (ทดลอง 14 วัน) <ArrowUpRight size={20} />
            </Link>
            <Link href="/thai" className="ng-text-link">
              เข้าสู่กระดานหุ้นไทยทันที →
            </Link>
          </div>
        </div>
        <div className="ng-start-note">
          <span>NUGAOM / AI PICK</span>
          <p>
            ข้อมูลช่วยให้เห็นภาพ<br />
            แผนช่วยให้มีทิศทาง<br />
            <b>การตัดสินใจเป็นของคุณ</b>
          </p>
          <span>RESEARCH. PLAN. REFLECT.</span>
        </div>
      </section>

      {/* Section 06: FAQ */}
      <section className="ng-section ng-faq" aria-labelledby="ng-faq-title">
        <div>
          <span className="ng-kicker">GOOD TO KNOW</span>
          <h2 id="ng-faq-title">คำถามที่พบบ่อยก่อนเริ่มใช้งาน</h2>
        </div>
        <div>
          <details>
            <summary>ระบบส่งคำสั่งซื้อขายให้หรือไม่?</summary>
            <p>แอปนี้ใช้สแกน วิเคราะห์ ตรวจสุขภาพพอร์ต และแจ้งเตือนเท่านั้น ไม่มีการส่งคำสั่งซื้อขายแทนคุณ สัญญาณทั้งหมดเป็นข้อมูลประกอบการตัดสินใจ</p>
          </details>
          <details>
            <summary>สามารถเชื่อมต่อพอร์ตหรือเปิดพอร์ตหุ้นไทยกับโบรกเกอร์ใดได้บ้าง?</summary>
            <p>หน้าหุ้นไทยรองรับการเชื่อมต่อผ่าน Settrade Open API และสามารถลงทะเบียนเปิดพอร์ตใหม่กับ 2 พันธมิตรหลักของเรา ได้แก่ บล.พาย (Pi Securities 003) และ บล.ทรีนีตี้ (Trinity Securities 022) เพื่อให้เจ้าหน้าที่ผู้ดูแลติดต่อกลับโดยตรง</p>
          </details>
          <details>
            <summary>ราคาที่เห็นเป็นเรียลไทม์ทุกตลาดไหม?</summary>
            <p>แต่ละตลาดใช้แหล่งข้อมูลและช่วงเวลาต่างกัน ตรวจแหล่งข้อมูล เวลาอัปเดต และกรอบเวลาที่แสดงในหน้าตลาดก่อนใช้งาน ความถี่สแกนไม่ได้ทำให้ข้อมูลล่าช้ากลายเป็นข้อมูลเรียลไทม์</p>
          </details>
          <details>
            <summary>ติดตามข่าวสารและคลิปสอนใช้งานได้ที่ไหน?</summary>
            <p>สามารถติดตามได้ผ่านเว็บไซต์หลัก noomnugaom.pages.dev รวมถึงช่อง YouTube (@Noomnugaom), TikTok (@noomnugaom), Facebook (noomnugaom) และ Instagram (@nnugaom)</p>
          </details>
        </div>
      </section>

      {/* World-Class Multi-Column Mega Footer */}
      <footer className="ng-footer">
        <div className="ng-footer-grid">
          <div className="ng-footer-col-brand">
            <Link href="/" className="ng-footer-brand">
              <Image src="/nugaom-mascot.png" width={38} height={38} alt="" />
              <div>
                <strong>NUGAOM AI PICK</strong>
                <span>YOUR MARKET. YOUR MOMENT.</span>
              </div>
            </Link>
            <p className="ng-footer-mission">
              แพลตฟอร์มสแกนตลาดและวิเคราะห์สัญญาณการลงทุนอัจฉริยะ ครอบคลุมหุ้นไทย SET100, DR หุ้นโลก, Forex MT5, TFEX และหุ้นสหรัฐฯ ออกแบบด้วยสถาปัตยกรรมที่โปร่งใสและปลอดภัยสูงสุด
            </p>
            <div className="ng-footer-social-pills">
              <a href="https://noomnugaom.pages.dev/" target="_blank" rel="noopener noreferrer">🌐 Website</a>
              <a href="https://www.youtube.com/@Noomnugaom" target="_blank" rel="noopener noreferrer">▶️ YouTube</a>
              <a href="https://www.tiktok.com/@noomnugaom" target="_blank" rel="noopener noreferrer">🎵 TikTok</a>
              <a href="https://www.facebook.com/noomnugaom/" target="_blank" rel="noopener noreferrer">💬 Facebook</a>
              <a href="https://www.instagram.com/nnugaom" target="_blank" rel="noopener noreferrer">📸 Instagram</a>
            </div>
          </div>

          <div className="ng-footer-col">
            <h4>กระดานตลาดหลัก</h4>
            <Link href="/thai">🇹🇭 หุ้นไทย (SET100 &amp; mai)</Link>
            <Link href="/dr">🌐 DR หุ้นโลกกระดานไทย</Link>
            <Link href="/forex">⚡ Forex &amp; Gold MT5</Link>
            <Link href="/tfex">📈 TFEX Derivatives</Link>
            <Link href="/us">🇺🇸 หุ้นสหรัฐฯ &amp; Global ETFs</Link>
          </div>

          <div className="ng-footer-col">
            <h4>เครื่องมือระดับโปร</h4>
            <Link href="/thai#section-portfolio">เชื่อมพอร์ตหุ้นไทย (Pi &amp; Trinity)</Link>
            <Link href="/dr-strategy">DR80 Strategy &amp; Arbitrage</Link>
            <Link href="/risk">Risk &amp; Position Calculator</Link>
            <Link href="/calendar">ปฏิทินเศรษฐกิจ &amp; ข่าวมหภาค</Link>
            <Link href="/developers">Structure API &amp; Playground</Link>
          </div>

          <div className="ng-footer-col">
            <h4>ช่องทางติดต่อ &amp; คอมมูนิตี้</h4>
            <a href="https://noomnugaom.pages.dev/" target="_blank" rel="noopener noreferrer">noomnugaom.pages.dev ↗</a>
            <a href="https://www.youtube.com/@Noomnugaom" target="_blank" rel="noopener noreferrer">YouTube: @Noomnugaom ↗</a>
            <a href="https://www.tiktok.com/@noomnugaom" target="_blank" rel="noopener noreferrer">TikTok: @noomnugaom ↗</a>
            <a href="https://www.facebook.com/noomnugaom/" target="_blank" rel="noopener noreferrer">Facebook: noomnugaom ↗</a>
            <a href="https://www.instagram.com/nnugaom" target="_blank" rel="noopener noreferrer">Instagram: @nnugaom ↗</a>
            <Link href="/community">ห้องสมาชิก &amp; ทีมโค้ช</Link>
          </div>
        </div>

        <div className="ng-footer-bottom">
          <p>เครื่องมือช่วยวิเคราะห์ ไม่ใช่คำแนะนำในการลงทุน การลงทุนมีความเสี่ยง ผู้ใช้งานควรศึกษาข้อมูลและตัดสินใจด้วยตนเอง</p>
          <small>
            <span>© {new Date().getFullYear()} Nugaom AI Pick · Official Ecosystem</span>
            <span>3D Engine: Nugaom / Three.js · <a href="/landing-pages/licenses/THREE-LICENSE">MIT License</a></span>
          </small>
        </div>
      </footer>

      {/* Mobile Navigation Dock */}
      <MobileDock />
    </main>
  );
}
