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
    en: 'THAI EQUITY DESK',
    badge: 'ยอดนิยม · SETTRADE',
    detail: 'สแกนหุ้นขาขึ้น Stage 2 เรดาร์สด และเชื่อมพอร์ต บล.พาย (003) & ทรีนีตี้ (022)',
    tags: 'Stage 2 Screener · Settrade API · ปันผล SETHD',
    tone: '#72dfb3',
    rgb: '114, 223, 179',
    glyph: 'TH',
    featured: true,
  },
  {
    id: 'dr',
    number: '02',
    name: 'DR หุ้นโลกกระดานไทย',
    en: 'GLOBAL DR TRACKER',
    badge: 'GLOBAL · AI 16/16',
    detail: 'เทรดหุ้นเทคฯ โลกด้วยเงินบาท พร้อมคำนวณ Fair Value เทียบหุ้นแม่แบบสดๆ',
    tags: 'DR80 / DR23 · Camarilla 8 จุด · Arbitrage Spread',
    tone: '#f2be62',
    rgb: '242, 190, 98',
    glyph: 'DR',
    featured: true,
  },
  {
    id: 'forex',
    number: '03',
    name: 'Forex & Gold CFD',
    en: 'MT5 COMMAND CENTER',
    badge: '24H LIVE · MT5',
    detail: 'สแกนคู่เงินหลักและทองคำ XAUUSD ตลอด 24 ชม. เชื่อมต่อ MT5 Read-Only ปลอดภัย 100%',
    tags: 'XAUUSD Scanner · MT5 Bridge · 2R Risk Sizing',
    tone: '#bc9bff',
    rgb: '188, 155, 255',
    glyph: 'FX',
    featured: true,
  },
  {
    id: 'tfex',
    number: '04',
    name: 'TFEX Derivatives',
    en: 'FUTURES WORKSPACE',
    badge: 'S50 & GOLD',
    detail: 'วิเคราะห์กราฟและแยกซีรีส์สัญญา SET50 Index Futures, Gold Online และ Silver',
    tags: 'S50 / GO / SVF · ซีรีส์สัญญา · คำนวณ Margin',
    tone: '#ff9970',
    rgb: '255, 153, 112',
    glyph: 'TF',
  },
  {
    id: 'us',
    number: '05',
    name: 'หุ้นสหรัฐฯ & Global ETFs',
    en: 'WALL STREET DESK',
    badge: 'S&P 500 & ETFS',
    detail: 'สแกนหุ้นผู้นำ S&P 500 Stage 2, Sector Rotation และคำนวณความเสี่ยงค่าเงิน USD/THB',
    tags: 'Stage 2 Leaders · Thematic ETFs · FX Hedge',
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
    role: 'VIDEO & LIVE TRADING',
    desc: 'คลิปเจาะลึกกราฟเทคนิค สอนใช้เครื่องมือสแกน และไลฟ์วิเคราะห์ตลาดทุกสัปดาห์',
    href: 'https://www.youtube.com/@Noomnugaom',
    accent: '#ff3355',
    rgb: '255, 51, 85',
    badge: 'YOUTUBE',
    cta: 'ดูคลิปใน YouTube',
    icon: Play,
  },
  {
    id: 'tiktok',
    name: 'TikTok Official',
    handle: '@noomnugaom',
    role: '1-MIN MARKET INSIGHTS',
    desc: 'สรุปจังหวะหุ้นไทย DR และเทคนิคอ่านกราฟไวเข้าใจง่ายใน 1 นาที',
    href: 'https://www.tiktok.com/@noomnugaom',
    accent: '#00f2fe',
    rgb: '0, 242, 254',
    badge: 'TIKTOK',
    cta: 'ดูคลิปสั้น TikTok',
    icon: Video,
  },
  {
    id: 'facebook',
    name: 'Facebook Page',
    handle: 'fb.com/noomnugaom',
    role: 'DAILY MARKET BRIEF',
    desc: 'อัปเดตบทวิเคราะห์รายวัน สรุปข่าวเศรษฐกิจ และพูดคุยกับคอมมูนิตี้',
    href: 'https://www.facebook.com/noomnugaom/',
    accent: '#38bdf8',
    rgb: '56, 189, 248',
    badge: 'FACEBOOK',
    cta: 'ไปที่เพจ Facebook',
    icon: MessageCircle,
  },
  {
    id: 'instagram',
    name: 'Instagram Official',
    handle: '@nnugaom',
    role: 'VISUAL INFOGUIDES',
    desc: 'อินโฟกราฟิกสรุปหุ้นเด่น แผนผัง Stage 2 และไอเดียจัดพอร์ตเข้าใจง่าย',
    href: 'https://www.instagram.com/nnugaom',
    accent: '#f472b6',
    rgb: '244, 114, 182',
    badge: 'INSTAGRAM',
    cta: 'เปิดดู Instagram',
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
            <span>ติดต่อเรา</span>
          </a>
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
              พร้อมใช้งานเต็มรูปแบบ: <b>หุ้นไทย (Settrade API · บล.พาย &amp; ทรีนีตี้)</b> · <b>DR หุ้นโลก</b> · <b>Forex MT5</b>
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
        <span><ScanLine size={16} /> คัดหุ้นเข้าเงื่อนไขจริง</span>
        <span><BellRing size={16} /> เสียงพากย์เตือนผ่านเว็บ</span>
        <span><ShieldCheck size={16} /> เชื่อมพอร์ตปลอดภัย · โปร่งใส 100%</span>
        <span><Globe size={16} /> หุ้นไทย · DR · Forex · TFEX · US</span>
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
            โดดเด่นด้วย 3 ตลาดหลัก <b>หุ้นไทย · DR · Forex</b> พร้อมขยายสู่ TFEX และหุ้นสหรัฐฯ ในบัญชีเดียว
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
      </section>

      {/* Section 02: Visual Products & Analysis Suite */}
      <ProductsShowcase />

      {/* Section 03: Signal Journey (Concise & Actionable) */}
      <section id="how-it-works" className="ng-section ng-process" tabIndex={-1} aria-labelledby="ng-process-title">
        <div className="ng-section-heading">
          <div>
            <span className="ng-kicker">03 / SIGNAL WORKFLOW</span>
            <h2 id="ng-process-title">
              3 ขั้นตอนอัจฉริยะ<br />
              <span>จากเรดาร์สแกน สู่การตัดสินใจ</span>
            </h2>
          </div>
          <Link href="/thai" className="ng-text-link">
            ทดลองสแกนหุ้นไทยสด <ArrowUpRight size={18} />
          </Link>
        </div>

        <div className="ng-process-grid">
          <div className="ng-signal-preview" aria-label="ภาพอธิบายขั้นตอนสัญญาณ">
            <div className="ng-preview-head">
              <span><i /> LIVE SIGNAL JOURNEY</span>
              <small>ระบบติดตามอัตโนมัติ</small>
            </div>
            <div className="ng-orbit" aria-hidden="true">
              <div className="ng-orbit-ring" />
              <div className="ng-orbit-ring ng-orbit-ring-two" />
              <Image src="/nugaom-mascot.png" width={132} height={132} alt="" />
              <span className="ng-orbit-tag">น้องนักออม AI</span>
            </div>
            <ol className="ng-journey">
              <li>
                <span>01</span>
                <div>
                  <b>สแกนพบจังหวะ (Watch)</b>
                  <small>คัดหุ้นเข้าเงื่อนไขพร้อมแนวรับ-แนวต้าน</small>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <b>เข้าแผนเทรด (Active 2R)</b>
                  <small>แจ้งเตือนเสียงพร้อมจุด Entry / Target / Stop</small>
                </div>
                <BellRing size={18} />
              </li>
              <li>
                <span>03</span>
                <div>
                  <b>บันทึกผลโปร่งใส (Ledger)</b>
                  <small>สรุปสถิติจริงลงสมุดบัญชี ตรวจสอบย้อนหลังได้</small>
                </div>
                <Check size={18} />
              </li>
            </ol>
          </div>

          <div className="ng-features">
            <Link href="/thai" className="ng-feature-card-link">
              <span className="ng-feature-icon"><ScanLine /></span>
              <div>
                <h3>สแกนไว เห็นแผนครบในคลิกเดียว</h3>
                <p>บอกจุดเข้า เป้าทำกำไร 2R และจุดตัดขาดทุนชัดเจนก่อนตัดสินใจ</p>
              </div>
              <ArrowUpRight size={18} className="ng-feat-arrow" />
            </Link>
            <Link href="/thai#section-radar" className="ng-feature-card-link">
              <span className="ng-feature-icon"><BellRing /></span>
              <div>
                <h3>มีเสียงน้องนักออม AI ช่วยพากย์</h3>
                <p>อ่านสัญญาณและข่าวด่วนภาษาไทยให้ฟังอัตโนมัติ ไม่ต้องเฝ้าหน้าจอ</p>
              </div>
              <ArrowUpRight size={18} className="ng-feat-arrow" />
            </Link>
            <Link href="/thai#section-portfolio" className="ng-feature-card-link">
              <span className="ng-feature-icon"><Bookmark /></span>
              <div>
                <h3>เชื่อมพอร์ตจริง &amp; พันธมิตรโบรกเกอร์</h3>
                <p>ซิงค์พอร์ต Settrade API และเปิดบัญชีใหม่กับ บล.พาย (003) &amp; ทรีนีตี้ (022)</p>
              </div>
              <ArrowUpRight size={18} className="ng-feat-arrow" />
            </Link>
            <Link href="/thai" className="ng-feature-card-link">
              <span className="ng-feature-icon"><ChartNoAxesCombined /></span>
              <div>
                <h3>สถิติจริง โปร่งใส ตรวจสอบได้ 100%</h3>
                <p>แสดงผลทั้งไม้ชนะและแพ้ตามราคาปิดแท่งเทียนจริง ไม่มีแต่งตัวเลข</p>
              </div>
              <ArrowUpRight size={18} className="ng-feat-arrow" />
            </Link>
          </div>
        </div>
      </section>

      {/* Section 04: Official Global Channels & Community Hub */}
      <section id="official-channels" className="ng-section ng-channels-section" tabIndex={-1} aria-labelledby="ng-channels-title">
        <div className="ng-section-heading">
          <div>
            <span className="ng-kicker">04 / OFFICIAL CHANNELS &amp; COMMUNITY</span>
            <h2 id="ng-channels-title">
              ช่องทางติดต่อและโซเชียลทางการ<br />
              <span>Noom Nugaom Official</span>
            </h2>
          </div>
          <p>
            คลิกเชื่อมต่อเว็บไซต์หลักและโซเชียลมีเดียทุกแพลตฟอร์ม เพื่อรับบทวิเคราะห์และเทคนิคการเทรดรายวัน
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
                <Radio size={13} /> OFFICIAL WEBSITE
              </span>
              <span className="ng-portal-domain">https://noomnugaom.pages.dev/</span>
            </div>
            <h3>Noom Nugaom Official Portal &amp; Knowledge Hub</h3>
            <p>
              ศูนย์รวมบทความกลยุทธ์ คลังความรู้การลงทุนหุ้นไทย DR Forex และอัปเดตระบบนิเวศทั้งหมด
            </p>
          </div>
          <div className="ng-portal-card-right">
            <span className="ng-portal-launch-btn">
              <span>เปิดเว็บไซต์หลัก</span>
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
            <h4>เปิดพอร์ตหุ้นไทย/DR กับพันธมิตร บล.พาย (003), บล.ทรีนีตี้ (022) &amp; บล.เอเอสแอล (050)</h4>
            <p>
              ลงทะเบียนหรือแจ้งเลขพอร์ตเพื่อให้ทีมผู้ดูแลพอร์ตติดต่อกลับโดยตรง พร้อมรับสิทธิ์ VIP ใช้งานเครื่องมือสแกนและวิเคราะห์พอร์ตครบวงจร
            </p>
          </div>
          <div className="ng-concierge-actions">
            <Link href="/thai#section-portfolio" className="ng-concierge-primary">
              เปิดพอร์ตพันธมิตร / เชื่อมพอร์ต ↗
            </Link>
            <Link href="/account" className="ng-concierge-secondary">
              เข้าสู่ระบบด้วย LINE →
            </Link>
          </div>
        </div>
      </section>

      {/* Section 05: CTA Banner */}
      <section className="ng-section ng-start" aria-labelledby="ng-start-title">
        <div>
          <span className="ng-kicker">05 / GET STARTED NOW</span>
          <h2 id="ng-start-title">
            พร้อมยกระดับ<br />
            การเทรดของคุณหรือยัง?
          </h2>
          <p>
            เชื่อมต่อบัญชี LINE เพื่อเริ่มทดลองใช้งานฟรี 14 วัน<br />
            หรือกดเข้ากระดานหุ้นไทย DR และ Forex ได้ทันที
          </p>
          <div className="ng-actions">
            <Link href="/account" className="ng-button ng-button-dark">
              เริ่มต้นด้วย LINE (ทดลอง 14 วัน) <ArrowUpRight size={20} />
            </Link>
            <Link href="/thai" className="ng-text-link">
              เข้ากระดานหุ้นไทยทันที →
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

      {/* Section 06: Concise FAQ */}
      <section className="ng-section ng-faq" aria-labelledby="ng-faq-title">
        <div>
          <span className="ng-kicker">FAQ</span>
          <h2 id="ng-faq-title">คำถามที่พบบ่อย</h2>
        </div>
        <div>
          <details>
            <summary>ระบบส่งคำสั่งซื้อขายแทนเราหรือไม่?</summary>
            <p>ไม่ส่งคำสั่งแทนครับ ระบบทำหน้าที่สแกนหาจังหวะ วางแผน 2R และแจ้งเตือนเพื่อให้คุณตัดสินใจด้วยตัวเอง 100%</p>
          </details>
          <details>
            <summary>เชื่อมต่อหรือเปิดพอร์ตกับโบรกเกอร์ใดได้บ้าง?</summary>
            <p>รองรับพอร์ตหุ้นไทยผ่าน Settrade Open API และลงทะเบียนเปิดพอร์ตใหม่หรือแจ้งเลขพอร์ตกับพันธมิตร บล.พาย (003), บล.ทรีนีตี้ (022) และ บล.เอเอสแอล (050) ได้ที่หน้าหุ้นไทย</p>
          </details>
          <details>
            <summary>เริ่มต้นทดลองใช้งานฟรี 14 วันอย่างไร?</summary>
            <p>กดปุ่ม “เข้าใช้ด้วย LINE” ด้านบนสุดเพื่อยืนยันตัวตนและเปิดสิทธิ์ทดลองใช้งานได้ทันทีครับ</p>
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
              แพลตฟอร์มสแกนตลาดและวิเคราะห์สัญญาณการลงทุนอัจฉริยะ ครอบคลุมหุ้นไทย SET100, DR หุ้นโลก, Forex MT5, TFEX และหุ้นสหรัฐฯ
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
            <Link href="/risk">Risk &amp; Position Calculator</Link>
            <Link href="/calendar">ปฏิทินเศรษฐกิจ &amp; ข่าวมหภาค</Link>
            <Link href="/developers">Structure API &amp; Playground</Link>
          </div>

          <div className="ng-footer-col">
            <h4>ช่องทางติดต่อ &amp; โซเชียล</h4>
            <a href="https://noomnugaom.pages.dev/" target="_blank" rel="noopener noreferrer">noomnugaom.pages.dev ↗</a>
            <a href="https://www.youtube.com/@Noomnugaom" target="_blank" rel="noopener noreferrer">YouTube: @Noomnugaom ↗</a>
            <a href="https://www.tiktok.com/@noomnugaom" target="_blank" rel="noopener noreferrer">TikTok: @noomnugaom ↗</a>
            <a href="https://www.facebook.com/noomnugaom/" target="_blank" rel="noopener noreferrer">Facebook: noomnugaom ↗</a>
            <a href="https://www.instagram.com/nnugaom" target="_blank" rel="noopener noreferrer">Instagram: @nnugaom ↗</a>
            <Link href="/account">เข้าสู่ระบบ / บัญชีสมาชิก</Link>
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
