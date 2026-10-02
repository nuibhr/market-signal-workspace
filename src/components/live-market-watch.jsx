'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Focus, Radar, RefreshCw, Search, Star } from 'lucide-react';
import { MARKET_ASSETS } from '../markets/catalog.mjs';
import { formatQuotePrice } from '../markets/quote-format.mjs';

const PAGE_SIZE = 6;
const positivePrice = value => Number.isFinite(value) && value > 0;
const shortTime = value => {
  const date = value ? new Date(value) : null;
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  return date && !Number.isNaN(date.valueOf()) ? date.toLocaleString('th-TH', { timeZone: dateOnly ? 'UTC' : 'Asia/Bangkok', day: '2-digit', month: 'short', ...(dateOnly ? {} : {hour: '2-digit', minute: '2-digit'}) }) : 'ต้นทางไม่ระบุเวลา';
};
const changeLabel = value => Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : '—';

export default function LiveMarketWatch({ market, asset, favorites, selectedQuote, series, analysis, timeframe = '1D', onSelect, onToggleFavorite, onOpenSearch, onOpenScanner, onRefreshQuote }) {
  const [tab, setTab] = useState('market');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [quotes, setQuotes] = useState({});
  const [watchState, setWatchState] = useState('idle');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const marketAssets = MARKET_ASSETS[market.id] ?? [];
  const favoriteAssets = marketAssets.filter(item => favorites.includes(item.symbol));
  const rows = (tab === 'favorites' ? favoriteAssets : marketAssets)
    .filter(item => `${item.symbol} ${item.name}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((left, right) => Number(right.instrumentId === asset.instrumentId) - Number(left.instrumentId === asset.instrumentId));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const quoteSymbols = visible.filter(item => ['settrade-daily','tfex-quote'].includes(item.feed)).map(item => item.symbol).join(',');
  const lastBar = series?.bars?.at(-1);
  const focusQuote = positivePrice(selectedQuote?.price) ? selectedQuote : positivePrice(lastBar?.close)
    ? { price: lastBar.close, observedAt: series.latestTime ?? series.latestDay, source: series.source, historical: true } : null;
  const isHistorical = Boolean(focusQuote?.historical || !selectedQuote?.price && series?.chartOnly);
  const support = analysis?.support;
  const resistance = analysis?.resistance;
  const current = focusQuote?.price;
  const hasRange = positivePrice(current) && positivePrice(support) && positivePrice(resistance) && support < resistance;
  const location = hasRange ? Math.max(0, Math.min(100, (current - support) / (resistance - support) * 100)) : null;
  const toSupport = hasRange ? (current - support) / current * 100 : null;
  const toResistance = hasRange ? (resistance - current) / current * 100 : null;

  useEffect(() => { setPage(1); }, [asset.instrumentId]);
  useEffect(() => { setPage(1); setTab('market'); setQuery(''); setQuotes({}); }, [market.id]);
  useEffect(() => {
    if (!quoteSymbols) { setWatchState('no-feed'); return undefined; }
    const controller = new AbortController();
    let loading = false;
    async function refresh() {
      if (loading) return;
      loading = true;
      setWatchState('loading');
      try {
        const response = await fetch(`${market.id === 'tfex' ? '/api/tfex/quotes' : '/api/market-watch'}?symbols=${encodeURIComponent(quoteSymbols)}`, { cache: 'no-store', signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !Array.isArray(payload.quotes)) throw new Error('SOURCE_UNAVAILABLE');
        if (controller.signal.aborted) return;
        setQuotes(currentQuotes => ({ ...currentQuotes, ...Object.fromEntries(payload.quotes.map(quote => [quote.symbol, quote])) }));
        setWatchState(payload.status === 'available' ? 'available' : 'unavailable');
      } catch {
        if (!controller.signal.aborted) {
          setQuotes(currentQuotes => ({ ...currentQuotes, ...Object.fromEntries(quoteSymbols.split(',').map(symbol => [symbol, { status: 'unavailable' }])) }));
          setWatchState('unavailable');
        }
      } finally { loading = false; }
    }
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [market.id, quoteSymbols, refreshNonce]);

  return <aside id="section-watchlist" className="panel focus-board" aria-label="มุมโฟกัสตลาด">
    <header className="focus-heading"><div><span className="eyebrow"><Focus size={14}/> YOUR MARKET FOCUS</span><h2>มุมโฟกัส</h2><p>จับตาตัวที่สนใจ แล้วเปิดกราฟต่อได้ทันที</p></div><button className="focus-search-button" onClick={onOpenSearch}><Search size={16}/>ค้นหาและเพิ่ม</button></header>
    <div className="focus-layout">
      <article className="focus-asset">
        <div className="focus-asset-heading"><div><small>{market.label} · ตัวที่เลือก</small><h3>{asset.symbol}</h3><span>{asset.name !== asset.symbol ? asset.name : asset.sectionId}</span></div><button onClick={() => onToggleFavorite(asset.symbol)} aria-label={`${favorites.includes(asset.symbol) ? 'เลิกติดตาม' : 'ติดตาม'} ${asset.symbol}`} aria-pressed={favorites.includes(asset.symbol)}><Star size={20} fill={favorites.includes(asset.symbol) ? 'currentColor' : 'none'}/></button></div>
        <div className="focus-price"><strong>{formatQuotePrice(current, asset)}</strong><span className={focusQuote?.changePercent < 0 ? 'negative' : 'positive'}>{changeLabel(focusQuote?.changePercent)}</span></div>
        <p className="focus-source">{focusQuote ? `${isHistorical ? `แท่งปิด ${timeframe}` : 'ราคาอ้างอิงล่าสุด'} · ${focusQuote.source ?? series?.source ?? 'ผู้ให้บริการราคา'} · ${shortTime(focusQuote.observedAt)}` : 'ยังไม่มีราคาอ้างอิงของตัวที่เลือก'}</p>
        {analysis && <span className={`focus-trend ${analysis.trend}`}>{analysis.trend === 'up' ? 'แนวโน้มขึ้น' : analysis.trend === 'down' ? 'แนวโน้มลง' : 'แกว่งในกรอบ'} · กราฟ {timeframe}</span>}
        {hasRange ? <div className="focus-range"><div><span>แนวรับ <b>{formatQuotePrice(support, asset)}</b></span><span>แนวต้าน <b>{formatQuotePrice(resistance, asset)}</b></span></div><div className="focus-range-track"><i style={{ left: `${location}%` }} /></div><p>{toSupport < 0 ? 'ราคาต่ำกว่าแนวรับ' : toResistance < 0 ? 'ราคาเหนือแนวต้าน' : `ห่างแนวรับ ${toSupport.toFixed(2)}% · ระยะถึงแนวต้าน ${toResistance.toFixed(2)}%`}</p><small>ตำแหน่งราคาอ้างอิงบนกรอบวิเคราะห์ · ไม่ใช่สัญญาณเข้า</small></div> : <p className="focus-unavailable">{analysis ? 'ยังไม่มีกรอบราคาที่ครบสำหรับแสดงระยะ' : 'เปิดกราฟที่มีข้อมูลเพื่อดูแนวโน้มและระยะถึงแนวรับ–แนวต้าน'}</p>}
        <button className="focus-analyze" onClick={onOpenScanner}><Radar size={16}/>เปิดสแกนเชิงลึก</button>
      </article>
      <div className="focus-list">
        <div className="focus-list-controls"><div><button aria-pressed={tab === 'market'} onClick={() => {setTab('market');setPage(1);}}>เลือกในตลาด</button><button aria-pressed={tab === 'favorites'} onClick={() => {setTab('favorites');setPage(1);}}>ติดตามไว้ {favoriteAssets.length}</button></div><button className="focus-refresh" aria-label="รีเฟรชมุมโฟกัส" disabled={watchState === 'loading'} onClick={() => {setRefreshNonce(value => value + 1);onRefreshQuote?.();}}><RefreshCw size={16}/></button></div>
        <label className="focus-query"><Search size={16}/><input aria-label="ค้นหาในมุมโฟกัส" value={query} onChange={event => {setQuery(event.target.value);setPage(1);}} placeholder={`ค้นหา ${market.label} เช่น ${marketAssets[0]?.symbol ?? ''}`}/></label>
        <div className="focus-rows" aria-busy={watchState === 'loading'}>{visible.map(item => {
          const selected = item.instrumentId === asset.instrumentId;
          const quote = selected && focusQuote ? focusQuote : quotes[item.symbol]?.status === 'available' ? quotes[item.symbol] : null;
          return <div className={selected ? 'focus-row selected' : 'focus-row'} key={item.instrumentId}><button className="focus-row-main" onClick={() => onSelect(item)}><span><b>{item.symbol}</b><small>{item.name !== item.symbol ? item.name : item.sectionId}</small></span><span><b>{formatQuotePrice(quote?.price, item)}</b><small className={quote?.changePercent < 0 ? 'negative' : ''}>{Number.isFinite(quote?.changePercent) ? changeLabel(quote.changePercent) : selected && isHistorical ? 'แท่งปิด' : quote ? shortTime(quote.observedAt) : 'เปิดกราฟเพื่อดูข้อมูล'}</small></span></button><button className="focus-pin" onClick={() => onToggleFavorite(item.symbol)} aria-pressed={favorites.includes(item.symbol)} aria-label={`${favorites.includes(item.symbol) ? 'เลิกติดตาม' : 'ติดตาม'} ${item.symbol} ในรายการ`}><Star size={16} fill={favorites.includes(item.symbol) ? 'currentColor' : 'none'}/></button></div>;
        })}{!visible.length && <div className="focus-empty"><Star size={24}/><b>{tab === 'favorites' && !query ? 'เริ่มด้วยตัวที่คุณสนใจ' : 'ไม่พบรายการ'}</b><p>{tab === 'favorites' && !query ? 'กดดาวข้างชื่อหุ้น รายการนี้จะเก็บเฉพาะตลาดที่เปิดอยู่' : 'ลองเปลี่ยนคำค้น'}</p></div>}</div>
        <footer className="focus-pagination"><span>{rows.length ? `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, rows.length)} จาก ${rows.length} ตัว` : 'ยังไม่มีรายการ'} · หน้า {safePage}/{pages}</span><div><button aria-label="มุมโฟกัสหน้าก่อน" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><ChevronLeft size={17}/></button><button aria-label="มุมโฟกัสหน้าถัดไป" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}><ChevronRight size={17}/></button></div></footer>
        <small className="focus-list-note">{quoteSymbols ? watchState === 'unavailable' ? 'รับราคาชุดนี้ไม่ได้ · เปิดกราฟหรือรีเฟรชใหม่' : 'อ่านราคาเฉพาะ 6 ตัวในหน้านี้ · รีเฟรชทุก 60 วินาที' : 'เลือกตัวที่ต้องการเพื่อเปิดกราฟ · ไม่โหลดราคาทั้งตลาดพร้อมกัน'}</small>
      </div>
    </div>
  </aside>;
}
