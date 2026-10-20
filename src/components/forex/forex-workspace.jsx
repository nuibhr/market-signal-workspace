"use client";
import {SoundControl,AlertHistory} from "../monitor/monitor-provider.jsx";

import { useEffect, useMemo, useState } from "react";
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
import DaytradePanel from "../daytrade/daytrade-panel.jsx";
import { CORE_FOREX } from "../../daytrade/universe.mjs";
import MemberAvatar from "../member-avatar.jsx";
import useMt5Connection from "./use-mt5-connection.jsx";
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
    description: "เชื่อม Vantage และซิงก์ข้อมูลตลาดแบบอ่านอย่างเดียวจาก MT5",
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

export default function ForexWorkspace({ initialSymbol = null, viewer = null }) {
  const [section, setSection] = useState("scanner");
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
  const preview = demoPreview && !hasMt5;
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
          <span className={styles.brokerLogo}>V</span>
          <div>
            <strong>Vantage MT5</strong>
            <small>
              {hasMt5
                ? `${universe.length} symbols · ${bridge.status}`
                : "ยังไม่เชื่อมบัญชี"}
            </small>
          </div>
          <span className={styles.dot} />
        </div>
        <span className={styles.sidebarCopyright}>FOREX / CFD · PHASE 02</span>
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
              disabled={hasMt5}
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
                    สแกน · วิเคราะห์ · ติดตามตลาด · เชื่อม Vantage MT5
                  </p>
                  <div>
                    <span>
                      <i className={styles.greenDot} />
                      {universe.length}{" "}
                      {hasMt5 ? "broker symbols" : "starter symbols"}
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
                    MARKET STATUS{" "}
                    {hasMt5 ? (
                      <span className={styles.demoBadge}>
                        MT5 / {bridge.status.toUpperCase()}
                      </span>
                    ) : (
                      <DemoBadge enabled={preview} />
                    )}
                  </span>
                  <strong>
                    {preview
                      ? "New York Session"
                      : hasMt5
                        ? "Vantage Market Universe"
                        : "Waiting for MT5"}
                  </strong>
                  <small>
                    {preview
                      ? "ตัวอย่างภาพรวมช่วงตลาด"
                      : hasMt5
                        ? "ข้อมูลพอร์ตและเวลาตลาดยังไม่เปิดใช้งาน"
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
                    <small>{preview ? note : "ยังไม่มีฟีดบัญชี"}</small>
                  </div>
                ))}
              </div>
              {!hasMt5 && (
                <Opportunities
                  instruments={universe}
                  onSelect={setSelected}
                  onNavigate={setSection}
                  preview={preview}
                />
              )}
              <DaytradePanel market="forex" id="forex-daytrade" />
              <div className={styles.chartGrid}>
                <TerminalChart {...chartProps} />
                <AiAnalysis instrument={selected} preview={preview} />
              </div>
              <div className={styles.threeColumns}>
                <Heatmap
                  quotes={bridge.quotes}
                  mt5={hasMt5}
                  instruments={universe}
                  onSelect={focusAsset}
                  preview={preview}
                />
                <Sessions preview={preview} />
                <Calendar preview={preview} compact />
              </div>
              <div className={styles.twoColumns}>
                {hasMt5 ? (
                  <ConnectionPanel bridge={bridge} />
                ) : (
                  <InstrumentUniverse {...scannerProps} compact />
                )}
                <AccountPanel preview={preview} />
              </div>
              <div className={styles.threeColumns}>
                <RiskPanel preview={preview} compact />
                <Journal
                  instruments={universe}
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
                  <DaytradePanel market="forex" id="forex-scanner" />
                  <InstrumentUniverse {...scannerProps} />
                  <div className={styles.scannerFoot}>
                    <ShieldCheck size={14} />
                    {hasMt5
                      ? `Universe จาก ${bridge.server} · ชื่อและสเปกตาม Terminal · ไม่มีคะแนน AI จำลองในโหมด MT5`
                      : "รายการหลัก FX 7 · ทองและเงิน 2 · เก็บ universe เต็มไว้ในระบบเชื่อมต่อ"}
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
                  <ConnectionPanel bridge={bridge} />
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
                      quotes={bridge.quotes}
                      mt5={hasMt5}
                      instruments={universe}
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
                  instruments={universe}
                  entries={entries}
                  onAdd={(entry) => setEntries((values) => [entry, ...values])}
                />
              )}
              {section === "calendar" && <Calendar preview={preview} />}
              {section === "alerts" && (
                <><AlertHistory/><details><summary>ค่าหน้าจอเดิม · ยังไม่ส่งแจ้งเตือน</summary><Alerts enabled={alertSettings} onChange={setAlertSettings} /></details></>
              )}
            </>
          )}
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
