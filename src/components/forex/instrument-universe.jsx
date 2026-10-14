import { useState } from "react";
import { Search, Star, ListFilter, ArrowUpRight } from "lucide-react";
import { FOREX_CATEGORIES } from "./symbol-universe.mjs";
import { demoQuote, demoBars, formatDemoPrice } from "./terminal-demo.mjs";
import { PanelHeading, Sparkline } from "./terminal-chart.jsx";
import styles from "./forex-workspace.module.css";

export default function InstrumentUniverse({
  instruments,
  visible,
  query,
  onQuery,
  category,
  onCategory,
  favorites,
  onFavorite,
  selected,
  onSelect,
  favoritesOnly,
  onFavoritesOnly,
  quotes = {},
  mt5 = false,
  preview = false,
  compact = false,
  onNavigate,
}) {
  const [ranked, setRanked] = useState(false);
  const [page, setPage] = useState(0);
  const ordered =
    ranked && preview
      ? [...visible].sort(
          (left, right) => demoQuote(right).score - demoQuote(left).score,
        )
      : visible;
  const activePage = Math.min(
    page,
    Math.max(0, Math.ceil(ordered.length / 100) - 1),
  );
  const rows = compact
    ? ordered.slice(0, 6)
    : ordered.slice(activePage * 100, (activePage + 1) * 100);
  return (
    <section
      id="forex-universe"
      className={styles.panel}
      aria-labelledby="universe-title"
    >
      <PanelHeading
        icon={ListFilter}
        title="AI SCANNER / MARKET UNIVERSE"
        demo={preview}
        label={mt5 ? "MT5 / LAST QUOTES" : null}
        action={
          compact ? (
            <button
              className={styles.textButton}
              onClick={() => onNavigate("scanner")}
            >
              เปิด Scanner <ArrowUpRight size={12} />
            </button>
          ) : null
        }
      />
      <div className={styles.tools}>
        <label className={styles.search}>
          <Search size={15} />
          <input
            aria-label="ค้นหาสัญลักษณ์หรือชื่อสินทรัพย์"
            placeholder="Search symbol… EURUSD, Gold"
            value={query}
            onChange={(event) => {
              setPage(0);
              onQuery(event.target.value);
            }}
          />
        </label>
        <button
          className={styles.filterButton}
          aria-pressed={favoritesOnly}
          onClick={() => onFavoritesOnly(!favoritesOnly)}
        >
          <Star size={13} />
          รายการโปรด ({favorites.length})
        </button>
      </div>
      <div
        className={styles.categories}
        role="group"
        aria-label="หมวดสินทรัพย์"
      >
        {[
          { id: "all", label: "All markets" },
          ...FOREX_CATEGORIES,
          ...(mt5 ? [{ id: "unclassified", label: "Unclassified" }] : []),
        ].map((item) => (
          <button
            key={item.id}
            aria-pressed={category === item.id}
            onClick={() => {
              setPage(0);
              onCategory(item.id);
            }}
          >
            {item.label}
            <small>
              {item.id === "all"
                ? instruments.length
                : instruments.filter((symbol) =>
                    item.id === "unclassified"
                      ? symbol.category === null
                      : symbol.category === item.id,
                  ).length}
            </small>
          </button>
        ))}
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption className={styles.srOnly}>
            {mt5
              ? "รายการสัญลักษณ์จาก MT5 · ราคา Bid ล่าสุด · ไม่มีคะแนน AI"
              : "รายการเริ่มต้น 19 สัญลักษณ์ · คะแนนและราคาที่มีเป็นข้อมูลตัวอย่าง ไม่ใช่ MT5 สด"}
          </caption>
          <thead>
            <tr>
              <th>
                <span className={styles.srOnly}>รายการโปรด</span>★
              </th>
              <th>Symbol</th>
              <th>TF</th>
              <th>Signal</th>
              <th>
                <button
                  className={styles.scoreSort}
                  aria-label="เรียงคะแนน AI ตัวอย่าง"
                  aria-pressed={ranked}
                  disabled={!preview}
                  onClick={() => setRanked((value) => !value)}
                >
                  AI Score {ranked ? "↓" : "↕"}
                </button>
              </th>
              <th>Price</th>
              <th>Change</th>
              <th>Trend</th>
              <th>Setup</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const quote = preview
                ? demoQuote(item)
                : Object.hasOwn(quotes, item.broker_symbol)
                  ? quotes[item.broker_symbol]
                  : null;
              return (
                <tr key={item.id} data-selected={selected.id === item.id}>
                  <td>
                    <button
                      className={styles.starButton}
                      aria-label={`รายการโปรด ${item.display_symbol}`}
                      aria-pressed={favorites.includes(item.id)}
                      onClick={() => onFavorite(item.id)}
                    >
                      <Star
                        size={13}
                        fill={
                          favorites.includes(item.id) ? "currentColor" : "none"
                        }
                      />
                    </button>
                  </td>
                  <th scope="row">
                    <button
                      className={styles.symbolButton}
                      onClick={() => onSelect(item)}
                    >
                      {item.broker_symbol ?? item.canonical_symbol}
                      <small>{item.description}</small>
                    </button>
                  </th>
                  <td>1H</td>
                  <td>
                    <span
                      className={
                        quote?.signal === "SHORT"
                          ? styles.shortPill
                          : quote?.signal === "WATCH"
                            ? styles.watchPill
                            : styles.signalPill
                      }
                    >
                      {quote?.signal ?? "WAIT"}
                    </span>
                  </td>
                  <td>
                    <span className={styles.scorePill}>
                      {quote?.score ?? "—"}
                    </span>
                  </td>
                  <td>
                    {mt5 && quote
                      ? quote.price.toFixed(item.digits ?? 5)
                      : formatDemoPrice(item, quote?.price)}
                    {mt5 && quote?.stale && (
                      <small className={styles.negative}>STALE</small>
                    )}
                  </td>
                  <td
                    className={
                      quote?.change < 0 ? styles.negative : styles.positive
                    }
                  >
                    {quote?.change !== undefined
                      ? `${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)}%`
                      : "—"}
                  </td>
                  <td>
                    <Sparkline
                      values={
                        preview
                          ? demoBars(item)
                              .slice(-15)
                              .map((bar) => bar.close)
                          : []
                      }
                      negative={quote?.change < 0}
                    />
                  </td>
                  <td>
                    {quote?.setup ??
                      (quote
                        ? `Spread ${quote.spread_points?.toFixed(1) ?? "—"} pts`
                        : "รอฟีด")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!visible.length && (
        <div className={styles.empty}>
          <Search size={24} />
          <h3>
            {category !== "all" &&
            !instruments.some((item) => item.category === category)
              ? "หมวดนี้ยังไม่มีในรายการเริ่มต้น"
              : "ไม่พบสินทรัพย์ที่ตรงกับตัวกรอง"}
          </h3>
          <p>Guest มี FX และ Metals · หมวดอื่นรอซิงก์จาก MT5</p>
          <button
            className={styles.filterButton}
            onClick={() => {
              onQuery("");
              onCategory("all");
              onFavoritesOnly(false);
            }}
          >
            ล้างตัวกรอง
          </button>
        </div>
      )}
      <div className={styles.tableFoot}>
        <span role="status">
          แสดง {rows.length} จาก {instruments.length} สัญลักษณ์ ·{" "}
          {mt5
            ? "MT5 / READ ONLY"
            : preview
              ? "DEMO DATA"
              : "STARTER / NO FEED"}
        </span>
        {!compact && ordered.length > 100 ? (
          <div className={styles.bridgeActions}>
            <button
              disabled={activePage === 0}
              onClick={() => setPage(activePage - 1)}
            >
              ก่อนหน้า
            </button>
            <span>
              {activePage + 1} / {Math.ceil(ordered.length / 100)}
            </span>
            <button
              disabled={(activePage + 1) * 100 >= ordered.length}
              onClick={() => setPage(activePage + 1)}
            >
              ถัดไป
            </button>
          </div>
        ) : (
          <span>รายการโปรดเก็บชั่วคราว</span>
        )}
      </div>
    </section>
  );
}
