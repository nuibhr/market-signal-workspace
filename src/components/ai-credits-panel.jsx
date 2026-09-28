'use client';

import { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

export function AiCreditsPanel({ quota, onRefresh }) {
  return <section className="account-card">
    <div className="account-section-heading"><span className="account-icon cyan"><Sparkles size={24} /></span><div><span className="account-kicker">NUGAOM ASSISTANT / AI CREDITS</span><h2>เครดิต AI ของคุณ</h2><p>ถามข้อมูลหุ้นจาก Bigdata พร้อมที่มาในหน้าตลาด</p></div></div>
    <div className="account-metrics"><div><span>คำถามฟรีคงเหลือวันนี้</span><strong>{quota?.freeRemaining ?? 0} / {quota?.freeLimit ?? 5}</strong><small>รีเซ็ตตามวันเวลาไทย</small></div><div><span>เครดิตคงเหลือ</span><strong>{quota?.credits ?? 0}</strong><small>ถามเกินโควตาใช้ 1 เครดิต / คำถาม</small></div></div>
    <p className="account-fineprint">หักเครดิตเฉพาะเมื่อ Bigdata ตอบพร้อมแหล่งอ้างอิง ถ้าแหล่งข้อมูลขัดข้องหรือไม่มีหลักฐาน ระบบคืนเครดิตหรือช่องคำถามฟรีให้ ปัจจุบันการเติมเครดิตทำผ่านแอดมินหลังตรวจรายการ ยังไม่มีระบบชำระเงินอัตโนมัติ</p>
    <div className="account-actions"><a className="account-primary" href="/">ไปถามน้องนักออม AI <ArrowRight size={16} /></a><button className="account-secondary" onClick={onRefresh}>รีเฟรชยอด</button></div>
  </section>;
}

export function AdminCreditGrant({ member, busy, onGrant }) {
  const [amount, setAmount] = useState(10);
  return <form className="account-credit-grant" onSubmit={event => { event.preventDefault(); onGrant(member.id, Number(amount)); }}>
    <label>เครดิตปัจจุบัน {member.ai_credits ?? 0} · เพิ่ม<input type="number" min="1" max="1000" value={amount} onChange={event => setAmount(event.target.value)} aria-label={`จำนวนเครดิตให้ ${member.display_name}`} required /></label>
    <button className="account-secondary" disabled={busy}>+ เครดิต</button>
  </form>;
}
