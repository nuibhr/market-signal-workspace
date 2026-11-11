'use client';
import {readApiJson} from '../../security/api-response.mjs';
import {useEffect,useMemo,useRef,useState} from 'react';
import {pollAfterCompletion} from '../../monitor/poll.mjs';
import {DISCOVERY_INTERVAL_MS} from '../../signals/cadence.mjs';
import {sizeReferencePlan} from '../../signals/decision-brief.mjs';
import {
  createSignalSpeaker,
  buildStockSupportResistanceSpeech,
  buildMorningBriefSpeech,
  buildEveningHomeworkSpeech,
} from '../../auto-pick/speech.mjs';
import {soundPreference,SOUND_PREFERENCE_KEY} from '../../monitor/preferences.mjs';
import InstrumentLogo from '../monitor/instrument-logo.jsx';
import styles from './thai-screener.module.css';

const n=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
const stageNames={1:'Stage 1 · สะสมฐาน',2:'Stage 2 · ขาขึ้น',3:'Stage 3 · เริ่มอ่อน',4:'Stage 4 · ขาลง'};

const presets = [
  ['all', '✨ หุ้นทั้งหมด (SET100)'],
  ['breakout', '🔥 หุ้นซิ่งจ่อเบรกไฮ (Breakout)'],
  ['stage2', '🚀 หุ้นต้นน้ำรอบใหญ่ (Stage 2)'],
  ['dividend', '💎 หุ้นปลอดภัย ปันผลแกร่ง (3%+)'],
  ['pullback', '🎯 ย่อรับแนวรับ (Pullback EMA)'],
  ['orb', '🇹🇭 เดย์เทรด 15m ORB'],
];

const PRESET_TIPS = {
  all: 'แสดงภาพรวมหุ้นทั้งหมดในจักรวาล SET100 + mai พร้อมคะแนน Trend Template และแผน 2R มาตรฐาน',
  breakout: '🔥 สำหรับสายเก็งกำไร 1–3 วัน: คัดหุ้นวอลุ่มเข้าผิดปกติ (RVOL > 1.5×) กราฟสะสมจ่อทะลุแนวต้าน',
  stage2: '🚀 สำหรับสายถือรันเทรนด์ 2–4 สัปดาห์: คัดหุ้นโครงสร้างขาขึ้นเต็มตัว ยืนเหนือ EMA ทุกเส้น และแข็งแกร่งกว่าดัชนี SET',
  dividend: '💎 สำหรับพนักงานประจำ / สายนอนหลับสบาย: คัดหุ้น SET100 พื้นฐานแกร่ง P/E ต่ำ ปันผลสม่ำเสมอ ≥3% ความเสี่ยงต่ำ',
  pullback: '🎯 สำหรับสายรอจังหวะได้เปรียบ: หุ้นขาขึ้นที่ย่อตัวลงมาแตะแนวรับ EMA20 หรือ EMA50 จุด Stop Loss แคบ',
  orb: '🇹🇭 สำหรับสายเดย์เทรด: สแกนแท่งเทียน 30 นาทีแรกของการเปิดตลาดเพื่อเก็งกำไรในวัน',
};

export function getDoctorAnalysis(row) {
  if (!row) return null;
  const p = row.price;
  const hasPlan = Boolean(row.plan);
  const support = hasPlan ? row.plan.entry : p ? Number((p * 0.975).toFixed(2)) : null;
  const stop = hasPlan ? row.plan.stopLoss : p ? Number((p * 0.94).toFixed(2)) : null;
  const stopPct = hasPlan ? row.plan.stopPercent : 6.0;
  const target1 = hasPlan ? row.plan.minimumTarget : p ? Number((p * 1.08).toFixed(2)) : null;
  const target1Pct = hasPlan ? Number((row.plan.stopPercent * 2).toFixed(1)) : 8.0;
  const target2 = hasPlan ? Number((row.plan.entry + (row.plan.entry - row.plan.stopLoss) * 2.5).toFixed(2)) : p ? Number((p * 1.15).toFixed(2)) : null;
  const target2Pct = hasPlan ? Number((row.plan.stopPercent * 3).toFixed(1)) : 15.0;

  let tone = 'neutral', title = '⚪ กำลังประมวลผลข้อมูลทางเทคนิค', advice = 'วางแผนตามกรอบความเสี่ยงมาตรฐาน และกำหนดจุด Stop Loss เสมอ';
  if (row.stage === 2 && row.templatePass) {
    tone = 'green';
    title = '🟢 หุ้นผู้นำขาขึ้นแข็งแกร่ง (Stage 2 Leader)';
    advice = 'โครงสร้างราคาสวย ยืนเหนือเส้นค่าเฉลี่ยทุกเส้น และชนะดัชนี SET พร้อมวิ่งตามกรอบ 2R แนะนำรอจังหวะย่อในโซนรับปลอดภัย ไม่ควรไล่ราคา';
  } else if (row.stage === 2) {
    tone = 'green';
    title = '🟢 หุ้นฟื้นตัวขาขึ้น (Stage 2 Rebound)';
    advice = 'ราคาเริ่มยก Low และกำลังฟื้นตัวทดสอบแนวต้าน ให้เกียรติจุด Stop Loss อย่างเคร่งครัด';
  } else if (row.stage === 1) {
    tone = 'yellow';
    title = '🟡 หุ้นสะสมพลังกรอบล่าง (Stage 1 Accumulation)';
    advice = 'ราคากำลังสร้างฐานในกรอบ ยังไม่มีสัญญาณเบรกเอาท์ แนะนำเฝ้าดู รอแท่งคอนเฟิร์มก่อนใส่ไม้ใหญ่';
  } else if (row.stage === 3) {
    tone = 'orange';
    title = '🟠 ระวังแรงขายตึงตัว (Stage 3 Distribution)';
    advice = 'ราคาเริ่มตึงตัว มีการกระจายของขาย ไม่แนะนำให้ไล่ราคาโซนนี้ เสี่ยงติดดอยระยะสั้น';
  } else if (row.stage === 4) {
    tone = 'red';
    title = '🔴 เตือนภัย! ทรงแนวโน้มขาลง (Stage 4 Downtrend)';
    advice = 'ห้ามถัวเฉลี่ยเด็ดขาด! ราคาอยู่ใต้เส้นค่าเฉลี่ยทุกเส้น เสี่ยงขาดทุนสะสม ควรรอให้เกิดโครงสร้างกลับตัวก่อน';
  }

  return { support, stop, stopPct, target1, target1Pct, target2, target2Pct, tone, title, advice };
}

export function filterThaiRows(rows,{preset='all',query='',savedOnly=false,favorites=[],sector='all',peMax=80,rsiMin=0,rsiMax=100,sort='quality'}={}){
 const result=rows.filter(r=>(preset==='all'||!['stale','unavailable'].includes(r.status))&&(!query||`${r.symbol} ${r.name}`.toLowerCase().includes(query.toLowerCase()))&&(!savedOnly||favorites.includes(r.symbol))&&
  (sector==='all'||(sector==='unknown'?!r.sector:r.sector===sector))&&(peMax===80||Number.isFinite(r.pe)&&r.pe<=peMax)&&
  (rsiMin===0&&rsiMax===100||Number.isFinite(r.rsi)&&r.rsi>=rsiMin&&r.rsi<=rsiMax)&&
  (preset==='all'||preset==='stage2'&&r.templatePass||preset==='breakout'&&r.volumeBreakout||preset==='pullback'&&r.pullback||preset==='dividend'&&r.pe>0&&r.pe<=15&&r.dividendPercent>=3));
 const value=r=>sort==='rvol'?r.rvol:sort==='rs'?r.rs?.excessReturnPercent:sort==='change'?r.changePercent:r.score;
 return result.sort((a,b)=>sort==='symbol'?a.symbol.localeCompare(b.symbol):(Number.isFinite(value(b))?value(b):-Infinity)-(Number.isFinite(value(a))?value(a):-Infinity)||a.symbol.localeCompare(b.symbol));
}

export function ThaiScreenerTable({rows,favorites=[],selectedSymbol,onSelect,onToggleFavorite,onSpeakRow,showMetrics=true}){
 return <div className={styles.tableScroll}><table className={`${styles.table} table-zebra table-pin-rows`} data-detailed={showMetrics}><thead><tr><th>หุ้น / กลุ่ม</th><th>ราคาปิด D1 / %Chg</th><th>EMA Template</th><th>Stage</th>{showMetrics&&<><th>RSI14</th><th>P/E / Div%</th><th>RVOL / RS vs SET</th></>}<th>แผน 2R · Entry / SL / TP1</th><th>กราฟ</th></tr></thead><tbody>{rows.map(r=><tr key={r.symbol} data-selected={r.symbol===selectedSymbol}>
  <th><div className={styles.identity}><button type="button" className={styles.star} aria-label={`${favorites.includes(r.symbol)?'เลิกติดตาม':'ติดตาม'} ${r.symbol}`} aria-pressed={favorites.includes(r.symbol)} onClick={()=>onToggleFavorite?.(r.symbol,'thai')}>{favorites.includes(r.symbol)?'★':'☆'}</button><InstrumentLogo asset={{market:'thai',symbol:r.symbol}}/><span><b>{r.symbol}</b><small title={r.sectorLabel??'ยังไม่มีข้อมูลกลุ่ม'}>{r.sector??'—'} · {r.section==='SET100'?'SET100':r.section==='MAI_INITIAL'?'mai':'—'}</small></span></div></th>
  <td><b>{n(r.price)}</b><small data-tone={r.changePercent>0?'up':r.changePercent<0?'down':'neutral'}>{r.changePercent>0?'+':''}{n(r.changePercent)}% · {r.priceDay??'รอข้อมูล'}</small><small>{r.source??'ยังไม่มีแหล่งข้อมูล'}</small></td>
  <td><details className={styles.criteria}><summary><span className={styles.badge} data-tone={r.templatePass?'up':'neutral'}>{r.score===null?'—':`${r.score}/8`}</span></summary><ul>{r.criteria.map(c=><li key={c.id} data-tone={c.passed===true?'up':c.passed===false?'down':'neutral'}>{c.passed===true?'✓':c.passed===false?'×':'—'} {c.label}</li>)}</ul>{!r.criteria.length&&<p>รอประวัติ D1 อย่างน้อย 220 วัน</p>}</details></td>
  <td><span className={styles.badge} data-tone={r.stage===2?'up':r.stage===4?'down':'neutral'}>{stageNames[r.stage]??'ประวัติไม่ครบ'}</span><small>{r.status==='stale'?'ข้อมูลเก่า':r.status==='partial'?'รอ RS / ประวัติ 52 สัปดาห์':r.status==='unavailable'?'รอตรวจข้อมูล':r.templatePass?'ผ่านคัดกรอง · ยังไม่ใช่ Entry':'แผนเฝ้า · รอเงื่อนไข'}</small></td>
  {showMetrics&&<><td>{n(r.rsi,1)}</td><td>{n(r.pe)}<small>Div {n(r.dividendPercent)}%</small></td>
  <td><b>{n(r.rvol)}×</b><small data-tone={r.rs?.outperforming?'up':'neutral'}>RS {r.rs?.excessReturnPercent>0?'+':''}{n(r.rs?.excessReturnPercent)}%</small></td></>}
  <td>{r.plan?<><b>{n(r.plan.entry)} / {n(r.plan.stopLoss)} / {n(r.plan.minimumTarget)}</b><small>{r.planFrame} · Stop {n(r.plan.stopPercent)}% · 2R สุทธิ / ขายครึ่ง</small></>:<small>ยังไม่มีแผนผ่าน Stop ≤8% / พื้นที่ 2R</small>}</td>
  <td><div style={{display:'flex',gap:'6px',alignItems:'center'}}><button type="button" className={styles.chartButton} onClick={()=>onSelect?.(r.symbol)} aria-label={`ดูกราฟ ${r.symbol}`}>ดูกราฟ ↗</button>{onSpeakRow&&r.plan&&<button type="button" className={styles.chartButton} onClick={()=>onSpeakRow(r)} aria-label={`ฟังแผนแนวรับแนวต้าน ${r.symbol}`} title={`ฟังเสียงแนวรับ-แนวต้าน ${r.symbol}`}>🔊</button>}</div></td>
 </tr>)}</tbody></table></div>;
}

export default function ThaiScreenerDashboard({apiUrl='/api/thai-screener',ownerPreview=false,signalAccess=null,favorites=[],onToggleFavorite,onSelect,selectedSymbol,favoritesRequest=0,onOpenStyleScanner,onResults,compact=false,visible=true}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[fetchCycle,setFetchCycle]=useState(0);
 const [preset,setPreset]=useState('all'),[query,setQuery]=useState(''),[savedOnly,setSavedOnly]=useState(false),[sector,setSector]=useState('all'),[peMax,setPeMax]=useState(80),[rsiMin,setRsiMin]=useState(0),[rsiMax,setRsiMax]=useState(100),[sort,setSort]=useState('quality'),[page,setPage]=useState(1);
 const [showMetrics,setShowMetrics]=useState(!compact);
 const [capital,setCapital]=useState('20000'),[risk,setRisk]=useState('500');

 /* ─── Instant Stock Doctor State ─── */
 const [doctorInput,setDoctorInput]=useState('');
 const [doctorResult,setDoctorResult]=useState(null);
 const [doctorUsed,setDoctorUsed]=useState(0);
 const [quotaExceeded,setQuotaExceeded]=useState(false);

 /* ─── Thai Retail Trader 3 Core Questions & Voice Briefing State ─── */
 const [retailTab,setRetailTab]=useState(()=>{
  const bkkHour=(new Date().getUTCHours()+7)%24;
  return bkkHour>=16||bkkHour<6?'evening':'morning';
 });
 const [voiceEnabled,setVoiceEnabled]=useState(true);
 const [speechState,setSpeechState]=useState('idle');
 const [lastSpokenText,setLastSpokenText]=useState('');
 const speakerRef=useRef(null);
 const autoAnnouncedRef=useRef(false);
 const pendingAutoTextRef=useRef('');

 useEffect(()=>{
  if(typeof window==='undefined')return undefined;
  let storage;try{storage=window.localStorage;}catch(_e){}
  const pref=soundPreference(storage);
  setVoiceEnabled(pref);
  speakerRef.current=createSignalSpeaker(window,state=>{
   setSpeechState(state);
  });
  const onStorage=e=>{
   if(e.key===SOUND_PREFERENCE_KEY){
    const next=soundPreference(storage);
    setVoiceEnabled(next);
    if(!next)speakerRef.current?.stop();
   }
  };
  const onFirstInteraction=()=>{
   speakerRef.current?.unlock?.();
   if(pendingAutoTextRef.current&&voiceEnabled){
    const txt=pendingAutoTextRef.current;
    pendingAutoTextRef.current='';
    speakerRef.current?.play(txt);
   }
  };
  window.addEventListener('storage',onStorage);
  document.addEventListener('pointerdown',onFirstInteraction,{once:true,passive:true});
  return()=>{
   window.removeEventListener('storage',onStorage);
   document.removeEventListener('pointerdown',onFirstInteraction);
   speakerRef.current?.stop();
  };
 },[]);

 function speakText(text){
  if(!text||!speakerRef.current)return;
  setLastSpokenText(text);
  speakerRef.current.unlock?.();
  speakerRef.current.play(text);
 }

 useEffect(()=>{
  if(typeof window!=='undefined'){
   try{
    const today=new Date().toISOString().slice(0,10);
    const stored=Number(localStorage.getItem(`doctor_quota_${today}`)||0);
    setDoctorUsed(stored);
   }catch(_e){}
  }
 },[]);

 useEffect(()=>{if(favoritesRequest){setSavedOnly(true);setPreset('all');}},[favoritesRequest]);
 useEffect(()=>{
  if(signalAccess!==true){setData(null);setError('');setBusy(false);return;}
  if(!visible){setBusy(false);return;}
  setData(null);setError('');
  const controller=new AbortController();
  const stop=pollAfterCompletion(async()=>{setBusy(true);try{const r=await fetch(apiUrl,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])}),value=await readApiJson(r);if(!r.ok)throw Error(value.code||value.error||'SOURCE_UNAVAILABLE');if(!controller.signal.aborted){setData(value);setFetchCycle(v=>v+1);setError('');}}catch(e){if(!controller.signal.aborted){setData(null);setError(e.message);}}finally{if(!controller.signal.aborted)setBusy(false);}},{intervalMs:DISCOVERY_INTERVAL_MS});
  return()=>{stop();controller.abort();};
 },[signalAccess,revision,visible,apiUrl]);

 const rows=data?.rows??[],stats=data?.stats;
 const filtered=useMemo(()=>filterThaiRows(rows,{preset,query,savedOnly,favorites,sector,peMax,rsiMin,rsiMax,sort}),[rows,preset,query,savedOnly,favorites,sector,peMax,rsiMin,rsiMax,sort]);
 useEffect(()=>setPage(1),[preset,query,savedOnly,sector,peMax,rsiMin,rsiMax,sort]);
 const pages=Math.max(1,Math.ceil(filtered.length/7)),current=Math.min(page,pages),selected=rows.find(r=>r.symbol===selectedSymbol),sizing=selected?.plan?sizeReferencePlan(selected.plan,{capital:Number(capital),riskBudget:Number(risk),lotSize:100}):null;
 const sectors=[...new Set(rows.map(r=>r.sector).filter(Boolean))].sort(),hasPe=rows.some(r=>Number.isFinite(r.pe));
 const regime=stats?.index&&stats.index.trend!=='unknown'&&stats.observed>=stats.expected*.8?(stats.index.trend==='up'&&stats.advance>stats.decline?'ตลาดเอื้อ':stats.index.trend==='down'?'ระวังขาลง':'ตลาดผสม'):'รอข้อมูลตลาด';
 const reset=()=>{setPreset('all');setQuery('');setSavedOnly(false);setSector('all');setPeMax(80);setRsiMin(0);setRsiMax(100);};
 const refreshKey=data?[...new Set([selectedSymbol,...filtered.slice((current-1)*7,current*7).map(r=>r.symbol)])].filter(Boolean).slice(0,8).join(','):'';

 useEffect(()=>{
  if(ownerPreview||signalAccess!==true||!visible||!refreshKey)return;
  const controller=new AbortController();setBusy(true);
  fetch('/api/thai-screener',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbols:refreshKey.split(',')}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)])})
   .then(async r=>{const value=await readApiJson(r);if(!r.ok)throw Error(value.code||value.error||'SOURCE_UNAVAILABLE');if(!controller.signal.aborted){setData(value);setError('');}})
   .catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return()=>controller.abort();
 },[signalAccess,visible,refreshKey,revision,fetchCycle,ownerPreview]);

 const topFocus=useMemo(()=>{
  const candidates=rows.filter(r=>(r.templatePass||r.stage===2)&&r.plan&&!['unavailable','stale'].includes(r.status));
  return candidates.sort((a,b)=>((b.score??0)-(a.score??0))||((b.rs?.excessReturnPercent??-999)-(a.rs?.excessReturnPercent??-999))||((b.rvol??0)-(a.rvol??0))).slice(0,3);
 },[rows]);

 const morningPicks=useMemo(()=>{
  const valid=rows.filter(r=>r.plan&&Number.isFinite(r.price)&&!['unavailable','stale'].includes(r.status));
  return [...valid]
   .sort((a,b)=>((b.volumeBreakout?2:0)+(b.templatePass?2:0)+(b.score??0))-((a.volumeBreakout?2:0)+(a.templatePass?2:0)+(a.score??0)))
   .slice(0,3);
 },[rows]);

 const eveningHomework=useMemo(()=>{
  const valid=rows.filter(r=>r.plan&&Number.isFinite(r.price)&&!['unavailable','stale'].includes(r.status));
  const stage2Pick=valid.find(r=>r.stage===2&&r.templatePass)||valid[0]||null;
  const pullbackPick=valid.find(r=>r.pullback&&r.symbol!==stage2Pick?.symbol)||valid.find(r=>r.symbol!==stage2Pick?.symbol)||null;
  const breakoutPick=valid.find(r=>r.volumeBreakout&&r.symbol!==stage2Pick?.symbol&&r.symbol!==pullbackPick?.symbol)||valid.find(r=>r.symbol!==stage2Pick?.symbol&&r.symbol!==pullbackPick?.symbol)||null;
  return [
   stage2Pick?{bucket:'🚀 การบ้านสายต้นน้ำ (Stage 2 Leader)',desc:'โครงสร้างขาขึ้นแข็งแกร่ง ยืนเหนือ EMA ทุกเส้น ชนะตลาด SET',row:stage2Pick}:null,
   pullbackPick?{bucket:'🎯 การบ้านสายย่อรับแนวรับ (Pullback EMA)',desc:'ย่อตัวใกล้โซนแนวรับปลอดภัย จุด Stop Loss แคบ ไม่ต้องไล่ราคา',row:pullbackPick}:null,
   breakoutPick?{bucket:'🔥 การบ้านสายวอลุ่มเข้าจ่อเบรก (Volume Surge)',desc:'วอลุ่มสะสมเข้าผิดปกติ เฝ้าจังหวะเปิดตลาดพรุ่งนี้เช้า',row:breakoutPick}:null,
  ].filter(Boolean);
 },[rows]);

 /* ─── Auto Voice Briefing when stock plans load ─── */
 useEffect(()=>{
  if(!visible||!voiceEnabled||autoAnnouncedRef.current)return;
  if(!morningPicks.length)return;
  autoAnnouncedRef.current=true;
  const sessionKey='nugaom_thai_plan_voiced_v1';
  try{
   if(typeof window!=='undefined'&&window.sessionStorage?.getItem(sessionKey))return;
   window.sessionStorage?.setItem(sessionKey,'1');
  }catch(_e){}
  const bkkHour=(new Date().getUTCHours()+7)%24;
  const autoText=(bkkHour>=16||bkkHour<6)
   ?buildEveningHomeworkSpeech(rows,regime)
   :buildMorningBriefSpeech(rows,regime);
  setLastSpokenText(autoText);
  pendingAutoTextRef.current=autoText;
  speakerRef.current?.play(autoText);
 },[visible,voiceEnabled,morningPicks,rows,regime]);

 const avoidedCount=useMemo(()=>{
  const weak=rows.filter(r=>r.stage===4||(r.stage===3&&!r.templatePass)).length;
  return rows.some(r=>r.stage!==null)?weak:null;
 },[rows,stats]);

 function handleRunDoctor(sym,{speak=true}={}){
  const target=(sym||doctorInput||'').trim().toUpperCase();
  if(!target)return;
  const isVip=signalAccess===true||ownerPreview;
  if(!isVip&&doctorUsed>=3){
   setQuotaExceeded(true);
   return;
  }
  const match=rows.find(r=>r.symbol===target);
  if(match){
   setDoctorResult(match);
   setQuotaExceeded(false);
   if(speak&&voiceEnabled){
    const analysis=getDoctorAnalysis(match);
    speakText(buildStockSupportResistanceSpeech({...match,...analysis}));
   }
   if(!isVip){
    const today=new Date().toISOString().slice(0,10);
    const nextUsed=doctorUsed+1;
    setDoctorUsed(nextUsed);
    try{localStorage.setItem(`doctor_quota_${today}`,String(nextUsed));}catch(_e){}
   }
  }else{
   setDoctorResult({
    symbol:target,
    name:`${target} (SET)`,
    price:null,
    notInList:true,
   });
   setQuotaExceeded(false);
  }
 }

 const doctorAnalysis=doctorResult&&!doctorResult.notInList?getDoctorAnalysis(doctorResult):null;

 return <section id="section-auto-pick" className={`${styles.dashboard} ${compact?styles.compact:''}`} aria-label="Thai Stock Screener">
  {compact?<header className={styles.compactHeader}><div><h2>ระบบคัดหุ้นขาขึ้น &amp; เช็คแนวรับแนวต้าน</h2><p>วิเคราะห์ Trend Template · กรอบความเสี่ยง 2R · คัดเฉพาะหุ้นที่ความได้เปรียบสูง</p></div><button type="button" disabled={busy||signalAccess!==true} onClick={()=>setRevision(v=>v+1)}>{busy?'กำลังโหลด…':'↻ โหลดข้อมูลล่าสุด'}</button></header>:<>  <header className={styles.header}><div><span className={styles.eyebrow}>THAI EQUITIES / SET100 + mai</span><h1>ตลาดหุ้นไทย <span>Decision Terminal</span></h1><p>คัดหุ้น · เก็บไว้เฝ้า · เปิดกราฟ · ติดตามผล ในหน้าเดียว</p></div><div className={styles.actions}><button type="button" onClick={onOpenStyleScanner}>สแกนตามสไตล์ (Multi-Strategy) ↗</button><a href="#section-radar">Strategy Radar ↓</a><a href="#chart-panel">กราฟ {selectedSymbol} ↓</a><a href="#section-results" onClick={event=>{if(onResults){event.preventDefault();onResults();}}}>Trade Ledger (100 ไม้)</a><button type="button" disabled={busy||signalAccess!==true} onClick={()=>setRevision(v=>v+1)}>{busy?'กำลังโหลด…':'↻ โหลดผลล่าสุด'}</button></div></header></>}

  {/* ─── 0. ศูนย์ตอบโจทย์นักลงทุนไทย 3 คำถามหลัก + เสียงแจ้งเตือนหุ้นในแผนอัตโนมัติ ─── */}
  <section className={styles.retailBriefSection} aria-label="โพยเสียงเช้านี้เล่นอะไรดี และการบ้านหุ้นเย็นนี้">
   <div className={styles.retailBriefHead}>
    <div>
     <span className={styles.scoreboardPill}>🔊 THAI VOICE BRIEFING · ตอบโจทย์ 3 คำถามหลักนักลงทุนไทย</span>
     <h3>เช้านี้เล่นอะไรดี? · ตอนเย็นมีการบ้านไหม? · แนวรับแนวต้านเท่าไหร่?</h3>
     <p>ระบบคัดหุ้นเข้าแผน 2R จากข้อมูลจริง พร้อมอ่านออกเสียงภาษาไทยแจ้งจุดเข้า แนวรับ แนวต้าน และจุดคัทลอสให้ฟังทันที</p>
    </div>
    <div className={styles.retailVoiceControls}>
     <button
      type="button"
      className={styles.voicePlayPrimary}
      onClick={()=>{
       const txt=retailTab==='evening'
        ?buildEveningHomeworkSpeech(rows,regime)
        :buildMorningBriefSpeech(rows,regime);
       speakText(txt);
      }}
     >
      {speechState==='speaking'?'🔊 กำลังอ่านโพยหุ้น…':'🔊 กดฟังเสียงสรุปโพยหุ้นในแผน'}
     </button>
     {speechState==='speaking'&&(
      <button
       type="button"
       className={styles.voiceStopBtn}
       onClick={()=>speakerRef.current?.stop()}
      >
       ⏹ หยุดเสียง
      </button>
     )}
    </div>
   </div>

   {lastSpokenText&&(
    <div className={styles.spokenTranscriptBar} role="status" aria-live="polite">
     <span>🎙️ <strong>สคริปต์เสียงแจ้งเตือนล่าสุด:</strong> {lastSpokenText}</span>
     <button type="button" onClick={()=>speakText(lastSpokenText)}>ฟังซ้ำ ↻</button>
    </div>
   )}

   <div className={styles.retailTabs} role="tablist" aria-label="เลือกคำถามยอดฮิต">
    <button
     type="button"
     role="tab"
     aria-selected={retailTab==='morning'}
     className={retailTab==='morning'?styles.retailTabActive:styles.retailTab}
     onClick={()=>{
      setRetailTab('morning');
      speakText(buildMorningBriefSpeech(rows,regime));
     }}
    >
     🌅 1. เช้านี้เล่นอะไรดีครับ? <small>โพย 3 หุ้นเด่นพร้อมลุย + ฟังเสียง</small>
    </button>
    <button
     type="button"
     role="tab"
     aria-selected={retailTab==='evening'}
     className={retailTab==='evening'?styles.retailTabActive:styles.retailTab}
     onClick={()=>{
      setRetailTab('evening');
      speakText(buildEveningHomeworkSpeech(rows,regime));
     }}
    >
     🌙 2. ตอนเย็นมีการบ้านไหม? <small>การบ้าน 3 สไตล์เฝ้าพรุ่งนี้ + ฟังเสียง</small>
    </button>
    <button
     type="button"
     role="tab"
     aria-selected={retailTab==='levels'}
     className={retailTab==='levels'?styles.retailTabActive:styles.retailTab}
     onClick={()=>{
      setRetailTab('levels');
      const targetRow=doctorResult&&!doctorResult.notInList?doctorResult:(selected||morningPicks[0]||rows[0]);
      if(targetRow){
       setDoctorInput(targetRow.symbol);
       handleRunDoctor(targetRow.symbol,{speak:true});
      }
      document.getElementById('thai-stock-doctor')?.scrollIntoView({behavior:'smooth'});
     }}
    >
     🎯 3. แนวรับแนวต้านเท่าไหร่? <small>เช็คแนวรับ-แนวต้าน-จุดคัทรายตัว + ฟังเสียง</small>
    </button>
   </div>

   {retailTab==='morning'&&(
    <div className={styles.retailCardsGrid}>
     {morningPicks.length?morningPicks.map((item,idx)=>{
      const analysis=getDoctorAnalysis(item);
      return (
       <article key={item.symbol} className={styles.retailCard}>
        <div className={styles.retailCardTop}>
         <span className={styles.retailRankBadge}>โพยเช้า #{idx+1}</span>
         <div className={styles.retailAssetTitle}>
          <InstrumentLogo asset={{market:'thai',symbol:item.symbol}}/>
          <div>
           <strong>{item.symbol} · ฿{n(item.price)}</strong>
           <small>{item.name} · {item.volumeBreakout?'🔥 วอลุ่มเข้าจ่อเบรก':item.templatePass?'🚀 Stage 2 ขาขึ้น':'🎯 เข้าแผน 2R'}</small>
          </div>
         </div>
         <button
          type="button"
          className={styles.retailSpeakChip}
          onClick={()=>speakText(buildStockSupportResistanceSpeech({...item,...analysis}))}
         >
          🔊 ฟังแผน {item.symbol}
         </button>
        </div>
        <div className={styles.retailLevelPills}>
         <div><span>🟢 แนวรับ/จุดเข้า</span><strong>฿{n(item.plan?.entry)}</strong></div>
         <div><span>🎯 แนวต้าน TP1</span><strong className={styles.targetText}>฿{n(item.plan?.minimumTarget)}</strong></div>
         <div><span>🚀 แนวต้าน TP2</span><strong className={styles.targetText}>฿{n(analysis?.target2)}</strong></div>
         <div><span>🔴 จุดคัท SL</span><strong className={styles.stopLossText}>฿{n(item.plan?.stopLoss)}</strong></div>
        </div>
        <div className={styles.retailCardFoot}>
         <small>ความเสี่ยงต่อไม้ {n(item.plan?.stopPercent)}% · กรอบกำไร 2R สุทธิ</small>
         <button type="button" onClick={()=>onSelect?.(item.symbol)}>เปิดกราฟ &amp; คำนวณไม้ ↗</button>
        </div>
       </article>
      );
     }):(
      <p className={styles.retailEmpty}>กำลังโหลดโพยหุ้นเช้านี้จากข้อมูลตลาดจริง…</p>
     )}
    </div>
   )}

   {retailTab==='evening'&&(
    <div className={styles.retailCardsGrid}>
     {eveningHomework.length?eveningHomework.map(({bucket,desc,row:item})=>{
      const analysis=getDoctorAnalysis(item);
      return (
       <article key={`${bucket}-${item.symbol}`} className={styles.retailCard}>
        <div className={styles.retailCardTop}>
         <span className={styles.retailHomeworkBadge}>{bucket}</span>
         <div className={styles.retailAssetTitle}>
          <InstrumentLogo asset={{market:'thai',symbol:item.symbol}}/>
          <div>
           <strong>{item.symbol} · ฿{n(item.price)}</strong>
           <small>{desc}</small>
          </div>
         </div>
         <button
          type="button"
          className={styles.retailSpeakChip}
          onClick={()=>speakText(buildStockSupportResistanceSpeech({...item,...analysis}))}
         >
          🔊 ฟังการบ้าน {item.symbol}
         </button>
        </div>
        <div className={styles.retailLevelPills}>
         <div><span>🟢 แนวรับเฝ้ารับ</span><strong>฿{n(item.plan?.entry)}</strong></div>
         <div><span>🎯 แนวต้านแรก</span><strong className={styles.targetText}>฿{n(item.plan?.minimumTarget)}</strong></div>
         <div><span>🚀 แนวต้านถัดไป</span><strong className={styles.targetText}>฿{n(analysis?.target2)}</strong></div>
         <div><span>🔴 จุดหนีตาย (SL)</span><strong className={styles.stopLossText}>฿{n(item.plan?.stopLoss)}</strong></div>
        </div>
        <div className={styles.retailCardFoot}>
         <small>ราคาปิดอ้างอิง {item.priceDay??'ล่าสุด'} · เตรียมเฝ้าเปิดตลาดพรุ่งนี้</small>
         <button type="button" onClick={()=>onSelect?.(item.symbol)}>เปิดกราฟทำการบ้าน ↗</button>
        </div>
       </article>
      );
     }):(
      <p className={styles.retailEmpty}>กำลังโหลดการบ้านหุ้นเย็นนี้จากข้อมูลราคาปิดล่าสุด…</p>
     )}
    </div>
   )}
  </section>

  {/* ─── 1. Verified Track Record Scoreboard ─── */}
  <section className={styles.scoreboardSection} aria-label="Verified Signal Track Record">
   <div className={styles.scoreboardHeader}>
    <div className={styles.scoreboardTitleGroup}>
     <span className={styles.scoreboardPill}>🏆 VERIFIED TRACK RECORD · สถิติ 30 วันล่าสุด</span>
     <h3>บันทึกผลงานสัญญาณระบบ 2R · โปร่งใส ตรวจสอบได้ทุกไม้</h3>
     <p>คัดกรองเฉพาะหุ้นที่มีโครงสร้างความได้เปรียบสูง (High Probability Setup) บันทึก Entry / SL / TP ชัดเจน</p>
    </div>
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
     <a href="https://t.me/DRThaibot" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)', color: '#fff', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textDecoration: 'none', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)' }}>
      ✈️ รับการบ้านหุ้นเข้า Telegram VIP ↗
     </a>
     <button type="button" className={styles.ledgerButton} onClick={()=>{if(onResults)onResults();}}>
      📑 ดูบันทึกผลจริง Trade Ledger ↗
     </button>
    </div>
   </div>

   <div className={styles.scoreboardMetrics}>
    <div className={styles.scoreMetricCard} data-accent="green">
     <span className={styles.scoreMetricLabel}>🎯 Win Rate อัตราการชนะ</span>
     <strong className={styles.scoreMetricValue}>{stats?.trackRecord?.validated?`${stats.trackRecord.winRate.toFixed(1)}%`:'—'}</strong>
     <small className={styles.scoreMetricSub}>{stats?.trackRecord?.validated?`ชนะ ${stats.trackRecord.wins} ไม้ / แพ้ ${stats.trackRecord.losses} ไม้ (${stats.trackRecord.closed} ไม้จากกราฟจริง)`:'ยังไม่มีไม้ปิดจริงในบันทึก · เริ่มบันทึกแบบ forward'}</small>
    </div>
    <div className={styles.scoreMetricCard} data-accent="cyan">
     <span className={styles.scoreMetricLabel}>💰 กำไรเฉลี่ยเมื่อชนเป้า 2R</span>
     <strong className={styles.scoreMetricValue}>{stats?.trackRecord?.validated?`+${stats.trackRecord.avgWinPct.toFixed(2)}%`:'—'}</strong>
     <small className={styles.scoreMetricSub}>บวก 1R ยก Stop บังทุน · ขายทำกำไรที่ 2R</small>
    </div>
    <div className={styles.scoreMetricCard} data-accent="red">
     <span className={styles.scoreMetricLabel}>🛡️ ขาดทุนเฉลี่ยเมื่อคัท (SL)</span>
     <strong className={styles.scoreMetricValue}>{stats?.trackRecord?.validated?`-${Math.abs(stats.trackRecord.avgLossPct).toFixed(2)}%`:'—'}</strong>
     <small className={styles.scoreMetricSub}>คัทตามโครงสร้าง ATR + แนวรับ (≤ 7.8%)</small>
    </div>
    <div className={styles.scoreMetricCard} data-accent="gold">
     <span className={styles.scoreMetricLabel}>⚖️ Risk : Reward สุทธิ</span>
     <strong className={styles.scoreMetricValue}>{stats?.trackRecord?.validated?`1 : ${stats.trackRecord.netRr.toFixed(1)}`:'—'}</strong>
     <small className={styles.scoreMetricSub}>{stats?.trackRecord?.validated?`Profit Factor ${stats.trackRecord.profitFactor.toFixed(2)} · Net +${stats.trackRecord.netReturnR}R`:'แสดงเมื่อมีไม้ปิดจริงอย่างน้อย 30 ไม้'}</small>
    </div>
   </div>

   <div className={styles.recentWinnersBox}>
    <div className={styles.recentWinnersTitle}>
     <span>⚡ หุ้นไทยเด่นพร้อมแผน 2R จากราคาปิดจริงล่าสุด (Live Settrade EOD)</span>
    </div>
    <div className={styles.winnerCardsGrid}>
     {(topFocus.length ? topFocus : rows.filter(r => r.price > 0)).slice(0, 3).map(item => {
      const entry = item.plan?.entry ?? Number((item.price * 0.985).toFixed(2));
      const tp1 = item.plan?.minimumTarget ?? Number((entry * 1.06).toFixed(2));
      const gainPct = entry > 0 ? (((tp1 - entry) / entry) * 100).toFixed(1) : '6.0';
      return (
       <div key={item.symbol} className={styles.winnerCard} onClick={() => onSelect?.(item.symbol)} style={{ cursor: 'pointer' }}>
        <div className={styles.winnerCardHead}>
         <InstrumentLogo asset={{market:'thai',symbol:item.symbol}}/>
         <div>
          <strong>{item.symbol} · ฿{n(item.price)}</strong>
          <small>{item.name} · {item.section==='SET100'?'SET100':'SET'}</small>
         </div>
         <span className={styles.winnerBadge}>เป้า +{gainPct}% 🎯</span>
        </div>
        <div className={styles.winnerDetails}>
         <span>แผนรับ ฿{n(entry)} ➔ เป้า 2R ฿{n(tp1)}</span>
         <small>ราคาปิดจริง · {item.priceDay ?? 'ล่าสุด'}</small>
        </div>
       </div>
      );
     })}
    </div>
   </div>
  </section>

  {/* ─── 2. Instant Stock Doctor (เช็คแนวรับ-แนวต้านด่วน 3 บรรทัด) ─── */}
  <section id="thai-stock-doctor" className={styles.doctorSection} aria-label="ตรวจแนวรับแนวต้านด่วน 3 บรรทัด">
   <div className={styles.doctorHead}>
    <div className={styles.doctorTitleGroup}>
     <span className={styles.doctorPill}>🩺 INSTANT STOCK DOCTOR · เช็คแนวรับ-แนวต้านด่วน + เสียงพูด</span>
     <h3>พิมพ์ชื่อหุ้น หรือคลิกชื่อหุ้น · รู้แนวรับ แนวต้าน จุดคัท พร้อมฟังเสียงทันที</h3>
     <p>ตอบคำถาม "แนวรับแนวต้านเท่าไหร่?" ทันทีใน 3 วินาที คำนวณโซนรับปลอดภัย เป้าต้าน TP1/TP2 และจุดคัทลอสตามโครงสร้างจริง</p>
    </div>
    <div className={styles.doctorQuotaBadge}>
     {signalAccess===true||ownerPreview?(
      <span className={styles.quotaVip}>👑 สมาชิก PRO VIP: ตรวจได้ไม่จำกัด</span>
     ):(
      <span className={styles.quotaFree}>โควตาฟรีวันนี้: {Math.max(0,3-doctorUsed)}/3 ตัว</span>
     )}
    </div>
   </div>

   <div className={styles.doctorSearchRow}>
    <div className={styles.doctorInputWrap}>
     <input
      type="text"
      className={styles.doctorInput}
      placeholder="พิมพ์ชื่อหุ้นไทย เช่น DELTA, AOT, GULF, CPALL, BDMS..."
      value={doctorInput}
      onChange={e=>setDoctorInput(e.target.value.toUpperCase())}
      onKeyDown={e=>{if(e.key==='Enter')handleRunDoctor(doctorInput);}}
     />
     <button
      type="button"
      className={styles.doctorSubmitBtn}
      onClick={()=>handleRunDoctor(doctorInput)}
     >
      ตรวจจุดซื้อ-ขาย ↗
     </button>
    </div>
    <div className={styles.doctorQuickPills}>
     <span>หุ้นยอดนิยม:</span>
     {['DELTA','ADVANC','GULF','CPALL','BDMS','KBANK','PTT','SCB'].map(sym=>(
      <button
       key={sym}
       type="button"
       className={styles.quickPillBtn}
       onClick={()=>{setDoctorInput(sym);handleRunDoctor(sym);}}
      >
       {sym}
      </button>
     ))}
    </div>
   </div>

   {quotaExceeded&&<div className={styles.quotaAlertBox}>
    <div className={styles.quotaAlertHead}>
     <span className={styles.quotaAlertIcon}>🔒</span>
     <div>
      <strong>คุณใช้สิทธิ์ตรวจหุ้นฟรีครบ 3 ตัวสำหรับวันนี้แล้ว</strong>
      <p>ปลดล็อกการตรวจแนวรับ-แนวต้านไม่จำกัดตัว + รับการบ้านหุ้นเด่นส่งตรงเข้า LINE ทุกเย็น 17:00 น.</p>
     </div>
    </div>
    <a href="/account" className={styles.quotaUpgradeBtn}>
     สมัคร PRO VIP เพียง 399 บ./เดือน ↗
    </a>
   </div>}

   {doctorResult&&!quotaExceeded&&(
    <article className={styles.doctorCard}>
     {doctorResult.notInList?(
      <div className={styles.doctorDiagnosis} data-tone="yellow">
       <strong>⚠️ ไม่พบข้อมูลหุ้น "{doctorResult.symbol}" ในจักรวาล SET100</strong>
       <p>กรุณาตรวจสอบตัวสะกด หรือเลือกคลิกหุ้นแนะนำด้านบน เช่น DELTA, AOT, CPALL, GULF, BDMS</p>
      </div>
     ):(
      <>
       <div className={styles.doctorCardHead}>
        <div className={styles.doctorStockInfo}>
         <InstrumentLogo asset={{market:'thai',symbol:doctorResult.symbol}}/>
         <div>
          <strong>{doctorResult.symbol} · {doctorResult.name}</strong>
          <small>{doctorResult.sectorLabel??doctorResult.sector??'SET'} · {doctorResult.section==='SET100'?'SET100':doctorResult.section==='MAI_INITIAL'?'mai':'หุ้นไทย'}</small>
         </div>
        </div>
        <div className={styles.doctorPricePill}>
         <strong>฿{n(doctorResult.price)}</strong>
         <small data-tone={doctorResult.changePercent>0?'up':doctorResult.changePercent<0?'down':'neutral'}>
          {doctorResult.changePercent>0?'+':''}{n(doctorResult.changePercent)}%
         </small>
        </div>
       </div>

       <div className={styles.doctorLevelsGrid}>
        <div className={styles.doctorLevelItem} data-tone="green">
         <span>🟢 แนวรับ (โซนซื้อปลอดภัย)</span>
         <strong>฿{n(doctorAnalysis?.support)}</strong>
         <small>แนวรับสะสม ไม่ควรไล่ราคา</small>
        </div>
        <div className={styles.doctorLevelItem} data-tone="target">
         <span>🎯 แนวต้าน 1 (เป้า 2R TP1)</span>
         <strong>฿{n(doctorAnalysis?.target1)}</strong>
         <small>แบ่งขายล็อคกำไร 50% (+{n(doctorAnalysis?.target1Pct)}%)</small>
        </div>
        <div className={styles.doctorLevelItem} data-tone="target">
         <span>🚀 แนวต้าน 2 (เป้ารันเทรนด์ TP2)</span>
         <strong>฿{n(doctorAnalysis?.target2)}</strong>
         <small>แนวต้านใหญ่ถัดไป (+{n(doctorAnalysis?.target2Pct)}%)</small>
        </div>
        <div className={styles.doctorLevelItem} data-tone="red">
         <span>🔴 จุดตัดขาดทุน (SL ห้ามต่อรอง)</span>
         <strong>หลุด ฿{n(doctorAnalysis?.stop)}</strong>
         <small>คัททันทีตามวินัย (-{n(doctorAnalysis?.stopPct)}%)</small>
        </div>
       </div>

       <div className={styles.doctorDiagnosis} data-tone={doctorAnalysis?.tone}>
        <strong>{doctorAnalysis?.title}</strong>
        <p>{doctorAnalysis?.advice}</p>
       </div>

       <div className={styles.doctorActions}>
        <button
         type="button"
         className={styles.voicePlayPrimary}
         onClick={()=>speakText(buildStockSupportResistanceSpeech({...doctorResult,...doctorAnalysis}))}
        >
         🔊 ฟังเสียงแนวรับ-แนวต้าน {doctorResult.symbol}
        </button>
        <button
         type="button"
         className={styles.secondaryActionBtn}
         onClick={()=>{
          onSelect?.(doctorResult.symbol);
          document.getElementById('section-auto-pick')?.scrollIntoView({behavior:'smooth'});
         }}
        >
         คำนวณจำนวนหุ้น &amp; เงินลงทุน (2R) ↓
        </button>
        <button
         type="button"
         className={styles.primaryActionBtn}
         onClick={()=>onSelect?.(doctorResult.symbol)}
        >
         เปิดดูกราฟเทคนิค {doctorResult.symbol} ↗
        </button>
       </div>
      </>
     )}
    </article>
   )}
  </section>

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
         <small>{item.sector??'—'} · {item.section==='SET100'?'SET100':item.section==='MAI_INITIAL'?'mai':'—'}</small>
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
        <button type="button" onClick={()=>speakText(buildStockSupportResistanceSpeech(item))}>🔊 ฟังแผน</button>
        <button type="button" onClick={()=>onSelect?.(item.symbol)}>คำนวณไม้ ↗</button>
        <button type="button" onClick={()=>onSelect?.(item.symbol)} aria-label={`ดูกราฟ ${item.symbol}`}>ดูกราฟ ↗</button>
       </div>
      </div>
     </article>)}
    </div>
   </section>}

   <nav className={styles.presets} aria-label="รูปแบบคัดกรอง">
    {presets.map(([id,label])=><button key={id} type="button" aria-pressed={preset===id} onClick={()=>setPreset(id)}>{label}</button>)}
   </nav>

   {PRESET_TIPS[preset]&&<div className={styles.presetGuidance}>
    <span>💡 <strong>คำแนะนำระบบ:</strong> {PRESET_TIPS[preset]}</span>
   </div>}

   <div className={styles.filters}><label className={styles.search}>ค้นหาหุ้น<input aria-label="ค้นหาหุ้นไทยในตาราง" value={query} placeholder="ชื่อย่อ / บริษัท เช่น PTT" onChange={e=>setQuery(e.target.value)}/></label><details className={styles.advancedFilters}><summary>ตัวกรองเพิ่ม{[sector!=='all',peMax!==80,rsiMin!==0||rsiMax!==100,sort!=='quality'].filter(Boolean).length>0?' · ใช้อยู่ '+[sector!=='all',peMax!==80,rsiMin!==0||rsiMax!==100,sort!=='quality'].filter(Boolean).length:''}</summary><div className={styles.advancedControls}><label>Sector · provider<select aria-label="กรองกลุ่มหุ้น" value={sector} onChange={e=>setSector(e.target.value)}><option value="all">ทุกกลุ่ม</option>{sectors.map(s=><option key={s}>{s}</option>)}<option value="unknown">ข้อมูลกลุ่มไม่พร้อม</option></select></label><label>P/E ≤ {peMax===80?'ทั้งหมด':peMax}<input type="range" aria-label="P/E สูงสุด" min="1" max="80" value={peMax} disabled={!hasPe} onChange={e=>setPeMax(Number(e.target.value))}/>{!hasPe&&<small>กำลังรอข้อมูล P/E</small>}</label><label>RSI {rsiMin}–{rsiMax}<div className={styles.ranges}><input type="range" aria-label="RSI ต่ำสุด" min="0" max="100" value={rsiMin} onChange={e=>setRsiMin(Math.min(Number(e.target.value),rsiMax))}/><input type="range" aria-label="RSI สูงสุด" min="0" max="100" value={rsiMax} onChange={e=>setRsiMax(Math.max(Number(e.target.value),rsiMin))}/></div></label><label>เรียงตาม<select aria-label="เรียงหุ้นไทย" value={sort} onChange={e=>setSort(e.target.value)}><option value="quality">EMA Score</option><option value="rvol">RVOL</option><option value="rs">RS vs SET</option><option value="change">% เปลี่ยนแปลง</option><option value="symbol">ชื่อย่อ</option></select></label></div></details><button type="button" aria-pressed={savedOnly} onClick={()=>setSavedOnly(v=>!v)}>★ หุ้นโปรด {favorites.length}</button><button type="button" aria-pressed={showMetrics} onClick={()=>setShowMetrics(v=>!v)}>{showMetrics?'ซ่อน RSI / P/E / RVOL':'แสดง RSI / P/E / RVOL'}</button><button type="button" onClick={reset}>ล้างตัวกรอง</button></div>
   {preset==='orb'&&<p className={styles.notice}>ORB 15m · พักสัญญาณใหม่ระหว่างวิจัย ฟีดหน่วงอย่างน้อย 15 นาที · <a href="#section-results" onClick={event=>{if(onResults){event.preventDefault();onResults();}}}>เปิดประวัติ Trade Ledger ↓</a></p>}
   {preset==='dividend'&&<p className={styles.notice}>เกณฑ์นี้ใช้ Dividend ≥3% และ P/E ≤15 จากข้อมูล provider ไม่ใช่การยืนยันสมาชิกดัชนี SETHD ข้อมูลที่ขาดจะไม่ผ่านตัวกรอง</p>}
   {error&&<p role="alert" className={styles.notice}>ยังอ่านข้อมูลไม่ได้ กรุณาลองโหลดผลล่าสุด · {error}</p>}
   {!data?<p role="status" className={styles.message}>{busy||signalAccess===null?'กำลังอ่านผลและโหลดราคาจริง…':'รอข้อมูลจากผู้ให้บริการ'}</p>:<><ThaiScreenerTable showMetrics={showMetrics} rows={filtered.slice((current-1)*7,current*7)} favorites={favorites} selectedSymbol={selectedSymbol} onSelect={onSelect} onToggleFavorite={onToggleFavorite} onSpeakRow={row=>speakText(buildStockSupportResistanceSpeech(row))}/>{!filtered.length&&<p role="status" className={styles.message}>{preset==='orb'?'ไม่มีสัญญาณ ORB ใหม่ในโหมดที่พักวิจัย':'ยังไม่มีหุ้นผ่านตัวกรองนี้ ลองล้างตัวกรองหรือรอข้อมูลครบ'}</p>}<footer className={styles.pagination}><span>{filtered.length}/{rows.length} ตัว · หน้าละ 7 · {data?.dataMode==='daily-snapshot'?'ผลส่วนกลางรอบรายวัน · ใช้ร่วมกันทั้งวัน':'คัดใหม่รายตัวทุก 10 นาทีตามคิว'}</span><div><button disabled={current===1} onClick={()=>setPage(current-1)}>ก่อนหน้า</button><span>{current}/{pages}</span><button disabled={current===pages} onClick={()=>setPage(current+1)}>ถัดไป</button></div></footer></>}
   
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
  <details className={styles.method}><summary>กฎคัดกรอง เวลา และข้อจำกัดข้อมูล (Proprietary AI Engine)</summary><p>ระบบคัดกรองหุ้นใช้โมเดลเชิงปริมาณกรรมสิทธิ์เฉพาะ Nugaom AI Core Engine (Proprietary Quantitative Trend Model) โดยสงวนสิทธิ์ในสูตรคำนวณและพารามิเตอร์ภายในเพื่อความลับทางการค้า · ระบบประมวลผลโครงสร้างแนวโน้ม ความแข็งแกร่งสัมพัทธ์ (Relative Strength) และแรงผลักดันโมเมนตัมแบบหลายมิติ</p><p>ราคาและอินดิเคเตอร์ใช้ข้อมูลราคาปิด Timeframe หลักที่มีการหน่วงเวลาตามมาตรฐานผู้ให้บริการ รายการนับเฉพาะชุดสแกนที่ข้อมูลพร้อม ไม่ใช่ตลาด SET ทั้งหมด · P/E และ Div เป็นข้อมูลอ้างอิงของ provider ดูเวลา profile ในข้อมูล API · ซ่อนแท็บพักโหลด กลับมาดูอ่านผลใหม่ · แผนคัดกรองเป็นเพียงข้อมูลช่วยตัดสินใจ ไม่ใช่คำแนะนำชักชวนการลงทุน</p><p>แผนบริหารความเสี่ยงและอัตราผลตอบแทนต่อความเสี่ยง (Risk/Reward) ใช้โครงสร้างเชิงปริมาณมาตรฐานของระบบ หากแผน 4H ยังไม่พร้อมจะแสดงแผน D1 พร้อมระบุกรอบเวลา · อัตราส่วนและขนาดชุดอ้างอิงเป็นไปเพื่อการจำลองความเสี่ยงทางสถิติ · ผลไม้จริงอยู่ในบัญชี Trade Ledger ประวัติสัญญาณ</p></details>
 </section>;
}
