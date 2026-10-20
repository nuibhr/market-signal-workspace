'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import useDraggableMascot from './use-draggable-mascot.jsx';
import NugaomMascot from './nugaom-mascot.jsx';
import { Coins, ExternalLink, MessageCircle, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { createAssistantWriter } from '../membership/assistant-client.mjs';

const ERRORS = {
  AI_QUOTA_EXHAUSTED: 'วันนี้ใช้โควตาถาม AI ครบแล้ว รอเวลารีเซ็ตหรือเลือกแพ็กเกจใหม่',
  LOGIN_REQUIRED: 'เข้าสู่ระบบ LINE ก่อนถามน้องนักออม AI',
  MEMBERSHIP_REQUIRED: 'สิทธิทดลองหรือสมาชิกหมดอายุแล้ว กรุณาต่ออายุ',
  BIGDATA_NOT_CONFIGURED: 'กำลังรอเชื่อมคีย์ Bigdata API',
  INSUFFICIENT_AI_CREDITS: 'วันนี้ใช้คำถามฟรีครบแล้ว และเครดิตยังไม่พอ',
  BIGDATA_AUTH_FAILED: 'คีย์ Bigdata ใช้ไม่ได้ กรุณาให้ผู้ดูแลตรวจสอบ',
  BIGDATA_RATE_LIMIT: 'Bigdata จำกัดคำขอชั่วคราว ลองใหม่อีกครั้ง',
  BIGDATA_TIMEOUT: 'การค้นข้อมูลใช้เวลานานเกินไป กรุณาตรวจผลคำถามก่อนส่งใหม่',
  BIGDATA_UNGROUNDED: 'ยังไม่พบแหล่งอ้างอิงสำหรับคำถามนี้ ลองระบุบริษัทหรือช่วงเวลาให้ชัดขึ้น',
  QUESTION_IN_PROGRESS: 'คำถามนี้กำลังค้นข้อมูลอยู่',
  RATE_LIMITED: 'ส่งคำขอบ่อยเกินไป กรุณารอแล้วกดยืนยันผลคำถามเดิมอีกครั้ง',
  CONFIRMATION_UNAVAILABLE: 'ยังยืนยันผลคำถามไม่ได้ คำถามอาจถูกประมวลผลแล้ว กดยืนยันคำถามเดิมก่อนส่งคำถามใหม่',
};

function sourceDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: 'numeric' });
}

export default function NugaomAssistant({ activeSymbol }) {
  const mascot=useDraggableMascot();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(null);
  const [rights, setRights] = useState(null);
  const [quota, setQuota] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const messagesRef = useRef(null);
  const conversationIdRef = useRef(null);
  const messageVersion = useRef(0), writer = useRef(null);
  if (!writer.current) writer.current = createAssistantWriter({
    onChange(state) {
      setBusy(state.busy); setPending(state.pending);
      if (state.quota) setQuota(state.quota);
      setError(state.error ? ERRORS[state.error] || (state.pending
        ? ERRORS.CONFIRMATION_UNAVAILABLE : 'ยังตอบจากข้อมูลจริงไม่ได้ กรุณาลองอีกครั้ง') : '');
    },
    onStarted(body) {
      messageVersion.current++;
      setInput('');
      setMessages(current => [...current, { id: `${body.requestId}:question`, role: 'user', text: body.question }]);
    },
    onConfirmed(payload, body) {
      messageVersion.current++;
      setMessages(current => [...current, { id: `${body.requestId}:answer`, role: 'assistant', text: payload.answer,
        sources: payload.sources ?? [], chargeType: payload.chargeType, at: payload.generatedAt }]);
    },
  });

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    const version = messageVersion.current;
    fetch('/api/assistant', { cache: 'no-store', signal: controller.signal })
      .then(response => response.json())
      .then(data => { if (!controller.signal.aborted) { setAccount(data.account); setRights(data.rights); setConfigured(data.aiConfigured);
        if (version === messageVersion.current) setQuota(data.aiQuota);
        if (version === messageVersion.current && !writer.current.snapshot().pending && !writer.current.snapshot().busy) {
          setMessages(data.history ?? []); conversationIdRef.current = data.conversationId ?? null;
        }
      } })
      .catch(() => { if (!controller.signal.aborted) setError('โหลดสถานะผู้ช่วยไม่สำเร็จ'); });
    return () => controller.abort();
  }, [open]);
  useEffect(() => {
    const box = messagesRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, error]);

  async function ask(event) {
    event.preventDefault();
    const question = input.trim();
    if (busy || pending || question.length < 3 || question.length > 700) return;
    const conversationId = conversationIdRef.current ?? crypto.randomUUID();
    conversationIdRef.current = conversationId;
    await writer.current.write({ conversationId, question, selectedSymbol: activeSymbol });
  }

  const resetTime=quota?.resetAt?new Date(quota.resetAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'short'}):'00:00 น. เวลาไทย';
  useEffect(()=>{if(!open||!quota?.resetAt)return;const timer=setTimeout(()=>{fetch('/api/assistant',{cache:'no-store'}).then(r=>r.json()).then(d=>{setQuota(d.aiQuota);setRights(d.rights);setAccount(d.account);}).catch(()=>{});},Math.max(1000,Math.min(2147483647,Date.parse(quota.resetAt)-Date.now()+1000)));return()=>clearTimeout(timer);},[open,quota?.resetAt]);
  const canAsk = Boolean(account && rights?.capabilities?.aiQuestions && configured && (quota?.freeRemaining > 0 || quota?.allowExtraCredits && quota?.credits > 0));
  return <div className={`nugaom-assistant${open?' is-open':''}${mascot.dragging?' is-dragging':''}`} style={mascot.position?{left:mascot.position.x,top:mascot.position.y,right:'auto',bottom:'auto'}:undefined}>
    {open && <section style={mascot.chatStyle} className="nugaom-chat" role="dialog" aria-label="ถามน้องนักออม AI" aria-modal="false">
      <header className="nugaom-chat-head"><span className="nugaom-chat-avatar"><Image src="/nugaom-mascot.png" alt="" width={45} height={45} /></span><span className="nugaom-chat-title"><strong>น้องนักออม AI <Sparkles size={14} /></strong><small>AI วิจัยหุ้น · Bigdata.com</small></span><button type="button" onClick={() => { messageVersion.current++; setMessages([]); conversationIdRef.current = null; setError(''); }} disabled={busy || pending || !account} aria-label="เริ่มหัวข้อใหม่" title="เริ่มหัวข้อใหม่"><RotateCcw size={16} /></button><button type="button" onClick={() => setOpen(false)} aria-label="ปิดผู้ช่วย"><X size={18} /></button></header>
      <div className="nugaom-chat-status"><span>AI วันนี้ <b>{account ? quota?.freeRemaining ?? '—' : '—'}/{quota?.freeLimit ?? 5}</b></span><span><Coins size={14} /> เครดิต <b>{account ? quota?.credits ?? '—' : '—'}</b></span><span>{rights?.planName??'สิทธิ์สมาชิก'} · รีเซ็ต {resetTime}</span>{quota?.allowExtraCredits&&<span>เกินโควตา 1 เครดิต/คำถาม</span>}</div>
      <div className="nugaom-chat-messages" aria-live="polite" ref={messagesRef}>
        <div className="nugaom-chat-welcome"><Sparkles size={17} /><strong>สวัสดี! ถามเรื่องหุ้นกับน้องนักออม AI ได้เลย</strong><p>ค้นข้อมูลหุ้น ข่าว งบ และ ETF จาก Bigdata พร้อมแหล่งอ้างอิง ถามข้ามตลาดได้ {activeSymbol?`ไม่จำกัดแค่ ${activeSymbol}`:'ระบุชื่อหุ้นหรือตลาดที่สนใจได้เลย'}</p></div>
        {messages.map(message => <article key={message.id} className={`nugaom-message ${message.role}`}><div>{message.text}</div>{message.role === 'assistant' && <><small>{message.chargeType === 'credit' ? 'ใช้ 1 เครดิต' : 'คำถามฟรี'} · {message.at ? new Date(message.at).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }) : ''}</small>{message.sources?.length > 0 && <nav className="nugaom-sources" aria-label="แหล่งอ้างอิง"><strong>แหล่งข้อมูล</strong>{message.sources.map((source, index) => source.url ? <a href={source.url} key={`${source.url}-${index}`} target="_blank" rel="noopener noreferrer">{source.title}{sourceDate(source.publishedAt) && <em>{sourceDate(source.publishedAt)}</em>} <ExternalLink size={12} /></a> : <span key={`${source.title}-${index}`}>{source.title}{sourceDate(source.publishedAt) && <em>{sourceDate(source.publishedAt)}</em>}</span>)}</nav>}</>}</article>)}
        {busy && <div className="nugaom-thinking"><i /><i /><i /><span>กำลังค้นหลักฐานและเรียบเรียงคำตอบ…</span></div>}
        {error && <p className="nugaom-chat-error" role="alert">{error}</p>}
        {pending && <button type="button" className="nugaom-chat-account" disabled={busy} onClick={() => writer.current.retry()}>ยืนยันผลคำถามเดิม</button>}
        {!account && <a className="nugaom-chat-account" href="/account">เข้าสู่ระบบ LINE และแจ้งเลขพอร์ต ↗</a>}
        {account && !rights?.capabilities?.aiQuestions && <a className="nugaom-chat-account" href="/account">ดูสิทธิสมาชิก ↗</a>}
        {account && quota?.allowExtraCredits && quota?.freeRemaining === 0 && quota?.credits === 0 && <a className="nugaom-chat-account" href="/account">ติดต่อแอดมินเพื่อรับเครดิต ↗</a>}
        {account&&rights?.capabilities?.aiQuestions&&quota?.freeRemaining===0&&!quota?.allowExtraCredits&&<div className="nugaom-quota-full" role="status"><strong>วันนี้ใช้ AI ครบ {quota.freeLimit} ครั้งแล้ว</strong><p>รีเซ็ต {resetTime} (เวลาไทย)</p><a href="/account#membership-plans">ดูแพ็กเกจ / เพิ่มโควตา ↗</a></div>}
      </div>
      <form className="nugaom-compose" onSubmit={ask}><label htmlFor="nugaom-question">คำถามเรื่องหุ้น</label><div><textarea id="nugaom-question" value={input} onChange={event => setInput(event.target.value)} placeholder="เช่น งบล่าสุดของ NVDA เปลี่ยนอย่างไร?" maxLength={700} rows={2} disabled={!canAsk || busy || pending} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button type="submit" aria-label="ส่งคำถาม" disabled={!canAsk || busy || pending || input.trim().length < 3}><Send size={17} /></button></div><small>คำตอบเป็นข้อมูลวิจัยพร้อมแหล่งอ้างอิง · ไม่ใช่คำสั่งซื้อขาย</small></form>
    </section>}
    <button className="nugaom-launch" type="button" {...mascot.pointer} onKeyDown={event=>{mascot.keyDown(event);if(event.key==='Escape')setOpen(false);}} onClick={event=>{if(mascot.canClick(event))setOpen(value=>!value);}} title="คลิกเพื่อคุย · ลากเพื่อย้าย · ปุ่มลูกศรเพื่อเลื่อนตำแหน่ง" aria-label={open ? 'ปิดน้องนักออม AI' : 'เปิดน้องนักออม AI'} aria-expanded={open}><NugaomMascot/><span className="nugaom-mascot-label">น้องนักออม</span><b>{open ? <X size={13} /> : <MessageCircle size={13} />}</b></button>
  </div>;
}
