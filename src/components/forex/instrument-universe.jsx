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
  preview = false,
  compact = false,
  onNavigate,
}) {
  const [ranked, setRanked] = useState(false);
  const ordered =
    ranked && preview
      ? [...visible].sort(
          (left, right) => demoQuote(right).score - demoQuote(left).score,
        )
      : visible;
  const rows = compact ? ordered.slice(0, 6) : ordered;
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
            onChange={(event) => onQuery(event.target.value)}
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
        {[{ id: "all", label: "All markets" }, ...FOREX_CATEGORIES].map(
          (item) => (
            <button
              key={item.id}
              aria-pressed={category === item.id}
              onClick={() => onCategory(item.id)}
            >
              {item.label}
              <small>
                {item.id === "all"
                  ? instruments.length
                  : instruments.filter((symbol) => symbol.category === item.id)
                      .length}
              </small>
            </button>
          ),
        )}
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption className={styles.srOnly}>
            รายการเริ่มต้น 19 สัญลักษณ์ · คะแนนและราคาที่มีเป็นข้อมูลตัวอย่าง
            ไม่ใช่ MT5 สด
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
              const quote = preview ? demoQuote(item) : null;
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
                      {item.canonical_symbol}
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
                  <td>{formatDemoPrice(item, quote?.price)}</td>
                  <td
                    className={
                      quote?.change < 0 ? styles.negative : styles.positive
                    }
                  >
                    {quote
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
                  <td>{quote?.setup ?? "รอฟีด"}</td>
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
          {preview ? "DEMO DATA" : "STARTER / NO FEED"}
        </span>
        <span>รายการโปรดเก็บชั่วคราว</span>
      </div>
    </section>
  );
}
