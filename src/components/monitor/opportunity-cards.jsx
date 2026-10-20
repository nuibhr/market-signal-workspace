import InstrumentLogo from './instrument-logo.jsx';
import styles from '../daytrade/daytrade.module.css';
const n=v=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:6}):'—';
export default function OpportunityCards({rows=[],selected,onSelect,loading=false,locked=false,unavailable=false}) {
  if(!rows.length)return <div className={styles.opportunityEmpty} role="status"><span className={styles.emptyMark}>◎</span><div><h3>{locked?'เข้าสู่ระบบสมาชิกเพื่อดูผลสแกน':loading?'กำลังจัดอันดับผลสแกน…':unavailable?'รอข้อมูลที่พร้อมประเมิน':'ยังไม่มีสินทรัพย์ผ่านเกณฑ์ในรอบนี้'}</h3><p>{locked?'ตรวจสิทธิสมาชิกได้ที่หน้าบัญชี':loading?'อ่านแท่งราคาและกติกาสแกนล่าสุด':unavailable?'ตรวจสถานะฟีดได้ในตารางติดตามราคาด้านล่าง':'จะแสดงเฉพาะตัวที่ผ่านกติกาและข้อมูลยังสด สูงสุด 5 ตัว'}</p></div></div>;
  return <div className={styles.opportunities}>{rows.map((r,index)=><article key={r.symbol} className={styles.opportunity} data-selected={selected?.symbol===r.symbol&&selected?.market===r.market}>
    <button className={styles.pickButton} onClick={()=>onSelect(r)} aria-label={`เปิดกราฟ ${r.symbol} คะแนน ${r.ranking.score} จาก 100`} aria-pressed={selected?.symbol===r.symbol&&selected?.market===r.market}>
      <div className={styles.pickIdentity}><InstrumentLogo asset={r}/><div><strong>{r.symbol}</strong><small title={r.name}>{r.name}</small></div><span className={styles.rank}>#{index+1}</span></div>
      <div className={styles.pickScore}><span className={r.side==='SHORT'?styles.negative:styles.positive}>{r.side==='SHORT'?'↘ SHORT':'↗ LONG'}</span><strong>{r.ranking.score}<small>/100</small></strong></div>
      <div className={styles.scoreTrack}><span style={{width:`${r.ranking.score}%`}}/></div>
      <div className={styles.pickPrice}><strong>{n(r.price)}</strong><small>{r.priceKind} · {r.quality}</small></div>
      <small className={styles.pickCondition}>{r.condition}</small>
      <span className={styles.pickLink}>ดูกราฟและแผน ↗</span>
    </button>
    <details className={styles.scoreDetails}><summary>ที่มาคะแนน</summary>{r.ranking.factors.map(f=><div key={f.label}><span>{f.label}</span><b>{f.points}/{f.max}</b></div>)}<small>คำนวณจากแท่งปิด 15m · คะแนนคุณภาพเทคนิค ไม่ใช่โอกาสชนะ</small></details>
  </article>)}</div>;
}
