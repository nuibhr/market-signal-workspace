'use client';
import {useEffect,useState} from 'react';
const n=v=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:4}):'—';
const time=v=>v?new Date(v).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'ต้นทางไม่ระบุ';
export default function OwnerDataPreview({market,onSelect}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{const c=new AbortController();setData(null);setError('');fetch('/api/owner-preview?market='+market,{cache:'no-store',signal:c.signal}).then(async r=>{const v=await r.json();if(!r.ok)throw Error('อ่านข้อมูลจากแหล่งนี้ไม่ได้');return v;}).then(v=>{if(!c.signal.aborted)setData(v);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[market,revision]);
 return <section className="analysis-panel" aria-label="ข้อมูลจริงสำหรับเจ้าของ" style={{margin:'16px 0',padding:20}}>
  <header><span className="eyebrow">OWNER INTERNAL · อ่านอย่างเดียว</span><h2>ทดลองข้อมูลจริง · {market.toUpperCase()}</h2><p>ใช้ส่วนตัวในพรีวิวนี้ · ราคาอ้างอิงแท่งปิด หรือ quote ที่ระบุเวลาได้ · ยังไม่ยืนยันสิทธิ์เผยแพร่ให้ลูกค้า</p><button type="button" onClick={()=>setRevision(v=>v+1)}>โหลดข้อมูลล่าสุด</button></header>
  <div role="status">{error||(!data?'กำลังเชื่อมต่อข้อมูล…':data.rows.length?`อ่านได้ ${data.rows.filter(r=>r.status==='available').length} / ${data.rows.length} รายการ`:'ยังไม่มีแหล่งข้อมูลเจ้าของที่พร้อมใช้งาน')}</div>
  {!!data?.rows.length&&<div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>หลักทรัพย์</th><th>ราคาอ้างอิง</th><th>% เปลี่ยนแปลง</th><th>แหล่งข้อมูล</th><th>เวลาข้อมูล</th><th>รับจาก API</th><th>กราฟ D1</th></tr></thead><tbody>{data.rows.map(r=><tr key={r.symbol}><th>{r.symbol}</th><td>{n(r.price)}</td><td>{n(r.changePercent)}%</td><td>{r.source}</td><td>{time(r.dataAsOf)}</td><td>{time(r.receivedAt)}</td><td>{r.closedBars>0?<button type="button" onClick={()=>onSelect?.(r.symbol,market)}>ดูกราฟ {r.symbol}</button>:'ไม่มีแท่งปิด'}</td></tr>)}</tbody></table></div>}
 </section>;
}
