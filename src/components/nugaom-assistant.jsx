'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Coins, ExternalLink, MessageCircle, RotateCcw, Send, Sparkles, X } from 'lucide-react';

const ERRORS = {
  LOGIN_REQUIRED: 'เข้าสู่ระบบ LINE ก่อนถามน้องนักออม AI',
  MEMBERSHIP_REQUIRED: 'สิทธิทดลองหรือสมาชิกหมดอายุแล้ว กรุณาต่ออายุ',
  BIGDATA_NOT_CONFIGURED: 'กำลังรอเชื่อมคีย์ Bigdata API',
  INSUFFICIENT_AI_CREDITS: 'วันนี้ใช้คำถามฟรีครบแล้ว และเครดิตยังไม่พอ',
  BIGDATA_AUTH_FAILED: 'คีย์ Bigdata ใช้ไม่ได้ กรุณาให้ผู้ดูแลตรวจสอบ',
  BIGDATA_RATE_LIMIT: 'Bigdata จำกัดคำขอชั่วคราว ลองใหม่อีกครั้ง',
  BIGDATA_TIMEOUT: 'การค้นข้อมูลใช้เวลานานเกินไป ลองถามใหม่ได้โดยไม่เสียโควตา',
  BIGDATA_UNGROUNDED: 'ยังไม่พบแหล่งอ้างอิงสำหรับคำถามนี้ ลองระบุบริษัทหรือช่วงเวลาให้ชัดขึ้น โดยไม่เสียโควตา',
  QUESTION_IN_PROGRESS: 'คำถามนี้กำลังค้นข้อมูลอยู่',
};

function sourceDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: 'numeric' });
}

export default function NugaomAssistant({ activeSymbol }) {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(null);
  const [rights, setRights] = useState(null);
  const [quota, setQuota] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const messagesRef = useRef(null);
  const conversationIdRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    fetch('/api/assistant', { cache: 'no-store', signal: controller.signal })
      .then(response => response.json())
      .then(data => { if (!controller.signal.aborted) { setAccount(data.account); setRights(data.rights); setQuota(data.aiQuota); setConfigured(data.aiConfigured); setMessages(data.history ?? []); conversationIdRef.current = data.conversationId ?? null; } })
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
    if (busy || question.length < 3 || question.length > 700) return;
    setError(''); setBusy(true); setInput('');
    setMessages(current => [...current, { id: crypto.randomUUID(), role: 'user', text: question }]);
    try {
      const conversationId = conversationIdRef.current ?? crypto.randomUUID();
      conversationIdRef.current = conversationId;
      const response = await fetch('/api/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ requestId: crypto.randomUUID(), conversationId, question, selectedSymbol: activeSymbol }),
      });
      const payload = await response.json();
      if (payload.quota) setQuota(payload.quota);
      if (!response.ok || payload.status !== 'available') throw new Error(payload.error || 'BIGDATA_UNAVAILABLE');
      setMessages(current => [...current, { id: crypto.randomUUID(), role: 'assistant', text: payload.answer, sources: payload.sources ?? [], chargeType: payload.chargeType, at: payload.generatedAt }]);
    } catch (cause) {
      setError(ERRORS[cause.message] || 'ยังตอบจากข้อมูลจริงไม่ได้ ลองใหม่ได้โดยไม่เสียโควตา');
    } finally { setBusy(false); }
  }

  const canAsk = Boolean(account && rights?.capabilities?.aiQuestions && configured && (quota?.freeRemaining > 0 || quota?.credits > 0));
  return <div className={open ? 'nugaom-assistant is-open' : 'nugaom-assistant'}>
    {open && <section className="nugaom-chat" role="dialog" aria-label="ถามน้องนักออม AI" aria-modal="false">
      <header className="nugaom-chat-head"><span className="nugaom-chat-avatar"><Image src="/nugaom-mascot.png" alt="" width={45} height={45} /></span><span className="nugaom-chat-title"><strong>น้องนักออม AI <Sparkles size={14} /></strong><small>AI วิจัยหุ้น · Bigdata.com</small></span><button type="button" onClick={() => { setMessages([]); conversationIdRef.current = null; setError(''); }} disabled={busy || !account} aria-label="เริ่มหัวข้อใหม่" title="เริ่มหัวข้อใหม่"><RotateCcw size={16} /></button><button type="button" onClick={() => setOpen(false)} aria-label="ปิดผู้ช่วย"><X size={18} /></button></header>
      <div className="nugaom-chat-status"><span>ฟรีวันนี้ <b>{account ? quota?.freeRemaining ?? '—' : '—'}/{quota?.freeLimit ?? 5}</b></span><span><Coins size={14} /> เครดิต <b>{account ? quota?.credits ?? '—' : '—'}</b></span><span>เกินโควตา 1 เครดิต/คำถาม</span></div>
      <div className="nugaom-chat-messages" aria-live="polite" ref={messagesRef}>
        <div className="nugaom-chat-welcome"><Sparkles size={17} /><strong>สวัสดี! ถามเรื่องหุ้นกับน้องนักออม AI ได้เลย</strong><p>ค้นข้อมูลหุ้น ข่าว งบ และ ETF จาก Bigdata พร้อมแหล่งอ้างอิง ถามข้ามตลาดได้ ไม่จำกัดแค่ {activeSymbol}</p></div>
        {messages.map(message => <article key={message.id} className={`nugaom-message ${message.role}`}><div>{message.text}</div>{message.role === 'assistant' && <><small>{message.chargeType === 'credit' ? 'ใช้ 1 เครดิต' : 'คำถามฟรี'} · {message.at ? new Date(message.at).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }) : ''}</small>{message.sources?.length > 0 && <nav className="nugaom-sources" aria-label="แหล่งอ้างอิง"><strong>แหล่งข้อมูล</strong>{message.sources.map((source, index) => source.url ? <a href={source.url} key={`${source.url}-${index}`} target="_blank" rel="noopener noreferrer">{source.title}{sourceDate(source.publishedAt) && <em>{sourceDate(source.publishedAt)}</em>} <ExternalLink size={12} /></a> : <span key={`${source.title}-${index}`}>{source.title}{sourceDate(source.publishedAt) && <em>{sourceDate(source.publishedAt)}</em>}</span>)}</nav>}</>}</article>)}
        {busy && <div className="nugaom-thinking"><i /><i /><i /><span>กำลังค้นหลักฐานและเรียบเรียงคำตอบ…</span></div>}
        {error && <p className="nugaom-chat-error" role="alert">{error}</p>}
        {!account && <a className="nugaom-chat-account" href="/account">เข้าสู่ระบบ LINE และแจ้งเลขพอร์ต ↗</a>}
        {account && !rights?.capabilities?.aiQuestions && <a className="nugaom-chat-account" href="/account">ดูสิทธิสมาชิก ↗</a>}
        {account && quota?.freeRemaining === 0 && quota?.credits === 0 && <a className="nugaom-chat-account" href="/account">ติดต่อแอดมินเพื่อรับเครดิต ↗</a>}
      </div>
      <form className="nugaom-compose" onSubmit={ask}><label htmlFor="nugaom-question">คำถามเรื่องหุ้น</label><div><textarea id="nugaom-question" value={input} onChange={event => setInput(event.target.value)} placeholder="เช่น งบล่าสุดของ NVDA เปลี่ยนอย่างไร?" maxLength={700} rows={2} disabled={!canAsk || busy} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button type="submit" aria-label="ส่งคำถาม" disabled={!canAsk || busy || input.trim().length < 3}><Send size={17} /></button></div><small>คำตอบเป็นข้อมูลวิจัยพร้อมแหล่งอ้างอิง · ไม่ใช่คำสั่งซื้อขาย</small></form>
    </section>}
    <button className="nugaom-launch" type="button" onClick={() => setOpen(value => !value)} aria-label={open ? 'ปิดน้องนักออม AI' : 'เปิดน้องนักออม AI'} aria-expanded={open}><span><Image src="/nugaom-mascot.png" alt="" width={62} height={62} /></span><b>{open ? <X size={17} /> : <MessageCircle size={17} />}</b></button>
  </div>;
}
