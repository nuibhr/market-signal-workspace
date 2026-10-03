'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {useRouter} from 'next/navigation';
import MarketNavigation from './market-navigation.jsx';
import {marketPage,marketHref} from '../markets/market-pages.mjs';
import HoldingsDesk from './holdings-desk.jsx';
import { BookOpen, Layers3, Newspaper, Radar, Waves } from 'lucide-react';
import { ALL_ASSETS, MARKET_ASSETS, MARKET_GROUPS, TFEX_SYMBOLS } from '../markets/catalog.mjs';
import { formatQuotePrice } from '../markets/quote-format.mjs';
import { analyzeCandles } from '../analysis/technical.mjs';
import SymbolSearch from './symbol-search.jsx';
import UsAssetTabs from './us-asset-tabs.jsx';
import AnalysisRail from './analysis-rail.jsx';
import LiveMarketWatch from './live-market-watch.jsx';
import ChartToolbox from './chart-toolbox.jsx';
import CandlestickChart from './candlestick-chart.jsx';
import { AmbientDepth, MarketScanner, MultiTimeframe, VolumePulse, NewsGuide, NewsFeedState } from './workspace-features.jsx';
import { WorkspaceSidebar, DailyDesk, FinancialCheck, LearningPanel, RoadmapPanel, CalendarPanel, DividendCalendarPanel } from './workspace-hub.jsx';
import NugaomAssistant from './nugaom-assistant.jsx';
import AutoPickBoard from './auto-pick-board.jsx';
import SignalResults from './signal-results.jsx';

const DEFAULT_SYMBOLS = { thai: 'PTT', dr: 'AAPL80', tfex: TFEX_SYMBOLS[0] ?? 'S50', us: 'NVDA', forex: 'EUR/USD' };
const MARKETS = MARKET_GROUPS.map(group => ({
  ...group,
  ...(MARKET_ASSETS[group.id].find(item => item.symbol === DEFAULT_SYMBOLS[group.id]) ?? MARKET_ASSETS[group.id][0]),
}));
const TIMEFRAME_LABELS = { '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D' };
const TIMEFRAME_DESCRIPTIONS = { '15m': '15 นาที', '1h': '1 ชั่วโมง', '4h': '4 ชั่วโมง', '1d': '1 วัน' };
const FEATURE_ITEMS = [
  ['scanner', '◈', 'Market Scanner', 'คัดกรองสินทรัพย์และอ่านเหตุผล', 'SCAN'],
  ['multi-tf', '▦', 'Multi-TF', 'เทียบแนวโน้มหลายกรอบเวลา', 'ANALYZE'],
  ['volume', '◒', 'Volume Pulse', 'สำรวจแรงซื้อขายและปริมาณ', 'FLOW'],
  ['news', '◫', 'ข่าวตลาด', 'อ่านข่าวจากแหล่งข้อมูลจริง', 'SOURCE'],
  ['news-guide', '?', 'คู่มือข่าว', 'อ่านวิธีใช้ข่าวร่วมกับกราฟ', 'GUIDE'],
];
const FEATURE_ICONS = { scanner: Radar, 'multi-tf': Layers3, volume: Waves, news: Newspaper, 'news-guide': BookOpen };
const ANALYSIS_FEATURE_ITEMS = FEATURE_ITEMS.slice(0, 3);
const DEFAULT_INDICATORS = { ema20: true, ema50: false, sma20: false, bollinger: false, donchian: false, vwap: false, volume: true, levels: true };
const FAVORITES_STORAGE_KEY = 'nugaom-ai-pick-favorites';
const displaySection = value => value === 'US_STOCKS' ? 'หุ้นสหรัฐฯ' : value === 'US_ETFS' ? 'ETF' : value;

function formatLatestBar(series) {
  if (!series) return '—';
  if (series.timeframe === '1d' || !series.latestTime) return series.latestDay ?? '—';
  const date = new Date(series.latestTime);
  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function formatQuoteReceipt(value) {
  if (!value) return 'ไม่ทราบ';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'ไม่ทราบ' : date.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function formatHistoryStart(bar, timeframe) {
  if (!bar) return '—';
  if (timeframe === '1d') return bar.time;
  return new Date(bar.time * 1000).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: 'numeric' });
}


function MarketSparkline({ bars }) {
  if (bars.length < 2) return null;
  const recent = bars.slice(-36).map(bar => bar.close);
  const lowest = Math.min(...recent);
  const span = Math.max(0.00001, Math.max(...recent) - lowest);
  const points = recent.map((price, index) => `${(index / Math.max(1, recent.length - 1)) * 560},${55 - ((price - lowest) / span) * 42}`).join(' ');
  return <svg className="hero-sparkline" viewBox="0 0 560 70" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#53d6aa" stopOpacity=".25" /><stop offset="1" stopColor="#53d6aa" stopOpacity="0" /></linearGradient></defs><polygon points={`0,70 ${points} 560,70`} fill="url(#spark-fill)" /><polyline points={points} fill="none" stroke="#70e3be" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>;
}

function displayNumber(value, digits = 2) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '—';
}

export default function Workspace({marketId='thai',initialSymbol=null}) {
  const router=useRouter();
  const page=marketPage(marketId);
  const [activeMarket, setActiveMarket] = useState(marketId);
  const [activeNav, setActiveNav] = useState('overview');
  const [selectedAsset, setSelectedAsset] = useState(()=>MARKET_ASSETS[marketId]?.find(a=>a.symbol===initialSymbol)??null);
  const [timeframe, setTimeframe] = useState('1d');
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);
  const [chartStyle, setChartStyle] = useState('candles');
  const [chartRange, setChartRange] = useState('recent');
  const [liveSeries, setLiveSeries] = useState(null);
  const [liveState, setLiveState] = useState('idle');
  const [chartLoadMs, setChartLoadMs] = useState(null);
  const [pivotContext, setPivotContext] = useState(null);
  const [planContext, setPlanContext] = useState(null);
  const [planContextState, setPlanContextState] = useState('idle');
  const [aiState, setAiState] = useState('idle');
  const [aiResult, setAiResult] = useState(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const lastAutoRefreshRef = useRef(0);
  const [favorites, setFavorites] = useState([]);
  const [favoriteNotice,setFavoriteNotice]=useState('');
  const [favoritesOpenRequest,setFavoritesOpenRequest]=useState(0);
  const [popup, setPopup] = useState(null);
  const modalRef = useRef(null);
  const popupTriggerRef = useRef(null);
  const [symbolQuery, setSymbolQuery] = useState('');
  const [symbolCategory, setSymbolCategory] = useState(marketId);
  const [rights, setRights] = useState(null);
  const [memberAccount, setMemberAccount] = useState(null);
  const [accountConfigured, setAccountConfigured] = useState(false);
  const [marketQuote, setMarketQuote] = useState(null);
  const [quoteState, setQuoteState] = useState('idle');
  const market = MARKETS.find(item => item.id === activeMarket) ?? MARKETS[0];
  const asset = selectedAsset ?? market;
  const chartIndicators = useMemo(() => asset.id === 'forex' ? { ...indicators, volume: false, vwap: false } : indicators, [asset.id, indicators]);
  const hasSettradeConnection = asset.feed === 'settrade-daily';
  const hasFmpConnection = asset.feed === 'fmp-quote';
  const hasTfexConnection = asset.feed === 'tfex-quote';
  const hasQuoteConnection = hasFmpConnection || hasTfexConnection;
  const hasCandleConnection = hasSettradeConnection || hasTfexConnection || asset.id === 'us' || asset.id === 'forex';
  const hasRealQuote = hasQuoteConnection && quoteState === 'available' && marketQuote?.instrumentId === asset.instrumentId;
  const hasRealBars = hasCandleConnection && liveState === 'available' && liveSeries?.instrumentId === asset.instrumentId && liveSeries?.timeframe === timeframe && (liveSeries?.bars?.length ?? 0) > 0;
  const displayedPrice = hasSettradeConnection
    ? hasRealBars ? displayNumber(liveSeries.quote?.price ?? liveSeries.bars.at(-1).close) : '—'
    : hasQuoteConnection ? hasRealQuote ? formatQuotePrice(marketQuote.price, asset) : hasRealBars ? formatQuotePrice(liveSeries.bars.at(-1).close, asset) : '—' : '—';
  const displayedChange = hasSettradeConnection
    ? hasRealBars && typeof liveSeries.quote?.changePercent === 'number' ? `${liveSeries.quote.changePercent >= 0 ? '+' : ''}${displayNumber(liveSeries.quote.changePercent)}%` : '—'
    : hasQuoteConnection ? hasRealQuote && typeof marketQuote.changePercent === 'number' ? `${marketQuote.changePercent >= 0 ? '+' : ''}${displayNumber(marketQuote.changePercent)}%` : '—' : '—';
  const displayBars = hasRealBars ? liveSeries.bars : null;
  const latestBar = hasRealBars ? liveSeries.bars.at(-1) : null;
  const latestBarLabel = hasRealBars ? formatLatestBar(liveSeries) : '—';
  const displayedQuote = hasRealQuote ? marketQuote : hasSettradeConnection && hasRealBars && typeof liveSeries.quote?.price === 'number' ? liveSeries.quote : null;
  const quoteTimeLabel = displayedQuote
    ? displayedQuote.observedAt ? formatLatestBar({ timeframe: '15m', latestTime: displayedQuote.observedAt })
      : `ไม่ทราบ · รับ ${formatQuoteReceipt(displayedQuote.receivedAt)}`
    : latestBarLabel;
  const quoteStatusLabel = displayedQuote
    ? displayedQuote.observedAt ? hasRealQuote && marketQuote.freshness === 'recent' ? 'มีเวลา source · ตามรอบล่าสุด' : 'มีเวลา source · ตรวจเวลา quote' : 'เวลา source ไม่ระบุ · ตรวจแท่งล่าสุด'
    : TIMEFRAME_LABELS[timeframe];
  const sparkBars = displayBars ?? [];
  const analysis = useMemo(() => hasRealBars ? analyzeCandles(liveSeries.bars, timeframe === '1d' ? liveSeries.quote?.price : null, TIMEFRAME_DESCRIPTIONS[timeframe], { timeframe, dailyBars: timeframe === '1d' ? liveSeries.bars : pivotContext?.instrumentId === asset.instrumentId ? pivotContext.bars : [] }) : null, [hasRealBars, liveSeries, timeframe, pivotContext, asset.instrumentId]);
  const tradePlan = planContext?.instrumentId === asset.instrumentId ? planContext.plan : null;
  const currentAnalysis = Boolean(analysis) && liveSeries?.freshness === 'recent' && !liveSeries?.chartOnly;
  const currentAiResult = currentAnalysis && aiResult?.symbol === asset.symbol && aiResult.timeframe === timeframe && aiResult.latestDay === liveSeries?.latestDay && aiResult.latestTime === (liveSeries?.latestTime ?? null) ? aiResult : null;
  const favoriteAssets = useMemo(()=>MARKET_ASSETS[marketId].filter(item=>favorites.includes(item.symbol)),[marketId,favorites]);
  const searchResults = useMemo(()=>ALL_ASSETS.filter(item => (symbolCategory === 'all' || item.id === symbolCategory || item.sectionId===symbolCategory)
    && (!symbolQuery.trim() || `${item.symbol} ${item.name} ${item.sectionId}`.toLowerCase().includes(symbolQuery.trim().toLowerCase()))),[symbolCategory,symbolQuery]);
  const sourceLabel = hasRealBars ? liveSeries.source : hasCandleConnection ? liveState === 'loading' ? `กำลังเชื่อม ${hasSettradeConnection ? 'Settrade' : hasTfexConnection ? 'TFEX Open API' : asset.id === 'forex' ? 'Yahoo History' : 'FMP / Yahoo History'}` : 'ฟีดแท่งราคาไม่พร้อม' : hasQuoteConnection ? hasRealQuote ? marketQuote.source : quoteState === 'loading' ? 'กำลังอ่านราคา' : 'ฟีดราคาไม่พร้อม' : 'ยังไม่เชื่อมฟีด';
  const loginHref = !rights?.authenticated && accountConfigured ? '/api/auth/line/start' : '/account';
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/membership', { cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(payload => { if (!controller.signal.aborted) { setRights(payload?.rights ?? null); setMemberAccount(payload?.account ?? null); setAccountConfigured(Boolean(payload?.configured)); } })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  function navigateTo(id) {
    if (id === 'account' || id === 'membership') { window.location.href = '/account'; return; }
    setActiveNav(id);
    if (id === 'analysis-tools') { setPopup('scanner'); return; }
    if(id==='favorites')setFavoritesOpenRequest(value=>value+1);
    const selector = { overview: '#section-overview', daily: '#section-daily', autopick: '#section-auto-pick', favorites: '#section-watchlist', watchlist: '#section-watchlist', signals: '#section-trade-plan', results: '#section-results' }[id];
    if (selector) { document.querySelector(selector)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); setPopup(null); }
    else setPopup(id);
  }

  function selectAsset(item, frame = '1d') {
    if(item.id!==marketId){router.push(marketHref(item.id,item.symbol));return;}
    setActiveMarket(item.id);
    setSelectedAsset(item);
    setTimeframe(item.id === 'us' ? '1d' : frame);
    setPopup(null);
    window.requestAnimationFrame(() => document.querySelector('.chart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function selectFrame(frame) {
    setTimeframe(['us','forex'].includes(asset.id)&&frame==='4h'?'1d':frame);
    setPopup(null);
    window.requestAnimationFrame(() => document.querySelector('.chart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function selectLedgerSymbol(symbol) {
    const item = ALL_ASSETS.find(candidate => candidate.symbol === symbol);
    if (item) selectAsset(item);
  }

  useEffect(() => {
    if (!hasCandleConnection) { setLiveSeries(null); setLiveState('idle'); setChartLoadMs(null); return undefined; }
    const controller = new AbortController();
    setLiveSeries(null);
    setLiveState('loading');
    setChartLoadMs(null);
    const route = hasSettradeConnection ? '/api/market-data' : hasTfexConnection ? '/api/tfex/candles' : asset.id==='forex' || asset.id==='us' && timeframe!=='1d' ? '/api/history-bars' : '/api/us-bars';
    async function loadCandles() {
      const attempts = hasTfexConnection ? 2 : 1;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const startedAt = performance.now();
        try {
          let response = await fetch(`${route}?symbol=${encodeURIComponent(asset.symbol)}&market=${asset.id}&timeframe=${timeframe}`, { cache: 'no-store', signal: controller.signal });
          let payload = await response.json();
          if((!response.ok||payload.status!=='available')&&!hasTfexConnection&&route!=='/api/history-bars'&&timeframe!=='4h'){
            response=await fetch(`/api/history-bars?symbol=${encodeURIComponent(asset.symbol)}&market=${asset.id}&timeframe=${timeframe}`,{cache:'no-store',signal:controller.signal});payload=await response.json();
          }
          if (!response.ok || payload.status !== 'available' || !Array.isArray(payload.bars) || payload.bars.length === 0)
            throw new Error(payload.code ?? 'SOURCE_UNAVAILABLE');
          if (!controller.signal.aborted) { setLiveSeries(payload); setLiveState('available'); setChartLoadMs(Math.round(performance.now() - startedAt)); }
          return;
        } catch (error) {
          if (controller.signal.aborted) return;
          if (attempt + 1 === attempts) { setLiveSeries(null); setLiveState('unavailable'); setChartLoadMs(Math.round(performance.now() - startedAt)); return; }
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
    }
    loadCandles();
    return () => controller.abort();
  }, [asset.instrumentId, hasCandleConnection, hasSettradeConnection, timeframe, reloadNonce]);

  useEffect(() => {
    if (!hasRealBars || !hasSettradeConnection && !hasTfexConnection) return undefined;
    let timer;
    const refresh = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastAutoRefreshRef.current < 60_000) return;
      lastAutoRefreshRef.current = Date.now();
      setReloadNonce(value => value + 1);
    };
    const schedule = () => {
      const interval = 15 * 60_000;
      const offset = 45_000;
      const next = Math.ceil((Date.now() - offset) / interval) * interval + offset;
      timer = window.setTimeout(() => { refresh(); schedule(); }, Math.max(1_000, next - Date.now()));
    };
    schedule();
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [hasRealBars, hasSettradeConnection, hasTfexConnection, asset.instrumentId, timeframe]);

  useEffect(() => {
    setPivotContext(null);
    if (timeframe === '1d' || !hasRealBars) return undefined;
    const controller = new AbortController();
    const endpoint = liveSeries?.chartOnly?'/api/history-bars':hasTfexConnection ? '/api/tfex/candles' : asset.id === 'us' ? '/api/us-bars' : '/api/market-data';
    fetch(`${endpoint}?symbol=${encodeURIComponent(asset.symbol)}&market=${asset.id}&timeframe=1d`, { cache: 'no-store', signal: controller.signal })
      .then(async response => { const payload = await response.json();
        if (!response.ok || payload.status !== 'available' || payload.instrumentId !== asset.instrumentId || payload.timeframe !== '1d' || !Array.isArray(payload.bars)) return;
        if (!controller.signal.aborted) setPivotContext({ instrumentId: asset.instrumentId, bars: payload.bars });
      }).catch(() => {});
    return () => controller.abort();
  }, [asset.instrumentId, asset.symbol, timeframe, hasSettradeConnection, hasTfexConnection, hasRealBars, reloadNonce, liveSeries?.chartOnly]);

  useEffect(() => {
    if (!hasSettradeConnection || timeframe !== '1d' || liveSeries?.chartOnly) { setPlanContext(null); setPlanContextState('idle'); return undefined; }
    const controller = new AbortController();
    setPlanContext(null);
    setPlanContextState('loading');
    fetch(`/api/technical-plan?symbol=${encodeURIComponent(asset.symbol)}`, {cache:'no-store',signal:controller.signal})
      .then(async response=>{const payload=await response.json();if(!response.ok||payload.status!=='available'||payload.instrumentId!==asset.instrumentId)throw Error();return payload;})
      .then(payload=>{if(!controller.signal.aborted){setPlanContext(payload);setPlanContextState('available');}})
      .catch(()=>{if(!controller.signal.aborted){setPlanContext(null);setPlanContextState('unavailable');}});
    return () => controller.abort();
  }, [asset.instrumentId, asset.symbol, hasSettradeConnection, timeframe, reloadNonce, liveSeries?.chartOnly]);

  useEffect(() => {
    if (!hasQuoteConnection) { setMarketQuote(null); setQuoteState('idle'); return undefined; }
    const controller = new AbortController();
    setMarketQuote(null);
    setQuoteState('loading');
    const endpoint = hasTfexConnection
      ? `/api/tfex/quotes?symbols=${encodeURIComponent(asset.symbol)}`
      : `/api/quote?symbol=${encodeURIComponent(asset.symbol)}`;
    fetch(endpoint, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        const quote = hasTfexConnection ? payload.quotes?.find(item => item.symbol === asset.symbol) : payload;
        if (!response.ok || payload.status !== 'available' || quote?.status !== 'available' || quote.instrumentId !== asset.instrumentId) throw new Error(payload.code ?? 'SOURCE_UNAVAILABLE');
        setMarketQuote(quote);
        setQuoteState('available');
      })
      .catch(error => { if (error.name !== 'AbortError') { setMarketQuote(null); setQuoteState('unavailable'); } });
    return () => controller.abort();
  }, [asset.instrumentId, asset.symbol, hasQuoteConnection, hasTfexConnection, reloadNonce]);

  useEffect(() => {
    if (!currentAnalysis) { setAiResult(null); setAiState('idle'); return undefined; }
    if (!hasSettradeConnection) { setAiResult(null); setAiState('MARKET_NOT_SUPPORTED'); return undefined; }
    if (!rights?.capabilities?.manualDailyScan) { setAiResult(null); setAiState('MEMBERSHIP_REQUIRED'); return undefined; }
    const controller = new AbortController();
    setAiResult(null);
    setAiState('loading');
    const timeout = window.setTimeout(() => {
      fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: asset.symbol,
          timeframe,
          latestDay: liveSeries.latestDay,
          latestTime: liveSeries.latestTime,
          barCount: liveSeries.bars.length,
          price: analysis.price,
          support: analysis.support,
          resistance: analysis.resistance,
          ema20: analysis.ema20,
          ema50: analysis.ema50,
          rsi14: analysis.rsi14,
          macdHistogram: analysis.macdHistogram,
          trend: analysis.trend,
        }),
        signal: controller.signal,
      })
        .then(async response => {
          const payload = await response.json();
          if (!response.ok || payload.status !== 'available') throw new Error(payload.code ?? 'AI_UNAVAILABLE');
          setAiResult({ ...payload, symbol: asset.symbol });
          setAiState('available');
        })
        .catch(error => { if (error.name !== 'AbortError') setAiState(error.message ?? 'LOCAL_MODEL_UNAVAILABLE'); });
    }, 650);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [asset.symbol, analysis, currentAnalysis, hasSettradeConnection, liveSeries?.latestDay, liveSeries?.latestTime, timeframe, rights?.capabilities?.manualDailyScan]);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? window.localStorage.getItem('nova-favorites') ?? '[]');
      if (Array.isArray(stored)) setFavorites([...new Set(stored.filter(item => typeof item === 'string'&&ALL_ASSETS.some(a=>a.symbol===item)))]);
    } catch { /* Favorites remain usable without storage. */ }
  }, []);

  function toggleFavorite(symbol) {
    const saved=favorites.includes(symbol),next=saved?favorites.filter(item=>item!==symbol):[...favorites,symbol];
    setFavorites(next);
    try { window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      setFavoriteNotice(saved?`นำ ${symbol} ออกจากหุ้นโปรดแล้ว`:`บันทึก ${symbol} แล้ว · เปิดที่หุ้นโปรดเพื่อดูราคาและแนวโน้ม`);
    } catch { setFavoriteNotice(`อัปเดตรายการ ${symbol} แล้ว · เบราว์เซอร์นี้เก็บรายการถาวรไม่ได้`); }
  }

  useEffect(()=>{if(!favoriteNotice)return;const timer=window.setTimeout(()=>setFavoriteNotice(''),4500);return()=>window.clearTimeout(timer);},[favoriteNotice]);
  useEffect(()=>{const sync=event=>{if(event.key!==FAVORITES_STORAGE_KEY)return;try{const value=JSON.parse(event.newValue||'[]');if(Array.isArray(value))setFavorites([...new Set(value.filter(s=>typeof s==='string'&&ALL_ASSETS.some(a=>a.symbol===s)))]);}catch{}};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);

  function toggleIndicator(key) {
    setIndicators(current => ({ ...current, [key]: !current[key] }));
  }

  useEffect(() => {
    if (!popup) {
      popupTriggerRef.current?.focus?.();
      popupTriggerRef.current = null;
      return undefined;
    }
    if (!popupTriggerRef.current) popupTriggerRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.requestAnimationFrame(() => {
      const target = popup === 'search' ? modalRef.current?.querySelector('input') : modalRef.current?.querySelector('.modal-close');
      (target ?? modalRef.current)?.focus();
    });
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); setPopup(null); return; }
      if (event.key !== 'Tab' || !modalRef.current) return;
      const items = [...modalRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')].filter(item => item.getClientRects().length > 0);
      if (!items.length) { event.preventDefault(); modalRef.current.focus(); return; }
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.cancelAnimationFrame(focusTimer); window.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow; };
  }, [popup]);

  return (
    <div className={`app-frame market-workspace market-${marketId}`} style={{'--market-accent':page.accent,'--market-rgb':page.rgb}}>
      <AmbientDepth />
      <WorkspaceSidebar marketId={marketId} activeNav={activeNav} onNavigate={navigateTo} rights={rights} account={memberAccount} loginHref={loginHref} hasRealBars={hasRealBars} favoriteCount={favoriteAssets.length} />

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-context"><small>กำลังดู / CURRENT SYMBOL</small><strong>{asset.symbol}</strong><span>{market.label}</span></div>
          <div className="topbar-search-area"><SymbolSearch marketId={marketId} onSelect={selectAsset} /></div>
          <div className="topbar-actions"><div className="market-clock"><i className={hasRealBars || hasRealQuote ? 'status-dot connected' : 'status-dot'} /> {hasRealBars ? `${liveSeries.chartOnly ? 'YAHOO HISTORY' : hasSettradeConnection ? 'SETTRADE' : liveSeries.source} · ${TIMEFRAME_LABELS[timeframe]}` : hasRealQuote ? `${hasTfexConnection ? 'TFEX' : 'FMP'} · QUOTE` : 'DATA · PREVIEW'}</div></div>
        </header>

        <div className="page-content">
          <MarketNavigation current={marketId}/>
          <section id="section-overview" className="workspace-intro nugaom-welcome">
            <div className="welcome-main">
              <span className="eyebrow">{page.eyebrow}</span>
              <h1>{page.title}</h1>
              <p>{page.description}</p>
              <div className="welcome-actions"><a className="welcome-line" href={loginHref}><span className="welcome-line-mark">LINE</span>{rights?.authenticated ? 'เปิดมุมสมาชิก' : 'เริ่มใช้ฟรี 14 วันด้วย LINE'} <span>↗</span></a><button className="welcome-explore" onClick={() => navigateTo('daily')}>เปิดเครื่องมือ <span>→</span></button></div>
            </div>
            <div className="welcome-steps"><span>{rights?.authenticated ? `วันนี้ / ${page.short}` : 'เริ่มต้นกับ Nugaom'}</span><div><b>01</b><span>{rights?.authenticated ? 'ตรวจจังหวะที่ระบบพบ' : 'สำรวจหุ้นและตลาด'}</span></div><div><b>02</b><span>{rights?.authenticated ? 'อ่านกราฟและบริบทตลาด' : 'เชื่อม LINE และแจ้งพอร์ต'}</span></div><div><b>03</b><span>{rights?.authenticated ? 'ติดตามผลและเสียงแจ้งเตือน' : 'ลองใช้เครื่องมือสมาชิก 14 วัน'}</span></div><small>{rights?.authenticated ? `สถานะสมาชิก: ${rights.label}` : 'สิทธิสมาชิกขึ้นกับสถานะบัญชีและการเชื่อมต่อระบบ'}</small></div>
          </section>

          {marketId==='dr'&&<AutoPickBoard marketId={marketId} onSelect={selectAsset}/>}
          {['thai','dr'].includes(marketId)?<DailyDesk marketId={marketId} favorites={favorites} onSelect={selectAsset} rights={rights}/>:<section id="section-daily" className="market-routine panel"><div><span className="eyebrow">TODAY / {page.short}</span><h2>เครื่องมือประจำตลาด</h2><p>{marketId==='us'?'สัญญาณใช้แท่งรายวันหลังตลาดปิด · กราฟย้อนหลังเลือกดูได้หลายช่วงเวลา':marketId==='forex'?'กราฟย้อนหลังคู่เงิน · AutoPick ยังรอฟีดที่ยืนยันใช้แจ้งเตือนได้':'ดูซีรีส์สัญญาและกราฟจริง · AutoPick ยังรอยืนยันกติกาแต่ละสินค้า'}</p></div><div><button onClick={()=>setPopup('scanner')}>สแกนเชิงลึก</button><button onClick={()=>setPopup('calendar')}>ปฏิทินเศรษฐกิจ</button><button onClick={()=>navigateTo('results')}>ผลงานสัญญาณ</button></div></section>}
          {marketId!=='dr'&&<AutoPickBoard marketId={marketId} onSelect={selectAsset}/>}
          {['thai','dr','us'].includes(marketId)&&<HoldingsDesk marketId={marketId} rights={rights} onSelect={selectAsset}/>}

          <section className="asset-hero" aria-label="สินทรัพย์ที่เลือก">
            <div className="hero-copy">
              <div className="hero-overline"><span className="hero-badge">{market.label}</span><span className="hero-separator">/</span><span>{hasRealBars ? `แท่ง ${TIMEFRAME_LABELS[timeframe]} จากแหล่งข้อมูลจริง` : hasTfexConnection ? liveState === 'loading' ? `กำลังอ่าน TFEX OHLC ${TIMEFRAME_LABELS[timeframe]}` : hasRealQuote ? 'ราคา quote ได้ · OHLC กำลังรอข้อมูล' : 'รอข้อมูล TFEX OHLC' : hasFmpConnection ? hasRealQuote ? `ราคา quote จาก ${marketQuote.source} · กราฟยังรอฟีดแท่ง` : quoteState === 'loading' ? 'กำลังอ่านราคา quote' : 'ยังไม่มีราคา quote' : hasSettradeConnection ? liveState === 'loading' ? `กำลังอ่านแท่ง ${TIMEFRAME_LABELS[timeframe]}` : 'ยังไม่มีแท่งราคา' : 'รอเชื่อมข้อมูลราคา'}</span></div>
              <h2>{asset.symbol}{asset.name !== asset.symbol && <span>{asset.name}</span>}</h2>
              <div className="hero-price"><strong>{displayedPrice}</strong><span className={displayedChange.startsWith('−') || displayedChange.startsWith('-') ? 'negative' : 'positive'}>{displayedChange}</span></div>
              <div className="hero-details"><span>แหล่งราคา <b>{hasRealQuote ? marketQuote.source : sourceLabel}</b></span><span>{displayedQuote ? 'เวลา quote' : 'แท่งล่าสุด'} <b>{quoteTimeLabel}</b></span><span>{displayedQuote ? 'สถานะ' : 'กรอบเวลา'} <b>{quoteStatusLabel}</b></span>{hasTfexConnection && <span>หน่วยราคา <b>{asset.priceUnit} · {asset.quoteCurrency}</b></span>}</div>
            </div>
            <div className="hero-art"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-glow" /><Image className="hero-mascot" src="/nugaom-mascot.png" width={180} height={180} alt="" priority /><MarketSparkline bars={sparkBars} /><div className="hero-art-label">PRICE STRUCTURE / {asset.symbol}</div></div>
          </section>

          <div className={`workspace-ticker ${hasRealBars || hasRealQuote ? 'has-live-source' : 'has-preview-source'}`}><span className="ticker-symbol" aria-hidden="true">{hasRealBars || hasRealQuote ? '◉' : '◇'}</span><span className="ticker-copy"><strong>{hasRealBars ? `ข้อมูล ${asset.symbol} พร้อมอ่าน` : hasRealQuote ? `รับราคา quote ของ ${asset.symbol} แล้ว` : `กำลังดู ${asset.symbol} ในโหมดพรีวิว`}</strong><small>{hasRealBars ? `${sourceLabel} · ${TIMEFRAME_LABELS[timeframe]} ล่าสุด ${latestBarLabel}` : hasRealQuote ? hasTfexConnection ? marketQuote.observedAt ? `TFEX Open API · quote ${formatLatestBar({ timeframe: '15m', latestTime: marketQuote.observedAt })} · ยังไม่ใช้วิเคราะห์` : `TFEX Open API · เวลา source ไม่ระบุ · รับ ${formatQuoteReceipt(marketQuote.receivedAt)} · ยังไม่ใช้วิเคราะห์` : `${sourceLabel} · ยังไม่มีแท่งใช้คำนวณ` : `${sourceLabel} · ยังไม่มีแท่งใช้คำนวณ`}</small></span><span className={hasRealBars ? 'ticker-state live' : 'ticker-state'}>{hasRealBars ? liveSeries.chartOnly ? 'HISTORY' : 'REAL OHLC' : hasRealQuote ? 'QUOTE ONLY' : 'PREVIEW'}</span></div>

          {marketId==='us'&&<section className="us-catalog-switch" aria-label="เลือกหุ้นหรือ ETF"><UsAssetTabs value={asset.sectionId==='US_ETFS'?'etf':'stock'} onChange={kind=>{const section=kind==='etf'?'US_ETFS':'US_STOCKS';if(asset.sectionId!==section)selectAsset(MARKET_ASSETS.us.find(a=>a.sectionId===section));}}/><span>{asset.sectionId==='US_ETFS'?'ETF · กราฟและคะแนนเทคนิค · ยังไม่มีสัญญาณอัตโนมัติ':'หุ้น · สแกน AutoPick ทั้ง 500 ตัวหลังตลาดปิด'}</span></section>}
          <div className="favorite-strip"><span>★ หุ้นโปรด</span>{favoriteAssets.length ? favoriteAssets.slice(0,8).map(item => <button key={item.instrumentId} onClick={() => selectAsset(item)}>{item.symbol}{item.sectionId==='US_ETFS'&&<small> ETF</small>}</button>) : <small>เก็บตัวที่สนใจ แล้วติดตามราคาและแนวโน้มต่อได้</small>}<button className="favorite-overview" onClick={()=>navigateTo('favorites')}>ดูหุ้นโปรด ({favoriteAssets.length})</button><button className="favorite-toggle" aria-label={`${favorites.includes(asset.symbol)?'เลิกติดตาม':'ติดตาม'} ${asset.symbol} จากกราฟ`} aria-pressed={favorites.includes(asset.symbol)} onClick={() => toggleFavorite(asset.symbol)}>{favorites.includes(asset.symbol) ? '★ บันทึกแล้ว' : '☆ เพิ่มหุ้นโปรด'}</button></div>



          <section className="primary-grid">

            <article className="panel chart-panel">
              <div className="chart-header"><div className="chart-header-name"><span className="eyebrow">PRICE CHART / {market.label.toUpperCase()}</span><h2>{asset.symbol} {asset.name !== asset.symbol && <small>{asset.name}</small>}</h2></div><span className={hasRealBars ? 'real-pill' : hasTfexConnection ? 'quote-only-pill' : 'demo-pill'}>{hasRealBars ? liveSeries.chartOnly?'HISTORY':'REAL OHLC' : hasTfexConnection ? liveState === 'loading' ? 'LOADING OHLC' : hasRealQuote ? 'QUOTE · NO OHLC' : 'OHLC UNAVAILABLE' : hasCandleConnection ? liveState === 'loading' ? 'LOADING' : 'NO FEED' : 'NO FEED'}</span></div>
              <div className="chart-meta-row"><span>◉ {sourceLabel}</span><span>{displaySection(asset.sectionId)}</span><span>{hasRealBars ? `${TIMEFRAME_LABELS[timeframe]} ล่าสุด ${latestBarLabel}` : 'ยังไม่ใช้ตัดสินสัญญาณ'}</span>{hasRealBars && <span>ประวัติ {liveSeries.bars.length.toLocaleString('th-TH')} แท่ง · ตั้งแต่ {formatHistoryStart(liveSeries.bars[0], timeframe)}</span>}{asset.id === 'thai' && <a href={`https://finance.yahoo.com/quote/${encodeURIComponent(`${asset.symbol}.BK`)}/history/`} target="_blank" rel="noopener noreferrer" title="เปิด Yahoo เพื่อดูย้อนหลังแยกต่างหาก แผนและเสียงแจ้งเตือนในแอปใช้ข้อมูล Settrade">ดูย้อนหลังใน Yahoo ↗</a>}</div>
              <div className="timeframe-bar"><span>{hasTfexConnection ? 'TFEX OHLC' : 'TIMEFRAME'}</span><div className="timeframe-switch">{[['15m','15m'],['1h','1H'],['4h','4H'],['1d','1D']].map(([id,label]) => <button key={id} className={timeframe === id ? 'selected' : ''} disabled={['us','forex'].includes(asset.id)&&id==='4h'} onClick={() => setTimeframe(id)}>{label}</button>)}</div><div className="chart-tools-end"><button aria-label={chartRange === 'recent' ? 'ดูประวัติกราฟทั้งหมด' : 'กลับไปดูแท่งล่าสุด'} aria-pressed={chartRange === 'all'} disabled={!hasRealBars} onClick={() => setChartRange(value => value === 'recent' ? 'all' : 'recent')}>{chartRange === 'recent' ? 'ดูทั้งหมด' : 'ดูล่าสุด'}</button><button aria-label="เปิดกราฟขนาดใหญ่" onClick={() => setPopup('chart')}>⤢</button><button aria-label={hasTfexConnection ? 'รีเฟรชกราฟ TFEX' : 'รีเฟรชแท่งราคา'} disabled={!hasCandleConnection && !hasTfexConnection} onClick={() => setReloadNonce(value => value + 1)}>↻</button></div></div>
              <div className="indicator-strip"><span>CHART</span><button className={chartStyle === 'candles' ? 'selected' : ''} aria-pressed={chartStyle === 'candles'} onClick={() => setChartStyle('candles')}>Candles</button><button className={chartStyle === 'line' ? 'selected' : ''} aria-pressed={chartStyle === 'line'} onClick={() => setChartStyle('line')}>Line</button><span>OVERLAYS</span>{[['ema20', 'EMA 20'], ['ema50', 'EMA 50'], ['sma20', 'SMA 20'], ['bollinger', 'Bollinger'], ['donchian', 'Donchian 20'], ['vwap', 'VWAP*'], ['volume', 'Volume'], ['levels', 'แนวรับ / ต้าน']].map(([key, label]) => <button key={key} className={chartIndicators[key] ? 'selected' : ''} disabled={!analysis || key === 'volume' && asset.id==='forex' || key === 'vwap' && !analysis?.vwapSeries?.length} aria-pressed={Boolean(chartIndicators[key])} title={key === 'vwap' ? 'VWAP สะสมเฉพาะแท่งที่โหลดและมี Volume' : undefined} onClick={() => toggleIndicator(key)}>{label}</button>)}<button onClick={() => setIndicators(Object.fromEntries(Object.keys(DEFAULT_INDICATORS).map(key => [key, false])))}>ล้าง</button><button onClick={() => { setIndicators(DEFAULT_INDICATORS); setChartStyle('candles'); }}>ค่าเริ่มต้น</button></div>
              <CandlestickChart symbol={asset.symbol} timeframe={timeframe} bars={displayBars} analysis={analysis} indicators={chartIndicators} chartStyle={chartStyle} chartRange={chartRange} loading={hasCandleConnection && liveState === 'loading'} unavailable={hasCandleConnection && liveState === 'unavailable'} source={sourceLabel} />
              {hasTfexConnection && <div className="tfex-quote-note">กราฟใช้แท่ง OHLCV ที่มีเวลาแท่งจาก TFEX Open API · เวลา quote ล่าสุดอาจไม่ระบุ · AutoPick ยังรอยืนยันสัญญานำ วันหมดอายุ และความเสี่ยงต่อสัญญา</div>}
              <div className="ohlc-strip"><span>O <b>{latestBar ? formatQuotePrice(latestBar.open,asset) : '—'}</b></span><span>H <b>{latestBar ? formatQuotePrice(latestBar.high,asset) : '—'}</b></span><span>L <b>{latestBar ? formatQuotePrice(latestBar.low,asset) : '—'}</b></span><span>C <b>{latestBar ? formatQuotePrice(latestBar.close,asset) : '—'}</b></span><span>V <b>{latestBar && asset.id!=='forex' ? displayNumber(latestBar.volume, 0) : '—'}</b></span><span className="source-time">{hasRealBars ? `${TIMEFRAME_LABELS[timeframe]} · ${latestBarLabel}` : hasTfexConnection ? 'กำลังรอ TFEX OHLC' : hasCandleConnection ? liveState === 'loading' ? 'LOADING' : 'NO FEED' : 'NO FEED'}</span></div>
              {analysis && <div className="chart-monitor-summary"><span>SUP <b>{formatQuotePrice(analysis.support,asset)}</b></span><span>RES <b>{formatQuotePrice(analysis.resistance,asset)}</b></span><span>RSI 14 <b>{displayNumber(analysis.rsi14, 1)}</b></span><span>MACD <b>{displayNumber(analysis.macdHistogram, 3)}</b></span></div>}
              {liveSeries?.signalMode==='EOD_CLOSED_CANDLE'&&<div className="history-feed-note">ข้อมูลรายวันหลังตลาดปิด · ใช้แท่งปิดสแกนและติดตามสัญญาณ · ราคานี้ไม่ใช่ราคาซื้อขายแบบเรียลไทม์</div>}
              {liveSeries?.chartOnly&&<div className="history-feed-note">Yahoo Finance · กราฟย้อนหลังจาก {liveSeries.sourceTicker} · แท่งปิดแล้ว · ไม่ใช้กราฟสำรองนี้ยืนยัน AutoPick{asset.id==='forex'&&' · ไม่มี Volume รวมของตลาด'}</div>}
              {hasRealBars && <div className="chart-freshness">ข้อมูลแท่ง {TIMEFRAME_LABELS[timeframe]} จาก {sourceLabel} · แท่งล่าสุด {latestBarLabel} · เซิร์ฟเวอร์รับข้อมูล {formatQuoteReceipt(liveSeries.receivedAt)} · {liveSeries.freshness === 'recent' ? 'ข้อมูลตามรอบตลาดล่าสุด' : 'ข้อมูลย้อนหลังเก่า'} · แสดงเฉพาะแท่งปิดแล้ว · โหลดผ่านเว็บ {chartLoadMs == null ? '—' : `${chartLoadMs} ms`} (ไม่ใช่ความหน่วงราคาตลาด) {!liveSeries.chartOnly&&hasSettradeConnection?' · รีเฟรชหลังรอบ 15 นาทีขณะเปิดหน้านี้':''}</div>}
              <ChartToolbox chartOnly={Boolean(liveSeries?.chartOnly)} asset={asset} bars={displayBars} analysis={analysis} tradePlan={tradePlan} freshness={liveSeries?.freshness} latestDay={latestBarLabel} timeframe={TIMEFRAME_LABELS[timeframe]} indicators={chartIndicators} onToggleIndicator={toggleIndicator} onOpenAutomation={() => navigateTo('autopick')} />
            </article>

              <AnalysisRail chartOnly={Boolean(liveSeries?.chartOnly)} asset={asset} analysis={analysis} tradePlan={tradePlan} tradePlanState={hasSettradeConnection && timeframe === '1d' && (liveState === 'loading' || planContextState === 'loading') ? 'loading' : planContextState} aiState={currentAnalysis ? aiState : 'idle'} aiResult={currentAiResult} sourceState={liveState} barsCount={hasRealBars ? liveSeries.bars.length : 0} latestDay={latestBarLabel} timeframe={TIMEFRAME_LABELS[timeframe]} timeframeId={timeframe} freshness={liveSeries?.freshness} currentPrice={hasRealQuote && !hasTfexConnection ? marketQuote?.price : hasRealBars ? liveSeries.quote?.price ?? liveSeries.bars.at(-1)?.close : null} sourceLabel={hasRealQuote ? marketQuote.source : sourceLabel} onOpenAutomation={() => navigateTo('autopick')} />

            <LiveMarketWatch market={market} asset={asset} favorites={favorites} favoritesOpenRequest={favoritesOpenRequest} selectedQuote={hasRealQuote ? marketQuote : hasRealBars ? liveSeries.quote : null} series={hasRealBars ? liveSeries : null} analysis={analysis} timeframe={TIMEFRAME_LABELS[timeframe]} onSelect={selectAsset} onToggleFavorite={toggleFavorite} onRefreshQuote={() => setReloadNonce(value => value + 1)} onOpenScanner={() => setPopup('scanner')} onOpenSearch={() => { setSymbolQuery(''); setSymbolCategory(marketId); setPopup('search'); }} />
          </section>

          <SignalResults fixedMarket={marketId} onSelect={selectLedgerSymbol} loginHref={loginHref} />
          <footer className="page-footer"><span>Nugaom AI Pick · MARKET SIGNAL WORKSPACE</span><span>Settrade · FMP / Yahoo EOD สำหรับหุ้นสหรัฐฯ · ผลสัญญาณอ้างอิงราคาแท่ง ไม่ใช่ fill</span></footer>
        </div>
      </main>

      <NugaomAssistant activeSymbol={asset.symbol} />
      {favoriteNotice&&<div className="favorite-notice" role="status"><span>★</span>{favoriteNotice}<button onClick={()=>navigateTo('favorites')}>ดูรายการ</button><button aria-label="ปิดข้อความหุ้นโปรด" onClick={()=>setFavoriteNotice('')}>×</button></div>}

      {popup && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPopup(null); }}>
        <section ref={modalRef} tabIndex={-1} className={`modal-card ${popup === 'chart' ? 'chart-modal' : ''} ${FEATURE_ITEMS.some(([key]) => key === popup) ? 'feature-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="popup-title">
          <div className="modal-heading"><div><span className="eyebrow">{popup === 'search' ? 'NUGAOM AI PICK / SYMBOL UNIVERSE' : FEATURE_ITEMS.some(([key]) => key === popup) ? 'NUGAOM AI PICK / CONNECTED WORKSPACE' : 'NUGAOM AI PICK / WORKSPACE'}</span><h2 id="popup-title">{popup === 'search' ? 'ค้นหาสินทรัพย์' : popup === 'chart' ? `${asset.symbol} · กราฟ` : { membership: 'สิทธิสมาชิก', financial: 'Financial Check', learn: 'เริ่มต้นใช้งาน', roadmap: 'สถานะและแผนพัฒนา', calendar: 'ปฏิทินเศรษฐกิจ', dividends: 'ปันผลหุ้นไทย · XD' }[popup] ?? FEATURE_ITEMS.find(([key]) => key === popup)?.[2] ?? 'เครื่องมือกราฟ'}</h2></div><button className="modal-close" aria-label="ปิดหน้าต่าง" onClick={() => setPopup(null)}>×</button></div>
          {ANALYSIS_FEATURE_ITEMS.some(([key]) => key === popup) && <nav className="feature-modal-nav" aria-label="สลับเครื่องมือวิเคราะห์">{ANALYSIS_FEATURE_ITEMS.map(([key, , label]) => { const FeatureIcon = FEATURE_ICONS[key]; return <button key={key} className={popup === key ? 'selected' : ''} onClick={() => setPopup(key)}><span><FeatureIcon size={14} /></span>{label}</button>; })}</nav>}
          {popup === 'scanner' && (rights?.capabilities?.manualDailyScan ? <MarketScanner asset={asset} market={market} favorites={favorites} timeframe={timeframe} onSelect={selectAsset} /> : <div className="scanner-member-lock"><h3>Market Scanner สำหรับสมาชิก</h3><p>เข้าสู่ระบบ LINE และแจ้งเลขพอร์ตเพื่อรับสิทธิทดลอง 14 วัน</p><a href="/account">เปิดบัญชีของฉัน ↗</a></div>)}
          {popup === 'multi-tf' && <MultiTimeframe asset={asset} onSelectFrame={selectFrame} />}
          {popup === 'volume' && <VolumePulse asset={asset} bars={displayBars} timeframe={timeframe} onOpenScanner={() => setPopup('scanner')} />}
          {popup === 'news' && <NewsFeedState onOpenGuide={() => setPopup('news-guide')} onOpenCalendar={() => setPopup('calendar')} />}
          {popup === 'news-guide' && <NewsGuide onOpenNews={() => setPopup('news')} />}
          {popup === 'financial' && <FinancialCheck />}
          {popup === 'learn' && <LearningPanel onOpen={navigateTo} />}
          {popup === 'roadmap' && <RoadmapPanel onOpen={navigateTo} />}
          {popup === 'calendar' && <CalendarPanel onOpenGuide={() => setPopup('news-guide')} />}
          {popup === 'dividends' && <DividendCalendarPanel />}
          {popup === 'search' && <>
            <label className="modal-search"><span>⌕</span><input autoFocus value={symbolQuery} onChange={event => setSymbolQuery(event.target.value)} placeholder="ค้นหา PTT, AAPL80, EUR/USD, S50, GO, SVF…" /></label>
            <div className="modal-market-pills"><button className={symbolCategory === 'all' ? 'selected' : ''} onClick={() => setSymbolCategory('all')}>ทั้งหมด <small>{ALL_ASSETS.length}</small></button>{MARKETS.map(item => <button key={item.id} className={symbolCategory === item.id ? 'selected' : ''} onClick={() => setSymbolCategory(item.id)}>{item.label} <small>{MARKET_ASSETS[item.id].length}</small></button>)}</div>
            {['us','US_STOCKS','US_ETFS'].includes(symbolCategory)&&<UsAssetTabs value={symbolCategory==='us'?'all':symbolCategory==='US_ETFS'?'etf':'stock'} showAll onChange={value=>setSymbolCategory(value==='all'?'us':value==='etf'?'US_ETFS':'US_STOCKS')}/>}
            <div className="modal-search-count">พบ {searchResults.length} symbols · เลือกแล้วกราฟกับแผงวิเคราะห์จะเปลี่ยนตาม</div>
            <div className="asset-results">{searchResults.map(item => <button key={item.instrumentId} onClick={() => selectAsset(item)}><span><strong>{item.symbol}</strong><small>{item.name === item.symbol ? displaySection(item.sectionId) : `${item.name} · ${displaySection(item.sectionId)}`}</small></span><span className="asset-result-price">{item.symbol === asset.symbol && hasRealBars ? displayedPrice : item.symbol === asset.symbol && hasRealQuote ? displayedPrice : item.feed === 'settrade-daily' ? 'OHLC' : '—'}<small>{item.feed === 'settrade-daily' ? 'Settrade เมื่อเลือก' : item.feed === 'tfex-quote' ? 'TFEX quote เมื่อเลือก' : item.id === 'us' ? 'กราฟรายวัน เมื่อเลือก' : item.feed === 'fmp-quote' ? 'FMP เมื่อเลือก' : 'รอฟีดราคา'}</small></span></button>)}{searchResults.length === 0 && <p className="empty-state">ไม่พบสินทรัพย์ในรายการที่กำหนด</p>}</div>
            <p className="modal-footnote">SET100: snapshot 2026 H2 · DR80: snapshot 25 ก.ย. 2026 · mai 50: รายชื่อเริ่มต้น ยังไม่ยืนยันอันดับ Market Cap</p>
          </>}
          {popup === 'chart' && <><CandlestickChart symbol={asset.symbol} timeframe={timeframe} bars={displayBars} analysis={analysis} indicators={chartIndicators} chartStyle={chartStyle} chartRange={chartRange} loading={hasCandleConnection && liveState === 'loading'} unavailable={hasCandleConnection && liveState === 'unavailable'} source={sourceLabel} /><p className="modal-footnote">{hasRealBars ? `แท่ง ${TIMEFRAME_LABELS[timeframe]} จริง ${liveSeries.bars.length.toLocaleString('th-TH')} แท่งจาก ${sourceLabel} · ล่าสุด ${latestBarLabel}` : hasCandleConnection ? 'ยังแสดงแท่งจริงไม่ได้' : 'ยังไม่มีกราฟจากราคาแท่งจริง'}</p></>}
        </section>
      </div>}
    </div>
  );
}
