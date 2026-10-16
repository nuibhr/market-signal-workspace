'use client';
import {useEffect,useState} from 'react';
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
function Trades({rows,digits=4}){
  return <div className={styles.tableWrap}><table><thead><tr><th>สินทรัพย์ / ทิศทาง</th><th>แท่งสัญญาณ / เข้า</th><th>Entry</th><th>SL</th><th>TP</th><th>ออก / เวลา</th><th>ผล R / สถานะ</th></tr></thead><tbody>{rows.map(t=><tr key={t.id}><td><b>{t.symbol}</b><small>{t.side}</small></td><td>{time(t.signalTime)}<small>{time(t.entryTime)}</small></td><td>{n(t.plan?.entry,digits)}</td><td>{n(t.plan?.stop??t.stop,digits)}</td><td>{n(t.plan?.target,digits)}</td><td>{n(t.exit,digits)}<small>{time(t.exitTime)}</small></td><td className={t.netR>0?styles.positive:t.netR<0?styles.negative:''}>{Number.isFinite(t.netR)?`${n(t.netR)}R`:label[t.status]||t.status}<small>{reason[t.reason]||t.reason}</small></td></tr>)}</tbody></table>{!rows.length&&<p className={styles.empty}>ยังไม่มีไม้ในชุดนี้ ระบบจะไม่สร้างสถิติขึ้นแทนข้อมูล</p>}</div>;
}
export default function DaytradePanel({market='us',initialSymbol=null,onSelect,id='section-auto-pick'}){
  const [data,setData]=useState(null),[error,setError]=useState(null),[symbol,setSymbol]=useState(initialSymbol),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[page,setPage]=useState(1),[revision,setRevision]=useState(0),[tab,setTab]=useState('forward');
  useEffect(()=>{setSymbol(initialSymbol);setData(null);setPage(1);},[market,initialSymbol]);
  useEffect(()=>{
    let disposed=false,timer,controller;
    const poll=async()=>{
      controller=new AbortController();
      try{
        const params=new URLSearchParams({market,...(symbol?{symbol}:{})});
        const res=await fetch(`/api/daytrade?${params}`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
        const value=await res.json();
        if(!res.ok)throw Error(value.error||'SCANNER_UNAVAILABLE');
        if(!disposed){setData(value);setError(null);}
      }catch(e){if(!disposed){setError(e.message);setData(null);}}
      if(!disposed)timer=setTimeout(poll,15000);
    };poll();
    return()=>{disposed=true;clearTimeout(timer);controller?.abort();};
  },[market,symbol,revision]);
  const choose=s=>{setSymbol(s);onSelect?.(s);};
  const rows=(data?.universe||[]).filter(r=>(filter==='all'||filter==='signal'?filter!=='signal'||r.side:r.status===filter)&&`${r.symbol} ${r.name}`.toLowerCase().includes(query.toLowerCase()));
  const chosen=data?.selected,latestTrade=chosen?.forward.find(t=>['WAITING','OPEN'].includes(t.status));
  const plan=latestTrade?.plan||(latestTrade?{entry:latestTrade.trigger,stop:latestTrade.stop,target:null}:chosen?.replay?.open?.plan);
  return <section className={styles.panel} id={id} aria-label={`Daytrade scanner ${market}`}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>DAYTRADE / ONE PLAN</span><h2>ตามเทรนด์ · รอแท่งยืนยัน · จบเป็นไม้</h2><p>{market==='us'?'หุ้นและ ETF CFD · ราคา Vantage MT5':market==='forex'?'ทอง เงิน และ 7 คู่เงินหลัก':'สแกนจากแท่งราคาในตลาด'} · กติกาทดสอบ v1 · แผนเดียวต่อสินทรัพย์</p></div><button onClick={()=>setRevision(v=>v+1)}>อัปเดต</button></header>
    {['thai','dr','tfex'].includes(market)&&<p className={styles.caption}>ใช้แท่งปิดที่พร้อมตามนโยบายหน่วงข้อมูล 15 นาทีเดิม · สัญญาณเป็นราคาอ้างอิงตามเวลาที่ระบบรับได้</p>}
    <div className={styles.rules}><span>EMA20 / EMA50</span><span>ยืนยันด้วยแท่งปิด 15m</span><span>SL ตามโครงสร้าง ≥ 1.5 ATR</span><span>TP 2R · ถือไม่เกิน 16 แท่ง</span><span>ไม่เลื่อนคุ้มทุนก่อนเป้า</span></div>
    {error&&<div className={styles.notice} role="status">{error==='SIGN_IN_REQUIRED'?<>เข้าสู่ระบบ LINE เพื่อดูข้อมูลและประวัติของคุณ <Link href="/account">เข้าสู่ระบบ ↗</Link></>:error==='NODE_RECEIVER_REQUIRED'?'ตัวสแกนชุดนี้ต้องใช้ Node server ที่เก็บข้อมูลถาวร':'โหลดข้อมูลสแกนไม่ได้ กำลังลองใหม่'}</div>}
    {!data&&!error&&<p role="status">กำลังอ่านสถานะการสแกน…</p>}
    {data&&<>
      {data.marketCalendar?.closedReason&&<div className={styles.notice}>วันนี้ตลาดหยุด{data.marketCalendar.closedReason==='WEEKEND'?'สุดสัปดาห์':'ตามปฏิทินตลาด'} · ใช้ประวัติที่มีทดสอบย้อนหลัง รอแท่งใหม่เมื่อเปิดตลาด · <a href={market==='tfex'?'https://www.tfex.co.th/en/about/holiday':'https://www.set.or.th/th/about/event-calendar/holiday'} target="_blank" rel="noreferrer">ปฏิทินวันหยุด ↗</a></div>}
      {!data.signalAccess&&<div className={styles.notice}>ดูสถานะข้อมูลและกราฟได้ · จุดเข้า ผลสแกน และสถิติใช้สิทธิสมาชิกเดิม <Link href="/account">ตรวจสิทธิ / แจ้งเลขพอร์ต ↗</Link></div>}
      <div className={styles.coverage}><b>ทั้งหมด {data.coverage.total}</b><span>พร้อม {data.coverage.ready}</span><span>สด {data.coverage.fresh}</span><span>สะสมแท่ง {data.coverage.warmup}</span><span>รอรอบ {data.coverage.queued}</span><span>ข้อมูลไม่พร้อม {data.coverage.unavailable}</span><small>{data.source} · อัปเดต {time(data.generatedAt)}</small></div>
      {['us','forex'].includes(market)&&data.connection!=='connected'&&<div className={styles.notice}>MT5 {data.connection==='required'?'ยังไม่เชื่อมต่อ':data.connection==='expired'?'กุญแจหมดอายุ':'ไม่มี heartbeat ล่าสุด'} · <Link href="/forex">ตรวจการเชื่อมต่อ Vantage ↗</Link></div>}
      {data.mappingPending>0&&<div className={styles.notice}>มีหุ้น/ETF CFD อีก {data.mappingPending} รายการที่ยังยืนยันตลาด US ไม่ได้ รอข้อมูล Exchange/Path จาก EA รุ่นใหม่</div>}
      {market==='us'&&<p className={styles.caption}>ราคา: Vantage CFD · Volume หุ้นอ้างอิง: รอเชื่อม FMP ระหว่างวัน · สแกนเฉพาะช่วงหลัก US · ใช้ราคา ไม่ใช้ tick volume แทน volume หุ้น</p>}
      <div className={styles.toolbar}><input aria-label="ค้นหาสินทรัพย์เดย์เทรด" placeholder="ค้นหาสินทรัพย์…" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/><select aria-label="สถานะการสแกน" value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}>{[['all','ทั้งหมด'],['signal','ตรงเงื่อนไขล่าสุด'],['READY','พร้อมประเมิน'],['WARMUP','สะสมแท่ง'],['QUEUED','รอรอบข้อมูล'],['UNAVAILABLE','ข้อมูลไม่พร้อม']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
      <div className={styles.tableWrap}><table><thead><tr><th>สินทรัพย์</th><th>ราคาปิด</th><th>สถานะ</th><th>แท่ง 15m</th><th>แท่งล่าสุด</th><th>เหตุผล / ทิศทาง</th></tr></thead><tbody>{rows.slice((page-1)*15,page*15).map(r=><tr key={r.symbol} aria-selected={chosen?.symbol===r.symbol}><td><button className={styles.symbol} onClick={()=>choose(r.symbol)}>{r.symbol} ↗</button><small>{r.name}</small></td><td>{n(r.price,6)}</td><td>{label[r.status]}{r.stale?' · ราคาเก่า':''}</td><td>{r.bars||0} / 60</td><td>{time(r.latestBar)}</td><td>{r.side||reason[r.code]||(r.stale?'รอแท่งใหม่':'รอแท่งยืนยัน')}{r.status==='READY'&&!r.spreadKnown&&<small>ยังไม่ทราบ spread · ยังไม่ประกาศไม้</small>}</td></tr>)}</tbody></table>{!rows.length&&<p className={styles.empty}>{data.coverage.total?'ไม่พบรายการตามตัวกรอง':'รอรายการสินทรัพย์จากแหล่งข้อมูล ไม่มีราคาเดโมในตัวสแกน'}</p>}</div>
      <div className={styles.pager}><span>{rows.length} รายการ · หน้า {page} / {Math.max(1,Math.ceil(rows.length/15))}</span><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>ก่อนหน้า</button><button disabled={page*15>=rows.length} onClick={()=>setPage(p=>p+1)}>ถัดไป</button></div>
      {chosen&&<div className={styles.detail}><div className={styles.heading}><div><span className={styles.eyebrow}>PRICE / {chosen.symbol}</span><h3>{chosen.name}</h3></div><span>แท่งปิด 15m · เวลาในกราฟ UTC</span></div>
        <div className={styles.levels}>{[['Entry',plan?.entry],['Stop loss',plan?.stop],['Take profit',plan?.target]].map(([k,v])=><div key={k}><span>{k}</span><strong>{n(v,chosen.digits)}</strong></div>)}</div>
        <p className={styles.caption}>{latestTrade?'แผนที่ระบบบันทึกจริง':plan?'ระดับของไม้ทดสอบย้อนหลังที่ยังเปิด':'ยังไม่มีแผนเข้า ไม่ไล่ราคาเมื่อแท่งยืนยันยังไม่ครบ'}</p>
        {chosen.bars.length>0?<Mt5PriceChart sourceLabel={data.source} instrument={{broker_symbol:chosen.symbol,digits:chosen.digits,point:chosen.point}} bars={chosen.bars} chartStyle="candles" plan={plan}/>:<p className={styles.empty}>รอแท่งราคาเพื่อวาดกราฟ</p>}
      </div>}
      <nav className={styles.tabs} aria-label="ประเภทประวัติ"><button aria-pressed={tab==='forward'} onClick={()=>setTab('forward')}>ไม้ที่ระบบประกาศจริง</button><button aria-pressed={tab==='replay'} onClick={()=>setTab('replay')}>ทดสอบย้อนหลัง · {chosen?.symbol||'เลือกสินทรัพย์'}</button></nav>
      {tab==='forward'?<><h3 id="section-results">ประวัติสัญญาณที่บันทึกบนเซิร์ฟเวอร์</h3><Statistics summary={data.summary}/><Trades rows={data.forward}/><p className={styles.caption}>ราคาอ้างอิงตามกติกา ไม่ใช่คำสั่งหรือผลซื้อขายของลูกค้า · ไม่ย้อนสร้างไม้จริงจากแท่งอดีต</p></>:<><h3>ผลทดสอบย้อนหลัง · {chosen?.symbol}</h3><Statistics summary={chosen?.replay?.summary}/><p className={styles.caption}>ช่วงที่มีข้อมูล {time(chosen?.replay?.from)} – {time(chosen?.replay?.to)} · {chosen?.replay?.bars||0} แท่ง · สมมติ slip {chosen?.costs?.slippageBps??'—'} bps / ข้าง, fee {chosen?.costs?.feeBps??'—'} bps / ข้าง, spread {n(chosen?.costs?.spread,6)} {chosen?.spreadKnown?'(ค่าที่สังเกตล่าสุด ใช้เป็นสมมติฐานย้อนหลัง)':'(ยังไม่ทราบ ผลยังประเมินต้นทุนไม่ครบ)'} · แท่งขาดหรือแตะ TP/SL พร้อมกันพักเป็น REVIEW</p><Trades rows={chosen?.replay?.trades||[]} digits={chosen?.digits}/></>}
    </>}
  </section>;
}
