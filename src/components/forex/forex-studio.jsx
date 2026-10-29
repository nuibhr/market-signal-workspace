"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleHelp, RotateCcw, ChevronRight, Save, Trash2 } from "lucide-react";
import CandlestickChart from "../candlestick-chart.jsx";
import { demoBars } from "./terminal-demo.mjs";
import { resolveInitialInstrument } from "./symbol-universe.mjs";
import { calculateStudioPlan, planPriceLines } from "./studio-plan.mjs";
import styles from "./forex-studio.module.css";

// The studio is intentionally isolated from the live data and publishing paths.
const candles = demoBars(resolveInitialInstrument("XAU/USD"), "1h");
const INITIAL_VISIBLE = 60;
const STORAGE_KEY = "nugaom.forex.practice-plans.v1";
const INITIAL_PLAN = { title: "แผนตัวอย่างทองคำ", side: "buy", entry: "2651", stop: "2646", target: "2661", balance: "1000", riskPercent: "1", unitsPerLot: "100", condition: "หากราคาผิดทาง ให้ทบทวนแผน" };
const FIELDS = ["title", "side", "entry", "stop", "target", "balance", "riskPercent", "unitsPerLot", "condition"];
function readPlans() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter(item => item && typeof item.id === "string" && item.plan && FIELDS.every(key => typeof item.plan[key] === "string") && !calculateStudioPlan(item.plan).error).slice(0, 20);
  } catch { return []; }
}
function writePlans(plans) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plans)); return true; } catch { return false; }
}
function Mascot() {
  return <div className={styles.mascotStage} aria-hidden="true"><div className={styles.mascotShadow}/><div className={styles.mascot}><span className={styles.hair}/><span className={styles.face}><i/><i/><b/></span><span className={styles.body}/><span className={styles.legs}/></div><span className={styles.spark}>✦</span></div>;
}
const display = (number, digits = 2) => Number.isFinite(number) ? number.toLocaleString("en-US", { maximumFractionDigits: digits }) : "—";

export default function ForexStudio() {
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const [plan, setPlan] = useState(INITIAL_PLAN);
  const [plans, setPlans] = useState([]);
  const [message, setMessage] = useState("");
  useEffect(() => { setPlans(readPlans()); }, []);
  const bars = useMemo(() => candles.slice(0, visible), [visible]);
  const priceLines = useMemo(() => planPriceLines(plan), [plan.entry, plan.stop, plan.target]);
  const result = useMemo(() => calculateStudioPlan(plan), [plan]);
  const update = (name, value) => { setPlan(current => ({ ...current, [name]: value })); setMessage(""); };
  const save = event => {
    event.preventDefault();
    if (result.error) { setMessage(result.error); return; }
    const next = [{ id: String(Date.now()) + "-" + Math.random().toString(36).slice(2), plan: { ...plan } }, ...plans].slice(0, 20);
    if (writePlans(next)) { setPlans(next); setMessage("บันทึกแล้วในเบราว์เซอร์เครื่องนี้"); }
    else setMessage("บันทึกไม่ได้: เบราว์เซอร์ไม่อนุญาตให้เก็บข้อมูล");
  };
  const remove = id => {
    const next = plans.filter(item => item.id !== id);
    if (writePlans(next)) { setPlans(next); setMessage("ลบแผนจากเบราว์เซอร์แล้ว"); }
    else setMessage("ลบไม่ได้: เบราว์เซอร์ไม่อนุญาตให้เก็บข้อมูล");
  };

  return <div className={styles.studio}>
    <section className={styles.studioHead}>
      <div><div className={styles.eyebrow}><span/> FOREX LIVE STUDIO <span className={styles.examplePill}>ข้อมูลจำลอง</span></div><h1>วางแผนทองคำบนกราฟ</h1><p>กำหนดจุดเข้า จุดตัดขาดทุน และเป้าหมาย แล้วดูความเสี่ยงจากตัวเลขที่คุณกรอก</p></div>
      <div className={styles.host}><Mascot/><div><strong>น้องนักออม</strong><small>เพื่อนร่วมทางในห้องฝึก</small></div></div>
    </section>
    <div className={styles.notice}><CircleHelp size={16}/><p><strong>โหมดฝึก:</strong> ราคากราฟและแผนเริ่มต้นเป็นข้อมูลจำลอง ไม่ใช่ข้อมูลตลาดจริง แผนที่บันทึกอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น ทุกคนที่ใช้เบราว์เซอร์นี้อาจเห็นได้ และยังไม่ได้แชร์ให้สมาชิก</p></div>
    <div className={styles.workbench}>
      <section className={styles.panel} aria-labelledby="chart-title">
        <div className={styles.heading}><div><span className={styles.overline}>PRACTICE CHART</span><h2 id="chart-title">XAU/USD · กราฟจำลอง</h2></div><span className={styles.tag}>ตัวอย่าง · 1H</span></div>
        <div className={styles.chart}><CandlestickChart symbol="XAUUSD" timeframe="1h" bars={bars} priceLines={priceLines} chartRange="all" source="ข้อมูลจำลอง" /></div>
        <p className={styles.planFoot}>เส้น Entry, SL, TP เปลี่ยนตามข้อมูลในแบบฟอร์ม · กราฟโดย <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView Lightweight Charts™</a></p>
        <div className={styles.chartControls}><button type="button" onClick={() => setVisible(INITIAL_VISIBLE)}><RotateCcw size={14}/> เริ่มใหม่</button><span>กราฟจำลอง {visible} / {candles.length} แท่ง</span><button type="button" className={styles.primary} onClick={() => setVisible(n => Math.min(candles.length, n + 1))} disabled={visible === candles.length}>ดูแท่งถัดไป <ChevronRight size={15}/></button></div>
      </section>
      <section className={styles.panel} aria-labelledby="plan-title">
        <div className={styles.heading}><div><span className={styles.overline}>TRADE PLAN · DEMO</span><h2 id="plan-title">สร้างแผนตัวอย่าง</h2></div></div>
        <form className={styles.form} onSubmit={save}>
          <label>ชื่อแผน<input maxLength={60} value={plan.title} onChange={e => update("title",e.target.value)} /></label>
          <label>ฝั่งแผน<select value={plan.side} onChange={e => update("side",e.target.value)}><option value="buy">ซื้อ (BUY)</option><option value="sell">ขาย (SELL)</option></select></label>
          <div className={styles.formRow}><label>จุดเข้า · Entry ($)<input type="number" min="0.000001" step="any" required value={plan.entry} onChange={e => update("entry",e.target.value)}/></label><label>ตัดขาดทุน · SL ($)<input type="number" min="0.000001" step="any" required value={plan.stop} onChange={e => update("stop",e.target.value)}/></label></div>
          <label>เป้าหมาย · TP ($)<input type="number" min="0.000001" step="any" required value={plan.target} onChange={e => update("target",e.target.value)}/></label>
          <div className={styles.formRow}><label>ทุนสมมติ ($)<input type="number" min="0.000001" step="any" required value={plan.balance} onChange={e => update("balance",e.target.value)}/></label><label>เสี่ยงต่อแผน (%)<input type="number" min="0.000001" max="100" step="any" required value={plan.riskPercent} onChange={e => update("riskPercent",e.target.value)}/></label></div>
          <label>ขนาดสัญญา · ออนซ์ต่อ 1 lot<input type="number" min="0.000001" step="any" required value={plan.unitsPerLot} onChange={e => update("unitsPerLot",e.target.value)}/></label>
          <label>เงื่อนไขที่ต้องทบทวน<textarea maxLength={160} rows={2} value={plan.condition} onChange={e => update("condition",e.target.value)}/></label>
          <div className={styles.results} aria-live="polite">{result.error ? <p className={styles.error}>{result.error}</p> : <><div><span>เงินที่เสี่ยง</span><strong>${display(result.riskAmount)}</strong></div><div><span>ขนาดตามสูตร</span><strong>{display(result.theoreticalLots, 4)} lot</strong></div><div><span>เป้าหมาย / ความเสี่ยง</span><strong>{display(result.rewardRatio)} R</strong></div></>}</div>
          <p className={styles.planFoot}>ผลประมาณการสำหรับ XAU/USD และทุนสกุล USD ตามขนาดสัญญาที่กรอก ไม่รวม spread, commission, slippage และข้อกำหนดขนาด lot ของโบรกเกอร์</p>
          <button className={styles.primary} type="submit"><Save size={15}/> บันทึกแผนในเครื่องนี้</button><span className={styles.feedback} role="status">{message}</span>
        </form>
      </section>
    </div>
    <section className={styles.panel} aria-labelledby="saved-plans-title">
      <div className={styles.heading}><div><span className={styles.overline}>SAVED ON THIS DEVICE</span><h2 id="saved-plans-title">แผนที่บันทึกในเบราว์เซอร์</h2></div><span className={styles.tag}>{plans.length} / 20</span></div>
      {plans.length === 0 ? <p className={styles.description}>ยังไม่มีแผนที่บันทึก กรอกแผนแล้วกดบันทึกเพื่อกลับมาดูภายหลัง</p> : <ul className={styles.savedList}>{plans.map(item => <li key={item.id}><button className={styles.loadPlan} type="button" onClick={() => { setPlan(item.plan); setMessage("เปิดแผนที่บันทึกแล้ว"); }}><strong>{item.plan.title || "แผนไม่มีชื่อ"}</strong><span>{item.plan.side === "buy" ? "BUY" : "SELL"} · Entry {item.plan.entry} · SL {item.plan.stop} · TP {item.plan.target}</span></button><button className={styles.deletePlan} type="button" onClick={() => remove(item.id)} aria-label={`ลบ ${item.plan.title || "แผนไม่มีชื่อ"}`}><Trash2 size={16}/></button></li>)}</ul>}
      <p className={styles.planFoot}>ข้อมูลอยู่ในเบราว์เซอร์นี้ อาจหายเมื่อล้างข้อมูลเบราว์เซอร์ และไม่ได้ผูกกับบัญชีสมาชิก</p>
    </section>
  </div>;
}
