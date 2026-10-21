const positive=n=>Number.isFinite(n)&&n>0;
// SET DR board lot = 1. Equities default to 100; announced exceptions remain editable.
// https://www.set.or.th/th/market/information/trading-procedure/trading-units
export const defaultDecisionLot=market=>market==='dr'?1:100;
export const DECISION_REASONS={D1_TREND_NOT_UP:'แนวโน้มรายวันยังไม่เป็นขาขึ้น',WAIT_4H_BREAKOUT_CLOSE:'รอ 4H ปิดทะลุ High 20 แท่ง',WAIT_4H_PULLBACK_CLOSE:'รอย่อหา EMA20 แล้ว 4H ปิดกลับ',RELATIVE_VOLUME_BELOW_1:'ปริมาณซื้อขายยังต่ำกว่าค่าเฉลี่ย',STRUCTURAL_STOP_EXCEEDS_8_PERCENT:'Stop ตามโครงสร้างห่างเกิน 8%',RESISTANCE_BEFORE_MINIMUM_NET_REWARD:'แนวต้านอยู่ก่อนเป้ากำไร 2R สุทธิ',CONFIRMED_SWING_REQUIRED:'ยังไม่มี Swing Low ที่ยืนยันแล้ว',D1_4H_55_BARS_REQUIRED:'ประวัติ D1/4H ยังไม่ครบ 55 แท่ง',SCAN_STALE:'ผลสแกนเกินเวลาที่กำหนด',STALE_BARS:'แท่งราคายังไม่เป็นปัจจุบัน',NOT_SCANNED_YET:'ยังไม่ถึงรอบตรวจ',HISTORY_UNAVAILABLE:'แหล่งข้อมูลยังไม่มีประวัติพร้อมใช้',COSTS_REQUIRED:'ยังไม่มีสมมติฐานต้นทุน'};
export const decisionReason=code=>DECISION_REASONS[code]||'ข้อมูลหรือเงื่อนไขยังไม่พร้อม';
export function decisionChecks(row){return [
  {label:'D1 ขาขึ้น',passed:row.trendD1==='up'},
  {label:row.mode==='breakout'?'4H ทะลุกรอบ':'4H ย่อแล้วปิดกลับ',passed:row.matched?.[row.mode]===true},
  {label:'ปริมาณ ≥ ค่าเฉลี่ย',passed:row.relativeVolume>=1},
  {label:'Stop ≤8% และมีพื้นที่ 2R สุทธิ',passed:row.plan?.signalEligible===true},
];}
function category(row){
  if(row.state==='UNAVAILABLE')return 'unavailable';
  if(row.state==='PASS'&&row.plan?.signalEligible&&row.trendD1==='up')return 'ready';
  if(row.state==='WAIT'&&row.plan?.signalEligible&&row.trendD1==='up')return 'waiting';
  return 'avoid';
}
export function buildDecisionBrief(rows,{limit=5}={}){
  const rank={ready:0,waiting:1,avoid:2,unavailable:3};
  const sorted=rows.map(row=>({...row,category:category(row),checks:decisionChecks(row)})).sort((a,b)=>rank[a.category]-rank[b.category]||b.checks.filter(c=>c.passed).length-a.checks.filter(c=>c.passed).length||(a.plan?.stopPercent??100)-(b.plan?.stopPercent??100)||a.symbol.localeCompare(b.symbol)||a.mode.localeCompare(b.mode));
  const distinct=[...new Map(sorted.map(r=>[r.symbol,null])).keys()].map(symbol=>sorted.find(r=>r.symbol===symbol));
  const counts={ready:0,waiting:0,avoid:0,unavailable:0};for(const row of distinct)counts[row.category]++;
  const items=distinct.filter(r=>['ready','waiting'].includes(r.category)).slice(0,Math.min(5,limit));
  return {basis:'swing-standard-forward-v1',counts,totalSymbols:distinct.length,limit:5,items,
    excluded:distinct.filter(r=>['avoid','unavailable'].includes(r.category)).slice(0,3).map(r=>({symbol:r.symbol,category:r.category,reason:decisionReason(r.reasons?.[0])}))};
}
export function sizeReferencePlan(plan,{capital,riskBudget,lotSize=100}={}){
  if(!plan?.signalEligible||![plan.entryBasis,plan.netRiskPerUnit,plan.minimumTarget,plan.stopLoss,capital,riskBudget,lotSize].every(positive)||!Number.isSafeInteger(lotSize)||riskBudget>capital||plan.stopLoss>=plan.entryBasis||plan.minimumTarget<=plan.entryBasis)return null;
  // Standard TP1 sells 50%; two equal lots avoid implying fractional board lots.
  const step=2*lotSize;
  const quantity=Math.floor(Math.min(capital/plan.entryBasis,riskBudget/plan.netRiskPerUnit)/step)*step;
  if(!Number.isSafeInteger(step)||!Number.isSafeInteger(quantity))return null;
  return {quantity,lotSize,step,estimatedCapital:quantity*plan.entryBasis,estimatedRisk:quantity*plan.netRiskPerUnit,
    tp1Quantity:quantity/2,runnerQuantity:quantity/2,netRewardRisk:plan.minimumNetRewardRisk??2};
}
