'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { BookOpen, Layers3, Newspaper, NotebookTabs, Radar, Waves } from 'lucide-react';
import { ALL_ASSETS, MARKET_ASSETS, MARKET_GROUPS } from '../markets/catalog.mjs';
import { formatQuotePrice } from '../markets/quote-format.mjs';
import { analyzeCandles } from '../analysis/technical.mjs';
import { buildTradePlan } from '../analysis/trade-plan.mjs';
import { normalizeThaiTradePlan } from '../analysis/thai-tick.mjs';
import SymbolSearch from './symbol-search.jsx';
import AnalysisRail from './analysis-rail.jsx';
import LiveMarketWatch from './live-market-watch.jsx';
import ChartToolbox from './chart-toolbox.jsx';
import { AmbientDepth, MarketScanner, MultiTimeframe, VolumePulse, TerminalView, NewsGuide, NewsFeedState } from './workspace-features.jsx';
import { WorkspaceSidebar, DailyDesk, FinancialCheck, LearningPanel, RoadmapPanel, CommunityPanel, CalendarPanel, DividendCalendarPanel } from './workspace-hub.jsx';
import NugaomAssistant from './nugaom-assistant.jsx';
import AutoPickBoard from './auto-pick-board.jsx';

const DEFAULT_SYMBOLS = { thai: 'PTT', dr: 'AAPL80', tfex: 'S50U26', us: 'NVDA', forex: 'EUR/USD', crypto: 'BTCUSDT' };
const MARKETS = MARKET_GROUPS.map(group => ({
  ...group,
  ...(MARKET_ASSETS[group.id].find(item => item.symbol === DEFAULT_SYMBOLS[group.id]) ?? MARKET_ASSETS[group.id][0]),
}));
const MARKET_LABEL_BY_SYMBOL = new Map(ALL_ASSETS.map(item => [item.symbol, MARKET_GROUPS.find(group => group.id === item.id)?.label ?? item.id]));
const TIMEFRAME_LABELS = { '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D' };
const TIMEFRAME_DESCRIPTIONS = { '15m': '15 นาที', '1h': '1 ชั่วโมง', '4h': '4 ชั่วโมง', '1d': '1 วัน' };
const FEATURE_ITEMS = [
  ['scanner', '◈', 'Market Scanner', 'คัดกรองสินทรัพย์และอ่านเหตุผล', 'SCAN'],
  ['multi-tf', '▦', 'Multi-TF', 'เทียบแนวโน้มหลายกรอบเวลา', 'ANALYZE'],
  ['volume', '◒', 'Volume Pulse', 'สำรวจแรงซื้อขายและปริมาณ', 'FLOW'],
  ['terminal', '▤', 'Terminal', 'ดูสมุดแผนและผลตัวอย่าง', 'DEMO'],
  ['news', '◫', 'ข่าวตลาด', 'อ่านข่าวจากแหล่งข้อมูลจริง', 'SOURCE'],
  ['news-guide', '?', 'คู่มือข่าว', 'อ่านวิธีใช้ข่าวร่วมกับกราฟ', 'GUIDE'],
];
const FEATURE_ICONS = { scanner: Radar, 'multi-tf': Layers3, volume: Waves, terminal: NotebookTabs, news: Newspaper, 'news-guide': BookOpen };
const ANALYSIS_FEATURE_ITEMS = FEATURE_ITEMS.slice(0, 3);
const DEFAULT_INDICATORS = { ema20: true, ema50: false, sma20: false, bollinger: false, donchian: false, vwap: false, volume: true, levels: true };
const FAVORITES_STORAGE_KEY = 'nugaom-ai-pick-favorites';
const LEDGER_STORAGE_KEY = 'nugaom-ai-pick-demo-signal-ledger';
const displaySection = value => value === 'US_STOCKS' ? 'หุ้นสหรัฐฯ' : value === 'US_ETFS' ? 'ETF' : value;

function formatLatestBar(series) {
  if (!series) return '—';
  if (series.timeframe === '1d' || !series.latestTime) return series.latestDay ?? '—';
  const date = new Date(series.latestTime);
  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

const SAMPLE_TRADES = [
  { result: 'ชนะ', symbol: 'EUR/USD', side: 'BUY', entry: '1.08120', exit: '1.08310', pnl: '+0.18%', time: '15:17' },
  { result: 'แพ้', symbol: 'GBP/USD', side: 'SELL', entry: '1.29480', exit: '1.29610', pnl: '−0.10%', time: '14:44' },
  { result: 'ชนะ', symbol: 'USD/JPY', side: 'SELL', entry: '148.52', exit: '148.10', pnl: '+0.28%', time: '14:03' },
  { result: 'ชนะ', symbol: 'EUR/USD', side: 'BUY', entry: '1.07990', exit: '1.08180', pnl: '+0.18%', time: '13:29' },
  { result: 'แพ้', symbol: 'AUD/USD', side: 'BUY', entry: '0.65840', exit: '0.65720', pnl: '−0.18%', time: '12:36' },
];

function buildDemoCandles(symbol, timeframe = '1d', startPrice = 100) {
  const seed = [...symbol].reduce((total, character) => total + character.charCodeAt(0), 0);
  const start = Number.isFinite(startPrice) && startPrice > 0 ? startPrice : 100;
  let close = start;
  const seconds = { '15m': 900, '1h': 3600, '4h': 14_400, '1d': 86_400 }[timeframe] ?? 86_400;
  const now = Math.floor(Date.now() / (seconds * 1000)) * seconds;
  return Array.from({ length: 96 }, (_, index) => {
    const wave = Math.sin((index + seed) * 0.43) * start * 0.0018;
    const drift = Math.sin((index + seed) * 0.09) * start * 0.00035;
    const open = close;
    close = Math.max(0.00001, open + wave + drift);
    const spread = Math.max(start * 0.0008, Math.abs(wave) * 0.75);
    const high = Math.max(open, close) + spread * (0.3 + (index % 4) * 0.08);
    const low = Math.min(open, close) - spread * (0.3 + (index % 5) * 0.07);
    return {
      time: now - (95 - index) * seconds,
      open,
      high,
      low,
      close,
      volume: 10 + ((index * 37 + seed) % 91),
    };
  });
}

function getDemoLevels(asset) {
  const price = Number(asset.price.replaceAll(',', ''));
  if (!Number.isFinite(price) || price <= 0) return { tp: '—', sl: '—' };
  const gap = asset.symbol.includes('JPY') ? 0.18 : asset.symbol.includes('/') && asset.price.includes('1.') ? 0.0012 : asset.symbol.includes('XAU') ? 12 : price > 1000 ? 4 : price > 100 ? 1.2 : 0.15;
  const decimals = (asset.price.split('.')[1] ?? '').length;
  const format = value => value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return { tp: format(price + gap), sl: format(Math.max(0, price - gap)) };
}

function CandlestickChart({ symbol, timeframe = '1d', bars = null, demoPrice = null, analysis = null, indicators = {}, chartStyle = 'candles', loading = false, unavailable = false, source = 'ตลาด' }) {
  const containerRef = useRef(null);
  const demoPriceNumber = Number(String(demoPrice).replaceAll(',', ''));
  const showDemo = !bars && !loading && !unavailable && Number.isFinite(demoPriceNumber) && demoPriceNumber > 0;
  const candles = useMemo(() => bars ?? (showDemo ? buildDemoCandles(symbol, timeframe, demoPriceNumber) : []), [symbol, timeframe, bars, showDemo, demoPriceNumber]);

  useEffect(() => {
    let chart;
    let cancelled = false;
    let observer;

    async function mountChart() {
      if (!containerRef.current) return;
      const { createChart, CandlestickSeries, HistogramSeries, LineSeries, ColorType, LineStyle, TickMarkType } = await import('lightweight-charts');
      if (cancelled || !containerRef.current) return;

      const container = containerRef.current;
      const thaiIntraday = Boolean(bars && timeframe !== '1d');
      const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false });
      const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short' });
      const fullTime = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
      chart = createChart(container, {
        width: container.clientWidth,
        height: 355,
        layout: { background: { type: ColorType.Solid, color: '#09111d' }, textColor: '#8291a8', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', fontSize: 11 },
        grid: { vertLines: { color: '#172334' }, horzLines: { color: '#172334' } },
        crosshair: { vertLine: { color: '#47c8bd', labelBackgroundColor: '#16323a' }, horzLine: { color: '#47c8bd', labelBackgroundColor: '#16323a' } },
        rightPriceScale: { borderColor: '#223047', scaleMargins: { top: 0.08, bottom: 0.22 } },
        timeScale: { borderColor: '#223047', timeVisible: true, secondsVisible: false, rightOffset: 3,
          ...(thaiIntraday ? { tickMarkFormatter: (time, type) => {
            if (typeof time !== 'number') return null;
            const date = new Date(time * 1000);
            return type === TickMarkType.Time || type === TickMarkType.TimeWithSeconds ? clock.format(date)
              : type === TickMarkType.Year ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric' }).format(date) : day.format(date);
          } } : {}) },
        localization: { locale: 'en-US', ...(thaiIntraday ? { timeFormatter: time => typeof time === 'number' ? fullTime.format(new Date(time * 1000)) : String(time) } : {}) },
      });
      const series = chartStyle === 'line'
        ? chart.addSeries(LineSeries, { color: '#6bdac3', lineWidth: 2 })
        : chart.addSeries(CandlestickSeries, {
          upColor: '#53d6aa', downColor: '#fa7185', borderUpColor: '#53d6aa', borderDownColor: '#fa7185', wickUpColor: '#53d6aa', wickDownColor: '#fa7185',
        });
      series.setData(chartStyle === 'line' ? candles.map(bar => ({ time: bar.time, value: bar.close })) : candles);
      if (indicators.volume) {
        const volume = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
          lastValueVisible: false,
          priceLineVisible: false,
        });
        volume.setData(candles.map(bar => ({ time: bar.time, value: bar.volume, color: bar.close >= bar.open ? '#53d6aa4d' : '#fa71854d' })));
        chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      }
      if (analysis && bars) {
        const addOverlay = (data, color, width = 1) => {
          const overlay = chart.addSeries(LineSeries, { color, lineWidth: width, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
          overlay.setData(data);
        };
        if (indicators.ema20) addOverlay(analysis.ema20Series, '#f0bc72', 2);
        if (indicators.ema50) addOverlay(analysis.ema50Series, '#9e91f5', 2);
        if (indicators.sma20) addOverlay(analysis.sma20Series, '#7daaf4', 2);
        if (indicators.vwap && analysis.vwapSeries?.length) addOverlay(analysis.vwapSeries, '#f8ca62', 2);
        if (indicators.donchian) {
          addOverlay(analysis.donchianUpperSeries, '#ee93b8');
          addOverlay(analysis.donchianLowerSeries, '#ee93b8');
        }
        if (indicators.bollinger) {
          addOverlay(analysis.bollingerUpperSeries, '#7091e7');
          addOverlay(analysis.bollingerLowerSeries, '#7091e7');
        }
        if (indicators.levels) {
          series.createPriceLine({ price: analysis.support, color: '#55cba9', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'S' });
          series.createPriceLine({ price: analysis.resistance, color: '#f1ad73', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'R' });
        }
      }
      if (candles.length) chart.timeScale().fitContent();

      observer = new ResizeObserver(entries => {
        const width = entries[0]?.contentRect.width;
        if (width) chart?.applyOptions({ width });
      });
      observer.observe(container);
    }

    mountChart();
    return () => {
      cancelled = true;
      observer?.disconnect();
      chart?.remove();
    };
  }, [candles, analysis, bars, indicators, timeframe, chartStyle]);

  return <div className="chart-surface"><div ref={containerRef} className="chart-canvas" aria-label={`${bars || loading || unavailable ? 'Market' : showDemo ? 'Demo' : 'Unavailable'} ${TIMEFRAME_LABELS[timeframe]} ${chartStyle === 'line' ? 'line' : 'candlestick'} chart for ${symbol}`} />{loading ? <div className="chart-loading-skeleton" aria-busy="true" aria-label={`กำลังโหลดกราฟ ${symbol} ${TIMEFRAME_LABELS[timeframe]}`}><div className="chart-skeleton-head"><span className="ui-skeleton-line" /><span className="ui-skeleton-line" /></div><div className="chart-skeleton-grid">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ '--bar-height': `${36 + ((index * 19) % 50)}%`, '--bar-offset': `${(index * 13) % 31}%` }} />)}</div><span className="chart-skeleton-caption">กำลังอ่านแท่ง {TIMEFRAME_LABELS[timeframe]} จาก {source}…</span></div> : (unavailable || !bars && !showDemo) && <div className="chart-empty"><strong>ยังไม่มีแท่งราคาสำหรับกราฟนี้</strong><span>เลือก symbol อื่น หรือรอเชื่อมแหล่งข้อมูลราคา</span></div>}{showDemo && <div className="chart-disclaimer">แท่งราคา DEMO สร้างเพื่อจัดวางหน้าจอ · ยังไม่ใช่ข้อมูลตลาดจริง</div>}</div>;
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

function sampleTradesForAsset(asset, price) {
  const numericPrice = Number(String(price).replaceAll(',', ''));
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) return [];
  const digits = Math.max(2, Math.min(5, (String(price).split('.')[1] ?? '').length));
  return SAMPLE_TRADES.map((row, index) => {
    const entry = numericPrice * (1 + [0.008, -0.004, 0.003, -0.007, 0.006][index]);
    const pnl = Number(row.pnl.replace('−', '-').replace('%', '')) / 100;
    const exit = entry * (row.side === 'BUY' ? 1 + pnl : 1 - pnl);
    return { ...row, symbol: asset.symbol, entry: displayNumber(entry, digits), exit: displayNumber(exit, digits) };
  });
}

export default function Workspace() {
  const [activeMarket, setActiveMarket] = useState('thai');
  const [activeNav, setActiveNav] = useState('overview');
  const [filter, setFilter] = useState('all');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [timeframe, setTimeframe] = useState('1d');
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);
  const [chartStyle, setChartStyle] = useState('candles');
  const [liveSeries, setLiveSeries] = useState(null);
  const [liveState, setLiveState] = useState('idle');
  const [planContext, setPlanContext] = useState(null);
  const [planContextState, setPlanContextState] = useState('idle');
  const [aiState, setAiState] = useState('idle');
  const [aiResult, setAiResult] = useState(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [favorites, setFavorites] = useState([]);
  const [popup, setPopup] = useState(null);
  const modalRef = useRef(null);
  const popupTriggerRef = useRef(null);
  const [symbolQuery, setSymbolQuery] = useState('');
  const [symbolCategory, setSymbolCategory] = useState('all');
  const [demoLedger, setDemoLedger] = useState([]);
  const [ledgerReady, setLedgerReady] = useState(false);
  const [autoCapture, setAutoCapture] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [toast, setToast] = useState(null);
  const [contactAudience, setContactAudience] = useState('analyst');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [rights, setRights] = useState(null);
  const [marketQuote, setMarketQuote] = useState(null);
  const [quoteState, setQuoteState] = useState('idle');
  const market = MARKETS.find(item => item.id === activeMarket) ?? MARKETS[0];
  const asset = selectedAsset ?? market;
  const hasSettradeConnection = asset.feed === 'settrade-daily';
  const hasFmpConnection = asset.feed === 'fmp-quote';
  const hasCandleConnection = hasSettradeConnection || asset.id === 'us' && timeframe === '1d';
  const hasRealQuote = hasFmpConnection && quoteState === 'available' && marketQuote?.instrumentId === asset.instrumentId;
  const hasRealBars = hasCandleConnection && liveState === 'available' && liveSeries?.instrumentId === asset.instrumentId && liveSeries?.timeframe === timeframe && (liveSeries?.bars?.length ?? 0) > 0;
  const displayedPrice = hasSettradeConnection
    ? hasRealBars ? displayNumber(liveSeries.quote?.price ?? liveSeries.bars.at(-1).close) : '—'
    : hasFmpConnection ? hasRealQuote ? formatQuotePrice(marketQuote.price, asset) : hasRealBars ? formatQuotePrice(liveSeries.bars.at(-1).close, asset) : '—' : asset.price;
  const displayedChange = hasSettradeConnection
    ? hasRealBars && typeof liveSeries.quote?.changePercent === 'number' ? `${liveSeries.quote.changePercent >= 0 ? '+' : ''}${displayNumber(liveSeries.quote.changePercent)}%` : '—'
    : hasFmpConnection ? hasRealQuote && typeof marketQuote.changePercent === 'number' ? `${marketQuote.changePercent >= 0 ? '+' : ''}${displayNumber(marketQuote.changePercent)}%` : '—' : asset.change;
  const displayBars = hasRealBars ? liveSeries.bars : null;
  const latestBar = hasRealBars ? liveSeries.bars.at(-1) : null;
  const latestBarLabel = hasRealBars ? formatLatestBar(liveSeries) : '—';
  const previewPrice = Number(String(asset.price).replaceAll(',', ''));
  const sparkBars = displayBars ?? (hasCandleConnection || !Number.isFinite(previewPrice) || previewPrice <= 0 ? [] : buildDemoCandles(asset.symbol, '1d', previewPrice));
  const analysis = useMemo(() => hasRealBars ? analyzeCandles(liveSeries.bars, timeframe === '1d' ? liveSeries.quote?.price : null, TIMEFRAME_DESCRIPTIONS[timeframe]) : null, [hasRealBars, liveSeries, timeframe]);
  const tradePlan = useMemo(() => hasRealBars && timeframe === '1d' && hasSettradeConnection && planContextState === 'available'
    && planContext?.instrumentId === asset.instrumentId
    ? (asset.id === 'thai' ? normalizeThaiTradePlan(buildTradePlan({ symbol: asset.symbol, instrumentId: asset.instrumentId, dailyBars: liveSeries.bars,
      fourHourBars: planContext.fourHour, oneHourBars: planContext.oneHour, allowShort: false }))
      : buildTradePlan({ symbol: asset.symbol, instrumentId: asset.instrumentId, dailyBars: liveSeries.bars,
        fourHourBars: planContext.fourHour, oneHourBars: planContext.oneHour, allowShort: false })) : null,
  [hasRealBars, timeframe, hasSettradeConnection, planContextState, planContext, asset.instrumentId, asset.symbol, liveSeries]);
  const currentAnalysis = Boolean(analysis) && liveSeries?.freshness === 'recent';
  const currentAiResult = currentAnalysis && aiResult?.symbol === asset.symbol && aiResult.timeframe === timeframe && aiResult.latestDay === liveSeries?.latestDay && aiResult.latestTime === (liveSeries?.latestTime ?? null) ? aiResult : null;
  const demoPrice = hasRealBars ? displayedPrice : asset.price;
  const demoLevels = getDemoLevels({ ...asset, price: demoPrice });
  const favoriteAssets = ALL_ASSETS.filter((item, index, all) => favorites.includes(item.symbol) && all.findIndex(candidate => candidate.symbol === item.symbol) === index);
  const searchResults = ALL_ASSETS.filter(item => (symbolCategory === 'all' || item.id === symbolCategory)
    && (!symbolQuery.trim() || `${item.symbol} ${item.name} ${item.sectionId}`.toLowerCase().includes(symbolQuery.trim().toLowerCase())));
  const sourceLabel = hasRealBars ? liveSeries.source : hasCandleConnection ? liveState === 'loading' ? `กำลังเชื่อม ${hasSettradeConnection ? 'Settrade' : 'FMP EOD'}` : 'ฟีดแท่งราคาไม่พร้อม' : hasFmpConnection ? hasRealQuote ? 'FMP · Quote snapshot' : quoteState === 'loading' ? 'กำลังอ่าน FMP quote' : 'ฟีดราคาไม่พร้อม' : asset.price === '—' ? 'ยังไม่เชื่อมฟีด' : 'Demo feed';
  const rows = Number.isFinite(Number(String(demoPrice).replaceAll(',', ''))) ? sampleTradesForAsset(asset, demoPrice) : [];
  const historyRows = [...demoLedger, ...rows];
  const visibleRows = historyRows.filter(row => filter === 'all' || (filter === 'win' ? row.result === 'ชนะ' : filter === 'loss' ? row.result === 'แพ้' : row.result === 'กำลังติดตาม'));
  const closedRows = [...rows, ...demoLedger.filter(row => row.result === 'ชนะ' || row.result === 'แพ้')];
  const winCount = closedRows.filter(row => row.result === 'ชนะ').length;
  const lossCount = closedRows.filter(row => row.result === 'แพ้').length;
  const netPnl = closedRows.reduce((sum, row) => sum + Number(String(row.pnl).replace('%', '').replace('−', '-')), 0);
  const winRate = closedRows.length ? winCount / closedRows.length * 100 : 0;
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/membership', { cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(payload => { if (!controller.signal.aborted) setRights(payload?.rights ?? null); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  function navigateTo(id) {
    if (id === 'account' || id === 'membership') { window.location.href = '/account'; return; }
    setActiveNav(id);
    if (id === 'analysis-tools') { setPopup('scanner'); return; }
    const selector = { overview: '#section-overview', daily: '#section-daily', autopick: '#section-auto-pick', favorites: '.favorite-strip', watchlist: '.live-market-watch', signals: '#section-trade-plan', stats: '#section-stats', history: '#section-history' }[id];
    if (selector) { document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setPopup(null); }
    else setPopup(id);
  }

  function selectAsset(item, frame = '1d') {
    setActiveMarket(item.id);
    setSelectedAsset(item);
    setTimeframe(frame);
    setPopup(null);
    window.requestAnimationFrame(() => document.querySelector('.chart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function selectFrame(frame) {
    setTimeframe(frame);
    setPopup(null);
    window.requestAnimationFrame(() => document.querySelector('.chart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function selectLedgerSymbol(symbol) {
    const item = ALL_ASSETS.find(candidate => candidate.symbol === symbol);
    if (item) selectAsset(item);
  }

  useEffect(() => {
    if (!hasCandleConnection) { setLiveSeries(null); setLiveState('idle'); return undefined; }
    const controller = new AbortController();
    setLiveSeries(null);
    setLiveState('loading');
    const route = hasSettradeConnection ? '/api/market-data' : '/api/us-bars';
    fetch(`${route}?symbol=${encodeURIComponent(asset.symbol)}&timeframe=${timeframe}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok || payload.status !== 'available' || !Array.isArray(payload.bars) || payload.bars.length === 0) throw new Error(payload.code ?? 'SOURCE_UNAVAILABLE');
        setLiveSeries(payload);
        setLiveState('available');
      })
      .catch(error => { if (error.name !== 'AbortError') { setLiveSeries(null); setLiveState('unavailable'); } });
    return () => controller.abort();
  }, [asset.instrumentId, hasCandleConnection, hasSettradeConnection, timeframe, reloadNonce]);

  useEffect(() => {
    if (!hasSettradeConnection || timeframe !== '1d') { setPlanContext(null); setPlanContextState('idle'); return undefined; }
    const controller = new AbortController();
    setPlanContext(null);
    setPlanContextState('loading');
    Promise.all(['4h', '1h'].map(async frame => {
      const response = await fetch(`/api/market-data?symbol=${encodeURIComponent(asset.symbol)}&timeframe=${frame}`,
        { cache: 'no-store', signal: controller.signal });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'available' || payload.instrumentId !== asset.instrumentId
        || payload.timeframe !== frame || !Array.isArray(payload.bars)) throw new Error('PLAN_CONTEXT_UNAVAILABLE');
      return payload.bars;
    }))
      .then(([fourHour, oneHour]) => { if (!controller.signal.aborted) { setPlanContext({ instrumentId: asset.instrumentId, fourHour, oneHour }); setPlanContextState('available'); } })
      .catch(error => { if (error.name !== 'AbortError' && !controller.signal.aborted) { setPlanContext(null); setPlanContextState('unavailable'); } });
    return () => controller.abort();
  }, [asset.instrumentId, asset.symbol, hasSettradeConnection, timeframe, reloadNonce]);

  useEffect(() => {
    if (!hasFmpConnection) { setMarketQuote(null); setQuoteState('idle'); return undefined; }
    const controller = new AbortController();
    setMarketQuote(null);
    setQuoteState('loading');
    fetch(`/api/quote?symbol=${encodeURIComponent(asset.symbol)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok || payload.status !== 'available') throw new Error(payload.code ?? 'SOURCE_UNAVAILABLE');
        setMarketQuote(payload);
        setQuoteState('available');
      })
      .catch(error => { if (error.name !== 'AbortError') { setMarketQuote(null); setQuoteState('unavailable'); } });
    return () => controller.abort();
  }, [asset.symbol, hasFmpConnection, reloadNonce]);

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
      if (Array.isArray(stored)) setFavorites(stored.filter(item => typeof item === 'string'));
    } catch { /* Favorites remain usable without storage. */ }
  }, []);

  function toggleFavorite(symbol) {
    setFavorites(current => {
      const next = current.includes(symbol) ? current.filter(item => item !== symbol) : [...current, symbol];
      try { window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next)); } catch { /* Local storage is optional. */ }
      return next;
    });
  }

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

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LEDGER_STORAGE_KEY) ?? window.localStorage.getItem('nova-demo-signal-ledger');
      const parsed = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) setDemoLedger(parsed);
    } catch { /* Ignore malformed local demo data. */ }
    setLedgerReady(true);
  }, []);

  useEffect(() => {
    if (ledgerReady) {
      try { window.localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(demoLedger)); } catch { /* Storage can be unavailable in private browser contexts. */ }
    }
  }, [demoLedger, ledgerReady]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 9000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function captureDemoPlan() {
    if (demoLevels.tp === '—' || demoLevels.sl === '—') return;
    const plan = { id: `DEMO-${Date.now()}`, symbol: asset.symbol, side: 'BUY', entry: demoPrice, tp: demoLevels.tp, sl: demoLevels.sl, result: 'กำลังติดตาม', pnl: '—', time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) };
    setDemoLedger(current => [plan, ...current]);
    setToast({ title: 'บันทึกแผนตัวอย่างแล้ว · DEMO', detail: `${asset.symbol} · BUY · ติดตาม TP ${demoLevels.tp} / SL ${demoLevels.sl}`, result: 'ติดตามแผน' });
  }

  function settleDemoPlan(plan, result) {
    const won = result === 'ชนะ';
    const pnl = won ? '+1.20%' : '−1.00%';
    setDemoLedger(current => current.map(item => item.id === plan.id ? { ...item, result, pnl, exit: won ? item.tp : item.sl } : item));
    const phrase = won ? `แผน ${plan.symbol} ปิดกำไรแล้ว กำไรตัวอย่าง 1.2 เปอร์เซ็นต์` : `แผน ${plan.symbol} ปิดขาดทุนแล้ว ขาดทุนตัวอย่าง 1 เปอร์เซ็นต์`;
    setToast({ title: won ? 'ปิดกำไรแล้ว · DEMO' : 'ปิดขาดทุนแล้ว · DEMO', detail: `${plan.symbol} · ${pnl} · ราคาปิด ${won ? plan.tp : plan.sl}`, result });
    if (voiceEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const speech = new SpeechSynthesisUtterance(phrase);
      speech.lang = 'th-TH';
      speech.rate = 0.92;
      window.speechSynthesis.speak(speech);
    }
  }

  function sendDemoMessage(event) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message) return;
    setChatMessages(current => [...current, { from: 'you', text: message }, { from: 'demo', text: 'ได้รับข้อความในหน้าตัวอย่างแล้ว เมื่อเชื่อมช่องทางทีมจริง ระบบจะแสดงสถานะผู้รับและประวัติการตอบกลับที่นี่' }]);
    setChatInput('');
  }

  return (
    <div className="app-frame">
      <AmbientDepth />
      <WorkspaceSidebar activeNav={activeNav} onNavigate={navigateTo} rights={rights} hasRealBars={hasRealBars} favoriteCount={favoriteAssets.length} />

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-context"><small>กำลังดู / CURRENT SYMBOL</small><strong>{asset.symbol}</strong><span>{market.label}</span></div>
          <div className="topbar-search-area"><SymbolSearch onSelect={selectAsset} /></div>
          <div className="topbar-actions"><div className="market-clock"><i className={hasRealBars ? 'status-dot connected' : 'status-dot'} /> {hasRealBars ? `${hasSettradeConnection ? 'SETTRADE' : 'FMP EOD'} · ${TIMEFRAME_LABELS[timeframe]}` : 'DATA · PREVIEW'}</div></div>
        </header>

        <div className="page-content">
          <section id="section-overview" className="workspace-intro"><div><span className="eyebrow">NUGAOM AI PICK / MARKET INTELLIGENCE</span><h1>ตลาดของคุณ ในมุมมองเดียว</h1><p>สำรวจราคา อ่านแผน และย้อนตรวจผลสัญญาณได้จากพื้นที่ทำงานเดียว</p></div><span className="intro-version">WORKSPACE 02 <i /> LOCAL PREVIEW</span></section>

          <section className="asset-hero" aria-label="สินทรัพย์ที่เลือก">
            <div className="hero-copy"><div className="hero-overline"><span className="hero-badge">{market.label}</span><span className="hero-separator">/</span><span>{hasRealBars ? `แท่ง ${TIMEFRAME_LABELS[timeframe]} จากแหล่งข้อมูลจริง` : hasFmpConnection ? hasRealQuote ? 'ราคา quote จาก FMP · กราฟยังรอฟีดแท่ง' : quoteState === 'loading' ? 'กำลังอ่านราคา quote' : 'ยังไม่มีราคา quote' : hasSettradeConnection ? liveState === 'loading' ? `กำลังอ่านแท่ง ${TIMEFRAME_LABELS[timeframe]}` : 'ยังไม่มีแท่งราคา' : asset.price !== '—' ? 'ราคาและกราฟตัวอย่าง DEMO' : 'รอเชื่อมข้อมูลราคา'}</span></div><h2>{asset.symbol}{asset.name !== asset.symbol && <span>{asset.name}</span>}</h2><div className="hero-price"><strong>{displayedPrice}</strong><span className={displayedChange.startsWith('−') || displayedChange.startsWith('-') ? 'negative' : 'positive'}>{displayedChange}</span></div><div className="hero-details"><span>แหล่งราคา <b>{hasRealQuote ? 'FMP · Quote snapshot' : sourceLabel}</b></span><span>{hasRealQuote ? 'เวลา quote' : 'แท่งล่าสุด'} <b>{hasRealQuote ? marketQuote?.observedAt ? formatLatestBar({ timeframe: '15m', latestTime: marketQuote.observedAt }) : 'ไม่ระบุ' : latestBarLabel}</b></span><span>{hasRealQuote ? 'สถานะ' : 'กรอบเวลา'} <b>{hasRealQuote ? marketQuote?.freshness === 'recent' ? 'ล่าสุด' : 'ตลาดปิด / ข้อมูลย้อนหลัง' : TIMEFRAME_LABELS[timeframe]}</b></span></div></div>
            <div className="hero-art"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-glow" /><Image className="hero-mascot" src="/nugaom-mascot.png" width={180} height={180} alt="" priority /><MarketSparkline bars={sparkBars} /><div className="hero-art-label">PRICE STRUCTURE / {asset.symbol}</div></div>
          </section>

          <div className={`workspace-ticker ${hasRealBars ? 'has-live-source' : 'has-preview-source'}`}><span className="ticker-symbol" aria-hidden="true">{hasRealBars ? '◉' : '◇'}</span><span className="ticker-copy"><strong>{hasRealBars ? `ข้อมูล ${asset.symbol} พร้อมอ่าน` : `กำลังดู ${asset.symbol} ในโหมดพรีวิว`}</strong><small>{hasRealBars ? `${sourceLabel} · ${TIMEFRAME_LABELS[timeframe]} ล่าสุด ${latestBarLabel}` : `${sourceLabel} · สถิติผลสัญญาณด้านล่างเป็น DEMO`}</small></span><span className={hasRealBars ? 'ticker-state live' : 'ticker-state'}>{hasRealBars ? 'REAL OHLC' : 'PREVIEW'}</span><button onClick={() => navigateTo('daily')}>สแกนตลาดวันนี้ <b>↗</b></button></div>

          <div className="favorite-strip"><span>★ &nbsp;คู่โปรด</span>{favoriteAssets.length ? favoriteAssets.map(item => <button key={item.instrumentId} onClick={() => selectAsset(item)}>{item.symbol}</button>) : <small>กดดาวใน Watchlist เพื่อเก็บสินทรัพย์ที่ดูบ่อย</small>}<button className="favorite-toggle" aria-pressed={favorites.includes(asset.symbol)} onClick={() => toggleFavorite(asset.symbol)}>{favorites.includes(asset.symbol) ? '★ บันทึกแล้ว' : '☆ ปักหมุดคู่นี้'}</button></div>

          <DailyDesk favorites={favorites} onSelect={selectAsset} rights={rights} />
          <AutoPickBoard onSelect={selectAsset} />

          <section className="market-switcher" aria-label="เลือกประเภทตลาด">
            {MARKETS.map(item => <button key={item.id} onClick={() => { setActiveMarket(item.id); setSelectedAsset(null); setTimeframe('1d'); }} className={activeMarket === item.id ? `market-tab active ${item.id}` : `market-tab ${item.id}`}><span className="tab-title">{item.label} <b>{MARKET_ASSETS[item.id].length}</b></span><span className="tab-detail">{item.detail}</span>{item.id === 'crypto' && <span className="secondary-label">รอง</span>}</button>)}
          </section>

          <section className="primary-grid">
            <LiveMarketWatch market={market} asset={asset} favorites={favorites} selectedQuote={hasRealQuote ? marketQuote : hasRealBars ? liveSeries.quote : null} quoteState={quoteState} analysis={analysis} freshness={liveSeries?.freshness} timeframe={TIMEFRAME_LABELS[timeframe]} onSelect={selectAsset} onToggleFavorite={toggleFavorite} onRefreshQuote={() => setReloadNonce(value => value + 1)} onOpenVolume={() => setPopup('volume')} onOpenScanner={() => setPopup('scanner')} onOpenSearch={() => { setSymbolQuery(''); setSymbolCategory('all'); setPopup('search'); }} />

            <article className="panel chart-panel">
              <div className="chart-header"><div className="chart-header-name"><span className="eyebrow">PRICE CHART / {market.label.toUpperCase()}</span><h2>{asset.symbol} {asset.name !== asset.symbol && <small>{asset.name}</small>}</h2></div><span className={hasRealBars ? 'real-pill' : 'demo-pill'}>{hasRealBars ? 'REAL OHLC' : hasCandleConnection ? liveState === 'loading' ? 'LOADING' : 'NO FEED' : asset.price !== '—' ? 'DEMO' : 'NO FEED'}</span></div>
              <div className="chart-meta-row"><span>◉ {sourceLabel}</span><span>{displaySection(asset.sectionId)}</span><span>{hasRealBars ? `${TIMEFRAME_LABELS[timeframe]} ล่าสุด ${latestBarLabel}` : 'ยังไม่ใช้ตัดสินสัญญาณ'}</span></div>
              <div className="timeframe-bar"><span>TIMEFRAME</span><div className="timeframe-switch">{[['15m','15m'],['1h','1H'],['4h','4H'],['1d','1D']].map(([id,label]) => <button key={id} className={timeframe === id ? 'selected' : ''} disabled={!hasSettradeConnection && asset.price === '—' && id !== '1d'} onClick={() => setTimeframe(id)}>{label}</button>)}</div><div className="chart-tools-end"><button aria-label="เปิดกราฟขนาดใหญ่" onClick={() => setPopup('chart')}>⤢</button><button aria-label="รีเฟรชแท่งราคา" disabled={!hasCandleConnection} onClick={() => setReloadNonce(value => value + 1)}>↻</button></div></div>
              <div className="indicator-strip"><span>CHART</span><button className={chartStyle === 'candles' ? 'selected' : ''} aria-pressed={chartStyle === 'candles'} onClick={() => setChartStyle('candles')}>Candles</button><button className={chartStyle === 'line' ? 'selected' : ''} aria-pressed={chartStyle === 'line'} onClick={() => setChartStyle('line')}>Line</button><span>OVERLAYS</span>{[['ema20', 'EMA 20'], ['ema50', 'EMA 50'], ['sma20', 'SMA 20'], ['bollinger', 'Bollinger'], ['donchian', 'Donchian 20'], ['vwap', 'VWAP*'], ['volume', 'Volume'], ['levels', 'แนวรับ / ต้าน']].map(([key, label]) => <button key={key} className={indicators[key] ? 'selected' : ''} disabled={!analysis || key === 'vwap' && !analysis?.vwapSeries?.length} aria-pressed={Boolean(indicators[key])} title={key === 'vwap' ? 'VWAP สะสมเฉพาะแท่งที่โหลดและมี Volume' : undefined} onClick={() => toggleIndicator(key)}>{label}</button>)}<button onClick={() => setIndicators(Object.fromEntries(Object.keys(DEFAULT_INDICATORS).map(key => [key, false])))}>ล้าง</button><button onClick={() => { setIndicators(DEFAULT_INDICATORS); setChartStyle('candles'); }}>ค่าเริ่มต้น</button></div>
              <CandlestickChart symbol={asset.symbol} timeframe={timeframe} bars={displayBars} demoPrice={asset.price} analysis={analysis} indicators={indicators} chartStyle={chartStyle} loading={hasCandleConnection && liveState === 'loading'} unavailable={hasCandleConnection && liveState === 'unavailable'} source={hasSettradeConnection ? 'Settrade' : 'FMP EOD'} />
              <div className="ohlc-strip"><span>O <b>{latestBar ? displayNumber(latestBar.open) : '—'}</b></span><span>H <b>{latestBar ? displayNumber(latestBar.high) : '—'}</b></span><span>L <b>{latestBar ? displayNumber(latestBar.low) : '—'}</b></span><span>C <b>{latestBar ? displayNumber(latestBar.close) : '—'}</b></span><span>V <b>{latestBar ? displayNumber(latestBar.volume, 0) : '—'}</b></span><span className="source-time">{hasRealBars ? `${TIMEFRAME_LABELS[timeframe]} · ${latestBarLabel}` : hasCandleConnection ? liveState === 'loading' ? 'LOADING' : 'NO FEED' : asset.price !== '—' ? 'DEMO' : 'NO FEED'}</span></div>
              {analysis && <div className="chart-monitor-summary"><span>SUP <b>{displayNumber(analysis.support)}</b></span><span>RES <b>{displayNumber(analysis.resistance)}</b></span><span>RSI 14 <b>{displayNumber(analysis.rsi14, 1)}</b></span><span>MACD <b>{displayNumber(analysis.macdHistogram, 3)}</b></span></div>}
              {hasRealBars && <div className="chart-freshness">ข้อมูลแท่ง {TIMEFRAME_LABELS[timeframe]} จริงจาก {sourceLabel} · {liveSeries.freshness === 'recent' ? 'ข้อมูลตามรอบตลาดล่าสุด' : 'ข้อมูลย้อนหลังเก่า'} · {timeframe === '1d' ? 'รายวัน · แท่งปิดแล้ว' : 'แกนเวลาไทย (ICT) · แท่งล่าสุดอาจยังไม่ปิด'} · ไม่ใช่ฟีดสตรีม · ระดับราคาและแผนคำนวณตามกติกา</div>}
              <ChartToolbox asset={asset} bars={displayBars} analysis={analysis} tradePlan={tradePlan} freshness={liveSeries?.freshness} latestDay={latestBarLabel} timeframe={TIMEFRAME_LABELS[timeframe]} indicators={indicators} onToggleIndicator={toggleIndicator} onOpenAutomation={() => navigateTo('autopick')} />
            </article>

            <AnalysisRail asset={asset} analysis={analysis} tradePlan={tradePlan} tradePlanState={hasSettradeConnection && timeframe === '1d' && (liveState === 'loading' || planContextState === 'loading') ? 'loading' : planContextState} aiState={currentAnalysis ? aiState : 'idle'} aiResult={currentAiResult} sourceState={liveState} barsCount={hasRealBars ? liveSeries.bars.length : 0} latestDay={latestBarLabel} timeframe={TIMEFRAME_LABELS[timeframe]} timeframeId={timeframe} freshness={liveSeries?.freshness} currentPrice={hasRealQuote ? marketQuote?.price : hasRealBars ? liveSeries.quote?.price ?? liveSeries.bars.at(-1)?.close : null} sourceLabel={hasRealQuote ? 'FMP · Quote snapshot' : sourceLabel} onOpenAutomation={() => navigateTo('autopick')} onOpenContact={() => setPopup('contact')} />
          </section>

          <section id="section-stats" className="performance-section">
            <div className="section-heading"><div><div className="eyebrow">PERFORMANCE LEDGER · DEMO</div><h2>ผลลัพธ์ครบทุกสัญญาณ</h2></div><div className="range-switch"><button disabled title="ข้อมูลตัวอย่างยังไม่แยกตามวัน">วันนี้</button><button className="selected">ชุดตัวอย่าง</button><button disabled title="ข้อมูลตัวอย่างยังไม่แยกตามวัน">30 วัน</button><button disabled title="ข้อมูลตัวอย่างยังไม่แยกตามวัน">ทั้งหมด</button></div></div>
            <div className="stats-grid">
              <article className="panel stat-card"><span className="stat-label">Win rate · DEMO</span><strong className="stat-value accent">{winRate.toFixed(1)}%</strong><span className="stat-note">จาก {closedRows.length} ไม้ตัวอย่างที่ปิดผล</span><div className="stat-bar"><span style={{ width: `${winRate}%` }} /></div></article>
              <article className="panel stat-card"><span className="stat-label">ชนะ / แพ้ · DEMO</span><strong className="stat-value">{winCount} <em>/</em> {lossCount}</strong><span className="stat-note">กำลังติดตาม {demoLedger.filter(row => row.result === 'กำลังติดตาม').length} ไม้</span></article>
              <article className="panel stat-card"><span className="stat-label">กำไรสุทธิสะสม · DEMO</span><strong className={`stat-value ${netPnl >= 0 ? 'positive' : 'negative'}`}>{netPnl >= 0 ? '+' : ''}{netPnl.toFixed(2)}%</strong><span className="stat-note">ตัวอย่าง · ไม่รวมต้นทุน</span></article>
              <article className="panel stat-card"><span className="stat-label">Max drawdown</span><strong className="stat-value negative">−0.10%</strong><span className="stat-note">จากชุดข้อมูลตัวอย่าง</span></article>
            </div>
          </section>

          <section id="section-history" className="panel history-panel">
            <div className="history-heading"><div><h2>ประวัติสัญญาณ · ตรวจสอบได้ทุกไม้</h2><p>ตัวอย่างหน้าจอ · ผลจริงต้องผูกกับราคาและกติกาปิดผล</p></div><div className="history-filters"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>ทั้งหมด</button><button className={filter === 'pending' ? 'selected' : ''} onClick={() => setFilter('pending')}>กำลังติดตาม</button><button className={filter === 'win' ? 'selected' : ''} onClick={() => setFilter('win')}>ชนะ</button><button className={filter === 'loss' ? 'selected' : ''} onClick={() => setFilter('loss')}>แพ้</button></div></div>
            <div className="table-wrap"><table><thead><tr><th>ผล</th><th>สินทรัพย์</th><th>ฝั่ง</th><th>ราคาเข้า</th><th>ราคาออก</th><th>P/L</th><th>เวลา</th></tr></thead><tbody>
              {visibleRows.map((row, index) => <tr key={`${row.id ?? row.symbol}-${row.time}-${index}`}><td><span className={`result-pill ${row.result === 'ชนะ' ? 'win' : row.result === 'แพ้' ? 'loss' : 'pending'}`}><i />{row.result}</span></td><td><strong>{row.symbol}</strong><span className="asset-market">{MARKET_LABEL_BY_SYMBOL.get(row.symbol) ?? 'ไม่ระบุตลาด'}</span></td><td className={row.side === 'BUY' ? 'positive' : 'negative'}>{row.side}</td><td>{row.entry}</td><td>{row.exit ?? '—'}</td><td className={row.result === 'ชนะ' ? 'positive' : row.result === 'แพ้' ? 'negative' : 'muted-cell'}>{row.pnl}</td><td className="muted-cell">{row.time}</td></tr>)}
            </tbody></table></div>
            <div className="history-footnote">ไม้ที่ยังไม่ปิดผลต้องแสดงแยก และไม่นับใน Win rate จนกว่าจะประเมินจากกติกาที่ตรวจสอบได้</div>
          </section>
          <footer className="page-footer"><span>Nugaom AI Pick · MARKET SIGNAL WORKSPACE</span><span>หุ้นไทย / DR: Settrade · หุ้นสหรัฐฯ 1D: FMP EOD · AI ในเครื่องสำหรับหุ้นไทย / DR · สถิติผลลัพธ์ยังเป็น DEMO</span></footer>
        </div>
      </main>

      <NugaomAssistant activeSymbol={asset.symbol} />

      {popup && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPopup(null); }}>
        <section ref={modalRef} tabIndex={-1} className={`modal-card ${popup === 'chart' ? 'chart-modal' : ''} ${FEATURE_ITEMS.some(([key]) => key === popup) ? 'feature-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="popup-title">
          <div className="modal-heading"><div><span className="eyebrow">{popup === 'search' ? 'NUGAOM AI PICK / SYMBOL UNIVERSE' : FEATURE_ITEMS.some(([key]) => key === popup) ? 'NUGAOM AI PICK / CONNECTED WORKSPACE' : 'NUGAOM AI PICK / WORKSPACE'}</span><h2 id="popup-title">{popup === 'search' ? 'ค้นหาสินทรัพย์' : popup === 'automation' ? 'บันทึกสัญญาณและแจ้งเตือนอัตโนมัติ' : popup === 'contact' ? 'คุยกับทีมโดยตรง' : popup === 'chart' ? `${asset.symbol} · กราฟ` : { membership: 'สิทธิสมาชิก', financial: 'Financial Check', learn: 'เริ่มต้นใช้งาน', roadmap: 'สถานะและแผนพัฒนา', community: 'ชุมชน', calendar: 'ปฏิทินเศรษฐกิจ', dividends: 'ปันผลหุ้นไทย · XD' }[popup] ?? FEATURE_ITEMS.find(([key]) => key === popup)?.[2] ?? 'เครื่องมือกราฟ'}</h2></div><button className="modal-close" aria-label="ปิดหน้าต่าง" onClick={() => setPopup(null)}>×</button></div>
          {ANALYSIS_FEATURE_ITEMS.some(([key]) => key === popup) && <nav className="feature-modal-nav" aria-label="สลับเครื่องมือวิเคราะห์">{ANALYSIS_FEATURE_ITEMS.map(([key, , label]) => { const FeatureIcon = FEATURE_ICONS[key]; return <button key={key} className={popup === key ? 'selected' : ''} onClick={() => setPopup(key)}><span><FeatureIcon size={14} /></span>{label}</button>; })}</nav>}
          {popup === 'scanner' && (rights?.capabilities?.manualDailyScan ? <MarketScanner asset={asset} market={market} favorites={favorites} timeframe={timeframe} onSelect={selectAsset} /> : <div className="scanner-member-lock"><h3>Market Scanner สำหรับสมาชิก</h3><p>เข้าสู่ระบบ LINE และแจ้งเลขพอร์ตเพื่อรับสิทธิทดลอง 14 วัน</p><a href="/account">เปิดบัญชีของฉัน ↗</a></div>)}
          {popup === 'multi-tf' && <MultiTimeframe asset={asset} onSelectFrame={selectFrame} />}
          {popup === 'volume' && <VolumePulse asset={asset} bars={displayBars} timeframe={timeframe} onOpenScanner={() => setPopup('scanner')} />}
          {popup === 'terminal' && <TerminalView asset={asset} sampleRows={rows} ledger={demoLedger} onSelectSymbol={selectLedgerSymbol} onOpenAutomation={() => setPopup('automation')} />}
          {popup === 'news' && <NewsFeedState onOpenGuide={() => setPopup('news-guide')} />}
          {popup === 'news-guide' && <NewsGuide onOpenNews={() => setPopup('news')} />}
          {popup === 'financial' && <FinancialCheck />}
          {popup === 'learn' && <LearningPanel onOpen={navigateTo} />}
          {popup === 'roadmap' && <RoadmapPanel onOpen={navigateTo} />}
          {popup === 'community' && <CommunityPanel onOpenContact={() => setPopup('contact')} />}
          {popup === 'calendar' && <CalendarPanel onOpenGuide={() => setPopup('news-guide')} />}
          {popup === 'dividends' && <DividendCalendarPanel />}
          {popup === 'search' && <>
            <label className="modal-search"><span>⌕</span><input autoFocus value={symbolQuery} onChange={event => setSymbolQuery(event.target.value)} placeholder="ค้นหา PTT, AAPL80, EUR/USD, S50U26…" /></label>
            <div className="modal-market-pills"><button className={symbolCategory === 'all' ? 'selected' : ''} onClick={() => setSymbolCategory('all')}>ทั้งหมด <small>{ALL_ASSETS.length}</small></button>{MARKETS.map(item => <button key={item.id} className={symbolCategory === item.id ? 'selected' : ''} onClick={() => setSymbolCategory(item.id)}>{item.label} <small>{MARKET_ASSETS[item.id].length}</small></button>)}</div>
            <div className="modal-search-count">พบ {searchResults.length} symbols · เลือกแล้วกราฟกับแผงวิเคราะห์จะเปลี่ยนตาม</div>
            <div className="asset-results">{searchResults.map(item => <button key={item.instrumentId} onClick={() => selectAsset(item)}><span><strong>{item.symbol}</strong><small>{item.name === item.symbol ? displaySection(item.sectionId) : `${item.name} · ${displaySection(item.sectionId)}`}</small></span><span className="asset-result-price">{item.symbol === asset.symbol && hasRealBars ? displayedPrice : item.symbol === asset.symbol && hasRealQuote ? displayedPrice : item.feed === 'settrade-daily' ? 'OHLC' : item.price}<small>{item.feed === 'settrade-daily' ? 'Settrade เมื่อเลือก' : item.feed === 'fmp-quote' ? 'FMP เมื่อเลือก' : item.price === '—' ? 'รอฟีดราคา' : 'DEMO'}</small></span></button>)}{searchResults.length === 0 && <p className="empty-state">ไม่พบสินทรัพย์ในรายการที่กำหนด</p>}</div>
            <p className="modal-footnote">SET100: snapshot 2026 H2 · DR80: snapshot 25 ก.ย. 2026 · mai 50: รายชื่อเริ่มต้น ยังไม่ยืนยันอันดับ Market Cap</p>
          </>}
          {popup === 'automation' && <div className="automation-panel"><div className="automation-status"><span className="status-pulse" /><span><strong>สแกนอัตโนมัติ · DEMO</strong><small>จำลองการตรวจพบแผนประจำวัน · ยังไม่ได้ต่อ scanner จริง</small></span><button className={autoCapture ? 'toggle-switch on' : 'toggle-switch'} aria-pressed={autoCapture} onClick={() => setAutoCapture(value => !value)}>{autoCapture ? 'เปิด' : 'ปิด'}</button></div><p className="modal-copy">เมื่อ scanner จริงพบแผนตามกติกา ระบบจะบันทึก Entry / TP / SL ลงประวัติทันที จากนั้นติดตามจนแตะ TP หรือ SL แล้วบันทึกผลและ P/L โดยอัตโนมัติ</p><div className="scan-plan"><div><small>แผนตัวอย่างที่กำลังดู</small><strong>{asset.symbol} · BUY · 4H</strong></div><div className="scan-levels"><span>Entry <b>{demoPrice}</b></span><span>TP <b className="positive">{demoLevels.tp}</b></span><span>SL <b className="negative">{demoLevels.sl}</b></span></div></div><div className="voice-row"><span><strong>เสียงอ่านผลลัพธ์</strong><small>ใช้เสียงสังเคราะห์ของเบราว์เซอร์ใน DEMO</small></span><button className={voiceEnabled ? 'toggle-switch on' : 'toggle-switch'} aria-pressed={voiceEnabled} onClick={() => setVoiceEnabled(value => !value)}>{voiceEnabled ? 'เปิด' : 'ปิด'}</button></div><button className="primary-action" disabled={!autoCapture || demoLevels.tp === '—'} onClick={captureDemoPlan}>＋ จำลอง Scanner พบแผนและบันทึกอัตโนมัติ</button><p className="modal-footnote">บันทึก DEMO ไว้ในเบราว์เซอร์นี้ {demoLedger.length} แผน · เสียงอ่านยังเป็น DEMO · AutoPick จริงจะแจ้งในเว็บขณะเปิดหน้า และเก็บเหตุการณ์ให้ย้อนอ่าน</p>{demoLedger.length > 0 && <div className="demo-plan-list"><div className="demo-list-heading"><strong>แผนที่บันทึกไว้</strong><button className="clear-demo" onClick={() => setDemoLedger([])}>ล้างข้อมูล DEMO</button></div>{demoLedger.map(plan => <div key={plan.id} className="demo-plan-row"><span><b>{plan.symbol}</b><small>{plan.side} · {plan.result} · {plan.pnl}</small></span>{plan.result === 'กำลังติดตาม' && <span className="settle-buttons"><button onClick={() => settleDemoPlan(plan, 'ชนะ')}>จำลอง TP</button><button onClick={() => settleDemoPlan(plan, 'แพ้')}>จำลอง SL</button></span>}</div>)}</div>}</div>}
          {popup === 'contact' && <div className="contact-panel"><p className="modal-copy">เลือกทีมแล้วพิมพ์คำถามได้ทันที ในเวอร์ชัน DEMO ข้อความจะแสดงเฉพาะในหน้าจอนี้ ยังไม่ได้ส่งถึงบุคคลจริง</p><div className="contact-tabs"><button className={contactAudience === 'analyst' ? 'selected' : ''} onClick={() => setContactAudience('analyst')}>นักวิเคราะห์</button><button className={contactAudience === 'marketing' ? 'selected' : ''} onClick={() => setContactAudience('marketing')}>การตลาด</button></div><div className="contact-card"><span className="contact-avatar">{contactAudience === 'analyst' ? 'A' : 'M'}</span><span><strong>{contactAudience === 'analyst' ? 'ทีมวิเคราะห์ตลาด' : 'ทีมการตลาด'}</strong><small>{contactAudience === 'analyst' ? 'ถามเรื่องแผน, สัญญาณ และสถิติ' : 'ถามเรื่องแพ็กเกจ, การใช้งาน และบัญชี'}</small></span><i>DEMO</i></div><div className="chat-thread" aria-live="polite">{chatMessages.length === 0 ? <p className="empty-state">เริ่มบทสนทนากับ{contactAudience === 'analyst' ? 'นักวิเคราะห์' : 'ทีมการตลาด'} · ใน DEMO</p> : chatMessages.map((message, index) => <div key={`${index}-${message.from}`} className={`chat-bubble ${message.from}`}>{message.text}</div>)}</div><form className="chat-compose" onSubmit={sendDemoMessage}><input value={chatInput} onChange={event => setChatInput(event.target.value)} placeholder={`พิมพ์ข้อความถึง${contactAudience === 'analyst' ? 'นักวิเคราะห์' : 'การตลาด'}…`} /><button type="submit" aria-label="ส่งข้อความตัวอย่าง">ส่ง</button></form><p className="modal-footnote">เมื่อเชื่อมระบบจริง ควรมีสถานะ online, ประวัติแชต และการแจ้งเตือนคำตอบจากทีม</p></div>}
          {popup === 'chart' && <><CandlestickChart symbol={asset.symbol} timeframe={timeframe} bars={displayBars} demoPrice={asset.price} analysis={analysis} indicators={indicators} chartStyle={chartStyle} loading={hasCandleConnection && liveState === 'loading'} unavailable={hasCandleConnection && liveState === 'unavailable'} source={hasSettradeConnection ? 'Settrade' : 'FMP EOD'} /><p className="modal-footnote">{hasRealBars ? `แท่ง ${TIMEFRAME_LABELS[timeframe]} จริงจาก ${sourceLabel} · ล่าสุด ${latestBarLabel}` : hasCandleConnection ? 'ยังแสดงแท่งจริงไม่ได้' : 'กราฟ DEMO · ยังไม่เชื่อมราคา'}</p></>}
        </section>
      </div>}
      {toast && <aside className={`signal-toast ${toast.result === 'ชนะ' ? 'toast-win' : toast.result === 'แพ้' ? 'toast-loss' : ''}`} role="status" aria-live="polite"><div className="toast-icon">{toast.result === 'ชนะ' ? '✓' : toast.result === 'แพ้' ? '!' : '◉'}</div><div className="toast-copy"><strong>{toast.title}</strong><span>{toast.detail}</span>{(toast.result === 'ชนะ' || toast.result === 'แพ้') && <small>เสียงอ่านผล {voiceEnabled ? 'เปิด' : 'ปิด'} · DEMO</small>}</div><button aria-label="ปิดการแจ้งเตือน" onClick={() => setToast(null)}>×</button></aside>}
    </div>
  );
}
