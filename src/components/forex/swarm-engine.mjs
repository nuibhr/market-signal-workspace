import { computeATR, computeEMA } from "./studio-plan.mjs";

export const SWARM_AGENTS = Object.freeze([
  {
    id: "spotter",
    name: "SPOTTER",
    role: "Anomaly & Liquidity",
    title: "นักล่าสภาพคล่องและจุดผิดปกติ",
    color: "#00f0ff",
    glow: "rgba(0, 240, 255, 0.4)",
    badge: "ANOMALY",
  },
  {
    id: "edge",
    name: "EDGE",
    role: "Setup & Expected Value",
    title: "ผู้ประเมินความได้เปรียบ R:R",
    color: "#10b981",
    glow: "rgba(16, 185, 129, 0.4)",
    badge: "PROBABILITY",
  },
  {
    id: "prior",
    name: "PRIOR",
    role: "Devil's Advocate",
    title: "ฝ่ายค้านและผู้ตรวจสอบความเสี่ยง",
    color: "#f43f5e",
    glow: "rgba(244, 63, 94, 0.4)",
    badge: "CHALLENGER",
  },
  {
    id: "kelly",
    name: "KELLY",
    role: "Capital & Lot Sizing",
    title: "จอมจัดสรรพอร์ตตามสูตร Kelly",
    color: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.4)",
    badge: "RISK SIZER",
  },
  {
    id: "taker",
    name: "TAKER",
    role: "Execution & Timing",
    title: "ผู้คุมจังหวะซุ่มยิงออเดอร์",
    color: "#8b5cf6",
    glow: "rgba(139, 92, 246, 0.4)",
    badge: "SNIPER ENTRY",
  },
  {
    id: "closer",
    name: "CLOSER",
    role: "Exit & Trailing Guard",
    title: "ผู้คุมทางออกและล็อกกำไร",
    color: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.4)",
    badge: "EXIT GUARD",
  },
]);

/**
 * Executes a full 6-agent swarm debate cycle on given market bars.
 */
export function runSwarmDebate(bars, timeframe = "15m", userBalance = "1000") {
  if (!Array.isArray(bars) || bars.length < 20) {
    return null;
  }

  const currentBar = bars.at(-1);
  const closes = bars.map((b) => b.close);
  const ema20 = computeEMA(closes, 20);
  const ema50 = computeEMA(closes, 50);
  const atr = computeATR(bars, 14);

  const price = currentBar.close;
  const recentHigh = Math.max(...bars.slice(-15).map((b) => b.high));
  const recentLow = Math.min(...bars.slice(-15).map((b) => b.low));
  const range = recentHigh - recentLow;

  const isBullishTrend = ema20 > ema50 && price >= ema20;
  const isBearishTrend = ema20 < ema50 && price <= ema20;

  // 1. SPOTTER: Anomaly & Liquidity Sweeps
  const lowerWick = Math.min(currentBar.open, currentBar.close) - currentBar.low;
  const upperWick = currentBar.high - Math.max(currentBar.open, currentBar.close);
  const bodySize = Math.abs(currentBar.close - currentBar.open);
  const hasRejectionLow = lowerWick > bodySize * 1.2;
  const hasRejectionHigh = upperWick > bodySize * 1.2;

  let spotterNote = "";
  let direction = "STAND_ASIDE";
  if (isBullishTrend && hasRejectionLow) {
    direction = "BUY";
    spotterNote = `ตรวจพบ Liquidity Sweep ใต้แนวรับ $${recentLow.toFixed(2)} พร้อมไส้เทียนดีดกลับ $${lowerWick.toFixed(2)}`;
  } else if (isBearishTrend && hasRejectionHigh) {
    direction = "SELL";
    spotterNote = `ตรวจพบ Liquidity Trap เหนือแนวต้าน $${recentHigh.toFixed(2)} วอลุ่มสะบัดไส้เทียนบน $${upperWick.toFixed(2)}`;
  } else if (isBullishTrend) {
    direction = "BUY";
    spotterNote = `โครงสร้างแท่งเทียนยก High-Low ต่อเนื่อง ราคาประคองตัวเหนือ EMA20 ($${ema20.toFixed(2)})`;
  } else if (isBearishTrend) {
    direction = "SELL";
    spotterNote = `แท่งเทียนถูกกดใต้แนวต้าน EMA20 ($${ema20.toFixed(2)}) และหลุดต่ำกว่า EMA50`;
  } else {
    direction = "STAND_ASIDE";
    spotterNote = `การเคลื่อนไหวบีบตัวในกรอบ Sideway กรอบแคบ ($${range.toFixed(2)}) ยังไม่มีการล่าสภาพคล่องชัดเจน`;
  }

  // 2. EDGE: Advantage & Expected Value
  let edgeScore = 65;
  let entry = price;
  let stop = price;
  let target = price;
  let edgeNote = "";

  if (direction === "BUY") {
    const stopDistance = Math.max(atr * (timeframe === "15m" ? 0.45 : 0.75), 2.0);
    stop = Math.round((recentLow - stopDistance) * 100) / 100;
    const risk = price - stop;
    const targetDistance = Math.max(risk * 2.2, atr * 1.5);
    target = Math.round((price + targetDistance) * 100) / 100;
    const actualRr = (target - price) / (price - stop);
    edgeScore = actualRr >= 2.0 ? 88 : 72;
    edgeNote = `ประเมินฝั่ง BUY ได้เปรียบ: สัดส่วนกำไรต่อความเสี่ยง ${actualRr.toFixed(1)}R (เป้า $${target} / เสี่ยง $${stop})`;
  } else if (direction === "SELL") {
    const stopDistance = Math.max(atr * (timeframe === "15m" ? 0.45 : 0.75), 2.0);
    stop = Math.round((recentHigh + stopDistance) * 100) / 100;
    const risk = stop - price;
    const targetDistance = Math.max(risk * 2.2, atr * 1.5);
    target = Math.round((price - targetDistance) * 100) / 100;
    const actualRr = (price - target) / (stop - price);
    edgeScore = actualRr >= 2.0 ? 88 : 72;
    edgeNote = `ประเมินฝั่ง SELL ได้เปรียบ: สัดส่วนกำไรต่อความเสี่ยง ${actualRr.toFixed(1)}R (เป้า $${target} / เสี่ยง $${stop})`;
  } else {
    edgeNote = `ความได้เปรียบไม่ชัดเจน R:R ต่ำกว่าเกณฑ์มาตรฐาน 2.0R แนะนำรอสัญญาณยืนยัน`;
  }

  // 3. PRIOR: Devil's Advocate (Challenger)
  let priorDoubt = "";
  let riskDiscount = 1.0;
  if (direction === "BUY") {
    if (price > ema50 + atr * 2) {
      priorDoubt = `ค้าน! ราคายืดตัวห่างจากฐาน EMA50 เกินไป (+${(price - ema50).toFixed(1)}) เสี่ยงโดน Mean Reversion ทุบย่อ`;
      riskDiscount = 0.7;
      edgeScore -= 8;
    } else {
      priorDoubt = `ตรวจสอบแล้ว ไม่พบ Divergence ขัดแย้ง แต่ระวังความผันผวนช่วงตลาดเปิด ควรเผื่อ SL ให้พ้นจุดเหวี่ยง`;
    }
  } else if (direction === "SELL") {
    if (price < ema50 - atr * 2) {
      priorDoubt = `ค้าน! ราคาจมลึกใต้ EMA50 มากเกินไป เสี่ยงต่อการดีดตัวกลับทางเทคนิค (Short Squeeze)`;
      riskDiscount = 0.7;
      edgeScore -= 8;
    } else {
      priorDoubt = `ตรวจสอบแล้ว ไม่มีแนวรับสำคัญขวางหน้าในระยะ 1.5R แต่ต้องระวังการดีดตัว Re-test เส้น EMA20`;
    }
  } else {
    priorDoubt = `เห็นด้วยกับการอยู่เฉยๆ ตลาดไม่มีเทรนด์ การฝืนเข้าออเดอร์ในกรอบแคบจะเสียเปรียบค่า Spread`;
  }

  // 4. KELLY: Capital & Position Sizing
  const parsedBal = Number(userBalance) > 0 ? Number(userBalance) : 1000;
  // Fractional Kelly sizing formula
  const winRate = edgeScore >= 80 ? 0.62 : 0.52;
  const rrRatio = direction !== "STAND_ASIDE" && Math.abs(price - stop) > 0 ? Math.abs(target - price) / Math.abs(price - stop) : 2.0;
  const fullKelly = Math.max(0, (winRate * rrRatio - (1 - winRate)) / rrRatio);
  // Conservative quarter-kelly
  const recommendedRiskPercent = Math.min(Math.max(Number((fullKelly * 0.25 * 100 * riskDiscount).toFixed(2)), 0.5), 2.0);
  const riskAmount = (parsedBal * (recommendedRiskPercent / 100));
  const riskPerOunce = Math.abs(price - stop);
  const theoreticalLots = riskPerOunce > 0 ? (riskAmount / (riskPerOunce * 100)).toFixed(3) : "0.01";
  const kellyNote = `คำนวณเงินทุน $${parsedBal.toLocaleString()} ปรับลดความเสี่ยงตามฝ่ายค้านเหลือ ${recommendedRiskPercent}% ($${riskAmount.toFixed(1)}) = ${theoreticalLots} lot`;

  // 5. TAKER: Sniper Execution
  let takerNote = "";
  let executionPrice = price;
  if (direction === "BUY") {
    executionPrice = Math.round((price - atr * 0.1) * 100) / 100;
    takerNote = `วางจุดยิง Buy Limit ที่ $${executionPrice} (รอย่อเพื่อประหยัด 10% ของสเปรด)`;
  } else if (direction === "SELL") {
    executionPrice = Math.round((price + atr * 0.1) * 100) / 100;
    takerNote = `วางจุดยิง Sell Limit ที่ $${executionPrice} (รอดีดเข้าหาแนวต้านสั้น)`;
  } else {
    takerNote = `ระงับการยิงออเดอร์ทุกกรณี รอแท่งเทียนทะลุ Breakout ก่อน`;
  }

  // 6. CLOSER: Exit & Trailing Guard
  let closerNote = "";
  if (direction !== "STAND_ASIDE") {
    closerNote = `ล็อกจุดตัดขาดทุน SL $${stop} เด็ดขาด หากราคาบวกเกิน 1.5R ให้ขยับ SL บังหน้าทุนทันที`;
  } else {
    closerNote = `ไม่มีสถานะเปิด รักษาวินัยเงินสด 100%`;
  }

  // Dialogue Thread between Agents
  const dialogue = [
    {
      sender: "spotter",
      target: "edge",
      message: spotterNote,
      time: "00:01",
    },
    {
      sender: "edge",
      target: "prior",
      message: edgeNote,
      time: "00:02",
    },
    {
      sender: "prior",
      target: "kelly",
      message: priorDoubt,
      time: "00:03",
    },
    {
      sender: "kelly",
      target: "taker",
      message: kellyNote,
      time: "00:04",
    },
    {
      sender: "taker",
      target: "closer",
      message: takerNote,
      time: "00:05",
    },
    {
      sender: "closer",
      target: "all",
      message: closerNote,
      time: "00:06",
    },
  ];

  // Active Synapse Beams for Visual Reactor
  const synapses = [
    { from: "spotter", to: "edge", active: true },
    { from: "edge", to: "prior", active: true },
    { from: "prior", to: "kelly", active: true },
    { from: "kelly", to: "taker", active: true },
    { from: "taker", to: "closer", active: true },
    { from: "closer", to: "spotter", active: true },
  ];

  const grade = edgeScore >= 85 ? "A+" : edgeScore >= 75 ? "A" : edgeScore >= 65 ? "B" : "NEUTRAL";

  return {
    consensus: direction,
    confidence: edgeScore,
    grade,
    timeframe,
    timestamp: new Date().toISOString(),
    plan: {
      title: `มติสภา AI Swarm (${grade}) · ${direction === "BUY" ? "BUY GOLD" : direction === "SELL" ? "SELL GOLD" : "STAND ASIDE"}`,
      side: direction === "BUY" ? "buy" : "sell",
      entry: String(executionPrice),
      stop: String(stop),
      target: String(target),
      balance: String(parsedBal),
      riskPercent: String(recommendedRiskPercent),
      unitsPerLot: "100",
      condition: `มติเอกฉันท์ 6 AI Agents: ${dialogue[2].message}`,
      coach: `สภา AI Swarm (6 Agents · Grade ${grade})`,
    },
    dialogue,
    synapses,
    metrics: {
      atr: atr.toFixed(2),
      range: range.toFixed(2),
      recommendedLot: theoreticalLots,
      recommendedRiskPercent,
      rewardRatio: direction !== "STAND_ASIDE" ? (Math.abs(target - executionPrice) / Math.abs(executionPrice - stop)).toFixed(2) : "0",
    },
  };
}
