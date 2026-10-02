'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeCandles } from '../analysis/technical.mjs';
import { ALL_ASSETS, MARKET_ASSETS, MARKET_GROUPS } from '../markets/catalog.mjs';

const FRAMES = [['15m', '15 นาที'], ['1h', '1 ชั่วโมง'], ['4h', '4 ชั่วโมง'], ['1d', '1 วัน']];

function number(value, digits = 2) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
}
const priceDigits = asset => asset.id === 'forex' ? asset.symbol.endsWith('/JPY') ? 3 : 5 : 2;

function timeLabel(series) {
  if (!series) return '—';
  const time = series.latestTime ? new Date(series.latestTime) : null;
  if (time && !Number.isNaN(time.valueOf())) return time.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const day = series.latestDay ? new Date(`${series.latestDay}T12:00:00+07:00`) : null;
  return day && !Number.isNaN(day.valueOf()) ? day.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: 'numeric' }) : series.latestDay ?? '—';
}

async function readSeries(symbol,timeframe,signal,feed='settrade-daily'){
 const asset=ALL_ASSETS.find(a=>a.symbol===symbol&&a.feed===feed);if(!asset)return null;
 const route=asset.id==='forex'||asset.id==='us'&&timeframe!=='1d'?'/api/history-bars':feed==='tfex-quote'?'/api/tfex/candles':feed==='fmp-quote'?'/api/us-bars':'/api/market-data';
 let response=await fetch(`${route}?symbol=${encodeURIComponent(symbol)}&market=${asset.id}&timeframe=${timeframe}`,{cache:'no-store',signal});
 let payload=await response.json();
 if((!response.ok||payload.status!=='available')&&feed!=='tfex-quote'&&route!=='/api/history-bars'&&timeframe!=='4h'){
  response=await fetch(`/api/history-bars?symbol=${encodeURIComponent(symbol)}&market=${asset.id}&timeframe=${timeframe}`,{cache:'no-store',signal});payload=await response.json();
 }
 if(!response.ok||payload.status!=='available'||payload.instrumentId!==asset.instrumentId||!Array.isArray(payload.bars)||payload.bars.length<50)return null;
 return payload;
}

function StatusNote({ children }) { return <div className="feature-status-note">{children}</div>; }

export function AmbientDepth() {
  const surface = useRef(null);
  useEffect(() => {
    // Native scroll timelines run without React renders; older browsers use a single passive rAF update.
    if (CSS.supports('animation-timeline', 'scroll(root block)')) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const range = document.documentElement.scrollHeight - window.innerHeight;
        const progress = reduced.matches || range <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / range));
        surface.current?.style.setProperty('--parallax-progress', String(progress));
        frame = 0;
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    reduced.addEventListener('change', update);
    update();
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); reduced.removeEventListener('change', update); window.cancelAnimationFrame(frame); };
  }, []);
  return <div ref={surface} className="ambient-depth scroll-depth" aria-hidden="true"><div className="parallax-layer parallax-far"><div className="ambient-depth-grid" /></div><div className="parallax-layer parallax-near"><div className="ambient-depth-orbit orbit-a" /><div className="ambient-depth-orbit orbit-b" /><div className="ambient-depth-point point-a" /><div className="ambient-depth-point point-b" /></div></div>;
}

export function MarketScanner({ asset, market, favorites, timeframe, onSelect }) {
  const [category, setCategory] = useState(market.id);
  const [query, setQuery] = useState('');
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState('loading');
  const [results, setResults] = useState({});
  const [expanded, setExpanded] = useState(asset.symbol);
  const [conditionFilter, setConditionFilter] = useState('');
  const candidates = useMemo(() => {
    const list = MARKET_ASSETS[category] ?? [];
    const matched = query.trim() ? list.filter(item => `${item.symbol} ${item.name}`.toLowerCase().includes(query.trim().toLowerCase())) : list;
    const preferred = [asset, ...ALL_ASSETS.filter(item => favorites.includes(item.symbol)), ...matched]
      .filter(item => item.id === category && ['settrade-daily','tfex-quote','fmp-quote'].includes(item.feed)
        && (!query.trim() || `${item.symbol} ${item.name}`.toLowerCase().includes(query.trim().toLowerCase())));
    return preferred.filter((item, index, all) => all.findIndex(entry => entry.symbol === item.symbol) === index).slice(0, 6);
  }, [asset, category, favorites, query]);
  const symbols = candidates.map(item => item.symbol).join(',');
  const conditions = useMemo(() => {
    const counts = new Map();
    for (const item of candidates) {
      const series = results[item.symbol];
      const scan = series ? analyzeCandles(series.bars, series.quote?.price ?? null, timeframe, {timeframe}) : null;
      for (const event of scan?.events ?? []) if (event.tone !== 'flat') counts.set(event.label, (counts.get(event.label) ?? 0) + 1);
    }
    return [...counts].sort((left, right) => right[1] - left[1]).slice(0, 5);
  }, [candidates, results, timeframe]);
  const visibleCandidates = conditionFilter ? candidates.filter(item => {
    const series = results[item.symbol];
    return series && analyzeCandles(series.bars, series.quote?.price ?? null, timeframe, {timeframe})?.events.some(event => event.label === conditionFilter);
  }) : candidates;

  useEffect(() => {
    const controller = new AbortController();
    if (!symbols) { setResults({}); setState('no-feed'); return () => controller.abort(); }
    const timeout = window.setTimeout(async () => {
      setState('loading');
      const loaded = await Promise.all(candidates.map(async item => {
        try { return [item.symbol, await readSeries(item.symbol, timeframe, controller.signal,item.feed)]; }
        catch { return [item.symbol, null]; }
      }));
      if (!controller.signal.aborted) { setResults(Object.fromEntries(loaded)); setState('ready'); }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [symbols, timeframe, revision, category]);

  return <div className="feature-body scanner-view">
    <div className="feature-intro"><div><span className="feature-kicker">REGIME SCANNER / RULE ENGINE</span><p>อ่านแนวโน้มของสินทรัพย์ที่เลือกจากแท่ง {timeframe.toUpperCase()} · กราฟสำรองไม่ใช้ยืนยัน AutoPick</p></div><button className="feature-refresh" onClick={() => setRevision(value => value + 1)}>↻ สแกนอีกครั้ง</button></div>
    <div className="feature-market-tabs">{MARKET_GROUPS.filter(group=>group.id===market.id).map(group => <button key={group.id} className={category === group.id ? 'selected' : ''} onClick={() => { setCategory(group.id); setQuery(''); setExpanded(''); setConditionFilter(''); }}>{group.label}</button>)}</div>
    <div className="scanner-controls"><label><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`ค้นหาใน ${MARKET_GROUPS.find(item => item.id === category)?.label ?? ''}`} /></label><span>{state === 'loading' ? 'กำลังสแกน…' : `ตรวจ ${candidates.length} symbols`}</span></div>
    <StatusNote>สแกนสูงสุด 6 ตัวต่อครั้งจากรายการที่เห็นด้วยฟีดของตลาดนี้ · หน้า AutoPick แยกต่างหากจะตรวจทั้งจักรวาลตามรอบตลาด · ไม่มีอัตราชนะที่ยังไม่ได้วัด</StatusNote>
    {conditions.length > 0 && <div className="scanner-condition-chips"><strong>เงื่อนไขที่พบ</strong><button className={!conditionFilter ? 'selected' : ''} onClick={() => setConditionFilter('')}>ทั้งหมด {candidates.length}</button>{conditions.map(([label, count]) => <button key={label} className={conditionFilter === label ? 'selected' : ''} onClick={() => setConditionFilter(label)}>{label} <b>{count}</b></button>)}</div>}
    <div className="scanner-table-wrap" aria-busy={state === 'loading'}><table className="scanner-table"><thead><tr><th>ASSET</th><th>STRUCTURE</th><th>RSI 14</th><th>PRICE</th><th>CONDITIONS</th><th aria-label="รายละเอียด" /></tr></thead><tbody>{state === 'loading' ? candidates.map(item => <tr className="scanner-skeleton-row" key={item.symbol}><td><strong>{item.symbol}</strong><i className="ui-skeleton-line" /></td><td><i className="ui-skeleton-line" /></td><td><i className="ui-skeleton-line" /></td><td><i className="ui-skeleton-line" /></td><td><i className="ui-skeleton-line" /></td><td /></tr>) : visibleCandidates.map(item => {
      const series = results[item.symbol];
      const evidence = series ? analyzeCandles(series.bars, series.quote?.price ?? null, timeframe, {timeframe}) : null;
      const trend = evidence?.trend === 'up' ? 'ขาขึ้น' : evidence?.trend === 'down' ? 'ขาลง' : evidence ? 'ออกข้าง' : 'รอฟีด';
      const open = expanded === item.symbol;
      return <FragmentRow key={item.symbol} item={item} series={series} evidence={evidence} trend={trend} open={open} loading={state === 'loading'} onExpand={() => setExpanded(open ? '' : item.symbol)} onSelect={() => onSelect(item)} />;
    })}</tbody></table>{state !== 'loading' && visibleCandidates.length === 0 && <div className="feature-empty">ไม่พบสัญลักษณ์ที่ตรงกับเงื่อนไขนี้</div>}</div>
  </div>;
}

function FragmentRow({ item, series, evidence, trend, open, loading, onExpand, onSelect }) {
  return <>
    <tr className={open ? 'scanner-row open' : 'scanner-row'}><td><button className="scanner-symbol" onClick={onSelect}><strong>{item.symbol} ↗</strong><small>{item.name}</small></button></td><td><span className={`trend-chip ${evidence?.trend ?? ''}`}>{trend}</span></td><td>{evidence ? number(evidence.rsi14, 1) : '—'}</td><td>{evidence ? number(evidence.price,priceDigits(item)) : '—'}</td><td>{evidence ? evidence.events.filter(event => event.tone !== 'flat').length : '—'}</td><td><button className="expand-button" aria-expanded={open} aria-label={`ดูรายละเอียด ${item.symbol}`} onClick={onExpand}>{open ? '⌃' : '⌄'}</button></td></tr>
    {open && <tr className="scanner-detail-row"><td colSpan={6}><div className="scanner-evidence"><div className="scanner-evidence-head"><span>◈ {item.symbol} · {series ? `${series.source} ${series.timeframe?.toUpperCase()} · ${timeLabel(series)}` : loading ? 'กำลังอ่านข้อมูล…' : 'ยังไม่มีข้อมูลแท่งเพียงพอ'}</span><button onClick={onSelect}>เปิดกราฟ ↗</button></div>{evidence ? <><div className="scanner-metrics"><span>แนวรับ <b>{number(evidence.support,priceDigits(item))}</b></span><span>แนวต้าน <b>{number(evidence.resistance,priceDigits(item))}</b></span><span>EMA20 <b>{number(evidence.ema20,priceDigits(item))}</b></span><span>EMA50 <b>{number(evidence.ema50,priceDigits(item))}</b></span></div><div className="condition-list">{evidence.events.map(event => <span key={event.label} className={event.tone}>{event.label}</span>)}</div><p>{evidence.plan.rationale}</p></> : <p>เลือกดูสินทรัพย์นี้บนกราฟเพื่อเช็กข้อมูลราคาและสถานะฟีด</p>}</div></td></tr>}
  </>;
}

export function MultiTimeframe({ asset, onSelectFrame }) {
  const [series, setSeries] = useState({});
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const frames = ['us','forex'].includes(asset.id) ? FRAMES.filter(([frame]) => frame !== '4h')
    : asset.feed === 'settrade-daily' || asset.feed === 'tfex-quote' ? FRAMES : [];
  useEffect(() => {
    if (!frames.length) { setLoading(false); setSeries({}); return undefined; }
    const controller = new AbortController();
    setLoading(true);
    Promise.all(frames.map(async ([frame]) => {
      try { return [frame, await readSeries(asset.symbol, frame, controller.signal, asset.feed)]; }
      catch { return [frame, null]; }
    })).then(loaded => { if (!controller.signal.aborted) { setSeries(Object.fromEntries(loaded)); setLoading(false); } });
    return () => controller.abort();
  }, [asset.symbol, asset.feed, asset.id, revision]);

  return <div className="feature-body"><div className="feature-intro"><div><span className="feature-kicker">STRUCTURE ACROSS TIME</span><p>{asset.symbol} · เปรียบเทียบเฉพาะกรอบเวลาที่อ่านแท่งจริงได้</p></div><button className="feature-refresh" onClick={() => setRevision(value => value + 1)}>↻ อัปเดต</button></div><StatusNote>{asset.feed === 'settrade-daily' ? 'แท่ง Settrade' : asset.feed === 'tfex-quote' ? 'แท่ง TFEX Open API' : asset.id === 'us' ? 'FMP รายวัน / Yahoo ย้อนหลัง' : 'Yahoo ย้อนหลังคู่เงิน (ไม่รวมวอลุ่มซื้อขายจริง)'  } · การ์ดที่ข้อมูลไม่พร้อมจะไม่แสดง</StatusNote><div className="mtf-grid" aria-busy={loading}>{frames.map(([frame, label]) => {
    const feed = series[frame];
    const result = feed ? analyzeCandles(feed.bars, feed.quote?.price ?? null, label, {timeframe:frame,dailyBars:series['1d']?.bars??[]}) : null;
    if (!loading && !feed) return null;
    return loading ? <div key={frame} className="mtf-card mtf-skeleton"><span className="mtf-card-top"><strong>{frame.toUpperCase()}</strong><i className="ui-skeleton-line" /></span><i className="ui-skeleton-line" /><div className="mtf-skeleton-metrics"><i className="ui-skeleton-line" /><i className="ui-skeleton-line" /><i className="ui-skeleton-line" /><i className="ui-skeleton-line" /></div><i className="ui-skeleton-line" /></div> : <button key={frame} className="mtf-card" onClick={() => onSelectFrame(frame)}><span className="mtf-card-top"><strong>{frame.toUpperCase()}</strong><small>{feed ? timeLabel(feed) : 'NO FEED'}</small></span><b className={result?.trend === 'up' ? 'positive' : result?.trend === 'down' ? 'negative' : ''}>{result?.trend === 'up' ? '↗ ขาขึ้น' : result?.trend === 'down' ? '↘ ขาลง' : result ? '→ ออกข้าง' : 'ยังวิเคราะห์ไม่ได้'}</b><div className="mtf-card-metrics"><span>ราคา <strong>{result ? number(result.price,priceDigits(asset)) : '—'}</strong></span><span>RSI <strong>{result ? number(result.rsi14, 1) : '—'}</strong></span><span>แนวรับ <strong>{result ? number(result.support,priceDigits(asset)) : '—'}</strong></span><span>แนวต้าน <strong>{result ? number(result.resistance,priceDigits(asset)) : '—'}</strong></span></div><small className="mtf-card-event">{result?.events[0]?.label ?? 'รอแท่งจริงอย่างน้อย 50 แท่ง'}</small><span className="mtf-card-link">เปิดกราฟ {frame.toUpperCase()} ↗</span></button>;
  })}</div>{!loading && !frames.some(([frame]) => series[frame]) && <div className="feature-empty">ยังไม่มีแท่งราคาที่ใช้เปรียบเทียบได้สำหรับ {asset.symbol}</div>}</div>;
}

export function VolumePulse({ asset, bars, timeframe, onOpenScanner }) {
  if (asset.id === 'forex') return <StatusNote>ฟีดคู่เงินนี้ไม่มีปริมาณซื้อขายรวมของตลาด จึงยังไม่แสดง Volume Pulse หรือสรุปแรงซื้อขายจาก volume</StatusNote>;
  const recent = bars?.slice(-16) ?? [];
  const baseline = bars?.slice(-36, -16) ?? [];
  const average = values => values.length ? values.reduce((sum, bar) => sum + (bar.volume ?? 0), 0) / values.length : 0;
  const recentAverage = average(recent);
  const baseAverage = average(baseline);
  const ratio = baseAverage > 0 ? recentAverage / baseAverage : null;
  const max = Math.max(1, ...recent.map(bar => bar.volume ?? 0));
  return <div className="feature-body"><div className="feature-intro"><div><span className="feature-kicker">VOLUME PULSE / {asset.symbol}</span><p>มุมมองกิจกรรมซื้อขายจากปริมาณแท่ง {timeframe.toUpperCase()} ของสินทรัพย์ที่เลือก</p></div><button className="feature-refresh" onClick={onOpenScanner}>ดู Scanner ↗</button></div><StatusNote>Volume Pulse คือปริมาณซื้อขาย ไม่ใช่ Fund Flow สุทธิหรือข้อมูล bid/ask · ไม่มีฟีด Fund Flow เชื่อมต่อในตอนนี้</StatusNote><div className="volume-summary"><div><small>ปริมาณเฉลี่ย 16 แท่ง</small><strong>{recent.length ? number(recentAverage, 0) : '—'}</strong></div><div><small>เทียบ 20 แท่งก่อนหน้า</small><strong className={ratio && ratio >= 1 ? 'positive' : ''}>{ratio ? `${number(ratio, 2)}×` : '—'}</strong></div><div><small>แท่งล่าสุด</small><strong>{recent.length ? number(recent.at(-1).volume, 0) : '—'}</strong></div></div>{recent.length ? <div className="volume-bars" aria-label="ปริมาณซื้อขาย 16 แท่งล่าสุด">{recent.map((bar, index) => <div key={`${bar.time}-${index}`} title={`แท่ง ${index + 1}: ${number(bar.volume, 0)}`}><span className={bar.close >= bar.open ? 'up' : 'down'} style={{ height: `${Math.max(7, (bar.volume / max) * 100)}%` }} /></div>)}</div> : <div className="feature-empty">ยังไม่มีแท่งจริงของ {asset.symbol} ในช่วงเวลา {timeframe.toUpperCase()} สำหรับกราฟปริมาณ</div>}<div className="flow-coming"><strong>Fund Flow Dashboard</strong><p>ส่วนนี้จะใช้ข้อมูลกระแสเงินจากแหล่งที่มีสิทธิ์ใช้งานเมื่อเชื่อมต่อสำเร็จ ขณะนี้แสดง Volume Pulse จาก OHLCV เพื่อสำรวจจังหวะกิจกรรมเท่านั้น</p></div></div>;
}

export function NewsGuide({ onOpenNews }) {
  return <div className="feature-body news-guide"><div className="news-guide-lead"><span className="news-guide-symbol">?</span><div><h3>อ่านข่าวตลาดอย่างมีบริบท</h3><p>ใช้ข่าวประกอบการติดตามราคาและแผน โดยตรวจแหล่งข่าว เวลาเผยแพร่ และผลกระทบที่ยังไม่แน่นอน</p></div></div><section><h3>What is market news?</h3><p>หัวข้อข่าวช่วยบอกเหตุการณ์ที่ตลาดอาจกำลังตอบสนอง การจัดหมวดและ sentiment เป็นเพียงการอ่านเนื้อหาเบื้องต้น ไม่ใช่ผลตอบแทนที่คาดการณ์ได้</p></section><section><h3>↗ Sentiment Analysis</h3><div className="guide-item green"><b>Bullish / เชิงบวก</b><span>เนื้อหาสื่อถึงปัจจัยหนุน แต่ราคาจริงอาจไม่ขึ้นตาม</span></div><div className="guide-item red"><b>Bearish / เชิงลบ</b><span>เนื้อหาสื่อถึงแรงกดดัน แต่ราคาจริงอาจไม่ลงตาม</span></div><div className="guide-item"><b>Neutral / กลาง</b><span>ยังไม่มีทิศทางชัดจากตัวข่าว</span></div></section><section><h3>ϟ Impact Levels</h3><div className="impact-row"><b>HIGH</b><span>เหตุการณ์ที่ควรเช็กเวลาและความผันผวน</span></div><div className="impact-row"><b>MED</b><span>อาจเกี่ยวข้องกับสินทรัพย์ที่ติดตาม</span></div><div className="impact-row"><b>LOW</b><span>ข่าวทั่วไปหรือมีผลกระทบจำกัด</span></div></section><section><h3>วิธีใช้ร่วมกับกราฟ</h3><ol><li>ดูเวลาข่าว เทียบกับแท่งราคาที่ปิดแล้ว</li><li>อ่านแหล่งข่าวต้นทางก่อนตัดสินใจ</li><li>เช็กแนวรับ แนวต้าน และความเสี่ยงบนกราฟ</li></ol></section><button className="feature-primary" onClick={onOpenNews}>เปิดข่าวตลาด ↗</button></div>;
}

export function NewsFeedState({ onOpenGuide, onOpenCalendar }) {
  const [state, setState] = useState({ status: 'loading', markets: [] });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState(current => ({ ...current, status: 'loading' }));
    fetch('/api/news', { signal: controller.signal })
      .then(async response => response.json())
      .then(payload => { if (!controller.signal.aborted) setState(payload); })
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'unavailable', code: 'NETWORK_ERROR', markets: [] }); });
    return () => controller.abort();
  }, [revision]);
  const errorMessages = {
    MARKETDX_NOT_CONFIGURED: 'ยังไม่ได้ตั้งค่าคีย์ MarketDX บนเซิร์ฟเวอร์',
    DISPLAY_RIGHTS_UNCONFIRMED: 'ยังไม่ยืนยันสิทธิแสดงข่าวต่อผู้ใช้',
    CREDITS_EXHAUSTED: 'เครดิตข่าวของแหล่งข้อมูลหมดแล้ว',
    RATE_LIMITED: 'แหล่งข้อมูลจำกัดคำขอชั่วคราว',
    AUTH_FAILED: 'คีย์ MarketDX ใช้งานไม่ได้',
    SOURCE_UNAVAILABLE: 'เชื่อมต่อแหล่งข่าวไม่ได้ชั่วคราว',
    NETWORK_ERROR: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้',
  };
  const topicLabels = { earnings_results: 'งบการเงิน', corporate_action: 'กิจการ', management_governance: 'ผู้บริหาร', product_tech: 'สินค้า/เทคโนโลยี', ma_partnership: 'ดีลธุรกิจ', industry_thematic: 'อุตสาหกรรม', macro_economic: 'เศรษฐกิจ', regulatory_legal: 'กฎเกณฑ์', analyst_rating: 'นักวิเคราะห์', geopolitics: 'ภูมิรัฐศาสตร์' };
  const markets = state.markets?.length ? state.markets : state.status === 'loading' ? [{ id: 'thai', label: 'หุ้นไทย', status: 'loading', articles: [] }, { id: 'us', label: 'หุ้นอเมริกา', status: 'loading', articles: [] }] : [];
  return <div className="feature-body market-news">
    <div className="feature-intro"><div><span className="feature-kicker">MARKET NEWS / MARKETDX</span><p>ข่าวหุ้นไทยและหุ้นอเมริกา อย่างละ 4 ข่าวล่าสุด · คัดตามประเทศที่หุ้นจดทะเบียน</p></div><div className="market-news-actions"><button className="feature-refresh" onClick={() => setRevision(value => value + 1)}>↻ โหลดใหม่</button><button className="feature-refresh" onClick={onOpenGuide}>? คู่มือ</button></div></div>
    <button className="fred-news-link" onClick={onOpenCalendar}><span>◷</span><strong>ติดตามวันประกาศและตัวเลขเศรษฐกิจสหรัฐฯ จาก FRED</strong><small>FRED เป็นข้อมูลเศรษฐกิจ ไม่ใช่พาดหัวข่าว</small><span>เปิด ↗</span></button>
    {(state.status === 'unconfigured' || state.status === 'unavailable' && !state.markets?.length) && <div className="feature-empty feature-news-empty" role="status"><strong>{errorMessages[state.code] ?? 'ยังดึงข่าวไม่ได้'}</strong><p>ระบบไม่แสดงข่าวตัวอย่างแทนข่าวจริง</p></div>}
    <div className="market-news-sections">{markets.map(market => <section className="market-news-market" key={market.id} aria-label={`ข่าว${market.label}`}><div className="market-news-market-head"><div><span className="market-news-flag">{market.id === 'thai' ? '🇹🇭' : '🇺🇸'}</span><h3>{market.label}</h3><small>ล่าสุดไม่เกิน 4 ข่าว</small></div><span>{market.status === 'stale' ? 'ข้อมูลเก่าจากแคช' : market.status === 'available' ? 'ข้อมูลจริง' : market.status === 'loading' ? 'กำลังโหลด' : 'ยังไม่พร้อม'}</span></div>
      {market.status === 'loading' && <div className="market-news-skeleton" aria-busy="true"><span className="ui-skeleton-line" /><span className="ui-skeleton-line" /><span className="ui-skeleton-line" /></div>}
      {market.status === 'unavailable' && <div className="feature-empty feature-news-empty"><strong>{errorMessages[market.code] ?? 'ยังดึงข่าวไม่ได้'}</strong><p>ลองโหลดใหม่อีกครั้งเมื่อแหล่งข้อมูลพร้อม</p></div>}
      {(market.status === 'available' || market.status === 'stale') && <><div className="market-news-list">{market.articles?.length ? market.articles.map(article => {
        const published = article.publishedAt ? new Date(article.publishedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) : 'ไม่ระบุเวลา';
        return <article className="market-news-card" key={article.id}><div className="market-news-card-top"><span className="market-news-source">{article.source}</span><span>{published}</span>{article.impactScore && <span>ความสำคัญ {article.impactScore}/5</span>}</div><h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title} ↗</a></h3>{article.brief && <p>{article.brief}</p>}<div className="market-news-card-foot">{article.newsTypes?.slice(0, 2).map(type => <span className="market-news-topic" key={type}>{topicLabels[type] ?? type.replaceAll('_', ' ')}</span>)}{article.entities?.length > 0 && <span>กล่าวถึง {article.entities.join(' · ')}</span>}</div></article>;
      }) : <div className="feature-empty feature-news-empty"><strong>ยังไม่มีข่าวหุ้นในหมวดนี้</strong><p>แหล่งข้อมูลตอบกลับสำเร็จ แต่ไม่มีรายการที่แสดงได้</p></div>}</div><p className="market-news-meta">ดึงล่าสุด {market.receivedAt ? new Date(market.receivedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) : '—'}</p></>}
    </section>)}</div>
    <p className="market-news-disclaimer">ข่าวแบ่งตามประเทศที่หุ้นจดทะเบียน · ประเภทข่าวจาก MarketDX ใช้จัดหมวดเนื้อหา ไม่ใช่สัญญาณซื้อขาย</p>
  </div>;
}
