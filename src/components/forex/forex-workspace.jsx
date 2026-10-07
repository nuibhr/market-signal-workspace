"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  LayoutDashboard,
  ListFilter,
  Cable,
  Globe2,
  Layers3,
  Radio,
  Star,
} from "lucide-react";
import MarketNavigation from "../market-navigation.jsx";
import ConnectionPanel from "./connection-panel.jsx";
import InstrumentUniverse from "./instrument-universe.jsx";
import {
  FOREX_CATEGORIES,
  STARTER_UNIVERSE,
  filterUniverse,
  resolveInitialInstrument,
} from "./symbol-universe.mjs";
import styles from "./forex-workspace.module.css";

const SECTIONS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "universe", label: "Market universe", icon: ListFilter },
  { id: "connection", label: "MT5 connection", icon: Cable },
];

export default function ForexWorkspace({ initialSymbol = null }) {
  const [section, setSection] = useState("overview");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [favorites, setFavorites] = useState([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState(() =>
    resolveInitialInstrument(initialSymbol),
  );
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
  const selectInstrument = (item) => {
    setSelected(item);
  };
  return (
    <div className={styles.workspace}>
      <a href="#forex-content" className={styles.skipLink}>
        ข้ามไปยังเนื้อหา
      </a>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>N</span>
          <span>
            NUGAOM<small>MARKET INTELLIGENCE</small>
          </span>
        </Link>
        <span className={styles.sidebarLabel}>MARKETS</span>
        <MarketNavigation current="forex" />
        <span className={styles.sidebarLabel}>FOREX / CFD DESK</span>
        <nav className={styles.subnavigation} aria-label="Forex Command Center">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => setSection(item.id)}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          <Radio size={18} />
          <strong>Guest / Fallback</strong>
          <p>
            19 สัญลักษณ์เริ่มต้น
            <br />
            ยังไม่เชื่อม MT5
          </p>
          <span className={styles.badge}>PHASE 01</span>
        </div>
      </aside>
      <main id="forex-content" className={styles.main} tabIndex={-1}>
        <header className={styles.topbar}>
          <span>
            FOREX / CFD <b>COMMAND CENTER</b>
          </span>
          <span className={styles.guest}>
            <span className={styles.dot} />
            GUEST MODE
          </span>
        </header>
        <div className={styles.content}>
          <section className={styles.hero}>
            <div>
              <span className={styles.eyebrow}>
                CURRENCIES & GLOBAL MARKETS
              </span>
              <h1>
                Forex / CFD
                <br />
                <span>Command Center</span>
              </h1>
              <p>
                พื้นที่สำรวจคู่เงินและสินทรัพย์ทั่วโลก
                <br />
                เริ่มจากรายการตลาด แล้วเตรียมเชื่อม Vantage MT5
              </p>
              <div className={styles.heroActions}>
                <button
                  className={styles.primaryButton}
                  onClick={() => setSection("universe")}
                >
                  สำรวจสินทรัพย์ <ArrowUpRight size={17} />
                </button>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setSection("connection")}
                >
                  ดูการเชื่อมต่อ MT5 <Cable size={17} />
                </button>
              </div>
            </div>
            <div className={styles.heroStatus}>
              <Globe2 size={42} strokeWidth={1} />
              <span className={styles.eyebrow}>YOUR MARKET DESK</span>
              <strong>เริ่มสำรวจได้ทันที</strong>
              <p>
                Guest mode · ไม่มีราคา MT5 สด
                <br />
                ไม่ต้องเชื่อมบัญชีเพื่อดูรายการเริ่มต้น
              </p>
              <span className={styles.badge}>VANTAGE · MT5 COMING SOON</span>
            </div>
          </section>
          <div className={styles.stats}>
            <div>
              <span>STARTER UNIVERSE</span>
              <strong>
                19 <small>symbols</small>
              </strong>
              <p>จากรายการ Forex ปัจจุบัน</p>
            </div>
            <div>
              <span>ASSET CATEGORIES</span>
              <strong>
                9 <small>categories</small>
              </strong>
              <p>เริ่มต้น FX 17 · Metals 2</p>
            </div>
            <div>
              <span>SUPPORTED BROKER</span>
              <strong>Vantage</strong>
              <p>MT5 · เตรียมเปิดการเชื่อมต่อ</p>
            </div>
            <div>
              <span>DATA STATUS</span>
              <strong className={styles.fallbackText}>Fallback</strong>
              <p>ยังไม่มีข้อมูลจากโบรกเกอร์</p>
            </div>
          </div>
          <div className={styles.notice}>
            <Radio size={18} />
            <p>
              <strong>กำลังใช้รายการเริ่มต้น</strong> · รายการนี้เป็นแค็ตตาล็อก
              19 สัญลักษณ์ ไม่ใช่รายการสินทรัพย์ที่ยืนยันจาก Vantage ราคา สเปรด
              และข้อกำหนดการซื้อขายยังไม่พร้อม
            </p>
          </div>
          <nav className={styles.sectionTabs} aria-label="มุมมอง Forex">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                aria-current={section === item.id ? "page" : undefined}
                onClick={() => setSection(item.id)}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </nav>
          <div className={styles.desk}>
            <div className={styles.primaryColumn}>
              {section === "connection" ? (
                <ConnectionPanel />
              ) : (
                <InstrumentUniverse
                  instruments={STARTER_UNIVERSE}
                  visible={visible}
                  query={query}
                  onQuery={setQuery}
                  category={category}
                  onCategory={setCategory}
                  favorites={favorites}
                  onFavorite={toggleFavorite}
                  selected={selected}
                  onSelect={selectInstrument}
                  favoritesOnly={favoritesOnly}
                  onFavoritesOnly={setFavoritesOnly}
                />
              )}
              {section === "overview" && (
                <section className={`${styles.panel} ${styles.nextSteps}`}>
                  <Layers3 size={26} />
                  <div>
                    <span className={styles.eyebrow}>THE NEXT CONNECTION</span>
                    <h2>ตลาดของคุณ ตามบัญชีโบรกเกอร์</h2>
                    <p>
                      เมื่อเปิดใช้งาน MT5
                      ระบบจะอ่านชื่อสินทรัพย์และข้อกำหนดจริงจากโบรกเกอร์
                      เพื่อขยายรายการตามบัญชีที่เชื่อม
                    </p>
                  </div>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => setSection("connection")}
                  >
                    ดูสถานะ <ArrowUpRight size={16} />
                  </button>
                </section>
              )}
            </div>
            <aside
              className={styles.rail}
              aria-label="รายละเอียดสินทรัพย์และการเชื่อมต่อ"
            >
              <section
                className={styles.panel}
                aria-labelledby="instrument-title"
              >
                <div className={styles.panelHeading}>
                  <span className={styles.eyebrow}>INSTRUMENT FOCUS</span>
                  <button
                    className={styles.starButton}
                    aria-label={`รายการโปรดรายละเอียด ${selected.display_symbol}`}
                    aria-pressed={favorites.includes(selected.id)}
                    onClick={() => toggleFavorite(selected.id)}
                  >
                    <Star
                      size={17}
                      fill={
                        favorites.includes(selected.id)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                </div>
                <div aria-live="polite">
                  <h2 id="instrument-title" className={styles.focusSymbol}>
                    {selected.display_symbol}
                  </h2>
                  <p>{selected.description}</p>
                </div>
                <span className={styles.badge}>
                  {
                    FOREX_CATEGORIES.find(
                      (item) => item.id === selected.category,
                    )?.label
                  }{" "}
                  · STARTER
                </span>
                <div className={styles.pricePlaceholder}>
                  <span>BID / ASK</span>
                  <strong>— / —</strong>
                  <small>รอข้อมูลจาก MT5</small>
                </div>
                <dl className={styles.connectionFacts}>
                  <div>
                    <dt>Canonical symbol</dt>
                    <dd>{selected.canonical_symbol}</dd>
                  </div>
                  <div>
                    <dt>Broker symbol</dt>
                    <dd>ยังไม่ซิงก์</dd>
                  </div>
                  <div>
                    <dt>Contract / Volume</dt>
                    <dd>ยังไม่ซิงก์</dd>
                  </div>
                  <div>
                    <dt>Trading session</dt>
                    <dd>ยังไม่ซิงก์</dd>
                  </div>
                </dl>
                <p className={styles.note}>
                  รายละเอียดสัญญาและเวลาเปิดตลาดจะมาจากบัญชีโบรกเกอร์ที่เชื่อม
                </p>
              </section>
              {section !== "connection" && <ConnectionPanel />}
            </aside>
          </div>
          <footer className={styles.footer}>
            <span>NUGAOM / FOREX & CFD DESK</span>
            <span>Phase 1 · สำรวจรายการสินทรัพย์</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
