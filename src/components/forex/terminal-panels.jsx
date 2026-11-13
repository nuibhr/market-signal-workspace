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
export function Alerts({ enabled = {}, onChange, viewer = null }) {
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [showAdminConfig, setShowAdminConfig] = useState(false);
  const [activeTab, setActiveTab] = useState("telegram");

  const isAdminOrOwner = Boolean(viewer?.isAdmin || viewer?.dataOwner);

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

  const handleClaimVipInvite = async () => {
    setInviteLoading(true);
    setInviteResult(null);
    try {
      const res = await fetch("/api/alerts/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-invite",
          memberName: viewer?.displayName || viewer?.email || "VIP Member",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(
          data.error ||
            "ไม่สามารถออกลิงก์เชิญได้ กรุณาเข้าสู่ระบบและตรวจสอบสิทธิ์แพ็กเกจ Pro VIP (฿999/เดือน)"
        );
      }
      setInviteResult({
        ok: true,
        inviteLink: data.inviteLink,
        message:
          data.message ||
          "สร้างลิงก์เข้าห้อง Telegram VIP ส่วนกลางสำเร็จ (ใช้ได้ 1 ครั้ง / 1 คน)",
      });
    } catch (err) {
      setInviteResult({ ok: false, error: err.message });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleTestSend = async () => {
    setSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/alerts/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          token: telegramToken.trim() || undefined,
          chatId: telegramChatId.trim() || undefined,
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
        message: data.message || "ส่งข้อความสัญญาณเข้าห้อง Telegram VIP สำเร็จ!",
      });
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setSending(false);
    }
  };

  const handleTestVoice = async () => {
    if (voicePlaying) return;
    setVoicePlaying(true);
    const sampleText =
      "แจ้งเตือนสัญญาณทองคำ เอ็กซ์เอยู ยูเอสดี ฝั่งซื้อ ลอง จุดเข้าอ้างอิง 2720.50 จุดตัดขาดทุน 2704 เป้าหมายทำกำไร 2753.50 โปรดคุมความเสี่ยงตามแผนค่ะ";
    try {
      const url = `/api/tts?text=${encodeURIComponent(sampleText)}`;
      const audio = new Audio(url);
      audio.onended = () => setVoicePlaying(false);
      audio.onerror = () => {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(sampleText);
          u.lang = "th-TH";
          u.rate = 1.0;
          u.onend = () => setVoicePlaying(false);
          u.onerror = () => setVoicePlaying(false);
          window.speechSynthesis.speak(u);
        } else {
          setVoicePlaying(false);
        }
      };
      await audio.play();
    } catch {
      setVoicePlaying(false);
    }
  };

  return (
    <section className={styles.panel} aria-label="ศูนย์การแจ้งเตือนสัญญาณเทรด">
      <PanelHeading
        icon={Bell}
        title="AI ALERTS · ศูนย์แจ้งเตือนห้อง Telegram VIP & เสียงน้องนักออม"
        label="CENTRAL VIP ROOM"
      />

      <div className={styles.alertHeaderPill}>
        <span className={styles.liveDot} />
        <span>
          ห้องกลุ่ม Telegram VIP ส่วนกลางของระบบเรา · สแกนแท่งเทียนปิดจริงทุก 15 นาที · มีระบบคัดออกอัตโนมัติ (Auto-Kick) เมื่อหมดโปร
        </span>
      </div>

      {/* สรุปชัดเจน: แผนของอะไร / แจ้งเตือนยังไงเวลาไหน / ห้องกลุ่มใคร */}
      <div className={styles.alertExplainGrid}>
        <article className={styles.alertExplainCard}>
          <strong>📌 1. แผนของอะไร?</strong>
          <p>
            แผนสแกนเนอร์เดย์เทรด <b>15 นาที (XAUUSD ทองคำ &amp; คู่เงินหลัก)</b> และแผน <b>Pro Suite EA ล็อคกำไร 3 สเต็ป</b> (จุดเข้า Entry ➔ เลื่อน SL บังหน้าทุน +0.5R ➔ แบ่งปิด TP1 50% &amp; ปล่อย Runner ชน TP2) โดยเก็บสูตรการสแกนเป็นความลับของระบบ
          </p>
        </article>
        <article className={styles.alertExplainCard}>
          <strong>⏱️ 2. แจ้งเตือนยังไง &amp; เวลาไหน?</strong>
          <p>
            บอทส่วนกลางสแกนอัตโนมัติทุกๆ <b>15 นาทีทันทีที่แท่งเทียนปิดจริง</b> (<code>xx:00, xx:15, xx:30, xx:45 น.</code> จันทร์–ศุกร์) เน้นเซสชันสภาพคล่องสูง <b>เอเชีย 06:00–11:00 น.</b> และ <b>ลอนดอน/นิวยอร์ก 13:00–23:00 น.</b>
          </p>
        </article>
        <article className={styles.alertExplainCard}>
          <strong>👑 3. ห้องกลุ่มใคร? (เรา หรือ ลูกค้า)</strong>
          <p>
            เป็น <b>ห้องกลุ่ม Telegram VIP ส่วนกลางของระบบเรา</b> ลูกค้าไม่ต้องสร้างบอทหรือใส่ Token เอง เพียงกดรับ <b>ลิงก์เชิญแบบใช้ได้ 1 ครั้ง (One-Time Invite Link)</b> และระบบจะเตะออกอัตโนมัติเมื่อหมดอายุสมาชิก
          </p>
        </article>
      </div>

      <div className={styles.channelTabs}>
        <button
          type="button"
          aria-pressed={activeTab === "telegram"}
          onClick={() => setActiveTab("telegram")}
          className={activeTab === "telegram" ? styles.channelTabActive : styles.channelTab}
        >
          <Send size={14} /> ห้อง Telegram VIP ส่วนกลาง (แนะนำ)
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "voice"}
          onClick={() => setActiveTab("voice")}
          className={activeTab === "voice" ? styles.channelTabActive : styles.channelTab}
        >
          <Volume2 size={14} /> เสียงพูดภาษาไทย "น้องนักออม"
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "line"}
          onClick={() => setActiveTab("line")}
          className={activeTab === "line" ? styles.channelTabActive : styles.channelTab}
        >
          <ShieldCheck size={14} /> ทำไมถึงใช้ Telegram แทน LINE
        </button>
      </div>

      {activeTab === "telegram" && (
        <div className={styles.telegramBox}>
          <div className={styles.telegramBadge}>
            <span className={styles.costBadge}>👑 สิทธิ์สมาชิก Pro VIP (฿999/เดือน)</span>
            <small>ลิงก์เชิญส่วนตัวเข้าได้ 1 คน · ห้ามส่งต่อ · หมดโปรเตะออกอัตโนมัติ</small>
          </div>

          <div className={styles.vipInviteHero}>
            <div>
              <strong>เข้าห้องกลุ่มสัญญาณสด Telegram VIP (Forex &amp; Gold 15m)</strong>
              <p>
                สมาชิกไม่ต้องตั้งค่าบอทเอง กดปุ่มด้านล่างเพื่อรับลิงก์เข้าห้อง VIP ส่วนกลางของระบบ หรือจัดการสิทธิ์ได้ที่หน้าบัญชีสมาชิก
              </p>
            </div>
            <div className={styles.btnRow}>
              <button
                type="button"
                className={styles.dispatchBtn}
                onClick={handleClaimVipInvite}
                disabled={inviteLoading}
              >
                <Send size={15} />
                {inviteLoading
                  ? "กำลังออกลิงก์เชิญ VIP…"
                  : "🔗 รับลิงก์เข้าห้อง Telegram VIP (ใช้ได้ 1 ครั้ง / 1 คน)"}
              </button>
              <a href="/account" className={styles.guideToggle}>
                ไปที่หน้าบัญชีสมาชิก / อัปเกรด Pro VIP ↗
              </a>
            </div>
          </div>

          {inviteResult && (
            <div
              className={inviteResult.ok ? styles.successBox : styles.errorBox}
              role="status"
            >
              {inviteResult.ok ? (
                <div style={{ display: "grid", gap: "6px", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <CheckCircle2 size={16} />
                    <span>{inviteResult.message}</span>
                  </div>
                  {inviteResult.inviteLink && (
                    <a
                      href={inviteResult.inviteLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.dispatchBtn}
                      style={{ width: "fit-content", marginTop: "4px" }}
                    >
                      🚀 กดเข้าห้องกลุ่ม Telegram VIP ทันที <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              ) : (
                <>
                  <AlertCircle size={16} />
                  <span>{inviteResult.error}</span>
                </>
              )}
            </div>
          )}

          {isAdminOrOwner && (
            <div className={styles.guideBox}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <strong>🛠️ แผงควบคุมเจ้าของระบบ (Admin Broadcast Control)</strong>
                <div className={styles.btnRow} style={{ marginTop: 0 }}>
                  <button
                    type="button"
                    className={styles.dispatchBtn}
                    onClick={handleTestSend}
                    disabled={sending}
                  >
                    <Send size={14} />
                    {sending
                      ? "กำลังยิงสัญญาณเข้าห้อง VIP…"
                      : "📡 ทดสอบยิงสัญญาณเข้าห้อง Telegram VIP ส่วนกลาง"}
                  </button>
                  <button
                    type="button"
                    className={styles.guideToggle}
                    onClick={() => setShowAdminConfig((v) => !v)}
                  >
                    {showAdminConfig ? "ซ่อนตั้งค่า Token สำรอง" : "⚙️ ตั้งค่า Token สำรอง (เฉพาะ Admin)"}
                  </button>
                </div>
              </div>

              {showAdminConfig && (
                <div className={styles.inputStack} style={{ marginTop: "12px" }}>
                  <label className={styles.inputLabel}>
                    <span>Admin Override Bot Token (เว้นว่างไว้เพื่อใช้ค่าส่วนกลางของ Server)</span>
                    <input
                      type="password"
                      className={styles.textInput}
                      placeholder="ใช้ค่า TELEGRAM_BOT_TOKEN ของระบบอัตโนมัติ"
                      value={telegramToken}
                      onChange={(e) => handleSaveCredentials(e.target.value, telegramChatId)}
                    />
                  </label>
                  <label className={styles.inputLabel}>
                    <span>Admin Override Chat ID ห้องกลุ่ม VIP</span>
                    <input
                      type="text"
                      className={styles.textInput}
                      placeholder="ใช้ค่า TELEGRAM_CHAT_ID ของระบบอัตโนมัติ"
                      value={telegramChatId}
                      onChange={(e) => handleSaveCredentials(telegramToken, e.target.value)}
                    />
                  </label>
                </div>
              )}

              {testResult && (
                <div
                  className={testResult.ok ? styles.successBox : styles.errorBox}
                  style={{ marginTop: "10px" }}
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
            </div>
          )}

          <div className={styles.previewCard}>
            <span className={styles.previewKicker}>
              ตัวอย่างสัญญาณที่แจ้งเตือนเข้าห้องกลุ่ม Telegram VIP ส่วนกลาง:
            </span>
            <pre className={styles.previewText}>
{`⚡ NUGAOM AI · สัญญาณเดย์เทรด 15m คมชัด ⚡
────────────────────────
🏆 สินทรัพย์: #XAUUSD (Spot Gold / ทองคำ)
📊 คำสั่ง: 🟢 BUY (ซื้อ / ฝั่ง LONG)
⏱️ เวลาแท่งปิด: 14:15 น. (15 นาที)

🎯 จุดเข้า (Entry): 2,720.50
🛡️ จุดล็อคกำไรบังทุน (+0.5R): 2,728.75
🛑 จุดตัดขาดทุน (SL): 2,704.00
🏁 เป้าหมายทำกำไร (TP1 / TP2): 2,753.50 (1 : 2.0R)
────────────────────────
💡 วินัยคุมพอร์ต: แบ่งปิด 50% ที่ TP1 และเลื่อน SL บังหน้าทุนอัตโนมัติ`}
            </pre>
          </div>
        </div>
      )}

      {activeTab === "voice" && (
        <div className={styles.voiceBox}>
          <div className={styles.voiceHeader}>
            <Volume2 size={24} className={styles.voiceIcon} />
            <div>
              <strong>น้องนักออม · Thai Neural TTS Voice Alert</strong>
              <small>เสียงพูดภาษาไทยแจ้งจุดเข้า Entry / SL / TP อัตโนมัติทั้งบนมือถือและคอมพิวเตอร์</small>
            </div>
          </div>
          <p className={styles.voiceDesc}>
            เมื่อเปิดหน้ากระดานเทรดทิ้งไว้บนมือถือ, iPad หรือคอมพิวเตอร์ ทันทีที่แท่งเทียน 15 นาทีปิดและมีสัญญาณเข้าเงื่อนไข หรือราคาชนจุดขยับ SL บังทุน / ชน TP ระบบจะพูดแจ้งเตือนเป็นภาษาไทยชัดเจนโดยไม่ต้องจ้องจอตลอดเวลา
          </p>
          <div className={styles.voiceSample}>
            <span>ตัวอย่างเสียงประกาศภาษาไทย:</span>
            <em>
              "แจ้งเตือนสัญญาณทองคำ XAUUSD ฝั่งซื้อ LONG จุดเข้าอ้างอิง 2720.50 จุดตัดขาดทุน 2704 เป้าหมายทำกำไร 2753.50 โปรดคุมความเสี่ยงตามแผนค่ะ"
            </em>
          </div>
          <div className={styles.btnRow} style={{ marginTop: "12px" }}>
            <button
              type="button"
              className={styles.dispatchBtn}
              onClick={handleTestVoice}
              disabled={voicePlaying}
            >
              <Volume2 size={15} />
              {voicePlaying
                ? "🔊 กำลังพูดแจ้งเตือน…"
                : "🔊 กดทดสอบฟังเสียงน้องนักออม (TTS ภาษาไทย)"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "line" && (
        <div className={styles.lineBox}>
          <div className={styles.lineNotice}>
            <ShieldCheck size={20} />
            <div>
              <strong>ทำไมเราจึงใช้ห้องกลุ่ม Telegram VIP ส่วนกลางแทน LINE?</strong>
              <p>
                เนื่องจาก LINE Notify ยุติการให้บริการแล้ว และการส่งข้อความผ่าน LINE OA มีข้อจำกัดโควตาข้อความรายเดือน ระบบจึงใช้ <b>ห้องกลุ่ม Telegram VIP ส่วนกลาง</b> เพื่อให้ส่งสัญญาณเทรด 15 นาที + แจ้งเตือนขยับ SL บังหน้าทุนได้รวดเร็วระดับเสี้ยววินาที ไม่จำกัดจำนวนข้อความ และบริหารจัดการสิทธิ์สมาชิก (One-Time Link &amp; Auto-Kick) ได้อัตโนมัติ 100%
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={styles.alertRows}>
        {[
          ["Price", "Price & Structure Alert", "แจ้งเตือนเมื่อราคาแตะจุดเข้า Entry หรือจุดขยับ SL บังหน้าทุน (+0.5R)"],
          ["AI", "AI 15m Candle-Close Signal", "แจ้งเตือนเมื่อแท่งเทียน 15 นาทีปิดจริงและผ่านเกณฑ์สแกนเนอร์"],
          ["News", "High-Impact Economic News", "แจ้งเตือนก่อนข่าวสำคัญ (CPI, Non-Farm, FOMC) เพื่อลดความเสี่ยง"],
          ["Voice", "เสียงพูดภาษาไทย (น้องนักออม)", "อ่านสัญญาณและแผนเทรดด้วยเสียงภาษาไทยอัตโนมัติ"],
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
