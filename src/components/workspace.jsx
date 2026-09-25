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
  const market = MARKETS.find(item => item.id === activeMarket) ?? MARKETS[0];
  const rows = activeMarket === 'forex' ? SAMPLE_TRADES : SAMPLE_TRADES.map((row, index) => ({
    ...row,
    symbol: activeMarket === 'thai' ? ['PTT', 'AAPL80', 'S50U26', 'NVDA', 'PTT'][index] : market.symbol,
  }));
  const visibleRows = rows.filter(row => filter === 'all' || (filter === 'win' ? row.result === 'ชนะ' : row.result === 'แพ้'));
  const navItems = [
    { id: 'overview', title: 'ภาพรวมตลาด', icon: '◫' },
    { id: 'signals', title: 'สัญญาณ AI', icon: '✳' },
    { id: 'stats', title: 'สถิติ & ผลลัพธ์', icon: '▤' },
    { id: 'history', title: 'ประวัติทุกไม้', icon: '◷' },
    { id: 'watchlist', title: 'รายการติดตาม', icon: '☆' },
  ];

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">N</div><div><strong>NOVA</strong><small>MARKET INTELLIGENCE</small></div></div>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="เมนู workspace">
          {navItems.map(item => <button key={item.id} className={activeNav === item.id ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav(item.id)}><Icon>{item.icon}</Icon><span>{item.title}</span></button>)}
        </nav>
        <div className="side-label preferences-label">PREFERENCES</div>
        <nav className="side-nav" aria-label="ตั้งค่า">
          <button className="nav-item" onClick={() => setActiveNav('alerts')}><Icon>♧</Icon><span>การแจ้งเตือน</span></button>
          <button className="nav-item" onClick={() => setActiveNav('settings')}><Icon>⚙</Icon><span>ตั้งค่า</span></button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="engine-card"><div className="engine-heading">DATA STATUS <span className="demo-pill">DEMO</span></div><p>ตัวอย่างหน้าจอ<br />ยังไม่เชื่อมข้อมูลตลาดจริง</p></div>
        <div className="sidebar-foot">NOVA WORKSPACE <span>v0.1</span></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <b>{navItems.find(item => item.id === activeNav)?.title ?? 'Workspace'}</b></div>
          <div className="topbar-actions"><div className="market-clock"><i className="status-dot" /> ตลาดปิด · DEMO</div><button className="icon-button" aria-label="แจ้งเตือน">♧<span className="notification-dot" /></button><button className="profile-button"><span className="avatar">N</span><span>บัญชีทดลอง</span><span className="chevron">⌄</span></button></div>
        </header>

        <div className="page-content">
          <section className="page-heading"><div><div className="eyebrow">TRADING INTELLIGENCE TERMINAL</div><h1>ตลาดของคุณ ในมุมมองเดียว</h1><p>คัดสัญญาณ ดูผลลัพธ์ และตรวจสอบสถิติได้ครบทุกสินทรัพย์</p></div><div className="demo-notice"><span className="notice-icon">i</span> ตัวอย่างข้อมูล · DEMO</div></section>

          <section className="market-switcher" aria-label="เลือกประเภทตลาด">
            {MARKETS.map(item => <button key={item.id} onClick={() => setActiveMarket(item.id)} className={activeMarket === item.id ? `market-tab active ${item.id}` : `market-tab ${item.id}`}><span className="tab-title">{item.label}</span><span className="tab-detail">{item.detail}</span>{item.id === 'crypto' && <span className="secondary-label">รอง</span>}</button>)}
          </section>

          <section className="primary-grid">
            <article className="panel chart-panel">
              <div className="panel-heading"><div className="panel-title"><span className="title-spark">◈</span> ตลาดที่กำลังดู <span className="market-tag">{market.label}</span></div><div className="timeframe-switch"><button>15m</button><button>1H</button><button className="selected">4H</button><button>1D</button><button>⋯</button></div></div>
              <div className="instrument-row"><div><div className="instrument-symbol">{market.symbol}</div><div className="instrument-name">{market.name}<span className="instrument-source"> · {market.source}</span></div></div><div className="instrument-price"><strong>{market.price}</strong><span className={market.change.startsWith('−') ? 'negative' : 'positive'}>{market.change.startsWith('−') ? '▼' : '▲'} {market.change.replace(/[+−]/, '')}</span></div></div>
              <div className="chart-toolbar"><button className="tool-selected">แท่งเทียน</button><button>เส้น</button><span className="toolbar-divider" /><button>Indicators</button><button>เปรียบเทียบ</button><div className="chart-tools-end"><button>⤢</button><button>⋯</button></div></div>
              <CandlestickChart symbol={market.symbol} />
              <div className="ohlc-strip"><span>O <b>{market.open}</b></span><span>H <b>{market.high}</b></span><span>L <b>{market.low}</b></span><span>C <b>{market.price}</b></span><span>V <b>—</b></span><span className="source-time">เวลาแหล่งข้อมูล <b>—</b></span></div>
            </article>

            <article className="panel signal-panel">
              <div className="panel-heading"><div className="panel-title"><span className="signal-star">✳</span> สัญญาณล่าสุด</div><span className="demo-pill">DEMO</span></div>
              <div className="signal-direction"><div className="direction-icon">↗</div><div><strong>BUY</strong><small>ตัวอย่าง · ไม่ใช่คำแนะนำ</small></div><span className="confidence-chip">มั่นใจ <b>72%</b></span></div>
              <div className="signal-meta"><span>{market.symbol}</span><span>·</span><span>4H</span><span>·</span><span>15:42</span></div>
              <div className="signal-levels"><div className="level-card target"><small>TAKE PROFIT · TP</small><strong>{market.id === 'forex' ? '1.08620' : market.price}</strong></div><div className="level-card stop"><small>STOP LOSS · SL</small><strong>{market.id === 'forex' ? '1.08300' : market.price}</strong></div></div>
              <div className="signal-reason"><strong>เหตุผลจากระบบ</strong><p>ตัวอย่างข้อความวิเคราะห์ · สัญญาณจริงจะอ้างอิงข้อมูลราคา แท่งเวลา และเงื่อนไขปิดผลที่บันทึกตรวจสอบได้</p></div>
              <div className="signal-footer"><span>รหัสตัวอย่าง #DEMO-042</span><span>ยังไม่นับสถิติจริง</span></div>
            </article>
          </section>

          <section className="performance-section">
            <div className="section-heading"><div><div className="eyebrow">PERFORMANCE LEDGER</div><h2>ผลลัพธ์ครบทุกสัญญาณ</h2></div><div className="range-switch"><button>วันนี้</button><button className="selected">7 วัน</button><button>30 วัน</button><button>ทั้งหมด</button></div></div>
            <div className="stats-grid">
              <article className="panel stat-card"><span className="stat-label">Win rate</span><strong className="stat-value accent">66.7%</strong><span className="stat-note">จาก 3 ไม้ตัวอย่างที่ปิดผล</span><div className="stat-bar"><span style={{ width: '66.7%' }} /></div></article>
              <article className="panel stat-card"><span className="stat-label">ชนะ / แพ้</span><strong className="stat-value">2 <em>/</em> 1</strong><span className="stat-note">แสดงผลแพ้และชนะครบ</span></article>
              <article className="panel stat-card"><span className="stat-label">กำไรสุทธิสะสม</span><strong className="stat-value positive">+0.36%</strong><span className="stat-note">ผลจำลอง · ไม่รวมต้นทุน</span></article>
              <article className="panel stat-card"><span className="stat-label">Max drawdown</span><strong className="stat-value negative">−0.10%</strong><span className="stat-note">จากชุดข้อมูลตัวอย่าง</span></article>
            </div>
          </section>

          <section className="panel history-panel">
            <div className="history-heading"><div><h2>ประวัติสัญญาณ · ตรวจสอบได้ทุกไม้</h2><p>ตัวอย่างหน้าจอ · ผลจริงต้องผูกกับราคาและกติกาปิดผล</p></div><div className="history-filters"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>ทั้งหมด</button><button className={filter === 'win' ? 'selected' : ''} onClick={() => setFilter('win')}>ชนะ</button><button className={filter === 'loss' ? 'selected' : ''} onClick={() => setFilter('loss')}>แพ้</button></div></div>
            <div className="table-wrap"><table><thead><tr><th>ผล</th><th>สินทรัพย์</th><th>ฝั่ง</th><th>ราคาเข้า</th><th>ราคาออก</th><th>P/L</th><th>เวลา</th></tr></thead><tbody>
              {visibleRows.map((row, index) => <tr key={`${row.symbol}-${row.time}-${index}`}><td><span className={row.result === 'ชนะ' ? 'result-pill win' : 'result-pill loss'}><i />{row.result}</span></td><td><strong>{row.symbol}</strong><span className="asset-market">{market.label}</span></td><td className={row.side === 'BUY' ? 'positive' : 'negative'}>{row.side}</td><td>{row.entry}</td><td>{row.exit}</td><td className={row.result === 'ชนะ' ? 'positive' : 'negative'}>{row.pnl}</td><td className="muted-cell">{row.time}</td></tr>)}
            </tbody></table></div>
            <div className="history-footnote">ไม้ที่ยังไม่ปิดผลต้องแสดงแยก และไม่นับใน Win rate จนกว่าจะประเมินจากกติกาที่ตรวจสอบได้</div>
          </section>
          <footer className="page-footer"><span>NOVA · MARKET SIGNAL WORKSPACE</span><span>ข้อมูลในหน้านี้เป็นตัวอย่าง DEMO ทั้งหมด</span></footer>
        </div>
      </main>
    </div>
  );
}
