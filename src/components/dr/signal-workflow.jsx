'use client';
import {pollAfterCompletion} from '../../monitor/poll.mjs';
import {useEffect,useState} from 'react';
import SignalResults from '../signal-results.jsx';
import styles from './dr-strategy.module.css';
export default function SignalWorkflow({market,onSelect,viewRequest,onSnapshot}) {
  const [health,setHealth]=useState(null);
  useEffect(()=>{
    const controller=new AbortController();
    const read=()=>fetch('/api/health',{cache:'no-store',signal:controller.signal}).then(r=>r.ok?r.json():null).then(setHealth).catch(()=>{});
    const stop=pollAfterCompletion(read);return()=>{controller.abort();stop();};
  },[market]);
  return <section id="section-results" className={styles.workflowPanel} aria-label="ศูนย์สัญญาณและผล 100 ไม้ล่าสุด">
    <p role="status">{health?.dataMode==='daily-snapshot'?'ข้อมูลส่วนกลางสแกนวันละครั้ง 07:00 น. ใช้ผลชุดเดียวกันตลอดวัน ไม่ใช่ราคาสด':`Swing worker: ${health?.scanner==='running'?'มี heartbeat ล่าสุด':health?'ยังไม่มี heartbeat ล่าสุด':'กำลังตรวจสถานะ'}`}</p>
    <SignalResults fixedMarket={market} onSelect={onSelect} sectionId="section-signal-ledger" initialScope="waiting" viewRequest={viewRequest} onSnapshot={onSnapshot}/>
  </section>;
}
