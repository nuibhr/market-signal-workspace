'use client';

import { useEffect, useState } from 'react';
import { BellRing, ChartNoAxesCombined, Clock3, Radar, ShieldCheck } from 'lucide-react';
import { ALL_ASSETS } from '../markets/catalog.mjs';

const SEEN_KEY = 'nugaom-autopick-last-event';
const ALERT_TYPES = new Set(['ENTRY', 'TARGET', 'STOP', 'AMBIGUOUS', 'DATA_GAP', 'SESSION_END']);
const LABELS = { PICK_READY: 'พบแผน · รอยืนยัน', ENTRY: 'เข้าเงื่อนไขราคา', TARGET: 'ถึงเป้า TP1',
  STOP: 'ถึงจุดตัดขาดทุน', AMBIGUOUS: 'ต้องตรวจผล', DATA_GAP: 'ข้อมูลขาดช่วง', SESSION_END: 'สิ้นวัน · ต้องตรวจผล', EXPIRED: 'หมดเวลารอเข้า', ENTRY_SKIPPED: 'ราคาเลยจุดเข้า' };
const fmt = value => typeof value === 'number' && Number.isFinite(value)
  ? value.toLocaleString('en-US', { maximumFractionDigits: value < 1 ? 5 : 2 }) : '—';
const at = value => value ? new Date(value).toLocaleString('th-TH', {
  timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
}) : '—';
const observedAt = item => item.barTime
  ? (item.barTime + (item.type === 'ENTRY' || item.type === 'ENTRY_SKIPPED' || item.type === 'PICK_READY' ? 3600 : 900)) * 1000
  : item.createdAt;

export default function AutoPickBoard({ onSelect }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(false);
  const [alert, setAlert] = useState(null);

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
        const newest = data.events[0].id;
        let seen = null;
        try { seen = window.localStorage.getItem(SEEN_KEY); } catch { /* Storage is optional. */ }
        if (seen && seen !== newest) {
          const index = data.events.findIndex(item => item.id === seen);
          const unseen = (index < 0 ? data.events.slice(0, 1) : data.events.slice(0, index)).filter(item => ALERT_TYPES.has(item.type));
          if (unseen.length) setAlert(unseen[0]);
        }
        try { window.localStorage.setItem(SEEN_KEY, newest); } catch { /* Storage is optional. */ }
      } catch { if (!stopped) setError(true); }
    }
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => { stopped = true; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!alert) return undefined;
    const timer = window.setTimeout(() => setAlert(null), 12000);
    return () => window.clearTimeout(timer);
  }, [alert]);

  const readiness = state?.readiness?.markets ?? [];
  const signals = state?.signals ?? [];
  const events = state?.events ?? [];
  const decisions = state?.decisions ?? [];
  const outcomes = state?.outcomes ?? {};
  const lastRun = state?.runs?.[0];
  return <section id="section-auto-pick" className="auto-pick-board" aria-labelledby="auto-pick-title">
    <div className="auto-pick-head"><span className="hub-heading-icon"><Radar size={22} /></span><div><span className="eyebrow">AUTOPICK / SAVED SIGNAL EVENTS</span><h2 id="auto-pick-title">AutoPick และแจ้งเตือน</h2><p>ระบบคัดแผนตามกติกา แจ้งเมื่อแท่งปิดยืนยันราคาเข้า และติดตาม TP1 / SL จากแท่งจริง</p></div><span className="auto-pick-badge"><BellRing size={15} /> {state?.readiness?.enabled ? 'สแกนเปิดใช้งาน' : 'รอเปิดสแกน'}</span></div>
    <div className="auto-pick-markets">{readiness.map(market => <div className={market.status === 'active' ? 'auto-pick-market active' : 'auto-pick-market'} key={market.id}>
      <strong>{market.label}</strong><span>{market.status === 'active' ? 'พร้อมสแกน' : 'ยังไม่เปิดสัญญาณ'}</span>
      <small>{market.status === 'active' ? `${market.universe?.length ?? 0} หุ้นนำร่อง · ${market.source}` : market.reason}</small>
    </div>)}</div>
    {!state && !error && <div className="auto-pick-empty">กำลังอ่านสถานะระบบ…</div>}
    {error && <div className="auto-pick-empty">อ่านสถานะสัญญาณจากเซิร์ฟเวอร์ไม่ได้</div>}
    {state?.status === 'membership-required' && <div className="auto-pick-empty"><ShieldCheck size={18} /><span>เข้าสู่ระบบ LINE และแจ้งเลขพอร์ตเพื่อรับสิทธิทดลองใช้ฟรี 14 วัน</span><a href="/account">บัญชีของฉัน ↗</a></div>}
    {state?.status === 'available' && <>
      <div className="auto-pick-outcomes"><span><b>{outcomes.WAITING_FOR_ENTRY ?? 0}</b> รอเข้า</span><span><b>{outcomes.OPEN ?? 0}</b> ติดตามอยู่</span><span><b>{outcomes.TARGET ?? 0}</b> ถึง TP1</span><span><b>{outcomes.STOP ?? 0}</b> ถึง SL</span><span><b>{(outcomes.AMBIGUOUS ?? 0) + (outcomes.REVIEW ?? 0)}</b> รอตรวจ</span></div>
      <div className="auto-pick-section-title"><strong>แผนที่ระบบบันทึก</strong><span>{lastRun ? `สแกนล่าสุด ${at(lastRun.finishedAt ?? lastRun.startedAt)} · ${lastRun.scanned} ตัว · ผ่าน ${lastRun.candidates} ตัว${lastRun.status === 'FAILED' ? ' · ฟีดบางส่วนมีปัญหา' : ''}` : 'ยังไม่มีรอบสแกน'}</span></div>
      {signals.length ? <div className="auto-pick-signal-list">{signals.slice(0, 8).map(signal => <article key={signal.id} className="auto-pick-signal">
        <div><strong>{signal.symbol} <small>{signal.plan?.side === 'LONG' ? 'LONG' : 'SHORT'}</small></strong><span>{signal.status === 'WAITING_FOR_ENTRY' ? 'รอยืนยันราคาเข้า' : signal.status === 'OPEN' ? 'เข้าเงื่อนไขแล้ว · ติดตามอยู่' : signal.status === 'TARGET' ? 'ถึง TP1' : signal.status === 'STOP' ? 'ถึง SL' : signal.status === 'EXPIRED' ? 'หมดเวลารอเข้า' : 'ตรวจผลเพิ่มเติม'}</span></div>
        <div className="auto-pick-levels"><span>เข้า <b>{fmt(signal.entryPrice ?? signal.plan?.entry)}</b></span><span>TP1 <b>{fmt(signal.plan?.tp1)}</b></span><span>SL <b>{fmt(signal.plan?.stopLoss)}</b></span></div>
        <div className="auto-pick-signal-foot"><small><Clock3 size={13} /> {at(signal.publishedAt)} · {signal.plan?.ruleVersion} · {signal.source}</small><button onClick={() => { const asset = ALL_ASSETS.find(item => item.symbol === signal.symbol && item.id === signal.market); if (asset) onSelect(asset, '1h'); }}><ChartNoAxesCombined size={13} /> เปิดกราฟ 1H</button></div>
      </article>)}</div> : <div className="auto-pick-empty">ยังไม่มีแผนที่ผ่านกติกา ระบบจะไม่สร้างสัญญาณจากราคาตัวอย่าง</div>}
      {decisions.length > 0 && <details className="auto-pick-decisions"><summary>ดูผลตรวจล่าสุด {decisions.length} หุ้น</summary><div>{decisions.map(item => <p key={item.symbol}><strong>{item.symbol}</strong><span>{item.decision === 'CANDIDATE' ? 'ผ่านเงื่อนไข' : item.reason ?? 'ไม่ผ่านเงื่อนไข'}</span><small>{typeof item.score === 'number' ? `${item.score} คะแนน` : '—'}</small></p>)}</div></details>}
      <div className="auto-pick-section-title"><strong>เหตุการณ์ล่าสุด</strong><span>ราคาเป็นจุดอ้างอิงของสัญญาณ ไม่ใช่ราคาที่บัญชีลูกค้าซื้อขายได้จริง</span></div>
      {events.length ? <div className="auto-pick-events">{events.slice(0, 8).map(item => <div key={item.id}><span className={`auto-pick-event-type ${item.type.toLowerCase()}`}>{LABELS[item.type] ?? item.type}</span><strong>{item.symbol}</strong><span>{fmt(item.price)}</span><small>{at(observedAt(item))}</small></div>)}</div> : <div className="auto-pick-empty">ยังไม่มีเหตุการณ์สัญญาณ</div>}
    </>}
    <p className="auto-pick-disclaimer">ผลลัพธ์เป็นการติดตามแผนสมมติจาก OHLC ที่ปิดแล้ว ไม่ส่งคำสั่งซื้อขาย · หากแท่งเดียวแตะ TP และ SL หรือข้อมูลขาดช่วง ระบบจะส่งตรวจผลและไม่นับเป็นชนะ/แพ้</p>
    {alert && <aside className="auto-pick-toast" role="status" aria-live="polite"><BellRing size={20} /><div><strong>{LABELS[alert.type]} · {alert.symbol}</strong><span>ราคาอ้างอิง {fmt(alert.price)} · แท่งปิด {at(observedAt(alert))}</span><small>{alert.detail}</small></div><button onClick={() => setAlert(null)} aria-label="ปิดการแจ้งเตือน">×</button></aside>}
  </section>;
}
