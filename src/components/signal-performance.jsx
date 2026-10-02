'use client';

export default function SignalPerformance({ summary, trades = [], onSelect }) {
  const latest = [...trades].reverse();
  return <article className="panel rolling-performance" aria-label="ประวัติ 100 ไม้ล่าสุด">
    <div className="rolling-heading"><div><span className="eyebrow">บันทึกชุดเดียวกับผลงานสัญญาณ</span><h3>100 ไม้ที่ปิดล่าสุด</h3><p>นับจากราคาเข้าและราคาออกที่บันทึกไว้ ทุกไม้เปิดดูลำดับเหตุการณ์ได้ในรายการด้านล่าง</p></div><span className="rolling-sample"><b>{summary.closed}</b> / {summary.windowSize} ไม้</span></div>
    <div className="trade-tape" aria-label={`ชนะ ${summary.wins} แพ้ ${summary.losses} เสมอ ${summary.flat}`}>
      {latest.map(row => <button key={row.id} className={row.returnPercent > 0 ? 'win' : row.returnPercent < 0 ? 'loss' : 'flat'} onClick={() => onSelect(row.symbol)} aria-label={`${row.symbol} ราคาเข้า ${row.entryPrice} ราคาออก ${row.exitPrice} ผล ${row.returnPercent.toFixed(2)} เปอร์เซ็นต์ เปิดกราฟ`} title={`${row.symbol} · ${row.entryPrice} → ${row.exitPrice} · ${row.returnPercent.toFixed(2)}%`} />)}
      {Array.from({ length: Math.max(0, summary.windowSize - latest.length) }, (_, index) => <span className="unrecorded" key={`empty-${index}`} aria-hidden="true" />)}
    </div>
    <div className="trade-tape-legend"><span><i className="win"/>ชนะ {summary.wins}</span><span><i className="loss"/>แพ้ {summary.losses}</span><span><i className="flat"/>เสมอ {summary.flat}</span><small>ซ้าย: ไม้เก่า → ขวา: ไม้ใหม่ · ช่องว่างยังไม่มีผลบันทึก</small></div>
    <p className="rolling-note">{summary.closed < summary.windowSize ? `มีผลปิด ${summary.closed} ไม้ จึงเฉลี่ยจาก ${summary.closed} ไม้ที่มีจริง เมื่อครบ 100 จะเลื่อนนับไม้ใหม่อัตโนมัติ` : 'เมื่อมีไม้ใหม่ปิดผล จะเลื่อนนับ 100 ไม้ล่าสุดโดยเก็บประวัติเก่าไว้'} · ผลอ้างอิงก่อนค่าธรรมเนียมและสลิปเพจ</p>
  </article>;
}
