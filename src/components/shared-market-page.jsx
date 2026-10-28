'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {readApiJson} from '../security/api-response.mjs';
import {marketDataState,sourceTime} from './market-data-state.mjs';
const markets=[['thai','หุ้นไทย'],['dr','DR'],['us','หุ้นสหรัฐฯ / ETF'],['forex','Forex'],['tfex','TFEX']];
const number=value=>Number.isFinite(value)?value.toLocaleString('en-US',{maximumFractionDigits:6}):'—';
export default function SharedMarketPage(){
 const [market,setMarket]=useState('thai'),[data,setData]=useState(null),[error,setError]=useState(null),[query,setQuery]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setData(null);setError(null);
  fetch('/api/market-data/v1?market='+market,{cache:'no-store',signal:controller.signal}).then(async response=>{
   const payload=await readApiJson(response);
   if(controller.signal.aborted)return;
   if(!response.ok){setError(payload.error??{code:payload.code??'SOURCE_UNAVAILABLE'});return;}
   if(!Array.isArray(payload.records))throw Error('INVALID_RESPONSE');
   setData(payload);
  }).catch(()=>{if(!controller.signal.aborted)setError({code:'SOURCE_UNAVAILABLE'});});
  return()=>controller.abort();
 },[market,revision]);
 const rows=useMemo(()=>(data?.records??[]).filter(r=>!query||r.instrument.symbol.toLowerCase().includes(query.trim().toLowerCase())),[data,query]);
 const state=marketDataState({error,loading:!data&&!error});
 const available=data?.records.filter(r=>r.projection==='FULL'&&r.status.availability==='AVAILABLE').length??0;
 return <main className="shared-market-page">
  <nav aria-label="ทางลัด"><Link href="/markets">← เลือกตลาด</Link><Link href="/account">บัญชี / สิทธิสมาชิก</Link></nav>
  <h1>ข้อมูลตลาดตามสิทธิสมาชิก</h1>
  <p>ดูราคาอ้างอิง แหล่งข้อมูล และเวลาของแต่ละรายการ · การโหลดหน้านี้ไม่เริ่มงานสแกนใหม่</p>
  <p>เวลาอ้างอิงข้อมูลและเวลารับข้อมูลเป็นคนละส่วน การรับข้อมูลล่าสุดไม่ได้แปลว่าราคาเป็นราคาสด · สิทธิสมาชิกไม่ทดแทนสิทธิ์เผยแพร่ของแหล่งข้อมูล</p>
  <div className="shared-market-controls"><label>ตลาด<select value={market} onChange={event=>{setMarket(event.target.value);setQuery('');}}>{markets.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>ค้นหาในรายการที่ได้รับสิทธิ<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="สัญลักษณ์"/></label><button type="button" disabled={!data&&!error} onClick={()=>setRevision(v=>v+1)}>โหลดใหม่</button></div>
  {!data?<div role={error?'alert':'status'} className="shared-market-state"><strong>{state.label}</strong><p>{state.detail}</p>{state.href&&<Link href={state.href}>ตรวจสิทธิสมาชิก</Link>}</div>:<>
   <p role="status">แสดงราคาได้ {available} จาก {data.records.length} รายการในสิทธิของคุณ · ไม่มีข้อมูลจะแสดง —</p>
   {rows.length===0?<div role="status" className="shared-market-state"><strong>{query?'ไม่พบสัญลักษณ์ในรายการที่ได้รับสิทธิ':'ยังไม่มีรายการสำหรับตลาดนี้'}</strong><p>{query?'ลองค้นหาสัญลักษณ์อื่น หรือล้างคำค้น':'ตรวจตลาดอื่นหรือลองโหลดใหม่ภายหลัง'}</p>{query&&<button onClick={()=>setQuery('')}>ล้างคำค้น</button>}</div>:
   <div className="shared-market-scroll" role="region" aria-label="ตารางข้อมูลตลาด เลื่อนแนวนอนได้" tabIndex={0}><table><caption>ตลาด {markets.find(([id])=>id===market)?.[1]} · เวลาแสดงในเขต Asia/Bangkok</caption><thead><tr><th scope="col">สินทรัพย์</th><th scope="col">ราคาอ้างอิง</th><th scope="col">เปลี่ยนแปลง</th><th scope="col">สถานะ</th><th scope="col">เวลาอ้างอิง / เวลารับ</th><th scope="col">แหล่งข้อมูล</th></tr></thead><tbody>{rows.map(row=>{
    const status=marketDataState({record:row}),full=row.projection==='FULL',values=full?row.data:{};
    return <tr key={row.instrument.instrumentId}><th scope="row">{full?<Link href={`/${market}?symbol=${encodeURIComponent(row.instrument.symbol)}`}>{row.instrument.symbol}</Link>:row.instrument.symbol}</th><td>{number(values.price)}</td><td>{Number.isFinite(values.changePct)?`${number(values.changePct)}%`:'—'}</td><td><strong>{status.label}</strong><small>{status.detail}</small>{status.href&&<Link href={status.href}>ตรวจสิทธิสมาชิก</Link>}</td><td>{sourceTime(row.timestamps.dataAsOf??row.timestamps.observedAt)}<small>รับข้อมูล {sourceTime(row.timestamps.receivedAt)}</small></td><td>{row.source.providerId==='unknown'?'ยังไม่ระบุ':row.source.providerId}{row.source.fallback&&<small>แหล่งสำรอง</small>}</td></tr>;
   })}</tbody></table></div>}
  </>}
 </main>;
}
