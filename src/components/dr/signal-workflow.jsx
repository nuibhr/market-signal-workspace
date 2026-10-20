'use client';
import {useEffect,useMemo,useState} from 'react';
import {useMonitor} from '../monitor/monitor-provider.jsx';
import {workflowRecords,workflowSummary,pageRows} from '../../monitor/workflow.mjs';
import {recordStatus} from '../../monitor/records.mjs';
import styles from './dr-strategy.module.css';
const buckets=[['waiting','รอเข้า'],['tracking','กำลังติดตาม'],['closed','แพ้ชนะ · ปิดไม้'],['review','หมดอายุ / พักตรวจ']];
const n=value=>Number.isFinite(value)?value.toLocaleString('en-US',{maximumFractionDigits:4}):'—';
export default function SignalWorkflow({market,onSelect}) {
  const monitor=useMonitor();
  const [health,setHealth]=useState(null);
  const [bucket,setBucket]=useState('waiting'),[ledger,setLedger]=useState('all'),[page,setPage]=useState(1);
  const day=monitor?.snapshots?.[market],swing=monitor?.swingSnapshots?.[market];
  const records=useMemo(()=>workflowRecords([...(day?.forward??[]),...(day?.activeForward??[])],[...(swing?.signals??[]),...(swing?.history??[])]),[day,swing]);
  const relevant=records.filter(r=>ledger==='all'||r.ledger===ledger),summary=workflowSummary(relevant);
  const selected=pageRows(relevant.filter(r=>r.bucket===bucket),page);
  useEffect(()=>setPage(1),[market,bucket,ledger]);
  const access=Boolean(day?.signalAccess||swing);
  useEffect(()=>{
    const controller=new AbortController();
    const read=()=>fetch('/api/health',{cache:'no-store',signal:controller.signal}).then(r=>r.ok?r.json():null).then(setHealth).catch(()=>{});
    read();const timer=setInterval(read,15000);return()=>{controller.abort();clearInterval(timer);};
  },[market]);
  return <section className={styles.workflowPanel} aria-label="คิวสัญญาณและผลปิดไม้">
    <h3>รอเข้า → กำลังติดตาม → แพ้ชนะ</h3>
    <p>ไม้ที่เพิ่งเข้า Entry จะย้ายไปกำลังติดตาม ไม้ที่ปิดครบจะย้ายไปแพ้ชนะอัตโนมัติ · ใช้รหัสไม้เดิมและเหตุการณ์จากเซิร์ฟเวอร์</p>
    <p role="status">Swing worker: {health?.scanner==='running'?'มี heartbeat ล่าสุด':health?'ยังไม่มี heartbeat ล่าสุด — ยังไม่ยืนยันการสแกนอัตโนมัติ':'กำลังตรวจสถานะ'} · ตารางนี้อ่านเหตุการณ์ใหม่ทุก 15 วินาทีขณะเปิดหน้าตลาด</p>
    <div className={styles.workflowControls}><label>กลยุทธ์ <select value={ledger} onChange={e=>setLedger(e.target.value)}><option value="all">ทุกกลยุทธ์</option><option value="swing">Swing Breakout / Pullback</option><option value="daytrade">Daytrade 15m</option></select></label><button type="button" onClick={()=>monitor?.refresh()}>อัปเดตสถานะ</button></div>
    <nav className={styles.workflowTabs} aria-label="สถานะวงจรไม้">{buckets.map(([id,label])=><button type="button" key={id} aria-pressed={bucket===id} onClick={()=>setBucket(id)}>{label} ({access?relevant.filter(r=>r.bucket===id).length:'—'})</button>)}</nav>
    {!access?<p role="status">เข้าสู่ระบบสมาชิกเพื่ออ่านคิวและผลจริง <a href="/account">เปิดบัญชีสมาชิก ↗</a> · ไม่ใช้บันทึกส่วนตัวในเบราว์เซอร์แทนผลจริง</p>:<>
      <p>ในชุดประวัติที่โหลด: ปิด {summary.closed} · ชนะ {summary.wins} · แพ้ {summary.losses} · เท่าทุน {summary.flat} · Win rate {summary.winRate===null?'—':n(summary.winRate)+'%'} <small>แสดงผลของชุดข้อมูลที่โหลด ไม่ใช่สถิติทั้งหมดตลอดอายุระบบ</small></p>
      <div className={styles.tableResponsive}><table className={styles.table}><thead><tr><th>หุ้น / กลยุทธ์</th><th>สถานะ</th><th>Entry</th><th>SL</th><th>TP</th><th>ผลสุทธิ R</th><th>หลักฐาน</th></tr></thead><tbody>{selected.rows.map(r=><tr key={r.key}><td><button type="button" onClick={()=>onSelect(r.symbol)}>{r.symbol}</button><small>{r.ledger==='swing'?`Swing ${r.mode}`:'Daytrade 15m'}</small></td><td>{recordStatus[r.status]??r.status}{r.outcome&&<b>{r.outcome==='win'?'ชนะ':r.outcome==='loss'?'แพ้':'เท่าทุน'}</b>}</td><td>{n(r.entryPrice??r.plan?.entry)}</td><td>{n(r.stop??r.plan?.stop)}</td><td>{n(r.plan?.minimumTarget??r.plan?.target)}</td><td>{r.bucket==='closed'?n(r.netR):'ยังไม่นับ'}</td><td><button type="button" onClick={()=>monitor?.inspectTrade({ledger:r.ledger,market:r.market,tradeId:r.id})}>ดูไม้ / เหตุการณ์</button></td></tr>)}</tbody></table></div>
      {!selected.total&&<p>ไม่มีรายการในสถานะนี้</p>}
      <nav className={styles.workflowPagination} aria-label="หน้าคิวสัญญาณ"><button type="button" disabled={selected.page===1} onClick={()=>setPage(p=>p-1)}>ก่อนหน้า</button><span>{selected.page} / {selected.pages} · หน้าละ 7 ไม้</span><button type="button" disabled={selected.page===selected.pages} onClick={()=>setPage(p=>p+1)}>ถัดไป</button></nav>
    </>}
  </section>;
}
