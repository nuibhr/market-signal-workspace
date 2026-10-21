'use client';
import {useEffect,useState} from 'react';
import SignalResults from '../signal-results.jsx';
import styles from './dr-strategy.module.css';
export default function SignalWorkflow({market,onSelect,viewRequest,onSnapshot}) {
  const [health,setHealth]=useState(null);
  useEffect(()=>{
    const controller=new AbortController();
    const read=()=>fetch('/api/health',{cache:'no-store',signal:controller.signal}).then(r=>r.ok?r.json():null).then(setHealth).catch(()=>{});
    read();const timer=setInterval(read,15000);return()=>{controller.abort();clearInterval(timer);};
  },[market]);
  return <section id="section-results" className={styles.workflowPanel} aria-label="ศูนย์สัญญาณและผล 100 ไม้ล่าสุด">
    <p role="status">Swing worker: {health?.scanner==='running'?'มี heartbeat ล่าสุด':health?'ยังไม่มี heartbeat ล่าสุด — ยังไม่ยืนยันการสแกนอัตโนมัติ':'กำลังตรวจสถานะ'} · ตารางนี้อ่านเหตุการณ์ใหม่ทุก 15 วินาทีขณะเปิดหน้าตลาด</p>
    <SignalResults fixedMarket={market} onSelect={onSelect} sectionId="section-signal-ledger" initialScope="waiting" viewRequest={viewRequest} onSnapshot={onSnapshot}/>
  </section>;
}
