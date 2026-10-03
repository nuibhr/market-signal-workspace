'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Focus, Radar, RefreshCw, Search, Star } from 'lucide-react';
import { MARKET_ASSETS } from '../markets/catalog.mjs';
import { formatQuotePrice } from '../markets/quote-format.mjs';
import UsAssetTabs from './us-asset-tabs.jsx';

const PAGE_SIZE = 6;
const positivePrice = value => Number.isFinite(value) && value > 0;
const shortTime = value => {
  const date = value ? new Date(value) : null;
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  return date && !Number.isNaN(date.valueOf()) ? date.toLocaleString('th-TH', { timeZone: dateOnly ? 'UTC' : 'Asia/Bangkok', day: '2-digit', month: 'short', ...(dateOnly ? {} : {hour: '2-digit', minute: '2-digit'}) }) : 'ต้นทางไม่ระบุเวลา';
};
const changeLabel = value => Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : '—';

export default function LiveMarketWatch({ market, asset, favorites, favoritesOpenRequest=0, selectedQuote, series, analysis, timeframe = '1D', onSelect, onToggleFavorite, onOpenSearch, onOpenScanner, onRefreshQuote }) {
  const [tab, setTab] = useState('market');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [quotes, setQuotes] = useState({});
  const [watchState, setWatchState] = useState('idle');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [usKind,setUsKind]=useState(asset.sectionId==='US_ETFS'?'etf':'stock');
  const marketAssets = MARKET_ASSETS[market.id] ?? [];
  const favoriteAssets = useMemo(()=>marketAssets.filter(item => favorites.includes(item.symbol)),[marketAssets,favorites]);
  const rows = useMemo(()=>(tab === 'favorites' ? favoriteAssets : marketAssets)
    .filter(item=>market.id!=='us'||usKind==='all'||(item.sectionId==='US_ETFS'?'etf':'stock')===usKind)
    .filter(item => `${item.symbol} ${item.name}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((left, right) => Number(right.instrumentId === asset.instrumentId) - Number(left.instrumentId === asset.instrumentId)),[tab,favoriteAssets,marketAssets,market.id,usKind,query,asset.instrumentId]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const quoteSymbols = visible.filter(item => market.id==='us'||['settrade-daily','tfex-quote'].includes(item.feed)).map(item => item.symbol).join(',');
  const lastBar = series?.bars?.at(-1);
  const focusQuote = positivePrice(selectedQuote?.price) ? selectedQuote : positivePrice(lastBar?.close)
    ? { price: lastBar.close, observedAt: series.latestTime ?? series.latestDay, source: series.source, historical: true } : null;
  const isHistorical = Boolean(focusQuote?.historical || !positivePrice(selectedQuote?.price) && (series?.live===false || series?.chartOnly));
  const support = analysis?.support;
  const resistance = analysis?.resistance;
  const current = focusQuote?.price;
  const hasRange = positivePrice(current) && positivePrice(support) && positivePrice(resistance) && support < resistance;
  const location = hasRange ? Math.max(0, Math.min(100, (current - support) / (resistance - support) * 100)) : null;
  const toSupport = hasRange ? (current - support) / current * 100 : null;
  const toResistance = hasRange ? (resistance - current) / current * 100 : null;

  useEffect(() => { setPage(1); }, [asset.instrumentId]);
  useEffect(()=>{if(market.id==='us')setUsKind(asset.sectionId==='US_ETFS'?'etf':'stock');},[market.id,asset.sectionId]);
  useEffect(()=>{if(favoritesOpenRequest){setTab('favorites');setPage(1);if(market.id==='us')setUsKind('all');}},[favoritesOpenRequest,market.id]);
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
        const response = await fetch(`${market.id === 'us'?'/api/us-watch':market.id === 'tfex' ? '/api/tfex/quotes' : '/api/market-watch'}?symbols=${encodeURIComponent(quoteSymbols)}`, { cache: 'no-store', signal: controller.signal });
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
    const timer = window.setInterval(refresh, market.id==='us'?300_000:60_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [market.id, quoteSymbols, refreshNonce]);

  return <aside id="section-watchlist" className={`panel focus-board${tab==='favorites'?' showing-favorites':''}`} aria-label="มุมโฟกัสตลาด">
    <header className="focus-heading"><div><span className="eyebrow"><Focus size={14}/> YOUR MARKET FOCUS</span><h2>มุมโฟกัส</h2><p>จับตาตัวที่สนใจ แล้วเปิดกราฟต่อได้ทันที</p></div><button className="focus-search-button" onClick={onOpenSearch}><Search size={16}/>ค้นหาและเพิ่ม</button></header>
    <div className="focus-layout">
      <article className="focus-asset">
        <div className="focus-asset-heading"><div><small>{market.label} · {asset.sectionId==='US_ETFS'?'ETF':'ตัวที่เลือก'}</small><h3>{asset.symbol}</h3><span>{asset.name !== asset.symbol ? asset.name : asset.sectionId}</span></div><button className="favorite-save" onClick={() => onToggleFavorite(asset.symbol)} aria-label={`${favorites.includes(asset.symbol) ? 'เลิกติดตาม' : 'ติดตาม'} ${asset.symbol}`} aria-pressed={favorites.includes(asset.symbol)}><Star size={21} fill={favorites.includes(asset.symbol) ? 'currentColor' : 'none'}/><span>{favorites.includes(asset.symbol)?'บันทึกแล้ว':'หุ้นโปรด'}</span></button></div>
        <div className="focus-price"><strong>{formatQuotePrice(current, asset)}</strong><span className={focusQuote?.changePercent < 0 ? 'negative' : 'positive'}>{changeLabel(focusQuote?.changePercent)}</span></div>
        <p className="focus-source">{focusQuote ? `${isHistorical ? `แท่งปิด ${timeframe}` : 'ราคาอ้างอิงล่าสุด'} · ${focusQuote.source ?? series?.source ?? 'ผู้ให้บริการราคา'} · ${shortTime(focusQuote.observedAt)}` : 'ยังไม่มีราคาอ้างอิงของตัวที่เลือก'}</p>
        {analysis && <span className={`focus-trend ${analysis.trend}`}>{analysis.trend === 'up' ? 'แนวโน้มขึ้น' : analysis.trend === 'down' ? 'แนวโน้มลง' : 'แกว่งในกรอบ'} · กราฟ {timeframe}</span>}
        {hasRange ? <div className="focus-range"><div><span>แนวรับ <b>{formatQuotePrice(support, asset)}</b></span><span>แนวต้าน <b>{formatQuotePrice(resistance, asset)}</b></span></div><div className="focus-range-track"><i style={{ left: `${location}%` }} /></div><p>{toSupport < 0 ? 'ราคาต่ำกว่าแนวรับ' : toResistance < 0 ? 'ราคาเหนือแนวต้าน' : `ห่างแนวรับ ${toSupport.toFixed(2)}% · ระยะถึงแนวต้าน ${toResistance.toFixed(2)}%`}</p><small>ตำแหน่งราคาอ้างอิงบนกรอบวิเคราะห์ · ไม่ใช่สัญญาณเข้า</small></div> : <p className="focus-unavailable">{analysis ? 'ยังไม่มีกรอบราคาที่ครบสำหรับแสดงระยะ' : 'เปิดกราฟที่มีข้อมูลเพื่อดูแนวโน้มและระยะถึงแนวรับ–แนวต้าน'}</p>}
        <button className="focus-analyze" onClick={onOpenScanner}><Radar size={16}/>เปิดสแกนเชิงลึก</button>
      </article>
      <div className="focus-list">
        <div className="focus-list-controls"><div><button aria-pressed={tab === 'market'} onClick={() => {setTab('market');if(market.id==='us'&&usKind==='all')setUsKind(asset.sectionId==='US_ETFS'?'etf':'stock');setPage(1);}}>เลือกในตลาด</button><button className="favorite-list-tab" aria-pressed={tab === 'favorites'} onClick={() => {setTab('favorites');if(market.id==='us')setUsKind('all');setPage(1);}}><Star size={15}/>หุ้นโปรด {favoriteAssets.length}</button></div><button className="focus-refresh" aria-label="รีเฟรชมุมโฟกัส" disabled={watchState === 'loading'} onClick={() => {setRefreshNonce(value => value + 1);onRefreshQuote?.();}}><RefreshCw size={16}/></button></div>
        {market.id==='us'&&<><UsAssetTabs value={usKind} showAll={tab==='favorites'} onChange={value=>{setUsKind(value);setPage(1);}}/><p className="focus-kind-note">{tab==='favorites'?'ราคาปิดรายวัน · คะแนนเทคนิค ไม่ใช่อัตราชนะ · เปิดกราฟจากรายการ':usKind==='etf'?'ETF · กราฟและคะแนนเทคนิคจากแท่งปิดรายวัน':'หุ้น · ชุด AutoPick 500 ตัวจากแท่งปิดรายวัน'}</p></>}
        <label className="focus-query"><Search size={16}/><input aria-label="ค้นหาในมุมโฟกัส" value={query} onChange={event => {setQuery(event.target.value);setPage(1);}} placeholder={`ค้นหา ${market.label} เช่น ${marketAssets[0]?.symbol ?? ''}`}/></label>
        <div className="focus-rows" aria-busy={watchState === 'loading'}>{visible.map(item => {
          const selected = item.instrumentId === asset.instrumentId;
          const dailyQuote=quotes[item.symbol]?.status==='available'?quotes[item.symbol]:null;
          const quote = market.id==='us'?dailyQuote??(selected?focusQuote:null):selected&&focusQuote?focusQuote:dailyQuote;
          const saved=favorites.includes(item.symbol);
          return <div className={selected ? 'focus-row selected' : 'focus-row'} key={item.instrumentId}><button className="focus-row-main" onClick={() => onSelect(item)}><span><b>{item.symbol} {item.sectionId==='US_ETFS'&&<em className="etf-badge">ETF</em>}</b><small>{item.name !== item.symbol ? item.name : item.sectionId}</small>{market.id==='us'&&dailyQuote&&<small className={`focus-review ${dailyQuote.trend??''}`}>{dailyQuote.score!==null?`${dailyQuote.trend==='up'?'แนวโน้มขึ้น':dailyQuote.trend==='down'?'แนวโน้มลง':'แกว่งในกรอบ'} · ${dailyQuote.score}/100`:dailyQuote.label}</small>}{tab==='favorites'&&dailyQuote?.brief&&<small className="focus-brief" title={dailyQuote.brief}>{dailyQuote.brief}</small>}</span><span><b>{formatQuotePrice(quote?.price, item)}</b><small className={quote?.changePercent < 0 ? 'negative' : ''}>{Number.isFinite(quote?.changePercent) ? changeLabel(quote.changePercent) : selected && isHistorical ? 'แท่งปิด' : quote ? shortTime(quote.observedAt) : watchState==='loading'?'กำลังอ่านราคา…':'ข้อมูลไม่พร้อม'}</small>{market.id==='us'&&quote&&<small>ปิด {shortTime(quote.observedAt)}</small>}</span></button><button className="focus-pin favorite-save" onClick={() => onToggleFavorite(item.symbol)} aria-pressed={saved} aria-label={`${saved ? 'เลิกติดตาม' : 'ติดตาม'} ${item.symbol} ในรายการ`}><Star size={19} fill={saved ? 'currentColor' : 'none'}/><span>{saved?'บันทึกแล้ว':'เพิ่มโปรด'}</span></button></div>;
        })}{!visible.length && <div className="focus-empty"><Star size={24}/><b>{tab === 'favorites' && !query ? 'เริ่มด้วยตัวที่คุณสนใจ' : 'ไม่พบรายการ'}</b><p>{tab === 'favorites' && !query ? 'กดดาวข้างชื่อหุ้น รายการนี้จะเก็บเฉพาะตลาดที่เปิดอยู่' : 'ลองเปลี่ยนคำค้น'}</p></div>}</div>
        <footer className="focus-pagination"><span>{rows.length ? `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, rows.length)} จาก ${rows.length} ตัว` : 'ยังไม่มีรายการ'} · หน้า {safePage}/{pages}</span><div><button aria-label="มุมโฟกัสหน้าก่อน" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><ChevronLeft size={17}/></button><button aria-label="มุมโฟกัสหน้าถัดไป" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}><ChevronRight size={17}/></button></div></footer>
        <small className="focus-list-note">{quoteSymbols ? watchState === 'unavailable' ? 'รับราคาชุดนี้ไม่ได้ · เปิดกราฟหรือรีเฟรชใหม่' : market.id==='us'?'ราคาปิดรายวัน 6 ตัวต่อหน้า · คะแนนเทคนิคไม่ใช่อัตราชนะ · ตรวจข้อมูลทุก 5 นาที':'อ่านราคาเฉพาะ 6 ตัวในหน้านี้ · รีเฟรชทุก 60 วินาที' : 'เลือกตัวที่ต้องการเพื่อเปิดกราฟ · ไม่โหลดราคาทั้งตลาดพร้อมกัน'}</small>
        {tab==='favorites'&&<p className="focus-kind-note">บันทึกไว้ในเบราว์เซอร์นี้ · หากซื้อแล้ว ให้กรอกต้นทุนใน “หุ้นที่ฉันถือ” เพื่อดูผลตามพอร์ตของคุณ</p>}
      </div>
    </div>
  </aside>;
}
