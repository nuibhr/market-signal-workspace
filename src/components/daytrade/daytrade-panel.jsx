'use client';
import {useEffect,useRef,useState} from 'react';
import {useMonitor,AlertHistory} from '../monitor/monitor-provider.jsx';
import MarketTable from '../monitor/market-table.jsx';
import OpportunityCards from '../monitor/opportunity-cards.jsx';
import InstrumentLogo from '../monitor/instrument-logo.jsx';
import {topOpportunities} from '../../daytrade/ranking.mjs';
import {monitorRow,filterRows,MARKET_LABELS} from '../../monitor/view.mjs';
import Link from 'next/link';
import Mt5PriceChart from '../forex/mt5-price-chart.jsx';
import styles from './daytrade.module.css';

const n=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
const time=v=>v?new Date(typeof v==='number'?v*1000:v).toLocaleString('th-TH',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}):'—';
const label={READY:'พร้อมประเมิน',WARMUP:'สะสมแท่ง',QUEUED:'รอรอบข้อมูล',UNAVAILABLE:'ข้อมูลไม่พร้อม',OPEN:'ติดตามไม้',WAITING:'รอแท่งเข้า',CLOSED:'ปิดแล้ว',REVIEW:'พักผล / ข้อมูลไม่พอ',EXPIRED:'หมดอายุ'};
const reason={BROKER_CLOSE_ONLY:'โบรกเกอร์อนุญาตเฉพาะปิดสถานะ ไม่เปิดไม้ใหม่',BROKER_TRADE_DISABLED:'โบรกเกอร์ปิดการซื้อขายสัญญานี้',BROKER_TRADE_MODE_UNKNOWN:'ยังไม่ทราบสิทธิซื้อขายของสัญญา',WAITING_COLLECTOR:'รอตัวเก็บข้อมูล',NEED_60_CLOSED_15M_BARS:'ต้องมีแท่งปิด 15m อย่างน้อย 60 แท่ง',SOURCE_UNAVAILABLE:'แหล่งข้อมูลยังไม่ตอบ',SOURCE_NOT_CONFIGURED:'ยังไม่ตั้งค่าแหล่งข้อมูล',DISPLAY_RIGHTS_NOT_CONFIRMED:'ยังไม่เปิดสิทธิ์ข้อมูล',RATE_LIMITED:'พักตามโควตา API',NO_CLOSED_BARS:'ยังไม่มีแท่งปิด',DATA_GAP:'แท่งขาดช่วง',AMBIGUOUS_TP_SL:'แท่งเดียวแตะ TP และ SL',SL:'Stop loss',SL_GAP:'Gap ผ่าน Stop',TP:'Take profit',TIME_EXIT:'ครบเวลาถือ',SESSION_END:'จบรอบซื้อขาย',SESSION_CLOSE_MISSING:'ขาดแท่งปิดรอบ'};
function Statistics({summary}){
  return <div className={styles.stats}>{[['ไม้ปิด',n(summary?.closed,0)],['Win rate',summary?.closed?`${n(summary.winRate)}%`:'—'],['ผลรวม',summary?.closed?`${n(summary.netR)} R`:'—'],['Profit factor',n(summary?.profitFactor)],['Drawdown',summary?.closed?`${n(summary.maxDrawdownR)} R`:'—'],['พักผล',n(summary?.review,0)]].map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>;
}
function Trades({rows,digits=4,onInspect}){
  return <div className={styles.tableWrap}><table><thead><tr><th>สินทรัพย์ / ทิศทาง</th><th>แท่งสัญญาณ / เข้า</th><th>Entry</th><th>SL</th><th>TP</th><th>ออก / เวลา</th><th>ผล R / สถานะ</th></tr></thead><tbody>{rows.map(t=><tr key={t.id}><td><b>{t.symbol}</b><small>{t.side}</small>{onInspect&&<button type="button" onClick={()=>onInspect({ledger:"daytrade",market:t.market,tradeId:t.id})}>ดูไม้ / สถิติ ↗</button>}</td><td>{time(t.signalTime)}<small>{time(t.entryTime)}</small></td><td>{n(t.plan?.entry,digits)}</td><td>{n(t.plan?.stop??t.stop,digits)}</td><td>{n(t.plan?.target,digits)}</td><td>{n(t.exit,digits)}<small>{time(t.exitTime)}</small></td><td className={t.netR>0?styles.positive:t.netR<0?styles.negative:''}>{Number.isFinite(t.netR)?`${n(t.netR)}R`:label[t.status]||t.status}<small>{reason[t.reason]||t.reason}</small></td></tr>)}</tbody></table>{!rows.length&&<p className={styles.empty}>ยังไม่มีไม้ในชุดนี้ ระบบจะไม่สร้างสถิติขึ้นแทนข้อมูล</p>}</div>;
}
export default function DaytradePanel({market='us',initialSymbol=null,onSelect,id='section-auto-pick',legacyScanner=null}){
  const monitor=useMonitor();
  const [selectedMarket,setSelectedMarket]=useState(market),[group,setGroup]=useState(market),[highlights,setHighlights]=useState(new Set());
  const priorMet=useRef(null);
  const [view,setView]=useState('mvp'),[activeSection,setActiveSection]=useState('picks');
  const navigate=section=>{setView('mvp');setActiveSection(section);requestAnimationFrame(()=>{const target=document.getElementById(`${id}-${section}`);target?.scrollIntoView({block:'start'});target?.focus({preventScroll:true});});};
  const [data,setData]=useState(null),[error,setError]=useState(null),[symbol,setSymbol]=useState(initialSymbol),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[sortBy,setSortBy]=useState('default'),[page,setPage]=useState(1),[revision,setRevision]=useState(0),[tab,setTab]=useState('forward');
  useEffect(()=>{setSymbol(initialSymbol);setSelectedMarket(market);setGroup(market);setData(null);setPage(1);},[market,initialSymbol]);
  useEffect(()=>{
    let disposed=false,timer,controller;
    const poll=async()=>{
      controller=new AbortController();
      try{
        const params=new URLSearchParams({market:selectedMarket,...(symbol?{symbol}:{})});
        const res=await fetch(`/api/daytrade?${params}`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
        const value=await res.json();
        if(!res.ok)throw Error(value.error||'SCANNER_UNAVAILABLE');
        if(!disposed){setData(value);setError(null);}
      }catch(e){if(!disposed){setError(e.message);setData(null);}}
      if(!disposed)timer=setTimeout(poll,15000);
    };poll();
    return()=>{disposed=true;clearTimeout(timer);controller?.abort();};
  },[selectedMarket,symbol,revision]);
  const choose=r=>{setSelectedMarket(r.market);setSymbol(r.symbol);if(r.market===market)onSelect?.(r.symbol);};
  const source=Object.keys(monitor?.snapshots||{}).length?monitor.snapshots:data?{[selectedMarket]:data}:{};
  const allRows=Object.entries(source).flatMap(([id,d])=>d.universe.map(r=>monitorRow(r,id,d.connection,monitor?.now||Date.now())));
  const picks=topOpportunities(allRows,market);
  useEffect(()=>{if(!symbol&&picks[0])setSymbol(picks[0].symbol);},[symbol,picks[0]?.symbol]);
  const rows=filterRows(allRows,{query,group,status:filter,sortBy});
  const relevant=filterRows(allRows,{group});
  const pageCount=Math.max(1,Math.ceil(rows.length/25)),currentPage=Math.min(page,pageCount);
  useEffect(()=>{
    const current=new Set(Object.entries(monitor?.snapshots||{}).flatMap(([id,d])=>d.universe.filter(r=>monitorRow(r,id,d.connection).met).map(r=>`${id}:${r.symbol}`)));
    const added=priorMet.current?new Set([...current].filter(k=>!priorMet.current.has(k))):new Set();priorMet.current=current;
    setHighlights(added);if(added.size){const t=setTimeout(()=>setHighlights(new Set()),20000);return()=>clearTimeout(t);}
  },[monitor?.snapshots]);
  const chosen=data?.market===selectedMarket&&(!symbol||data?.selected?.symbol===symbol)?data?.selected:null,latestTrade=chosen?.forward.find(t=>['WAITING','OPEN'].includes(t.status));
  const plan=latestTrade?.plan||(latestTrade?{entry:latestTrade.trigger,stop:latestTrade.stop,target:null}:chosen?.replay?.open?.plan);
  return <section className={styles.panel} id={id} aria-label={`Daytrade scanner ${market}`}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>MARKET MVP / {MARKET_LABELS[market]}</span><h2>ตัวเด่นผ่านเกณฑ์สแกน</h2><p>สูงสุด 5 ตัว · เรียงคะแนนคุณภาพเทคนิค 1–100 · แท่งปิด 15m</p></div><button onClick={()=>{setRevision(v=>v+1);monitor?.refresh();}}>อัปเดต</button></header>
    <nav className={styles.dock} aria-label="เครื่องมือสแกน">
      {[['picks','◎ MVP · Top 5'],['chart','▥ กราฟและแผน'],['history','◷ สถิติ / ประวัติ'],['prices','≡ ติดตามราคา']].map(([key,title])=><button key={key} onClick={()=>navigate(key)} aria-pressed={view==='mvp'&&key===activeSection}>{title}</button>)}
      {legacyScanner&&<button onClick={()=>setView(v=>v==='legacy'?'mvp':'legacy')} aria-pressed={view==='legacy'}>Swing รุ่นเดิม ↗</button>}
    </nav>
    {view==='legacy'?legacyScanner:<>
    {error&&<div className={styles.notice} role="status">{error==='SIGN_IN_REQUIRED'?<>เข้าสู่ระบบ LINE เพื่อดูข้อมูลและประวัติของคุณ <Link href="/account">เข้าสู่ระบบ ↗</Link></>:error==='NODE_RECEIVER_REQUIRED'?'ตัวสแกนชุดนี้ต้องใช้ Node server ที่เก็บข้อมูลถาวร':'โหลดข้อมูลสแกนไม่ได้ กำลังลองใหม่'}</div>}
    {!data&&!error&&<p role="status">กำลังอ่านสถานะการสแกน…</p>}
    <section id={`${id}-picks`} tabIndex={-1} className={styles.anchor} aria-label="ผลสแกนสูงสุด 5 ตัว">
      <div className={styles.shortlistMeta}><span>{MARKET_LABELS[market]}</span><span>{picks.length} / 5 ตัวผ่านเกณฑ์ล่าสุด</span></div>
      <OpportunityCards rows={picks} selected={{symbol,market:selectedMarket}} onSelect={r=>{choose(r);navigate('chart');}} loading={!data&&!error&&!allRows.length} locked={error==='SIGN_IN_REQUIRED'||Boolean(data&&!data.signalAccess)} unavailable={Boolean(error)||allRows.filter(r=>r.market===market).every(r=>r.abnormal)}/>
      <p className={styles.caption}>คะแนนใช้จัดอันดับตัวที่ผ่านกติกา ไม่ใช่โอกาสชนะ · ราคาหุ้นไทย / DR / TFEX หน่วงตามแหล่งข้อมูล</p>
    </section>
    {data&&<>
      {data.marketCalendar?.closedReason&&<div className={styles.notice}>วันนี้ตลาดหยุด{data.marketCalendar.closedReason==='WEEKEND'?'สุดสัปดาห์':'ตามปฏิทินตลาด'} · ใช้ประวัติที่มีทดสอบย้อนหลัง รอแท่งใหม่เมื่อเปิดตลาด · <a href={data.market==='tfex'?'https://www.tfex.co.th/en/about/holiday':'https://www.set.or.th/th/about/event-calendar/holiday'} target="_blank" rel="noreferrer">ปฏิทินวันหยุด ↗</a></div>}
      {!data.signalAccess&&<div className={styles.notice}>ดูสถานะข้อมูลและกราฟได้ · จุดเข้า ผลสแกน และสถิติใช้สิทธิสมาชิกเดิม <Link href="/account">ตรวจสิทธิ / แจ้งเลขพอร์ต ↗</Link></div>}
      <section id={`${id}-chart`} tabIndex={-1} className={styles.anchor}>{chosen?<div className={styles.detail}><div className={styles.heading}><div><span className={styles.eyebrow}>PRICE / {chosen.symbol} · {MARKET_LABELS[data.market]}</span><div className={styles.chartIdentity}><InstrumentLogo asset={{...chosen,market:data.market}}/><h3>{chosen.name}</h3></div></div><span>แท่งปิด 15m · เวลาในกราฟ UTC</span></div>
        <div className={styles.levels}>{[['Entry',plan?.entry],['Stop loss',plan?.stop],['Take profit',plan?.target]].map(([k,v])=><div key={k}><span>{k}</span><strong>{n(v,chosen.digits)}</strong></div>)}</div>
        <p className={styles.caption}>{latestTrade?'แผนที่ระบบบันทึกจริง':plan?'ระดับของไม้ทดสอบย้อนหลังที่ยังเปิด':'ยังไม่มีแผนเข้า ไม่ไล่ราคาเมื่อแท่งยืนยันยังไม่ครบ'}</p>
        {chosen.bars.length>0?<Mt5PriceChart sourceLabel={data.source} instrument={{broker_symbol:chosen.symbol,digits:chosen.digits,point:chosen.point}} bars={chosen.bars} chartStyle="candles" plan={plan}/>:<p className={styles.empty}>รอแท่งราคาเพื่อวาดกราฟ</p>}
      </div>:<p className={styles.empty}>เลือกสินทรัพย์จาก Top 5 หรือตารางติดตามราคาเพื่อดูกราฟ</p>}</section>
      <section id={`${id}-history`} tabIndex={-1} className={styles.anchor}>
      <nav className={styles.tabs} aria-label="ประเภทประวัติ"><button aria-pressed={tab==='forward'} onClick={()=>setTab('forward')}>ไม้ที่ระบบประกาศจริง</button><button aria-pressed={tab==='replay'} onClick={()=>setTab('replay')}>ทดสอบย้อนหลัง · {chosen?.symbol||'เลือกสินทรัพย์'}</button></nav>
      {tab==='forward'?<><h3 id="section-results">ประวัติสัญญาณที่บันทึกบนเซิร์ฟเวอร์</h3><Statistics summary={data.summary}/><Trades rows={data.forward} onInspect={monitor?.inspectTrade}/><p className={styles.caption}>ราคาอ้างอิงตามกติกา ไม่ใช่คำสั่งหรือผลซื้อขายของลูกค้า · ไม่ย้อนสร้างไม้จริงจากแท่งอดีต</p></>:<><h3>ผลทดสอบย้อนหลัง · {chosen?.symbol}</h3><Statistics summary={chosen?.replay?.summary}/><p className={styles.caption}>ช่วงที่มีข้อมูล {time(chosen?.replay?.from)} – {time(chosen?.replay?.to)} · {chosen?.replay?.bars||0} แท่ง · สมมติ slip {chosen?.costs?.slippageBps??'—'} bps / ข้าง, fee {chosen?.costs?.feeBps??'—'} bps / ข้าง, spread {n(chosen?.costs?.spread,6)} {chosen?.spreadKnown?'(ค่าที่สังเกตล่าสุด ใช้เป็นสมมติฐานย้อนหลัง)':'(ยังไม่ทราบ ผลยังประเมินต้นทุนไม่ครบ)'} · แท่งขาดหรือแตะ TP/SL พร้อมกันพักเป็น REVIEW</p><Trades rows={chosen?.replay?.trades||[]} digits={chosen?.digits}/></>}
      </section>
      <section id={`${id}-prices`} tabIndex={-1} className={styles.priceSection} aria-label="ติดตามราคาและเงื่อนไข">
        <div className={styles.heading}><div><span className={styles.eyebrow}>ALL INSTRUMENTS</span><h3>ติดตามราคาและเงื่อนไข</h3></div><span className={styles.caption}>ค้นหา / เลือกสินทรัพย์ทั้งหมด</span></div>
      <div className={styles.coverage}><b>ติดตาม {relevant.length}</b><span className={styles.positive}>เข้าเงื่อนไข {relevant.filter(r=>r.met).length}</span><span>ใกล้เข้า: ยังไม่มีเกณฑ์เดิม</span><span>ตรวจไม่ได้ {relevant.filter(r=>r.abnormal).length}</span><small>เว็บอ่านสถานะ {time(data.generatedAt)} · Polling 15s</small></div>
      {Object.keys(monitor?.errors||{}).filter(k=>!k.startsWith('swing-')).length>0&&<p className={styles.caption} role="status">บางตลาดโหลดไม่ได้ รายการตลาดนั้นจะไม่ใช้ข้อมูลค้างแสดงเงื่อนไข · ลองอัปเดตอีกครั้ง</p>}
      {['us','forex'].includes(data.market)&&data.connection!=='connected'&&<div className={styles.notice}>MT5 {data.connection==='required'?'ยังไม่เชื่อมต่อ':data.connection==='expired'?'กุญแจหมดอายุ':'ไม่มี heartbeat ล่าสุด'} · <Link href="/forex">ตรวจการเชื่อมต่อ Vantage ↗</Link></div>}
      {data.mappingPending>0&&<div className={styles.notice}>มีหุ้น/ETF CFD อีก {data.mappingPending} รายการที่ยังยืนยันตลาด US ไม่ได้ รอข้อมูล Exchange/Path จาก EA รุ่นใหม่</div>}
      {data.market==='us'&&<div className={styles.notice}>
        <strong>US EOD &amp; Technical Drill-down</strong>
        <p>สัญญาณเดย์เทรดอ้างอิงราคาปิดแท่ง 15m จาก Vantage CFD · ข้อมูลสรุปและตัวชี้วัดรายวันใช้ FMP EOD ภายใต้สิทธิ์การแสดงผล · ETF CFD เป็นการวิเคราะห์เพื่อการศึกษาค้นคว้า (Research-only) · ไม่มีข้อมูล Intraday Order Book หรือ Level 2</p>
      </div>}
      {data.market==='us'&&<p className={styles.caption}>ราคา: Vantage CFD · Volume หุ้นอ้างอิง: รอเชื่อม FMP ระหว่างวัน · สแกนเฉพาะช่วงหลัก US · ใช้ราคา ไม่ใช้ tick volume แทน volume หุ้น</p>}
    <div className={styles.rules}><span>EMA20 / EMA50</span><span>ยืนยันด้วยแท่งปิด 15m</span><span>SL ตามโครงสร้าง ≥ 1.5 ATR</span><span>TP 2R · ถือไม่เกิน 16 แท่ง</span><span>ไม่เลื่อนคุ้มทุนก่อนเป้า</span></div>
      <div className={styles.toolbar}>
        <label>ค้นหา<input aria-label="ค้นหาสินทรัพย์เดย์เทรด" placeholder="NTES, symbol หรือชื่อสินทรัพย์…" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label>
        <label>กลุ่มสินทรัพย์<select aria-label="กลุ่มสินทรัพย์" value={group} onChange={e=>{setGroup(e.target.value);setPage(1);}}><option value="all">ทุกตลาด</option>{Object.entries(MARKET_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}<option value="etf">ETF CFDs</option></select></label>
        <label>สถานะ<select aria-label="สถานะการสแกน" value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}>{[['all','ทั้งหมด'],['met','เข้าเงื่อนไขแล้ว'],['near','ใกล้ถึงราคาเข้า'],['waiting','รอเงื่อนไข'],['abnormal','ข้อมูลผิดปกติ']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label>เรียงตาม<select aria-label="เรียงลำดับ" value={sortBy} onChange={e=>{setSortBy(e.target.value);setPage(1);}}>{[['default','ค่าเริ่มต้น (เข้าเงื่อนไขก่อน)'],['score_desc','คะแนนเทคนิคสูงสุด'],['symbol_asc','ชื่อย่อ A–Z'],['change_desc','% เปลี่ยนแปลง'],['atr_desc','ความผันผวน ATR']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      </div>
      {filter==='near'&&<p className={styles.caption}>กติกาเดิมไม่มีระยะ “ใกล้เข้า” จึงยังไม่จัดรายการเข้ากลุ่มนี้ ดูระยะห่างจริงในตารางได้</p>}
      <p className={styles.caption}>Bid quote คือราคาที่ broker ส่งล่าสุด · ปิดแท่ง 15m คือราคาประเมินเดิม · ราคาเข้าเป็นแผนของระบบ แก้เองไม่ได้ตามสิทธิเดิม</p>
      <MarketTable rows={rows.slice((currentPage-1)*25,currentPage*25)} selected={{symbol:chosen?.symbol,market:selectedMarket}} highlights={highlights} choose={r=>{choose(r);navigate('chart');}} reason={reason} emptyMessage={filter==='near'?'ยังไม่มีเกณฑ์ใกล้เข้าที่กำหนดไว้ในกลยุทธ์':allRows.length?'ไม่พบรายการตามตัวกรอง':'รอรายการจริงจากแหล่งข้อมูล'}/>
      <div className={styles.pager}><span>{rows.length} รายการ · หน้า {currentPage} / {pageCount} · เข้าเงื่อนไขก่อน</span><button disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)}>ก่อนหน้า</button><button disabled={currentPage>=pageCount} onClick={()=>setPage(currentPage+1)}>ถัดไป</button></div>
      <p className={styles.caption}>โลโก้บริษัท: <a href="https://site.financialmodelingprep.com/developer/docs/company-image-api" target="_blank" rel="noreferrer">FMP</a> · DR ใช้โลโก้บริษัทอ้างอิงที่ยืนยันได้ · ไม่มีภาพใช้ชื่อย่อ · FX / Futures ใช้สัญลักษณ์ประเภทสินทรัพย์</p>
      </section>
    </>}
    <AlertHistory/>
    </>}
  </section>;
}
