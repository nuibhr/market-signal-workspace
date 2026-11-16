"use client";
import {SoundControl,AlertHistory} from "../monitor/monitor-provider.jsx";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  Bot,
  Cable,
  CalendarDays,
  CandlestickChart as ChartIcon,
  ChevronDown,
  CircleHelp,
  Compass,
  Gauge,
  Globe2,
  LayoutDashboard,
  ListFilter,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import MarketNavigation from "../market-navigation.jsx";
import AmbientLiquidGlass from "../ambient-liquid-glass.jsx";
import { AmbientDepth } from "../workspace-features.jsx";
import DaytradePanel from "../daytrade/daytrade-panel.jsx";
import ForexStudio from "./forex-studio.jsx";
import ProCopyEaDesk from "./pro-copy-ea-desk.jsx";
import {useDeskResource} from "../use-desk-resource.jsx";
import { CORE_FOREX } from "../../daytrade/universe.mjs";
import MemberAvatar from "../member-avatar.jsx";
import useMt5Connection from "./use-mt5-connection.jsx";
import OwnerDataPreview from "../owner-data-preview.jsx";
import ConnectionPanel from "./connection-panel.jsx";
import InstrumentUniverse from "./instrument-universe.jsx";
import TerminalChart, { DemoBadge } from "./terminal-chart.jsx";
import {
  AiAnalysis,
  Heatmap,
  Alerts,
} from "./terminal-panels.jsx";
import {
  STARTER_UNIVERSE,
  filterUniverse,
  resolveInitialInstrument,
} from "./symbol-universe.mjs";
import { demoQuote, formatDemoPrice } from "./terminal-demo.mjs";
import styles from "./forex-workspace.module.css";

const SECTIONS = [
  {
    id: "studio",
    label: "Forex Live Studio",
    icon: Bot,
    badge: "ห้องวางแผน & จำลองเทรด",
    description: "ห้องวางแผนและฝึกอ่านกราฟด้วยข้อมูลจำลอง",
  },
  {
    id: "pro",
    label: "Pro Suite EA",
    icon: ShieldCheck,
    badge: "แผนล็อคกำไร 3 สเต็ป",
    description: "ระบบแผน EA สายเสถียร · แผนล็อคกำไร & สถิติ Win/Loss",
  },
  {
    id: "scanner",
    label: "สแกนเนอร์สัญญาณ 15m",
    icon: ListFilter,
    badge: "เรดาร์แท่งปิด 15 นาที",
    description: "เรดาร์แท่งเทียนปิด 15 นาที · ทองคำและคู่เงินหลัก",
  },
  {
    id: "chart",
    label: "กราฟเทคนิค & แผนเทรด",
    icon: ChartIcon,
    badge: "Entry · SL · TP 2R",
    description: "กราฟแท่งเทียนความละเอียดสูง พร้อมพิกัดเข้า Entry, SL, TP 2R และบริบท AI",
  },
  {
    id: "alerts",
    label: "แจ้งเตือน Telegram & เสียง",
    icon: Bell,
    badge: "ห้อง VIP & น้องนักออม",
    description: "รับสัญญาณสดเข้ามือถือผ่านห้อง Telegram VIP ส่วนกลาง และเสียงน้องนักออมภาษาไทย",
  },
];
export default function ForexWorkspace({ initialSymbol = null, initialSection = "studio", viewer = null }) {
  const performance=useDeskResource('/api/daytrade?market=forex&compact=1',{interval:30000});
  const fmt=v=>Number.isFinite(v)?v.toFixed(2):'—';
  const [section, setSection] = useState(initialSection);
  const [demoPreview, setPreview] = useState(false);
  const [frame, setFrame] = useState("1h");
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all");
  const [favorites, setFavorites] = useState([]),
    [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selection, setSelected] = useState(() =>
    resolveInitialInstrument(initialSymbol ?? "XAU/USD"),
  );
  const bridge = useMt5Connection(selection.broker_symbol, frame, {enabled:viewer?.dataOwner===true});
  const [ownerPreview,setOwnerPreview]=useState(false);
  const [publicQuotes,setPublicQuotes]=useState({});
  const [publicChart,setPublicChart]=useState(null);
  const [publicBacktest,setPublicBacktest]=useState(null);
  // Performance metrics come only from the recorded signal ledger. The in-sample
  // backtest (publicBacktest) is kept for research views and is never shown as results.
  const ledgerClosed = performance.data?.summary?.closed > 0;
  const activeSummary = ledgerClosed ? performance.data.summary : null;
  const readyAssetsCount = performance.data?.coverage?.ready > 0 ? performance.data.coverage.ready : Object.keys(publicQuotes).length;
  const METRICS=[
    ['Win rate',ledgerClosed?fmt(activeSummary.winRate)+'%':'—',ledgerClosed?`${activeSummary.closed} ไม้ปิดจริง`:'ยังไม่มีไม้ปิดจริง','positive'],
    ['Profit Factor',ledgerClosed?fmt(activeSummary.profitFactor):'—','จากบันทึกสัญญาณจริง','positive'],
    ['Max Drawdown',ledgerClosed?fmt(activeSummary.maxDrawdownR)+' R':'—','จากบันทึกสัญญาณจริง',''],
    ['Net Return',ledgerClosed?fmt(activeSummary.netR)+' R':'—','จากบันทึกสัญญาณจริง','positive'],
    ['สินทรัพย์พร้อม',String(readyAssetsCount),performance.data?.coverage?.ready > 0 ? 'จาก MT5' : 'ราคา Yahoo Finance',''],
    ['ระบบสแกน 15m',performance.data?.connection||'รอเชื่อม MT5',performance.data?.generatedAt||performance.error||'กำลังโหลด','']
  ];
  useEffect(()=>{const c=new AbortController();fetch('/api/owner-preview/status',{cache:'no-store',signal:c.signal}).then(r=>r.json()).then(v=>{if(!c.signal.aborted)setOwnerPreview(v.active===true);}).catch(()=>{});return()=>c.abort();},[]);
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
  useEffect(() => {
    if (hasMt5 || typeof window === "undefined" || typeof fetch !== "function") return;
    const controller = new AbortController();
    const sym = selected.display_symbol || selected.canonical_symbol || "XAU/USD";
    fetch(`/api/forex/studio/plans?candles=1&tickers=1&symbol=${encodeURIComponent(sym)}&timeframe=${encodeURIComponent(frame)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (controller.signal.aborted || !data) return;
        if (data.quotes && typeof data.quotes === "object") {
          setPublicQuotes((prev) => ({ ...prev, ...data.quotes }));
        }
        if (data.backtest && typeof data.backtest === "object") {
          setPublicBacktest(data.backtest);
        }
        if (Array.isArray(data.bars) && data.bars.length > 0) {
          setPublicChart({
            broker_symbol: selected.broker_symbol,
            canonical_symbol: selected.canonical_symbol,
            timeframe: frame,
            bars: data.bars,
          });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [hasMt5, selected.canonical_symbol, selected.display_symbol, selected.broker_symbol, frame]);
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
  const mergedQuotes = hasMt5 ? bridge.quotes : { ...publicQuotes, ...bridge.quotes };
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
    quotes: mergedQuotes,
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
    quote: Object.hasOwn(mergedQuotes, selected.broker_symbol)
      ? mergedQuotes[selected.broker_symbol]
      : Object.hasOwn(mergedQuotes, selected.canonical_symbol)
        ? mergedQuotes[selected.canonical_symbol]
        : null,
    chart: hasMt5 ? bridge.chart : publicChart ?? bridge.chart,
    mt5: hasMt5,
    favorites,
    onFavorite: toggleFavorite,
  };
  const tickerSymbols = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY"];
  const [sidebarGroups, setSidebarGroups] = useState(["forex-core", "forex-more"]);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const toggleSidebarGroup = (id) =>
    setSidebarGroups((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]
    );
  const hasLiveFeed = hasMt5 || Object.keys(publicQuotes).length > 0;

  return (
    <div
      className={`app-frame market-workspace monitor-workspace market-forex ${styles.workspace}`}
      data-theme="dark"
      style={{ "--market-accent": "#bc9bff", "--market-rgb": "188, 155, 255" }}
    >
      <AmbientLiquidGlass isLight={false} />
      <AmbientDepth />
      <a className={styles.skipLink} href="#forex-content">
        ข้ามไปยังเนื้อหา
      </a>

      {/* Unified Left Sidebar matching Thai / DR / TFEX / US */}
      <aside className="sidebar hub-sidebar">
        <div className="hub-sidebar-scroll">
          <Link href="/" className="brand" aria-label="Nugaom กลับเลือกตลาด">
            <div className="brand-mark">
              <Image
                src="/nugaom-mascot.png"
                width={52}
                height={52}
                alt="มาสคอต Nugaom AI Pick"
              />
            </div>
            <div>
              <strong>Nugaom</strong>
              <small>AI PICK · พื้นที่ดูตลาด</small>
            </div>
          </Link>

          <Link className="hub-account-card" href="/account">
            <span className="hub-account-avatar">
              <MemberAvatar account={viewer} size={40} />
            </span>
            <span>
              <strong>
                {viewer ? viewer.displayName || "มุมสมาชิกของฉัน" : "เริ่มด้วย LINE"}
              </strong>
              <small>
                {viewer
                  ? "สมาชิก Nugaom · จัดการสิทธิ์"
                  : "เข้าสู่ระบบ · ตรวจสิทธิสมาชิก"}
              </small>
            </span>
            <span className="hub-account-arrow">↗</span>
          </Link>

          <MarketNavigation current="forex" />

          <div className="hub-sidebar-caption">เครื่องมือประจำตลาด</div>
          <nav className="hub-group-list" aria-label="Forex Command Center">
            <section className="hub-menu-group">
              <button
                type="button"
                className="hub-group-toggle"
                aria-expanded={sidebarGroups.includes("forex-core")}
                onClick={() => toggleSidebarGroup("forex-core")}
              >
                <span className="hub-group-index">01</span>
                <span className="hub-nav-glyph">
                  <Compass size={17} strokeWidth={1.9} />
                </span>
                <span>ศูนย์กลยุทธ์ Forex &amp; Gold</span>
                <ChevronDown
                  size={14}
                  className={
                    sidebarGroups.includes("forex-core")
                      ? "hub-chevron open"
                      : "hub-chevron"
                  }
                />
              </button>
              {sidebarGroups.includes("forex-core") && (
                <div className="hub-group-items">
                  {SECTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={
                        section === item.id ? "hub-subnav active" : "hub-subnav"
                      }
                      aria-current={section === item.id ? "page" : undefined}
                      onClick={() => setSection(item.id)}
                    >
                      <item.icon size={15} strokeWidth={1.9} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="hub-menu-group">
              <button
                type="button"
                className="hub-group-toggle"
                aria-expanded={sidebarGroups.includes("forex-more")}
                onClick={() => toggleSidebarGroup("forex-more")}
              >
                <span className="hub-group-index">02</span>
                <span className="hub-nav-glyph">
                  <CircleHelp size={17} strokeWidth={1.9} />
                </span>
                <span>สมาชิก &amp; เครื่องมือเสริม</span>
                <ChevronDown
                  size={14}
                  className={
                    sidebarGroups.includes("forex-more")
                      ? "hub-chevron open"
                      : "hub-chevron"
                  }
                />
              </button>
              {sidebarGroups.includes("forex-more") && (
                <div className="hub-group-items">
                  <Link href="/risk" className="hub-subnav">
                    <Gauge size={15} strokeWidth={1.9} />
                    <span>คำนวณ Position &amp; 2R Risk</span>
                  </Link>
                  <Link href="/calendar" className="hub-subnav">
                    <CalendarDays size={15} strokeWidth={1.9} />
                    <span>ปฏิทินเศรษฐกิจโลก</span>
                  </Link>
                  <Link href="/account" className="hub-subnav">
                    <Wallet size={15} strokeWidth={1.9} />
                    <span>โปรไฟล์สมาชิก &amp; จัดการสิทธิ์</span>
                  </Link>
                  <Link href="/community" className="hub-subnav">
                    <Users size={15} strokeWidth={1.9} />
                    <span>ห้องสมาชิกและคุยกับทีม</span>
                  </Link>
                </div>
              )}
            </section>
          </nav>

          <div className="engine-card">
            <div className="engine-heading">
              สถานะข้อมูล{" "}
              <span className={hasLiveFeed ? "real-pill" : "demo-pill"}>
                {hasMt5 ? "MT5 จริง" : hasLiveFeed ? "ราคาสด" : "รอฟีด"}
              </span>
            </div>
            <p>
              Zero-Custody ใช้ได้กับทุกโบรกเกอร์ (Exness, XM, IC Markets, Vantage)
              แสดงราคาและแผนเทรดโดยไม่มีการส่งคำสั่งซื้อขายแทนลูกค้า
            </p>
          </div>
        </div>
        <div className="sidebar-foot">
          NUGAOM <span>ทุกวัน เริ่มจากข้อมูล</span>
        </div>
      </aside>

      {/* Mobile Bottom Dock & Sheet matching WorkspaceSidebar */}
      <nav className="hub-mobile-dock" aria-label="เมนูมือถือ">
        <button
          type="button"
          className={section === "studio" ? "active" : ""}
          onClick={() => setSection("studio")}
        >
          <LayoutDashboard size={20} />
          <span>Studio</span>
        </button>
        <button
          type="button"
          className={section === "pro" ? "active" : ""}
          onClick={() => setSection("pro")}
        >
          <ShieldCheck size={20} />
          <span>Pro EA</span>
        </button>
        <button
          type="button"
          className={section === "scanner" ? "active" : ""}
          onClick={() => setSection("scanner")}
        >
          <Radar size={20} />
          <span>สแกน 15m</span>
        </button>
        <button
          type="button"
          className={section === "alerts" ? "active" : ""}
          onClick={() => setSection("alerts")}
        >
          <Bell size={20} />
          <span>แจ้งเตือน</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileSheetOpen(true)}
          aria-expanded={mobileSheetOpen}
        >
          <Compass size={20} />
          <span>ทั้งหมด</span>
        </button>
      </nav>

      {mobileSheetOpen && (
        <div
          className="hub-mobile-scrim"
          onClick={() => setMobileSheetOpen(false)}
        >
          <div
            className="hub-mobile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="เครื่องมือทั้งหมดของ Nugaom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hub-mobile-sheet-head">
              <strong>เครื่องมือทั้งหมด</strong>
              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                aria-label="ปิดเมนู"
              >
                ×
              </button>
            </div>
            <Link className="hub-mobile-membership" href="/account">
              <span className="hub-line-icon">LINE</span>
              <span>
                {viewer
                  ? `มุมสมาชิก · ${viewer.displayName || "VIP"}`
                  : "เข้าสู่ระบบด้วย LINE · ตรวจสิทธิสมาชิก"}
              </span>
              <span>↗</span>
            </Link>
            <MarketNavigation current="forex" />
            <div className="hub-mobile-group">
              <strong>01 / ศูนย์กลยุทธ์ Forex &amp; Gold</strong>
              <div>
                {SECTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={section === item.id ? "active" : ""}
                    onClick={() => {
                      setMobileSheetOpen(false);
                      setSection(item.id);
                    }}
                  >
                    <item.icon size={18} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified Main Area & Topbar matching Thai / DR / TFEX / US */}
      <main id="forex-content" className="main-area" tabIndex={-1}>
        <header className="topbar">
          <div className="topbar-context">
            <small>กำลังดู / CURRENT SYMBOL</small>
            <strong>{selected.display_symbol || selected.canonical_symbol}</strong>
            <span>Forex &amp; Gold</span>
          </div>

          <div className="topbar-search-area" style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
            <label className={styles.topSearch}>
              <Search size={15} />
              <input
                aria-label="ค้นหาตลาดจากแถบด้านบน"
                placeholder="ค้นหาคู่เงิน / ทองคำ เช่น XAUUSD, EURUSD…"
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
                    (asset) => asset.canonical_symbol === symbol
                  ),
                  quote = item
                    ? preview
                      ? demoQuote(item)
                      : Object.hasOwn(mergedQuotes, item.broker_symbol)
                        ? mergedQuotes[item.broker_symbol]
                        : Object.hasOwn(mergedQuotes, item.canonical_symbol)
                          ? mergedQuotes[item.canonical_symbol]
                          : null
                    : null;
                if (!item) return null;
                return (
                  <button key={symbol} type="button" onClick={() => focusAsset(item)}>
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
          </div>

          <div className="topbar-actions">
            <Link className="monitor-account" href="/account">
              บัญชีสมาชิก ↗
            </Link>
            <SoundControl />
            <div className="market-clock">
              <i
                className={
                  hasLiveFeed ? "status-dot connected" : "status-dot"
                }
              />{" "}
              {hasMt5
                ? `MT5 · ${frame.toUpperCase()}`
                : hasLiveFeed
                  ? `LIVE · ${frame.toUpperCase()}`
                  : "DATA · PREVIEW"}
            </div>
          </div>
        </header>

        <div className="page-content">
          {/* 1. Same Horizontal Market Switcher at top of .page-content as all other markets */}
          <MarketNavigation current="forex" />

          {/* 2. Unified Workspace Navigation Toolbar matching ThaiWorkspaceNav & UsWorkspaceNav */}
          <section
            id="thai-workspace-navigation"
            className={styles.forexToolbar}
            aria-label="พื้นที่ทำงาน Forex & Gold"
          >
            <div className={styles.forexToolbarHead}>
              <div>
                <h1>
                  Forex &amp; Gold <small>XAUUSD · FX MAJORS 15m</small>
                </h1>
                <p>
                  เลือกเครื่องมือวิเคราะห์ วางแผนเทรด และรับสัญญาณแจ้งเตือนสดห้อง Telegram VIP
                </p>
              </div>
              <span className={styles.forexSymbolPill}>
                กำลังวิเคราะห์{" "}
                <b>{selected.display_symbol || selected.canonical_symbol}</b>
              </span>
            </div>

            <div className={styles.forexToolbarRow}>
              <nav aria-label="มุมมอง Forex" className="views">
                {SECTIONS.map((item) => {
                  const Icon = item.icon;
                  const active = section === item.id;
                  return (
                    <a
                      key={item.id}
                      href={`#forex-${item.id}`}
                      aria-current={active ? "location" : undefined}
                      onClick={(event) => {
                        if (
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.altKey
                        )
                          return;
                        event.preventDefault();
                        setSection(item.id);
                      }}
                    >
                      <Icon size={15} style={{ opacity: 0.9, flexShrink: 0 }} />
                      <b>{item.label}</b>
                      <small>{item.badge}</small>
                    </a>
                  );
                })}
              </nav>
            </div>
          </section>

          {section !== "studio" && (
            <div className={styles.metrics}>
              {METRICS.map(([label, value, note, tone]) => (
                <div key={label}>
                  <span>{label}</span>
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
          )}

          {section === "studio" && <ForexStudio />}

          {section === "pro" && <ProCopyEaDesk bridge={bridge} viewer={viewer} />}

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
              <Alerts enabled={alertSettings} onChange={setAlertSettings} viewer={viewer} />
              <AlertHistory />
            </>
          )}

          {ownerPreview&&<OwnerDataPreview market="forex"/>}
          {viewer?.dataOwner===true&&<details className={styles.devToolsAccordion}>
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
          </details>}
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
