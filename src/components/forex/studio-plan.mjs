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
