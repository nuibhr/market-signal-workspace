'use client';

const number = (value, digits = 5) => typeof value === 'number' && Number.isFinite(value)
  ? value.toLocaleString('en-US', { maximumFractionDigits: digits }) : '—';
const names = { TREND_PULLBACK: 'Trend Pullback', BREAKOUT_RETEST: 'Breakout + Retest', REVERSAL: 'Reversal' };

export default function TradePlanCard({ plan, state, asset }) {
  const ready = Boolean(plan?.entryZone);
  const loading = state === 'loading';
  return <article id="section-trade-plan" className="panel ai-trade-plan" aria-label={`แผนเทคนิค ${asset.symbol}`}>
    <div className="rail-kicker"><span>TECHNICAL PLAN / {asset.symbol}</span><span className={`rail-mode ${plan?.tradeAllowed ? 'positive' : ''}`}>{loading ? 'LOADING' : plan?.classification ?? 'WAIT'}</span></div>
    <h2>แผนเทคนิค 3 กรอบเวลา</h2>
    <p className="trade-plan-summary">D1 ดูแนวโน้ม · 4H หาโซน · 1H รอจังหวะ ตัวเลขทั้งหมดคำนวณจากแท่งที่ปิดแล้ว</p>
    {loading ? <p className="trade-plan-empty" aria-busy="true">กำลังอ่านแท่ง 4H และ 1H…</p>
      : !plan ? <p className="trade-plan-empty">{asset.feed === 'settrade-daily' ? state === 'unavailable' ? 'แท่ง D1, 4H หรือ 1H ยังไม่พร้อม จึงยังไม่สร้างแผน' : 'เลือกกราฟ 1D เพื่อประเมินแผน 3 กรอบเวลา' : 'ตลาดนี้ยังไม่มีแท่ง D1, 4H และ 1H ครบสำหรับสร้างแผน'}</p>
        : <>
          <div className="trade-plan-bias"><span>BIAS <b className={plan.bias === 'BULLISH' ? 'positive' : plan.bias === 'BEARISH' ? 'negative' : ''}>{plan.bias ?? '—'}</b></span><span>SETUP <b>{names[plan.setupType] ?? 'ยังไม่พบ'}</b></span></div>
          {ready && <><div className="trade-plan-grid">
            <div><small>Entry Zone</small><strong>{number(plan.entryZone.low)} – {number(plan.entryZone.high)}</strong></div>
            <div><small>Trigger · 1H close</small><strong>{plan.trigger?.operator} {number(plan.trigger?.price)}</strong></div>
            <div><small>Stop · โครงสร้าง</small><strong>{number(plan.stopLoss)} <em>{number(plan.stopDistanceATR, 2)} ATR</em></strong></div>
            <div><small>TP1 · โซนถัดไป</small><strong>{number(plan.tp1)}</strong>{plan.tp1Zone && <em>ความแข็งแรง {plan.tp1Zone.score}/100 · {plan.tp1Zone.sources.slice(0, 2).join(', ')}</em>}</div>
            <div><small>TP2 · โซนถัดไป</small><strong>{number(plan.tp2)}</strong></div>
            <div><small>R:R ถึง TP1</small><strong>{number(plan.riskReward1, 2)} : 1</strong></div>
          </div><div className="trade-plan-score"><span>Technical Score <b>{plan.signalScore}/100</b></span><div><i style={{ width: `${plan.signalScore}%` }} /></div></div></>}
          <div className={`trade-plan-status ${plan.tradeAllowed ? 'ready' : 'wait'}`}><strong>{plan.status}</strong><span>{plan.tradeAllowed ? 'มีแผนเฝ้ารอ Entry · ยังไม่ได้เปิดสถานะ' : 'ยังไม่ผ่านเงื่อนไขสร้างแผนเทรด'}</span></div>
          {plan.reasons?.length > 0 && <div className="trade-plan-reasons"><strong>WHY THIS PLAN?</strong>{plan.reasons.map((reason, index) => <p key={index}>✓ {reason}</p>)}</div>}
          {plan.blockers?.length > 0 && <div className="trade-plan-blockers"><strong>เหตุผลที่ยัง WAIT</strong>{plan.blockers.map((reason, index) => <p key={index}>• {reason}</p>)}</div>}
          <small className="trade-plan-reference">อ้างอิง D1 {plan.referenceCandles.dailyTimestamp ?? '—'} · 4H {plan.referenceCandles.fourHourTimestamp ? new Date(plan.referenceCandles.fourHourTimestamp * 1000).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '—'} · 1H {plan.referenceCandles.oneHourTimestamp ? new Date(plan.referenceCandles.oneHourTimestamp * 1000).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '—'}</small>
        </>}
    <p className="analysis-disclosure">แผนหน้านี้เป็นการประเมินจากแท่งที่ปิดแล้ว · AutoPick ติดตามเฉพาะหุ้นไทยนำร่องที่ผ่านกติกา · หุ้นไทยปรับราคาตาม tick SET แล้ว แต่ยังไม่รวมต้นทุนซื้อขาย · ไม่ส่งคำสั่งซื้อขาย</p>
  </article>;
}
