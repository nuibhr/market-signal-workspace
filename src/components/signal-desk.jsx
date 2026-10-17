'use client';
import { useEffect, useRef, useState } from 'react';
import DaytradePanel from './daytrade/daytrade-panel.jsx';
import {useMonitor} from './monitor/monitor-provider.jsx';
import { ALL_ASSETS } from '../markets/catalog.mjs';

const n = (value, digits=2) => Number.isFinite(value)?value.toLocaleString('th-TH',{maximumFractionDigits:digits}):'—';
const at = value => value?new Date(value).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}):'—';
const MODE = {breakout:'Breakout',pullback:'Pullback'};
const STATE = {PASS:'ผ่านเกณฑ์ · รอยืนยันเข้า',WAIT:'รอจังหวะ',REJECT:'ไม่ผ่าน',UNAVAILABLE:'ข้อมูลไม่พร้อม',WAITING:'รอยืนยันเข้า',OPEN:'เข้าเงื่อนไขแล้ว',RUNNER:'TP1 แล้ว · ติดตามส่วนที่เหลือ',STOP:'จบที่ Stop',CLOSED:'ปิดครบแล้ว',REVIEW:'พักผล · ต้องตรวจข้อมูล',EXPIRED:'แผนหมดอายุ'};
const REASONS = {D1_TREND_NOT_UP:'เทรนด์ D1 ยังไม่เป็นขาขึ้น',WAIT_4H_BREAKOUT_CLOSE:'รอ 4H ปิดทะลุกรอบ',WAIT_4H_PULLBACK_CLOSE:'รอ 4H ย่อแตะ EMA20 และปิดกลับเหนือ high ก่อนหน้า',RELATIVE_VOLUME_BELOW_1:'Volume ต่ำกว่าค่าเฉลี่ย 20 แท่ง',COSTS_REQUIRED:'ตั้งค่าต้นทุน US/ETF ก่อน',CONFIRMED_SWING_REQUIRED:'ยังไม่มี swing low ที่ยืนยัน',STRUCTURAL_STOP_EXCEEDS_8_PERCENT:'Stop ตามโครงสร้างกว้างเกิน 8%',RESISTANCE_BEFORE_MINIMUM_NET_REWARD:'แนวต้านอยู่ก่อนเป้า 2R สุทธิ',D1_4H_55_BARS_REQUIRED:'ต้องมี D1 และ 4H อย่างน้อย 55 แท่ง',NOT_SCANNED_YET:'ยังไม่ถึงรอบสแกน',STALE_BARS:'แท่งราคาเก่าเกินเกณฑ์',SOURCE_UNAVAILABLE:'เรียกข้อมูลไม่ได้',DISPLAY_RIGHTS_NOT_CONFIRMED:'ยังไม่ยืนยันสิทธิข้อมูล',CONFIRMED_STRUCTURE_ATR_ENTRY_REQUIRED:'ยังไม่มีโครงสร้างครบ'};
REASONS.SCAN_STALE = "ผลสแกนเกินรอบตรวจ รอ worker ตรวจใหม่";
const COST_FIELDS=[['commissionPercent','คอมต่อข้าง (%)'],['marketFeePercent','ค่าธรรมเนียมต่อข้าง (%)'],['commissionVatPercent','VAT บนคอม (%)'],['slippagePercent','Slippage ต่อข้าง (%)']];

function Stats({value,title}){
 return <section className="signal-stats"><h4>{title}</h4><div>{[['ไม้ปิดครบ',value.closed],['Win rate',`${n(value.winRate)}%`],['Expectancy',`${n(value.expectancyR)} R`],['Profit factor',n(value.profitFactor)],['Drawdown สะสม',`${n(value.maxDrawdownR)} R`],['รอตรวจ',value.review]].map(([label,v])=><p key={label}><small>{label}</small><strong>{v}</strong></p>)}</div></section>;
}
async function jsonRequest(url,options={},timeout=60000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{const r=await fetch(url,{...options,cache:'no-store',signal:options.signal||controller.signal});const d=await r.json();if(!r.ok)throw Error(d.code||'REQUEST_UNAVAILABLE');return d;}finally{clearTimeout(timer);}
}
function LegacySignalDesk({marketId,memberId,rights,favorites=[],onToggleFavorite,onSelect,loginHref}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[page,setPage]=useState(1),[query,setQuery]=useState(''),[mode,setMode]=useState('all'),[favoritesOnly,setFavoritesOnly]=useState(false),[revision,setRevision]=useState(0),[replay,setReplay]=useState(null),[costs,setCosts]=useState(Object.fromEntries(COST_FIELDS.map(([key])=>[key,'']))),[clock,setClock]=useState(null);
 const monitor=useMonitor();
 const inflight=useRef(false),selection=useRef(''),costLoaded=useRef(null);
 const enabled=Boolean(rights?.capabilities?.autoPickFeed),marketAssets=ALL_ASSETS.filter(a=>a.id===marketId);
 selection.current=`${marketId}:${enabled}:${memberId||'guest'}`;
 const select=symbol=>{const asset=marketAssets.find(a=>a.symbol===symbol);if(asset)onSelect(asset);};
 useEffect(()=>{const update=()=>setClock(new Date().toLocaleString('th-TH',{timeZone:'Asia/Bangkok',hour12:false}));update();const t=setInterval(update,1000);return()=>clearInterval(t);},[]);
 useEffect(()=>{
  let stopped=false,timer,controller;const scope=selection.current;
  setData(null);setError('');setReplay(null);costLoaded.current=null;
  if(!enabled)return;
  async function load(){
   controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);
   try{
    const p=new URLSearchParams({market:marketId,mode,page:String(page),q:query});
    if(favoritesOnly)p.set('favorites',favorites.join(','));
    let d=await jsonRequest(`/api/signals?${p}`,{signal:controller.signal});
    if(stopped||selection.current!==scope||d.market!==marketId)return;
    const expectedScope=`swing:${memberId}:${marketId}`;
    if(d.notificationScope!==expectedScope)throw Error('MEMBERSHIP_REQUIRED');
    if(stopped)return;
    setData(d);setError('');
    if(costLoaded.current!==d.usCosts?.id){costLoaded.current=d.usCosts?.id;setCosts(Object.fromEntries(COST_FIELDS.map(([k])=>[k,d.usCosts?.costs[k]??''])));}
   }catch(e){if(!stopped&&e.message==='MEMBERSHIP_REQUIRED'){setData(null);}if(!stopped)setError(e.message==='MEMBERSHIP_REQUIRED'?'สิทธิสมาชิกหมดอายุ กรุณาเข้าบัญชีเพื่อตรวจสิทธิ':'โหลดสัญญาณไม่สำเร็จ ข้อมูลเดิมอาจเก่า กรุณาลองใหม่');}
   finally{clearTimeout(timeout);if(!stopped)timer=setTimeout(load,10000);}
  }
  load();return()=>{stopped=true;controller?.abort();clearTimeout(timer);};
 },[enabled,memberId,marketId,page,query,mode,favoritesOnly,favorites.join(','),revision]);
 async function act(body){
  if(inflight.current)return;inflight.current=true;setBusy(true);setError('');const scope=selection.current;
  try{const d=await jsonRequest('/api/signals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(selection.current!==scope)return;
   if(body.action==='replay')setReplay(d);else setRevision(v=>v+1);
   if(d.status==='busy')setError('worker กำลังสแกนตลาดนี้อยู่ ระบบจะโหลดผลให้อัตโนมัติ');
  }catch(e){if(selection.current===scope)setError(e.message==='COSTS_REQUIRED'?'กรอกต้นทุนครบทั้ง 4 ช่องก่อนทดสอบ':'ทำรายการไม่สำเร็จ กรุณารอสักครู่แล้วลองใหม่');}
  finally{inflight.current=false;setBusy(false);}
 }
 const visibleSymbols=[...new Set(data?.rows?.map(r=>r.symbol)||[])].slice(0,6);
 const scanSymbols=visibleSymbols.length?visibleSymbols:(favoritesOnly?favorites:marketAssets.map(a=>a.symbol)).slice(0,6);
 return <section className="panel signal-desk" id="section-swing-scanner" aria-labelledby="signal-desk-title">
  <header className="signal-desk-heading"><div><span className="eyebrow">SWING STANDARD · D1 / 4H</span><h2 id="signal-desk-title">สแกนและติดตามสัญญาณ</h2><p>ผลของแผนระบบ แยก Breakout / Pullback · Stop ตามโครงสร้าง − ATR · TP1 2R สุทธิ 50% แล้ว BE / trail</p></div><div><time>{clock||'เวลาไทย'}</time><small>ข้อมูลแท่งปิดดีเลย์ ≥15 นาที · ดูเวลาอ้างอิงของแต่ละตัว</small></div></header>
  {!enabled?<div className="feature-empty"><p>เข้าสู่ระบบสมาชิกเพื่อดูสัญญาณและผลบันทึก รายการหุ้นโปรดยังใช้งานได้ตามเดิม</p><a href={loginHref}>เปิดบัญชีสมาชิก LINE</a></div>:<>
   <div className="signal-toolbar"><label>ค้นหา<input value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Symbol หรือชื่อหุ้น"/></label><label>กลยุทธ์<select value={mode} onChange={e=>{setMode(e.target.value);setPage(1);}}><option value="all">ทั้งสองแบบ</option><option value="breakout">Breakout</option><option value="pullback">Pullback</option></select></label><label className="signal-check"><input type="checkbox" checked={favoritesOnly} onChange={e=>{setFavoritesOnly(e.target.checked);setPage(1);}}/>เฉพาะหุ้นโปรดและการแจ้งเตือน</label><button disabled={busy||!scanSymbols.length} onClick={()=>act({action:'scan',market:marketId,symbols:scanSymbols})}>{busy?'กำลังทำงาน…':'สแกน 6 ตัวในหน้านี้'}</button><button onClick={()=>setRevision(v=>v+1)}>โหลดผลล่าสุด</button></div>
   <p className="signal-note">ป๊อปอัปและเสียงทำงานขณะเปิดหน้านี้ · {['blocked','failed'].includes(monitor?.audio)?'อุปกรณ์ยังเล่นเสียงไม่ได้ กดเปิดเสียงที่แถบบนอีกครั้ง':''} ป้าย “ผ่านเกณฑ์” คือแผนรอยืนยัน สถานะ “เข้าเงื่อนไขแล้ว” ต้องมี ENTRY จากแท่ง 15m หลังเผยแพร่: ปิดเขียวเหนือราคาแผนและไม่ไล่เกิน 0.5 ATR</p>
   {marketId==='us'&&<details className="signal-costs" open={!data?.usCosts}><summary>ต้นทุนสัญญาณ US / ETF {data?.usCosts?'· ตั้งแล้ว':'· ต้องกรอกก่อนสร้างแผน'}</summary><form onSubmit={e=>{e.preventDefault();act({action:'costs',costs:Object.fromEntries(COST_FIELDS.map(([key])=>[key,Number(costs[key])]))});}}>{COST_FIELDS.map(([key,label])=><label key={key}>{label}<input type="number" min="0" max={key==='commissionVatPercent'?100:5} step="any" required value={costs[key]} onChange={e=>setCosts(v=>({...v,[key]:e.target.value}))}/></label>)}<button disabled={busy}>บันทึกต้นทุนสัญญาณ</button></form><p>คิดต่อข้าง รองรับค่าธรรมเนียมแบบเปอร์เซ็นต์เท่านั้น · ไม่รองรับค่าขั้นต่ำ/ค่าคงที่/FX cash flow · เปลี่ยนต้นทุนแล้วใช้กับแผนใหม่ ผลเดิมเก็บตามต้นทุนเดิม ไม่อ่านข้อมูลพอร์ต</p></details>}
   {error&&<p role="alert" className="signal-error">{error}</p>}
   {data&&<>
    {data.overview&&<div className="signal-coverage"><strong>SET Index {n(data.overview.index?.price)} · {n(data.overview.index?.changePercent)}%</strong><small>{data.overview.index?`ราคาอ้างอิง ${at(data.overview.index.priceAt)} · ดีเลย์อย่างน้อย 15 นาที · ${data.overview.index.changePercent>=0?'บวก':'ลบ'} · ${data.overview.index.source}`:'ข้อมูล SET Index ยังไม่พร้อม ไม่ใช้หุ้นหรือดัชนีอื่นแทน'} · สถานะตลาดจากฟีด {data.overview.marketStatus||'ยังยืนยันไม่ได้'} {at(data.overview.marketStatusAt)}</small></div>}
    <p className="signal-coverage">รายชื่อทั้งหมด {data.coverage.expected} · ตรวจแล้ว {data.coverage.observed} · มีข้อมูล {data.coverage.available} · ข้อมูลไม่พร้อม {data.coverage.unavailable} · ยังไม่ตรวจ {data.coverage.neverChecked} · ตรวจล่าสุด {at(data.coverage.lastCheckedAt)} · {data.worker&&Date.now()-data.worker.heartbeatMs<(data.worker.idleAfterMs||180000)?'worker ติดต่ออยู่':'ยังไม่มี heartbeat ล่าสุดของ Swing worker'}</p>
    <p className="signal-note">ไทย/DR ใช้ค่าคอม 0.06% ต่อข้าง + VAT/fee และ slippage ตาม preset ที่แสดงในแผน · RVOL เทียบ 4H ช่วงตลาดเดียวกันย้อนหลังสูงสุด 20 แท่ง (อย่างน้อย 5 แท่ง) · %Δ เทียบราคาปิด 4H ก่อนหน้า</p>
    <div className="signal-table-wrap"><table className="signal-table"><thead><tr>{['หุ้น / กลยุทธ์','ราคา / %Δ 4H','แนวรับ / แนวต้าน','Entry / เงื่อนไข','SL / TP1 / R:R','ATR / Volatility','Volume / RVOL','RSI D1 / 4H','เทรนด์ D1 / 4H','สถานะ / เหตุผล',''].map((h,i)=><th key={i}>{h}</th>)}</tr></thead><tbody>{data.rows.map(row=><tr key={`${row.symbol}:${row.mode}`}><td><button className="signal-link" onClick={()=>select(row.symbol)}>{row.symbol}</button><small>{row.name}</small><b>{MODE[row.mode]}</b><button aria-label={`${favorites.includes(row.symbol)?'เลิกติดตาม':'ติดตาม'} ${row.symbol}`} aria-pressed={favorites.includes(row.symbol)} onClick={()=>onToggleFavorite(row.symbol)}>{favorites.includes(row.symbol)?'★':'☆'}</button></td><td>{n(row.price,4)}<small>{n(row.changePercent)}%</small><small>{at(row.priceAt)}</small></td><td>{n(row.support,4)}<small>{n(row.resistance,4)}</small></td><td>{n(row.plan?.entry??row.price,4)}<small>{row.mode==='breakout'?`4H ปิดเหนือ ${n(row.trigger?.breakout,4)}`:`ย่อแตะ EMA20 ${n(row.trigger?.pullback,4)} แล้วปิดกลับ`}</small><small>RVOL ≥1 · D1 ขาขึ้น</small></td><td>{n(row.plan?.stopLoss??row.proposedStop,4)}<small>TP1 {n(row.plan?.minimumTarget,4)}</small><small>{row.plan?'TP สูตร 2R สุทธิ':'—'}</small><small>R ถึงแนวต้าน {n(row.plan?.roomNetR)}</small>{row.plan&&<details><summary>ต้นทุน / Stop</summary><small>Stop {n(row.plan.stopPercent)}%</small><small>คอม {n(row.plan.friction.assumptions.commissionPercent,4)}% · slip {n(row.plan.friction.assumptions.slippagePercent,4)}% ต่อข้าง</small><small>fee {n(row.plan.friction.assumptions.marketFeePercent,4)}% · VAT {n(row.plan.friction.assumptions.commissionVatPercent)}% บนคอม</small></details>}</td><td>{n(row.atr,4)}<small>{n(row.atrPercent)}%</small></td><td>{n(row.volume,0)}<small>{n(row.relativeVolume)}×</small></td><td>{n(row.rsiD1,1)} / {n(row.rsi4h,1)}</td><td>{row.trendD1||'—'} / {row.trend4h||'—'}</td><td><b className={`signal-state ${row.state.toLowerCase()}`}>{STATE[row.state]}</b>{row.reasons.map(reason=><small key={reason}>{REASONS[reason]||reason}</small>)}</td><td><button disabled={busy||row.status!=='AVAILABLE'} onClick={()=>act({action:'replay',market:marketId,symbol:row.symbol})}>ทดสอบช่วงที่มี</button></td></tr>)}</tbody></table>{!data.rows.length&&<p className="feature-empty">ไม่มีรายการในตัวกรองนี้ เพิ่มหุ้นโปรดหรือเปลี่ยนตัวกรองได้</p>}</div>
    <nav className="signal-pagination" aria-label="หน้าผลสแกน"><button disabled={data.page<=1} onClick={()=>setPage(p=>p-1)}>ก่อนหน้า</button><span>{data.page} / {Math.max(1,Math.ceil(data.totalRows/data.pageSize))}</span><button disabled={data.page*data.pageSize>=data.totalRows} onClick={()=>setPage(p=>p+1)}>ถัดไป</button></nav>
    <section className="signal-tracking"><h3>ติดตามแผนที่เผยแพร่แล้ว</h3><p>ราคา ENTRY และผลเป็นราคาอ้างอิงของระบบ ไม่มีจำนวนหุ้นหรือยอดเงินของลูกค้า</p><div className="signal-track-grid">{data.signals.map(s=>{const distance=s.entryPrice&&s.latestPrice?(s.latestPrice-s.stop)/s.latestPrice*100:null;const distanceATR=s.context.atr?(s.latestPrice-s.stop)/s.context.atr:null;return <article key={s.id}><header><button className="signal-link" onClick={()=>select(s.symbol)}>{s.symbol} · {MODE[s.mode]}</button><b>{STATE[s.status]}</b>{monitor&&<button type="button" onClick={()=>monitor.inspectTrade({ledger:"swing",market:s.market,tradeId:s.id})}>ดูไม้ / สถิติ ↗</button>}</header><p>เผยแพร่ {at(s.publishedAt)} · ยืนยัน {at(s.confirmedAt)}</p><dl><div><dt>เข้าอ้างอิง</dt><dd>{n(s.entryPrice,4)}</dd></div><div><dt>ล่าสุด {at(s.latestPriceAt)}</dt><dd>{n(s.latestPrice,4)}</dd></div><div><dt>Stop · {s.stopState}</dt><dd>{n(s.stop,4)}</dd></div><div><dt>TP1</dt><dd>{n(s.plan.minimumTarget,4)}</dd></div><div><dt>ห่าง Stop</dt><dd>{n(distance)}% / {n(distanceATR)} ATR</dd></div><div><dt>ส่วนที่ติดตาม</dt><dd>{n(s.remainingFraction*100,0)}%</dd></div><div><dt>ผลแผนตามราคาอ้างอิง</dt><dd>{n(s.markReturnPercent)}% / {n(s.markNetR)} R</dd></div><div><dt>ห่าง TP1</dt><dd>{s.latestPrice?n((s.plan.minimumTarget-s.latestPrice)/s.latestPrice*100):'—'}%</dd></div></dl></article>;})}</div>{!data.signals.length&&<p>ยังไม่มีแผนที่กำลังติดตามในตัวกรองนี้</p>}</section>
    <section id="section-swing-results" className="signal-journal"><h3>บันทึกผลสัญญาณ Swing Standard</h3><p>นับเฉพาะไม้ที่ปิดครบ หลังต้นทุนตามแผน ไม่รวมปันผล/FX · REVIEW และ runner ที่ยังเปิดไม่นับเป็นไม้ชนะ · Drawdown เป็น R สะสมต่อสัญญาณ ไม่ใช่ % พอร์ต · PF วัดเมื่อให้ความเสี่ยงเริ่มต้นไม้ละ 1R เท่ากัน</p><div className="signal-stats-grid">{['breakout','pullback'].filter(m=>mode==='all'||m===mode).map(m=><Stats key={m} title={MODE[m]} value={data.statisticsByMode[m]}/>)}</div><div className="signal-table-wrap"><table className="signal-table"><thead><tr><th>Symbol / แบบ</th><th>เผยแพร่ / เข้า</th><th>ราคาเข้า / ออก</th><th>ผลสุทธิ % / R</th><th>สถานะ / เหตุการณ์</th></tr></thead><tbody>{data.history.map(s=><tr key={s.id}><td><button className="signal-link" onClick={()=>select(s.symbol)}>{s.symbol}</button><small>{MODE[s.mode]}</small>{monitor&&<button type="button" onClick={()=>monitor.inspectTrade({ledger:"swing",market:s.market,tradeId:s.id})}>ดูไม้ / สถิติ ↗</button>}<small>คอม {n(s.plan.friction.assumptions.commissionPercent,4)}% / slip {n(s.plan.friction.assumptions.slippagePercent,4)}%</small></td><td>{at(s.publishedAt)}<small>{at(s.enteredAt)}</small></td><td>{n(s.entryPrice,4)}<small>{s.fills.map((f,i)=><span key={i}>{f.reason} {n(f.price,4)} ×{n(f.fraction*100,0)}%<br/></span>)}</small></td><td>{n(s.returnPercent)}%<small>{n(s.netR)} R</small></td><td>{STATE[s.status]}<small>{at(s.exitedAt)}</small></td></tr>)}</tbody></table>{!data.history.length&&<p>ยังไม่มีผลปิดจริงในระบบรุ่นนี้ จึงยังไม่มีสถิติให้สรุป</p>}</div><small>แสดงประวัติ 100 รายการล่าสุดในตัวกรอง · สถิติคำนวณจากรายการทั้งหมดของรุ่นกติกาและต้นทุนปัจจุบัน · ประวัติเก็บต้นทุนเดิม สถิติแสดงเฉพาะชุดต้นทุนปัจจุบัน</small></section>
   </>}
   {replay&&<section className="signal-replay"><header><h3>จำลอง {replay.symbol} จากช่วงที่มีข้อมูลจริง</h3><button onClick={()=>setReplay(null)}>ปิดผลจำลอง</button></header><p>{at(replay.period?.from)} – {at(replay.period?.to)} · D1 {replay.counts?.daily} / 4H {replay.counts?.fourHour} / 15m {replay.counts?.execution} แท่ง</p><p>ใช้กติกาสัญญาณรุ่นเดียวกัน ไม่มีการยืนยันว่าข้อมูลครบทุก session หรือทำนายผลในอนาคต กรณีข้อมูลขาด/ลำดับราคาไม่ชัดจะพักผล</p><div className="signal-stats-grid">{replay.variants?.map(v=><div key={v.mode}><Stats title={`${MODE[v.mode]} · ย้อนหลัง`} value={v.statistics}/><details><summary>ดูรายการจำลอง {v.records.length} แผน</summary>{v.records.map(s=><p key={s.id}>{at(s.publishedAt)} · {STATE[s.status]} · เข้า {n(s.entryPrice,4)} · {n(s.netR)} R</p>)}</details></div>)}</div><p>เปรียบเทียบกับผลเดินหน้าด้านบน โดยตรวจจำนวนไม้และช่วงเวลาแยกกัน ไม่รวมสถิติสองชุดเข้าด้วยกัน</p></section>}
  </>}

 </section>;
}

export default function SignalDesk(props){
 return <DaytradePanel market={props.marketId} onSelect={props.onSelect?symbol=>{const asset=ALL_ASSETS.find(a=>a.id===props.marketId&&a.symbol===symbol);if(asset)props.onSelect(asset);}:undefined} legacyScanner={props.marketId!=='tfex'?<LegacySignalDesk {...props}/>:null}/>;
}
