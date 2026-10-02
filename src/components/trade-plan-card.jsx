'use client';
const number=value=>typeof value==='number'&&Number.isFinite(value)?value.toLocaleString('en-US',{maximumFractionDigits:4}):'—';
export default function TradePlanCard({plan,state,asset}) {
  return <article id="section-trade-plan" className="panel ai-trade-plan" aria-label={`ระดับราคา ${asset.symbol}`}>
    <div className="rail-kicker"><span>ระดับราคาที่จับตา · {asset.symbol}</span></div>
    <h2>โซนเข้าและเป้าหมาย</h2>
    {state==='loading'?<p aria-busy="true">กำลังประเมินระดับราคา…</p>:plan?.entryZone?<>
      <div className="trade-plan-grid"><div><small>โซนจับตา</small><strong>{number(plan.entryZone.low)} – {number(plan.entryZone.high)}</strong></div><div><small>จุดตัดขาดทุน</small><strong>{number(plan.stopLoss)}</strong></div><div><small>เป้าหมายแรก</small><strong>{number(plan.tp1)}</strong></div>{Number.isFinite(plan.tp2)&&<div><small>เป้าหมายถัดไป</small><strong>{number(plan.tp2)}</strong></div>}</div>
      <div className="trade-plan-status"><strong>{plan.tradeAllowed?'มีโซนให้จับตา':'รอจังหวะที่เหมาะสม'}</strong><span>ระดับจากกราฟ · การยืนยันเข้าให้อ่านจากสัญญาณระบบ</span></div>
    </>:<p className="trade-plan-empty">ยังไม่มีระดับราคาที่พร้อมแสดง</p>}
  </article>;
}
