'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAdminResource } from './use-admin-resource.mjs';
import { advanceIncomingCursor } from '../community/updates.mjs';
const TEAMS={marketing:'บัญชีและแพ็กเกจ',analyst:'ข้อมูลและแผน'};
const STATUS={pending:'รับเรื่องแล้ว',review:'กำลังตรวจ',answered:'ตอบแล้ว',closed:'ปิดเรื่อง'};
const ERRORS={LOGIN_REQUIRED:'กรุณาเข้าสู่ระบบด้วย LINE อีกครั้ง',MEMBERSHIP_REQUIRED:'ห้องสมาชิกใช้ได้เมื่อมีสิทธิทดลองหรือรายเดือน',FORBIDDEN:'บัญชีนี้ไม่มีสิทธิทำรายการนี้',CHANNEL_NOT_FOUND:'ไม่พบหัวข้อ หรือสิทธิการเข้าถึงเปลี่ยนแล้ว',THREAD_CLOSED:'หัวข้อนี้ปิดแล้ว เปิดหัวข้อใหม่หากต้องการคุยต่อ',ROOM_LOCKED:'ห้องนี้พักการส่งข้อความชั่วคราว',COMMUNITY_CHANGED:'ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรชก่อนทำรายการ',OPERATION_CONFLICT:'รายการนี้เคยส่งด้วยข้อมูลอื่น กรุณารีเฟรชตรวจข้อความ',INVALID_COMMUNITY_INPUT:'ตรวจข้อความและความยาวอีกครั้ง',INVALID_CURSOR:'อ่านสถานะไม่สำเร็จ กรุณารีเฟรช',RATE_LIMITED:'ทำรายการถี่เกินไป กรุณารอสักครู่'};
const time=value=>new Date(value).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'});
function Pager({data,onPage}) {const count=Math.ceil((data?.total||0)/7)||1;return <div className="community-pager"><button className="account-secondary" disabled={!data||data.page<=1} onClick={()=>onPage(data.page-1)}>ก่อนหน้า</button><span>หน้า {data?.page||1} / {count}</span><button className="account-secondary" disabled={!data||data.page>=count} onClick={()=>onPage(data.page+1)}>ถัดไป</button></div>;}
function Notice({resource}) {return resource.error?<p className="account-alert error" role="alert">{ERRORS[resource.error]||'โหลดข้อมูลไม่สำเร็จ'} <button className="account-secondary" onClick={resource.reload}>ลองใหม่</button></p>:resource.loading&&!resource.data?<p role="status">กำลังโหลด…</p>:null;}
function usePolling(resource) {
  useEffect(()=>{const poll=()=>{if(document.visibilityState==='visible')resource.reload();};const timer=setInterval(poll,30000);document.addEventListener('visibilitychange',poll);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',poll);};},[resource.reload]);
}
export default function CommunityHub({team=false}) {
  const [page,setPage]=useState(1),[selected,setSelected]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[uncertain,setUncertain]=useState(false),[revision,setRevision]=useState(0);
  const pending=useRef(null),incoming=useRef(null);
  const overview=useAdminResource(`/api/community?team=${team?'1':'0'}&page=${page}`);
  usePolling(overview);
  useEffect(()=>{if(!overview.data)return;const update=advanceIncomingCursor(incoming.current,overview.data.incomingCursor);if(update.hasNew)setNotice('มีข้อความใหม่ในพื้นที่ของคุณ');incoming.current=update.cursor;},[overview.data]);
  const execute=useCallback(async task=>{
    setBusy(true);setError('');setNotice('');
    try {
      const response=await fetch('/api/community',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(task.body),cache:'no-store'});
      const payload=await response.json();
      if(!response.ok) {
        if(response.status>=500)throw Error('UNCERTAIN');
        setError(ERRORS[payload.error]||'ทำรายการไม่สำเร็จ กรุณารีเฟรช');pending.current=null;setUncertain(false);overview.reload();setRevision(n=>n+1);return false;
      }
      pending.current=null;setUncertain(false);overview.reload();setRevision(n=>n+1);setNotice(task.body.action==='send'||task.body.action==='create-thread'?'บันทึกข้อความแล้ว':'บันทึกรายการแล้ว');task.onSuccess?.(payload);return true;
    } catch {pending.current=task;setUncertain(true);setError('ยังไม่ได้รับคำยืนยันจากเซิร์ฟเวอร์ กดลองรายการเดิมอีกครั้งได้');return false;}
    finally {setBusy(false);}
  },[overview.reload]);
  const write=(body,onSuccess)=>{if(busy||uncertain)return Promise.resolve(false);return execute({body:{...body,operationId:crypto.randomUUID()},onSuccess});};
  const disabled=busy||uncertain;
  const data=overview.data;
  return <div className="community-hub">
    {notice&&<div className="community-notice" role="status"><span>{notice}</span><button className="account-secondary" onClick={()=>setNotice('')}>ปิด</button></div>}
    {error&&<div className="account-alert error" role="alert">{error}{uncertain&&<button className="account-secondary" disabled={busy} onClick={()=>execute(pending.current)}>ลองรายการเดิมอีกครั้ง</button>}</div>}
    <Notice resource={overview}/>
    {data&&<>
      {data.access.team&&<p><Link className="account-secondary" href={team?'/community':'/team'}>{team?'กลับพื้นที่ของฉัน':'เปิดกล่องงานทีม'}</Link></p>}
      <div className="community-layout"><aside className="community-sidebar">
        {!team&&<section className="account-card"><h2>ห้องสมาชิก</h2><p className="community-help">แลกเปลี่ยนอย่างสุภาพ ไม่แชร์คีย์หรือข้อมูลบัญชีส่วนตัว</p>{data.access.rooms?data.rooms.map(room=><button className={`community-channel${selected?.kind==='room'&&selected.id===room.id?' selected':''}`} key={room.id} onClick={()=>setSelected({kind:'room',id:room.id})} aria-pressed={selected?.kind==='room'&&selected.id===room.id}><strong>{room.name}{room.locked?' · พักการส่ง':''}</strong><small>{room.description}</small>{room.unread>0&&<span className="community-unread">ยังไม่อ่าน {room.unread}</span>}</button>):<p>ห้องเปิดให้สมาชิกที่มีสิทธิทดลองหรือรายเดือน <Link href="/account">ตรวจสิทธิของฉัน</Link></p>}</section>}
        <section className="account-card"><h2>{team?'กล่องงานที่รับผิดชอบ':'คุยส่วนตัวกับทีม'}</h2><p className="community-help">{team?'เฉพาะหัวข้อในทีมที่มีสิทธิ เข้าดูและตอบได้จากรายการนี้':'มีเพียงคุณ ทีมที่รับเรื่อง และแอดมินที่อ่านได้'}</p>{data.threads.map(thread=><button key={thread.id} className={`community-channel${selected?.kind==='thread'&&selected.id===thread.id?' selected':''}`} onClick={()=>setSelected({kind:'thread',id:thread.id})} aria-pressed={selected?.kind==='thread'&&selected.id===thread.id}><strong>{thread.subject}</strong><small>{team?`${thread.memberName} · `:''}{TEAMS[thread.team]} · {STATUS[thread.status]}</small>{thread.unread>0&&<span className="community-unread">ยังไม่อ่าน {thread.unread}</span>}</button>)}{!data.threads.length&&<p className="account-empty">ยังไม่มีหัวข้อ</p>}<Pager data={data} onPage={setPage}/></section>
        {!team&&<NewThread disabled={disabled} write={write} onCreated={id=>setSelected({kind:'thread',id})}/>}
      </aside><section className="community-conversation">{selected?<Channel key={`${selected.kind}:${selected.id}`} selected={selected} revision={revision} write={write} disabled={disabled} onRead={overview.reload}/>:<div className="account-card community-welcome"><h2>{team?'เลือกหัวข้อเพื่อดูแลสมาชิก':'เลือกห้อง หรือเปิดหัวข้อกับทีม'}</h2><p>ข้อความเก็บในระบบเดียวกับบัญชี LINE ของคุณ การแจ้งข้อความใหม่ทำงานขณะเปิดหน้านี้</p><p>ความเห็นในห้องสมาชิกไม่ได้เป็นคำสั่งซื้อขายหรือผลสแกนของ AutoPick</p></div>}</section></div>
      {team&&data.access.admin&&<CommunityAdmin revision={revision} write={write} disabled={disabled}/>}
    </>}
  </div>;
}
function NewThread({disabled,write,onCreated}) {
  const [team,setTeam]=useState('marketing'),[subject,setSubject]=useState(''),[body,setBody]=useState('');
  return <form className="account-card community-form" onSubmit={event=>{event.preventDefault();write({action:'create-thread',team,subject,body},payload=>{setSubject('');setBody('');onCreated(payload.threadId);});}}><h2>เปิดหัวข้อใหม่</h2><label>คุยเรื่อง<select value={team} disabled={disabled} onChange={e=>setTeam(e.target.value)}>{Object.entries(TEAMS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>หัวข้อ<input value={subject} maxLength={100} required disabled={disabled} onChange={e=>setSubject(e.target.value)}/></label><label>ข้อความ<textarea value={body} maxLength={2000} required disabled={disabled} onChange={e=>setBody(e.target.value)}/></label><p className="community-help">ไม่ส่งเลขพอร์ตเต็ม รหัสผ่าน หรือคีย์ API เลขยาวจะถูกปิดบางส่วนก่อนบันทึก</p><button className="account-primary" disabled={disabled||!body.trim()||!subject.trim()}>ส่งหัวข้อให้ทีม</button></form>;
}
function Channel({selected,revision,write,disabled,onRead}) {
  const [page,setPage]=useState(1),[body,setBody]=useState(''),[report,setReport]=useState(null),[reason,setReason]=useState(''),[readError,setReadError]=useState('');
  const resource=useAdminResource(`/api/community?view=channel&kind=${selected.kind}&id=${encodeURIComponent(selected.id)}&page=${page}&revision=${revision}`);
  const acknowledged=useRef(0),data=resource.data;
  usePolling(resource);
  useEffect(()=>{
    if(!data||document.hidden)return;
    const lastSeq=Math.max(0,...data.messages.map(m=>m.seq));if(lastSeq<=acknowledged.current)return;
    let cancelled=false;acknowledged.current=lastSeq;
    fetch('/api/community',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'read',kind:selected.kind,channelId:selected.id,lastSeq,operationId:crypto.randomUUID()}),cache:'no-store'}).then(r=>{if(!r.ok)throw Error();if(!cancelled){setReadError('');onRead();}}).catch(()=>{acknowledged.current=0;if(!cancelled)setReadError('บันทึกสถานะอ่านไม่สำเร็จ จะลองใหม่เมื่อรีเฟรช');});
    return()=>{cancelled=true;};
  },[data,selected.kind,selected.id,onRead]);
  const closed=selected.kind==='thread'?data?.channel.status==='closed':data?.channel.locked&&!data.admin;
  return <div className="account-card"><Notice resource={resource}/>{data&&<>
    <header className="community-heading"><div><h2>{data.channel.name||data.channel.subject}</h2>{selected.kind==='thread'&&<p>{TEAMS[data.channel.team]} · {STATUS[data.channel.status]}</p>}</div><button className="account-secondary" disabled={resource.loading} onClick={resource.reload}>รีเฟรช</button></header>
    {readError&&<p role="status" className="community-help">{readError}</p>}
    {data.canManage&&<div className="community-controls"><label>สถานะ<select disabled={disabled} value={data.channel.status} onChange={e=>write({action:'thread-state',threadId:selected.id,version:data.channel.version,status:e.target.value})}>{Object.entries(STATUS).map(([id,name])=><option value={id} key={id}>{name}</option>)}</select></label><label>ส่งต่อทีม<select disabled={disabled} value={data.channel.team} onChange={e=>write({action:'transfer',threadId:selected.id,version:data.channel.version,team:e.target.value})}>{Object.entries(TEAMS).map(([id,name])=><option value={id} key={id}>{name}</option>)}</select></label></div>}
    {selected.kind==='room'&&data.admin&&<button className="account-secondary" disabled={disabled} onClick={()=>write({action:'lock-room',roomId:selected.id,locked:!data.channel.locked})}>{data.channel.locked?'เปิดให้ส่งข้อความ':'พักการส่งในห้องนี้'}</button>}
    <div className="community-messages">{[...data.messages].reverse().map(message=><article key={message.id} className={message.own?'own':''}><div className="community-message-meta"><strong>{message.author}{message.fromTeam&&!message.hidden?' · ทีมงาน':''}</strong><time dateTime={message.createdAt}>{time(message.createdAt)}</time></div><p>{message.hidden?'ข้อความนี้ถูกผู้ดูแลซ่อน':message.body}</p>{!message.hidden&&<div className="community-message-actions"><button className="account-secondary" disabled={disabled} onClick={()=>{setReport(message.id);setReason('');}}>รายงาน</button>{data.admin&&<button className="account-secondary" disabled={disabled} onClick={()=>write({action:'moderate',messageId:message.id,hidden:true})}>ซ่อนข้อความ</button>}</div>}{message.hidden&&data.admin&&<button className="account-secondary" disabled={disabled} onClick={()=>write({action:'moderate',messageId:message.id,hidden:false})}>คืนข้อความ</button>}</article>)}</div>{!data.messages.length&&<p className="account-empty">ยังไม่มีข้อความ เริ่มแลกเปลี่ยนได้ที่นี่</p>}<Pager data={data} onPage={setPage}/>
    {report&&<form className="community-form community-report" onSubmit={e=>{e.preventDefault();write({action:'report',messageId:report,reason},()=>{setReport(null);setReason('');});}}><label>เหตุผลที่รายงาน<textarea required maxLength={300} value={reason} disabled={disabled} onChange={e=>setReason(e.target.value)}/></label><div><button className="account-primary" disabled={disabled||!reason.trim()}>ส่งรายงานให้แอดมิน</button> <button className="account-secondary" type="button" onClick={()=>setReport(null)}>ยกเลิก</button></div></form>}
    <form className="community-form community-compose" onSubmit={e=>{e.preventDefault();write({action:'send',kind:selected.kind,channelId:selected.id,body},()=>{setBody('');setPage(1);});}}><label>{closed?'ช่องนี้พักการส่งข้อความ':'ข้อความใหม่'}<textarea maxLength={2000} required disabled={disabled||closed} value={body} onChange={e=>setBody(e.target.value)} placeholder="พิมพ์ข้อความ ไม่แชร์เลขพอร์ตหรือคีย์"/></label><div className="community-compose-foot"><small>{body.length}/2000 · ไม่รองรับไฟล์แนบ</small><button className="account-primary" disabled={disabled||closed||!body.trim()}>ส่งข้อความ</button></div></form>
  </>}</div>;
}
function CommunityAdmin({revision,write,disabled}) {
  const [page,setPage]=useState(1),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[member,setMember]=useState(''),[role,setRole]=useState('marketing');
  const resource=useAdminResource(`/api/community?view=admin&page=${page}&revision=${revision}`);
  const members=useAdminResource(`/api/admin/memberships?q=${encodeURIComponent(search)}`,!!search);
  usePolling(resource);
  return <section className="account-card community-admin"><h2>ดูแลชุมชนและสิทธิทีม</h2><Notice resource={resource}/>{resource.data&&<>
    <div className="community-admin-grid"><div><h3>รายงานรอตรวจ</h3>{resource.data.reports.map(report=><article className="community-report-item" key={report.id}><p>{report.body}</p><small>{report.reason} · ผู้รายงาน {report.reporter}</small><div><button className="account-secondary" disabled={disabled} onClick={()=>write({action:'moderate',messageId:report.messageId,hidden:!report.hidden})}>{report.hidden?'คืนข้อความ':'ซ่อนข้อความ'}</button> <button className="account-secondary" disabled={disabled} onClick={()=>write({action:'resolve-report',reportId:report.id})}>ตรวจเสร็จแล้ว</button></div></article>)}{!resource.data.reports.length&&<p className="account-empty">ไม่มีรายงานรอตรวจ</p>}<Pager data={resource.data} onPage={setPage}/></div>
    <div><h3>ผู้รับผิดชอบทีม</h3><p className="community-help">บทบาททีมให้อ่านและตอบ inbox ของฝ่ายนั้น ไม่ให้สิทธิหลังบ้านสมาชิก</p>{resource.data.staff.map(person=><div className="community-staff" key={`${person.memberId}:${person.role}`}><span>{person.name} · {TEAMS[person.role]}</span><button className="account-secondary" disabled={disabled} onClick={()=>write({action:'role',memberId:person.memberId,role:person.role,enabled:false})}>ถอนบทบาท</button></div>)}<form className="community-form" onSubmit={e=>{e.preventDefault();setSearch(query.trim());setMember('');}}><label>ค้นหาสมาชิก LINE<input maxLength={80} value={query} onChange={e=>setQuery(e.target.value)} required/></label><button className="account-secondary">ค้นหา</button></form>{search&&<><Notice resource={members}/><form className="community-form" onSubmit={e=>{e.preventDefault();write({action:'role',memberId:member,role,enabled:true},()=>setMember(''));}}><label>สมาชิก<select value={member} disabled={disabled} onChange={e=>setMember(e.target.value)} required><option value="">เลือกสมาชิก</option>{members.data?.members.map(person=><option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label><label>ฝ่าย<select value={role} disabled={disabled} onChange={e=>setRole(e.target.value)}>{Object.entries(TEAMS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><button className="account-primary" disabled={disabled||!member}>เพิ่มบทบาท</button></form></>}</div></div>
  </>}</section>;
}
