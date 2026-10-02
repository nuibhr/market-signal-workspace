// A transparent technical rubric, not a probability of profit.
export function customerSummary(analysis, eligible = true, cost = null) {
  if (!analysis || !eligible) return { score: null, label: 'ข้อมูลไม่พร้อม', text: 'รอแท่งราคาที่ใหม่และครบก่อนประเมิน', factors: [] };
  const a = analysis;
  const factors = [
    { label: 'แนวโน้ม', points: a.trend === 'up' ? 30 : a.trend === 'sideways' ? 15 : 0, max: 30 },
    { label: 'ยืนเหนือ EMA20', points: a.price > a.ema20 ? 25 : 0, max: 25 },
    { label: 'โมเมนตัม RSI', points: a.rsi14 >= 45 && a.rsi14 <= 65 ? 20 : a.rsi14 >= 35 && a.rsi14 < 70 ? 10 : 0, max: 20 },
    { label: 'ระยะถึงแนวต้าน', points: a.resistance > a.price * 1.02 ? 15 : a.resistance > a.price ? 5 : 0, max: 15 },
    { label: 'แนวรับอยู่ใต้ราคา', points: a.support > 0 && a.support < a.price ? 10 : 0, max: 10 },
  ];
  const score = factors.reduce((sum, f) => sum + f.points, 0);
  const label = score >= 75 ? 'น่าจับตา' : score >= 50 ? 'รอยืนยัน' : 'ระวังความเสี่ยง';
  const text = `แนวโน้ม${a.trend === 'up' ? 'ขึ้น' : a.trend === 'down' ? 'ลง' : 'แกว่ง'} · รับ ${Number.isFinite(a.support) ? a.support.toFixed(2) : '—'} / ต้าน ${Number.isFinite(a.resistance) ? a.resistance.toFixed(2) : '—'} · ${Number.isFinite(a.support) && a.price < a.support ? 'หลุดแนวรับ ตรวจแผนตัดความเสี่ยง' : Number.isFinite(a.resistance) && a.price >= a.resistance ? 'ถึงแนวต้าน ทบทวนจุดทำกำไร' : 'รอแท่งปิดยืนยัน ไม่ไล่ราคา'}`;
  return { score, label, text, factors, pnlPercent: cost > 0 ? (a.price / cost - 1) * 100 : null,
    action: Number.isFinite(a.support) && a.price < a.support || a.trend === 'down' ? 'ทบทวนจุดตัดขาดทุนที่กำหนดไว้' : Number.isFinite(a.resistance) && a.price >= a.resistance * 0.99 ? 'ใกล้แนวต้าน ทบทวนการทำกำไรตามแผน' : 'ติดตามแนวรับและแท่งปิดต่อไป' };
}
