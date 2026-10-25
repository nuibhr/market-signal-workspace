'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {readApiJson} from '../security/api-response.mjs';
const markets=[['thai','หุ้นไทย'],['dr','DR'],['us','หุ้นสหรัฐฯ / ETF'],['forex','Forex'],['tfex','TFEX']];
const n=v=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:6}):'—';
const time=v=>v?new Date(v).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
export default function SharedMarketPage(){
 const [market,setMarket]=useState('thai'),[data,setData]=useState(null),[error,setError]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(1);
 useEffect(()=>{const c=new AbortController();setData(null);setError('');fetch('/api/shared-market?market='+market,{cache:'no-store',signal:c.signal}).then(async r=>{const d=await readApiJson(r);if(!r.ok)throw Error(d.code==='MEMBERSHIP_REQUIRED'?'เข้าสู่ระบบและเปิดสิทธิสมาชิกเพื่อดูผลส่วนกลาง':d.message||'ยังอ่านข้อมูลไม่ได้');setData(d);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[market]);
 const rows=useMemo(()=>(data?.rows||[]).filter(r=>!query||`${r.symbol} ${r.name}`.toLowerCase().includes(query.toLowerCase())),[data,query]);
 const pages=Math.max(1,Math.ceil(rows.length/20));
 return <main className="shared-market-page"><nav><Link href="/markets">← เลือกตลาด</Link><Link href="/account">บัญชี / สิทธิสมาชิก</Link><Link href="/forex">เชื่อม MT5 ส่วนตัว</Link></nav><h1>ผลตลาดส่วนกลางรายวัน</h1><p>สแกนวันละรอบ เริ่ม 07:00 น. ทุกสมาชิกอ่านข้อมูลชุดเดียวกันตลอดวัน การเปิดหน้านี้ไม่เริ่มสแกนใหม่</p><p>เป็นข้อมูลอ้างอิงจากแท่งปิด ดูเวลาและแหล่งข้อมูลของแต่ละรายการ ราคาจากโบรกเกอร์ส่วนตัวอาจแตกต่างกัน · AI ใช้โควตาสมาชิกเดิม</p><label>ตลาด <select value={market} onChange={e=>{setMarket(e.target.value);setPage(1);}}>{markets.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>{' '}<label>ค้นหา <input value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="ชื่อ / สัญลักษณ์"/></label>
 {error?<p role="alert">{error} <Link href="/account">เปิดบัญชี ↗</Link></p>:!data?<p role="status">กำลังอ่านผลส่วนกลาง…</p>:<><p role="status">มีราคา {data.available}/{data.total} รายการ · ช่องที่ไม่มีข้อมูลจะแสดง —</p><div className="shared-market-scroll"><table><thead><tr><th>สินทรัพย์</th><th>ราคาปิด D1</th><th>เปลี่ยนแปลง</th><th>เวลาแท่ง / รอบที่เก็บ</th><th>แหล่งข้อมูล</th></tr></thead><tbody>{rows.slice((page-1)*20,page*20).map(r=><tr key={r.instrumentId}><th><Link href={`/${r.market}?symbol=${encodeURIComponent(r.symbol)}`}>{r.symbol}</Link><small>{r.name}</small></th><td>{n(r.price)}</td><td>{r.changePercent>0?'+':''}{n(r.changePercent)}{r.changePercent!==null?'%':''}</td><td>{time(r.priceAt)}<small>เก็บ {time(r.snapshotAt)}</small></td><td>{r.source||'ยังไม่มีแหล่งข้อมูลที่พร้อมสำหรับรายการนี้'}</td></tr>)}</tbody></table></div><footer><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>ก่อนหน้า</button> {page}/{pages} <button disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>ถัดไป</button></footer></>}
 </main>;
}
