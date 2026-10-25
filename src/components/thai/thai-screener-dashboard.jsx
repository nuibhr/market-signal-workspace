'use client';
import {readApiJson} from '../../security/api-response.mjs';
import {useEffect,useMemo,useState} from 'react';
import {pollAfterCompletion} from '../../monitor/poll.mjs';
import {DISCOVERY_INTERVAL_MS} from '../../signals/cadence.mjs';
import {sizeReferencePlan} from '../../signals/decision-brief.mjs';
import InstrumentLogo from '../monitor/instrument-logo.jsx';
import styles from './thai-screener.module.css';
const n=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
const stageNames={1:'Stage 1 · สะสมฐาน',2:'Stage 2 · ขาขึ้น',3:'Stage 3 · เริ่มอ่อน',4:'Stage 4 · ขาลง'};
const presets=[['all','ทั้งหมด'],['stage2','🌟 Minervini Stage 2'],['breakout','⚡ Volume + MACD'],['dividend','💎 ปันผลสูง / P/E ต่ำ'],['pullback','🎯 Pullback EMA20/50'],['orb','🇹🇭 15m ORB']];
export function filterThaiRows(rows,{preset='all',query='',savedOnly=false,favorites=[],sector='all',peMax=80,rsiMin=0,rsiMax=100,sort='quality'}={}){
 const result=rows.filter(r=>(preset==='all'||!['stale','unavailable'].includes(r.status))&&(!query||`${r.symbol} ${r.name}`.toLowerCase().includes(query.toLowerCase()))&&(!savedOnly||favorites.includes(r.symbol))&&
  (sector==='all'||(sector==='unknown'?!r.sector:r.sector===sector))&&(peMax===80||Number.isFinite(r.pe)&&r.pe<=peMax)&&
  (rsiMin===0&&rsiMax===100||Number.isFinite(r.rsi)&&r.rsi>=rsiMin&&r.rsi<=rsiMax)&&
  (preset==='all'||preset==='stage2'&&r.templatePass||preset==='breakout'&&r.volumeBreakout||preset==='pullback'&&r.pullback||preset==='dividend'&&r.pe>0&&r.pe<=15&&r.dividendPercent>=3));
 const value=r=>sort==='rvol'?r.rvol:sort==='rs'?r.rs?.excessReturnPercent:sort==='change'?r.changePercent:r.score;
 return result.sort((a,b)=>sort==='symbol'?a.symbol.localeCompare(b.symbol):(Number.isFinite(value(b))?value(b):-Infinity)-(Number.isFinite(value(a))?value(a):-Infinity)||a.symbol.localeCompare(b.symbol));
}
export function ThaiScreenerTable({rows,favorites=[],selectedSymbol,onSelect,onToggleFavorite,showMetrics=true}){
 return <div className={styles.tableScroll}><table className={`${styles.table} table-zebra table-pin-rows`} data-detailed={showMetrics}><thead><tr><th>หุ้น / กลุ่ม</th><th>ราคาปิด D1 / %Chg</th><th>EMA Template</th><th>Stage</th>{showMetrics&&<><th>RSI14</th><th>P/E / Div%</th><th>RVOL / RS vs SET</th></>}<th>แผน 2R · Entry / SL / TP1</th><th>กราฟ</th></tr></thead><tbody>{rows.map(r=><tr key={r.symbol} data-selected={r.symbol===selectedSymbol}>
  <th><div className={styles.identity}><button type="button" className={styles.star} aria-label={`${favorites.includes(r.symbol)?'เลิกติดตาม':'ติดตาม'} ${r.symbol}`} aria-pressed={favorites.includes(r.symbol)} onClick={()=>onToggleFavorite?.(r.symbol,'thai')}>{favorites.includes(r.symbol)?'★':'☆'}</button><InstrumentLogo asset={{market:'thai',symbol:r.symbol}}/><span><b>{r.symbol}</b><small title={r.sectorLabel??'ยังไม่มีข้อมูลกลุ่ม'}>{r.sector??'—'} · {r.section==='SET100'?'SET100':'mai'}</small></span></div></th>
  <td><b>{n(r.price)}</b><small data-tone={r.changePercent>0?'up':r.changePercent<0?'down':'neutral'}>{r.changePercent>0?'+':''}{n(r.changePercent)}% · {r.priceDay??'รอข้อมูล'}</small><small>{r.source??'ยังไม่มีแหล่งข้อมูล'}</small></td>
  <td><details className={styles.criteria}><summary><span className={styles.badge} data-tone={r.templatePass?'up':'neutral'}>{r.score===null?'—':`${r.score}/8`}</span></summary><ul>{r.criteria.map(c=><li key={c.id} data-tone={c.passed===true?'up':c.passed===false?'down':'neutral'}>{c.passed===true?'✓':c.passed===false?'×':'—'} {c.label}</li>)}</ul>{!r.criteria.length&&<p>รอประวัติ D1 อย่างน้อย 220 วัน</p>}</details></td>
  <td><span className={styles.badge} data-tone={r.stage===2?'up':r.stage===4?'down':'neutral'}>{stageNames[r.stage]??'ประวัติไม่ครบ'}</span><small>{r.status==='stale'?'ข้อมูลเก่า':r.status==='partial'?'รอ RS / ประวัติ 52 สัปดาห์':r.status==='unavailable'?'รอตรวจข้อมูล':r.templatePass?'ผ่านคัดกรอง · ยังไม่ใช่ Entry':'แผนเฝ้า · รอเงื่อนไข'}</small></td>
  {showMetrics&&<><td>{n(r.rsi,1)}</td><td>{n(r.pe)}<small>Div {n(r.dividendPercent)}%</small></td>
  <td><b>{n(r.rvol)}×</b><small data-tone={r.rs?.outperforming?'up':'neutral'}>RS {r.rs?.excessReturnPercent>0?'+':''}{n(r.rs?.excessReturnPercent)}%</small></td></>}
  <td>{r.plan?<><b>{n(r.plan.entry)} / {n(r.plan.stopLoss)} / {n(r.plan.minimumTarget)}</b><small>{r.planFrame} · Stop {n(r.plan.stopPercent)}% · 2R สุทธิ / ขายครึ่ง</small></>:<small>ยังไม่มีแผนผ่าน Stop ≤8% / พื้นที่ 2R</small>}</td>
  <td><button type="button" className={styles.chartButton} onClick={()=>onSelect?.(r.symbol)} aria-label={`ดูกราฟ ${r.symbol}`}>ดูกราฟ ↗</button></td>
 </tr>)}</tbody></table></div>;
}
export default function ThaiScreenerDashboard({signalAccess=null,favorites=[],onToggleFavorite,onSelect,selectedSymbol,favoritesRequest=0,onOpenStyleScanner,onResults,compact=false,visible=true}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[fetchCycle,setFetchCycle]=useState(0);
 const [preset,setPreset]=useState('all'),[query,setQuery]=useState(''),[savedOnly,setSavedOnly]=useState(false),[sector,setSector]=useState('all'),[peMax,setPeMax]=useState(80),[rsiMin,setRsiMin]=useState(0),[rsiMax,setRsiMax]=useState(100),[sort,setSort]=useState('quality'),[page,setPage]=useState(1);
 const [showMetrics,setShowMetrics]=useState(!compact);
 const [capital,setCapital]=useState('20000'),[risk,setRisk]=useState('500');
 useEffect(()=>{if(favoritesRequest){setSavedOnly(true);setPreset('all');}},[favoritesRequest]);
 useEffect(()=>{
  if(signalAccess!==true){setData(null);setError('');setBusy(false);return;}
  if(!visible){setBusy(false);return;}
  setData(null);setError('');
  const controller=new AbortController();
  const stop=pollAfterCompletion(async()=>{setBusy(true);try{const r=await fetch('/api/thai-screener',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])}),value=await readApiJson(r);if(!r.ok)throw Error(value.code||value.error||'SOURCE_UNAVAILABLE');if(!controller.signal.aborted){setData(value);setFetchCycle(v=>v+1);setError('');}}catch(e){if(!controller.signal.aborted){setData(null);setError(e.message);}}finally{if(!controller.signal.aborted)setBusy(false);}},{intervalMs:DISCOVERY_INTERVAL_MS});
  return()=>{stop();controller.abort();};
 },[signalAccess,revision,visible]);
 const rows=data?.rows??[],stats=data?.stats;
 const filtered=useMemo(()=>filterThaiRows(rows,{preset,query,savedOnly,favorites,sector,peMax,rsiMin,rsiMax,sort}),[rows,preset,query,savedOnly,favorites,sector,peMax,rsiMin,rsiMax,sort]);
 useEffect(()=>setPage(1),[preset,query,savedOnly,sector,peMax,rsiMin,rsiMax,sort]);
 const pages=Math.max(1,Math.ceil(filtered.length/7)),current=Math.min(page,pages),selected=rows.find(r=>r.symbol===selectedSymbol),sizing=selected?.plan?sizeReferencePlan(selected.plan,{capital:Number(capital),riskBudget:Number(risk),lotSize:100}):null;
 const sectors=[...new Set(rows.map(r=>r.sector).filter(Boolean))].sort(),hasPe=rows.some(r=>Number.isFinite(r.pe));
 const regime=stats?.index&&stats.index.trend!=='unknown'&&stats.observed>=stats.expected*.8?(stats.index.trend==='up'&&stats.advance>stats.decline?'ตลาดเอื้อ':stats.index.trend==='down'?'ระวังขาลง':'ตลาดผสม'):'รอข้อมูลตลาด';
 const reset=()=>{setPreset('all');setQuery('');setSavedOnly(false);setSector('all');setPeMax(80);setRsiMin(0);setRsiMax(100);};
 const refreshKey=data?[...new Set([selectedSymbol,...filtered.slice((current-1)*7,current*7).map(r=>r.symbol)])].filter(Boolean).slice(0,8).join(','):'';
 useEffect(()=>{
  if(signalAccess!==true||!visible||!refreshKey)return;
  const controller=new AbortController();setBusy(true);
  fetch('/api/thai-screener',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbols:refreshKey.split(',')}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)])})
   .then(async r=>{const value=await readApiJson(r);if(!r.ok)throw Error(value.code||value.error||'SOURCE_UNAVAILABLE');if(!controller.signal.aborted){setData(value);setError('');}})
   .catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return()=>controller.abort();
 },[signalAccess,visible,refreshKey,revision,fetchCycle]);
 const topFocus=useMemo(()=>{
  const candidates=rows.filter(r=>(r.templatePass||r.stage===2)&&r.plan&&!['unavailable','stale'].includes(r.status));
  return candidates.sort((a,b)=>((b.score??0)-(a.score??0))||((b.rs?.excessReturnPercent??-999)-(a.rs?.excessReturnPercent??-999))||((b.rvol??0)-(a.rvol??0))).slice(0,3);
 },[rows]);
 const avoidedCount=useMemo(()=>{
  const weak=rows.filter(r=>r.stage===4||(r.stage===3&&!r.templatePass)).length;
  return rows.some(r=>r.stage!==null)?weak:null;
 },[rows,stats]);
 return <section id="section-auto-pick" className={`${styles.dashboard} ${compact?styles.compact:''}`} aria-label="Thai Stock Screener">
  {compact?<header className={styles.compactHeader}><div><h2>Stage 2 Superperformance Screener</h2><p>คัดกรอง Trend Template ขาขึ้น &amp; RS ผู้นำตลาดตามหลักการ Minervini</p></div><button type="button" disabled={busy||signalAccess!==true} onClick={()=>setRevision(v=>v+1)}>{busy?'กำลังโหลด…':'↻ โหลดข้อมูลล่าสุด'}</button></header>:<>  <header className={styles.header}><div><span className={styles.eyebrow}>THAI EQUITIES / SET100 + mai</span><h1>ตลาดหุ้นไทย <span>Decision Terminal</span></h1><p>คัดหุ้น · เก็บไว้เฝ้า · เปิดกราฟ · ติดตามผล ในหน้าเดียว</p></div><div className={styles.actions}><button type="button" onClick={onOpenStyleScanner}>สแกนตามสไตล์ (Multi-Strategy) ↗</button><a href="#section-radar">Strategy Radar ↓</a><a href="#chart-panel">กราฟ {selectedSymbol} ↓</a><a href="#section-results" onClick={event=>{if(onResults){event.preventDefault();onResults();}}}>Trade Ledger (100 ไม้)</a><button type="button" disabled={busy||signalAccess!==true} onClick={()=>setRevision(v=>v+1)}>{busy?'กำลังโหลด…':'↻ โหลดผลล่าสุด'}</button></div></header></>}

  <div className={`${styles.stats} stats shadow`}>
   <article className={styles.stat}><small>Market Regime · SET</small><strong>{regime}</strong><p>{stats?.index?`${n(stats.index.price)} · D1 ${stats.index.day}`:'ดัชนียังไม่พร้อม'}</p><small>ขึ้น {stats?.advance??'—'} / ลง {stats?.decline??'—'} / คงที่ {stats?.flat??'—'} · ชุดที่มีข้อมูล {stats?.observed??'—'}/{stats?.expected??'—'}</small></article>
   <article className={styles.stat}><small>Stage 2 Superperformance</small><strong>{stats?stats.stage2:'—'} <em>ตัว</em></strong><p>ผ่าน 7–8/8 และ RS &gt; SET</p><small>คะแนนคัดกรอง ไม่ใช่โอกาสชนะ</small></article>
   <article className={styles.stat}><small>Volume Surge</small><strong>{stats?stats.surge:'—'} <em>ตัว</em></strong><p>RVOL &gt; 1.5×</p><small>เทียบ 20 วันก่อนหน้า ไม่รวมวันปัจจุบัน</small></article>
   <article className={styles.stat}><small>RS Momentum Leaders · 63 วัน</small><div className={styles.leaders}>{stats?.rsLeaders?.length?stats.rsLeaders.map(r=><button key={r.symbol} type="button" onClick={()=>onSelect?.(r.symbol)}>{r.symbol}<span>+{n(r.excessReturnPercent)}%</span></button>):<p>รอข้อมูลหุ้นและ SET ที่ตรงวันกัน</p>}</div></article>
  </div>

  <aside className={styles.capitalGuard} aria-label="เกราะคุ้มครองเงินต้น">
   <div className={styles.guardIcon} aria-hidden="true">🛡️</div>
   <div className={styles.guardContent}>
    <strong>ระบบเกราะคุ้มครองเงินต้น (Capital Protection Guard)</strong>
    <p>พบหุ้น Stage 4 หรือ Stage 3 ที่ไม่ผ่าน Template จากข้อมูลที่โหลด <b>{avoidedCount??'—'} ตัว</b> (จากจักรวาลสแกน {stats?.observed??'—'} ตัวที่มีข้อมูล) เพื่อปกป้องพอร์ตของคุณจากการติดดอยเรื้อรัง โฟกัสเฉพาะหุ้นผู้นำที่มีโครงสร้างพร้อมวิ่ง</p>
   </div>
  </aside>

  {signalAccess===false||error==='MEMBERSHIP_REQUIRED'?<div role="status" className={styles.message}><b>เปิดข้อมูลคัดกรองด้วยสิทธิสมาชิก</b><p>ใช้การเข้าสู่ระบบและสิทธิสมาชิกเดิมของคุณ</p><a href="/account">เข้าสู่ระบบ / ตรวจสมาชิก ↗</a></div>:<>
   {topFocus.length>0&&<section className={styles.focusSection} aria-label="Top 3 High Conviction Stage 2 Focus Picks">
    <div className={styles.focusHeader}>
     <span className={styles.focusBadge}>⭐ Daily High Conviction</span>
     <h3>Top 3 หุ้นทรงพลัง Stage 2 (พร้อมกรอบราคา 2R)</h3>
     <p>คัดกรองหุ้นที่มีโครงสร้างแข็งแกร่งที่สุด พร้อมคำนวณจุดเข้า จุดตัดขาดทุน (≤8%) และเป้าหมาย 2R ทันที</p>
    </div>
    <div className={styles.focusGrid}>
     {topFocus.map(item=><article key={item.symbol} className={styles.focusCard} data-selected={item.symbol===selectedSymbol}>
      <div className={styles.focusCardHead}>
       <div className={styles.focusAsset}>
        <InstrumentLogo asset={{market:'thai',symbol:item.symbol}}/>
        <div>
         <strong>{item.symbol}</strong>
         <small>{item.sector??'—'} · {item.section==='SET100'?'SET100':'mai'}</small>
        </div>
       </div>
       <span className={styles.scorePill}>Score {item.score===null?'—':`${item.score}/8`}</span>
      </div>
      <div className={styles.focusLevels}>
       <div><span>จุดเข้า (Entry)</span><strong>{n(item.plan?.entry)}</strong></div>
       <div><span>Stop Loss</span><strong className={styles.stopLossText}>{n(item.plan?.stopLoss)} <small>({n(item.plan?.stopPercent)}%)</small></strong></div>
       <div><span>เป้า TP1 (2R)</span><strong className={styles.targetText}>{n(item.plan?.minimumTarget)}</strong></div>
      </div>
      <div className={styles.focusFoot}>
       <span className={styles.rsHighlight}>{item.rs?.excessReturnPercent?`RS ชนะ SET +${n(item.rs.excessReturnPercent)}%`:'Stage 2 Leader'}</span>
       <div className={styles.focusActions}>
        <button type="button" onClick={()=>onSelect?.(item.symbol)}>คำนวณไม้ ↗</button>
        <button type="button" onClick={()=>onSelect?.(item.symbol)} aria-label={`ดูกราฟ ${item.symbol}`}>ดูกราฟ ↗</button>
       </div>
      </div>
     </article>)}
    </div>
   </section>}

   <nav className={styles.presets} aria-label="รูปแบบคัดกรอง">{presets.map(([id,label])=><button key={id} type="button" aria-pressed={preset===id} onClick={()=>setPreset(id)}>{label}</button>)}</nav>
   <div className={styles.filters}><label className={styles.search}>ค้นหาหุ้น<input aria-label="ค้นหาหุ้นไทยในตาราง" value={query} placeholder="ชื่อย่อ / บริษัท เช่น PTT" onChange={e=>setQuery(e.target.value)}/></label><details className={styles.advancedFilters}><summary>ตัวกรองเพิ่ม{[sector!=='all',peMax!==80,rsiMin!==0||rsiMax!==100,sort!=='quality'].filter(Boolean).length>0?' · ใช้อยู่ '+[sector!=='all',peMax!==80,rsiMin!==0||rsiMax!==100,sort!=='quality'].filter(Boolean).length:''}</summary><div className={styles.advancedControls}><label>Sector · provider<select aria-label="กรองกลุ่มหุ้น" value={sector} onChange={e=>setSector(e.target.value)}><option value="all">ทุกกลุ่ม</option>{sectors.map(s=><option key={s}>{s}</option>)}<option value="unknown">ข้อมูลกลุ่มไม่พร้อม</option></select></label><label>P/E ≤ {peMax===80?'ทั้งหมด':peMax}<input type="range" aria-label="P/E สูงสุด" min="1" max="80" value={peMax} disabled={!hasPe} onChange={e=>setPeMax(Number(e.target.value))}/>{!hasPe&&<small>กำลังรอข้อมูล P/E</small>}</label><label>RSI {rsiMin}–{rsiMax}<div className={styles.ranges}><input type="range" aria-label="RSI ต่ำสุด" min="0" max="100" value={rsiMin} onChange={e=>setRsiMin(Math.min(Number(e.target.value),rsiMax))}/><input type="range" aria-label="RSI สูงสุด" min="0" max="100" value={rsiMax} onChange={e=>setRsiMax(Math.max(Number(e.target.value),rsiMin))}/></div></label><label>เรียงตาม<select aria-label="เรียงหุ้นไทย" value={sort} onChange={e=>setSort(e.target.value)}><option value="quality">EMA Score</option><option value="rvol">RVOL</option><option value="rs">RS vs SET</option><option value="change">% เปลี่ยนแปลง</option><option value="symbol">ชื่อย่อ</option></select></label></div></details><button type="button" aria-pressed={savedOnly} onClick={()=>setSavedOnly(v=>!v)}>★ หุ้นโปรด {favorites.length}</button><button type="button" aria-pressed={showMetrics} onClick={()=>setShowMetrics(v=>!v)}>{showMetrics?'ซ่อน RSI / P/E / RVOL':'แสดง RSI / P/E / RVOL'}</button><button type="button" onClick={reset}>ล้างตัวกรอง</button></div>
   {preset==='orb'&&<p className={styles.notice}>ORB 15m · พักสัญญาณใหม่ระหว่างวิจัย ฟีดหน่วงอย่างน้อย 15 นาที · <a href="#section-results" onClick={event=>{if(onResults){event.preventDefault();onResults();}}}>เปิดประวัติ Trade Ledger ↓</a></p>}
   {preset==='dividend'&&<p className={styles.notice}>เกณฑ์นี้ใช้ Dividend ≥3% และ P/E ≤15 จากข้อมูล provider ไม่ใช่การยืนยันสมาชิกดัชนี SETHD ข้อมูลที่ขาดจะไม่ผ่านตัวกรอง</p>}
   {error&&<p role="alert" className={styles.notice}>ยังอ่านข้อมูลไม่ได้ กรุณาลองโหลดผลล่าสุด · {error}</p>}
   {!data?<p role="status" className={styles.message}>{busy||signalAccess===null?'กำลังอ่านผลและโหลดราคาจริง…':'รอข้อมูลจากผู้ให้บริการ'}</p>:<><ThaiScreenerTable showMetrics={showMetrics} rows={filtered.slice((current-1)*7,current*7)} favorites={favorites} selectedSymbol={selectedSymbol} onSelect={onSelect} onToggleFavorite={onToggleFavorite}/>{!filtered.length&&<p role="status" className={styles.message}>{preset==='orb'?'ไม่มีสัญญาณ ORB ใหม่ในโหมดที่พักวิจัย':'ยังไม่มีหุ้นผ่านตัวกรองนี้ ลองล้างตัวกรองหรือรอข้อมูลครบ'}</p>}<footer className={styles.pagination}><span>{filtered.length}/{rows.length} ตัว · หน้าละ 7 · {data?.dataMode==='daily-snapshot'?'ผลส่วนกลางรอบรายวัน · ใช้ร่วมกันทั้งวัน':'คัดใหม่รายตัวทุก 10 นาทีตามคิว'}</span><div><button disabled={current===1} onClick={()=>setPage(current-1)}>ก่อนหน้า</button><span>{current}/{pages}</span><button disabled={current===pages} onClick={()=>setPage(current+1)}>ถัดไป</button></div></footer></>}
   
   <div className={styles.elevatedSizing} aria-label="โต๊ะคำนวณขนาดไม้ 2R Position Sizing">
    <div className={styles.sizingHead}>
     <strong>🎯 โต๊ะคำนวณขนาดไม้ 2R Position Sizing · {selectedSymbol}</strong>
     <small>{selected?.plan?`แผน ${selected.planFrame||'D1/4H'} · Stop ${n(selected.plan.stopPercent)}% (ควบคุมไม่เกิน 8%)`:'เลือกหุ้นจากตารางหรือ Top 3 ด้านบนเพื่อคำนวณไม้'}</small>
    </div>
    <div className={styles.sizingInputs}>
     <label>เงินจัดสรร (พอร์ต/งบต่อไม้)<input type="number" aria-label="เงินจัดสรรหุ้นไทย" min="1" value={capital} onChange={e=>setCapital(e.target.value)}/></label>
     <label>ยอมเสี่ยงต่อไม้ (Max Risk Budget)<input type="number" aria-label="งบเสี่ยงหุ้นไทย" min="1" value={risk} onChange={e=>setRisk(e.target.value)}/></label>
    </div>
    {sizing?.quantity?<div className={styles.sizingMetrics} aria-live="polite">
     <div className={styles.sizingMetric} data-accent="cyan"><span>จำนวนหุ้นที่ควรซื้อ</span><strong>{n(sizing.quantity,0)} หุ้น</strong><small>Board Lot 100 หุ้น</small></div>
     <div className={styles.sizingMetric}><span>เงินลงทุนที่ต้องใช้</span><strong>≈ ฿{n(sizing.estimatedCapital)}</strong><small>{Number(capital)>0?`${n((sizing.estimatedCapital/Number(capital))*100,1)}% ของงบจัดสรร`:'ตามสัดส่วน'}</small></div>
     <div className={styles.sizingMetric} data-accent="red"><span>ความเสี่ยงตามแผน (1R)</span><strong className={styles.stopLossText}>≈ ฿{n(sizing.estimatedRisk)}</strong><small>หากหลุดจุด Stop Loss</small></div>
     <div className={styles.sizingMetric} data-accent="green"><span>กำไรเป้าหมาย 2R (TP1)</span><strong className={styles.targetText}>+฿{n(sizing.estimatedRisk*2)}</strong><small>ขาย 50% แล้วยก Stop</small></div>
    </div>:<div className={styles.sizingNotice}>
     <span>{selected?.plan?'⚠️ เงินจัดสรรหรือความเสี่ยงที่กรอกยังไม่พอซื้อ 1 Lot (100 หุ้น) หรือตัวเลขไม่ถูกต้อง':'💡 คลิกเลือกหุ้นจาก Top 3 หรือในตารางด้านบนที่มีแผน 2R เพื่อให้ระบบคำนวณไม้ที่ปลอดภัยให้ทันที'}</span>
    </div>}
   </div>

   <details className={styles.riskDetails}><summary>รายละเอียดแผนควบคุมความเสี่ยงเดิม · {selectedSymbol}</summary><div className={styles.risk}><b>งบแผน {selectedSymbol}</b><span aria-live="polite">{sizing?.quantity?`${n(sizing.quantity,0)} หุ้น · ใช้เงิน ≈${n(sizing.estimatedCapital)} · เสี่ยงตามแผน ≈${n(sizing.estimatedRisk)} บาท`:selected?.plan?'งบยังไม่พอหรือข้อมูลที่กรอกไม่ถูกต้อง':'เลือกหุ้นที่มีแผน 2R เพื่อคำนวณขนาดไม้'}</span></div></details>
  </>}
  <details className={styles.method}><summary>กฎคัดกรอง เวลา และข้อจำกัดข้อมูล</summary><p>Trend Template ฉบับปรับใช้ EMA50/150/200 ตามบรีฟ ไม่ใช่สูตร SMA ต้นฉบับ · 52 สัปดาห์ใช้ 252 แท่ง · EMA200 เทียบย้อนหลัง 20 วัน · RS ใช้ผลตอบแทนสัมพัทธ์ 63 วันและต้องผ่านเอง · กลุ่มอุตสาหกรรมจัดจากข้อมูล provider ไม่ใช่รหัส Sector SET ที่รับรอง</p><p>ราคาและอินดิเคเตอร์ใช้ D1 ปิดแล้วหน่วง ≥15 นาที รายการขึ้น/ลงนับเฉพาะชุดสแกนที่ข้อมูลพร้อม ไม่ใช่ตลาด SET ทั้งหมด · P/E และ Div เป็นข้อมูลอ้างอิงของ provider ดูเวลา profile ในข้อมูล API · ซ่อนแท็บพักโหลด กลับมาดูอ่านผลใหม่ · แผนยังไม่ใช่การเข้าไม้และไม่มีคำสั่งซื้อขาย</p><p>แผน 2R ใช้โครงสร้างมาตรฐานกับต้นทุนสมมติ ถ้าแผน 4H ยังไม่พร้อมจะแสดงแผน D1 พร้อมระบุกรอบเวลา · TP1 50% ส่วนที่เหลือตาม Stop · ขนาดชุดอ้างอิง 100 หุ้น ความเสี่ยงเป็นประมาณการ Gap อาจเสียมากกว่างบ · ผลไม้จริงอยู่ในบัญชี Trade Ledger ประวัติสัญญาณ</p></details>
 </section>;
}

