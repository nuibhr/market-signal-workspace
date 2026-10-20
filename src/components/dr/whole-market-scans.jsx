'use client';
import {useEffect,useState} from 'react';
import styles from './dr-strategy.module.css';
const number=v=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:4}):'—';
const states={PASS:'ผ่านเงื่อนไขสแกน',WAIT:'รอเงื่อนไข',REJECT:'ไม่ผ่านแผนความเสี่ยง',UNAVAILABLE:'ยังไม่มีข้อมูลใช้ประเมิน'};
export default function WholeMarketScans({initialMarket,onSelect}) {
  const [open,setOpen]=useState(false),[market,setMarket]=useState(initialMarket),[mode,setMode]=useState('all'),[query,setQuery]=useState(''),[page,setPage]=useState(1);
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();setBusy(true);setError('');setData(null);
    const params=new URLSearchParams({market,mode,q:query,page:String(page)});
    fetch(`/api/signals?${params}`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])})
      .then(async response=>{const value=await response.json();if(!response.ok)throw Error(response.status===403?'เข้าสู่ระบบสมาชิกเพื่ออ่านผลสแกนทั้งตลาด':'ยังอ่านผลสแกนไม่ได้ กรุณาลองใหม่');return value;})
      .then(value=>{if(!controller.signal.aborted)setData(value);})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return()=>controller.abort();
  },[open,market,mode,query,page,revision]);
  useEffect(()=>{if(!open)return;const timer=setInterval(()=>setRevision(v=>v+1),15000);return()=>clearInterval(timer);},[open]);
  return <details className={styles.rulesPanel} onToggle={event=>setOpen(event.currentTarget.open)}><summary>เปิดผลสแกน Swing ทั้งตลาด · หุ้นไทย 150 / DR 141</summary>
    <p>คนละชุดกับ Radar 14 ตัวด้านบน · แสดงทุกหุ้นและสถานะที่ worker ตรวจจริง · หุ้นที่ยังไม่ตรวจหรือข้อมูลไม่ครบคงแสดงสถานะรอ ไม่สร้างราคาขึ้นแทน</p>
    {open&&<><div className={styles.workflowControls}><label>ตลาด <select value={market} onChange={e=>{setMarket(e.target.value);setPage(1);}}><option value="thai">หุ้นไทย</option><option value="dr">DR</option></select></label><label>แบบ <select value={mode} onChange={e=>{setMode(e.target.value);setPage(1);}}><option value="all">Breakout + Pullback</option><option value="breakout">Breakout</option><option value="pullback">Pullback</option></select></label><label>ค้นหา <input aria-label="ค้นหาในสแกนทั้งตลาด" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label><button type="button" disabled={busy} onClick={()=>setRevision(v=>v+1)}>โหลดล่าสุด</button></div>
      {busy&&<p role="status">กำลังอ่านผลสแกน…</p>}{error&&<p role="alert">{error} <a href="/account">เปิดบัญชีสมาชิก ↗</a></p>}
      {data&&<><p>รายชื่อ {data.coverage.expected} หุ้น · ตรวจแล้ว {data.coverage.observed} · ประเมินได้ {data.coverage.available} · ยังไม่ตรวจ {data.coverage.neverChecked} · {data.totalRows} รายการกลยุทธ์ (หุ้นหนึ่งตัวมีสองแบบได้)</p>
      <div className={styles.tableResponsive}><table className={styles.table}><thead><tr><th>หุ้น / แบบ</th><th>สถานะคัดกรอง</th><th>ราคาแท่งปิด</th><th>Entry</th><th>Stop / TP1</th><th>กราฟ</th></tr></thead><tbody>{data.rows.map(r=><tr key={`${r.symbol}:${r.mode}`}><td>{r.symbol}<small>{r.mode}</small></td><td>{states[r.state]??'รอตรวจ'}<small>{r.state==='PASS'?'ดูรหัสไม้ที่ประกาศแล้วในคิวรอเข้า':'ยังไม่ยืนยัน Entry'}</small></td><td>{number(r.price)}</td><td>{number(r.plan?.entry)}</td><td>{number(r.plan?.stopLoss)} / {number(r.plan?.minimumTarget)}</td><td><button type="button" onClick={()=>onSelect({symbol:r.symbol,market})}>ดูกราฟ ↗</button></td></tr>)}</tbody></table></div>
      <nav className={styles.workflowPagination} aria-label="หน้าสแกน Swing ทั้งตลาด"><button disabled={data.page===1} onClick={()=>setPage(p=>p-1)}>ก่อนหน้า</button><span>{data.page} / {Math.max(1,Math.ceil(data.totalRows/data.pageSize))} · หน้าละ {data.pageSize}</span><button disabled={data.page*data.pageSize>=data.totalRows} onClick={()=>setPage(p=>p+1)}>ถัดไป</button></nav></>}
    </>}
  </details>;
}
