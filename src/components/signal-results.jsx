'use client';
import BacktestCard from './backtest-card.jsx';

import { Fragment, useEffect, useState } from 'react';

const MARKETS = [['all', 'ทุกตลาด'], ['thai', 'หุ้นไทย'], ['dr', 'DR'], ['us', 'หุ้นสหรัฐฯ']];
const STATUSES = [['all', 'ทุกสถานะ'], ['WAITING_FOR_ENTRY', 'รอเข้า'], ['OPEN', 'เข้าแล้ว'], ['TARGET', 'ถึงเป้า'], ['STOP', 'ตัดขาดทุน'], ['EXIT', 'ปิดตามกติกา'], ['EXPIRED', 'ไม่เข้า'], ['REVIEW', 'ข้อมูลขาด'], ['AMBIGUOUS', 'ตรวจผล']];
const STATUS_LABEL = { WAITING_FOR_ENTRY: 'รอจุดเข้า', OPEN: 'เข้าแล้ว', TARGET: 'ถึงเป้า', STOP: 'ตัดขาดทุน', EXIT: 'ปิดตามกติกา', EXPIRED: 'หมดเวลารอ', REVIEW: 'ตรวจข้อมูล', AMBIGUOUS: 'ตรวจผล' };
const EVENT_LABEL = { PICK_READY: 'พบแผน', ENTRY: 'ยืนยันเข้า', TARGET: 'ถึงเป้า', STOP: 'แตะจุดตัดขาดทุน', EXIT: 'ออกตามกติกา', EXPIRED: 'หมดเวลารอ', ENTRY_SKIPPED: 'ข้ามจุดเข้า', DATA_GAP: 'ข้อมูลขาดช่วง', AMBIGUOUS: 'ต้องตรวจลำดับราคา', SESSION_END: 'จบรอบติดตาม' };
const at = value => {
  if (!value) return '—';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('th-TH', { timeZone: dateOnly ? 'UTC' : 'Asia/Bangkok', day: '2-digit', month: 'short', ...(dateOnly ? {} : { hour: '2-digit', minute: '2-digit', hour12: false }) });
};
const eventTime = event => event.barDay ? `แท่งวัน ${at(event.barDay)}` : Number.isFinite(event.barTime) ? `แท่งเริ่ม ${at(new Date(event.barTime * 1000).toISOString())}` : `บันทึก ${at(event.createdAt)}`;
const price = (value, market) => Number.isFinite(value)
  ? `${market === 'us' ? '$' : ''}${value.toLocaleString('en-US', { maximumFractionDigits: value < 1 ? 5 : 2 })}` : '—';
const percent = value => Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : '—';

export default function SignalResults({ onSelect, loginHref = '/account' }) {
  const [market, setMarket] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(`/api/auto-pick/results?market=${market}&status=${status}&page=${page}`, { cache: 'no-store', signal: controller.signal });
        const payload = await response.json();
        if (!controller.signal.aborted) { setData(payload); setError(!response.ok); }
      } catch { if (!controller.signal.aborted) setError(true); }
    }
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [market, status, page, revision]);
  const summary = data?.summary;
  const rows = data?.signals ?? [];
  const closed = summary?.closed ?? 0;
  async function copyActualResults() {
    const text = `Nugaom AI Pick · ผลสัญญาณที่ระบบบันทึก\nตลาด: ${MARKETS.find(([id])=>id===market)?.[1]}\nช่วง ${summary.from ? at(summary.from) : '—'} – ${summary.to ? at(summary.to) : '—'}\nเข้า ${summary.entered} สัญญาณ · ปิดผล ${summary.closed} · ชนะ ${summary.wins} · แพ้ ${summary.losses} · เสมอ ${summary.flat}\nอัตราชนะ ${closed ? `${summary.winRate.toFixed(1)}%` : 'ยังไม่มีผลปิด'} จากสัญญาณที่เข้าและปิดผลได้\nราคาอ้างอิงจากแท่งที่ระบบตรวจพบ ก่อนค่าธรรมเนียมและสลิปเพจ · ไม่ใช่ผลซื้อขายลูกค้า`;
    try {await navigator.clipboard.writeText(text);setCopied(true);} catch {setCopied(false);}
  }
  return <section id="section-results" className="performance-section signal-results" aria-labelledby="signal-results-title">
    <div className="section-heading"><div><div className="eyebrow">ผลงานจากระบบ</div><h2 id="signal-results-title">ผลงานสัญญาณ</h2><p>ราคาเข้าและออกอ้างอิงจากแท่งราคาที่ระบบตรวจพบ · ไม่ใช่ราคาซื้อขายจริงของลูกค้า</p></div><button className="results-refresh" onClick={() => setRevision(value => value + 1)}>โหลดล่าสุด ↻</button></div>
    {error && <div className="results-message" role="status">อ่านประวัติสัญญาณไม่ได้ กรุณาลองโหลดใหม่</div>}
    {!data && !error && <div className="results-message" role="status">กำลังอ่านผลสัญญาณ…</div>}
    {data?.status === 'membership-required' && <div className="results-message"><strong>ผลสัญญาณสำหรับสมาชิก</strong><p>เข้าสู่ระบบ LINE เพื่อดูราคาเข้า ราคาออก และผลย้อนหลังของสัญญาณ</p><a href={loginHref}>เข้าสู่ระบบ / ดูสิทธิสมาชิก ↗</a></div>}
    {data?.status === 'available' && <>
      <p className="results-period">ผลสัญญาณที่ระบบบันทึกจริง · {summary.from ? at(summary.from) : 'ยังไม่มีรายการ'}{summary.to ? ` – ${at(summary.to)}` : ''}</p>
      <div className="stats-grid">
        <article className="panel stat-card"><span className="stat-label">เข้าเงื่อนไขแล้ว</span><strong className="stat-value">{summary.entered ?? 0}</strong><span className="stat-note">สัญญาณที่มีราคาเข้าบันทึกไว้</span></article>
        <article className="panel stat-card"><span className="stat-label">เข้าและปิดผลแล้ว</span><strong className="stat-value">{closed}</strong><span className="stat-note">ชนะ {summary.wins} · แพ้ {summary.losses} · เสมอ {summary.flat}</span></article>
        <article className="panel stat-card"><span className="stat-label">อัตราชนะจากไม้ปิด</span><strong className="stat-value accent">{closed ? `${summary.winRate.toFixed(1)}%` : '—'}</strong><span className="stat-note">{closed ? `ผลเฉลี่ย ${percent(summary.averageReturnPercent)} · ${Number.isFinite(summary.averageR) ? `${summary.averageR.toFixed(2)}R` : 'R —'}` : 'ยังไม่มีไม้ที่เข้าและปิดผล'}</span></article>
        <article className="panel stat-card"><span className="stat-label">กำลังติดตาม / รอเข้า</span><strong className="stat-value">{(data.counts?.OPEN ?? 0) + (data.counts?.WAITING_FOR_ENTRY ?? 0)}</strong><span className="stat-note">หมดเวลารอ {data.counts?.EXPIRED ?? 0} · ต้องตรวจ {((data.counts?.REVIEW ?? 0) + (data.counts?.AMBIGUOUS ?? 0))}</span></article>
      </div>
      <div className="results-share"><button className="results-refresh" disabled={!closed} onClick={copyActualResults}>{copied ? 'คัดลอกผลงานแล้ว ✓' : 'คัดลอกผลงานไปแชร์'}</button></div>
      <BacktestCard market={market} />
      <div className="panel history-panel">
        <div className="history-heading"><div><h2>รายการสัญญาณจากระบบ</h2><p>แสดงครั้งละ 7 รายการ · เลือกตลาดและสถานะเพื่อดูรายละเอียด</p></div><div className="results-filters"><select value={market} aria-label="เลือกตลาด" onChange={event => { setMarket(event.target.value); setPage(1); setCopied(false); }}>{MARKETS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><select value={status} aria-label="เลือกสถานะ" onChange={event => { setStatus(event.target.value); setPage(1); }}>{STATUSES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div></div>
        <div className="table-wrap"><table><thead><tr><th>สถานะ</th><th>สินทรัพย์</th><th>แผนรอเข้า</th><th>ราคาเข้า</th><th>ราคาออก</th><th>ผลอ้างอิง</th><th>เข้า / ออก</th></tr></thead><tbody>{rows.map(row => {
          const side = row.plan?.side === 'SHORT' ? -1 : 1;
          const change = Number.isFinite(row.entryPrice) && row.entryPrice > 0 && Number.isFinite(row.exitPrice)
            ? side * (row.exitPrice - row.entryPrice) / row.entryPrice * 100 : null;
          const complete = ['TARGET', 'STOP', 'EXIT'].includes(row.status) && change !== null;
          const risk = Math.abs(row.entryPrice - row.plan?.stopLoss);
          const rMultiple = complete && Number.isFinite(risk) && risk > 0 ? side * (row.exitPrice - row.entryPrice) / risk : null;
          return <Fragment key={row.id}><tr><td><span className={`result-pill ${complete ? change > 0 ? 'win' : change < 0 ? 'loss' : 'pending' : 'pending'}`}><i />{STATUS_LABEL[row.status] ?? row.status}</span></td><td><button className="results-symbol" onClick={() => onSelect(row.symbol)}>{row.symbol} ↗</button><span className="asset-market">{MARKETS.find(([id]) => id === row.market)?.[1] ?? row.market}</span><button className="results-events-toggle" aria-expanded={expanded === row.id} onClick={() => setExpanded(current => current === row.id ? null : row.id)}>{expanded === row.id ? 'ซ่อนเหตุการณ์' : `ลำดับเหตุการณ์ ${row.events?.length ?? 0} ครั้ง`}</button></td><td>{price(row.plan?.entry, row.market)}</td><td>{price(row.entryPrice, row.market)}</td><td>{price(row.exitPrice, row.market)}</td><td className={complete ? change > 0 ? 'positive' : change < 0 ? 'negative' : '' : 'muted-cell'}>{complete ? <>{percent(change)}{Number.isFinite(rMultiple) && <small className="results-source">{rMultiple.toFixed(2)}R</small>}</> : '—'}</td><td className="muted-cell">{at(row.enteredAt)} / {at(row.exitedAt)}</td></tr>{expanded === row.id && <tr className="results-events-row"><td colSpan={7}><div className="results-events"><strong>เส้นทางสัญญาณ · {row.symbol}</strong><span>เผยแพร่ {at(row.publishedAt)}</span>{row.events?.length ? <ol>{row.events.map((event, index) => <li key={`${event.type}-${event.createdAt}-${index}`}><b>{EVENT_LABEL[event.type] ?? event.type}</b><span>{eventTime(event)} · ราคาอ้างอิง {price(event.price, row.market)}</span></li>)}</ol> : <p>ยังไม่มีเหตุการณ์บันทึกสำหรับสัญญาณนี้</p>}</div></td></tr>}</Fragment>;
        })}</tbody></table>{rows.length === 0 && <div className="results-message">ยังไม่มีสัญญาณในตัวกรองนี้</div>}</div>
        <div className="history-footnote results-footer"><span>พบ {data.total} สัญญาณ · หน้า {data.page} / {Math.max(1, Math.ceil(data.total / data.pageSize))} · คำนวณจากราคาอ้างอิงก่อนค่าธรรมเนียมและสลิปเพจ</span><div><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>ก่อนหน้า</button><button disabled={page * data.pageSize >= data.total} onClick={() => setPage(value => value + 1)}>ถัดไป</button></div></div>
      </div>
    </>}
  </section>;
}
