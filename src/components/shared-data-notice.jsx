'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
export default function SharedDataNotice(){
 const [mode,setMode]=useState(null);
 useEffect(()=>{const c=new AbortController();fetch('/api/data-policy',{signal:c.signal}).then(r=>r.ok?r.json():null).then(setMode).catch(()=>{});return()=>c.abort();},[]);
 if(mode?.mode!=='daily-snapshot')return null;
 return <aside role="status" style={{padding:'8px 16px',fontSize:12,background:'#142332',color:'#e2edf7',textAlign:'center'}}>ข้อมูลตลาดส่วนกลาง · สแกนวันละ 1 รอบ เวลา 07:00 น. · ใช้ผลร่วมกันตลอดวัน ไม่ใช่ราคาสด · AI ตามโควตาสมาชิก · <Link href="/shared" style={{color:'#7dd3fc'}}>ดูผลทั้ง 5 ตลาด ↗</Link></aside>;
}
