// Educational XAU/USD plan calculations. No broker order or live account data.
const positive = (value) => {
  if (typeof value === "string" && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function calculateStudioPlan(plan) {
  const entry = positive(plan.entry), stop = positive(plan.stop), target = positive(plan.target);
  const balance = positive(plan.balance), riskPercent = positive(plan.riskPercent), unitsPerLot = positive(plan.unitsPerLot);
  if (![entry, stop, target, balance, riskPercent, unitsPerLot].every(Boolean) || riskPercent > 100) {
    return { error: "กรอกตัวเลขที่มากกว่า 0 ทุกช่อง และความเสี่ยงไม่เกิน 100%" };
  }
  if (plan.side !== "buy" && plan.side !== "sell") return { error: "เลือกฝั่งแผน" };
  if (plan.side === "buy" ? !(stop < entry && entry < target) : !(target < entry && entry < stop)) {
    return { error: plan.side === "buy" ? "แผนซื้อ: SL ต้องต่ำกว่า Entry และ TP ต้องสูงกว่า Entry" : "แผนขาย: TP ต้องต่ำกว่า Entry และ SL ต้องสูงกว่า Entry" };
  }
  const stopDistance = Math.abs(entry - stop);
  const rewardDistance = Math.abs(target - entry);
  const riskAmount = balance * riskPercent / 100;
  const theoreticalLots = riskAmount / (stopDistance * unitsPerLot);
  const rewardRatio = rewardDistance / stopDistance;
  if (![riskAmount, theoreticalLots, rewardRatio].every(n => Number.isFinite(n) && n > 0)) return { error: "ตัวเลขมากหรือน้อยเกินกว่าจะคำนวณได้" };
  return { riskAmount, theoreticalLots, rewardRatio, stopDistance };
}

export function planPriceLines(plan) {
  return [["Entry",plan.entry,"#8eb6ff"],["SL",plan.stop,"#ff8493"],["TP",plan.target,"#70e1b9"]]
    .map(([title,value,color]) => ({title,price:positive(value),color})).filter(line => line.price !== null);
}

export const PRACTICE_STORAGE_KEY = "nugaom.forex.practice-plans.v1";
export const PRACTICE_FIELDS = ["title", "side", "entry", "stop", "target", "balance", "riskPercent", "unitsPerLot", "condition"];
export const INITIAL_PRACTICE_PLAN = {
  title: "แผนตัวอย่างทองคำ",
  side: "buy",
  entry: "2651",
  stop: "2646",
  target: "2661",
  balance: "1000",
  riskPercent: "1",
  unitsPerLot: "100",
  condition: "หากราคาผิดทาง ให้ทบทวนแผน",
};

export function readPracticePlans(storage = (typeof window !== "undefined" ? window.localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(PRACTICE_STORAGE_KEY);
    const saved = JSON.parse(raw || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter(item =>
      item &&
      typeof item.id === "string" &&
      item.plan &&
      PRACTICE_FIELDS.every(key => typeof item.plan[key] === "string") &&
      !calculateStudioPlan(item.plan).error
    ).slice(0, 20);
  } catch {
    return [];
  }
}

export function writePracticePlans(plans, storage = (typeof window !== "undefined" ? window.localStorage : null)) {
  if (!storage) return false;
  try {
    storage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(plans));
    return true;
  } catch {
    return false;
  }
}

export function calculateAutoTarget(plan, rr = 2) {
  const entry = positive(plan.entry);
  const stop = positive(plan.stop);
  if (!entry || !stop) return null;
  const distance = Math.abs(entry - stop);
  if (distance === 0) return null;
  const target = plan.side === "buy" ? entry + distance * rr : entry - distance * rr;
  return target > 0 ? (Number.isInteger(target) ? String(target) : target.toFixed(2)) : null;
}

export function calculateAutoStop(plan, currentBar) {
  const entry = positive(plan.entry);
  if (!entry) return null;
  const low = currentBar?.low ?? entry - 5;
  const high = currentBar?.high ?? entry + 5;
  const buffer = 1.5;
  const stop = plan.side === "buy" ? Math.min(entry - 1, low - buffer) : Math.max(entry + 1, high + buffer);
  return stop > 0 ? (Number.isInteger(stop) ? String(stop) : stop.toFixed(2)) : null;
}

export function invertPlanSide(plan, nextSide) {
  if (plan.side === nextSide) return plan;
  const entry = positive(plan.entry);
  const stop = positive(plan.stop);
  const target = positive(plan.target);
  if (!entry || !stop || !target) {
    return { ...plan, side: nextSide };
  }
  const stopDist = Math.abs(entry - stop);
  const targetDist = Math.abs(target - entry);
  const nextStop = nextSide === "buy" ? entry - stopDist : entry + stopDist;
  const nextTarget = nextSide === "buy" ? entry + targetDist : entry - targetDist;
  return {
    ...plan,
    side: nextSide,
    stop: nextStop > 0 ? (Number.isInteger(nextStop) ? String(nextStop) : nextStop.toFixed(2)) : plan.stop,
    target: nextTarget > 0 ? (Number.isInteger(nextTarget) ? String(nextTarget) : nextTarget.toFixed(2)) : plan.target,
  };
}

export function computeATR(bars, period = 14) {
  if (!bars || bars.length < period + 1) return 3.5;
  const ranges = bars.slice(1).map((bar, i) =>
    Math.max(bar.high - bar.low, Math.abs(bar.high - bars[i].close), Math.abs(bar.low - bars[i].close))
  );
  let atr = ranges.slice(0, period).reduce((sum, n) => sum + n, 0) / period;
  for (const range of ranges.slice(period)) atr = (atr * (period - 1) + range) / period;
  return Number.isFinite(atr) && atr > 0 ? atr : 3.5;
}

export function computeEMA(values, period) {
  if (!values || values.length === 0) return null;
  if (values.length < period) return values.at(-1);
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

export function detectChartSetup(bars, timeframe = "1h") {
  if (!bars || bars.length < 10) return null;
  const last = bars.at(-1);
  const slice = bars.slice(-25);
  const closes = slice.map(b => b.close);
  const atr = computeATR(bars, 14);
  const ema20 = computeEMA(closes, 20) ?? last.close;

  const isDaytrade = timeframe === "15m";
  const swingWindow = bars.slice(isDaytrade ? -6 : -10);
  const highest = Math.max(...swingWindow.map(b => b.high));
  const lowest = Math.min(...swingWindow.map(b => b.low));
  const trend = last.close >= ema20 ? "up" : "down";

  if (trend === "up") {
    const entry = Math.round(last.close * 10) / 10;
    // Structural stop buffer based on timeframe and ATR
    const buffer = isDaytrade ? Math.max(1.5, Math.round(atr * 0.45 * 10) / 10) : Math.max(2.5, Math.round(atr * 0.75 * 10) / 10);
    const maxStopDist = entry > 200 ? Math.max(6.0, Math.min(25.0, atr * 2.0)) : Math.max(0.002, atr * 2.0);
    const minStopDist = entry > 200 ? 2.5 : Math.max(0.0008, atr * 0.8);
    const candidateStop = isDaytrade
      ? Math.max(lowest, last.low - buffer)
      : Math.max(lowest - buffer, entry - maxStopDist);
    const rawStop = Math.max(entry - maxStopDist, Math.min(entry - minStopDist, candidateStop));
    const stop = entry > 200 ? Math.round(rawStop * 10) / 10 : Number(rawStop.toFixed(4));
    const distance = Math.max(minStopDist, entry - stop);
    const target = entry > 200 ? Math.round((entry + distance * 2.0) * 10) / 10 : Number((entry + distance * 2.0).toFixed(4));

    return {
      title: isDaytrade
        ? `แผนคม 15m: ย่อซื้อตามเทรนด์ EMA20 ($${entry})`
        : `แผนหลัก 1H: โครงสร้างขาขึ้น Higher Low ($${entry})`,
      side: "buy",
      entry: String(entry),
      stop: String(stop),
      target: String(target),
      balance: "1000",
      riskPercent: "1",
      unitsPerLot: "100",
      timeframe,
      atr: Math.round(atr * 10) / 10,
      setupName: isDaytrade ? "Daytrade 15m Pullback Rejection" : "Structure 1H Trend Continuation",
      condition: isDaytrade
        ? `แผน Daytrade 15m: รอยืนยันแท่ง 15m ย่อทดสอบแนวรับ หากราคาปิดหลุด $${stop} หรือไซด์เวย์เกิน 4 แท่ง ให้ปิดแผนทันที`
        : `แผน Swing 1H: รอแท่งเทียนยืนเหนือแนวรับ $${stop} ได้อย่างมั่นคง ล็อกเป้าหมาย 2R ที่ $${target} หลุดโครงสร้างยอมคัทลอส`,
      summary: `ตรวจพบเทรนด์ขาขึ้นเหนือ EMA20 (ATR: ±$${Math.round(atr * 10) / 10}) แนะนำเข้าซื้อที่ $${entry} วาง SL ลึกใต้สวิงโลว์ $${stop} และเป้าหมาย 2R คมๆ ที่ $${target}`,
    };
  } else {
    const entry = Math.round(last.close * 10) / 10;
    const buffer = isDaytrade ? Math.max(1.5, Math.round(atr * 0.45 * 10) / 10) : Math.max(2.5, Math.round(atr * 0.75 * 10) / 10);
    const maxStopDist = entry > 200 ? Math.max(6.0, Math.min(25.0, atr * 2.0)) : Math.max(0.002, atr * 2.0);
    const minStopDist = entry > 200 ? 2.5 : Math.max(0.0008, atr * 0.8);
    const candidateStop = isDaytrade
      ? Math.min(highest, last.high + buffer)
      : Math.min(highest + buffer, entry + maxStopDist);
    const rawStop = Math.min(entry + maxStopDist, Math.max(entry + minStopDist, candidateStop));
    const stop = entry > 200 ? Math.round(rawStop * 10) / 10 : Number(rawStop.toFixed(4));
    const distance = Math.max(minStopDist, stop - entry);
    const target = entry > 200 ? Math.round((entry - distance * 2.0) * 10) / 10 : Number((entry - distance * 2.0).toFixed(4));

    return {
      title: isDaytrade
        ? `แผนคม 15m: เด้งขายแนวต้าน EMA20 ($${entry})`
        : `แผนหลัก 1H: โครงสร้างขาลง Lower High ($${entry})`,
      side: "sell",
      entry: String(entry),
      stop: String(stop),
      target: String(target),
      balance: "1000",
      riskPercent: "1",
      unitsPerLot: "100",
      timeframe,
      atr: Math.round(atr * 10) / 10,
      setupName: isDaytrade ? "Daytrade 15m Resistance Rejection" : "Structure 1H Bearish Breakdown",
      condition: isDaytrade
        ? `แผน Daytrade 15m: รอยืนยันการถูกปฏิเสธใต้แนวต้าน หากราคาปิดทะลุ $${stop} ให้ตัดขาดทุนทันที`
        : `แผน Swing 1H: ขายตามแรงกดของแท่ง 1H ใต้ EMA20 วาง SL ที่ $${stop} และเป้าหมาย 2R ที่ $${target}`,
      summary: `ตรวจพบแรงขายกดใต้ EMA20 (ATR: ±$${Math.round(atr * 10) / 10}) แนะนำเข้าขายที่ $${entry} วาง SL เหนือสวิงไฮ $${stop} และเป้าหมาย 2R คมๆ ที่ $${target}`,
    };
  }
}

export function formatPlanBrief(plan, result = {}) {
  const sideLabel = plan.side === "buy" ? "🟢 BUY (ซื้อ)" : "🔴 SELL (ขาย)";
  const rr = result.rewardRatio ? `${result.rewardRatio.toFixed(1)}R` : "2.0R";
  return [
    `📊 แผนตัวอย่างทองคำ (XAU/USD) · น้องนักออม Forex Studio`,
    `━━━━━━━━━━━━━━━━━━`,
    `📌 ชื่อแผน: ${plan.title || "แผนตัวอย่าง"}`,
    `🧭 ฝั่ง: ${sideLabel}`,
    `🎯 จุดเข้า (Entry): $${plan.entry}`,
    `🛑 จุดตัดขาดทุน (SL): $${plan.stop} (ระยะ $${result.stopDistance ?? "—"})`,
    `🏆 เป้าหมายกำไร (TP): $${plan.target} (เป้าหมาย ${rr})`,
    `💰 ความเสี่ยง: ${plan.riskPercent}% ($${result.riskAmount ?? "—"}) | ทุนสมมติ $${plan.balance}`,
    `📐 ขนาดสัญญา: ${result.theoreticalLots ? result.theoreticalLots.toFixed(4) : "—"} lot`,
    `📝 เงื่อนไข: ${plan.condition || "ทบทวนแผนเมื่อผิดทาง"}`,
    `━━━━━━━━━━━━━━━━━━`,
    `⚠️ โหมดฝึก: ข้อมูลจำลองเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน`,
  ].join("\n");
}

export function checkPlanHit(plan, bar) {
  const entry = positive(plan.entry);
  const stop = positive(plan.stop);
  const target = positive(plan.target);
  if (!entry || !stop || !target || !bar) return { entryHit: false, tpHit: false, slHit: false };
  const entryHit = bar.low <= entry && entry <= bar.high;
  const tpHit = plan.side === "buy" ? bar.high >= target : bar.low <= target;
  const slHit = plan.side === "buy" ? bar.low <= stop : bar.high >= stop;
  return { entryHit, tpHit, slHit };
}

// Strict in-sample replay over the loaded bars (not a track record):
// decision at close of bar i, fill at open of bar i+1, raised stops apply from the next bar,
// stop assumed first when a bar touches both, spread/slippage deducted. `validated` stays false.
export function replayForexBars2R(bars, symbol = "XAU/USD") {
  if (!Array.isArray(bars) || bars.length < 40) return null;
  const closes = bars.map((b) => Number(b.close));
  const isGold = String(symbol).toUpperCase().includes("XAU");
  const trades = [];
  for (let i = 30; i < bars.length - 3; i++) {
    const bar = bars[i];
    const prev = bars[i - 1];
    const fill = bars[i + 1];
    const ema20 = computeEMA(closes.slice(Math.max(0, i - 25), i + 1), 20);
    const ema20Prev = computeEMA(closes.slice(Math.max(0, i - 28), i - 1), 20);
    const ema50 = computeEMA(closes.slice(Math.max(0, i - 55), i + 1), 50);
    const atr = computeATR(bars.slice(Math.max(0, i - 30), i + 1), 14);
    if (!ema20 || !ema20Prev || !ema50 || !atr || !fill) continue;
    const range = Math.max(1e-9, bar.high - bar.low);
    const up = bar.close > ema20 && ema20 > ema50 && ema20 >= ema20Prev;
    const down = bar.close < ema20 && ema20 < ema50 && ema20 <= ema20Prev;
    let side = null;
    if (up && bar.close > bar.open && (bar.close - bar.low) / range >= 0.6 && (bar.low <= ema20 + atr * 0.45 || bar.close > prev.high)) side = "BUY";
    else if (down && bar.close < bar.open && (bar.high - bar.close) / range >= 0.6 && (bar.high >= ema20 - atr * 0.45 || bar.close < prev.low)) side = "SELL";
    if (!side) continue;
    const digits = fill.open > 200 ? 2 : 4;
    const entry = Number(fill.open.toFixed(digits));
    const swingLow = Math.min(...bars.slice(i - 5, i + 1).map((b) => b.low));
    const swingHigh = Math.max(...bars.slice(i - 5, i + 1).map((b) => b.high));
    const rawRisk = side === "BUY" ? Math.max(atr * 1.15, entry - swingLow) : Math.max(atr * 1.15, swingHigh - entry);
    const risk = isGold ? Math.max(4.0, Math.min(20.0, rawRisk)) : Math.max(atr * 0.8, Math.min(atr * 2.2, rawRisk));
    const cost = isGold ? 0.5 : entry * 0.00012; // spread + slippage in price units
    const dir = side === "BUY" ? 1 : -1;
    const stop = Number((entry - dir * risk).toFixed(digits));
    const tp1 = entry + dir * risk * 1.4;
    const target = Number((entry + dir * risk * 2.0).toFixed(digits));
    let stopNow = stop, hitTp1 = false, locked = false, exitPrice = null, stage = "TIME_EXIT", exitIdx = i + 1;
    for (let j = i + 1; j < Math.min(bars.length, i + 20); j++) {
      const fb = bars[j];
      exitIdx = j;
      const stopHit = side === "BUY" ? fb.low <= stopNow : fb.high >= stopNow;
      if (stopHit) {
        exitPrice = side === "BUY" ? Math.min(stopNow, fb.open) : Math.max(stopNow, fb.open);
        stage = hitTp1 ? "TP1_RUNNER" : locked ? "BE_LOCKED" : "SL_HIT";
        break;
      }
      if (side === "BUY" ? fb.high >= target : fb.low <= target) { exitPrice = target; stage = "FULL_TP"; break; }
      if (side === "BUY" ? fb.high >= tp1 : fb.low <= tp1) hitTp1 = true;
      if (side === "BUY" ? fb.high >= entry + risk * 0.65 : fb.low <= entry - risk * 0.65) locked = true;
      stopNow = hitTp1 ? entry + dir * risk * 1.2 : locked ? entry + dir * risk * 0.5 : stop;
    }
    if (exitPrice == null) exitPrice = bars[exitIdx].close;
    exitPrice = Number(exitPrice.toFixed(digits));
    const rMult = Number(((dir * (exitPrice - entry) - cost) / risk).toFixed(2));
    const dt = new Date((bars[exitIdx]?.time || bar.time) * 1000);
    trades.push({
      id: `BT-${trades.length + 1}`,
      time: dt.toLocaleDateString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      symbol: String(symbol).replace("/", ""),
      strategy: "Backtest 2R (จำลอง)",
      side,
      entry,
      exit: exitPrice,
      sl: stop,
      status: rMult > 0 ? "WIN" : "LOSS",
      stage,
      netR: `${rMult >= 0 ? "+" : ""}${rMult.toFixed(2)} R`,
      rValue: rMult,
      pl: "—",
      reason: stage === "FULL_TP" ? "ชนเป้า 2R" : stage === "TP1_RUNNER" ? "ผ่าน TP1 แล้วโดน trailing stop" : stage === "BE_LOCKED" ? "ล็อกทุนแล้วโดนย่อกลับ" : stage === "SL_HIT" ? "ชน Stop Loss" : "หมดเวลาถือ ปิดที่ราคาปิด",
    });
    i = exitIdx;
  }
  const wins = trades.filter((t) => t.rValue > 0).length;
  const closed = trades.length;
  const grossWin = trades.filter((t) => t.rValue > 0).reduce((s, t) => s + t.rValue, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.rValue <= 0).reduce((s, t) => s + t.rValue, 0));
  let peak = 0, eq = 0, maxDd = 0;
  for (const t of trades) { eq += t.rValue; peak = Math.max(peak, eq); maxDd = Math.max(maxDd, peak - eq); }
  const recent24 = bars.slice(-24);
  const low24 = Math.min(...recent24.map((b) => b.low));
  const high24 = Math.max(...recent24.map((b) => b.high));
  const atrNow = computeATR(bars.slice(-25), 14);
  const d = (bars.at(-1)?.close ?? 2000) > 200 ? 2 : 4;
  return {
    basis: "backtest-in-sample",
    validated: false,
    closed,
    wins,
    losses: closed - wins,
    winRate: closed ? Number(((wins / closed) * 100).toFixed(1)) : 0,
    netR: Number((grossWin - grossLoss).toFixed(2)),
    expectancyR: closed ? Number(((grossWin - grossLoss) / closed).toFixed(3)) : 0,
    profitFactor: grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : null,
    maxDrawdownR: Number(maxDd.toFixed(2)),
    recentTrades: trades.slice(-6).reverse(),
    // 24-bar range levels: descriptive key levels, not a performance claim.
    buyZone: `$${low24.toFixed(d)} - $${(low24 + atrNow * 0.45).toFixed(d)}`,
    sellZone: `$${(high24 - atrNow * 0.45).toFixed(d)} - $${high24.toFixed(d)}`,
  };
}
