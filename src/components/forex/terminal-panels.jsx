import { useState, useEffect } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Globe2,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Volume2,
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
        {instrument.broker_symbol ?? instrument.canonical_symbol} ·{" "}
        {quote?.setup ?? "รอข้อมูลราคา"}
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

export function Heatmap({
  instruments,
  onSelect,
  preview,
  quotes = {},
  mt5 = false,
}) {
  return (
    <section className={styles.panel}>
      <PanelHeading
        icon={Globe2}
        title={mt5 ? "MARKET WATCH / BID" : "MARKET HEATMAP"}
        demo={preview}
        label={mt5 ? "MT5 / LAST QUOTES" : null}
      />
      <div className={styles.heatmap}>
        {instruments.slice(0, 8).map((item) => {
          const quote = preview
            ? demoQuote(item)
            : Object.hasOwn(quotes, item.broker_symbol)
              ? quotes[item.broker_symbol]
              : null;
          return (
            <button
              key={item.id}
              className={
                quote?.change < 0 ? styles.heatNegative : styles.heatPositive
              }
              onClick={() => onSelect(item)}
            >
              <strong>{item.broker_symbol ?? item.canonical_symbol}</strong>
              <span>
                {mt5 && quote
                  ? `${quote.price.toFixed(item.digits ?? 5)}${quote.stale ? " · STALE" : ""}`
                  : quote?.change !== undefined
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
          <span className={styles.disconnected}>ยังไม่มีฟีดพอร์ต</span>
        </div>
      )}
      {!positionsOnly && (
        <button
          className={styles.primaryButton}
          disabled
          aria-describedby="connection-note"
        >
          ข้อมูลพอร์ตบัญชี · ระยะถัดไป
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
    [symbol, setSymbol] = useState(
      instruments[0].broker_symbol ?? instruments[0].canonical_symbol,
    ),
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
                <option key={item.id}>
                  {item.broker_symbol ?? item.canonical_symbol}
                </option>
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
export function Alerts({ enabled = {}, onChange }) {
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [activeTab, setActiveTab] = useState("telegram");

  useEffect(() => {
    try {
      const savedToken = localStorage.getItem("nugaom_telegram_token") || "";
      const savedChatId = localStorage.getItem("nugaom_telegram_chat_id") || "";
      if (savedToken) setTelegramToken(savedToken);
      if (savedChatId) setTelegramChatId(savedChatId);
    } catch {}
  }, []);

  const handleSaveCredentials = (token, chatId) => {
    setTelegramToken(token);
    setTelegramChatId(chatId);
    try {
      localStorage.setItem("nugaom_telegram_token", token);
      localStorage.setItem("nugaom_telegram_chat_id", chatId);
    } catch {}
  };

  const handleTestSend = async () => {
    if (!telegramToken.trim() || !telegramChatId.trim()) {
      setTestResult({
        ok: false,
        error: "กรุณาระบุ Telegram Bot Token และ Chat ID / Channel ก่อนกดทดสอบ",
      });
      return;
    }
    setSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/alerts/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          token: telegramToken.trim(),
          chatId: telegramChatId.trim(),
          signal: {
            symbol: "XAUUSD",
            side: "LONG",
            signalTime: Math.floor(Date.now() / 1000),
            atr: 8.25,
            plan: {
              entry: 2720.5,
              stop: 2704.0,
              target: 2753.5,
              risk: 16.5,
            },
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "ส่งสัญญาณไม่สำเร็จ");
      }
      setTestResult({
        ok: true,
        message: data.message || "ส่งข้อความสัญญาณทดสอบเข้า Telegram สำเร็จ!",
      });
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className={styles.panel} aria-label="ศูนย์การแจ้งเตือนสัญญาณเทรด">
      <PanelHeading
        icon={Bell}
        title="AI ALERTS · ศูนย์แจ้งเตือนสัญญาณสด"
        label="LIVE BROADCAST"
      />

      <div className={styles.alertHeaderPill}>
        <span className={styles.liveDot} />
        <span>ระบบ Cloud แจ้งเตือนเรียลไทม์ 24 ชม. ไม่ต้องเปิดคอม</span>
      </div>

      <div className={styles.channelTabs}>
        <button
          type="button"
          aria-pressed={activeTab === "telegram"}
          onClick={() => setActiveTab("telegram")}
          className={activeTab === "telegram" ? styles.channelTabActive : styles.channelTab}
        >
          <Send size={13} /> Telegram (แนะนำ · ฟรี 100%)
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "voice"}
          onClick={() => setActiveTab("voice")}
          className={activeTab === "voice" ? styles.channelTabActive : styles.channelTab}
        >
          <Volume2 size={13} /> เสียงน้องนักออม
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "line"}
          onClick={() => setActiveTab("line")}
          className={activeTab === "line" ? styles.channelTabActive : styles.channelTab}
        >
          <ShieldCheck size={13} /> LINE Official
        </button>
      </div>

      {activeTab === "telegram" && (
        <div className={styles.telegramBox}>
          <div className={styles.telegramBadge}>
            <span className={styles.costBadge}>0 บาท · ไม่จำกัดข้อความ</span>
            <small>เด้งเข้ามือถือเสี้ยววินาที</small>
          </div>

          <div className={styles.inputStack}>
            <label className={styles.inputLabel}>
              <span>Telegram Bot Token</span>
              <input
                type="password"
                className={styles.textInput}
                placeholder="เช่น 123456789:ABCdefGhIJKlmNoPQRstUVwxyZ"
                value={telegramToken}
                onChange={(e) => handleSaveCredentials(e.target.value, telegramChatId)}
              />
            </label>

            <label className={styles.inputLabel}>
              <span>Telegram Chat ID หรือ @ชื่อแชนแนล</span>
              <input
                type="text"
                className={styles.textInput}
                placeholder="เช่น @MySignalChannel หรือ -1001234567890"
                value={telegramChatId}
                onChange={(e) => handleSaveCredentials(telegramToken, e.target.value)}
              />
            </label>
          </div>

          <div className={styles.btnRow}>
            <button
              type="button"
              className={styles.dispatchBtn}
              onClick={handleTestSend}
              disabled={sending}
            >
              <Send size={14} />
              {sending ? "กำลังยิงสัญญาณ…" : "ทดสอบส่งสัญญาณเข้า Telegram ทันที"}
            </button>
            <button
              type="button"
              className={styles.guideToggle}
              onClick={() => setShowGuide((v) => !v)}
            >
              {showGuide ? "ซ่อนวิธีสร้างบอท" : "📖 วิธีสร้างบอทใน 2 นาที"}
            </button>
          </div>

          {testResult && (
            <div
              className={testResult.ok ? styles.successBox : styles.errorBox}
              role="status"
            >
              {testResult.ok ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>{testResult.message}</span>
                </>
              ) : (
                <>
                  <AlertCircle size={16} />
                  <span>{testResult.error}</span>
                </>
              )}
            </div>
          )}

          {showGuide && (
            <div className={styles.guideBox}>
              <strong>วิธีตั้งค่า Telegram Bot เพื่อรับสัญญาณฟรี:</strong>
              <ol>
                <li>เปิดแอป Telegram ค้นหา <code>@BotFather</code> แล้วพิมพ์ <code>/newbot</code> เพื่อสร้างบอทและรับ <b>HTTP API Token</b></li>
                <li>สร้าง Telegram Channel หรือ Group ของคุณ แล้วกดเพิ่มบอทที่คุณสร้างให้เป็น <b>Administrator</b></li>
                <li>ใส่ <b>Bot Token</b> และ <b>@ชื่อแชนแนล</b> ในช่องด้านบน แล้วกดปุ่มทดสอบได้ทันที!</li>
              </ol>
            </div>
          )}

          <div className={styles.previewCard}>
            <span className={styles.previewKicker}>ตัวอย่างข้อความที่ลูกค้าจะได้รับใน Telegram:</span>
            <pre className={styles.previewText}>
{`⚡ NUGAOM AI · สัญญาณเดย์เทรด 15m คมชัด ⚡
────────────────────────
🏆 สินทรัพย์: #XAUUSD (Spot Gold / ทองคำ)
📊 คำสั่ง: 🟢 BUY (ซื้อ / ฝั่ง LONG)
⏱️ เวลาแท่งปิด: 14:15 น. (15 นาที)

🎯 จุดเข้า (Entry): 2,720.50
🛑 จุดตัดขาดทุน (SL): 2,704.00
🏁 เป้าหมายทำกำไร (TP 2R): 2,753.50
⚖️ Risk/Reward Ratio: 1 : 2.0 (ระยะเสี่ยง: 16.50)
────────────────────────
💡 วินัยคุมพอร์ต: คุมความเสี่ยงไม่เกิน 1–2% ของเงินทุน
🔗 เปิดดูกราฟสด: https://nugaom.com/forex ↗`}
            </pre>
          </div>
        </div>
      )}

      {activeTab === "voice" && (
        <div className={styles.voiceBox}>
          <div className={styles.voiceHeader}>
            <Volume2 size={24} className={styles.voiceIcon} />
            <div>
              <strong>น้องนักออม · Voice Synthesizer</strong>
              <small>เสียงพูดภาษาไทยแจ้งจุดเข้า Entry / SL / TP อัตโนมัติ</small>
            </div>
          </div>
          <p className={styles.voiceDesc}>
            ระบบจะส่งเสียงพูดภาษาไทยแจ้งพิกัดจุดเข้าและเป้าหมายทันทีที่แท่ง 15m ปิดและเงื่อนไขเทรดผ่านเกณฑ์ โดยผู้ใช้สามารถเปิดหน้านี้ทิ้งไว้บน iPad หรือคอมพิวเตอร์เพื่อฟังเสียงเตือนขณะทำงานได้ทันที
          </p>
          <div className={styles.voiceSample}>
            <span>ตัวอย่างเสียงประกาศ:</span>
            <em>"XAUUSD ฟอเร็กซ์ LONG เข้าไม้ ราคาอ้างอิง 2720 จุดตัดขาดทุน 2704 เป้าหมาย 2753"</em>
          </div>
        </div>
      )}

      {activeTab === "line" && (
        <div className={styles.lineBox}>
          <div className={styles.lineNotice}>
            <ShieldCheck size={18} />
            <div>
              <strong>การแจ้งเตือนผ่าน LINE Official Account (Messaging API)</strong>
              <p>
                LINE Notify ปิดให้บริการถาวรแล้ว (มี.ค. 2025) การส่งผ่าน LINE OA ในแพ็กเกจฟรีจำกัดเพียง 300–500 ข้อความ/เดือน หากมีผู้ใช้หลายคนส่งสัญญาณทุกวันจะเกินโควตาทันที แนะนำให้ใช้ <b>Telegram Channel</b> เป็นช่องทางหลักเนื่องจากฟรี 100% ไม่จำกัดจำนวนข้อความ
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={styles.alertRows}>
        {[
          ["Price", "Price alert", "ติดตามระดับราคาที่สนใจ"],
          ["AI", "AI 15m signal", "ติดตามสัญญาณใหม่จากระบบแท่ง 15m"],
          ["News", "Economic news", "เหตุการณ์เศรษฐกิจสำคัญ"],
          ["Voice", "Thai voice announcement", "เปิดระบบเสียงน้องนักออม"],
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
              type="button"
              role="switch"
              aria-label={`ตัวอย่าง ${label}`}
              aria-checked={enabled[key] ?? true}
              className={styles.toggle}
              onClick={() =>
                onChange?.((value) => ({ ...value, [key]: !value[key] }))
              }
            >
              <i />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
