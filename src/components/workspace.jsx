'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const MARKETS = [
  { id: 'forex', label: 'Forex', detail: 'คู่เงิน', symbol: 'EUR/USD', name: 'Euro / US Dollar', price: '1.08426', change: '+0.18%', open: '1.08290', high: '1.08470', low: '1.08240', source: 'Demo feed' },
  { id: 'thai', label: 'หุ้นไทย', detail: 'SET · mai', symbol: 'PTT', name: 'ปตท. · SET', price: '32.75', change: '+1.24%', open: '32.25', high: '33.00', low: '32.00', source: 'Demo feed' },
  { id: 'dr', label: 'DR', detail: 'DR80', symbol: 'AAPL80', name: 'Apple DR · SET', price: '8.45', change: '+0.72%', open: '8.38', high: '8.52', low: '8.31', source: 'Demo feed' },
  { id: 'tfex', label: 'TFEX', detail: 'ทอง · เงิน · SET50', symbol: 'S50U26', name: 'SET50 Futures · TFEX', price: '842.6', change: '−0.32%', open: '845.0', high: '847.2', low: '840.8', source: 'Demo feed' },
  { id: 'us', label: 'หุ้นต่างประเทศ', detail: 'หุ้น · ETF · Options', symbol: 'NVDA', name: 'NVIDIA · NASDAQ', price: '142.68', change: '+0.92%', open: '141.20', high: '143.10', low: '140.95', source: 'Demo feed' },
  { id: 'crypto', label: 'คริปโต', detail: 'Spot · รอง', symbol: 'BTCUSDT', name: 'Bitcoin / Tether · Spot', price: '64,280.50', change: '+1.42%', open: '63,820.00', high: '64,910.00', low: '63,510.00', source: 'Demo feed' },
];

const MARKET_ASSETS = {
  forex: [MARKETS[0], { ...MARKETS[0], symbol: 'GBP/USD', name: 'British Pound / US Dollar', price: '1.27184', change: '+0.11%' }, { ...MARKETS[0], symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', price: '149.382', change: '−0.08%' }, { ...MARKETS[0], symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar', price: '0.65428', change: '+0.06%' }, { ...MARKETS[0], symbol: 'XAU/USD', name: 'Gold / US Dollar', price: '2,345.70', change: '+0.42%' }],
  thai: [MARKETS[1], { ...MARKETS[1], symbol: 'AOT', name: 'ท่าอากาศยานไทย · SET', price: '61.75' }, { ...MARKETS[1], symbol: 'DELTA', name: 'เดลต้า อีเลคโทรนิคส์ · SET', price: '261.00' }],
  dr: [MARKETS[2], { ...MARKETS[2], symbol: 'NVDA80', name: 'NVIDIA DR · SET', price: '7.30' }],
  tfex: [MARKETS[3], { ...MARKETS[3], symbol: 'GF10J26', name: 'Gold Online Futures · TFEX', price: '3,042.5' }, { ...MARKETS[3], symbol: 'SVJ26', name: 'Silver Online Futures · TFEX', price: '35.22' }],
  us: [MARKETS[4], { ...MARKETS[4], symbol: 'AAPL', name: 'Apple · NASDAQ', price: '211.30' }, { ...MARKETS[4], symbol: 'SPY', name: 'SPDR S&P 500 ETF', price: '588.44' }],
  crypto: [MARKETS[5], { ...MARKETS[5], symbol: 'ETHUSDT', name: 'Ethereum / Tether · Spot', price: '2,485.20' }],
};

const SAMPLE_TRADES = [
  { result: 'ชนะ', symbol: 'EUR/USD', side: 'BUY', entry: '1.08120', exit: '1.08310', pnl: '+0.18%', time: '15:17' },
  { result: 'แพ้', symbol: 'GBP/USD', side: 'SELL', entry: '1.29480', exit: '1.29610', pnl: '−0.10%', time: '14:44' },
  { result: 'ชนะ', symbol: 'USD/JPY', side: 'SELL', entry: '148.52', exit: '148.10', pnl: '+0.28%', time: '14:03' },
  { result: 'ชนะ', symbol: 'EUR/USD', side: 'BUY', entry: '1.07990', exit: '1.08180', pnl: '+0.18%', time: '13:29' },
  { result: 'แพ้', symbol: 'AUD/USD', side: 'BUY', entry: '0.65840', exit: '0.65720', pnl: '−0.18%', time: '12:36' },
];

function buildDemoCandles(symbol) {
  const seed = [...symbol].reduce((total, character) => total + character.charCodeAt(0), 0);
  const start = symbol === 'EUR/USD' ? 1.078 : symbol === 'PTT' ? 31.9 : symbol === 'BTCUSDT' ? 63_000 : 100;
  let close = start;
  const now = Math.floor(Date.now() / 3_600_000) * 3_600;
  return Array.from({ length: 96 }, (_, index) => {
    const wave = Math.sin((index + seed) * 0.43) * start * 0.0018;
    const drift = Math.sin((index + seed) * 0.09) * start * 0.00035;
    const open = close;
    close = Math.max(0.00001, open + wave + drift);
    const spread = Math.max(start * 0.0008, Math.abs(wave) * 0.75);
    const high = Math.max(open, close) + spread * (0.3 + (index % 4) * 0.08);
    const low = Math.min(open, close) - spread * (0.3 + (index % 5) * 0.07);
    return {
      time: now - (95 - index) * 3_600,
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
  const gap = asset.symbol.includes('JPY') ? 0.18 : asset.symbol.includes('/') && asset.price.includes('1.') ? 0.0012 : asset.symbol.includes('XAU') ? 12 : price > 1000 ? 4 : price > 100 ? 1.2 : 0.15;
  const decimals = (asset.price.split('.')[1] ?? '').length;
  const format = value => value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return { tp: format(price + gap), sl: format(Math.max(0, price - gap)) };
}

function CandlestickChart({ symbol }) {
  const containerRef = useRef(null);
  const candles = useMemo(() => buildDemoCandles(symbol), [symbol]);

  useEffect(() => {
    let chart;
    let cancelled = false;
    let observer;

    async function mountChart() {
      if (!containerRef.current) return;
      const { createChart, CandlestickSeries, HistogramSeries, ColorType } = await import('lightweight-charts');
      if (cancelled || !containerRef.current) return;

      const container = containerRef.current;
      chart = createChart(container, {
        width: container.clientWidth,
        height: 355,
        layout: { background: { type: ColorType.Solid, color: '#09111d' }, textColor: '#8291a8', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', fontSize: 11 },
        grid: { vertLines: { color: '#172334' }, horzLines: { color: '#172334' } },
        crosshair: { vertLine: { color: '#47c8bd', labelBackgroundColor: '#16323a' }, horzLine: { color: '#47c8bd', labelBackgroundColor: '#16323a' } },
        rightPriceScale: { borderColor: '#223047', scaleMargins: { top: 0.08, bottom: 0.22 } },
        timeScale: { borderColor: '#223047', timeVisible: true, secondsVisible: false, rightOffset: 3 },
        localization: { locale: 'en-US' },
      });
      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#53d6aa', downColor: '#fa7185', borderUpColor: '#53d6aa', borderDownColor: '#fa7185', wickUpColor: '#53d6aa', wickDownColor: '#fa7185',
      });
      series.setData(candles);
      const volume = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        lastValueVisible: false,
        priceLineVisible: false,
      });
      volume.setData(candles.map(bar => ({ time: bar.time, value: bar.volume, color: bar.close >= bar.open ? '#53d6aa4d' : '#fa71854d' })));
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      chart.timeScale().fitContent();

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
  }, [candles]);

  return <div className="chart-surface"><div ref={containerRef} className="chart-canvas" aria-label={`Demo candlestick chart for ${symbol}`} /><div className="chart-disclaimer">แท่งราคา DEMO สร้างเพื่อจัดวางหน้าจอ · ยังไม่ใช่ข้อมูลตลาดจริง</div></div>;
}

function Icon({ children }) { return <span className="nav-icon" aria-hidden="true">{children}</span>; }

export default function Workspace() {
  const [activeMarket, setActiveMarket] = useState('forex');
  const [activeNav, setActiveNav] = useState('overview');
  const [filter, setFilter] = useState('all');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [popup, setPopup] = useState(null);
  const [search, setSearch] = useState('');
  const [demoLedger, setDemoLedger] = useState([]);
  const [ledgerReady, setLedgerReady] = useState(false);
  const [autoCapture, setAutoCapture] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [toast, setToast] = useState(null);
  const [contactAudience, setContactAudience] = useState('analyst');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const market = MARKETS.find(item => item.id === activeMarket) ?? MARKETS[0];
  const asset = selectedAsset ?? market;
  const demoLevels = getDemoLevels(asset);
  const marketAssets = MARKET_ASSETS[activeMarket] ?? [market];
  const filteredAssets = marketAssets.filter(item => `${item.symbol} ${item.name}`.toLowerCase().includes(search.toLowerCase()));
  const rows = activeMarket === 'forex' ? SAMPLE_TRADES : SAMPLE_TRADES.map(row => ({ ...row, symbol: asset.symbol }));
  const historyRows = [...demoLedger, ...rows];
  const visibleRows = historyRows.filter(row => filter === 'all' || (filter === 'win' ? row.result === 'ชนะ' : filter === 'loss' ? row.result === 'แพ้' : row.result === 'กำลังติดตาม'));
  const closedRows = [...rows, ...demoLedger.filter(row => row.result === 'ชนะ' || row.result === 'แพ้')];
  const winCount = closedRows.filter(row => row.result === 'ชนะ').length;
  const lossCount = closedRows.filter(row => row.result === 'แพ้').length;
  const netPnl = closedRows.reduce((sum, row) => sum + Number(String(row.pnl).replace('%', '').replace('−', '-')), 0);
  const winRate = closedRows.length ? winCount / closedRows.length * 100 : 0;
  const navItems = [
    { id: 'overview', title: 'ภาพรวมตลาด', icon: '◫' },
    { id: 'signals', title: 'สัญญาณ AI', icon: '✳' },
    { id: 'stats', title: 'สถิติ & ผลลัพธ์', icon: '▤' },
    { id: 'history', title: 'ประวัติทุกไม้', icon: '◷' },
    { id: 'watchlist', title: 'รายการติดตาม', icon: '☆' },
  ];

  useEffect(() => {
    if (!popup) return undefined;
    const onKeyDown = event => { if (event.key === 'Escape') setPopup(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [popup]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('nova-demo-signal-ledger');
      const parsed = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) setDemoLedger(parsed);
    } catch { /* Ignore malformed local demo data. */ }
    setLedgerReady(true);
  }, []);

  useEffect(() => {
    if (ledgerReady) {
      try { window.localStorage.setItem('nova-demo-signal-ledger', JSON.stringify(demoLedger)); } catch { /* Storage can be unavailable in private browser contexts. */ }
    }
  }, [demoLedger, ledgerReady]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 9000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function captureDemoPlan() {
    const plan = { id: `DEMO-${Date.now()}`, symbol: asset.symbol, side: 'BUY', entry: asset.price, tp: demoLevels.tp, sl: demoLevels.sl, result: 'กำลังติดตาม', pnl: '—', time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) };
    setDemoLedger(current => [plan, ...current]);
    setToast({ title: 'บันทึกแผนจาก Scanner แล้ว', detail: `${asset.symbol} · BUY · ติดตาม TP ${demoLevels.tp} / SL ${demoLevels.sl}`, result: 'ติดตามแผน' });
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
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">N</div><div><strong>NOVA</strong><small>MARKET INTELLIGENCE</small></div></div>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="เมนู workspace">
          {navItems.map(item => <button key={item.id} className={activeNav === item.id ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveNav(item.id); document.getElementById(`section-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><Icon>{item.icon}</Icon><span>{item.title}</span></button>)}
        </nav>
        <div className="side-label preferences-label">PREFERENCES</div>
        <nav className="side-nav" aria-label="ตั้งค่า">
          <button className="nav-item" onClick={() => { setActiveNav('alerts'); setPopup('automation'); }}><Icon>♧</Icon><span>การแจ้งเตือน</span></button>
          <button className="nav-item" onClick={() => setPopup('contact')}><Icon>✉</Icon><span>คุยกับทีม</span></button>
          <button className="nav-item" onClick={() => { setActiveNav('settings'); setPopup('settings'); }}><Icon>⚙</Icon><span>ตั้งค่า</span></button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="engine-card"><div className="engine-heading">DATA STATUS <span className="demo-pill">DEMO</span></div><p>ตัวอย่างหน้าจอ<br />ยังไม่เชื่อมข้อมูลตลาดจริง</p></div>
        <div className="sidebar-foot">NOVA WORKSPACE <span>v0.1</span></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <b>{navItems.find(item => item.id === activeNav)?.title ?? 'Workspace'}</b></div>
          <div className="topbar-actions"><div className="market-clock"><i className="status-dot" /> ตลาดปิด · DEMO</div><button className="icon-button" aria-label="ค้นหาสินทรัพย์" onClick={() => { setSearch(''); setPopup('search'); }}>⌕</button><button className="icon-button" aria-label="แจ้งเตือนและบันทึกอัตโนมัติ" onClick={() => setPopup('automation')}>♧<span className="notification-dot" /></button><button className="icon-button chat-launch" aria-label="คุยกับนักวิเคราะห์หรือการตลาด" onClick={() => setPopup('contact')}>▤</button><button className="profile-button" onClick={() => setPopup(popup === 'account' ? null : 'account')}><span className="avatar">N</span><span>บัญชีทดลอง</span><span className="chevron">⌄</span></button></div>
        </header>

        <div className="page-content">
          <section id="section-overview" className="page-heading"><div><div className="eyebrow">TRADING INTELLIGENCE TERMINAL</div><h1>ตลาดของคุณ ในมุมมองเดียว</h1><p>คัดสัญญาณ ดูผลลัพธ์ และตรวจสอบสถิติได้ครบทุกสินทรัพย์</p></div><div className="demo-notice"><span className="notice-icon">i</span> ตัวอย่างข้อมูล · DEMO</div></section>

          <section className="market-switcher" aria-label="เลือกประเภทตลาด">
            {MARKETS.map(item => <button key={item.id} onClick={() => { setActiveMarket(item.id); setSelectedAsset(null); }} className={activeMarket === item.id ? `market-tab active ${item.id}` : `market-tab ${item.id}`}><span className="tab-title">{item.label}</span><span className="tab-detail">{item.detail}</span>{item.id === 'crypto' && <span className="secondary-label">รอง</span>}</button>)}
          </section>

          <section id="section-watchlist" className="watch-strip panel" aria-label="รายการติดตามตลาด">
            <div className="watch-label"><strong>WATCHLIST</strong><span>· {market.label} · DEMO</span></div>
            <div className="watch-assets">{marketAssets.map(item => <button key={item.symbol} className={asset.symbol === item.symbol ? 'watch-asset active' : 'watch-asset'} onClick={() => setSelectedAsset(item)}><span><strong>{item.symbol}</strong><small>{item.name.split('·')[0].trim()}</small></span><span className={item.change.startsWith('−') ? 'negative' : 'positive'}>{item.change}</span></button>)}<button className="watch-add" onClick={() => { setSearch(''); setPopup('search'); }}>＋ เพิ่มสินทรัพย์</button></div>
          </section>

          <section className="primary-grid">
            <article className="panel chart-panel">
              <div className="panel-heading"><div className="panel-title"><span className="title-spark">◈</span> ตลาดที่กำลังดู <span className="market-tag">{market.label}</span><span className="live-tag"><i /> DEMO</span></div><div className="timeframe-switch"><button>15m</button><button>1H</button><button className="selected">4H</button><button>1D</button><button>⋯</button></div></div>
              <div className="instrument-row"><div><div className="instrument-symbol">{asset.symbol}</div><div className="instrument-name">{asset.name}<span className="instrument-source"> · {asset.source}</span></div></div><div className="instrument-price"><strong>{asset.price}</strong><span className={asset.change.startsWith('−') ? 'negative' : 'positive'}>{asset.change.startsWith('−') ? '▼' : '▲'} {asset.change.replace(/[+−]/, '')}</span></div></div>
              <div className="chart-toolbar"><button className="tool-selected">แท่งเทียน</button><button>เส้น</button><span className="toolbar-divider" /><button>Indicators</button><button>เปรียบเทียบ</button><div className="chart-tools-end"><button aria-label="เปิดภาพเต็ม" onClick={() => setPopup('chart')}>⤢</button><button aria-label="เครื่องมือกราฟ" onClick={() => setPopup('tools')}>⋯</button></div></div>
              <CandlestickChart symbol={asset.symbol} />
              <div className="ohlc-strip"><span>O <b>{asset.open}</b></span><span>H <b>{asset.high}</b></span><span>L <b>{asset.low}</b></span><span>C <b>{asset.price}</b></span><span>V <b>—</b></span><span className="source-time">เวลาแหล่งข้อมูล <b>—</b></span></div>
            </article>

            <article id="section-signals" className="panel signal-panel signal-clickable" role="button" tabIndex={0} onClick={() => setPopup('signal')} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setPopup('signal'); }} aria-label="ดูรายละเอียดสัญญาณตัวอย่าง">
              <div className="panel-heading"><div className="panel-title"><span className="signal-star">✳</span> สัญญาณล่าสุด</div><span className="demo-pill">DEMO</span></div>
              <div className="signal-direction"><div className="direction-icon">↗</div><div><strong>BUY</strong><small>ตัวอย่าง · ไม่ใช่คำแนะนำ</small></div><span className="confidence-chip">มั่นใจ <b>72%</b></span></div>
              <div className="signal-meta"><span>{asset.symbol}</span><span>·</span><span>4H</span><span>·</span><span>15:42</span></div>
              <div className="signal-levels"><div className="level-card target"><small>TAKE PROFIT · TP</small><strong>{demoLevels.tp}</strong></div><div className="level-card stop"><small>STOP LOSS · SL</small><strong>{demoLevels.sl}</strong></div></div>
              <div className="signal-reason"><strong>เหตุผลจากระบบ</strong><p>ตัวอย่างข้อความวิเคราะห์ · สัญญาณจริงจะอ้างอิงข้อมูลราคา แท่งเวลา และเงื่อนไขปิดผลที่บันทึกตรวจสอบได้</p></div>
              <div className="signal-footer"><span>รหัสตัวอย่าง #DEMO-042</span><span>ยังไม่นับสถิติจริง</span></div>
            </article>
          </section>

          <section id="section-stats" className="performance-section">
            <div className="section-heading"><div><div className="eyebrow">PERFORMANCE LEDGER</div><h2>ผลลัพธ์ครบทุกสัญญาณ</h2></div><div className="range-switch"><button>วันนี้</button><button className="selected">7 วัน</button><button>30 วัน</button><button>ทั้งหมด</button></div></div>
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
              {visibleRows.map((row, index) => <tr key={`${row.id ?? row.symbol}-${row.time}-${index}`}><td><span className={`result-pill ${row.result === 'ชนะ' ? 'win' : row.result === 'แพ้' ? 'loss' : 'pending'}`}><i />{row.result}</span></td><td><strong>{row.symbol}</strong><span className="asset-market">{market.label}</span></td><td className={row.side === 'BUY' ? 'positive' : 'negative'}>{row.side}</td><td>{row.entry}</td><td>{row.exit ?? '—'}</td><td className={row.result === 'ชนะ' ? 'positive' : row.result === 'แพ้' ? 'negative' : 'muted-cell'}>{row.pnl}</td><td className="muted-cell">{row.time}</td></tr>)}
            </tbody></table></div>
            <div className="history-footnote">ไม้ที่ยังไม่ปิดผลต้องแสดงแยก และไม่นับใน Win rate จนกว่าจะประเมินจากกติกาที่ตรวจสอบได้</div>
          </section>
          <footer className="page-footer"><span>NOVA · MARKET SIGNAL WORKSPACE</span><span>ข้อมูลในหน้านี้เป็นตัวอย่าง DEMO ทั้งหมด</span></footer>
        </div>
      </main>

      {popup && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPopup(null); }}>
        {popup === 'account' ? <div className="account-menu" role="menu"><div className="account-menu-head"><span className="avatar">N</span><span><strong>บัญชีทดลอง</strong><small>โหมด DEMO · ยังไม่ได้เชื่อมบัญชี</small></span></div><button role="menuitem" onClick={() => setPopup('settings')}>⚙ การตั้งค่า workspace</button><button role="menuitem" onClick={() => setPopup(null)}>ออกจากเมนู</button></div> :
        <section className={`modal-card ${popup === 'chart' ? 'chart-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="popup-title">
          <div className="modal-heading"><div><span className="eyebrow">NOVA WORKSPACE · DEMO</span><h2 id="popup-title">{popup === 'search' ? 'ค้นหาสินทรัพย์' : popup === 'automation' ? 'บันทึกสัญญาณและแจ้งเตือนอัตโนมัติ' : popup === 'contact' ? 'คุยกับทีมโดยตรง' : popup === 'signal' ? 'รายละเอียดสัญญาณ' : popup === 'chart' ? `${asset.symbol} · กราฟ` : popup === 'settings' ? 'การตั้งค่า workspace' : 'เครื่องมือกราฟ'}</h2></div><button className="modal-close" aria-label="ปิดหน้าต่าง" onClick={() => setPopup(null)}>×</button></div>
          {popup === 'search' && <><label className="modal-search"><span>⌕</span><input autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหาคู่เงิน หุ้น หรือสัญญา เช่น EUR/USD" /></label><div className="modal-market-pills">{MARKETS.map(item => <button key={item.id} className={item.id === activeMarket ? 'selected' : ''} onClick={() => { setActiveMarket(item.id); setSelectedAsset(null); }}>{item.label}</button>)}</div><div className="asset-results">{filteredAssets.map(item => <button key={item.symbol} onClick={() => { setActiveMarket(item.id); setSelectedAsset(item); setPopup(null); }}><span><strong>{item.symbol}</strong><small>{item.name}</small></span><span className="asset-result-price">{item.price}<small className={item.change.startsWith('−') ? 'negative' : 'positive'}>{item.change}</small></span></button>)}{filteredAssets.length === 0 && <p className="empty-state">ไม่พบสินทรัพย์ในหมวดนี้</p>}</div><p className="modal-footnote">ราคาและแท่งเทียนใน workspace นี้ยังเป็นข้อมูลตัวอย่าง DEMO</p></>}
          {popup === 'automation' && <div className="automation-panel"><div className="automation-status"><span className="status-pulse" /><span><strong>สแกนอัตโนมัติ · DEMO</strong><small>จำลองการตรวจพบแผนประจำวัน · ยังไม่ได้ต่อ scanner จริง</small></span><button className={autoCapture ? 'toggle-switch on' : 'toggle-switch'} aria-pressed={autoCapture} onClick={() => setAutoCapture(value => !value)}>{autoCapture ? 'เปิด' : 'ปิด'}</button></div><p className="modal-copy">เมื่อ scanner จริงพบแผนตามกติกา ระบบจะบันทึก Entry / TP / SL ลงประวัติทันที จากนั้นติดตามจนแตะ TP หรือ SL แล้วบันทึกผลและ P/L โดยอัตโนมัติ</p><div className="scan-plan"><div><small>แผนตัวอย่างที่กำลังดู</small><strong>{asset.symbol} · BUY · 4H</strong></div><div className="scan-levels"><span>Entry <b>{asset.price}</b></span><span>TP <b className="positive">{demoLevels.tp}</b></span><span>SL <b className="negative">{demoLevels.sl}</b></span></div></div><div className="voice-row"><span><strong>เสียงอ่านผลลัพธ์</strong><small>ใช้เสียงสังเคราะห์ของเบราว์เซอร์ใน DEMO</small></span><button className={voiceEnabled ? 'toggle-switch on' : 'toggle-switch'} aria-pressed={voiceEnabled} onClick={() => setVoiceEnabled(value => !value)}>{voiceEnabled ? 'เปิด' : 'ปิด'}</button></div><button className="primary-action" disabled={!autoCapture} onClick={captureDemoPlan}>＋ จำลอง Scanner พบแผนและบันทึกอัตโนมัติ</button><p className="modal-footnote">บันทึก DEMO ไว้ในเบราว์เซอร์นี้ {demoLedger.length} แผน · สำหรับเสียง AI จริงและแจ้งเตือนขณะปิดเว็บ ต้องต่อบริการเสียงและ notification worker</p>{demoLedger.length > 0 && <div className="demo-plan-list"><div className="demo-list-heading"><strong>แผนที่บันทึกไว้</strong><button className="clear-demo" onClick={() => setDemoLedger([])}>ล้างข้อมูล DEMO</button></div>{demoLedger.map(plan => <div key={plan.id} className="demo-plan-row"><span><b>{plan.symbol}</b><small>{plan.side} · {plan.result} · {plan.pnl}</small></span>{plan.result === 'กำลังติดตาม' && <span className="settle-buttons"><button onClick={() => settleDemoPlan(plan, 'ชนะ')}>จำลอง TP</button><button onClick={() => settleDemoPlan(plan, 'แพ้')}>จำลอง SL</button></span>}</div>)}</div>}</div>}
          {popup === 'contact' && <div className="contact-panel"><p className="modal-copy">เลือกทีมแล้วพิมพ์คำถามได้ทันที ในเวอร์ชัน DEMO ข้อความจะแสดงเฉพาะในหน้าจอนี้ ยังไม่ได้ส่งถึงบุคคลจริง</p><div className="contact-tabs"><button className={contactAudience === 'analyst' ? 'selected' : ''} onClick={() => setContactAudience('analyst')}>นักวิเคราะห์</button><button className={contactAudience === 'marketing' ? 'selected' : ''} onClick={() => setContactAudience('marketing')}>การตลาด</button></div><div className="contact-card"><span className="contact-avatar">{contactAudience === 'analyst' ? 'A' : 'M'}</span><span><strong>{contactAudience === 'analyst' ? 'ทีมวิเคราะห์ตลาด' : 'ทีมการตลาด'}</strong><small>{contactAudience === 'analyst' ? 'ถามเรื่องแผน, สัญญาณ และสถิติ' : 'ถามเรื่องแพ็กเกจ, การใช้งาน และบัญชี'}</small></span><i>DEMO</i></div><div className="chat-thread" aria-live="polite">{chatMessages.length === 0 ? <p className="empty-state">เริ่มบทสนทนากับ{contactAudience === 'analyst' ? 'นักวิเคราะห์' : 'ทีมการตลาด'} · ใน DEMO</p> : chatMessages.map((message, index) => <div key={`${index}-${message.from}`} className={`chat-bubble ${message.from}`}>{message.text}</div>)}</div><form className="chat-compose" onSubmit={sendDemoMessage}><input value={chatInput} onChange={event => setChatInput(event.target.value)} placeholder={`พิมพ์ข้อความถึง${contactAudience === 'analyst' ? 'นักวิเคราะห์' : 'การตลาด'}…`} /><button type="submit" aria-label="ส่งข้อความตัวอย่าง">ส่ง</button></form><p className="modal-footnote">เมื่อเชื่อมระบบจริง ควรมีสถานะ online, ประวัติแชต และการแจ้งเตือนคำตอบจากทีม</p></div>}
          {popup === 'signal' && <div className="signal-detail"><div className="signal-direction"><div className="direction-icon">↗</div><div><strong>BUY</strong><small>สัญญาณตัวอย่าง · ยังไม่ใช่สัญญาณจริง</small></div><span className="confidence-chip">มั่นใจ <b>72%</b></span></div><div className="detail-grid"><div><small>สินทรัพย์</small><strong>{asset.symbol}</strong></div><div><small>กรอบเวลา</small><strong>4H</strong></div><div><small>ราคาเข้า · Entry</small><strong>{asset.price}</strong></div><div><small>Take Profit · TP</small><strong className="positive">{demoLevels.tp}</strong></div><div><small>Stop Loss · SL</small><strong className="negative">{demoLevels.sl}</strong></div><div><small>รหัสรายการ</small><strong>#DEMO-042</strong></div></div><div className="audit-note"><strong>เหตุผลและสถานะ</strong><p>ระบบจะบันทึกเวลาเข้า เงื่อนไข TP/SL และราคาที่ใช้ตัดสินผลใน ledger เมื่อเชื่อมข้อมูลจริงแล้ว ขณะนี้ไม่มีการส่งคำสั่งซื้อขายและยังไม่นับสถิติ</p></div><button className="primary-action" onClick={() => setPopup(null)}>ปิดรายละเอียด</button></div>}
          {popup === 'chart' && <><CandlestickChart symbol={asset.symbol} /><p className="modal-footnote">กราฟตัวอย่าง DEMO · ยังไม่เชื่อม feed ราคา</p></>}
          {popup === 'tools' && <div className="tool-list">{['Indicators · อินดิเคเตอร์', 'Price alert · แจ้งเตือนราคา', 'Crosshair · อ่านค่าบนกราฟ', 'Fullscreen · ขยายกราฟ'].map(label => <button key={label} onClick={() => setPopup(label.startsWith('Price') ? 'automation' : 'chart')}>{label}<span>›</span></button>)}</div>}
          {popup === 'settings' && <div className="tool-list"><button>ภาษา <span>ไทย</span></button><button>รูปแบบราคา <span>ทศนิยมตามตลาด</span></button><button>โหมดข้อมูล <span>DEMO</span></button><button onClick={() => setPopup('automation')}>การแจ้งเตือนอัตโนมัติ <span>{demoLedger.length} แผน</span></button><button onClick={() => setPopup('contact')}>ติดต่อทีมงาน <span>นักวิเคราะห์ · การตลาด</span></button></div>}
        </section>}
      </div>}
      {toast && <aside className={`signal-toast ${toast.result === 'ชนะ' ? 'toast-win' : toast.result === 'แพ้' ? 'toast-loss' : ''}`} role="status" aria-live="polite"><div className="toast-icon">{toast.result === 'ชนะ' ? '✓' : toast.result === 'แพ้' ? '!' : '◉'}</div><div className="toast-copy"><strong>{toast.title}</strong><span>{toast.detail}</span>{(toast.result === 'ชนะ' || toast.result === 'แพ้') && <small>เสียงอ่านผล {voiceEnabled ? 'เปิด' : 'ปิด'} · DEMO</small>}</div><button aria-label="ปิดการแจ้งเตือน" onClick={() => setToast(null)}>×</button></aside>}
    </div>
  );
}
