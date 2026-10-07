import { Search, Star, ArrowUpRight } from "lucide-react";
import { FOREX_CATEGORIES } from "./symbol-universe.mjs";
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
}) {
  return (
    <section
      id="forex-universe"
      className={styles.panel}
      aria-labelledby="universe-title"
    >
      <div className={styles.panelHeading}>
        <div>
          <span className={styles.eyebrow}>MARKET UNIVERSE / STARTER</span>
          <h2 id="universe-title">สำรวจสินทรัพย์</h2>
        </div>
        <span className={styles.badge}>{instruments.length} symbols</span>
      </div>
      <div className={styles.tools}>
        <label className={styles.search}>
          <Search size={17} />
          <input
            aria-label="ค้นหาสัญลักษณ์หรือชื่อสินทรัพย์"
            placeholder="ค้นหา เช่น EURUSD, Gold…"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
        </label>
        <button
          className={styles.filterButton}
          aria-pressed={favoritesOnly}
          onClick={() => onFavoritesOnly(!favoritesOnly)}
        >
          <Star size={15} />
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
            รายการเริ่มต้น ไม่มีราคา MT5 สด
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <span className={styles.srOnly}>รายการโปรด</span>★
              </th>
              <th scope="col">Symbol / Description</th>
              <th scope="col">Category</th>
              <th scope="col">Bid / Ask</th>
              <th scope="col">Source</th>
              <th scope="col">
                <span className={styles.srOnly}>ดูรายละเอียด</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id} data-selected={selected.id === item.id}>
                <td>
                  <button
                    className={styles.starButton}
                    aria-label={`รายการโปรด ${item.display_symbol}`}
                    aria-pressed={favorites.includes(item.id)}
                    onClick={() => onFavorite(item.id)}
                  >
                    <Star
                      size={16}
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
                    {item.display_symbol}
                    <small>{item.description}</small>
                  </button>
                </th>
                <td>
                  {FOREX_CATEGORIES.find(
                    (category) => category.id === item.category,
                  )?.label ?? "Unclassified"}
                </td>
                <td className={styles.noPrice}>— / —</td>
                <td>
                  <span className={styles.source}>Starter</span>
                </td>
                <td>
                  <button
                    className={styles.starButton}
                    aria-label={`ดูรายละเอียด ${item.display_symbol}`}
                    onClick={() => onSelect(item)}
                  >
                    <ArrowUpRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && (
        <div className={styles.empty}>
          <Search size={26} />
          <h3>
            {category !== "all" &&
            !instruments.some((item) => item.category === category)
              ? "หมวดนี้ยังไม่มีในรายการเริ่มต้น"
              : "ไม่พบสินทรัพย์ที่ตรงกับตัวกรอง"}
          </h3>
          <p>รายการ Guest มีเฉพาะ FX และ Metals · หมวดอื่นรอซิงก์จาก MT5</p>
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
          แสดง {visible.length} จาก {instruments.length} สัญลักษณ์
        </span>
        <span>รายการโปรดเก็บชั่วคราวในหน้านี้</span>
      </div>
    </section>
  );
}
