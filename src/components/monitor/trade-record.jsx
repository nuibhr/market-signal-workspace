'use client';
import {useEffect,useRef,useState} from 'react';
import {forwardEvents,MARKET_LABELS} from '../../monitor/view.mjs';
import {countedTrade,eventLabel,recordStatus} from '../../monitor/records.mjs';
const n=v=>Number.isFinite(v)?v.toLocaleString('th-TH',{maximumFractionDigits:6}):'—';
const at=v=>v?new Date(v).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'}):'—';
export function TradeRecordDetails({data,reference}) {
  const t=data.record,daytrade=reference.ledger==='daytrade',counted=countedTrade(t,reference.ledger);
  const events=daytrade?forwardEvents([t]):data.recordEvents;
  const stats=daytrade?data.summary:data.recordStatistics;
  return <>
    <h3>{t.symbol}</h3><p>{MARKET_LABELS[t.market]} · {daytrade?'Daytrade EMA20/50':`Swing ${t.mode}`} · {t.side||'LONG'}</p>
    <p className="monitor-record-status">{recordStatus[t.status]||t.status} · {counted?'นับในสถิติแล้ว 1 ไม้':'ยังไม่นับในสถิติไม้ปิด'}</p>
    <dl className="monitor-record-levels">
      <div><dt>Entry อ้างอิง</dt><dd>{n(daytrade?t.plan?.entry:t.entryPrice)}</dd><small>{at(daytrade?t.entryTime*1000:t.enteredAt)}</small></div>
      <div><dt>Stop ของแผน</dt><dd>{n(daytrade?t.plan?.stop??t.stop:t.plan?.stopLoss)}</dd></div>
      <div><dt>{daytrade?'Take profit':'TP1'}</dt><dd>{n(daytrade?t.plan?.target:t.plan?.minimumTarget)}</dd></div>
      <div><dt>ผลสุทธิของไม้</dt><dd>{counted?`${n(t.netR)} R`:'รอสรุปผล'}</dd><small>{daytrade&&t.exitTime?`Exit ${n(t.exit)} · `:''}{at(daytrade?t.exitTime*1000:t.exitedAt)}</small></div>
    </dl>
    {!daytrade&&t.fills?.length>0&&<p>ราคาออกแต่ละส่วน: {t.fills.map(f=>`${f.reason} ${n(f.price)} (${n(f.fraction*100)}%)`).join(' · ')}</p>}
    <h3>ลำดับเหตุการณ์ของไม้</h3>
    <ol className="monitor-record-timeline">{events.map(e=><li key={e.id}><b>{eventLabel(e)}</b><span>{n(e.price)} · {at(e.priceAt||e.createdAt)}</span></li>)}</ol>
    {t.status==='REVIEW'&&<p>เหตุผล: {t.reason||'ตรวจลำดับราคา / ข้อมูลขาดช่วง'} · พักผลออกจาก Win rate</p>}
    <h3>สถิติจากบันทึกชุดเดียวกัน</h3>
    <p>{daytrade?'Daytrade ทั้งตลาดนี้':`Swing ${t.mode} · ชุดต้นทุนของไม้นี้`} · กติกา {t.ruleVersion||data.rule}</p>
    <div className="monitor-record-stats">{[['ไม้ปิดครบ',stats?.closed],['Win rate',stats?.closed?`${n(stats.winRate)}%`:'—'],['เฉลี่ยต่อไม้',stats?.closed?`${n(stats.averageR??stats.expectancyR)} R`:'—'],['พักผล',stats?.review]].map(([label,value])=><div key={label}><small>{label}</small><strong>{value??'—'}</strong></div>)}</div>
    <p>หนึ่งไม้มีหลายแจ้งเตือนได้ แต่สถิตินับผลปิดครั้งเดียว · เป็นราคาอ้างอิงของระบบ</p>
    <details><summary>รหัสบันทึกไม้</summary><code className="monitor-record-id">{t.id}</code>{!daytrade&&<small>ชุดต้นทุน {t.profile}</small>}</details>
  </>;
}
export default function TradeRecordDialog({reference,onClose}) {
  const dialog=useRef(null),[result,setResult]=useState(null);
  useEffect(()=>{
    const element=dialog.current;const focus=document.activeElement;element.showModal();
    return()=>{element.close();if(focus?.isConnected)focus.focus();};
  },[]);
  useEffect(()=>{
    let disposed=false,timer;const controller=new AbortController();setResult(null);
    const load=async()=>{
      try{
        const params=new URLSearchParams({market:reference.market,record:reference.tradeId,...(reference.ledger==='daytrade'?{compact:'1'}:{})});
        const r=await fetch(`/api/${reference.ledger==='daytrade'?'daytrade':'signals'}?${params}`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])}),data=await r.json();
        if(!r.ok)throw Error(data.error||data.code||'LOAD_FAILED');
        if(!data.record)throw Error(data.signalAccess===false?'MEMBERSHIP_REQUIRED':'RECORD_NOT_FOUND');
        if(!disposed)setResult({data});
      }catch(e){if(!disposed)setResult({error:e.message});}
      if(!disposed)timer=setTimeout(load,15000);
    };load();return()=>{disposed=true;controller.abort();clearTimeout(timer);};
  },[reference.ledger,reference.market,reference.tradeId]);
  return <dialog ref={dialog} className="monitor-record-dialog" aria-labelledby="monitor-record-title" onCancel={onClose}>
    <header><h2 id="monitor-record-title">บันทึกไม้ / สถิติ</h2><button autoFocus onClick={onClose} type="button" aria-label="ปิดบันทึกไม้">ปิด ×</button></header>
    {!result?<p role="status">กำลังอ่านบันทึกจากเซิร์ฟเวอร์…</p>:result.error?<p role="alert">{['MEMBERSHIP_REQUIRED','SIGN_IN_REQUIRED'].includes(result.error)?'เข้าสู่ระบบสมาชิกเพื่อดูบันทึกนี้':result.error==='RECORD_NOT_FOUND'?'ไม่พบบันทึกในตลาดหรือบัญชีที่คุณเข้าถึงได้':'โหลดบันทึกไม่ได้ กำลังลองใหม่'} · ประวัติแจ้งเตือนยังอยู่</p>:<TradeRecordDetails data={result.data} reference={reference}/>}
  </dialog>;
}
