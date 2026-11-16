'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Clock,
  Compass,
  Cpu,
  Layers,
  LineChart,
  Newspaper,
  Radio,
  Scan,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Volume2,
} from 'lucide-react';

export const CORE_PRODUCTS = [
  {
    id: 'thai-stage2',
    number: '01',
    category: 'thai',
    title: 'สแกนหุ้นไทย Stage 2 & เรดาร์สด',
    subtitle: 'SET100 & mai · คัดหุ้นขาขึ้นแข็งแกร่ง',
    tagline: 'สแกนหาหุ้นไทยทรงขาขึ้น Stage 2 พร้อมแนวรับ-แนวต้าน และแจ้งเตือนเสียงสด',
    badge: 'THAI STAGE 2',
    accent: '#72dfb3',
    rgb: '114, 223, 179',
    icon: Scan,
    targetUrl: '/thai',
    visualType: 'stage2-chart',
    metrics: ['SET100 + mai', 'Stage 2 Leader', 'Entry / 2R / Stop'],
  },
  {
    id: 'thai-portfolio',
    number: '02',
    category: 'thai',
    title: 'เชื่อมตารางพอร์ตหุ้นไทย & พันธมิตร',
    subtitle: 'Settrade Open API · บล.พาย (003) & ทรีนีตี้ (022)',
    tagline: 'ตรวจสุขภาพพอร์ตจริง เฝ้าระวังจุด Trailing Stop และเปิดบัญชีกับ 2 โบรกเกอร์พันธมิตร',
    badge: 'PORTFOLIO DESK',
    accent: '#38bdf8',
    rgb: '56, 189, 248',
    icon: Briefcase,
    targetUrl: '/thai#section-portfolio',
    visualType: 'portfolio-allocation',
    metrics: ['Pi Securities 003', 'Trinity 022', 'Stage Health Score'],
  },
  {
    id: 'dr-bridge',
    number: '03',
    category: 'dr',
    title: 'DR Strategy & Arbitrage Radar',
    subtitle: 'หุ้นเทคโนโลยีโลกในกระดานไทยด้วยเงินบาท',
    tagline: 'วัดคะแนนเทคนิค 16 แต้ม คำนวณส่วนต่างราคา DR เทียบหุ้นแม่ และแนวรับ Camarilla',
    badge: 'GLOBAL DR80',
    accent: '#f2be62',
    rgb: '242, 190, 98',
    icon: Compass,
    targetUrl: '/dr',
    visualType: 'dr-arbitrage',
    metrics: ['Camarilla 8 จุด', 'FX Fair Value', 'AI Score 16/16'],
  },
  {
    id: 'mt5-telemetry',
    number: '04',
    category: 'forex',
    title: 'Forex & Gold MT5 Command Desk',
    subtitle: 'สแกนคู่เงินหลัก & ทองคำ XAUUSD ตลอด 24 ชม.',
    tagline: 'เชื่อมต่อ MT5 แบบ Read-Only ปลอดภัย 100% วัดความเสถียรฟีดราคาและสแกนจุดเข้า 2R',
    badge: '24H MT5 LIVE',
    accent: '#bc9bff',
    rgb: '188, 155, 255',
    icon: Cpu,
    targetUrl: '/forex',
    visualType: 'forex-telemetry',
    metrics: ['XAUUSD & Majors', 'Read-Only Safe', '15m / 1H / 4H'],
  },
  {
    id: 'risk-manager',
    number: '05',
    category: 'pro',
    title: 'Risk & Position Sizing Calculator',
    subtitle: 'คำนวณจำนวนหุ้น · สัญญา TFEX · Lot Forex',
    tagline: 'คุมความเสี่ยง 0.5%–2% ต่อไม้ คำนวณจุดตัดขาดทุนและเป้าหมายกำไร 2R/3R อัตโนมัติ',
    badge: '2R RISK MATH',
    accent: '#2dd4bf',
    rgb: '45, 212, 191',
    icon: BarChart3,
    targetUrl: '/risk',
    visualType: 'risk-bars',
    metrics: ['Position Sizing', 'Max Loss Control', '2R / 3R Target'],
  },
  {
    id: 'voice-ledger',
    number: '06',
    category: 'pro',
    title: 'เสียงน้องนักออม AI & บันทึกผลงานจริง',
    subtitle: 'Thai Voice Alert & Immutable Audit Ledger',
    tagline: 'อ่านสัญญาณเตือนด้วยเสียงภาษาไทย พร้อมสมุดบันทึกสถิติชนะ/แพ้โปร่งใส ตรวจสอบได้ทุกไม้',
    badge: 'VOICE & AUDIT',
    accent: '#f472b6',
    rgb: '244, 114, 182',
    icon: Volume2,
    targetUrl: '/thai',
    visualType: 'voice-wave',
    metrics: ['เสียงพากย์ไทย AI', 'บันทึกผล 100 ไม้', 'โปร่งใส 100%'],
  },
];

export const PRO_ANALYSIS_TOOLS = [
  {
    id: 'smc-structure',
    title: 'Smart Money Structure',
    dimension: '01',
    desc: 'จับจุด BOS, CHoCH และ Order Block อัตโนมัติ',
    icon: Layers,
    accent: '#38bdf8',
    link: '/developers',
  },
  {
    id: 'causal-trend',
    title: 'Stage 2 & RVOL Filter',
    dimension: '02',
    desc: 'สแกนวอลุ่มเข้าผิดปกติและเทรนด์ขาขึ้นจริง',
    icon: TrendingUp,
    accent: '#72dfb3',
    link: '/thai',
  },
  {
    id: 'risk-calculator',
    title: '2R Dynamic Sizing',
    dimension: '03',
    desc: 'คำนวณ Stop Loss ด้วย ATR รักษาความคุ้มค่า 2R',
    icon: BarChart3,
    accent: '#f2be62',
    link: '/risk',
  },
  {
    id: 'macro-sentiment',
    title: 'ปฏิทินเศรษฐกิจ & ข่าวด่วน',
    dimension: '04',
    desc: 'แจ้งเตือนตัวเลข Fed, กนง., CPI ก่อนตลาดผันผวน',
    icon: Newspaper,
    accent: '#ff9970',
    link: '/calendar',
  },
  {
    id: 'mtf-confluence',
    title: 'Multi-Timeframe Sync',
    dimension: '05',
    desc: 'เช็คความสอดคล้อง Day / 4H / 15m ในหน้าเดียว',
    icon: Clock,
    accent: '#bc9bff',
    link: '/dr',
  },
  {
    id: 'ledger-telemetry',
    title: 'บันทึกผลงานสัญญาณย้อนหลัง',
    dimension: '06',
    desc: 'ตรวจสอบประวัติเข้า-ออกจริง ไม่มีการแต่งตัวเลข',
    icon: LineChart,
    accent: '#f472b6',
    link: '/thai',
  },
];

const FILTER_TABS = [
  { id: 'all', label: '✨ ทั้งหมด (6 ไฮไลต์)' },
  { id: 'thai', label: '🇹🇭 หุ้นไทย & เชื่อมพอร์ต' },
  { id: 'dr', label: '🌐 DR หุ้นโลก' },
  { id: 'forex', label: '⚡ Forex & MT5' },
  { id: 'pro', label: '🛡️ คุมความเสี่ยง & AI' },
];

function ProductVisualArt({ type, accent }) {
  if (type === 'stage2-chart') {
    return (
      <svg viewBox="0 0 320 110" className="ng-prod-svg" aria-hidden="true">
        <defs>
          <linearGradient id="g-stage2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.38" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d="M12 88 L55 78 L95 82 L135 58 L175 62 L218 32 L260 36 L304 14 L304 102 L12 102 Z" fill="url(#g-stage2)" />
        <path d="M12 88 L55 78 L95 82 L135 58 L175 62 L218 32 L260 36 L304 14" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="12" y1="48" x2="308" y2="48" stroke="rgba(255,255,255,0.16)" strokeDasharray="4 4" />
        <circle cx="218" cy="32" r="5" fill={accent} />
        <circle cx="304" cy="14" r="6" fill="#ffffff" stroke={accent} strokeWidth="3" />
        <rect x="200" y="8" width="84" height="20" rx="10" fill="rgba(15,23,42,0.85)" />
        <text x="242" y="21" textAnchor="middle" fill={accent} fontSize="9.5" fontWeight="800" fontFamily="monospace">STAGE 2 BREAK</text>
      </svg>
    );
  }
  if (type === 'portfolio-allocation') {
    return (
      <svg viewBox="0 0 320 110" className="ng-prod-svg" aria-hidden="true">
        <rect x="16" y="20" width="136" height="72" rx="14" fill="rgba(16,185,129,0.12)" />
        <text x="30" y="42" fill="#72dfb3" fontSize="10" fontWeight="800" fontFamily="monospace">PI SECURITIES (003)</text>
        <text x="30" y="64" fill="#ffffff" fontSize="15" fontWeight="800">฿928,250</text>
        <text x="30" y="80" fill="#72dfb3" fontSize="10" fontWeight="700">+11.02% · Stage A</text>
        <rect x="166" y="20" width="138" height="72" rx="14" fill="rgba(56,189,248,0.12)" />
        <text x="180" y="42" fill="#38bdf8" fontSize="10" fontWeight="800" fontFamily="monospace">TRINITY (022)</text>
        <rect x="180" y="52" width="110" height="8" rx="4" fill="rgba(255,255,255,0.1)" />
        <rect x="180" y="52" width="78" height="8" rx="4" fill="#38bdf8" />
        <text x="180" y="78" fill="#cbd5e1" fontSize="10" fontWeight="700">Settrade API Synced</text>
      </svg>
    );
  }
  if (type === 'dr-arbitrage') {
    return (
      <svg viewBox="0 0 320 110" className="ng-prod-svg" aria-hidden="true">
        <rect x="18" y="26" width="88" height="58" rx="14" fill="rgba(242,190,98,0.14)" />
        <text x="62" y="50" textAnchor="middle" fill="#f2be62" fontSize="12" fontWeight="800">NVDA80</text>
        <text x="62" y="68" textAnchor="middle" fill="#ffffff" fontSize="10" fontFamily="monospace">THB BOARD</text>
        <path d="M116 55 L198 55" stroke="#f2be62" strokeWidth="2" strokeDasharray="4 4" />
        <rect x="128" y="42" width="60" height="24" rx="12" fill="#0f172a" />
        <text x="158" y="57" textAnchor="middle" fill="#72dfb3" fontSize="9.5" fontWeight="800" fontFamily="monospace">-0.4% DISC</text>
        <rect x="208" y="26" width="94" height="58" rx="14" fill="rgba(56,189,248,0.14)" />
        <text x="255" y="50" textAnchor="middle" fill="#38bdf8" fontSize="12" fontWeight="800">NASDAQ</text>
        <text x="255" y="68" textAnchor="middle" fill="#ffffff" fontSize="10" fontFamily="monospace">FAIR VALUE</text>
      </svg>
    );
  }
  if (type === 'forex-telemetry') {
    return (
      <svg viewBox="0 0 320 110" className="ng-prod-svg" aria-hidden="true">
        <path d="M12 60 L55 60 L72 30 L90 86 L108 42 L125 68 L142 58 L205 58 L222 24 L240 82 L258 50 L308 50" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="222" cy="24" r="5" fill="#72dfb3" />
        <rect x="18" y="14" width="96" height="22" rx="11" fill="rgba(188,155,255,0.18)" />
        <text x="66" y="28" textAnchor="middle" fill="#e9d5ff" fontSize="9.5" fontWeight="800" fontFamily="monospace">XAUUSD · 18ms</text>
      </svg>
    );
  }
  if (type === 'risk-bars') {
    return (
      <svg viewBox="0 0 320 110" className="ng-prod-svg" aria-hidden="true">
        <rect x="20" y="24" width="280" height="24" rx="12" fill="rgba(16,185,129,0.18)" />
        <rect x="20" y="24" width="190" height="24" rx="12" fill="#10b981" />
        <text x="32" y="40" fill="#050914" fontSize="10" fontWeight="800" fontFamily="monospace">TARGET +2.0R (+฿12,000)</text>
        <rect x="20" y="60" width="280" height="22" rx="11" fill="rgba(244,63,94,0.16)" />
        <rect x="20" y="60" width="85" height="22" rx="11" fill="#f43f5e" />
        <text x="116" y="75" fill="#fda4af" fontSize="10" fontWeight="800" fontFamily="monospace">RISK -1.0R (MAX 1.5%)</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 320 110" className="ng-prod-svg" aria-hidden="true">
      {[28, 46, 64, 82, 100, 118, 136, 154, 172, 190, 208, 226, 244, 262, 280].map((x, idx) => {
        const heights = [22, 38, 56, 34, 68, 48, 28, 62, 74, 44, 30, 58, 40, 26, 18];
        const h = heights[idx % heights.length];
        return (
          <rect
            key={x}
            x={x}
            y={(110 - h) / 2}
            width="8"
            height={h}
            rx="4"
            fill={idx % 2 === 0 ? accent : '#38bdf8'}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

export default function ProductsShowcase() {
  const [activeFilter, setActiveFilter] = useState('all');

  const visibleProducts =
    activeFilter === 'all'
      ? CORE_PRODUCTS
      : CORE_PRODUCTS.filter((item) => item.category === activeFilter);

  return (
    <section id="products-suite" className="ng-section ng-products-suite" aria-labelledby="products-title">
      <div className="ng-section-heading">
        <div>
          <span className="ng-kicker">02 / VISUAL PRODUCT ECOSYSTEM</span>
          <h2 id="products-title">
            เครื่องมือเทรดเกรดมือโปร<br />
            <span>เข้าใจง่าย เห็นภาพชัดในคลิกเดียว</span>
          </h2>
        </div>
        <p>
          ย่อความซับซ้อนให้เป็นกราฟิกที่อ่านง่าย เลือกหมวดเครื่องมือที่สนใจแล้วกดเปิดใช้งานจริงได้ทันที
        </p>
      </div>

      {/* Interactive Category Filter Capsule Bar */}
      <div className="ng-prod-filter-bar" role="tablist" aria-label="กรองหมวดหมู่ผลิตภัณฑ์">
        {FILTER_TABS.map((tab) => {
          const isSelected = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`ng-prod-filter-pill${isSelected ? ' is-active' : ''}`}
              onClick={() => setActiveFilter(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Visual Bento Cards Grid */}
      <div className="ng-products-grid">
        {visibleProducts.map((prod) => {
          const IconComp = prod.icon;
          return (
            <article
              key={prod.id}
              className="ng-product-card"
              style={{ '--prod-accent': prod.accent, '--prod-rgb': prod.rgb }}
            >
              <div className="ng-product-card-header">
                <div className="ng-product-badge-row">
                  <span className="ng-product-num">{prod.number}</span>
                  <span className="ng-product-badge" style={{ color: prod.accent }}>
                    {prod.badge}
                  </span>
                </div>
                <div className="ng-product-icon-wrap" style={{ color: prod.accent }}>
                  <IconComp size={20} />
                </div>
              </div>

              {/* Visual SVG Dashboard Preview */}
              <Link href={prod.targetUrl} className="ng-prod-visual-box" aria-label={`เปิด ${prod.title}`}>
                <ProductVisualArt type={prod.visualType} accent={prod.accent} />
              </Link>

              <div className="ng-product-card-body">
                <h3 className="ng-product-title">{prod.title}</h3>
                <h4 className="ng-product-subtitle" style={{ color: prod.accent }}>
                  {prod.subtitle}
                </h4>
                <p className="ng-product-tagline">{prod.tagline}</p>

                <div className="ng-product-pills">
                  {prod.metrics.map((item, idx) => (
                    <span key={idx} className="ng-inside-pill">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="ng-product-card-footer">
                <Link href={prod.targetUrl} className="ng-product-action-btn">
                  <span>เข้าใช้งานทันที</span>
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {/* Pro Analysis 6-Dimension Visual Strip */}
      <div id="pro-analysis-suite" className="ng-pro-analysis-wrap" style={{ scrollMarginTop: '88px' }}>
        <div className="ng-pro-analysis-banner">
          <div className="ng-pro-banner-content">
            <span className="ng-pro-badge">
              <Sparkles size={14} /> 6-DIMENSION PRO SUITE
            </span>
            <h3>6 มิติวิเคราะห์ตลาดครบวงจร</h3>
            <p>คลิกเลือกมิติที่ต้องการเพื่อเปิดหน้าเครื่องมือวิเคราะห์ได้ทันที</p>
          </div>
          <Link href="/markets" className="ng-pro-hub-link">
            เปิดดูทุกตลาดใน Hub <ArrowUpRight size={16} />
          </Link>
        </div>

        <div className="ng-analysis-tools-grid">
          {PRO_ANALYSIS_TOOLS.map((tool) => {
            const ToolIcon = tool.icon;
            return (
              <Link key={tool.id} href={tool.link} className="ng-tool-card">
                <div className="ng-tool-icon-row">
                  <div className="ng-tool-icon" style={{ color: tool.accent }}>
                    <ToolIcon size={18} />
                  </div>
                  <div>
                    <span className="ng-tool-dimension">{tool.dimension}</span>
                    <h4>{tool.title}</h4>
                  </div>
                  <ArrowUpRight size={15} style={{ marginLeft: 'auto', color: tool.accent }} />
                </div>
                <p>{tool.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile-Ready Banner */}
      <div className="ng-mobile-ready-banner">
        <div className="ng-mobile-ready-left">
          <div className="ng-mobile-icon-circle">
            <Smartphone size={26} />
          </div>
          <div>
            <h4>รองรับมือถือ &amp; แท็บเล็ตเต็มรูปแบบ (PWA Ready)</h4>
            <p>เปิดกราฟ ฟังเสียงแจ้งเตือนน้องนักออม AI และเช็คพอร์ตได้ทุกที่ตลอด 24 ชม.</p>
          </div>
        </div>
        <div className="ng-mobile-ready-right">
          <Link href="/thai" className="ng-pwa-pill">
            <Radio size={14} /> เปิดกระดานหุ้นไทย
          </Link>
          <Link href="/account" className="ng-pwa-pill">
            <ShieldCheck size={14} /> เชื่อมต่อ LINE
          </Link>
        </div>
      </div>
    </section>
  );
}
