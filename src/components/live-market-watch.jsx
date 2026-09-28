'use client';

import { useEffect, useMemo, useState } from 'react';
import { ALL_ASSETS } from '../markets/catalog.mjs';
import { formatQuotePrice } from '../markets/quote-format.mjs';

function shortTime(value) {
  if (!value) return 'ไม่ทราบเวลาแหล่งข้อมูล';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'ไม่ทราบเวลาแหล่งข้อมูล'
    : date.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
}

function compactVolume(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value) : '—';
}

export default function LiveMarketWatch({ market, asset, favorites, selectedQuote, quoteState = 'idle', analysis, freshness, timeframe = '1D', onSelect, onToggleFavorite, onOpenSearch, onOpenVolume, onOpenScanner, onRefreshQuote }) {
  const [tab, setTab] = useState('market');
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const [quotes, setQuotes] = useState({});
  const [watchState, setWatchState] = useState('idle');
  const [receivedAt, setReceivedAt] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const marketAssets = useMemo(() => market.sections.flatMap(item => item.assets), [market]);
  const favoriteAssets = ALL_ASSETS.filter(item => favorites.includes(item.symbol));
  const allRows = tab === 'favorites' ? favoriteAssets : marketAssets;
  const rows = allRows.filter(item => (tab === 'favorites' || section === 'all' || item.sectionId === section)
    && `${item.symbol} ${item.name} ${item.theme ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((left, right) => Number(right.instrumentId === asset.instrumentId) - Number(left.instrumentId === asset.instrumentId));
  const quoteSymbols = [asset, ...rows.filter(item => favorites.includes(item.symbol)), ...rows]
    .filter(item => item.feed === 'settrade-daily')
    .map(item => item.symbol)
    .filter((symbol, index, all) => all.indexOf(symbol) === index)
    .slice(0, 6)
    .join(',');
  const fmpSelected = asset.feed === 'fmp-quote' && selectedQuote?.price > 0;

  useEffect(() => { setSection('all'); setQuery(''); setTab('market'); }, [market.id]);

  useEffect(() => {
    if (!quoteSymbols) { setWatchState('no-feed'); return undefined; }
    const controller = new AbortController();
    async function refresh() {
      setWatchState(current => current === 'available' ? 'refreshing' : 'loading');
      try {
        const response = await fetch(`/api/market-watch?symbols=${encodeURIComponent(quoteSymbols)}`, { cache: 'no-store', signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !Array.isArray(payload.quotes)) throw new Error(payload.code ?? 'SOURCE_UNAVAILABLE');
        setQuotes(current => ({ ...current, ...Object.fromEntries(payload.quotes.map(quote => [quote.symbol, quote])) }));
        setReceivedAt(payload.receivedAt);
        setWatchState(payload.status === 'available' ? 'available' : 'unavailable');
      } catch (error) {
        if (error.name !== 'AbortError') setWatchState('unavailable');
      }
    }
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [quoteSymbols, refreshNonce]);

  return <aside id="section-watchlist" className="watch-strip panel live-market-watch" aria-label="Live Market Watch">
    <div className="live-watch-top"><span className="live-watch-kicker"><i /> WATCHLIST / MARKET DESK</span><button onClick={onOpenSearch} aria-label="ค้นหา symbol ทุกตลาด" title="ค้นหา symbol ทุกตลาด">⌕</button></div>
    <div className="live-watch-title"><div><h2>Live Market Watch</h2><p>{market.label} · {marketAssets.length} symbols</p></div><span className={watchState === 'available' || watchState === 'refreshing' || fmpSelected ? 'watch-source active' : 'watch-source'}>{watchState === 'loading' || quoteState === 'loading' ? 'LOADING' : watchState === 'available' || watchState === 'refreshing' ? 'QUOTE SNAPSHOT' : fmpSelected ? 'FMP QUOTE' : 'NO FEED'}</span></div>
    <div className="watch-feature-links"><button onClick={onOpenVolume}>◒ Volume Pulse ↗</button><button onClick={onOpenScanner}>◈ Scanner ↗</button></div>
    <div className="live-watch-tabs" role="tablist" aria-label="หมวด Market Watch">
      {[['market', 'MARKET'], ['levels', 'LEVELS'], ['favorites', `FAVORITES ${favorites.length}`]].map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}>{label}</button>)}
    </div>
    {tab === 'levels' ? <div className="live-watch-levels"><div className="watch-level-symbol"><span>{asset.symbol}</span><small>{freshness === 'recent' ? `แท่ง ${timeframe} ล่าสุด` : 'รอข้อมูลปัจจุบัน'}</small></div>{analysis ? <><div className="watch-level-grid"><div><small>แนวรับ</small><strong>{formatQuotePrice(analysis.support, asset)}</strong></div><div><small>แนวต้าน</small><strong>{formatQuotePrice(analysis.resistance, asset)}</strong></div></div><div className="watch-level-events">{freshness === 'recent' ? analysis.events.map(event => <span key={event.label}>{event.label}</span>) : <span>ข้อมูลเก่า · พักการสแกน</span>}</div><p>จุดสแกนของ symbol ที่เลือก · คำนวณจากแท่งจริง {timeframe}</p></> : <div className="watch-level-empty">ยังไม่มีแท่งจริงเพียงพอสำหรับแนวรับ แนวต้าน และจุดสแกน</div>}</div> : <>
      <label className="live-watch-search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={tab === 'favorites' ? 'ค้นหาในคู่โปรด' : `ค้นหาใน ${market.label}`} /></label>
      {tab === 'market' && market.sections.length > 1 && <div className="live-watch-sections"><button className={section === 'all' ? 'selected' : ''} onClick={() => setSection('all')}>ทั้งหมด {marketAssets.length}</button>{market.sections.map(item => <button key={item.id} className={section === item.id ? 'selected' : ''} onClick={() => setSection(item.id)}>{item.id === 'MAI_INITIAL' ? 'mai' : item.id === 'US_STOCKS' ? 'หุ้นสหรัฐฯ' : item.id === 'US_ETFS' ? 'ETF' : item.id} {item.assets.length}</button>)}</div>}
      <div className="live-watch-status"><span>{rows.length} รายการ · {market.id === 'us' || market.id === 'forex' ? 'เปิดตัวที่ต้องการเพื่อโหลดราคา quote' : `ติดตามราคา ${quoteSymbols ? quoteSymbols.split(',').length : 0} ตัวต่อรอบ`}</span><button onClick={() => quoteSymbols ? setRefreshNonce(value => value + 1) : onRefreshQuote?.()} disabled={quoteSymbols ? watchState === 'loading' : asset.feed !== 'fmp-quote' || quoteState === 'loading'} aria-label="รีเฟรช Market Watch" title="รีเฟรชราคาที่ติดตาม">↻</button></div>
      <div className="live-watch-rows" aria-busy={watchState === 'loading'}>{watchState === 'loading' && tab === 'market' && !query ? <div className="watch-skeleton-list" aria-label="กำลังโหลดรายการราคา">{Array.from({ length: 6 }, (_, index) => <div className="watch-skeleton-row" key={index}><span><i className="ui-skeleton-line" /><i className="ui-skeleton-line" /></span><span><i className="ui-skeleton-line" /><i className="ui-skeleton-line" /></span></div>)}</div> : rows.map(item => {
        const fallback = item.symbol === asset.symbol && selectedQuote?.price ? { ...selectedQuote, status: 'available' } : null;
        const quote = quotes[item.symbol]?.status === 'available' ? quotes[item.symbol] : fallback;
        const change = quote?.changePercent;
        const selected = item.instrumentId === asset.instrumentId;
        return <div className={selected ? 'live-watch-row selected' : 'live-watch-row'} key={item.instrumentId}><button className="watch-row-main" onClick={() => onSelect(item)}><span className="watch-row-symbol"><strong>{item.symbol}</strong><small>{item.name === item.symbol ? item.sectionId : item.name}</small></span><span className="watch-row-price"><strong>{quote ? formatQuotePrice(quote.price, item) : '—'}</strong><small className={typeof change === 'number' ? change >= 0 ? 'positive' : 'negative' : ''}>{typeof change === 'number' ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : item.feed === 'settrade-daily' || item.feed === 'fmp-quote' ? 'เลือกเพื่อโหลด' : 'รอฟีดราคา'}</small></span></button><button className="watch-row-favorite" onClick={() => onToggleFavorite(item.symbol)} aria-label={`${favorites.includes(item.symbol) ? 'เอาออกจาก' : 'เพิ่มใน'}คู่โปรด ${item.symbol}`} aria-pressed={favorites.includes(item.symbol)}>{favorites.includes(item.symbol) ? '★' : '☆'}</button>{selected && quote && <div className="watch-row-extra"><span>H <b>{formatQuotePrice(quote.high, item)}</b></span><span>L <b>{formatQuotePrice(quote.low, item)}</b></span><span>VOL <b>{compactVolume(quote.volume)}</b></span><small>{quote.observedAt ? `เวลา quote ${shortTime(quote.observedAt)}` : 'ผู้ให้บริการไม่ระบุเวลา quote'}</small></div>}</div>;
      })}{watchState !== 'loading' && rows.length === 0 && <div className="watch-level-empty">{tab === 'favorites' ? 'ยังไม่มีคู่โปรด กดดาวในรายการตลาดเพื่อเพิ่ม' : 'ไม่พบ symbol ในหมวดนี้'}</div>}</div>
      <div className="live-watch-foot"><span>{watchState === 'available' || watchState === 'refreshing' ? `Settrade snapshot · รับจาก API ${shortTime(receivedAt)} · เรียกใหม่ทุก 60 วินาที` : fmpSelected ? `FMP quote · เวลาแหล่งข้อมูล ${shortTime(selectedQuote.observedAt)} · โหลดเมื่อเลือก` : watchState === 'loading' ? 'กำลังรับราคา snapshot' : market.id === 'us' || market.id === 'forex' ? 'เลือกสินทรัพย์เพื่อเรียก FMP quote' : 'หมวดนี้ยังไม่มีฟีดราคาที่เชื่อมต่อ'}</span><button onClick={onOpenSearch}>ทุกตลาด ↗</button></div>
    </>}
  </aside>;
}
