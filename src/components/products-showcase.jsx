import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BellRing,
  CheckCircle2,
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
    id: 'multi-scanner',
    number: '01',
    title: 'Multi-Market Realtime Scanner',
    subtitle: 'สแกนตลาดหุ้นไทย & DR พร้อมกัน อัตโนมัติ',
    tagline: 'ตรวจจับโอกาสทั่วกระดานหุ้นไทย SET100, mai และ DR80/DR23',
    badge: 'REALTIME CORE',
    accent: '#0284c7',
    icon: Scan,
    targetUrl: '/dr-strategy',
    features: [
      'สแกนตลาดหุ้นไทยและ DR พร้อมกันในแผงควบคุมเดียว',
      'จัดอันดับด้วย AI Score, ATR Volatility และ RVOL',
      'ตัวกรอง Multi-Criteria ตามสไตล์ Daytrade และ Swing',
    ],
    highlights: [
      { label: 'โฟกัสกระดานไทย & DR', desc: 'ครอบคลุมหุ้นไทย SET100, mai, DR80/DR23 และ TFEX S50' },
      { label: 'จัดอันดับด้วยคะแนน', desc: 'เรียงลำดับความแข็งแกร่งของ Setup ชัดเจน ไม่ต้องไล่ดูกราฟทีละตัว' },
      { label: 'Causal Closed Bar', desc: 'คำนวณจากข้อมูลจริงที่ยืนยันแล้ว ปราศจากการมโนตัวเลข' },
    ],
    whatsInside: [
      'ตัวสแกน Multi-Market พร้อมระบบคัดกรอง',
      'DR80/DR23 Scanner พร้อมโหมดเรียงตามคะแนน 16 แต้ม',
      'ตัววัด Momentum และสภาพคล่องรายตัว',
      'ปุ่มลัดส่งตรงเข้าสู่กราฟวิเคราะห์แบบ Real-time',
    ],
  },
  {
    id: 'signal-radar',
    number: '02',
    title: 'Closed-Bar Signal Engine',
    subtitle: 'สัญญาณเทรดที่อธิบายเหตุผลได้ทุกไม้',
    tagline: 'แผนเทรด Entry / Target / Stop Loss จากแท่งเทียนที่ปิดแล้วจริง',
    badge: 'TRUTHFUL SIGNALS',
    accent: '#10b981',
    icon: Activity,
    targetUrl: '/thai#section-auto-pick',
    features: [
      'แผนเข้า-ออกครบ: Entry, Target (2R), Invalidation Stop',
      'ไม่มี Synthetic Win: สัญญาณไม่แตะเป้าหรือชน Stop บันทึกตามจริง',
      'ยืนยันด้วยแท่งเทียนปิดรอบ ป้องกัน False Breakout',
    ],
    highlights: [
      { label: 'แผนครบทุกเงื่อนไข', desc: 'กำหนดราคาเข้า จุดทำกำไร และจุดตัดขาดทุนชัดเจนก่อนส่งสัญญาณ' },
      { label: 'ไม่เคลมเกินจริง', desc: 'บันทึกประวัติการเทรดแบบตามราคาจริง ไม่มีการนับ Win Rate ปลอม' },
      { label: 'Multi-Timeframe Confirm', desc: 'วิเคราะห์ร่วมระหว่าง Timeframe ใหญ่และเล็กเพื่อเพิ่มความแม่นยำ' },
    ],
    whatsInside: [
      'กระดาน Auto-Pick สัญญาณเทรดสด',
      'ประวัติการเดินทางของสัญญาณ (Signal Journey)',
      'การแจ้งเตือนจังหวะเปลี่ยนสถานะ (Pending → Active → Closed)',
      'แผนภูมิเปรียบเทียบสถิติและ Drawdown รายเดือน',
    ],
  },
  {
    id: 'dr-bridge',
    number: '03',
    title: 'DR Strategy Tracker & Thai Dividend Radar',
    subtitle: 'เจาะลึก DR ด้วย Camarilla + FX Bridge & หุ้นปันผล SETHD',
    tagline: 'Camarilla 8 ระดับ, EMA 25/50/75, Indicative Arbitrage และพอร์ตปันผลไทยมีวินัย',
    badge: 'THAI & DR ECOSYSTEM',
    accent: '#f59e0b',
    icon: Compass,
    targetUrl: '/dr-strategy',
    features: [
      'สแกน DR80 ด้วยคะแนนเต็ม 16 แต้ม (Camarilla + EMA 25/50/75 + RSI + MACD)',
      'คำนวณ Indicative Fair Value และ Arbitrage Spread (Premium / Discount %)',
      'เรดาร์หุ้นปันผลไทย SETHD มีวินัย พร้อมโมเดลจัดสรรพอร์ต 5 ระดับ',
    ],
    highlights: [
      { label: 'Camarilla 8 Levels', desc: 'ระบุ Buy Zone ที่ S2-S3 พร้อมจุดตัดขาดทุน S4 และเป้าหมาย R1/R3' },
      { label: 'FX & Arbitrage Bridge', desc: 'เห็นชัดว่า DR ถูกกว่าหรือแพงกว่าหุ้นแม่ในตลาดโลกกี่เปอร์เซ็นต์' },
      { label: 'พอร์ตปันผลไทย SETHD', desc: 'ปฏิทินวัน XD, Dividend Yield % และ Payout Safety Score' },
    ],
    whatsInside: [
      'แดชบอร์ด DR80 Technical Radar พร้อมแผงคะแนน 16 แต้ม',
      'เครื่องคำนวณ Indicative Price & Arbitrage Sandbox สด',
      'ตารางสแกนหุ้นปันผลไทย SETHD ชั้นนำ (TISCO, SCB, ADVANC, PTT ฯลฯ)',
      'โมเดลสัดส่วนพอร์ตปันผล 5 ระดับ (Defensive, Growth, Financials, REIT, Cash)',
    ],
  },
  {
    id: 'mt5-telemetry',
    number: '04',
    title: 'Forex MT5 Telemetry Bridge',
    subtitle: 'ศูนย์รวมข้อมูล Forex ผ่าน MT5 ไร้ความเสี่ยง',
    tagline: 'ตรวจวัดสถานะ Heartbeat, Latency และความสดใหม่ของโควทแบบ Read-Only',
    badge: 'INSTITUTIONAL BRIDGE',
    accent: '#8b5cf6',
    icon: Cpu,
    targetUrl: '/forex',
    features: [
      'Read-Only Bridge: ปลอดภัย 100% ไม่เก็บพาสเวิร์ด ไม่ส่งคำสั่งแทน',
      'ตรวจวัด Latency และ Heartbeat สม่ำเสมอทุก 30 วินาที',
      'นโยบาย Closed Bar Policy ชัดเจน แยกชัดเจนระหว่าง Live กับ Stale',
    ],
    highlights: [
      { label: 'ความปลอดภัยสูงสุด', desc: 'สถาปัตยกรรม Fail-Closed ไร้สิทธิ์การถอนเงินหรือส่งคำสั่งซื้อขาย' },
      { label: 'Telemetry วัดความเสถียร', desc: 'แสดง Ping, Active Symbols และความสดของฟีดราคาตลอดเวลา' },
      { label: 'สัญญาณระดับสถาบัน', desc: 'ใช้ข้อมูลแท่งเทียนดิบจากเซิร์ฟเวอร์โบรกเกอร์ที่เชื่อมต่อ' },
    ],
    whatsInside: [
      'Forex Connection Panel พร้อมตัววัดสถานะเซิร์ฟเวอร์',
      'กราฟิกสัญญาณและกรอบเวลา 15m / 1h / 4h',
      'เครื่องมือวิเคราะห์ความผันผวนของคู่เงินหลักและทองคำ (XAU/USD)',
      'ระบบสำรองข้อมูลแคชกรณีเครือข่ายขาดการเชื่อมต่อ',
    ],
  },
  {
    id: 'risk-manager',
    number: '05',
    title: 'Risk & Position Manager',
    subtitle: 'คุมความเสี่ยงทุกไม้ คำนวณ Lot แม่นยำ',
    tagline: 'คำนวณขนาดออเดอร์ (Shares, Contracts, Lots) ตามวงเงินความเสี่ยงและความคุ้มค่า 2R',
    badge: 'RISK MATH',
    accent: '#0d9488',
    icon: BarChart3,
    targetUrl: '/risk',
    features: [
      'คำนวณ Lot Size / จำนวนหุ้น / สัญญา TFEX อัตโนมัติ',
      'กำหนดความเสี่ยง 0.5% - 2% ต่อไม้ เพื่อความยั่งยืนของพอร์ต',
      'คำนวณเป้าหมายกำไร 2R/3R และแสดงอัตราส่วน Risk:Reward ชัดเจน',
    ],
    highlights: [
      { label: 'ครอบคลุม 5 ตลาด', desc: 'หุ้นไทย (Board lot 100), TFEX S50, หุ้นสหรัฐฯ, ทองคำ และ Forex' },
      { label: 'เห็นตัวเลขจริงก่อนเข้า', desc: 'ทราบผลขาดทุนสูงสุด (Max Loss) และกำไรที่เป้าหมายเป็นบาท/ดอลลาร์ทันที' },
      { label: 'คำเตือนความเสี่ยง', desc: 'แจ้งเตือนเมื่อระยะ Stop Loss กว้างเกินไปหรือขนาดออเดอร์ไม่ปลอดภัย' },
    ],
    whatsInside: [
      'เครื่องคำนวณ Position Sizing รายตลาด',
      'ตัวคำนวณ Risk / Reward Ratio แบบ Real-time',
      'การประเมินเงินมัดจำ (Margin Requirement)',
      'บันทึกพารามิเตอร์การเทรดก่อนส่งคำสั่ง',
    ],
  },
  {
    id: 'economic-calendar',
    number: '06',
    title: 'Economic Calendar & Macro Impact',
    subtitle: 'รับมือข่าวเศรษฐกิจและดอกเบี้ยก่อนใคร',
    tagline: 'ปฏิทินเศรษฐกิจระดับสถาบัน วิเคราะห์ผลกระทบรายตลาดและข้อควรระวังก่อนเทรด',
    badge: 'MACRO INTEL',
    accent: '#ea580c',
    icon: Newspaper,
    targetUrl: '/calendar',
    features: [
      'คัดกรองเฉพาะเหตุการณ์สำคัญสูง (High Impact) เช่น Fed, กนง., CPI',
      'AI วิเคราะห์ก่อน-หลังประกาศ พร้อมบอกว่ากระทบสินทรัพย์ใด',
      'Actionable Caution: คำแนะนำความเสี่ยงก่อนและหลังตัวเลขออก',
    ],
    highlights: [
      { label: 'โฟกัสตลาดที่เราเทรด', desc: 'ระบุชัดเจนว่าข่าวกระทบ SET, S50, US Equity, ทองคำ หรือ Forex' },
      { label: 'Forecast vs Previous', desc: 'เปรียบเทียบตัวเลขคาดการณ์กับครั้งก่อนหน้าอย่างรวดเร็ว' },
      { label: 'ปลอดภัยรอบข่าว', desc: 'ลดความเสี่ยงจากการถูกลากพอร์ตช่วงสเปรดกว้าง' },
    ],
    whatsInside: [
      'ปฏิทินเศรษฐกิจพร้อมตัวกรองระดับผลกระทบ',
      'ระบบแจ้งเตือนช่วงเวลาสำคัญ (เวลาไทย)',
      'บทวิเคราะห์ผลกระทบต่อสภาพคล่องและทัศนคติของตลาด',
      'ป้ายกำกับสินทรัพย์ที่ได้รับผลกระทบโดยตรง',
    ],
  },
  {
    id: 'developer-api',
    number: '07',
    title: 'Developer API & Structure Playground',
    subtitle: 'Structure API สำหรับคนเขียน EA และบอท',
    tagline: 'ส่งแท่งเทียน 40-500 แท่ง รับโครงสร้าง SMC, BOS, Order Block และแผน 2R เป็น JSON',
    badge: 'DEVELOPER SUITE',
    accent: '#0891b2',
    icon: Cpu,
    targetUrl: '/developers',
    features: [
      'POST JSON แท่งเทียน OHLCV รับผลลัพธ์โครงสร้างใน ~15ms',
      'ตรวจจับ Swing High/Low, BOS, CHoCH, Order Block และ FVG',
      'สร้างแผนเทรด 2R อัตโนมัติพร้อมเหตุผล Invalidation',
    ],
    highlights: [
      { label: 'Bring Your Own Candles', desc: 'สินทรัพย์และ Timeframe ใดก็ได้ที่คุณมีข้อมูล ไม่เก็บข้อมูลของคุณ' },
      { label: 'ตัวอย่างพร้อมใช้ 3 ภาษา', desc: 'cURL สำหรับ Terminal, Python Requests, และ MQL5 สำหรับ MT5' },
      { label: 'Playground ทดสอบสด', desc: 'แก้ไขแท่งเทียนและกดวิเคราะห์โครงสร้างบนหน้าเว็บได้ทันที' },
    ],
    whatsInside: [
      'Interactive API Playground & JSON Editor',
      'Endpoint: POST /api/developers/structure',
      'ตัวอย่างโค้ด MQL5 สำหรับ EA เพื่อดึงแผนเทรดอัตโนมัติ',
      'คำนวณ Breakeven Win Rate ที่ต้องการ (33.3% สำหรับ 2R)',
    ],
  },
  {
    id: 'speech-queue',
    number: '08',
    title: 'Voice Alert & Speech Queue',
    subtitle: 'เสียงแจ้งเตือนน้องนักออมอัจฉริยะ',
    tagline: 'อ่านเหตุการณ์ตลาดและข่าวด่วนภาษาไทย จัดคิวเสียง Web Audio ไม่ทับซ้อน',
    badge: 'SMART AUDIO',
    accent: '#ec4899',
    icon: Volume2,
    targetUrl: '/markets',
    features: [
      'เสียงสังเคราะห์ภาษาไทยเป็นธรรมชาติ (Thai TTS)',
      'Speech Queue ป้องกันเสียงพูดซ้อนทับกันเมื่อมีสัญญาณเข้าพร้อมกัน',
      'แจ้งเตือนข่าวด่วนความสำคัญสูง (Breaking News) ทันเหตุการณ์',
    ],
    highlights: [
      { label: 'ไม่ต้องนั่งเฝ้าจอ', desc: 'ระบบอ่านชื่อหุ้น ทิศทาง และราคาเป้าหมายให้ฟังทันทีที่เกิดสัญญาณ' },
      { label: 'Web Audio Queue', desc: 'จัดลำดับความสำคัญของเสียง สัญญาณเทรดมาก่อน ข่าวทั่วไปมาทีหลัง' },
      { label: 'เปิด-ปิดแยกอิสระ', desc: 'ปรับแต่งระดับเสียง ปิดเฉพาะบางตลาด หรือเปิดฟังทั้งหมดยามขับรถ' },
    ],
    whatsInside: [
      'ตัวควบคุม Sound Monitor Pill ด้านบนของแอป',
      'ตัวแปลงข้อความเป็นเสียงสังเคราะห์ความละเอียดสูง',
      'ฟีดข่าว Macro Breaking News สรุปประเด็นสั้น',
      'บันทึกประวัติการแจ้งเตือนเสียงย้อนหลัง',
    ],
  },
  {
    id: 'coach-audit',
    number: '09',
    title: 'Coach & Signal Audit Ledger',
    subtitle: 'ระบบตรวจสอบผลงานย้อนหลังแบบ Immutable',
    tagline: 'บันทึกประวัติสัญญาณและพอร์ตโค้ชที่แก้ไขย้อนหลังไม่ได้',
    badge: 'TRANSPARENCY',
    accent: '#0284c7',
    icon: ShieldCheck,
    targetUrl: '/coaches',
    features: [
      'บัญชีแยกประเภทผลงานแบบ Append-Only แก้ไขตัวเลขในอดีตไม่ได้',
      'แยกประวัติพอร์ตโค้ช (Paper Trading) ออกจากสถิติระบบอัตโนมัติ',
      'Audit Activity Log แสดง Timestamp และเหตุผลการปรับสถานะทุกขั้นตอน',
    ],
    highlights: [
      { label: 'ความโปร่งใส 100%', desc: 'ตรวจสอบได้ทุกไม้ว่าส่งเวลาใด ราคาใด และปิดผลด้วยเหตุผลใด' },
      { label: 'มุมมอง Coach พรีเมียม', desc: 'ติดตามแนวคิดการจัดพอร์ตและมุมมองตลาดจากผู้เชี่ยวชาญ' },
      { label: 'ตัวกรองหลายมิติ', desc: 'ค้นหาผลงานตามประเภทตลาด ฝั่ง Long/Short หรือระดับผลตอบแทน' },
    ],
    whatsInside: [
      'Coach Dashboard พร้อมสถิติพอร์ตจำลอง',
      'Audit Activity Log บันทึกทุกธุรกรรมแบบเรียงตามเวลา',
      'ตัวกรองค้นหาประวัติรายสินทรัพย์',
      'สรุป Drawdown และ Profit Factor ตามสูตรมาตรฐานสากล',
    ],
  },
];

export const PRO_ANALYSIS_TOOLS = [
  {
    id: 'smc-structure',
    title: 'Smart Money & Structure Engine',
    dimension: 'มิติที่ 1',
    category: 'Market Structure',
    desc: 'จับโครงสร้างราคา Break of Structure (BOS), Change of Character (CHoCH) และ Order Block บนกราฟแท่งเทียน',
    icon: Layers,
    badge: 'STRUCTURE',
    link: '/developers',
  },
  {
    id: 'causal-trend',
    title: 'Causal Trend & RVOL Filter',
    dimension: 'มิติที่ 2',
    category: 'Volume & Momentum',
    desc: 'คำนวณ Relative Volume และแนวโน้มอย่างเป็นเหตุเป็นผล ปราศจากการดึงข้อมูลในอนาคต (No Look-ahead Bias)',
    icon: TrendingUp,
    badge: 'MOMENTUM',
    link: '/daytrade',
  },
  {
    id: 'risk-calculator',
    title: 'Dynamic 2R Risk/Reward Engine',
    dimension: 'มิติที่ 3',
    category: 'Risk Management',
    desc: 'คำนวณตำแหน่ง Stop Loss และ Take Profit อัตโนมัติโดยอิงจาก Average True Range (ATR) รักษาอัตราผลตอบแทนขั้นต่ำ 2R',
    icon: BarChart3,
    badge: 'RISK MATH',
    link: '/risk',
  },
  {
    id: 'macro-sentiment',
    title: 'Realtime Macro & RSS Intelligence',
    dimension: 'มิติที่ 4',
    category: 'News & Sentiment',
    desc: 'ดึงข้อมูลข่าวสารตลาดและปฏิทินเศรษฐกิจ คัดกรองเฉพาะหัวข้อที่มีผลกระทบต่อสินทรัพย์จริง พร้อมแจ้งเตือนข่าวด่วน',
    icon: Newspaper,
    badge: 'MACRO',
    link: '/calendar',
  },
  {
    id: 'mtf-confluence',
    title: 'Multi-Timeframe Confluence',
    dimension: 'มิติที่ 5',
    category: 'Multi-Frame',
    desc: 'ตรวจสอบความสอดคล้องระหว่างกรอบเวลารายวัน (Day), 4 ชั่วโมง (4H) และ 15 นาที (15M) ก่อนยืนยันแผนเทรด',
    icon: Clock,
    badge: 'CONFLUENCE',
    link: '/thai#section-auto-pick',
  },
  {
    id: 'ledger-telemetry',
    title: 'Next-Action & Account Telemetry',
    dimension: 'มิติที่ 6',
    category: 'Account Intelligence',
    desc: 'วิเคราะห์สถานะบัญชี โควต้าการใช้งาน และแนะนำขั้นตอนถัดไป (Next Action) ที่เหมาะสมสำหรับพอร์ตของคุณ',
    icon: LineChart,
    badge: 'TELEMETRY',
    link: '/account',
  },
];

export default function ProductsShowcase() {
  return (
    <section id="products-suite" className="ng-section ng-products-suite" aria-labelledby="products-title">
      <div className="ng-section-heading">
        <div>
          <span className="ng-kicker">02 / PRODUCTS &amp; ANALYSIS ECOSYSTEM</span>
          <h2 id="products-title">
            ผลิตภัณฑ์ระดับสถาบัน<br />
            <span>ครบ จบ ในแพลตฟอร์มเดียว</span>
          </h2>
        </div>
        <p>
          ระบบนิเวศการลงทุนที่ออกแบบมาให้โปร่งใส ตรวจสอบย้อนกลับได้ทุกมิติ
          ตั้งแต่สแกนเนอร์ สัญญาณเทรด ไปจนถึงเครื่องมือวิเคราะห์ระดับโปร
        </p>
      </div>

      {/* Grid of Core Products */}
      <div className="ng-products-grid">
        {CORE_PRODUCTS.map((prod) => {
          const IconComp = prod.icon;
          return (
            <article key={prod.id} className="ng-product-card" style={{ '--prod-accent': prod.accent }}>
              <div className="ng-product-card-header">
                <div className="ng-product-badge-row">
                  <span className="ng-product-num">{prod.number}</span>
                  <span className="ng-product-badge">{prod.badge}</span>
                </div>
                <div className="ng-product-icon-wrap" style={{ color: prod.accent }}>
                  <IconComp size={24} />
                </div>
              </div>

              <div className="ng-product-card-body">
                <h3 className="ng-product-title">{prod.title}</h3>
                <h4 className="ng-product-subtitle">{prod.subtitle}</h4>
                <p className="ng-product-tagline">{prod.tagline}</p>

                <div className="ng-product-features-box">
                  <div className="ng-product-box-title">จุดเด่นสำคัญ:</div>
                  <ul className="ng-product-features-list">
                    {prod.features.map((feat, idx) => (
                      <li key={idx}>
                        <CheckCircle2 size={14} className="ng-check-icon" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="ng-product-highlights-box">
                  <div className="ng-product-box-title">ความสามารถในระบบ (What's Inside):</div>
                  <div className="ng-product-pills">
                    {prod.whatsInside.slice(0, 3).map((item, idx) => (
                      <span key={idx} className="ng-inside-pill">{item}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="ng-product-card-footer">
                <Link href={prod.targetUrl} className="ng-product-action-btn">
                  <span>เปิดใช้งานผลิตภัณฑ์</span>
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {/* Pro Analysis Suite Section */}
      <div id="pro-analysis-suite" className="ng-pro-analysis-wrap" style={{ scrollMarginTop: '80px' }}>
        <div className="ng-pro-analysis-banner">
          <div className="ng-pro-banner-content">
            <span className="ng-pro-badge">
              <Sparkles size={14} /> PRO ANALYSIS SUITE
            </span>
            <h3>ชุดเครื่องมือวิเคราะห์เชิงลึกระดับสถาบัน</h3>
            <p>
              ครอบคลุมทั้ง 6 มิติหลักของการวิเคราะห์ตลาด ออกแบบมาให้ทำงานสอดประสานกัน
              เพิ่มความแม่นยำในการคัดกรองความน่าจะเป็นสูง
            </p>
          </div>
          <Link href="/markets" className="ng-pro-hub-link">
            ดูภาพรวมใน Workspace Hub <ArrowUpRight size={16} />
          </Link>
        </div>

        <div className="ng-analysis-tools-grid">
          {PRO_ANALYSIS_TOOLS.map((tool) => {
            const ToolIcon = tool.icon;
            return (
              <Link key={tool.id} href={tool.link} className="ng-tool-card" style={{ textDecoration: 'none' }}>
                <div className="ng-tool-header">
                  <span className="ng-tool-dimension">{tool.dimension}</span>
                  <span className="ng-tool-category">{tool.category}</span>
                </div>
                <div className="ng-tool-icon-row">
                  <div className="ng-tool-icon">
                    <ToolIcon size={20} />
                  </div>
                  <h4>{tool.title}</h4>
                </div>
                <p>{tool.desc}</p>
                <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', fontSize: '11px', fontWeight: '700', color: '#0284c7' }}>
                  <span>เปิดเครื่องมือนี้</span>
                  <ArrowUpRight size={13} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile-Ready Banner */}
      <div className="ng-mobile-ready-banner">
        <div className="ng-mobile-ready-left">
          <div className="ng-mobile-icon-circle">
            <Smartphone size={28} />
          </div>
          <div>
            <h4>รองรับการใช้งานบนมือถืออย่างสมบูรณ์แบบ (PWA &amp; Mobile First)</h4>
            <p>
              ใช้งานผ่านสมาร์ตโฟนได้ทุกระบบด้วยความลื่นไหลระดับ Native App
              พร้อม Mobile Bottom Navigation Bar และโหมดคอนทราสต์ชัดเจนแม้อยู่กลางแจ้ง
            </p>
          </div>
        </div>
        <div className="ng-mobile-ready-right">
          <span className="ng-pwa-pill"><Radio size={14} /> Realtime Push &amp; Voice</span>
          <span className="ng-pwa-pill"><ShieldCheck size={14} /> 100% Fail-Closed Safe</span>
        </div>
      </div>
    </section>
  );
}
