'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AudioLines, Check, CircleAlert, FlaskConical, RefreshCw, Search } from 'lucide-react';
import CandlestickChart from './candlestick-chart.jsx';
import { analyzeCandles } from '../analysis/technical.mjs';
import { aggregateMinutes, usClock } from '../analysis/us-candles.mjs';

const STATES = { IDLE: 'ยังไม่สแกน', RUNNING: 'กำลังสแกน', COMPLETE: 'สแกนครบแล้ว', PARTIAL: 'มีข้อมูลขาด', FAILED: 'สแกนไม่สำเร็จ', INTERRUPTED: 'รอบสแกนหยุดกลางทาง' };
const TRADE_STATES = { TARGET: 'ถึงเป้า', STOP: 'ตัดขาดทุน', TIME_EXIT: 'ปิดตามเวลา', OPEN: 'ยังเปิดอยู่', AMBIGUOUS: 'แตะสองระดับ', DATA_GAP: 'ข้อมูลขาดช่วง' };
const ERRORS = { FORBIDDEN: 'บัญชีนี้ไม่มีสิทธิผู้ดูแล', SANDBOX_US_REQUIRED: 'ต้องตั้งค่าคีย์ US Sandbox ก่อน', BARS_UNAVAILABLE: 'ยังไม่มีแท่งของหุ้นนี้ในรอบล่าสุด',
  SCANNER_START_FAILED: 'เริ่มตัวสแกนไม่ได้', SDK_RUNTIME_UNAVAILABLE: 'ยังไม่มี Python SDK บนเครื่องที่รันเว็บ', RATE_LIMITED: 'ถึงโควตา API · รอรอบถัดไป',
  NO_BARS: 'ผู้ให้บริการไม่คืนแท่งที่ใช้ได้', INVALID_SYMBOL: 'Webull ไม่รองรับสัญลักษณ์นี้', INVALID_BAR_DATA: 'พบแท่งผิดรูปแบบ · ไม่ใช้สร้างแผน' };
const price = value => Number.isFinite(value) ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const date = value => value ? new Date(typeof value === 'number' ? value * 1000 : value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const DEFAULT_INDICATORS = { ema20: true, ema50: true, volume: true, vwap: true, bollinger: false, donchian: false, levels: false };

export default function WebullLab() {
  const [run, setRun] = useState(null), [selected, setSelected] = useState('AAPL');
  const [series, setSeries] = useState(null), [query, setQuery] = useState('');
  const [frame, setFrame] = useState(5), [range, setRange] = useState('recent');
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);
  const [starting, setStarting] = useState(false), [loadingBars, setLoadingBars] = useState(false);
  const [error, setError] = useState(''), [barsError, setBarsError] = useState('');
  const [automatic, setAutomatic] = useState(false), [message, setMessage] = useState('');
  const [voiceReady, setVoiceReady] = useState(false), [announcement, setAnnouncement] = useState('');
  const [page, setPage] = useState(0);

  const refresh = useCallback(async signal => {
    const response = await fetch('/api/admin/webull', { cache: 'no-store', signal });
    const payload = await response.json();
    if (!response.ok) throw new Error(ERRORS[payload.error] || 'อ่านผลสแกนไม่ได้');
    setRun(payload); setError('');
    return payload;
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    const poll = async () => {
      let status;
      try { status = (await refresh(controller.signal)).status; }
      catch (failure) { if (!controller.signal.aborted) setError(failure.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); }
      if (!controller.signal.aborted) timer = setTimeout(poll, status === 'RUNNING' ? 5000 : 15000);
    };
    poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [refresh]);
  const start = useCallback(async () => {
    setStarting(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/webull', { method: 'POST', cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(ERRORS[payload.error] || 'เริ่มสแกนไม่ได้');
      if (!payload.accepted) setMessage('ใช้รอบปัจจุบัน · ระบบเปิดรอบใหม่ได้ทุก 5 นาที');
      else setMessage('เริ่มรอบใหม่แล้ว · อ่านแท่งครบทุกตัวและคัดเงื่อนไขจากแท่งปิด');
      await refresh();
    } catch (failure) { setError(failure.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); }
    finally { setStarting(false); }
  }, [refresh]);
  useEffect(() => {
    if (!automatic) return;
    const timer = setInterval(start, 300000);
    return () => clearInterval(timer);
  }, [automatic, start]);
  const selectedRow = run?.rows?.find(row => row.symbol === selected);
  useEffect(() => {
    setSeries(null); setBarsError(''); setLoadingBars(false);
    if (selectedRow?.status !== 'available') return;
    const controller = new AbortController();
    setLoadingBars(true);
    fetch(`/api/admin/webull?symbol=${encodeURIComponent(selected)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(ERRORS[data.error] || 'โหลดกราฟไม่ได้'); return data; })
      .then(data => { if (!controller.signal.aborted) setSeries(data); })
      .catch(failure => { if (!controller.signal.aborted) setBarsError(failure.message || 'โหลดกราฟไม่ได้'); })
      .finally(() => { if (!controller.signal.aborted) setLoadingBars(false); });
    return () => controller.abort();
  }, [selected, run?.runId, selectedRow?.status, selectedRow?.latestTime]);
  useEffect(() => { setVoiceReady('speechSynthesis' in window); return () => window.speechSynthesis?.cancel(); }, []);

  const bars = useMemo(() => series ? aggregateMinutes(series.bars, frame) : null, [series, frame]);
  const analysis = useMemo(() => {
    if (!bars?.length) return null;
    const value = analyzeCandles(bars, null, `${frame} นาที`, { timeframe: frame === 60 ? '1h' : `${frame}m` });
    if (!value) return null;
    let day = '', volume = 0, total = 0;
    value.vwapSeries = bars.map(bar => {
      const current = usClock(bar.time).day;
      if (day !== current) { day = current; volume = 0; total = 0; }
      volume += bar.volume; total += (bar.high + bar.low + bar.close) / 3 * bar.volume;
      return volume > 0 ? { time: bar.time, value: total / volume } : null;
    }).filter(Boolean);
    return value;
  }, [bars, frame]);
  const plan = series ? selectedRow?.plan ?? series.plan : null;
  const lastTrade = series?.replay?.trades?.at(-1);
  const openTrade = lastTrade?.status === 'OPEN' ? lastTrade : null;
  const voiceText = plan?.speech || (lastTrade ? `ผลทดลองย้อนหลังแซนด์บ็อกซ์ ${selected} แท่งปิดเข้าเงื่อนไขที่ราคา ${price(lastTrade.entry).slice(1)} ดอลลาร์ เป้าหมาย ${price(lastTrade.target).slice(1)} ตัดขาดทุน ${price(lastTrade.stop).slice(1)}` : null);
  const levels = useMemo(() => {
    const reference = openTrade || (plan?.entryConfirmed ? plan : null);
    return reference ? [
      { title: 'เข้า · แท่งปิด', price: reference.entry, color: '#82a7ff' },
      { title: 'SL · ทดลอง', price: reference.stop, color: '#fa7185' },
      { title: 'TP · 2R', price: reference.target, color: '#53d6aa' },
    ] : [];
  }, [plan, openTrade]);
  const rows = useMemo(() => [...(run?.rows ?? [])].sort((a, b) => (b.plan?.score ?? -1) - (a.plan?.score ?? -1))
    .filter(row => row.symbol.includes(query.trim().toUpperCase())), [run?.rows, query]);
  const totalPages = Math.max(1, Math.ceil(rows.length / 7)), currentPage = Math.min(page, totalPages - 1);
  const totals = (run?.rows ?? []).reduce((sum, row) => {
    for (const key of Object.keys(sum)) sum[key] += row.replay?.[key] ?? 0;
    return sum;
  }, { entries: 0, resolved: 0, wins: 0, losses: 0, unresolved: 0 });
  function speak() {
    if (!voiceText || !voiceReady) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(voiceText);
    utterance.lang = 'th-TH'; utterance.rate = 1;
    const voice = window.speechSynthesis.getVoices().find(item => item.lang.startsWith('th'));
    if (voice) utterance.voice = voice;
    setAnnouncement(voiceText);
    utterance.onerror = () => setAnnouncement('เบราว์เซอร์อ่านเสียงไม่สำเร็จ · ข้อความจุดเข้ายังดูได้ในการ์ด');
    window.speechSynthesis.speak(utterance);
  }

  return <main className="webull-lab">
    <header className="lab-header"><a href="/admin"><ArrowLeft size={17} />กลับหลังบ้าน</a><span><FlaskConical size={18} />NUGAOM / US LAB</span><a href="/us">หน้าหุ้นสหรัฐฯ</a></header>
    <section className="lab-hero"><div><span className="lab-kicker">WEBULL SDK · SANDBOX</span><h1>ให้แท่งราคาพิสูจน์<em>เงื่อนไขสแกน</em></h1><p>หุ้นสภาพคล่องสูง 500 ตัว · สูงสุด 1,200 แท่ง 1 นาทีต่อหุ้น · ตรวจจุดเข้าเมื่อแท่ง 5 นาทีปิด</p></div><div className="lab-run-action"><button onClick={start} disabled={starting || run?.status === 'RUNNING' || run?.configured === false}><RefreshCw size={17} className={run?.status === 'RUNNING' ? 'lab-spin' : ''} />{starting || run?.status === 'RUNNING' ? 'กำลังสแกนทุกตัว…' : 'สแกนหุ้น 500 ตัว'}</button><label><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} />สแกนซ้ำทุก 5 นาทีขณะเปิดหน้านี้</label></div></section>
    <div className="lab-sandbox-note"><FlaskConical size={19} /><p><strong>พื้นที่ทดลองของผู้ดูแล</strong> ข้อมูล Sandbox อาจล่าช้าและยังไม่ยืนยันสิทธิข้อมูล Production ผลหน้านี้แยกจากสัญญาณและผลงานลูกค้า</p></div>
    {error && <p className="lab-error" role="alert"><CircleAlert size={17} />{error}</p>}
    {message && <p className="lab-message" role="status">{message}</p>}
    <section className="lab-metrics" aria-label="ความครบของข้อมูล"><article><span>สถานะรอบ</span><strong>{STATES[run?.status] || 'กำลังอ่านผล'}</strong><small>เริ่ม {date(run?.startedAt)}</small></article><article><span>ดึงข้อมูลใช้ได้</span><strong>{run?.available ?? 0}<em> / {run?.universeCount ?? 500}</em></strong><small>ตรวจแล้ว {run?.processed ?? 0} ตัว · ขาด {run?.missing ?? 0} ตัว</small></article><article><span>ตรงเงื่อนไขแท่งล่าสุด</span><strong>{run?.matches ?? 0}<em> ตัว</em></strong><small>คะแนนเงื่อนไข ≠ โอกาสชนะ</small></article><article><span>อัปเดตรอบล่าสุด</span><strong className="lab-metric-date">{date(run?.updatedAt)}</strong><small>รายชื่ออ้างอิง {run?.universeAsOf || '—'}</small></article></section>
    <div className="lab-grid"><section className="lab-universe"><div className="lab-section-head"><h2>ผลสแกนทุกตัว</h2><span>{rows.length} รายการ</span></div><label className="lab-search"><Search size={17} /><input aria-label="ค้นหาหุ้นทดลอง" placeholder="ค้นหา AAPL, NVDA…" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /></label>
      <div className="lab-symbols">{rows.slice(currentPage * 7, currentPage * 7 + 7).map(row => <button key={row.symbol} className={row.symbol === selected ? 'selected' : ''} onClick={() => setSelected(row.symbol)}><div><strong>{row.symbol}</strong><span>{row.status === 'available' ? `${row.count.toLocaleString()} แท่ง · ${price(row.lastClose)}` : ERRORS[row.code] || row.code}</span></div><div><b>{row.plan?.score ?? '—'}<small>/100</small></b><em className={row.plan?.entryConfirmed ? 'match' : ''}>{row.plan?.status === 'MATCH' ? 'เข้าเงื่อนไข' : row.plan?.status === 'HISTORICAL_MATCH' ? 'ตรงเงื่อนไขอดีต' : row.status === 'available' ? 'รอยืนยัน' : 'ข้อมูลขาด'}</em></div></button>)}</div>
      {!rows.length && <p className="lab-empty">{run?.status === 'RUNNING' ? 'กำลังอ่านข้อมูลชุดแรก…' : 'กดสแกนเพื่ออ่านแท่งและประเมินเงื่อนไข'}</p>}
      <div className="lab-pagination"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</button><span>{currentPage + 1} / {totalPages}</span><button disabled={currentPage + 1 >= totalPages} onClick={() => setPage(currentPage + 1)}>ถัดไป</button></div><p className="lab-caption">แสดงครั้งละ 7 ตัว · ดึงเป็นชุดและจำกัดรอบทุก 5 นาที</p></section>
      <section className="lab-chart-panel"><div className="lab-section-head"><div><h2>{selected} <span>Sandbox</span></h2><p>{series ? `${series.bars.length.toLocaleString()} แท่ง 1m · ${date(series.bars[0]?.time)} ถึง ${date(series.bars.at(-1)?.time)}` : 'รอข้อมูลจากรอบสแกนล่าสุด'}</p></div><b>{price(series?.bars.at(-1)?.close)}</b></div>
        <div className="lab-chart-tools"><div>{[1, 5, 15, 60].map(value => <button className={frame === value ? 'selected' : ''} key={value} onClick={() => setFrame(value)}>{value === 60 ? '1h' : `${value}m`}</button>)}</div><button onClick={() => setRange(value => value === 'all' ? 'recent' : 'all')}>{range === 'all' ? 'ดู 90 แท่งล่าสุด' : 'ดูทั้งหมด'}</button></div>
        <div className="lab-overlays">{[['ema20', 'EMA20'], ['ema50', 'EMA50'], ['vwap', 'VWAP วันนี้'], ['volume', 'Volume'], ['bollinger', 'BB'], ['donchian', 'Donchian']].map(([key, label]) => <button key={key} aria-pressed={indicators[key]} className={indicators[key] ? 'selected' : ''} onClick={() => setIndicators(value => ({ ...value, [key]: !value[key] }))}>{label}</button>)}</div>
        {openTrade && <p className="lab-open-trade">รายการทดลองยังเปิดอยู่ · เข้า {price(openTrade.entry)} · SL {price(openTrade.stop)} · TP {price(openTrade.target)} · ยืนยันจากแท่ง {date(openTrade.entryTime)}</p>}
        <CandlestickChart symbol={selected} timeframe={frame === 60 ? '1h' : `${frame}m`} bars={bars} analysis={analysis} indicators={indicators} chartRange={range} loading={loadingBars} source="Webull SDK Sandbox" timeZone="America/New_York" priceLines={levels} />
        {barsError && <p className="lab-error" role="alert">{barsError}</p>}
        <p className="lab-caption">{bars ? `${bars.length} แท่ง ${frame === 60 ? '1h' : `${frame}m`} · รวมจากแท่ง 1m ที่ครบช่วง · เวลากราฟนิวยอร์ก` : 'ไม่มีแท่งจริงในรอบนี้'}{series && ` · API ตอบ ${series.responseMs} ms (ไม่ใช่ความหน่วงราคาตลาด)`}{series?.delayMinutes != null && ` · ผู้ให้บริการระบุ delay ${series.delayMinutes} นาที`}</p>
      </section></div>
    <div className="lab-detail-grid"><section className="lab-plan"><div className="lab-section-head"><h2>ตรวจแท่งล่าสุด {selected}</h2><span className={plan?.entryConfirmed ? 'lab-match' : ''}>{plan?.status === 'HISTORICAL_MATCH' ? 'ตรงเงื่อนไขจากแท่งอดีต' : plan?.entryConfirmed ? 'ตรงเงื่อนไขทดลอง' : 'รอยืนยัน'}</span></div><p>{plan?.summary || 'ต้องอ่านข้อมูลที่ใช้ได้ก่อนประเมิน'}</p><div className="lab-plan-prices"><div><span>ราคาปิดอ้างอิง</span><strong>{price(plan?.entry)}</strong></div><div><span>Stop ตาม ATR / Swing</span><strong>{price(plan?.stop)}</strong></div><div><span>เป้าคำนวณ 2R</span><strong>{price(plan?.target)}</strong></div></div><p className="lab-caption">ระดับของแท่งล่าสุดสำหรับตรวจจุดเข้าใหม่ · ยังใช้แจ้งลูกค้าไม่ได้ · ข้อมูลแท่ง 5m เวลา {date(plan?.barTime)}</p>
      <div className="lab-checks">{plan?.checks?.map(check => <span key={check.label} className={check.ok ? 'ok' : ''}>{check.ok ? <Check size={15} /> : <CircleAlert size={15} />}{check.label}</span>)}</div>
      <details><summary>รายละเอียดเงื่อนไขและสิ่งที่ยังไม่ผ่าน</summary><p>ORB 15 นาที · EMA20/50 · VWAP รายวัน · Volume 1.2 เท่า · RSI 50–75 · ระยะเป้าอย่างน้อย 2R · หนึ่งจุดเข้าต่อหุ้นต่อวัน</p><p>{plan?.blockers?.join(' · ') || 'ครบทุกเงื่อนไขในแท่งนี้'}</p><p>รุ่นทดลอง {plan?.ruleVersion || '—'} · ยังไม่ผ่านการประเมินเพื่อเปิดใช้กับลูกค้า</p></details>
      <button className="lab-voice" disabled={!voiceText || !voiceReady} onClick={speak}><AudioLines size={17} />ฟังข้อความจุดเข้า Sandbox</button><p className="lab-caption">ใช้จุดเข้าที่ผ่านเงื่อนไขจริงในชุดทดลอง · รายการย้อนหลังจะพูดว่าเป็นผลย้อนหลัง</p>
    </section><section className="lab-replay"><div className="lab-section-head"><h2>ย้อนดูเงื่อนไขในชุดที่โหลด</h2><span>ผลทดลอง</span></div><p>นับจากหุ้นที่ดึงได้ {run?.available ?? 0} ตัวในรอบนี้ · ระยะย้อนหลังขึ้นกับ 1,200 แท่งที่ผู้ให้บริการคืน</p><div className="lab-replay-metrics"><div><span>เข้าเงื่อนไข</span><strong>{totals.entries}</strong></div><div><span>ปิดบวก</span><strong>{totals.wins}</strong></div><div><span>ปิดลบ</span><strong>{totals.losses}</strong></div><div><span>ยังสรุปไม่ได้</span><strong>{totals.unresolved}</strong></div></div>
      <p className="lab-caption">ยังไม่รวมค่าธรรมเนียมและ Slippage · แท่งเดียวแตะ TP/SL หรือข้อมูลขาดช่วงไม่นับเป็นชนะ/แพ้ · ผลทดลองนี้ไม่ใช่ผลงานสัญญาณลูกค้า</p><h3>รายการทดลอง {selected}</h3><div className="lab-replay-list">{series?.replay?.trades?.slice(-7).reverse().map(trade => <article key={trade.entryTime}><span>{TRADE_STATES[trade.status]}<small>{date(trade.entryTime)}</small></span><span>{price(trade.entry)} → {price(trade.exit)}</span><b>{trade.returnPercent == null ? '—' : `${trade.returnPercent > 0 ? '+' : ''}${trade.returnPercent.toFixed(2)}%`}</b></article>)}</div>{!series?.replay?.trades?.length && <p className="lab-empty">ยังไม่มีจุดเข้าที่ครบเงื่อนไขในชุดย้อนหลังของหุ้นนี้</p>}</section></div>
    {announcement && <aside className="lab-toast" role="status"><AudioLines size={22} /><p>{announcement}</p><button aria-label="ปิดข้อความเสียง" onClick={() => setAnnouncement('')}>×</button></aside>}
  </main>;
}
