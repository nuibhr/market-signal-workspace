'use client';
import {useState} from 'react';
import {Globe2, ArrowUpRight, Bookmark, Target, Shield, ListFilter} from 'lucide-react';
import {ALL_ASSETS} from '../markets/catalog.mjs';
const labels={WAITING_FOR_ENTRY:'รอจุดเข้า',OPEN:'เข้าแล้ว',TARGET:'ถึงเป้า',STOP:'ตัดขาดทุน',EXIT:'ปิดตามกติกา',REVIEW:'ตรวจข้อมูล',AMBIGUOUS:'ตรวจผล',EXPIRED:'หมดเวลารอ'};
const price=n=>Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:4}):'—';
export default function DrTracker({signals,events,onSelect}){
 const [filter,setFilter]=useState('all'),[query,setQuery]=useState('');
 const rows=signals.filter(s=>(filter==='all'||s.status===filter)&&s.symbol.toLowerCase().includes(query.toLowerCase())).slice(0,7);
 return <div className="dr-strategy-desk"><div className="dr-desk-heading"><div><span className="eyebrow">DR PICKS / STRATEGY TRACKER</span><h3>แผนที่กำลังติดตาม</h3></div><Globe2 size={24}/></div><div className="dr-tracker-tools"><div role="group" aria-label="กรองแผน DR">{[['all','ทั้งหมด'],['WAITING_FOR_ENTRY','รอจุดเข้า'],['OPEN','เข้าแล้ว']].map(([id,name])=><button key={id} onClick={()=>setFilter(id)} aria-pressed={filter===id}><ListFilter size={13}/>{name}</button>)}</div><input aria-label="ค้นหาแผน DR" value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหา DR เช่น AAPL80"/></div><div className="dr-pick-grid">{rows.map(s=>{
  const a=ALL_ASSETS.find(a=>a.id==='dr'&&a.symbol===s.symbol), p=s.plan??{};
  const event=events.find(e=>e.pickId===s.id&&Number.isFinite(e.price)), reference=s.exitPrice??event?.price??s.entryPrice, entry=s.entryPrice??p.entry;
  const span=p.tp1-p.stopLoss, position=Number.isFinite(reference)&&span>0?Math.max(0,Math.min(100,(reference-p.stopLoss)/span*100)):null;
  const ret=s.entryPrice>0&&Number.isFinite(reference)?(reference-s.entryPrice)/s.entryPrice*100:null;
  return <article className={`dr-pick ${s.status.toLowerCase()}`} key={s.id}><div className="dr-pick-head"><span className="dr-company">{s.symbol.slice(0,1)}</span><div><button onClick={()=>a&&onSelect(a)}>{s.symbol}<ArrowUpRight size={14}/></button><small>{a?.name??'Depositary Receipt'}</small></div><span className="dr-status">{labels[s.status]??s.status}</span></div><div className="dr-pick-prices"><div><small>{s.entryPrice?'ราคาเข้าอ้างอิง':'แผนรอเข้า'}</small><b>{price(entry)}</b></div><div><small>ราคาเหตุการณ์ล่าสุด</small><b>{price(reference)}</b></div><div><small>ผลจากราคาเข้า</small><b className={ret==null?'':ret>=0?'positive':'negative'}>{ret==null?'—':`${ret>=0?'+':''}${ret.toFixed(2)}%`}</b></div></div><div className="dr-price-track" aria-label="ช่วงราคาแผน">{position!==null&&<i style={{left:`${position}%`}}/>}</div><div className="dr-track-labels"><span><Shield size={12}/>SL {price(p.stopLoss)}</span><span>เข้า {price(entry)}</span><span><Target size={12}/>TP {price(p.tp1)}</span></div><div className="dr-pick-foot"><span>{p.riskReward1?`R:R 1:${p.riskReward1.toFixed(1)}`:'รอแผน'} · บาท / หน่วย</span><button onClick={()=>a&&onSelect(a)}>เปิดกราฟ<ArrowUpRight size={13}/></button></div></article>;
 })}</div>{!rows.length&&<div className="dr-empty"><Bookmark size={27}/><h4>ยังไม่มี DR ในตัวกรองนี้</h4><p>เมื่อระบบพบแผน จะเห็นจุดเข้า เป้าหมาย และสถานะที่นี่</p></div>}<small className="dr-reference-note">แสดงครั้งละ 7 แผน · ราคาเหตุการณ์ล่าสุดไม่ใช่ราคาสด · ผลอ้างอิงก่อนค่าธรรมเนียม</small></div>;
}
