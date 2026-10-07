"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  BookOpen,
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
import ConnectionPanel from "./connection-panel.jsx";
import InstrumentUniverse from "./instrument-universe.jsx";
import TerminalChart, { DemoBadge } from "./terminal-chart.jsx";
import {
  Opportunities,
  AiAnalysis,
  Heatmap,
  Sessions,
  Calendar,
  AccountPanel,
  RiskPanel,
  Journal,
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
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    description: "ภาพรวมตลาดและเครื่องมือ Forex ในหน้าเดียว",
  },
  {
    id: "scanner",
    label: "Scanner",
    icon: ListFilter,
    description: "ค้นหา กรอง และติดตามสินทรัพย์ในรายการตลาด",
  },
  {
    id: "chart",
    label: "Advanced Chart",
    icon: ChartIcon,
    description: "กราฟราคา อินดิเคเตอร์ และบริบทของสินทรัพย์ที่เลือก",
  },
  {
    id: "connection",
    label: "MT5 connection",
    icon: Cable,
    description: "เตรียมเชื่อมบัญชี Vantage และซิงก์สินทรัพย์จาก MT5",
  },
  {
    id: "positions",
    label: "Positions",
    icon: Wallet,
    description: "สถานะบัญชี คำสั่งรอดำเนินการ และประวัติ",
  },
  {
    id: "risk",
    label: "Risk Management",
    icon: ShieldCheck,
    description: "ภาพรวมความเสี่ยงและเครื่องมือคำนวณจากค่าที่กรอก",
  },
  {
    id: "analysis",
    label: "AI Analysis",
    icon: Sparkles,
    description: "หน้าตัวอย่างบทวิเคราะห์ คะแนน และบริบทของราคา",
  },
  {
    id: "journal",
    label: "Trade Journal",
    icon: BookOpen,
    description: "บันทึกแผนและบทเรียนชั่วคราวในหน้านี้",
  },
  {
    id: "calendar",
    label: "News & Calendar",
    icon: CalendarDays,
    description: "ตัวอย่างหน้าข่าวและปฏิทินเหตุการณ์เศรษฐกิจ",
  },
  {
    id: "alerts",
    label: "AI Alerts",
    icon: Bell,
    description: "ทดลองตั้งค่าหน้าจอแจ้งเตือน ยังไม่ส่งแจ้งเตือนจริง",
  },
];
const METRICS = [
  ["Account equity", "$10,240.50", "ตัวอย่างพอร์ตบัญชี", "neutral"],
  ["Today P/L", "+$240.50", "+2.40% · Demo", "positive"],
  ["Win rate (30D)", "68.2%", "ตัวอย่างผลย้อนหลัง", "positive"],
  ["Drawdown", "4.1%", "ตัวอย่างการติดตามความเสี่ยง", "negative"],
  ["Open positions", "3", "ตัวอย่างสถานะเปิด", "neutral"],
  ["Pending orders", "2", "ตัวอย่างคำสั่งรอ", "neutral"],
];

export default function ForexWorkspace({ initialSymbol = null }) {
  const [section, setSection] = useState("overview");
  const [preview, setPreview] = useState(true);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all");
  const [favorites, setFavorites] = useState([]),
    [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState(() =>
    resolveInitialInstrument(initialSymbol ?? "XAU/USD"),
  );
  const [entries, setEntries] = useState([]);
  const [alertSettings, setAlertSettings] = useState({
    Price: false,
    AI: false,
    News: false,
    MT5: false,
  });
  const visible = useMemo(
    () =>
      filterUniverse(STARTER_UNIVERSE, {
        query,
        category,
        favorites: favoritesOnly ? favorites : null,
      }),
    [query, category, favorites, favoritesOnly],
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
    instruments: STARTER_UNIVERSE,
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
    onNavigate: setSection,
  };
  const chartProps = {
    instrument: selected,
    instruments: STARTER_UNIVERSE,
    onSelect: setSelected,
    preview,
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
        <div className={styles.sidebarFoot}>
          <span className={styles.brokerLogo}>V</span>
          <div>
            <strong>Vantage MT5</strong>
            <small>ยังไม่เชื่อมบัญชี</small>
          </div>
          <span className={styles.dot} />
        </div>
        <span className={styles.sidebarCopyright}>FOREX / CFD · PHASE 01</span>
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
              const item = STARTER_UNIVERSE.find(
                  (asset) => asset.canonical_symbol === symbol,
                ),
                quote = preview ? demoQuote(item) : null;
              return (
                <button key={symbol} onClick={() => focusAsset(item)}>
                  <strong>{symbol}</strong>
                  <span>{formatDemoPrice(item, quote?.price)}</span>
                  <b
                    className={
                      quote?.change < 0 ? styles.negative : styles.positive
                    }
                  >
                    {quote
                      ? `${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)}%`
                      : "—"}
                  </b>
                </button>
              );
            })}
          </div>
          <div className={styles.topActions}>
            <DemoBadge enabled={preview} />
            <button
              className={styles.iconButton}
              aria-label="เปิดการแจ้งเตือน Forex"
              onClick={() => setSection("alerts")}
            >
              <Bell size={16} />
            </button>
            <span className={styles.guestAvatar}>G</span>
            <span className={styles.guestName}>
              Guest<small>Vantage desk</small>
            </span>
          </div>
        </header>
        <div className={styles.content}>
          <div className={styles.modeBar}>
            <span>
              <i className={styles.dot} />
              <strong>MT5 ยังไม่เชื่อม</strong> ·{" "}
              {preview
                ? "ข้อมูลตัวอย่างสำหรับทดลองหน้าจอ ไม่มีราคา บัญชี หรือสัญญาณจริง"
                : "Guest mode · รายการเริ่มต้น 19 สัญลักษณ์ ไม่มีฟีดราคา"}
            </span>
            <button
              aria-pressed={preview}
              onClick={() => setPreview((value) => !value)}
            >
              {preview ? "DEMO PREVIEW" : "GUEST / NO FEED"}{" "}
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
          {section === "overview" ? (
            <>
              <section className={styles.hero}>
                <div className={styles.heroGlobe}>
                  <Globe2 size={110} strokeWidth={0.75} />
                  <i />
                  <b />
                </div>
                <div className={styles.heroCopy}>
                  <span className={styles.eyebrow}>
                    NUGAOM / GLOBAL TRADING DESK
                  </span>
                  <h1>FOREX COMMAND CENTER</h1>
                  <p>
                    สแกน · วิเคราะห์ · ติดตามตลาด · เตรียมเชื่อม Vantage MT5
                  </p>
                  <div>
                    <span>
                      <i className={styles.greenDot} />
                      19 starter symbols
                    </span>
                    <span>9 asset categories</span>
                    <span>Vantage only</span>
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
                    MARKET STATUS <DemoBadge enabled={preview} />
                  </span>
                  <strong>
                    {preview ? "New York Session" : "Waiting for MT5"}
                  </strong>
                  <small>
                    {preview
                      ? "ตัวอย่างภาพรวมช่วงตลาด"
                      : "ยังไม่มีข้อมูลจากโบรกเกอร์"}
                  </small>
                  <i>
                    <b style={{ width: preview ? "72%" : "0%" }} />
                  </i>
                  <div>
                    <span>Sydney</span>
                    <span>Tokyo</span>
                    <span>London</span>
                    <span>New York</span>
                  </div>
                </div>
              </section>
              <div className={styles.metrics}>
                {METRICS.map(([label, value, note, tone]) => (
                  <div key={label}>
                    <span>
                      {label}
                      <DemoBadge enabled={preview} />
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
                      {preview ? value : "—"}
                    </strong>
                    <small>{preview ? note : "รอเชื่อม MT5"}</small>
                  </div>
                ))}
              </div>
              <Opportunities
                instruments={STARTER_UNIVERSE}
                onSelect={setSelected}
                onNavigate={setSection}
                preview={preview}
              />
              <div className={styles.chartGrid}>
                <TerminalChart {...chartProps} />
                <AiAnalysis instrument={selected} preview={preview} />
              </div>
              <div className={styles.threeColumns}>
                <Heatmap
                  instruments={STARTER_UNIVERSE}
                  onSelect={focusAsset}
                  preview={preview}
                />
                <Sessions preview={preview} />
                <Calendar preview={preview} compact />
              </div>
              <div className={styles.twoColumns}>
                <InstrumentUniverse {...scannerProps} compact />
                <AccountPanel preview={preview} />
              </div>
              <div className={styles.threeColumns}>
                <RiskPanel preview={preview} compact />
                <Journal
                  instruments={STARTER_UNIVERSE}
                  entries={entries}
                  onAdd={(entry) => setEntries((values) => [entry, ...values])}
                  compact
                  onNavigate={setSection}
                />
                <Alerts enabled={alertSettings} onChange={setAlertSettings} />
              </div>
            </>
          ) : (
            <>
              <div className={styles.pageHeading}>
                <div>
                  <span className={styles.eyebrow}>
                    FOREX / CFD COMMAND CENTER
                  </span>
                  <h1>
                    <current.icon size={23} />
                    {current.label}
                  </h1>
                  <p>{current.description}</p>
                </div>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setSection("overview")}
                >
                  <LayoutDashboard size={14} />
                  กลับ Overview
                </button>
              </div>
              <nav className={styles.sectionTabs} aria-label="มุมมอง Forex">
                {SECTIONS.map((item) => (
                  <button
                    key={item.id}
                    aria-current={section === item.id ? "page" : undefined}
                    onClick={() => setSection(item.id)}
                  >
                    <item.icon size={14} />
                    {item.label}
                  </button>
                ))}
              </nav>
              {section === "scanner" && (
                <>
                  <InstrumentUniverse {...scannerProps} />
                  <div className={styles.scannerFoot}>
                    <ShieldCheck size={14} />
                    Universe เริ่มต้น FX 17 · Metals 2 · หมวดอื่นจะซิงก์จากบัญชี
                    Vantage ในอนาคต
                  </div>
                </>
              )}
              {section === "chart" && (
                <div className={styles.chartGrid}>
                  <TerminalChart {...chartProps} expanded />
                  <AiAnalysis instrument={selected} preview={preview} />
                </div>
              )}
              {section === "connection" && (
                <div className={styles.connectionGrid}>
                  <ConnectionPanel />
                  <AccountPanel preview={preview} />
                </div>
              )}
              {section === "positions" && (
                <AccountPanel preview={preview} positionsOnly />
              )}
              {section === "risk" && (
                <div className={styles.twoColumns}>
                  <RiskPanel preview={preview} />
                  <div className={styles.stack}>
                    <Sessions preview={preview} />
                    <Heatmap
                      instruments={STARTER_UNIVERSE}
                      onSelect={focusAsset}
                      preview={preview}
                    />
                  </div>
                </div>
              )}
              {section === "analysis" && (
                <div className={styles.chartGrid}>
                  <TerminalChart {...chartProps} />
                  <AiAnalysis instrument={selected} preview={preview} />
                </div>
              )}
              {section === "journal" && (
                <Journal
                  instruments={STARTER_UNIVERSE}
                  entries={entries}
                  onAdd={(entry) => setEntries((values) => [entry, ...values])}
                />
              )}
              {section === "calendar" && <Calendar preview={preview} />}
              {section === "alerts" && (
                <Alerts enabled={alertSettings} onChange={setAlertSettings} />
              )}
            </>
          )}
          <footer className={styles.footer}>
            <span>NUGAOM / FOREX & CFD DESK</span>
            <span>
              {preview ? "DEMO DATA · NOT LIVE" : "GUEST / FALLBACK"} ·
              ไม่มีการส่งคำสั่งซื้อขาย
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
