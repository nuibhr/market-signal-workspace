'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  BarChart2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Compass,
  DollarSign,
  HelpCircle,
  Landmark,
  Layers,
  Loader2,
  PieChart,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import {
  calcCamarilla,
  calcIndicativePrice,
  chooseEntryPlan,
  scoreDRCandidate,
  FEATURED_DR_UNIVERSE,
  THAI_DIVIDEND_PORTFOLIO_MODEL,
  TOP_THAI_DIVIDEND_STOCKS,
} from '../../dr/strategy-tracker.mjs';
import styles from './dr-strategy.module.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getRsiLabel(rsi) {
  if (rsi < 30) return { label: 'Oversold', color: '#10b981' };
  if (rsi > 70) return { label: 'Overbought', color: '#ef4444' };
  if (rsi >= 40 && rsi <= 60) return { label: 'Neutral Zone', color: '#38bdf8' };
  return { label: `RSI ${rsi.toFixed(0)}`, color: '#f59e0b' };
}

// ─── Price Progress Bar (Bloomberg-style Slider) ──────────────────────────────
function PriceProgressBar({ sl, entry, current, tp2 }) {
  const slN = Number(sl) || 0;
  const entryN = Number(entry) || 0;
  const curN = Number(current) || 0;
  const tp2N = Number(tp2) || 0;
  if (!slN || !curN || !tp2N || tp2N <= slN) return null;

  const range = tp2N - slN;
  const nowPct = Math.max(3, Math.min(97, ((curN - slN) / range) * 100));
  const entryPct = Math.max(3, Math.min(97, ((entryN - slN) / range) * 100));

  const inBuyZone = curN <= entryN * 1.01 && curN >= slN;
  const statusText = inBuyZone
    ? 'อยู่ใน Buy Zone (โซนน่าสะสม)'
    : curN > entryN
    ? 'ราคาสูงกว่าจุดเข้า (รอรับย่อตัว)'
    : 'หลุดจุดเข้า (เฝ้าระวัง SL)';

  return (
    <div className={styles.priceProgressWrap}>
      <div className={styles.priceProgressLabelsTop}>
        <span>SL ({slN.toFixed(2)})</span>
        <span>Entry ({entryN.toFixed(2)})</span>
        <span className={styles.nowLabel}>Now ({curN.toFixed(2)})</span>
        <span>TP2 ({tp2N.toFixed(2)})</span>
      </div>
      <div className={styles.priceProgressTrack}>
        <div className={styles.priceProgressGradient} />
        <div
          className={styles.priceProgressEntryDot}
          style={{ left: `${entryPct}%` }}
          title={`Entry Plan: ${entryN.toFixed(2)}`}
        />
        <div
          className={styles.priceProgressNowDot}
          style={{ left: `${nowPct}%` }}
          title={`ราคาปัจจุบัน: ${curN.toFixed(2)}`}
        />
      </div>
      <div className={styles.priceProgressSubLabels}>
        <span>ตำแหน่งราคา: {nowPct.toFixed(0)}% ของกรอบ</span>
        <span style={{ color: inBuyZone ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{statusText}</span>
      </div>
    </div>
  );
}

// ─── Technical Accordion Component ────────────────────────────────────────────
function TechnicalAccordion({ scored, currentPrice }) {
  if (!scored) return null;
  const cam = scored.camarilla;
  const rsiInfo = getRsiLabel(scored.rsi);
  const rsiPct = Math.max(0, Math.min(100, scored.rsi));

  return (
    <div className={styles.techAccordionContent}>
      {/* 1. EMA Section */}
      <div className={styles.techSectionBlock}>
        <div className={styles.techSectionHeader}>
          <span className={styles.techSectionTitle}>
            <Activity size={14} /> EMA 25 / 50 / 75 Alignment
          </span>
          <div className={styles.miniScoreBar}>
            <div className={styles.miniScoreTrack}>
              <div className={styles.miniScoreFill} style={{ width: `${(scored.emaScore / 3) * 100}%` }} />
            </div>
            <span className={styles.miniScoreVal}>{scored.emaScore}/3</span>
          </div>
        </div>
        <div className={styles.threeGrid}>
          {[
            { label: 'EMA 25', val: scored.ema25, active: currentPrice > scored.ema25 },
            { label: 'EMA 50', val: scored.ema50, active: scored.ema25 > scored.ema50 },
            { label: 'EMA 75', val: scored.ema75, active: scored.ema50 > scored.ema75 },
          ].map((e) => (
            <div key={e.label} className={`${styles.techBox} ${e.active ? styles.techBoxActive : ''}`}>
              <div className={styles.techBoxLabel}>{e.label}</div>
              <div className={`${styles.techBoxVal} ${e.active ? styles.techBoxValPos : ''}`}>
                {e.val?.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. RSI Section */}
      <div className={styles.techSectionBlock}>
        <div className={styles.techSectionHeader}>
          <span className={styles.techSectionTitle}>
            <BarChart2 size={14} /> RSI (14) Momentum Sweet Spot
          </span>
          <div className={styles.miniScoreBar}>
            <div className={styles.miniScoreTrack}>
              <div className={styles.miniScoreFill} style={{ width: `${(scored.rsiScore / 3) * 100}%` }} />
            </div>
            <span className={styles.miniScoreVal}>{scored.rsiScore}/3</span>
          </div>
        </div>
        <div className={styles.rsiGaugeWrap}>
          <div className={styles.rsiTrack}>
            <div className={styles.rsiCursorDot} style={{ left: `${rsiPct}%` }} />
          </div>
          <span className={styles.rsiStatusBadge} style={{ color: rsiInfo.color }}>
            {scored.rsi.toFixed(1)} {rsiInfo.label}
          </span>
        </div>
      </div>

      {/* 3. MACD Section */}
      <div className={styles.techSectionBlock}>
        <div className={styles.techSectionHeader}>
          <span className={styles.techSectionTitle}>
            <TrendingUp size={14} /> MACD (12 / 26 / 9) Trend & Momentum
          </span>
          <div className={styles.miniScoreBar}>
            <div className={styles.miniScoreTrack}>
              <div className={styles.miniScoreFill} style={{ width: `${(scored.macdScore / 3) * 100}%` }} />
            </div>
            <span className={styles.miniScoreVal}>{scored.macdScore}/3</span>
          </div>
        </div>
        <div className={styles.threeGrid}>
          <div className={styles.techBox}>
            <div className={styles.techBoxLabel}>MACD Line</div>
            <div className={`${styles.techBoxVal} ${scored.macdLine >= 0 ? styles.techBoxValPos : styles.techBoxValNeg}`}>
              {scored.macdLine > 0 ? '+' : ''}{scored.macdLine.toFixed(4)}
            </div>
          </div>
          <div className={styles.techBox}>
            <div className={styles.techBoxLabel}>Signal Line</div>
            <div className={styles.techBoxVal}>{scored.signalLine.toFixed(4)}</div>
          </div>
          <div className={`${styles.techBox} ${scored.histogram > 0 ? styles.techBoxActive : ''}`}>
            <div className={styles.techBoxLabel}>Histogram</div>
            <div className={`${styles.techBoxVal} ${scored.histogram >= 0 ? styles.techBoxValPos : styles.techBoxValNeg}`}>
              {scored.histogram > 0 ? '+' : ''}{scored.histogram.toFixed(4)}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Camarilla 8-Levels Section */}
      <div className={styles.techSectionBlock}>
        <div className={styles.techSectionHeader}>
          <span className={styles.techSectionTitle}>
            <Target size={14} /> Camarilla Pivots (8 Levels)
          </span>
          <div className={styles.miniScoreBar}>
            <div className={styles.miniScoreTrack}>
              <div className={styles.miniScoreFill} style={{ width: `${(scored.camScore / 4) * 100}%` }} />
            </div>
            <span className={styles.miniScoreVal}>{scored.camScore}/4</span>
          </div>
        </div>
        <div className={styles.camGrid}>
          <div className={styles.camItem}><span className={styles.camR}>R4 (Breakout)</span><b>{cam.R4.toFixed(2)}</b></div>
          <div className={styles.camItem}><span className={styles.camR}>R3 (TP2)</span><b>{cam.R3.toFixed(2)}</b></div>
          <div className={styles.camItem}><span className={styles.camR}>R2</span><b>{cam.R2.toFixed(2)}</b></div>
          <div className={styles.camItem}><span className={styles.camR}>R1 (TP1)</span><b>{cam.R1.toFixed(2)}</b></div>
          <div className={`${styles.camItem} ${styles.camPivotItem}`}><span className={styles.camP}>Pivot</span><b>{cam.pivot.toFixed(2)}</b></div>
          <div className={styles.camItem}><span className={styles.camS}>S1</span><b>{cam.S1.toFixed(2)}</b></div>
          <div className={styles.camItem}><span className={styles.camS}>S2 (Buffer)</span><b>{cam.S2.toFixed(2)}</b></div>
          <div className={styles.camItem}><span className={styles.camS}>S3 (Buy Zone)</span><b>{cam.S3.toFixed(2)}</b></div>
          <div className={styles.camItem}><span className={styles.camS}>S4 (SL)</span><b>{cam.S4.toFixed(2)}</b></div>
        </div>
      </div>
    </div>
  );
}

export default function DrStrategyRadar({ onSelectSymbol, currentMarket = 'dr' }) {
  const [activeTab, setActiveTab] = useState('dr-scanner'); // 'dr-scanner' | 'dr-bridge' | 'thai-dividend'
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'bullish' | 'buyzone' | 'highscore'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSymbol, setExpandedSymbol] = useState('AAPL80');
  const [addedPicks, setAddedPicks] = useState([]);

  // Scanning & Integration State
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStep, setScanStep] = useState('');
  const [lastScanTime, setLastScanTime] = useState('14:30 น.');
  const [toastData, setToastData] = useState(null);
  const [marketClock, setMarketClock] = useState('14:30:00');

  // Live market clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setMarketClock(now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Dismiss toast after 4.5s
  useEffect(() => {
    if (toastData) {
      const timer = setTimeout(() => setToastData(null), 4500);
      return () => clearInterval(timer);
    }
  }, [toastData]);

  // Arbitrage Calculator custom inputs
  const [calcUnderlying, setCalcUnderlying] = useState(235.40);
  const [calcFxRate, setCalcFxRate] = useState(34.50);
  const [calcRatio, setCalcRatio] = useState(100);
  const [calcMarketDr, setCalcMarketDr] = useState(81.25);

  // Compute Scored DRs
  const scoredDRs = useMemo(() => {
    return FEATURED_DR_UNIVERSE.map((item) => {
      const scored = scoreDRCandidate({
        symbol: item.symbol,
        currentPrice: item.currentDrPrice,
        changePct: item.changePct,
        closes: item.closes,
        highs: item.highs,
        lows: item.lows,
        underlying: item.underlying,
      });

      const bridge = calcIndicativePrice({
        underlyingUsd: item.underlyingUsd,
        usdThbRate: 34.50,
        conversionRatio: item.conversionRatio,
        currentDrPrice: item.currentDrPrice,
      });

      return {
        ...item,
        scored,
        bridge,
      };
    });
  }, []);

  // Filtered DRs
  const filteredDRs = useMemo(() => {
    return scoredDRs.filter((item) => {
      const matchesSearch =
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.underlying.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterMode === 'bullish') {
        return item.scored?.emaAligned || item.scored?.emaScore >= 2;
      }
      if (filterMode === 'buyzone') {
        return item.scored?.camScore >= 2;
      }
      if (filterMode === 'highscore') {
        return item.scored?.totalScore >= 10;
      }
      return true;
    });
  }, [scoredDRs, searchQuery, filterMode]);

  // Live calculation for Arbitrage sandbox
  const liveArbitrage = useMemo(() => {
    return calcIndicativePrice({
      underlyingUsd: Number(calcUnderlying) || 1,
      usdThbRate: Number(calcFxRate) || 34.5,
      conversionRatio: Number(calcRatio) || 100,
      currentDrPrice: Number(calcMarketDr) || 1,
    });
  }, [calcUnderlying, calcFxRate, calcRatio, calcMarketDr]);

  // Interactive Scan Simulation
  const handleTriggerScan = () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgress(15);
    setScanStep('เชื่อมต่อ Settrade Open API และตรวจสอบความสมบูรณ์ของฟีด...');

    setTimeout(() => {
      setScanProgress(45);
      setScanStep('ดึง Candlestick 100 แท่งย้อนหลังของ DR80/DR23 ทั้งกระดาน...');
    }, 450);

    setTimeout(() => {
      setScanProgress(80);
      setScanStep('คำนวณ EMA 25/50/75, Camarilla 8 Levels, RSI 14 และ MACD...');
    }, 900);

    setTimeout(() => {
      setScanProgress(100);
      setScanStep('คัดเลือก Top Candidates 4 ตัวที่มีคะแนนสูงสุดสำเร็จ!');
      const nowStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
      setLastScanTime(nowStr);
      setIsScanning(false);
      setToastData({
        title: 'Scan DR80 สำเร็จเรียบร้อย! 🎯',
        desc: `สแกน DR ครบทั้ง 80 ตัวใน SET พบผู้ชนะประจำวัน ${filteredDRs.length} ตัว (AAPL80, NVDA80...) แผนเทรดพร้อมดำเนินการ`,
        type: 'success',
      });
    }, 1400);
  };

  const handleTogglePick = (symbol) => {
    const isAdding = !addedPicks.includes(symbol);
    setAddedPicks((prev) =>
      isAdding ? [...prev, symbol] : prev.filter((s) => s !== symbol)
    );

    const target = scoredDRs.find((d) => d.symbol === symbol);
    if (isAdding && target?.scored) {
      setToastData({
        title: `เพิ่ม ${symbol} เข้า DR Picks แล้ว! 🎯`,
        desc: `จุดเข้า: ${target.scored.entry.toFixed(2)} | TP1: ${target.scored.tp1.toFixed(2)} | SL: ${target.scored.sl.toFixed(2)}`,
        type: 'success',
      });
    } else if (!isAdding) {
      setToastData({
        title: `นำ ${symbol} ออกจาก DR Picks`,
        desc: 'ปรับปรุงรายการติดตามเรียบร้อยแล้ว',
        type: 'info',
      });
    }
  };

  return (
    <section className={styles.container} aria-label="DR Strategy & Thai Dividend Radar">
      {/* Toast Notification */}
      {toastData && (
        <div className={styles.toastWrap} role="status">
          <div className={styles.toastIconBox}>
            <CheckCircle2 size={20} />
          </div>
          <div className={styles.toastContent}>
            <div className={styles.toastTitle}>{toastData.title}</div>
            <div className={styles.toastDesc}>{toastData.desc}</div>
          </div>
          <button
            type="button"
            onClick={() => setToastData(null)}
            className={styles.toastCloseBtn}
            aria-label="ปิดแจ้งเตือน"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className={styles.heroHeader}>
        <div className={styles.heroLeft}>
          <div className={styles.badgePill}>
            <Sparkles size={14} className="text-amber-400" />
            <span>DR80 STRATEGY TRACKER & THAI DIVIDEND INTELLIGENCE</span>
          </div>
          <h2 className={styles.title}>
            เทรดสินทรัพย์โลกบนกระดานไทย <span>ด้วยกลยุทธ์สถาบัน</span>
          </h2>
          <p className={styles.subtitle}>
            ผสานจุดเด่น DR80 Strategy Tracker (Camarilla Pivot, EMA 25/50/75, RSI, MACD) เข้ากับพอร์ตหุ้นปันผลไทย SETHD มีวินัย
            เทรดด้วยเงินบาทในกระดาน SET ไร้ความเสี่ยงค่าธรรมเนียมแปลงสกุลเงินต่างประเทศ
          </p>
        </div>

        <div className={styles.heroRight}>
          <div className={styles.statsGrid}>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>DR Universe</span>
              <strong className={styles.statVal}>80+ Tickers</strong>
              <small className={styles.statNote}>KTB & InnovestX</small>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>Max Score</span>
              <strong className={styles.statVal}>16 Points</strong>
              <small className={styles.statNote}>4 Technical Pillars</small>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>Market Focus</span>
              <strong className={styles.statVal} style={{ color: '#10b981' }}>THB SET Only</strong>
              <small className={styles.statNote}>ซ่อนเมนูหุ้นตปท.</small>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className={styles.navTabs}>
        <button
          type="button"
          onClick={() => setActiveTab('dr-scanner')}
          className={`${styles.tabBtn} ${activeTab === 'dr-scanner' ? styles.tabBtnActive : ''}`}
        >
          <Zap size={16} />
          <span>DR80 Technical Radar</span>
          <span className={styles.tabCount}>{filteredDRs.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dr-bridge')}
          className={`${styles.tabBtn} ${activeTab === 'dr-bridge' ? styles.tabBtnActive : ''}`}
        >
          <Coins size={16} />
          <span>Indicative & Arbitrage Bridge</span>
          <span className={styles.tabBadge}>Live FX</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('thai-dividend')}
          className={`${styles.tabBtn} ${activeTab === 'thai-dividend' ? styles.tabBtnActive : ''}`}
        >
          <PieChart size={16} />
          <span>Thai Dividend Portfolio</span>
          <span className={styles.tabBadge} style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
            SETHD
          </span>
        </button>
      </div>

      {/* Tab 1: DR80 Technical Radar */}
      {activeTab === 'dr-scanner' && (
        <div className={styles.tabContent}>
          {/* ── Bloomberg Live Integration Banner ── */}
          <div className={styles.integrationBanner}>
            <div className={styles.integrationLeft}>
              <div className={styles.wifiIconBox}>
                <Wifi size={18} />
              </div>
              <div className={styles.integrationDetails}>
                <div className={styles.integrationTitleRow}>
                  <span className={styles.integrationTitle}>Live Integration Status</span>
                  <span className={styles.statusPillLive}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Settrade: Live
                  </span>
                  <span className={styles.statusPillTg}>Telegram: Ready</span>
                </div>
                <div className={styles.sampleQuoteText}>
                  Sample Quote <b>AAPL80</b>: 81.25 THB (+0.62%) · ตลาดหลักทรัพย์แห่งประเทศไทย (SET)
                </div>
              </div>
            </div>

            <div className={styles.integrationRight}>
              <div className={styles.lastScanInfo}>
                <Clock size={13} />
                <span>{marketClock} · ตลาดเปิด · สแกนล่าสุด {lastScanTime}</span>
              </div>
              <button
                type="button"
                onClick={handleTriggerScan}
                disabled={isScanning}
                className={styles.scanActionBtn}
              >
                <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
                <span>{isScanning ? 'กำลัง Scan DR...' : 'Scan ใหม่'}</span>
              </button>
            </div>
          </div>

          {/* ── Active Scanning Progress Overlay ── */}
          {isScanning && (
            <div className={styles.scanningBanner}>
              <div className={styles.scanningTopRow}>
                <span className={styles.scanningTitle}>
                  <Loader2 size={16} className="animate-spin text-purple-400" />
                  <span>กำลังสแกน DR Universe (80+ ตัวในกระดาน SET)...</span>
                </span>
                <span className="text-xs font-black text-purple-300">{scanProgress}%</span>
              </div>
              <div className={styles.scanningBarTrack}>
                <div className={styles.scanningBarFill} style={{ width: `${scanProgress}%` }} />
              </div>
              <p className="text-xs text-purple-200/80 m-0">{scanStep}</p>
            </div>
          )}

          {/* ── Bloomberg Stats Cards (6 KPIs) ── */}
          <div className={styles.bloombergKpis}>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>ACTIVE PICKS</span>
              <strong className={styles.kpiVal} style={{ color: '#ffffff' }}>4</strong>
              <span className={styles.kpiSub}>กำลังติดตาม</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>HIT TP</span>
              <strong className={styles.kpiVal} style={{ color: '#10b981' }}>12</strong>
              <span className={styles.kpiSub}>ถึงเป้ากำไร TP1/2</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>HIT SL</span>
              <strong className={styles.kpiVal} style={{ color: '#ef4444' }}>3</strong>
              <span className={styles.kpiSub}>ตัดขาดทุนตามวินัย</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>NEAR TP</span>
              <strong className={styles.kpiVal} style={{ color: '#38bdf8' }}>2</strong>
              <span className={styles.kpiSub}>ใกล้ถึงเป้า (&lt;1.5%)</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>WIN RATE</span>
              <strong className={styles.kpiVal} style={{ color: '#a855f7' }}>78.6%</strong>
              <span className={styles.kpiSub}>อัตราชนะเฉลี่ย</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>AVG RETURN</span>
              <strong className={styles.kpiVal} style={{ color: '#10b981' }}>+4.82%</strong>
              <span className={styles.kpiSub}>กำไรเฉลี่ยต่อรอบ</span>
            </div>
          </div>

          {/* ── Methodology Box (Matching DR80Scanner.tsx) ── */}
          <div className={styles.methodologyCard}>
            <Zap size={22} className={styles.methodologyIcon} />
            <div>
              <h4 className={styles.methodologyTitle}>วิธีคัดกรอง DR วันนี้ (4-Pillar Algorithmic Confluence)</h4>
              <div className={styles.methodologyGrid}>
                <span>✅ <b>EMA 25 &gt; EMA 50 &gt; EMA 75:</b> Bullish Alignment เรียงตัวขึ้น</span>
                <span>✅ <b>Camarilla Pivot:</b> จุดรอรับย่อตัวเข้าใกล้ S2-S3 (Buy Zone)</span>
                <span>✅ <b>RSI 40 - 60:</b> Neutral Sweet Spot มี Room ให้วิ่ง ไม่ไล่ Overbought</span>
                <span>✅ <b>MACD Momentum:</b> Line &gt; Signal และ Histogram ขยายตัวบวก</span>
              </div>
              <p className={styles.methodologyUniverse}>
                Universe: <b>80+ DR/DRx</b> ในตลาด SET | คัดกรอง Confluence อัตรา Risk/Reward &ge; 1.5 เท่า | Auto-run ทุกเช้า 09:00 น.
              </p>
            </div>
          </div>

          {/* Controls Bar */}
          <div className={styles.controlsBar}>
            <div className={styles.searchBox}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="ค้นหา DR เช่น AAPL80, NVDA80, BABA80..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <div className={styles.filterPills}>
              {[
                { id: 'all', label: 'ทั้งหมด' },
                { id: 'bullish', label: 'EMA ขาขึ้น' },
                { id: 'buyzone', label: 'ใกล้โซนซื้อ S2-S3' },
                { id: 'highscore', label: 'คะแนนสูง (≥10/16)' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterMode(f.id)}
                  className={`${styles.filterPill} ${filterMode === f.id ? styles.filterPillActive : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          <div className={styles.cardsGrid}>
            {filteredDRs.map((item, index) => {
              const scored = item.scored;
              if (!scored) return null;
              const isExpanded = expandedSymbol === item.symbol;
              const isPicked = addedPicks.includes(item.symbol);
              const cam = scored.camarilla;

              return (
                <div key={item.symbol} className={styles.card}>
                  {/* Card Top */}
                  <div className={styles.cardHeader}>
                    <div className={styles.symbolGroup}>
                      <div className={styles.avatarBox}>
                        <span>{item.symbol.replace(/\d+$/, '')}</span>
                        <small>#{index + 1}</small>
                      </div>
                      <div>
                        <div className={styles.titleLine}>
                          <h3 className={styles.symbolText}>{item.symbol}</h3>
                          {scored.emaAligned && <span className={styles.tagEma}>EMA ขาขึ้น ✓</span>}
                          {isPicked && <span className={styles.tagPicked}>ในพอร์ตติดตาม ★</span>}
                        </div>
                        <p className={styles.nameText}>
                          {item.name} · หุ้นแม่ {item.underlying}
                        </p>
                      </div>
                    </div>

                    <div className={styles.priceGroup}>
                      <span className={styles.priceVal}>{item.currentDrPrice.toFixed(2)} ฿</span>
                      <span
                        className={`${styles.changeVal} ${item.changePct >= 0 ? styles.pos : styles.neg}`}
                      >
                        {item.changePct >= 0 ? '+' : ''}
                        {item.changePct.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Score Breakdown Bar */}
                  <div className={styles.scoreSection}>
                    <div className={styles.scoreRow}>
                      <span className={styles.scoreLabel}>คะแนนความแข็งแกร่ง (Composite Score)</span>
                      <strong className={styles.scoreRatio}>
                        {scored.totalScore} <span>/ 16</span>
                      </strong>
                    </div>
                    <div className={styles.progressTrack}>
                      <div
                        className={styles.progressBar}
                        style={{
                          width: `${(scored.totalScore / 16) * 100}%`,
                          backgroundColor:
                            scored.totalScore >= 11
                              ? '#10b981'
                              : scored.totalScore >= 7
                              ? '#f59e0b'
                              : '#ef4444',
                        }}
                      />
                    </div>
                    <div className={styles.subScores}>
                      <span>EMA: {scored.emaScore}/3</span>
                      <span>Camarilla: {scored.camScore}/4</span>
                      <span>RSI: {scored.rsiScore}/3</span>
                      <span>MACD: {scored.macdScore}/3</span>
                    </div>
                  </div>

                  {/* Trade Plan Box */}
                  <div className={styles.planBox}>
                    <div className={styles.planGrid}>
                      <div className={styles.planCol}>
                        <span className={styles.planHead}>จุดรอรับ (Entry)</span>
                        <strong className={styles.entryVal}>{scored.entry.toFixed(2)}</strong>
                      </div>
                      <div className={styles.planCol}>
                        <span className={styles.planHead}>เป้าหมาย 1 (TP1)</span>
                        <strong className={styles.tp1Val}>{scored.tp1.toFixed(2)}</strong>
                      </div>
                      <div className={styles.planCol}>
                        <span className={styles.planHead}>เป้าหมาย 2 (TP2)</span>
                        <strong className={styles.tp2Val}>{scored.tp2.toFixed(2)}</strong>
                      </div>
                      <div className={styles.planCol}>
                        <span className={styles.planHead}>ตัดขาดทุน (SL)</span>
                        <strong className={styles.slVal}>{scored.sl.toFixed(2)}</strong>
                      </div>
                    </div>

                    <div className={styles.planFooter}>
                      <span className={styles.rrText}>
                        Risk / Reward: <b>1 : {scored.riskReward.toFixed(2)}</b>
                      </span>
                      <span className={styles.reasonPill}>{scored.reason.split(' | ')[0]}</span>
                    </div>
                  </div>

                  {/* ── Price Progress Bar (Bloomberg Range Slider) ── */}
                  <PriceProgressBar
                    sl={scored.sl}
                    entry={scored.entry}
                    current={item.currentDrPrice}
                    tp2={scored.tp2}
                  />

                  {/* Technical Details Toggle */}
                  <div className={styles.detailsToggle}>
                    <button
                      type="button"
                      onClick={() => setExpandedSymbol(isExpanded ? null : item.symbol)}
                      className={styles.toggleBtn}
                    >
                      <span>
                        {isExpanded
                          ? 'ซ่อนรายละเอียด Technical Indicators'
                          : 'ดูรายละเอียด Technical (EMA / RSI / MACD / Camarilla 8 ระดับ)'}
                      </span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {/* Technical Accordion Drawer */}
                  {isExpanded && (
                    <TechnicalAccordion scored={scored} currentPrice={item.currentDrPrice} />
                  )}

                  {/* Actions */}
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      onClick={() => handleTogglePick(item.symbol)}
                      className={`${styles.actionBtn} ${isPicked ? styles.actionBtnPicked : styles.actionBtnSecondary}`}
                    >
                      {isPicked ? '✓ บันทึกใน Watchlist แล้ว' : '+ เพิ่มเข้า DR Picks'}
                    </button>
                    {onSelectSymbol && (
                      <button
                        type="button"
                        onClick={() => onSelectSymbol(item)}
                        className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                      >
                        เปิดดูกราฟ 15m / 1D <ArrowUpRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Indicative & Arbitrage Bridge */}
      {activeTab === 'dr-bridge' && (
        <div className={styles.tabContent}>
          <div className={styles.bridgeIntroCard}>
            <div className={styles.bridgeIconWrap}>
              <Coins size={28} className="text-amber-400" />
            </div>
            <div>
              <h3 className={styles.bridgeTitle}>Indicative Fair Value & Arbitrage Spread Bridge</h3>
              <p className={styles.bridgeDesc}>
                เปรียบเทียบมูลค่าที่แท้จริงของ DR กับราคาตลาดหุ้นแม่ (Underlying USD) ผ่านอัตราแลกเปลี่ยน (USD/THB)
                ทำให้เห็นทันทีว่า DR บนกระดาน SET ปัจจุบันกำลังเทรดถูกกว่า (Discount) หรือแพงกว่า (Premium)
              </p>
            </div>
          </div>

          {/* Interactive Calculator Sandbox */}
          <div className={styles.sandboxCard}>
            <div className={styles.sandboxHeader}>
              <Calculator size={18} />
              <h4>เครื่องคำนวณ Indicative Fair Value แบบปรับตัวแปรสด</h4>
            </div>

            <div className={styles.sandboxGrid}>
              <div className={styles.inputGroup}>
                <label>ราคาหุ้นแม่ (USD)</label>
                <input
                  type="number"
                  step="0.1"
                  value={calcUnderlying}
                  onChange={(e) => setCalcUnderlying(e.target.value)}
                  className={styles.calcInput}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>อัตราแลกเปลี่ยน (USD/THB)</label>
                <input
                  type="number"
                  step="0.05"
                  value={calcFxRate}
                  onChange={(e) => setCalcFxRate(e.target.value)}
                  className={styles.calcInput}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>อัตราส่วนแปลงสภาพ (DR : 1 Share)</label>
                <input
                  type="number"
                  step="1"
                  value={calcRatio}
                  onChange={(e) => setCalcRatio(e.target.value)}
                  className={styles.calcInput}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>ราคา DR บนกระดานไทย (THB)</label>
                <input
                  type="number"
                  step="0.05"
                  value={calcMarketDr}
                  onChange={(e) => setCalcMarketDr(e.target.value)}
                  className={styles.calcInput}
                />
              </div>
            </div>

            {liveArbitrage && (
              <div className={styles.calcOutputStrip}>
                <div className={styles.outBox}>
                  <span>Indicative Fair Price (ราคาที่ควรจะเป็น)</span>
                  <strong>{liveArbitrage.fairPriceThb.toFixed(2)} บาท</strong>
                </div>
                <div className={styles.outBox}>
                  <span>ส่วนต่างราคา (Spread)</span>
                  <strong style={{ color: liveArbitrage.diffPct < 0 ? '#10b981' : '#f59e0b' }}>
                    {liveArbitrage.diffThb > 0 ? '+' : ''}
                    {liveArbitrage.diffThb.toFixed(2)} บาท ({liveArbitrage.diffPct > 0 ? '+' : ''}
                    {liveArbitrage.diffPct.toFixed(2)}%)
                  </strong>
                </div>
                <div className={styles.outBox}>
                  <span>สถานะการประเมิน</span>
                  <span
                    className={styles.statusPill}
                    style={{ backgroundColor: `${liveArbitrage.color}20`, color: liveArbitrage.color }}
                  >
                    {liveArbitrage.label}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Reference Table */}
          <div className={styles.tableCard}>
            <h4 className={styles.tableHeading}>ตารางเปรียบเทียบ Arbitrage ของ DR80 ยอดนิยม</h4>
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>DR Symbol</th>
                    <th>หุ้นแม่ (USD)</th>
                    <th>อัตราส่วน</th>
                    <th>ราคาประเมิน (Fair THB)</th>
                    <th>ราคาตลาด SET (THB)</th>
                    <th>Premium / Discount</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {scoredDRs.map((item) => {
                    const b = item.bridge;
                    if (!b) return null;
                    return (
                      <tr key={item.symbol}>
                        <td>
                          <b>{item.symbol}</b>
                          <small className="block text-slate-400">{item.name}</small>
                        </td>
                        <td>${item.underlyingUsd.toFixed(2)}</td>
                        <td>{item.conversionRatio} : 1</td>
                        <td>
                          <b>{b.fairPriceThb.toFixed(2)} ฿</b>
                        </td>
                        <td>
                          <b className="text-white">{item.currentDrPrice.toFixed(2)} ฿</b>
                        </td>
                        <td style={{ color: b.diffPct < 0 ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>
                          {b.diffPct > 0 ? '+' : ''}
                          {b.diffPct.toFixed(2)}%
                        </td>
                        <td>
                          <span
                            className={styles.tablePill}
                            style={{ backgroundColor: `${b.color}25`, color: b.color }}
                          >
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Thai Dividend Portfolio */}
      {activeTab === 'thai-dividend' && (
        <div className={styles.tabContent}>
          {/* Header */}
          <div className={styles.divHeroCard}>
            <div className={styles.divHeroLeft}>
              <div className={styles.divBadge}>
                <Landmark size={14} />
                <span>THAI HIGH-DIVIDEND STRATEGY (SETHD)</span>
              </div>
              <h3>พอร์ตหุ้นปันผลไทยที่มีวินัยก่อนผลตอบแทน</h3>
              <p>
                คัดกรองหุ้นปันผลสูง มีประวัติการจ่ายเงินปันผลต่อเนื่อง กระแสเงินสดมั่นคง และอัตราเงินปันผลตอบแทน (Dividend Yield) สูงกว่าค่าเฉลี่ยตลาด
                พร้อมโมเดลจัดสรรพอร์ต 5 ระดับเพื่อลดความผันผวน
              </p>
            </div>

            <div className={styles.divHeroRight}>
              <div className={styles.yieldHighlight}>
                <span>ค่าเฉลี่ย Dividend Yield</span>
                <strong>6.8%</strong>
                <small>จ่ายปันผลสม่ำเสมอทุกปี</small>
              </div>
            </div>
          </div>

          {/* Model Allocation Grid */}
          <div className={styles.modelSection}>
            <h4 className={styles.sectionTitle}>
              <PieChart size={18} />
              <span>โมเดลจัดสรรพอร์ตปันผล 5 ระดับ (Disciplined Allocation)</span>
            </h4>
            <div className={styles.modelGrid}>
              {THAI_DIVIDEND_PORTFOLIO_MODEL.map((m) => (
                <div key={m.bucket} className={styles.modelBox}>
                  <div className={styles.modelTop}>
                    <span className={styles.modelName}>{m.bucket}</span>
                    <strong className={styles.modelPct}>{m.target}%</strong>
                  </div>
                  <p className={styles.modelDesc}>{m.description}</p>
                  <div className={styles.modelTags}>
                    {m.examples.map((ex) => (
                      <span key={ex} className={styles.modelTag}>
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Thai Dividend Stocks Table */}
          <div className={styles.tableCard}>
            <h4 className={styles.tableHeading}>
              <CalendarDays size={18} />
              <span>เรดาร์หุ้นปันผลเด่น & ปฏิทินวันขึ้นเครื่องหมาย XD (Thai Dividend Radar)</span>
            </h4>

            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>หุ้นไทย</th>
                    <th>กลุ่มอุตสาหกรรม</th>
                    <th>ราคาล่าสุด</th>
                    <th>ปันผลต่อปี</th>
                    <th>Dividend Yield</th>
                    <th>รอบการจ่าย</th>
                    <th>วัน XD ล่าสุด / ถัดไป</th>
                    <th>Safety Score</th>
                  </tr>
                </thead>
                <tbody>
                  {TOP_THAI_DIVIDEND_STOCKS.map((stock) => (
                    <tr key={stock.symbol}>
                      <td>
                        <b className="text-emerald-400">{stock.symbol}</b>
                        <small className="block text-slate-400">{stock.name}</small>
                      </td>
                      <td>
                        <span className={styles.sectorPill}>{stock.sector}</span>
                      </td>
                      <td>
                        <b>{stock.price.toFixed(2)} ฿</b>
                      </td>
                      <td>{stock.annualDividend.toFixed(2)} ฿</td>
                      <td>
                        <strong className="text-emerald-400 font-bold">{stock.yieldPct.toFixed(2)}%</strong>
                      </td>
                      <td>{stock.frequency}</td>
                      <td>
                        <span className="text-slate-300 font-medium">{stock.lastXdDate}</span>
                        <small className="block text-amber-400 text-[11px]">{stock.nextXdDate}</small>
                      </td>
                      <td>
                        <div className={styles.safetyBox}>
                          <div className={styles.safetyTrack}>
                            <div className={styles.safetyBar} style={{ width: `${stock.safetyScore}%` }} />
                          </div>
                          <span>{stock.safetyScore}/100</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
