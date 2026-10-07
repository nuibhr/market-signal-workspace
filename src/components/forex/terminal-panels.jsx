import { useState } from "react";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Clock3,
  Globe2,
  Plus,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  demoBars,
  demoQuote,
  formatDemoPrice,
  calculateManualRisk,
} from "./terminal-demo.mjs";
import { Sparkline, PanelHeading, DemoBadge } from "./terminal-chart.jsx";
import styles from "./forex-workspace.module.css";

export function Opportunities({ instruments, onSelect, onNavigate, preview }) {
  const symbols = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "XAGUSD"];
  return (
    <section className={styles.panel}>
      <PanelHeading
        icon={Sparkles}
        title="TOP OPPORTUNITIES / AI SCORE"
        demo={preview}
        action={
          <button
            className={styles.textButton}
            onClick={() => onNavigate("scanner")}
          >
            ดูทั้งหมด <ArrowUpRight size={12} />
          </button>
        }
      />
      <div className={styles.opportunityGrid}>
        {symbols.map((symbol, index) => {
          const item = instruments.find(
              (asset) => asset.canonical_symbol === symbol,
            ),
            quote = preview ? demoQuote(item) : null;
          return (
            <button
              key={symbol}
              className={styles.opportunity}
              onClick={() => {
                onSelect(item);
                onNavigate("chart");
              }}
            >
              <span
                className={`${styles.assetIcon} ${item.category === "metals" ? styles.goldIcon : ""}`}
              >
                {["Au", "€", "£", "¥", "Ag"][index]}
              </span>
              <span>
                <strong>{symbol}</strong>
                <span
                  className={
                    quote?.signal === "SHORT"
                      ? styles.negative
                      : styles.positive
                  }
                >
                  {quote?.signal ?? "WAITING"}
                </span>
                <b>{quote ? `${quote.score}/100` : "—"}</b>
              </span>
              <Sparkline
                values={
                  preview
                    ? demoBars(item)
                        .slice(-18)
                        .map((bar) => bar.close)
                    : []
                }
                negative={quote?.signal === "SHORT"}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function AiAnalysis({ instrument, preview }) {
  const quote = preview ? demoQuote(instrument) : null;
  return (
    <section className={`${styles.panel} ${styles.aiPanel}`}>
      <PanelHeading icon={Sparkles} title="AI ANALYSIS" demo={preview} />
      <div className={styles.scoreHero}>
        <div
          className={styles.scoreRing}
          style={{ "--score": `${quote?.score ?? 0}%` }}
        >
          <Sparkles size={29} />
        </div>
        <div>
          <strong>
            {quote?.score ?? "—"}
            <small>/100</small>
          </strong>
          <span className={styles.signalPill}>
            {quote?.signal ?? "WAITING FOR FEED"}
          </span>
        </div>
      </div>
      <h3>
        {instrument.canonical_symbol} · {quote?.setup ?? "รอข้อมูลราคา"}
      </h3>
      <p>
        {preview
          ? "ตัวอย่างการจัดแสดงบทวิเคราะห์: แนวโน้ม โมเมนตัม และจุดสำคัญของราคา"
          : "บทวิเคราะห์จะพร้อมเมื่อมีข้อมูลราคาที่ตรวจสอบได้"}
      </p>
      <div className={styles.analysisMeters}>
        {[
          ["Trend strength", 82],
          ["Momentum", 71],
          ["Volatility", 58],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <i>
              <b style={{ width: preview ? `${value}%` : "0%" }} />
            </i>
            <small>{preview ? `${value}%` : "—"}</small>
          </div>
        ))}
      </div>
      <div className={styles.tradePlan}>
        <span>
          <ShieldCheck size={13} /> TRADE PLAN <DemoBadge enabled={preview} />
        </span>
        {[
          ["Reference", quote?.price],
          ["Support", quote?.price * 0.998],
          ["Resistance", quote?.price * 1.002],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <b>{formatDemoPrice(instrument, value)}</b>
          </div>
        ))}
      </div>
      <p className={styles.note}>
        คะแนนและระดับราคานี้เป็นตัวอย่าง UI ไม่ใช่ผลจาก AI หรือคำแนะนำซื้อขาย
      </p>
    </section>
  );
}

export function Heatmap({ instruments, onSelect, preview }) {
  return (
    <section className={styles.panel}>
      <PanelHeading icon={Globe2} title="MARKET HEATMAP" demo={preview} />
      <div className={styles.heatmap}>
        {instruments.slice(0, 8).map((item) => {
          const quote = preview ? demoQuote(item) : null;
          return (
            <button
              key={item.id}
              className={
                quote?.change < 0 ? styles.heatNegative : styles.heatPositive
              }
              onClick={() => onSelect(item)}
            >
              <strong>{item.canonical_symbol}</strong>
              <span>
                {quote
                  ? `${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)}%`
                  : "—"}
              </span>
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
            </button>
          );
        })}
      </div>
    </section>
  );
}
export function Sessions({ preview }) {
  return (
    <section className={styles.panel}>
      <PanelHeading icon={Clock3} title="SESSION OVERVIEW" demo={preview} />
      <div className={styles.sessions}>
        {[
          ["Sydney", 0],
          ["Tokyo", 35],
          ["London", 72],
          ["New York", 89],
        ].map(([label, percent]) => (
          <div key={label}>
            <span>{label}</span>
            <i>
              <b style={{ width: preview ? `${percent}%` : "0%" }} />
            </i>
            <small>{preview ? (percent ? "Preview" : "Closed") : "—"}</small>
          </div>
        ))}
      </div>
      <div className={styles.sessionNote}>
        <span className={styles.greenDot} />
        {preview
          ? "ตัวอย่างการแสดงช่วงตลาด"
          : "รอข้อมูลเวลาและ session จากโบรกเกอร์"}
      </div>
      <div className={styles.volatility}>
        <span>VOLATILITY</span>
        <strong>{preview ? "EXAMPLE" : "—"}</strong>
      </div>
    </section>
  );
}
const EVENTS = [
  ["20:30", "USD", "Core PCE Price Index", "High"],
  ["21:00", "USD", "Personal Spending", "High"],
  ["21:00", "EUR", "Consumer Confidence", "Medium"],
  ["22:00", "USD", "Central Bank Speech", "High"],
  ["22:30", "GBP", "Manufacturing PMI", "Medium"],
];
export function Calendar({ preview, compact = false }) {
  const [currency, setCurrency] = useState("All");
  return (
    <section className={styles.panel}>
      <PanelHeading
        icon={CalendarDays}
        title={compact ? "NEWS TODAY" : "ข่าวและปฏิทินเศรษฐกิจ"}
        demo={preview}
      />
      {!compact && (
        <div className={styles.chips}>
          {["All", "USD", "EUR", "GBP", "JPY"].map((item) => (
            <button
              key={item}
              aria-pressed={currency === item}
              onClick={() => setCurrency(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}
      <div className={styles.tableScroll}>
        <table className={`${styles.table} ${styles.calendarTable}`}>
          <caption className={styles.srOnly}>
            ตัวอย่างรูปแบบปฏิทิน ไม่ใช่กำหนดการเศรษฐกิจปัจจุบัน
          </caption>
          {!compact && (
            <thead>
              <tr>
                <th>เวลาตัวอย่าง</th>
                <th>สกุลเงิน</th>
                <th>เหตุการณ์</th>
                <th>Impact</th>
                <th>Actual</th>
              </tr>
            </thead>
          )}
          <tbody>
            {preview ? (
              EVENTS.filter(
                (item) => currency === "All" || currency === item[1],
              )
                .slice(0, compact ? 4 : 5)
                .map(([time, fx, event, impact]) => (
                  <tr key={event}>
                    <td>{time}</td>
                    <td>
                      <span className={styles.currencyFlag}>
                        {fx === "USD" ? "🇺🇸" : fx === "EUR" ? "🇪🇺" : "🇬🇧"}
                      </span>
                      {!compact && fx}
                    </td>
                    <td>{event}</td>
                    <td>
                      <span
                        className={
                          impact === "High"
                            ? styles.highImpact
                            : styles.mediumImpact
                        }
                      >
                        {impact}
                      </span>
                    </td>
                    {!compact && <td>—</td>}
                  </tr>
                ))
            ) : (
              <tr>
                <td colSpan={5}>ยังไม่เชื่อมข้อมูลข่าวและปฏิทิน</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className={styles.note}>
        รายการและเวลาเป็นตัวอย่าง ไม่มีข้อมูลประกาศเศรษฐกิจปัจจุบัน
      </p>
    </section>
  );
}

export function AccountPanel({ preview, positionsOnly = false }) {
  const [tab, setTab] = useState("Positions");
  return (
    <section className={styles.panel}>
      <PanelHeading
        icon={Wallet}
        title={positionsOnly ? "POSITIONS & ACCOUNT" : "VANTAGE MT5 / ACCOUNT"}
        demo={preview}
      />
      {!positionsOnly && (
        <div className={styles.accountCard}>
          <span className={styles.brokerLogo}>V</span>
          <div>
            <strong>Vantage MT5</strong>
            <small>รองรับ Vantage เท่านั้น</small>
          </div>
          <span className={styles.disconnected}>ยังไม่เชื่อม</span>
        </div>
      )}
      {!positionsOnly && (
        <button
          className={styles.primaryButton}
          disabled
          aria-describedby="connection-note"
        >
          Connect Vantage MT5 · เร็ว ๆ นี้
        </button>
      )}
      <div className={styles.chips}>
        {["Positions", "Pending", "History"].map((item) => (
          <button
            key={item}
            aria-pressed={tab === item}
            onClick={() => setTab(item)}
          >
            {item}
            {preview && item === "Positions" ? " (ตัวอย่าง)" : ""}
          </button>
        ))}
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Type</th>
              <th>Volume</th>
              <th>Entry</th>
              <th>P/L (USD)</th>
            </tr>
          </thead>
          <tbody>
            {preview && tab === "Positions" ? (
              [
                ["XAUUSD", "BUY", "0.50", "2,650.00", "+60.00"],
                ["EURUSD", "BUY", "0.30", "1.0820", "+42.00"],
                ["GBPUSD", "SELL", "0.20", "1.2740", "+38.00"],
              ].map((row) => (
                <tr key={row[0]}>
                  {row.map((value, index) => (
                    <td
                      key={index}
                      className={index === 4 ? styles.positive : ""}
                    >
                      {index === 1 ? (
                        <span
                          className={
                            value === "SELL"
                              ? styles.shortPill
                              : styles.signalPill
                          }
                        >
                          {value}
                        </span>
                      ) : (
                        value
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className={styles.waiting}>
                  {tab === "Positions"
                    ? "ยังไม่มีข้อมูลสถานะบัญชี"
                    : `ยังไม่มีข้อมูล ${tab}`}{" "}
                  · รอเชื่อม MT5
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p id="connection-note" className={styles.note}>
        แผงนี้เป็นตัวอย่าง ไม่ใช่บัญชีที่เชื่อมจริง
        ไม่มีการรับรหัสผ่านหรือส่งคำสั่งเทรด
      </p>
    </section>
  );
}

export function RiskPanel({ preview, compact = false }) {
  const [fields, setFields] = useState({
    balance: "10000",
    riskPercent: "1",
    stopPips: "50",
    pipValue: "10",
  });
  const [result, setResult] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  return (
    <section className={styles.panel}>
      <PanelHeading icon={ShieldCheck} title="RISK MANAGEMENT" demo={preview} />
      <div className={styles.riskOverview}>
        <div className={styles.riskRing}>
          <strong>{preview ? "4.1%" : "—"}</strong>
          <small>Drawdown · Demo</small>
        </div>
        <dl>
          <div>
            <dt>Account risk</dt>
            <dd>{preview ? "Low · Demo" : "—"}</dd>
          </div>
          <div>
            <dt>Win rate</dt>
            <dd>{preview ? "68.2% · Demo" : "—"}</dd>
          </div>
          <div>
            <dt>Profit factor</dt>
            <dd>{preview ? "2.45 · Demo" : "—"}</dd>
          </div>
        </dl>
      </div>
      {!compact && (
        <>
          <h3 className={styles.smallHeading}>
            POSITION SIZE / คำนวณจากค่าที่กรอก
          </h3>
          <form
            className={styles.riskForm}
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
              setResult(calculateManualRisk(fields));
            }}
          >
            {[
              ["balance", "Account balance (USD)"],
              ["riskPercent", "Risk (%)"],
              ["stopPips", "Stop distance (pips)"],
              ["pipValue", "Pip value / lot (USD)"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  step="any"
                  min="0.000001"
                  max={key === "riskPercent" ? 100 : undefined}
                  required
                  value={fields[key]}
                  onChange={(event) => {
                    setFields((values) => ({
                      ...values,
                      [key]: event.target.value,
                    }));
                    setResult(null);
                    setSubmitted(false);
                  }}
                />
              </label>
            ))}
            <button className={styles.primaryButton} type="submit">
              คำนวณ Position Size
            </button>
          </form>
          <div className={styles.riskResult} role="status">
            {result ? (
              <>
                <span>
                  Risk amount <b>${result.riskAmount.toFixed(2)}</b>
                </span>
                <span>
                  Theoretical size{" "}
                  <b>{result.theoreticalLots.toFixed(4)} lots</b>
                </span>
              </>
            ) : submitted ? (
              "กรอกค่าบวกที่ถูกต้องทุกช่อง"
            ) : (
              "กรอกค่าตามสัญญาของคุณแล้วกดคำนวณ"
            )}
          </div>
          <p className={styles.note}>
            คำนวณจาก pip value ที่กรอกเอง ยังไม่รวม spread, commission และ
            volume step ของโบรกเกอร์
          </p>
        </>
      )}
    </section>
  );
}

export function Journal({
  instruments,
  entries,
  onAdd,
  compact = false,
  onNavigate,
}) {
  const [formOpen, setFormOpen] = useState(false),
    [symbol, setSymbol] = useState(instruments[0].canonical_symbol),
    [note, setNote] = useState("");
  return (
    <section className={styles.panel}>
      <PanelHeading
        icon={BookOpen}
        title="TRADE JOURNAL"
        label="LOCAL"
        action={
          <button
            className={styles.textButton}
            onClick={() =>
              compact ? onNavigate("journal") : setFormOpen((value) => !value)
            }
          >
            <Plus size={14} />
            บันทึกแผน
          </button>
        }
      />
      {formOpen && (
        <form
          className={styles.journalForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (!note.trim()) return;
            onAdd({ id: Date.now(), symbol, note: note.trim() });
            setNote("");
            setFormOpen(false);
          }}
        >
          <label>
            สินทรัพย์
            <select
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
            >
              {instruments.map((item) => (
                <option key={item.id}>{item.canonical_symbol}</option>
              ))}
            </select>
          </label>
          <label>
            บันทึกแผน
            <textarea
              aria-label="บันทึกแผนการเทรด"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              required
              placeholder="เหตุผล จุดที่ต้องติดตาม และสิ่งที่ได้เรียนรู้…"
            />
          </label>
          <button className={styles.primaryButton}>บันทึกในหน้านี้</button>
        </form>
      )}
      {entries.length ? (
        <div className={styles.journalEntries}>
          {entries.map((entry) => (
            <article key={entry.id}>
              <span>
                <BookOpen size={14} />
                <strong>{entry.symbol}</strong>
                <small>PLAN NOTE</small>
              </span>
              <p>{entry.note}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.emptyCompact}>
          <BookOpen size={28} />
          <strong>เริ่มบันทึกแผนและบทเรียนของคุณ</strong>
          <span>ยังไม่มีรายการบันทึก</span>
        </div>
      )}
      <p className={styles.note}>
        บันทึกชั่วคราวในหน้านี้ · ไม่ใช่รายการคำสั่งซื้อขาย ·
        รีโหลดแล้วล้างข้อมูล
      </p>
    </section>
  );
}
export function Alerts({ enabled, onChange }) {
  return (
    <section className={styles.panel}>
      <PanelHeading
        icon={Bell}
        title="AI ALERTS / การแจ้งเตือน"
        label="PREVIEW"
      />
      <p className={styles.note}>
        ทดลองตั้งค่าบนหน้าจอ ยังไม่มีการส่งแจ้งเตือนจริง
      </p>
      <div className={styles.alertRows}>
        {[
          ["Price", "Price alert", "ติดตามระดับราคาที่สนใจ"],
          ["AI", "AI signal", "ติดตามสัญญาณใหม่จากระบบ"],
          ["News", "Economic news", "เหตุการณ์เศรษฐกิจสำคัญ"],
          ["MT5", "MT5 connection", "สถานะและการซิงก์สินทรัพย์"],
        ].map(([key, label, description]) => (
          <div key={key}>
            <span className={styles.alertIcon}>
              <Bell size={17} />
            </span>
            <span>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
            <button
              role="switch"
              aria-label={`ตัวอย่าง ${label}`}
              aria-checked={enabled[key]}
              className={styles.toggle}
              onClick={() =>
                onChange((value) => ({ ...value, [key]: !value[key] }))
              }
            >
              <i />
            </button>
          </div>
        ))}
      </div>
      <div className={styles.alertDelivery}>
        <ShieldCheck size={16} />
        ช่องทาง LINE และการแจ้งเตือนจริงจะเปิดในระยะถัดไป
      </div>
    </section>
  );
}
