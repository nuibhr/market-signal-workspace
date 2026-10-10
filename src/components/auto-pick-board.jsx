'use client';
import DrTracker from './dr-tracker.jsx';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { BellRing, ChartNoAxesCombined, Clock3, Radar, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import { ALL_ASSETS } from '../markets/catalog.mjs';
import { SPOKEN_TYPES, announcementFor } from '../auto-pick/announcements.mjs';
import { claimAnnouncements } from '../auto-pick/notification-cursor.mjs';
import { createSignalSpeaker } from '../auto-pick/speech.mjs';
const VOICE_KEY = 'nugaom-autopick-voice-enabled';
const WORKER_LABELS = { healthy: 'สแกนตามเวลา', running: 'กำลังสแกน', degraded: 'ข้อมูลบางส่วนมีปัญหา',
  'scanning-incomplete': 'กำลังตรวจให้ครบ',
  stuck: 'รอบสแกนค้าง', 'not-running': 'worker ไม่ทำงาน', 'awaiting-first-run': 'รอรอบสแกนแรก',
  'outside-session': 'นอกเวลาตลาด', 'missed-candidate-window': 'พลาดรอบคัดหุ้นเช้า',
  'candidate-degraded': 'รอบคัดหุ้นมีปัญหาข้อมูล', unavailable: 'อ่านสถานะ worker ไม่ได้',
  'awaiting-eod-data': 'รอข้อมูลแท่งรายวันปิด', 'eod-data-delayed': 'ข้อมูลแท่งรายวันมาช้า' };
const LABELS = { PICK_READY: 'ระบบจับตา · รอยืนยัน', ENTRY: 'เข้าเงื่อนไขราคา', TARGET: 'ถึงเป้า TP1',
  STOP: 'ถึงจุดตัดขาดทุน', EXIT: 'จบแผนตามเงื่อนไข', AMBIGUOUS: 'ต้องตรวจผล', DATA_GAP: 'ข้อมูลขาดช่วง', SESSION_END: 'จบช่วงติดตาม · ต้องตรวจผล', EXPIRED: 'หมดเวลารอเข้า', ENTRY_SKIPPED: 'ราคาเลยจุดเข้า' };
const fmt = (value, market = '') => typeof value === 'number' && Number.isFinite(value)
  ? `${market === 'us' ? '$' : ''}${value.toLocaleString('en-US', { maximumFractionDigits: value < 1 ? 5 : 2 })}` : '—';
const at = value => value ? new Date(value).toLocaleString('th-TH', {
  timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
}) : '—';
const observedAt = item => item.barTime
  ? (item.barTime + (item.type === 'ENTRY' || item.type === 'ENTRY_SKIPPED' || item.type === 'PICK_READY'
    ? 900 : 900)) * 1000
  : item.createdAt;
const eventDateLabel = item => item.market === 'us' && item.barDay ? `แท่ง D1 ปิด ${item.barDay} · New York` : at(observedAt(item));

export default function AutoPickBoard({ onSelect, marketId=null }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechState, setSpeechState] = useState('idle');
  const speaker = useRef(null);
  const spokenId = useRef(null);
  const eventCursor = useRef({seen:null});
  const alert = alerts[0] ?? null;

  useEffect(() => {
    let mounted = true;
    const adapter = createSignalSpeaker(window, value => { if (mounted) setSpeechState(value); });
    speaker.current = adapter;
    setSpeechSupported(adapter.supported);
    try { setVoiceEnabled(window.localStorage.getItem(VOICE_KEY) === 'true'); } catch { /* Private browsing may disable storage. */ }
    return () => { mounted = false; adapter.stop(); };
  }, []);

  useEffect(() => {
    let stopped = false;
    async function refresh() {
      try {
        const response = await fetch('/api/auto-pick', { cache: 'no-store' });
        const data = await response.json();
        if (stopped) return;
        if (!response.ok) { setError(true); return; }
        setState(data); setError(false);
        if (data.status !== 'available' || !data.events?.length) return;
        let browserStorage;
        try{browserStorage=window.localStorage;}catch{/* Use the per-tab cursor in private browsing. */}
        const fresh=await claimAnnouncements(data.events,{storage:browserStorage,locks:navigator.locks,
          memory:eventCursor.current,visible:()=>!stopped&&document.visibilityState==='visible'});
        if(!stopped&&fresh.length)setAlerts(current=>[...current,...fresh]);
      } catch { if (!stopped) setError(true); }
    }
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    const onVisible=()=>{if(document.visibilityState==='visible')refresh();};
    document.addEventListener('visibilitychange',onVisible);
    return () => { stopped = true; window.clearInterval(interval); document.removeEventListener('visibilitychange',onVisible); };
  }, []);

  useEffect(() => {
    if (!alert) return undefined;
    const timer = window.setTimeout(() => setAlerts(current => current.slice(1)), voiceEnabled && SPOKEN_TYPES.has(alert.type) ? Math.min(90000, Math.max(35000, announcementFor(alert).text.length * 120)) : 12000);
    return () => window.clearTimeout(timer);
  }, [alert?.id, voiceEnabled]);

  useEffect(() => {
    if (!alert || spokenId.current === alert.id) return;
    spokenId.current = alert.id;
    if ((voiceEnabled || alert.demo) && document.visibilityState === 'visible' && SPOKEN_TYPES.has(alert.type)) speaker.current?.play(announcementFor(alert).text);
  }, [alert, voiceEnabled]);

  function toggleVoice() {
    const next = speechState === 'blocked' || speechState === 'failed' ? true : !voiceEnabled;
    setVoiceEnabled(next);
    try { window.localStorage.setItem(VOICE_KEY, String(next)); } catch { /* Voice still works for this page. */ }
    if (next) {
      spokenId.current = alert?.id ?? null;
      speaker.current?.play(alert && SPOKEN_TYPES.has(alert.type) ? announcementFor(alert).text : 'เปิดเสียงแจ้งเตือนจากน้องนักออมแล้ว');
    } else speaker.current?.stop();
  }

  function previewAnnouncement() {
    const demo = { id: `preview-${Date.now()}`, type: 'ENTRY', symbol: 'NVDA80', market: 'dr', session: 'night',
      price: 39, entryCeiling: 39, tp1: 40.5, stopLoss: 38.25, createdAt: new Date().toISOString(), demo: true };
    setAlerts(current => [...current, demo]);
    // A preview must not cut off a live signal that is already being presented.
    if (!alert) { spokenId.current = demo.id; speaker.current?.play(announcementFor(demo).text); }
  }

  const readiness = (state?.readiness?.markets ?? []).filter(m=>!marketId||m.id===marketId);
  const coverage = state?.coverage ?? {};
  const worker = state?.worker;
  const workers = state?.workers ?? { thai: worker };
  const workerProcess = state?.workerProcess;
  const scheduleMinutes = workerProcess?.intervalMinutes ?? 1;
  const processRunning = workerProcess?.status === 'running';
  const activeMarkets = readiness.filter(market => market.status === 'active'
    && !(market.id === 'us' && workers.us?.scanUnverified));
  const shelvedMarkets = readiness.filter(market => !activeMarkets.includes(market));
  const signals = (state?.signals ?? []).filter(s=>!marketId||s.market===marketId);
  const events = (state?.events ?? []).filter(e=>!marketId||e.market===marketId);
  const decisions = state?.decisions ?? [];
  const outcomes = (marketId?state?.marketOutcomes?.[marketId]:state?.outcomes) ?? {};
  const lastRunAt = (marketId ? [workers[marketId]?.lastRunAt] : Object.values(workers).map(item => item?.lastRunAt))
    .filter(Boolean).sort().at(-1);
  const statusLabel = market => market.id === 'us' && workers.us?.scanUnverified
    ? `ฟีด FMP ใช้ไม่ได้ ${workers.us.planRequired} ตัว` : WORKER_LABELS[workers[market.id]?.status] ?? 'รอรอบสแกน';
  const workerSummary = activeMarkets.map(market => `${market.id === 'us' ? 'สหรัฐฯ' : market.id === 'thai' ? 'หุ้นไทย' : market.label}: ${statusLabel(market)}`).join(' · ');
  const workerLabel = WORKER_LABELS[worker?.status] ?? 'กำลังตรวจสถานะ worker';
  const badgeLabel = activeMarkets.length ? workerProcess?.status === 'offline' ? 'ตัวสแกนหยุดทำงาน' : activeMarkets.map(statusLabel).join(' · ') : 'รอเปิดสแกน';
  return <section id="section-auto-pick" className="auto-pick-board" aria-labelledby="auto-pick-title">
    <div className="auto-pick-head"><span className="hub-heading-icon"><Radar size={22} /></span><div><span className="eyebrow">NUGAOM / AUTOPICK</span><h2 id="auto-pick-title">จังหวะที่ระบบพบ</h2><p>ตรวจตามรอบทุก {scheduleMinutes} นาที · แจ้งจุดเข้า เป้าหมาย และตัดขาดทุนเมื่อแท่งราคายืนยัน · หุ้นสหรัฐฯ ใช้แท่งรายวันปิด</p></div><span className="auto-pick-badge"><BellRing size={15} /> {badgeLabel}</span></div>
    {activeMarkets.length > 0 && <div className={`auto-pick-worker ${processRunning && activeMarkets.every(market => ['healthy', 'running', 'outside-session', 'awaiting-first-run'].includes(workers[market.id]?.status)) ? 'healthy' : ''}`}><strong>{processRunning ? 'ตัวสแกนทำงานอยู่' : workerProcess?.status === 'offline' ? 'ไม่พบตัวสแกนทำงาน' : 'ยังอ่านสถานะตัวสแกนไม่ได้'} · {workerSummary || workerLabel}</strong><span>{activeMarkets.map(market => workers[market.id]?.lastRunAt ? `${market.label} รอบล่าสุด ${at(workers[market.id].lastRunAt)}` : `${market.label} ยังไม่มีรอบที่บันทึกไว้`).join(' · ')} · {workerProcess?.lastSeenAt ? `อัปเดตระบบล่าสุด ${at(workerProcess.lastSeenAt)}` : 'รออัปเดตสถานะ'}</span></div>}
    <div className="auto-pick-voice"><div><strong>น้องนักออมเล่าเหตุการณ์</strong><span>ป๊อปอัปทำงานขณะเปิดเว็บ · ใช้เสียงจากอุปกรณ์ และเลือกเสียงภาษาไทยเมื่อมี</span>{speechState === 'blocked' || speechState === 'failed' ? <span role="status">{speechState === 'blocked' ? 'เบราว์เซอร์ยังไม่อนุญาตเสียง กดเปิดเสียงอีกครั้ง' : 'เล่นเสียงไม่สำเร็จ กดลองฟังอีกครั้ง'} · ป๊อปอัปยังแสดงตามปกติ</span> : speechState === 'speaking' ? <span role="status">กำลังอ่านการแจ้งเตือน…</span> : null}</div><div className="auto-pick-voice-actions"><button type="button" className="auto-pick-preview" onClick={previewAnnouncement}>ลองฟังสัญญาณเข้า DR</button><button type="button" aria-pressed={voiceEnabled} onClick={toggleVoice} disabled={!speechSupported}>{voiceEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}{!speechSupported ? 'อุปกรณ์ไม่รองรับเสียง' : speechState === 'blocked' || speechState === 'failed' ? 'เปิดเสียงอีกครั้ง' : voiceEnabled ? 'เปิดเสียงแล้ว' : 'เปิดเสียงแจ้งเตือน'}</button></div></div>
    {marketId==='dr'&&['available','membership-required'].includes(state?.status)&&<DrTracker signals={signals} events={events} onSelect={onSelect}/>}
    <div className="auto-pick-markets">{activeMarkets.map(market => <div className="auto-pick-market active" key={market.id}>
      <strong>{market.label}</strong><span>{workerProcess?.status === 'offline' ? 'ตัวสแกนหยุดทำงาน' : coverage[market.id]
        ? coverage[market.id].remaining > 0 ? 'อยู่ระหว่างตรวจครบชุด'
          : coverage[market.id].ineligible + coverage[market.id].unavailable > 0 ? 'ปิดรอบแล้ว · บางตัวไม่มีข้อมูล' : 'ตรวจครบชุดแล้ว'
        : workers[market.id]?.status === 'outside-session' ? 'รอเปิดตลาด' : 'รอรอบตรวจ'}</span>
      <small>{market.universeCount ?? 0} ตัว</small>
      {coverage[market.id] && <small>รอบนี้ตรวจ {coverage[market.id].done + coverage[market.id].ineligible + coverage[market.id].unavailable}/{coverage[market.id].expected} · ไม่พร้อมตามช่วง/ไม่มีแท่ง {coverage[market.id].ineligible} · ฟีดไม่พร้อม {coverage[market.id].unavailable} · รอตรวจ/ลองใหม่ {coverage[market.id].remaining}</small>}
    </div>)}</div>
    {shelvedMarkets.length > 0 && <details className="auto-pick-shelved-markets"><summary>ตลาดที่ยังสแกนไม่ครบหรือยังไม่เปิด {shelvedMarkets.length} หมวด</summary><div>{shelvedMarkets.map(market => <article key={market.id}><strong>{market.label}</strong><span>{market.id === 'us' && workers.us?.scanUnverified ? `รอบเต็มล่าสุดยังไม่ผ่าน: ${workers.us.planRequired ? `สิทธิ FMP ไม่ครอบคลุม ${workers.us.planRequired} ตัว` : 'ยังไม่มีรอบสแกนยืนยันครบชุดหุ้นสหรัฐฯ'} · ตรวจรอบใหม่ก่อนเปิดแสดง` : market.reason ?? 'รอข้อมูลราคาและกติกาสแกนที่ยืนยันแล้ว'}</span></article>)}</div></details>}
    {!state && !error && <div className="auto-pick-empty">กำลังอ่านสถานะระบบ…</div>}
    {error && <div className="auto-pick-empty">อ่านสถานะสัญญาณจากเซิร์ฟเวอร์ไม่ได้</div>}
    {state?.status === 'membership-required' && <div className="auto-pick-empty"><ShieldCheck size={18} /><span>เข้าสู่ระบบ LINE และแจ้งเลขพอร์ตเพื่อรับสิทธิทดลองใช้ฟรี 14 วัน</span><a href="/account">บัญชีของฉัน ↗</a></div>}
    {state?.status === 'available' && <>
      <div className="auto-pick-outcomes"><span><b>{outcomes.WAITING_FOR_ENTRY ?? 0}</b> รอเข้า</span><span><b>{outcomes.OPEN ?? 0}</b> ติดตามอยู่</span><span><b>{outcomes.EXPIRED ?? 0}</b> หมดเวลารอเข้า</span><span><b>{outcomes.TARGET ?? 0}</b> ถึง TP1</span><span><b>{outcomes.STOP ?? 0}</b> ถึง SL</span><span><b>{outcomes.EXIT ?? 0}</b> จบตามแผน</span><span><b>{(outcomes.AMBIGUOUS ?? 0) + (outcomes.REVIEW ?? 0)}</b> รอตรวจ</span></div>
      <div className="auto-pick-section-title"><strong>ระบบจับตาวันนี้ · แยกจากรายการโปรดของคุณ</strong><span>{lastRunAt ? `รอบล่าสุด ${at(lastRunAt)}` : 'ยังไม่มีรอบสแกน'}</span></div>
      {marketId!=='dr'&&(signals.length ? <div className="auto-pick-signal-list">{signals.slice(0, 7).map(signal => <article key={signal.id} className="auto-pick-signal">
        <div><strong>{signal.symbol} <small>{signal.plan?.side === 'LONG' ? 'LONG' : 'SHORT'}</small></strong><span>{signal.status === 'WAITING_FOR_ENTRY' ? signal.market === 'us' ? 'รอปิดทะลุจุดยืนยัน · D1' : 'รอยืนยันราคาเข้า' : signal.status === 'OPEN' ? 'เข้าเงื่อนไขแล้ว · ติดตามอยู่' : signal.status === 'TARGET' ? 'ถึง TP1' : signal.status === 'STOP' ? 'ถึง SL' : signal.status === 'EXIT' ? 'จบตามเงื่อนไข' : signal.status === 'EXPIRED' ? 'หมดเวลารอเข้า' : 'ตรวจผลเพิ่มเติม'}</span></div>
        <div className="auto-pick-levels"><span>{signal.entryPrice == null ? 'แผนรอเข้า' : 'เข้าอ้างอิง'} <b>{fmt(signal.entryPrice ?? signal.plan?.entry, signal.market)}</b></span><span>TP1 <b>{fmt(signal.plan?.tp1, signal.market)}</b></span><span>SL <b>{fmt(signal.plan?.stopLoss, signal.market)}</b></span></div>
        <div className="auto-pick-signal-foot"><small><Clock3 size={13} /> {signal.market === 'us' ? `ข้อมูลปิด ${signal.plan?.referenceCandles?.dailyDay ?? signal.sessionDay} · ` : `${at(signal.publishedAt)} · `}{signal.market === 'us' ? 'หุ้นสหรัฐฯ' : signal.market === 'dr' ? 'DR' : 'หุ้นไทย'}</small><button onClick={() => { const asset = ALL_ASSETS.find(item => item.symbol === signal.symbol && item.id === signal.market); if (asset) onSelect(asset, signal.plan?.signalTimeframe === '15m' ? '15m' : signal.market === 'us' ? '1d' : '1h'); }}><ChartNoAxesCombined size={13} /> เปิดกราฟ {signal.plan?.signalTimeframe === '15m' ? '15m' : signal.market === 'us' ? '1D' : '1H'}</button></div>
      </article>)}</div> : <div className="auto-pick-empty">ยังไม่มีแผนที่ผ่านกติกา ระบบจะไม่สร้างสัญญาณจากราคาตัวอย่าง</div>)}
      <div className="auto-pick-section-title"><strong>เหตุการณ์ล่าสุด</strong><span>ราคาเป็นจุดอ้างอิงของสัญญาณ ไม่ใช่ราคาที่บัญชีลูกค้าซื้อขายได้จริง</span></div>
      {events.length ? <div className="auto-pick-events">{events.slice(0, 7).map(item => <div key={item.id}><span className={`auto-pick-event-type ${item.type.toLowerCase()}`}>{LABELS[item.type] ?? item.type}</span><strong>{item.symbol}</strong><span>{fmt(item.price, item.market)}</span><small>{eventDateLabel(item)}</small></div>)}</div> : <div className="auto-pick-empty">ยังไม่มีเหตุการณ์สัญญาณ</div>}
    </>}
    <p className="auto-pick-disclaimer">ผลลัพธ์เป็นการติดตามแผนสมมติจาก OHLC ที่ปิดแล้ว ไม่ส่งคำสั่งซื้อขาย · หากแท่งเดียวแตะ TP และ SL หรือข้อมูลขาดช่วง ระบบจะส่งตรวจผลและไม่นับเป็นชนะ/แพ้</p>
    {alert && <aside className={`auto-pick-toast ${announcementFor(alert).tone}`} role="status" aria-live="polite"><span className="auto-pick-toast-avatar"><Image src="/nugaom-mascot.png" alt="" width={42} height={42} /></span><div><strong>{alert.demo ? 'ตัวอย่าง · ' : ''}{announcementFor(alert).title}</strong><span>{announcementFor(alert).detail}</span>{alert.type === 'ENTRY' && <span>เข้าอ้างอิง {fmt(alert.price, alert.market)} · TP1 {fmt(alert.tp1, alert.market)} · SL {fmt(alert.stopLoss, alert.market)}</span>}<small>{alert.demo ? 'ตัวอย่างหน้าจอและเสียง · ไม่ใช่สัญญาณจากตลาด' : `ราคาอ้างอิง ${fmt(alert.price, alert.market)} · ${eventDateLabel(alert)}`}{alerts.length > 1 ? ` · อีก ${alerts.length - 1} รายการ` : ''}</small>{speechSupported && SPOKEN_TYPES.has(alert.type) && <button className="auto-pick-toast-plan" onClick={() => speaker.current?.play(announcementFor(alert).text)}>ฟังแจ้งเตือนนี้อีกครั้ง</button>}{!alert.demo && <button className="auto-pick-toast-plan" onClick={() => {if(marketId&&alert.market!==marketId)window.location.href=`/${alert.market}?symbol=${encodeURIComponent(alert.symbol)}#section-auto-pick`;else document.getElementById('section-auto-pick')?.scrollIntoView({ behavior: 'smooth' });}}>ดูแผนและที่มาราคา ↗</button>}</div><button className="auto-pick-toast-close" onClick={() => setAlerts(current => current.slice(1))} aria-label="ปิดการแจ้งเตือน">×</button></aside>}
  </section>;
}
