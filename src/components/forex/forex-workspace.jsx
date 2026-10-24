"use client";
import {SoundControl,AlertHistory} from "../monitor/monitor-provider.jsx";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  BookOpen,
  Bot,
  Cable,
  CalendarDays,
  CandlestickChart as ChartIcon,
  Globe2,
  LayoutDashboard,
  ListFilter,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import MarketNavigation from "../market-navigation.jsx";
import DaytradePanel from "../daytrade/daytrade-panel.jsx";
import ProCopyEaDesk from "./pro-copy-ea-desk.jsx";
import {useDeskResource} from "../use-desk-resource.jsx";
import { CORE_FOREX } from "../../daytrade/universe.mjs";
import MemberAvatar from "../member-avatar.jsx";
import useMt5Connection from "./use-mt5-connection.jsx";
import ConnectionPanel from "./connection-panel.jsx";
import InstrumentUniverse from "./instrument-universe.jsx";
import TerminalChart, { DemoBadge } from "./terminal-chart.jsx";
import {
  AiAnalysis,
  Heatmap,
  Sessions,
  Calendar,
  Alerts,
} from "./terminal-panels.jsx";
import {
  STARTER_UNIVERSE,
  filterUniverse,
  resolveInitialInstrument,
} from "./symbol-universe.mjs";
import { demoBars, demoQuote, formatDemoPrice } from "./terminal-demo.mjs";
import styles from "./forex-workspace.module.css";

const SECTIONS = [
  {
    id: "pro-ea",
    label: "Pro Copy EA (สาย Stable)",
    icon: Bot,
    badge: "Hot",
    description: "ถอดรหัสกลยุทธ์ EA สเตเบิ้ล · ระบบล็อคกำไรหน้าทุน (+0.5R) & บันทึก P/L 100 ไม้",
  },
  {
    id: "scanner",
    label: "สแกนเนอร์สัญญาณ 15m",
    icon: ListFilter,
    badge: "MT5",
    description: "เรดาร์แท่งเทียนปิด 15 นาทีจาก MT5 · ทองคำและคู่เงินตามสัญลักษณ์ของโบรกเกอร์",
  },
  {
    id: "chart",
    label: "กราฟเทคนิค & แผนเทรด",
    icon: ChartIcon,
    badge: "Chart",
    description: "กราฟแท่งเทียนความละเอียดสูง พร้อมพิกัดเข้า Entry, SL, TP 2R และบริบท AI",
  },
  {
    id: "alerts",
    label: "แจ้งเตือน Telegram & เสียง",
    icon: Bell,
    badge: "Free",
    description: "รับสัญญาณสดเข้ามือถือผ่าน Telegram VIP (ฟรี 100%) และเสียงน้องนักออมภาษาไทย",
  },
];
export default function ForexWorkspace({ initialSymbol = null, viewer = null }) {
  const performance=useDeskResource('/api/daytrade?market=forex&compact=1',{interval:30000});
  const fmt=v=>Number.isFinite(v)?v.toFixed(2):'—';
  const METRICS=[
    ['Win rate',fmt(performance.data?.summary?.winRate)+'%',String(performance.data?.summary?.closed??0)+' ไม้ปิด','positive'],
    ['Profit Factor',fmt(performance.data?.summary?.profitFactor),'จากบันทึกสัญญาณ','positive'],
    ['Max Drawdown',fmt(performance.data?.summary?.maxDrawdownR)+' R','จากบันทึกสัญญาณ',''],
    ['Net Return',fmt(performance.data?.summary?.netR)+' R','ผลสัญญาณอ้างอิง','positive'],
    ['สินทรัพย์พร้อม',String(performance.data?.coverage?.ready??0),'จาก MT5',''],
    ['ระบบสแกน 15m',performance.data?.connection||'รอเชื่อม',performance.data?.generatedAt||performance.error||'กำลังโหลด','']
  ];
  const [section, setSection] = useState("pro-ea");
  const [demoPreview, setPreview] = useState(false);
  const [frame, setFrame] = useState("1h");
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all");
  const [favorites, setFavorites] = useState([]),
    [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selection, setSelected] = useState(() =>
    resolveInitialInstrument(initialSymbol ?? "XAU/USD"),
  );
  const bridge = useMt5Connection(selection.broker_symbol, frame);
  const hasMt5 = Boolean(bridge.snapshot?.instruments.length);
  const universe = (hasMt5 ? bridge.snapshot.instruments : STARTER_UNIVERSE).filter(i => CORE_FOREX.includes(i.canonical_symbol));
  const selected =
    universe.find((item) => item.id === selection.id) ??
    universe.find(
      (item) =>
        item.canonical_symbol &&
        item.canonical_symbol === selection.canonical_symbol,
    ) ??
    universe[0] ?? selection;
  const preview = process.env.NODE_ENV === "development" && demoPreview && !hasMt5;
  useEffect(() => {
    if (hasMt5 && selection.id !== selected.id) setSelected(selected);
  }, [hasMt5, selection.id, selected]);
  const [entries, setEntries] = useState([]);
  const [alertSettings, setAlertSettings] = useState({
    Price: false,
    AI: false,
    News: false,
    MT5: false,
  });
  const visible = useMemo(
    () =>
      filterUniverse(universe, {
        query,
        category,
        favorites: favoritesOnly ? favorites : null,
      }),
    [universe, query, category, favorites, favoritesOnly],
  );
  const toggleFavorite = (id) =>
    setFavorites((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );
  const focusAsset = (item) => {
    setSelected(item);
    setSection("chart");
  };
  const current = SECTIONS.find((item) => item.id === section);
  const scannerProps = {
    instruments: universe,
    visible,
    query,
    onQuery: setQuery,
    category,
    onCategory: setCategory,
    favorites,
    onFavorite: toggleFavorite,
    selected,
    onSelect: focusAsset,
    favoritesOnly,
    onFavoritesOnly: setFavoritesOnly,
    preview,
    quotes: bridge.quotes,
    mt5: hasMt5,
    onNavigate: setSection,
  };
  const chartProps = {
    instrument: selected,
    instruments: universe,
    onSelect: setSelected,
    preview,
    frame,
    onFrame: setFrame,
    quote: Object.hasOwn(bridge.quotes, selected.broker_symbol)
      ? bridge.quotes[selected.broker_symbol]
      : null,
    chart: bridge.chart,
    mt5: hasMt5,
    favorites,
    onFavorite: toggleFavorite,
  };
  const tickerSymbols = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY"];
  return (
    <div className={styles.workspace}>
      <a className={styles.skipLink} href="#forex-content">
        ข้ามไปยังเนื้อหา
      </a>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>N</span>
          <span>
            NUGAOM<small>MARKET INTELLIGENCE</small>
          </span>
        </Link>
        <span className={styles.sidebarLabel}>YOUR MARKETS</span>
        <MarketNavigation current="forex" />
        <span className={styles.sidebarLabel}>FOREX COMMAND CENTER</span>
        <nav className={styles.subnavigation} aria-label="Forex Command Center">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => setSection(item.id)}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
              {section === item.id && <i />}
            </button>
          ))}
        </nav>
        <nav className={styles.memberLinks} aria-label="พื้นที่สมาชิก">
          <Link href="/account">{viewer ? 'บัญชีของฉัน' : 'เข้าสู่ระบบด้วย LINE'}</Link>
          <Link href="/community">ห้องสมาชิกและคุยกับทีม</Link>
        </nav>
        <div className={styles.sidebarFoot}>
          <span className={styles.brokerLogo}>✦</span>
          <div>
            <strong>Zero-Custody</strong>
            <small>
              {hasMt5
                ? `MT5 Bridge · ${universe.length} symbols`
                : "ใช้ได้กับทุกโบรกเกอร์ (Exness, XM, IC Markets)"}
            </small>
          </div>
          <span className={styles.dot} />
        </div>
        <span className={styles.sidebarCopyright}>FOREX &amp; GOLD · PRO RADAR</span>
      </aside>
      <main id="forex-content" className={styles.main} tabIndex={-1}>
        <header className={styles.topbar}>
          <label className={styles.topSearch}>
            <Search size={14} />
            <input
              aria-label="ค้นหาตลาดจากแถบด้านบน"
              placeholder="Search symbol…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSection("scanner");
              }}
            />
          </label>
          <div className={styles.ticker}>
            {tickerSymbols.map((symbol) => {
              const item = universe.find(
                  (asset) => asset.canonical_symbol === symbol,
                ),
                quote = item
                  ? preview
                    ? demoQuote(item)
                    : Object.hasOwn(bridge.quotes, item.broker_symbol)
                      ? bridge.quotes[item.broker_symbol]
                      : null
                  : null;
              if (!item) return null;
              return (
                <button key={symbol} onClick={() => focusAsset(item)}>
                  <strong>{symbol}</strong>
                  <span>
                    {hasMt5 && quote
                      ? quote.price.toFixed(item.digits ?? 5)
                      : formatDemoPrice(item, quote?.price)}
                  </span>
                  <b
                    className={
                      quote?.change < 0 ? styles.negative : styles.positive
                    }
                  >
                    {quote?.change !== undefined
                      ? `${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)}%`
                      : "—"}
                  </b>
                </button>
              );
            })}
          </div>
          <div className={styles.topActions}><SoundControl/>
            {hasMt5 ? (
              <span className={styles.demoBadge}>MT5 / READ ONLY</span>
            ) : (
              <DemoBadge enabled={preview} />
            )}
            <button
              className={styles.iconButton}
              aria-label="เปิดการแจ้งเตือน Forex"
              onClick={() => setSection("alerts")}
            >
              <Bell size={16} />
            </button>
            <Link href="/account" className={styles.memberProfile}>
              <span className={styles.guestAvatar}>{viewer ? <MemberAvatar account={viewer} size={28}/> : 'G'}</span>
              <span className={styles.guestName}>
                {viewer?.displayName || 'Guest'}<small>{viewer ? 'บัญชี LINE ของคุณ' : 'เข้าสู่ระบบด้วย LINE'}</small>
              </span>
            </Link>
          </div>
        </header>
        <div className={styles.content}>
          <div className={styles.modeBar}>
            <span>
              <i className={styles.dot} />
              <strong>
                {hasMt5 ? `Vantage MT5 · ${bridge.status}` : "MT5 ยังไม่เชื่อม"}
              </strong>{" "}
              ·{" "}
              {hasMt5
                ? `${universe.length} สินทรัพย์จาก ${bridge.server} · ราคาบางตัวอาจขาดช่วง · ยังไม่มีข้อมูลพอร์ตหรือ AI จริง`
                : preview
                  ? "ข้อมูลตัวอย่างสำหรับทดลองหน้าจอ ไม่มีราคา บัญชี หรือสัญญาณจริง"
                  : "Guest mode · รายการหลัก 9 สัญลักษณ์ ไม่มีฟีดราคา"}
            </span>
            <button
              aria-pressed={preview}
              disabled={hasMt5 || process.env.NODE_ENV !== "development"}
              onClick={() => setPreview((value) => !value)}
            >
              {hasMt5
                ? "MT5 / READ ONLY"
                : preview
                  ? "DEMO PREVIEW"
                  : "GUEST / NO FEED"}{" "}
              <span className={styles.modeToggle}>
                <i />
              </span>
            </button>
          </div>
          <label className={styles.mobileNavigation}>
            FOREX TOOLS
            <select
              aria-label="หน้าเครื่องมือ Forex"
              value={section}
              onChange={(event) => setSection(event.target.value)}
            >
              {SECTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <section className={styles.hero}>
            <div className={styles.heroGlobe}>
              <Globe2 size={110} strokeWidth={0.75} />
              <i />
              <b />
            </div>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>
                PRO COPY EA &amp; 15M DAYTRADE RADAR
              </span>
              <h1>FOREX &amp; GOLD INTELLIGENCE DESK</h1>
              <p>
                ถอดรหัสกลยุทธ์ EA สเตเบิ้ล · ระบบล็อคกำไรหน้าทุน (+0.5R) · สรุป Win/Loss โปร่งใส · ปลอดภัย ไม่ต้องเชื่อมรหัสพอร์ต
              </p>
              <div>
                <span>
                  <i className={styles.greenDot} />
                  Zero-Custody (ทุกโบรกเกอร์)
                </span>
                <span>🛡️ ล็อคกำไร Breakeven +0.5R</span>
                <span>⚡ สัญญาณ Telegram VIP ฟรี</span>
              </div>
            </div>
            <svg
              className={styles.heroCandles}
              viewBox="0 0 400 150"
              aria-hidden="true"
            >
              {Array.from({ length: 28 }, (_, index) => (
                <g
                  key={index}
                  stroke={index % 5 === 0 ? "#e15c76" : "#14d5b0"}
                  fill={index % 5 === 0 ? "#e15c76" : "#14d5b0"}
                  opacity=".45"
                >
                  <line
                    x1={index * 14}
                    x2={index * 14}
                    y1={110 - index * 2 - Math.sin(index) * 16}
                    y2={140 - index * 2 - Math.sin(index) * 16}
                  />
                  <rect
                    x={index * 14 - 3}
                    y={120 - index * 2 - Math.sin(index) * 16}
                    width="6"
                    height="13"
                  />
                </g>
              ))}
            </svg>
            <div className={styles.heroSession}>
              <span>
                CONNECTION STATUS <span className={styles.demoBadge}>{bridge.status === "ready" ? "MT5 CONNECTED" : "DATA UNAVAILABLE"}</span>
              </span>
              <strong>
                {bridge.status === "ready" ? "ฟีดจาก MT5 ของคุณ" : "รอข้อมูลจาก MT5"}
              </strong>
              <small>
                {hasMt5
                  ? `เชื่อมต่อฟีด MT5 (${universe.length} สัญลักษณ์)`
                  : "ยังไม่มีแท่งราคาจริงสำหรับสร้างสัญญาณ"}
              </small>
              <i>
                <b style={{ width: bridge.status === "ready" ? "100%" : "0%" }} />
              </i>
              <div>
                <span>Sydney</span>
                <span>Tokyo</span>
                <span style={{ color: "#22d3ee", fontWeight: 700 }}>London</span>
                <span style={{ color: "#22d3ee", fontWeight: 700 }}>New York</span>
              </div>
            </div>
          </section>

          <div className={styles.metrics}>
            {METRICS.map(([label, value, note, tone]) => (
              <div key={label}>
                <span>
                  {label}
                </span>
                <strong
                  className={
                    tone === "positive"
                      ? styles.positive
                      : tone === "negative"
                        ? styles.negative
                        : ""
                  }
                >
                  {value}
                </strong>
                <small>{note}</small>
              </div>
            ))}
          </div>

          <nav className={styles.sectionTabs} aria-label="มุมมอง Forex">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                aria-current={section === item.id ? "page" : undefined}
                onClick={() => setSection(item.id)}
              >
                <item.icon size={15} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {section === "pro-ea" && (
            <>
              <ProCopyEaDesk bridge={bridge} viewer={viewer} />
              <div className={styles.twoColumns}>
                <Sessions preview={preview} />
                <Calendar preview={preview} compact />
              </div>
            </>
          )}

          {section === "scanner" && (
            <>
              <DaytradePanel market="forex" id="forex-scanner" />
              <InstrumentUniverse {...scannerProps} />
              <div className={styles.scannerFoot}>
                <ShieldCheck size={14} />
                รายการหลัก FX 7 คู่ · ทองและเงิน COMEX 2 รายการ · สแกนแท่งเทียนปิดจริง 15 นาที
              </div>
            </>
          )}

          {section === "chart" && (
            <div className={styles.chartGrid}>
              <TerminalChart {...chartProps} expanded />
              <AiAnalysis instrument={selected} preview={preview} />
            </div>
          )}

          {section === "alerts" && (
            <>
              <Alerts enabled={alertSettings} onChange={setAlertSettings} />
              <AlertHistory />
            </>
          )}

          <details className={styles.devToolsAccordion}>
            <summary>⚙️ เครื่องมือวิศวกรรมข้อมูลตลาด &amp; สถานะบริดจ์ (Market Depth &amp; Bridge Diagnostics)</summary>
            <div className={styles.twoColumns} style={{ marginTop: '1rem' }}>
              <Heatmap
                quotes={bridge.quotes}
                mt5={hasMt5}
                instruments={universe}
                onSelect={focusAsset}
                preview={preview}
                compact
              />
              <ConnectionPanel bridge={bridge} />
            </div>
          </details>
          <footer className={styles.footer}>
            <span>NUGAOM / FOREX & CFD DESK</span>
            <span>
              {hasMt5
                ? "MT5 / READ ONLY"
                : preview
                  ? "DEMO DATA · NOT LIVE"
                  : "GUEST / FALLBACK"}{" "}
              · ไม่มีการส่งคำสั่งซื้อขาย
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
