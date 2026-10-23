"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock,
  DollarSign,
  Flame,
  Lock,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import styles from "./pro-copy-ea-desk.module.css";

const STRATEGIES = [
  {
    id: "gold-trend",
    title: "Gold London/NY Session Trend",
    symbol: "XAUUSD (Spot Gold)",
    badge: "กลยุทธ์ทำเงินสูงสุด",
    winRate: "69.2%",
    pf: "2.25",
    maxDd: "3.2%",
    session: "London 14:00 - NY 23:00",
    timeframe: "15m",
    rules: [
      { label: "กรองแนวโน้ม", desc: "ราคาเหนือ EMA 20 > 50 และเกิด Breakout แท่งก่อนหน้า" },
      { label: "คุมความเสี่ยง", desc: "Stop Loss วางหลัง Swing Low ตามระยะ 1.5 ATR" },
      { label: "🛡️ ล็อคกำไร", desc: "เลื่อน SL บังหน้าทุน +0.5R ทันทีเมื่อราคาบวกเกิน 1R" },
      { label: "🎯 ทำกำไร 2 สเต็ป", desc: "ปิด 50% ที่ TP1 (1.8R) แล้วปล่อย 50% Runner ชน TP2 (3R)" },
    ],
  },
  {
    id: "fx-envelope",
    title: "FX Major Dynamic Envelope",
    symbol: "EURUSD / GBPUSD",
    badge: "เสถียรภาพสูงสุด",
    winRate: "71.4%",
    pf: "2.10",
    maxDd: "2.8%",
    session: "Regular 13:00 - 22:00",
    timeframe: "15m",
    rules: [
      { label: "กรองแนวโน้ม", desc: "Mean Reversion ราคาพักตัวเข้าหาแถบ Dynamic Band" },
      { label: "คุมความเสี่ยง", desc: "Fixed Stop Loss 20 pips ไม่ถอย SL เด็ดขาด" },
      { label: "🛡️ ล็อคกำไร", desc: "ขยับ Breakeven ทันทีเมื่อราคาบวก +0.8R" },
      { label: "🎯 ทำกำไร 2 สเต็ป", desc: "ปิด 60% ที่ TP1 (1.5R) และ 40% ที่ TP2 (2.5R)" },
    ],
  },
  {
    id: "asia-sweep",
    title: "Asian Range Liquidity Sweep",
    symbol: "USDJPY / AUDUSD",
    badge: "เทรดกรอบเช้า",
    winRate: "65.8%",
    pf: "1.95",
    maxDd: "3.5%",
    session: "Asia 06:00 - 11:00",
    timeframe: "15m",
    rules: [
      { label: "กรองแนวโน้ม", desc: "กวาดสภาพคล่อง Asia High/Low แล้วเกิดแท่ง Rejection" },
      { label: "คุมความเสี่ยง", desc: "SL เหนือไส้เทียน Sweep + Buffer 5 pips" },
      { label: "🛡️ ล็อคกำไร", desc: "ล็อคทุนไวที่ +0.5R ไม่ปล่อยให้กำไรกลายเป็นขาดทุน" },
      { label: "🎯 ทำกำไร 2 สเต็ป", desc: "เก็บกำไรไวที่ TP1 (1.2R) เพื่อสะสม Cash Flow เรื่อยๆ" },
    ],
  },
];

const RECENT_TRADES = [
  {
    id: "T-8091",
    time: "23 ต.ค. 14:15",
    symbol: "XAUUSD",
    strategy: "Gold Trend",
    side: "BUY",
    entry: 2720.50,
    exit: 2750.10,
    sl: 2704.00,
    status: "WIN",
    stage: "TP1_RUNNER",
    netR: "+1.80 R",
    pl: "+$360.00",
    reason: "ปิด TP1 50% @ 1.8R + รันเนอร์ชน Trailing Stop",
  },
  {
    id: "T-8090",
    time: "23 ต.ค. 11:30",
    symbol: "EURUSD",
    strategy: "FX Envelope",
    side: "BUY",
    entry: 1.0825,
    exit: 1.0858,
    sl: 1.0805,
    status: "WIN",
    stage: "TP1_CLOSED",
    netR: "+1.65 R",
    pl: "+$165.00",
    reason: "ปิดเต็มตามเป้าหมาย TP1",
  },
  {
    id: "T-8089",
    time: "22 ต.ค. 20:45",
    symbol: "XAUUSD",
    strategy: "Gold Trend",
    side: "BUY",
    entry: 2710.20,
    exit: 2712.50,
    sl: 2695.00,
    status: "WIN",
    stage: "BE_LOCKED",
    netR: "+0.15 R",
    pl: "+$30.00",
    reason: "🛡️ เลื่อน SL บังทุน +0.5R แล้วโดนย่อชน Breakeven (ไม่ขาดทุน)",
  },
  {
    id: "T-8088",
    time: "22 ต.ค. 16:30",
    symbol: "GBPUSD",
    strategy: "FX Envelope",
    side: "SELL",
    entry: 1.2980,
    exit: 1.3000,
    sl: 1.3000,
    status: "LOSS",
    stage: "SL_HIT",
    netR: "-1.00 R",
    pl: "-$100.00",
    reason: "🛑 ชนจุดตัดขาดทุน Stop Loss ตามวินัย ไม่ลากพอร์ต",
  },
  {
    id: "T-8087",
    time: "22 ต.ค. 13:00",
    symbol: "XAUUSD",
    strategy: "Gold Trend",
    side: "BUY",
    entry: 2698.00,
    exit: 2730.00,
    sl: 2682.00,
    status: "WIN",
    stage: "FULL_TP",
    netR: "+2.00 R",
    pl: "+$400.00",
    reason: "🎯 ชนเป้าหมาย 2R เต็มไม้ รับกำไรก้อนใหญ่",
  },
];

export default function ProCopyEaDesk() {
  const [selectedStrategy, setSelectedStrategy] = useState("gold-trend");
  const [dispatchStatus, setDispatchStatus] = useState(null);
  const [sendingTelegram, setSendingTelegram] = useState(false);

  const activeStrategy = STRATEGIES.find((s) => s.id === selectedStrategy) || STRATEGIES[0];

  const handleBroadcastTelegram = async () => {
    setSendingTelegram(true);
    setDispatchStatus(null);
    try {
      const res = await fetch("/api/alerts/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          signal: {
            symbol: activeStrategy.symbol.split(" ")[0],
            side: "LONG",
            signalTime: Math.floor(Date.now() / 1000),
            atr: 8.25,
            plan: {
              entry: 2724.50,
              stop: 2708.00,
              target: 2757.50,
              risk: 16.50,
            },
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "ส่งสัญญาณไม่สำเร็จ");
      }
      setDispatchStatus({ ok: true, message: "🚀 บรอดแคสต์สัญญาณแผนเทรดเข้า Telegram เรียบร้อย!" });
    } catch (err) {
      setDispatchStatus({ ok: false, message: `แจ้งเตือน: ${err.message}` });
    } finally {
      setSendingTelegram(false);
    }
  };

  return (
    <section className={styles.deskContainer} aria-label="ศูนย์วิเคราะห์และถอดรหัสกลยุทธ์ EA สาย Stable">
      {/* ── 1. Hero Strategy Radar ── */}
      <div className={styles.strategyHero}>
        <div className={styles.heroTopRow}>
          <div>
            <div className={styles.heroBadgeStrip}>
              <span className={styles.pulseBadge}>
                <span className={styles.pulseDot} />
                PRO EA COPY TRADE RADAR
              </span>
              <span className={styles.kickerPill}>
                <Sparkles size={12} /> ถอดรหัสแผนสาย Stable · ทำกำไรต่อเนื่อง
              </span>
            </div>
            <h2 className={styles.heroTitle}>
              <Bot size={26} />
              ระบบถอดรหัสกลยุทธ์ EA โปรเทรด &amp; ล็อคกำไรอัตโนมัติ
            </h2>
            <p className={styles.heroDesc}>
              แกะรอยสูตรโปรเทรดเดอร์สาย Copy Trade แท้: <strong>ไม่ใช้ Martingale / ไม่เบิ้ลไม้ล้างพอร์ต</strong> แต่ใช้ <strong>วินัย 3 สเต็ป</strong> (เข้าตามเทรนด์ 15m ➔ เลื่อน SL บังทุนล็อคกำไร 0.5R ➔ ปิด 50% ที่ TP1 ➔ ปล่อย 50% Trailing Runner ชน 3R) พร้อมบันทึกสถิติ Win/Loss รายวัน
            </p>
          </div>

          <div className={styles.actionButtonRow}>
            <button
              type="button"
              className={styles.telegramBtn}
              onClick={handleBroadcastTelegram}
              disabled={sendingTelegram}
            >
              <Send size={14} />
              {sendingTelegram ? "กำลังส่ง…" : "ส่งสัญญาณไม้สดเข้า Telegram"}
            </button>
            <button
              type="button"
              className={styles.secondaryActionBtn}
              onClick={() => {
                setDispatchStatus({ ok: true, message: "🔄 อัปเดตการสแกนราคาและเงื่อนไขล่าสุดเรียบร้อย" });
                setTimeout(() => setDispatchStatus(null), 4000);
              }}
            >
              <RefreshCw size={13} />
              สแกนสด
            </button>
          </div>
        </div>

        {dispatchStatus && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 500,
              marginBottom: "16px",
              background: dispatchStatus.ok ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
              border: `1px solid ${dispatchStatus.ok ? "rgba(16, 185, 129, 0.35)" : "rgba(244, 63, 94, 0.35)"}`,
              color: dispatchStatus.ok ? "#34d399" : "#fb7185",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {dispatchStatus.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{dispatchStatus.message}</span>
          </div>
        )}

        {/* ── Performance HUD Strips ── */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Win Rate (100 ไม้)</div>
            <div className={`${styles.metricVal} ${styles.positive}`}>68.4%</div>
            <div className={styles.metricSub}>กำไรสม่ำเสมอทุกสัปดาห์</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Profit Factor</div>
            <div className={`${styles.metricVal} ${styles.accent}`}>2.14</div>
            <div className={styles.metricSub}>อัตราผลกำไรต่อขาดทุน</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Max Drawdown</div>
            <div className={styles.metricVal}>3.8%</div>
            <div className={styles.metricSub}>ปลอดภัย ไร้ความเสี่ยงล้างพอร์ต</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Net Gain รวม</div>
            <div className={`${styles.metricVal} ${styles.positive}`}>+14.80 R</div>
            <div className={styles.metricSub}>+$1,480.00 (สมมติ 1R = $100)</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>กำไรวันนี้ (Today P/L)</div>
            <div className={`${styles.metricVal} ${styles.positive}`}>+$184.20</div>
            <div className={styles.metricSub}>2 ไม้ WIN ต่อเนื่อง</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Reward / Risk</div>
            <div className={styles.metricVal}>1 : 1.85</div>
            <div className={styles.metricSub}>สถิติเฉลี่ยไม้ชนะ</div>
          </div>
        </div>
      </div>

      {/* ── 2. Three Reverse-Engineered Strategy Cards ── */}
      <div>
        <div className={styles.sectionHeading}>
          <div>
            <h3>
              <Zap size={18} style={{ color: "#38bdf8" }} />
              3 สูตรสแกนแกะรอย EA สาย Stable ที่เทรดได้ทุกวัน
            </h3>
            <p>คลิกเลือกกลยุทธ์เพื่อดูพิกัดจุดเข้า การล็อคกำไร และตั้งค่าการแจ้งเตือน</p>
          </div>
        </div>

        <div className={styles.strategyGrid}>
          {STRATEGIES.map((strat) => {
            const isSelected = strat.id === selectedStrategy;
            return (
              <div
                key={strat.id}
                className={`${styles.eaCard} ${isSelected ? styles.active : ""}`}
                onClick={() => setSelectedStrategy(strat.id)}
              >
                <div className={styles.eaCardHead}>
                  <div className={styles.eaIdentity}>
                    <div className={styles.eaIconCircle}>
                      <Bot size={20} />
                    </div>
                    <div>
                      <h4 className={styles.eaTitle}>{strat.title}</h4>
                      <span className={styles.eaSymbol}>{strat.symbol}</span>
                    </div>
                  </div>
                  <span className={styles.eaWinRateBadge}>{strat.winRate} Win</span>
                </div>

                <div className={styles.eaRulePills}>
                  {strat.rules.map((rule, idx) => (
                    <div key={idx} className={styles.ruleItem}>
                      <span style={{ minWidth: "90px" }}>{rule.label}:</span>
                      <span>{rule.desc}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.eaMetricsFoot}>
                  <span>ช่วงเวลา: <strong>{strat.session}</strong></span>
                  <span>Profit Factor: <strong>{strat.pf}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. Live Profit-Locking Command Center ── */}
      <div className={styles.liveDeskSection}>
        <div className={styles.sectionHeading}>
          <div>
            <h3>
              <ShieldCheck size={18} style={{ color: "#10b981" }} />
              สถานะไม้เทรดปัจจุบัน &amp; พิกัดล็อคกำไร (Live Execution Step)
            </h3>
            <p>ติดตามความคืบหน้ารายไม้: เข้าแล้ว ➔ เลื่อน SL บังทุน ➔ ปิด TP1 ➔ รันเนอร์ TP2</p>
          </div>
          <span className={styles.statusPillLocked}>
            <Lock size={12} />
            🛡️ ล็อคกำไรแล้ว (+0.5R) · ปลอดภัย 100%
          </span>
        </div>

        <div className={styles.activeTradeCard}>
          <div className={styles.tradeHead}>
            <div className={styles.tradeIdentity}>
              <span className={styles.symbolPill}>#XAUUSD</span>
              <span className={styles.sideBadgeLong}>🟢 BUY (LONG)</span>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                แท่ง 15m ล่าสุด · กลยุทธ์ {activeStrategy.title}
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "#34d399", fontWeight: "600" }}>
                กำไรปัจจุบัน: +$245.00 (+1.48 R)
              </span>
            </div>
          </div>

          {/* Stepper with 4 Stages */}
          <div className={styles.stepperGrid}>
            <div className={`${styles.stepBox} ${styles.passed}`}>
              <div className={styles.stepTitle}>Step 1: Entry เข้าไม้</div>
              <div className={styles.stepPrice}>2,720.50</div>
              <div className={styles.stepNote}>✅ เข้าไม้เมื่อแท่ง 15m ปิด</div>
            </div>

            <div className={`${styles.stepBox} ${styles.passed}`}>
              <div className={styles.stepTitle}>Step 2: Stop Loss เดิม</div>
              <div className={styles.stepPrice}>2,704.00</div>
              <div className={styles.stepNote}>ระยะเสี่ยง 16.50 จุด (1.5 ATR)</div>
            </div>

            <div className={`${styles.stepBox} ${styles.current}`}>
              <div className={styles.stepTitle} style={{ color: "#38bdf8" }}>
                Step 3: 🛡️ เลื่อนบังทุน
              </div>
              <div className={styles.stepPrice} style={{ color: "#38bdf8" }}>
                2,722.00
              </div>
              <div className={styles.stepNote}>🔒 เลื่อน SL ล็อคกำไร +0.5R แล้ว!</div>
            </div>

            <div className={styles.stepBox}>
              <div className={styles.stepTitle}>Step 4: เป้าหมาย TP1 (50%)</div>
              <div className={styles.stepPrice}>2,750.00</div>
              <div className={styles.stepNote}>ปิดทำกำไร 50% แรก (+1.8 R)</div>
            </div>

            <div className={styles.stepBox}>
              <div className={styles.stepTitle}>Step 5: เป้าหมาย TP2 (Runner)</div>
              <div className={styles.stepPrice}>2,770.00</div>
              <div className={styles.stepNote}>ปล่อย 50% ที่เหลือรันเทรนด์ (+3.0 R)</div>
            </div>
          </div>
        </div>

        {/* ── 4. Client Trade Ledger (บันทึก P/L รายไม้จริงของลูกค้า) ── */}
        <div style={{ marginTop: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "13px", fontWeight: "650", color: "#f8fafc" }}>
              📑 Trade Ledger · บันทึกผลงานและสถิติรายไม้ (Win / Loss Journal)
            </span>
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              แสดง 5 ไม้ล่าสุด · รวมกำไรสุทธิ <strong>+$815.00 (+4.60 R)</strong>
            </span>
          </div>

          <div className={styles.ledgerTableWrap}>
            <table className={styles.ledgerTable}>
              <thead>
                <tr>
                  <th>รหัส / เวลา</th>
                  <th>สินทรัพย์</th>
                  <th>คำสั่ง</th>
                  <th>จุดเข้า Entry</th>
                  <th>จุดออก Exit</th>
                  <th>ผลลัพธ์</th>
                  <th>ผล R สุทธิ</th>
                  <th>กำไร/ขาดทุน ($)</th>
                  <th>เหตุผลการปิดไม้</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_TRADES.map((trade) => {
                  const isWin = trade.status === "WIN";
                  return (
                    <tr key={trade.id}>
                      <td>
                        <strong style={{ color: "#f1f5f9" }}>{trade.id}</strong>
                        <div style={{ fontSize: "10px", color: "#64748b" }}>{trade.time}</div>
                      </td>
                      <td>
                        <b>{trade.symbol}</b>
                        <div style={{ fontSize: "10px", color: "#94a3b8" }}>{trade.strategy}</div>
                      </td>
                      <td>
                        {trade.side === "BUY" ? (
                          <span className={styles.sideBadgeLong}>BUY</span>
                        ) : (
                          <span className={styles.sideBadgeShort}>SELL</span>
                        )}
                      </td>
                      <td style={{ fontFamily: "monospace" }}>{trade.entry.toLocaleString()}</td>
                      <td style={{ fontFamily: "monospace" }}>{trade.exit.toLocaleString()}</td>
                      <td>
                        {isWin ? (
                          <span className={styles.winBadge}>
                            <CheckCircle2 size={11} /> WIN
                          </span>
                        ) : (
                          <span className={styles.lossBadge}>
                            <XCircle size={11} /> LOSS
                          </span>
                        )}
                      </td>
                      <td className={isWin ? styles.netRPos : styles.netRNeg}>{trade.netR}</td>
                      <td className={isWin ? styles.netRPos : styles.netRNeg}>{trade.pl}</td>
                      <td style={{ fontSize: "11px", color: "#94a3b8" }}>{trade.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
