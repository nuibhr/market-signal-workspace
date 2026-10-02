'use client';
import {useEffect, useState} from 'react';
const names = {thai:'หุ้นไทย', dr:'DR', us:'หุ้นสหรัฐฯ'};
export default function BacktestCard({market='all'}) {
  const [data,setData]=useState(null), [error,setError]=useState(false), [revision,setRevision]=useState(0), [copied,setCopied]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    async function load(){try{const response=await fetch(`/api/signal-backtest?market=${market}`,{cache:'no-store',signal:controller.signal});const payload=await response.json();if(!response.ok)throw Error();if(!controller.signal.aborted){setData(payload);setError(false);}}
      catch{if(!controller.signal.aborted)setError(true);}}
    setData(null); setCopied(false); load(); const timer=setInterval(load,60000);
    return()=>{controller.abort();clearInterval(timer);};
  },[market,revision]);
  const summary=data?.summary;
  async function copy(){
    const text=`Nugaom AI Pick · ผลจำลองย้อนหลัง ${data.requestedFrom}–${data.requestedTo}\nตลาด: ${market==='all'?'หุ้นไทย / DR / หุ้นสหรัฐฯ':names[market]}\nตรวจ ${summary.processed}/${summary.expected} ตัว · มีข้อมูล ${summary.withData} ตัว · ยืนยันข้อมูลครบช่วง ${summary.completeHistory} ตัว\nเข้า ${summary.entries} สัญญาณ · ปิด ${summary.closed} · ชนะ ${summary.wins} · แพ้ ${summary.losses} · เสมอ ${summary.breakeven} · ยังไม่สรุป ${summary.unresolved}\nอัตราชนะ ${summary.winRate==null?'ยังไม่มีผล':`${summary.winRate.toFixed(1)}%`} จากสัญญาณที่ปิดและตรวจผลได้${data.coverageComplete?'':' · ข้อมูลยังไม่ครบทั้งตลาด/ทั้งช่วง'}\n${data.note}`;
    try{await navigator.clipboard.writeText(text);setCopied(true);}catch{setCopied(false);}
  }
  return <article className="panel historical-performance">
    <div className="history-heading"><div><div className="eyebrow">ย้อนทดสอบทั้งตลาด</div><h2>ผลจำลองย้อนหลัง 3 เดือน</h2><p>รวมทุกหุ้นในหมวดที่เลือก · ระบบทยอยประเมินให้อัตโนมัติ</p></div><button className="results-refresh" onClick={()=>setRevision(value=>value+1)}>อัปเดตผล ↻</button></div>
    {error&&<p role="status">ยังอ่านผลย้อนหลังไม่ได้ กรุณาลองใหม่</p>}
    {!data&&!error&&<p role="status">กำลังอ่านสรุปย้อนหลัง…</p>}
    {summary&&<>
      <div className="historical-period">{data.requestedFrom} – {data.requestedTo} <span className="result-pill pending">{data.coverageComplete?'ครบช่วงทั้งหมวด':'ผลบางส่วน · ยังไม่ยืนยันครบ 3 เดือน'}</span></div>
      <div className="stats-grid">
        <div className="stat-card"><span className="stat-label">เข้าเงื่อนไข</span><strong className="stat-value">{summary.entries}</strong><span className="stat-note">สัญญาณเข้า · อาจเป็นหุ้นเดิมคนละวัน</span></div>
        <div className="stat-card"><span className="stat-label">ชนะ / แพ้</span><strong className="stat-value">{summary.wins} / {summary.losses}</strong><span className="stat-note">เสมอ {summary.breakeven} · ปิดผล {summary.closed}</span></div>
        <div className="stat-card"><span className="stat-label">อัตราชนะย้อนหลัง</span><strong className="stat-value accent">{summary.winRate==null?'—':`${summary.winRate.toFixed(1)}%`}</strong><span className="stat-note">ชนะ ÷ สัญญาณที่ปิดและตรวจผลได้</span></div>
        <div className="stat-card"><span className="stat-label">ยังไม่สรุปผล</span><strong className="stat-value">{summary.unresolved}</strong><span className="stat-note">ยังติดตาม / ข้อมูลไม่พอ</span></div>
      </div>
      <div className="table-wrap"><table><thead><tr><th>ตลาด</th><th>ตรวจ / ทั้งหมด</th><th>มีข้อมูล</th><th>เข้า</th><th>ชนะ</th><th>แพ้</th><th>อัตราชนะ</th></tr></thead><tbody>{data.markets.map(row=><tr key={row.market}><td>{names[row.market]}</td><td>{row.processed} / {row.expected}</td><td>{row.withData}</td><td>{row.entries}</td><td className="positive">{row.wins}</td><td className="negative">{row.losses}</td><td>{row.winRate==null?'—':`${row.winRate.toFixed(1)}%`}</td></tr>)}</tbody></table></div>
      <div className="results-footer"><span>ข้อมูลครบช่วงที่ยืนยันได้ {summary.completeHistory}/{summary.expected} ตัว · {data.note}</span><button disabled={!summary.closed} onClick={copy}>{copied?'คัดลอกแล้ว ✓':'คัดลอกสรุปไปแชร์'}</button></div>
    </>}
  </article>;
}
