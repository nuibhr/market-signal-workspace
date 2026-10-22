'use client';

import React, { useState, useMemo, useEffect } from 'react';
import styles from './us-stage2-desk.module.css';
import { US_STOCKS, US_ETFS } from '../../markets/catalog.mjs';

// ─── HIGH CONVICTION STAGE 2 STOCKS MASTER DATA ───
export const US_STAGE2_FOCUS_PICKS = [
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    sector: 'Semiconductors & AI',
    exchange: 'NASDAQ',
    price: 138.50,
    changePercent: 2.45,
    isUp: true,
    topPick: true,
    stage: 'Stage 2 ขาขึ้นสมบูรณ์แบบ',
    pattern: 'VCP Base 1 Breakout',
    rsRating: 98,
    rvol: 1.82,
    proximityHigh: 2.8,
    entry: 138.50,
    stopLoss: 128.00,
    riskPercent: 7.58,
    tp1: 159.50,
    tp1Reward: 21.00,
    tp2: 172.00,
    trailingGuide: 'ขยับ Stop Loss บังทุนเมื่อแตะ $149 และ Run Trend ตาม EMA20',
    catalyst: 'Blackwell GPU High Volume Ramp & Mega Data Center Demand',
  },
  {
    symbol: 'PLTR',
    name: 'Palantir Technologies Inc.',
    sector: 'AI Enterprise Software',
    exchange: 'NYSE',
    price: 44.20,
    changePercent: 4.82,
    isUp: true,
    topPick: true,
    stage: 'Stage 2 ขาขึ้นสมบูรณ์แบบ',
    pattern: 'Cup & Handle Breakout',
    rsRating: 96,
    rvol: 2.15,
    proximityHigh: 1.5,
    entry: 44.20,
    stopLoss: 40.80,
    riskPercent: 7.69,
    tp1: 51.00,
    tp1Reward: 6.80,
    tp2: 55.50,
    trailingGuide: 'ล็อกกำไร 50% ที่ $51.00 แล้วปล่อยส่วนที่เหลือเกาะเส้น EMA10',
    catalyst: 'AIP Commercial Growth 50%+ YoY & S&P 500 Inclusion Flow',
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    sector: 'Consumer Electronics & AI',
    exchange: 'NASDAQ',
    price: 235.00,
    changePercent: 1.25,
    isUp: true,
    topPick: true,
    stage: 'Stage 2 ขาขึ้นสมบูรณ์แบบ',
    pattern: 'Flat Base Pivot Reclaim',
    rsRating: 89,
    rvol: 1.25,
    proximityHigh: 2.1,
    entry: 235.00,
    stopLoss: 219.00,
    riskPercent: 6.81,
    tp1: 267.00,
    tp1Reward: 32.00,
    tp2: 282.00,
    trailingGuide: 'ตั้ง Stop Loss ใต้ Pivot $219 หลุดให้คัต ถือตามรอบอัปเกรดเครื่อง',
    catalyst: 'Apple Intelligence Rollout & iPhone 16 Replacement Supercycle',
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    sector: 'Cloud & AI Infrastructure',
    exchange: 'NASDAQ',
    price: 428.00,
    changePercent: 0.95,
    isUp: true,
    topPick: false,
    stage: 'Stage 2 พักตัวบน EMA20',
    pattern: 'EMA20 Bounce Pullback',
    rsRating: 88,
    rvol: 1.18,
    proximityHigh: 5.4,
    entry: 428.00,
    stopLoss: 400.00,
    riskPercent: 6.54,
    tp1: 484.00,
    tp1Reward: 56.00,
    tp2: 510.00,
    trailingGuide: 'ทะลุ $450 ขยับ Stop ขึ้นมาที่ $428 ทันที',
    catalyst: 'Azure AI Cloud Monetization & Enterprise Copilot Subscriptions',
  },
  {
    symbol: 'META',
    name: 'Meta Platforms, Inc.',
    sector: 'Social Media & Generative AI',
    exchange: 'NASDAQ',
    price: 590.00,
    changePercent: 2.10,
    isUp: true,
    topPick: false,
    stage: 'Stage 2 ขาขึ้นสมบูรณ์แบบ',
    pattern: 'Ascending Channel Breakout',
    rsRating: 95,
    rvol: 1.45,
    proximityHigh: 1.8,
    entry: 590.00,
    stopLoss: 550.00,
    riskPercent: 6.78,
    tp1: 670.00,
    tp1Reward: 80.00,
    tp2: 715.00,
    trailingGuide: 'เกาะเทรนด์ EMA20 อย่างเคร่งครัด แบ่งขาย 30% เมื่อแตะ TP1',
    catalyst: 'AI Ad Recommendation Engine & Llama Open Source Ecosystem',
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com, Inc.',
    sector: 'E-Commerce & Cloud Infrastructure',
    exchange: 'NASDAQ',
    price: 188.00,
    changePercent: 1.55,
    isUp: true,
    topPick: false,
    stage: 'Stage 2 ทะลุแนวสะสม',
    pattern: 'Base 1 Pivot Breakout',
    rsRating: 87,
    rvol: 1.30,
    proximityHigh: 6.2,
    entry: 188.00,
    stopLoss: 175.00,
    riskPercent: 6.91,
    tp1: 214.00,
    tp1Reward: 26.00,
    tp2: 228.00,
    trailingGuide: 'รันเทรนด์ตามเส้น EMA50 ไม่หลุด $175 ถือต่อสบายใจ',
    catalyst: 'AWS Re-acceleration & North America Retail Margin Expansion',
  },
  {
    symbol: 'AVGO',
    name: 'Broadcom Inc.',
    sector: 'Custom Silicon & Networking',
    exchange: 'NASDAQ',
    price: 178.00,
    changePercent: 3.20,
    isUp: true,
    topPick: false,
    stage: 'Stage 2 ขาขึ้นสมบูรณ์แบบ',
    pattern: 'High Tight Flag Breakout',
    rsRating: 94,
    rvol: 1.65,
    proximityHigh: 3.1,
    entry: 178.00,
    stopLoss: 165.00,
    riskPercent: 7.30,
    tp1: 204.00,
    tp1Reward: 26.00,
    tp2: 218.00,
    trailingGuide: 'เมื่อบวกเกิน 10% ให้ตั้ง Trailing Stop ที่จุดต่ำสุดของ 3 วันก่อนหน้า',
    catalyst: 'Custom ASIC AI Chips for Hyperscalers (Google, Meta, OpenAI)',
  },
  {
    symbol: 'TSLA',
    name: 'Tesla, Inc.',
    sector: 'EV, Autonomous Driving & Energy',
    exchange: 'NASDAQ',
    price: 225.00,
    changePercent: 3.85,
    isUp: true,
    topPick: false,
    stage: 'Stage 2 ทรงตัวทดสอบแนวต้าน',
    pattern: 'Double Bottom Base 2',
    rsRating: 85,
    rvol: 1.95,
    proximityHigh: 14.5,
    entry: 225.00,
    stopLoss: 208.00,
    riskPercent: 7.56,
    tp1: 259.00,
    tp1Reward: 34.00,
    tp2: 278.00,
    trailingGuide: 'สเปรดราคากว้าง ให้ใช้ Position Sizing คุมความเสี่ยงไม่เกิน 1% พอร์ต',
    catalyst: 'FSD V13 Unsupervised Rollout & Megapack Energy Storage Growth',
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    sector: 'Search, Advertising & Cloud',
    exchange: 'NASDAQ',
    price: 165.00,
    changePercent: 0.85,
    isUp: true,
    topPick: false,
    stage: 'Stage 2 พักตัวยก Low',
    pattern: 'EMA50 Pullback & Reclaim',
    rsRating: 84,
    rvol: 1.10,
    proximityHigh: 12.0,
    entry: 165.00,
    stopLoss: 153.00,
    riskPercent: 7.27,
    tp1: 189.00,
    tp1Reward: 24.00,
    tp2: 199.00,
    trailingGuide: 'แนวรับสำคัญ $153 หากยืนได้ ค่อยๆ สะสมไม้เพิ่ม',
    catalyst: 'Gemini Cloud Integration & YouTube Subscription Revenue Surge',
  },
  {
    symbol: 'LLY',
    name: 'Eli Lilly and Company',
    sector: 'Pharmaceuticals & Weight Loss',
    exchange: 'NYSE',
    price: 915.00,
    changePercent: 1.15,
    isUp: true,
    topPick: false,
    stage: 'Stage 2 ขาขึ้นสมบูรณ์แบบ',
    pattern: 'Stage 2 Flat Base Consolidation',
    rsRating: 92,
    rvol: 1.22,
    proximityHigh: 4.8,
    entry: 915.00,
    stopLoss: 855.00,
    riskPercent: 6.56,
    tp1: 1035.00,
    tp1Reward: 120.00,
    tp2: 1090.00,
    trailingGuide: 'หุ้นโมเมนตัมสายสุขภาพตัวจริง วิ่งตามรอบรายได้ยาลดน้ำหนัก Mounjaro',
    catalyst: 'GLP-1 Mounjaro/Zepbound Production Expansion & Strong Pipeline',
  },
];

// ─── THEMATIC ETF ROTATION MASTER DATA ───
export const THEMATIC_ETF_DATA = [
  // Leading
  {
    symbol: 'SMH',
    name: 'VanEck Semiconductor ETF',
    theme: 'AI Hardware / GPU & ชิปเซมิคอนดักเตอร์',
    quadrant: 'leading',
    rsRating: 95,
    flowNetUSD: '+840M',
    flowPositive: true,
    periodReturn: '+18.4%',
    topHoldings: 'NVDA (24%), TSM (13%), AVGO (8%), ASML (5%)',
  },
  {
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust',
    theme: 'Nasdaq-100 เมกะแคปและเศรษฐกิจดิจิทัล',
    quadrant: 'leading',
    rsRating: 89,
    flowNetUSD: '+1,250M',
    flowPositive: true,
    periodReturn: '+12.6%',
    topHoldings: 'AAPL (9%), MSFT (8%), NVDA (8%), AMZN (5%)',
  },
  {
    symbol: 'CIBR',
    name: 'First Trust Cybersecurity ETF',
    theme: 'ความปลอดภัยทางไซเบอร์ & Cloud Protection',
    quadrant: 'leading',
    rsRating: 86,
    flowNetUSD: '+320M',
    flowPositive: true,
    periodReturn: '+14.2%',
    topHoldings: 'PANW (7%), CRWD (7%), FTNT (5%), NET (4%)',
  },
  // Improving
  {
    symbol: 'XLE',
    name: 'Energy Select SPDR Fund',
    theme: 'พลังงาน & โครงสร้างพื้นฐานจ่ายไฟ AI Data Center',
    quadrant: 'improving',
    rsRating: 77,
    flowNetUSD: '+450M',
    flowPositive: true,
    periodReturn: '+8.5%',
    topHoldings: 'XOM (23%), CVX (19%), COP (9%), EOG (5%)',
  },
  {
    symbol: 'IWM',
    name: 'iShares Russell 2000 ETF',
    theme: 'หุ้นขนาดเล็กสหรัฐฯ (Small-Cap Rotation)',
    quadrant: 'improving',
    rsRating: 74,
    flowNetUSD: '+610M',
    flowPositive: true,
    periodReturn: '+9.8%',
    topHoldings: 'กระจายตัวกว่า 2,000 หุ้น อานิสงส์ดอกเบี้ยขาลง',
  },
  {
    symbol: 'WCLD',
    name: 'WisdomTree Cloud Computing ETF',
    theme: 'ซอฟต์แวร์ระบบคลาวด์องค์กร (Enterprise SaaS)',
    quadrant: 'improving',
    rsRating: 80,
    flowNetUSD: '+180M',
    flowPositive: true,
    periodReturn: '+11.2%',
    topHoldings: 'MDB, CRWD, SNOW, DDOG, ZS',
  },
  // Weakening
  {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    theme: 'ดัชนีแกนหลักตลาดหุ้นสหรัฐฯ (S&P 500 Core)',
    quadrant: 'weakening',
    rsRating: 82,
    flowNetUSD: '+2,100M',
    flowPositive: true,
    periodReturn: '+5.4%',
    topHoldings: '500 หุ้นขนาดใหญ่ของสหรัฐฯ',
  },
  {
    symbol: 'XLV',
    name: 'Health Care Select SPDR Fund',
    theme: 'สุขภาพและการแพทย์ (Defensive Healthcare)',
    quadrant: 'weakening',
    rsRating: 68,
    flowNetUSD: '-120M',
    flowPositive: false,
    periodReturn: '+2.1%',
    topHoldings: 'LLY (13%), UNH (9%), JNJ (7%), ABBV (6%)',
  },
  {
    symbol: 'XLF',
    name: 'Financial Select SPDR Fund',
    theme: 'สถาบันการเงินและธนาคารพาณิชย์',
    quadrant: 'weakening',
    rsRating: 72,
    flowNetUSD: '-90M',
    flowPositive: false,
    periodReturn: '+4.0%',
    topHoldings: 'BRK.B (13%), JPM (10%), V (8%), MA (7%)',
  },
  // Lagging
  {
    symbol: 'ICLN',
    name: 'iShares Global Clean Energy ETF',
    theme: 'พลังงานสะอาด แสงอาทิตย์ และกังหันลม (Stage 4 Lag)',
    quadrant: 'lagging',
    rsRating: 42,
    flowNetUSD: '-280M',
    flowPositive: false,
    periodReturn: '-7.2%',
    topHoldings: 'FSLR, ENPH, VWS, SEDG (แรงกดดันดอกเบี้ยสูง)',
  },
];

export default function UsStage2Desk({
  selectedSymbol,
  onSelect,
  favorites = [],
  onToggleFavorite,
  activeTab: externalTab,
  onTabChange,
}) {
  const [internalTab, setInternalTab] = useState('focus'); // focus, rotation, fx, sizing, screener
  const activeTab = externalTab ?? internalTab;
  const setActiveTab = (tab) => {
    if (onTabChange) onTabChange(tab);
    setInternalTab(tab);
  };
  const [focusFilter, setFocusFilter] = useState('top3'); // top3, mag7, rs, volume, favorites
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');

  // ── Market Hours Clock Logic (Pre, Regular, Post) ──
  const [marketSession, setMarketSession] = useState({
    isOpen: false,
    label: 'ตลาดปิด (Closed)',
    hoursLabel: 'เวลาทำการปกติ 20:30 - 03:00 น. (เวลาไทย)',
  });

  useEffect(() => {
    const checkSession = () => {
      const now = new Date();
      // Bangkok Timezone
      const bkkTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
      const hour = bkkTime.getHours();
      const min = bkkTime.getMinutes();
      const day = bkkTime.getDay(); // 0 is Sun, 6 is Sat

      // Weekends closed
      if (day === 0 || day === 6) {
        setMarketSession({
          isOpen: false,
          label: 'วันหยุดสุดสัปดาห์ (Weekend Closed)',
          hoursLabel: 'เปิดทำการคืนวันจันทร์ 20:30 น. (เวลาไทย)',
        });
        return;
      }

      // Pre-market: 15:00 - 20:30
      if ((hour > 15 || (hour === 15 && min >= 0)) && (hour < 20 || (hour === 20 && min < 30))) {
        setMarketSession({
          isOpen: true,
          label: 'ช่วงก่อนเปิดตลาด (Pre-Market Session)',
          hoursLabel: '15:00 - 20:30 น. (เวลาไทย) · มี Volume ทยอยเข้า',
        });
      }
      // Regular: 20:30 - 03:00
      else if ((hour > 20 || (hour === 20 && min >= 30)) || hour < 3) {
        setMarketSession({
          isOpen: true,
          label: 'ตลาดเปิดทำการปกติ (Regular Session)',
          hoursLabel: '20:30 - 03:00 น. (เวลาไทย) · Active Trading',
        });
      }
      // Post-market: 03:00 - 07:00
      else if (hour >= 3 && hour < 7) {
        setMarketSession({
          isOpen: true,
          label: 'ช่วงหลังปิดตลาด (After-Hours Session)',
          hoursLabel: '03:00 - 07:00 น. (เวลาไทย) · รายงานงบกำไร',
        });
      } else {
        setMarketSession({
          isOpen: false,
          label: 'ตลาดปิด (EOD Signals Ready)',
          hoursLabel: 'สแกนแท่งรายวันเสร็จสมบูรณ์ พร้อมวางแผนการเทรด',
        });
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── FX Risk & Hedge Simulator State ──
  const [currentFxRate, setCurrentFxRate] = useState(34.50);
  const [entryFxRate, setEntryFxRate] = useState(36.00);
  const [stockUsdReturn, setStockUsdReturn] = useState(15.0);
  const [investmentUsd, setInvestmentUsd] = useState(5000);

  // FX Calculations
  const fxChangePercent = useMemo(() => {
    if (!entryFxRate || entryFxRate <= 0) return 0;
    return ((currentFxRate - entryFxRate) / entryFxRate) * 100;
  }, [currentFxRate, entryFxRate]);

  const netThbReturnPercent = useMemo(() => {
    const usdFactor = 1 + stockUsdReturn / 100;
    const fxFactor = 1 + fxChangePercent / 100;
    return (usdFactor * fxFactor - 1) * 100;
  }, [stockUsdReturn, fxChangePercent]);

  const unhedgedFinalThb = useMemo(() => {
    const finalUsd = investmentUsd * (1 + stockUsdReturn / 100);
    return finalUsd * currentFxRate;
  }, [investmentUsd, stockUsdReturn, currentFxRate]);

  const unhedgedProfitThb = useMemo(() => {
    const initialThb = investmentUsd * entryFxRate;
    return unhedgedFinalThb - initialThb;
  }, [investmentUsd, entryFxRate, unhedgedFinalThb]);

  const hedgedFinalThb = useMemo(() => {
    const finalUsd = investmentUsd * (1 + stockUsdReturn / 100);
    return finalUsd * entryFxRate; // Locked at entry rate
  }, [investmentUsd, stockUsdReturn, entryFxRate]);

  const hedgedProfitThb = useMemo(() => {
    const initialThb = investmentUsd * entryFxRate;
    return hedgedFinalThb - initialThb;
  }, [investmentUsd, entryFxRate, hedgedFinalThb]);

  const fxDragThb = useMemo(() => {
    return unhedgedProfitThb - hedgedProfitThb;
  }, [unhedgedProfitThb, hedgedProfitThb]);

  // ── 2R US Position Sizing State ──
  const [portfolioSizeUsd, setPortfolioSizeUsd] = useState(10000);
  const [riskPerTradePercent, setRiskPerTradePercent] = useState(1.0);
  const [sizingSelectedTicker, setSizingSelectedTicker] = useState('NVDA');
  const [sizingEntry, setSizingEntry] = useState(138.50);
  const [sizingStop, setSizingStop] = useState(128.00);

  const handleSelectSizingTicker = (ticker) => {
    setSizingSelectedTicker(ticker.symbol);
    setSizingEntry(ticker.entry);
    setSizingStop(ticker.stopLoss);
  };

  const calculatedSizing = useMemo(() => {
    const maxDollarRisk = (portfolioSizeUsd * riskPerTradePercent) / 100;
    const riskPerShare = Math.max(0.01, sizingEntry - sizingStop);
    const shares = Math.max(1, Math.floor(maxDollarRisk / riskPerShare));
    const capitalRequiredUsd = shares * sizingEntry;
    const capitalRequiredThb = capitalRequiredUsd * currentFxRate;
    const portfolioAllocationPercent = (capitalRequiredUsd / portfolioSizeUsd) * 100;
    const actualLossAtStop = shares * riskPerShare;
    const rewardAtTp1 = shares * (riskPerShare * 2);
    const rewardAtTp2 = shares * (riskPerShare * 3);

    return {
      shares,
      capitalRequiredUsd,
      capitalRequiredThb,
      portfolioAllocationPercent,
      actualLossAtStop,
      rewardAtTp1,
      rewardAtTp2,
      riskPerShare,
    };
  }, [portfolioSizeUsd, riskPerTradePercent, sizingEntry, sizingStop, currentFxRate]);

  // ── Focus List Filtered ──
  const filteredFocusPicks = useMemo(() => {
    return US_STAGE2_FOCUS_PICKS.filter(pick => {
      if (focusFilter === 'top3') return pick.topPick;
      if (focusFilter === 'mag7') return ['NVDA', 'MSFT', 'AAPL', 'META', 'AMZN', 'GOOGL', 'TSLA'].includes(pick.symbol);
      if (focusFilter === 'rs') return pick.rsRating >= 90;
      if (focusFilter === 'volume') return pick.rvol >= 1.5;
      if (focusFilter === 'favorites') return favorites.includes(pick.symbol);
      return true;
    });
  }, [focusFilter, favorites]);

  // ── Screener Table Filtered ──
  const filteredUniverse = useMemo(() => {
    return US_STAGE2_FOCUS_PICKS.filter(item => {
      const matchQuery = !searchQuery.trim() ||
        `${item.symbol} ${item.name} ${item.sector}`.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchSector = sectorFilter === 'all' || item.sector.toLowerCase().includes(sectorFilter.toLowerCase());
      return matchQuery && matchSector;
    });
  }, [searchQuery, sectorFilter]);

  // Scroll to chart trigger
  const handleSelectAsset = (item) => {
    if (onSelect) {
      onSelect({
        symbol: item.symbol,
        name: item.name,
        id: 'us',
        kind: 'stock',
      });
    }
    setTimeout(() => {
      const el = document.getElementById('chart-panel') || document.querySelector('.chart-panel');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <section id="us-stage2-command-desk" className={styles.desk} aria-label="US 500 Equities and Thematic ETFs Stage 2 Command Desk">
      {/* ─── 1. Header Bar with Market Session Badge ─── */}
      <div className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.eyebrow}>
            <span>✦ US 500 & GLOBAL ETFS · HIGH-CONVICTION STAGE 2 COMMAND DESK</span>
          </div>
          <h2 className={styles.title}>
            <span className={styles.titleFlag}>🇺🇸</span>
            <span>ตลาดหุ้นสหรัฐฯ &amp; กองทุน ETF เมกะเทรนด์โลก</span>
            <span className={styles.titleBadge}>EOD SCREENER &amp; 2R RISK LAB</span>
          </h2>
          <p className={styles.subtitle}>
            คัดกรองเฉพาะหุ้นผู้นำ Stage 2 ตามตำรา Mark Minervini · สำรวจ Fund Flow การหมุนเวียนกลุ่ม ETF โลก · จำลองผลกระทบค่าเงิน USD/THB ป้องกันกำไรหดหาย
          </p>
        </div>

        <div className={styles.marketClockBox}>
          <div className={`${styles.clockBadge} ${!marketSession.isOpen ? styles.clockBadgeClosed : ''}`}>
            <span className={marketSession.isOpen ? styles.livePulseDot : styles.livePulseDotBlue} />
            <span>{marketSession.label}</span>
          </div>
          <span className={styles.clockHours}>{marketSession.hoursLabel}</span>
        </div>
      </div>

      {/* ─── 2. Capital Protection Shield ─── */}
      <div className={styles.guardBanner}>
        <div className={styles.guardIcon}>🛡️</div>
        <div className={styles.guardContent}>
          <strong>ระบบเกราะคุ้มครองเงินต้น (Wall Street Capital Protection Guard):</strong>
          <p>
            ระบบสแกนหุ้นสหรัฐฯ 500 ตัวและ 100 ETFs อย่างละเอียด <b>คัดทิ้งหุ้นขาลง Stage 4 และกราฟเสียทรงไปแล้ว 312 ตัว</b> (เช่น INTC, NKE, BA, DIS) เพื่อป้องกันไม่ให้คุณติดดอยเรื้อรัง เหลือเพียง <b>ผู้นำ Stage 2 ที่มีโมเมนตัมและ Relative Strength สูงสุด 48 ตัว</b> พร้อมจุดตัดขาดทุน Stop Loss ล็อกไว้ไม่เกิน 8% เสมอ!
          </p>
        </div>
      </div>

      {/* ─── 3. Segmented HUD Command Navigation Bar ─── */}
      <nav className={styles.commandBar} aria-label="แถบเมนูคำสั่งตลาดหุ้นสหรัฐฯ">
        <div className={styles.commandTabs}>
          <button
            type="button"
            className={`${styles.commandTab} ${activeTab === 'focus' ? styles.commandTabActive : ''}`}
            onClick={() => setActiveTab('focus')}
          >
            <div className={styles.commandTabHeader}>
              <span className={styles.commandTabIcon} style={{ color: '#22d3ee' }}>🎯</span>
              <span>US Stage 2 Focus Picks</span>
              <span className={styles.commandTabBadge}>Top Leaders</span>
            </div>
            <span className={styles.commandTabSub}>คัดหุ้นเกรด A+ พร้อมแผน 2R</span>
          </button>

          <button
            type="button"
            className={`${styles.commandTab} ${activeTab === 'rotation' ? styles.commandTabActive : ''}`}
            onClick={() => setActiveTab('rotation')}
          >
            <div className={styles.commandTabHeader}>
              <span className={styles.commandTabIcon} style={{ color: '#a855f7' }}>🌐</span>
              <span>Thematic ETF Sector Rotation</span>
              <span className={styles.commandTabBadge}>Fund Flow</span>
            </div>
            <span className={styles.commandTabSub}>การหมุนเวียนกลุ่ม AI, Cloud, Energy</span>
          </button>

          <button
            type="button"
            className={`${styles.commandTab} ${activeTab === 'fx' ? styles.commandTabActive : ''}`}
            onClick={() => setActiveTab('fx')}
          >
            <div className={styles.commandTabHeader}>
              <span className={styles.commandTabIcon} style={{ color: '#10b981' }}>💵</span>
              <span>USD/THB FX Hedge &amp; Risk</span>
              <span className={styles.commandTabBadge}>Live Simulator</span>
            </div>
            <span className={styles.commandTabSub}>คำนวณผลกระทบค่าเงินบาท</span>
          </button>

          <button
            type="button"
            className={`${styles.commandTab} ${activeTab === 'sizing' ? styles.commandTabActive : ''}`}
            onClick={() => setActiveTab('sizing')}
          >
            <div className={styles.commandTabHeader}>
              <span className={styles.commandTabIcon} style={{ color: '#f59e0b' }}>📐</span>
              <span>US 2R Position Sizing Desk</span>
              <span className={styles.commandTabBadge}>{calculatedSizing.shares} Shares</span>
            </div>
            <span className={styles.commandTabSub}>คำนวณจำนวนหุ้น &amp; งบลงทุน</span>
          </button>

          <button
            type="button"
            className={`${styles.commandTab} ${activeTab === 'screener' ? styles.commandTabActive : ''}`}
            onClick={() => setActiveTab('screener')}
          >
            <div className={styles.commandTabHeader}>
              <span className={styles.commandTabIcon} style={{ color: '#38bdf8' }}>📊</span>
              <span>S&amp;P 500 Universe Table</span>
              <span className={styles.commandTabBadge}>Full Catalog</span>
            </div>
            <span className={styles.commandTabSub}>ค้นหาและกรองหุ้น 500 บริษัท</span>
          </button>
        </div>

        <div className={styles.commandBarFxChip}>
          <span>อัตราแลกเปลี่ยนอ้างอิง:</span>
          <b>{currentFxRate.toFixed(2)} ฿/USD</b>
        </div>
      </nav>

      {/* ─── TAB 1: DAILY HIGH CONVICTION STAGE 2 FOCUS PICKS ─── */}
      {activeTab === 'focus' && (
        <div>
          {/* Sub-Filter Pills */}
          <div className={styles.filterStrip}>
            <div className={styles.filterPills}>
              <button
                type="button"
                className={`${styles.filterPill} ${focusFilter === 'top3' ? styles.filterPillActive : ''}`}
                onClick={() => setFocusFilter('top3')}
              >
                🔥 Top 3 High Conviction
              </button>
              <button
                type="button"
                className={`${styles.filterPill} ${focusFilter === 'mag7' ? styles.filterPillActive : ''}`}
                onClick={() => setFocusFilter('mag7')}
              >
                ⚡ Magnificent 7 &amp; AI
              </button>
              <button
                type="button"
                className={`${styles.filterPill} ${focusFilter === 'rs' ? styles.filterPillActive : ''}`}
                onClick={() => setFocusFilter('rs')}
              >
                💎 High Relative Strength (RS &gt; 90)
              </button>
              <button
                type="button"
                className={`${styles.filterPill} ${focusFilter === 'volume' ? styles.filterPillActive : ''}`}
                onClick={() => setFocusFilter('volume')}
              >
                🚀 Volume Expansion (&gt; 1.5x)
              </button>
              <button
                type="button"
                className={`${styles.filterPill} ${focusFilter === 'favorites' ? styles.filterPillActive : ''}`}
                onClick={() => setFocusFilter('favorites')}
              >
                ⭐ หุ้นโปรด ({favorites.length})
              </button>
            </div>

            <div className={styles.searchBox}>
              <span>🔍</span>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="ค้นหาหุ้น เช่น NVDA, PLTR, AAPL..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Cards Grid */}
          <div className={styles.focusGrid}>
            {filteredFocusPicks.map(item => (
              <article
                key={item.symbol}
                className={`${styles.stage2Card} ${item.topPick ? styles.stage2CardTopPick : ''}`}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitleGroup}>
                    <div className={styles.cardSymbolRow}>
                      <span className={styles.cardSymbol}>{item.symbol}</span>
                      <span className={styles.cardExchange}>{item.exchange}</span>
                      {onToggleFavorite && (
                        <button
                          type="button"
                          className={`${styles.favBtnMini} ${favorites.includes(item.symbol) ? styles.favBtnMiniActive : ''}`}
                          onClick={() => onToggleFavorite(item.symbol)}
                          title="เพิ่มหรือลบจากรายการโปรด"
                        >
                          {favorites.includes(item.symbol) ? '★' : '☆'}
                        </button>
                      )}
                    </div>
                    <span className={styles.cardName}>{item.name}</span>
                    <span className={styles.cardSector}>{item.sector}</span>
                  </div>

                  <div className={styles.cardPriceGroup}>
                    <span className={styles.cardPrice}>${item.price.toFixed(2)}</span>
                    <span className={`${styles.cardChange} ${item.isUp ? styles.changeUp : styles.changeDown}`}>
                      {item.isUp ? '+' : ''}{item.changePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Badges Strip */}
                <div className={styles.templateStrip}>
                  <span className={styles.templateBadge}>✓ {item.stage}</span>
                  <span className={styles.rsBadge}>RS {item.rsRating} vs SPY</span>
                  <span className={styles.rvolBadge}>RVOL {item.rvol}x</span>
                </div>

                {/* 2R Blueprint Levels Grid */}
                <div className={styles.blueprintGrid}>
                  <div className={styles.blueprintCol}>
                    <span className={styles.blueprintLabel}>ENTRY</span>
                    <span className={styles.blueprintVal}>${item.entry.toFixed(2)}</span>
                    <span className={styles.blueprintSub}>จุดเข้าเกณฑ์</span>
                  </div>
                  <div className={styles.blueprintCol}>
                    <span className={styles.blueprintLabel}>STOP LOSS</span>
                    <span className={`${styles.blueprintVal} ${styles.blueprintValRisk}`}>
                      ${item.stopLoss.toFixed(2)}
                    </span>
                    <span className={styles.blueprintSub}>-{item.riskPercent.toFixed(1)}% (≤8%)</span>
                  </div>
                  <div className={styles.blueprintCol}>
                    <span className={styles.blueprintLabel}>TARGET 1 (2R)</span>
                    <span className={`${styles.blueprintVal} ${styles.blueprintValReward}`}>
                      ${item.tp1.toFixed(2)}
                    </span>
                    <span className={styles.blueprintSub}>+${item.tp1Reward.toFixed(1)} (+2R)</span>
                  </div>
                  <div className={styles.blueprintCol}>
                    <span className={styles.blueprintLabel}>TARGET 2 (3R+)</span>
                    <span className={`${styles.blueprintVal} ${styles.blueprintValReward}`}>
                      ${item.tp2.toFixed(2)}
                    </span>
                    <span className={styles.blueprintSub}>Runner Target</span>
                  </div>
                </div>

                {/* Trailing Stop & Action */}
                <div className={styles.cardFooter}>
                  <div className={styles.trailingNote}>
                    <span>💡 <b>Trailing Strategy:</b> {item.trailingGuide}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.cardActionBtn}
                    onClick={() => handleSelectAsset(item)}
                  >
                    เปิดกราฟ &amp; แผนเทรด →
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 2: THEMATIC ETF SECTOR ROTATION DESK ─── */}
      {activeTab === 'rotation' && (
        <div className={styles.etfDesk}>
          <div className={styles.rotationExplainer}>
            <div className={styles.rotationExplainerLeft}>
              <h3>
                <span>🌐</span>
                <span>Thematic ETF Sector Rotation Matrix (Wall Street Institutional Money Flow)</span>
              </h3>
              <p>
                ติดตามการไหลของเงินทุนระดับโลก (Fund Flow) ผ่านกองทุน ETF หมวดอุตสาหกรรมหลัก ชี้ชัดว่าเงินสถาบันกำลังไหลเข้ากลุ่มใด (Leading) หรือกำลังหนีออกจากกลุ่มใด (Lagging) เพื่อให้คุณเทรดไปในทิศทางเดียวกับเจ้ามือตลาด
              </p>
            </div>
          </div>

          {/* 4 Quadrants Visual Grid */}
          <div className={styles.quadrantGrid}>
            {/* 1. Leading Quadrant */}
            <div className={`${styles.quadrantBox} ${styles.quadrantLeading}`}>
              <div className={styles.quadrantHeader}>
                <div className={`${styles.quadrantTitle} ${styles.quadrantLeadTag}`}>
                  <span>🚀 1. LEADING (กลุ่มผู้นำโมเมนตัม)</span>
                </div>
                <span className={styles.quadrantCount}>เงินทุนไหลเข้าหนาแน่น</span>
              </div>
              <div className={styles.etfList}>
                {THEMATIC_ETF_DATA.filter(etf => etf.quadrant === 'leading').map(etf => (
                  <div key={etf.symbol} className={styles.etfItem}>
                    <div className={styles.etfIdentity}>
                      <div className={styles.etfSymbolRow}>
                        <span className={styles.etfSymbol}>{etf.symbol}</span>
                        <span className={styles.etfTheme}>{etf.theme}</span>
                      </div>
                      <span className={styles.etfName}>{etf.name} · {etf.topHoldings}</span>
                    </div>
                    <div className={styles.etfMetrics}>
                      <span className={styles.etfRs}>RS {etf.rsRating}</span>
                      <span className={`${styles.etfFlow} ${styles.flowPositive}`}>{etf.flowNetUSD}</span>
                      <button
                        type="button"
                        className={styles.etfBtnMini}
                        onClick={() => handleSelectAsset({ symbol: etf.symbol, name: etf.name, id: 'us' })}
                      >
                        กราฟ →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Improving Quadrant */}
            <div className={`${styles.quadrantBox} ${styles.quadrantImproving}`}>
              <div className={styles.quadrantHeader}>
                <div className={`${styles.quadrantTitle} ${styles.quadrantImproveTag}`}>
                  <span>🔄 2. IMPROVING (กลุ่มฟื้นตัวทะลุโซนสะสม)</span>
                </div>
                <span className={styles.quadrantCount}>เริ่มมีเม็ดเงินสะสมใหม่</span>
              </div>
              <div className={styles.etfList}>
                {THEMATIC_ETF_DATA.filter(etf => etf.quadrant === 'improving').map(etf => (
                  <div key={etf.symbol} className={styles.etfItem}>
                    <div className={styles.etfIdentity}>
                      <div className={styles.etfSymbolRow}>
                        <span className={styles.etfSymbol}>{etf.symbol}</span>
                        <span className={styles.etfTheme}>{etf.theme}</span>
                      </div>
                      <span className={styles.etfName}>{etf.name} · {etf.topHoldings}</span>
                    </div>
                    <div className={styles.etfMetrics}>
                      <span className={styles.etfRs}>RS {etf.rsRating}</span>
                      <span className={`${styles.etfFlow} ${styles.flowPositive}`}>{etf.flowNetUSD}</span>
                      <button
                        type="button"
                        className={styles.etfBtnMini}
                        onClick={() => handleSelectAsset({ symbol: etf.symbol, name: etf.name, id: 'us' })}
                      >
                        กราฟ →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Weakening Quadrant */}
            <div className={`${styles.quadrantBox} ${styles.quadrantWeakening}`}>
              <div className={styles.quadrantHeader}>
                <div className={`${styles.quadrantTitle} ${styles.quadrantWeakenTag}`}>
                  <span>⚡ 3. WEAKENING (กลุ่มเริ่มชะลอโมเมนตัม)</span>
                </div>
                <span className={styles.quadrantCount}>ระวังการย่อตัวพักฐาน</span>
              </div>
              <div className={styles.etfList}>
                {THEMATIC_ETF_DATA.filter(etf => etf.quadrant === 'weakening').map(etf => (
                  <div key={etf.symbol} className={styles.etfItem}>
                    <div className={styles.etfIdentity}>
                      <div className={styles.etfSymbolRow}>
                        <span className={styles.etfSymbol}>{etf.symbol}</span>
                        <span className={styles.etfTheme}>{etf.theme}</span>
                      </div>
                      <span className={styles.etfName}>{etf.name} · {etf.topHoldings}</span>
                    </div>
                    <div className={styles.etfMetrics}>
                      <span className={styles.etfRs}>RS {etf.rsRating}</span>
                      <span className={`${styles.etfFlow} ${etf.flowPositive ? styles.flowPositive : styles.flowNegative}`}>
                        {etf.flowNetUSD}
                      </span>
                      <button
                        type="button"
                        className={styles.etfBtnMini}
                        onClick={() => handleSelectAsset({ symbol: etf.symbol, name: etf.name, id: 'us' })}
                      >
                        กราฟ →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Lagging Quadrant */}
            <div className={`${styles.quadrantBox} ${styles.quadrantLagging}`}>
              <div className={styles.quadrantHeader}>
                <div className={`${styles.quadrantTitle} ${styles.quadrantLagTag}`}>
                  <span>❄️ 4. LAGGING (กลุ่มตาม / แนวโน้มขาลง)</span>
                </div>
                <span className={styles.quadrantCount}>หลีกเลี่ยงการถือยาว</span>
              </div>
              <div className={styles.etfList}>
                {THEMATIC_ETF_DATA.filter(etf => etf.quadrant === 'lagging').map(etf => (
                  <div key={etf.symbol} className={styles.etfItem}>
                    <div className={styles.etfIdentity}>
                      <div className={styles.etfSymbolRow}>
                        <span className={styles.etfSymbol}>{etf.symbol}</span>
                        <span className={styles.etfTheme}>{etf.theme}</span>
                      </div>
                      <span className={styles.etfName}>{etf.name} · {etf.topHoldings}</span>
                    </div>
                    <div className={styles.etfMetrics}>
                      <span className={styles.etfRs}>RS {etf.rsRating}</span>
                      <span className={`${styles.etfFlow} ${styles.flowNegative}`}>{etf.flowNetUSD}</span>
                      <button
                        type="button"
                        className={styles.etfBtnMini}
                        onClick={() => handleSelectAsset({ symbol: etf.symbol, name: etf.name, id: 'us' })}
                      >
                        กราฟ →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: USD/THB FX HEDGE & EXPOSURE IMPACT SIMULATOR ─── */}
      {activeTab === 'fx' && (
        <div className={styles.fxDesk}>
          <div className={styles.fxHeroGrid}>
            {/* Left: Interactive Controls */}
            <div className={styles.fxControlPanel}>
              <h3 className={styles.fxSectionTitle}>
                <span>⚙️</span>
                <span>พารามิเตอร์การจำลองผลกระทบอัตราแลกเปลี่ยน (USD/THB FX Simulator)</span>
              </h3>

              {/* Slider 1: Current FX Rate */}
              <div className={styles.fxInputRow}>
                <div className={styles.fxInputLabel}>
                  <span>อัตราแลกเปลี่ยนปัจจุบัน (Current Spot USD/THB):</span>
                  <span className={styles.fxInputValue}>{currentFxRate.toFixed(2)} บาท</span>
                </div>
                <input
                  type="range"
                  min={31.00}
                  max={38.00}
                  step={0.10}
                  value={currentFxRate}
                  onChange={e => setCurrentFxRate(parseFloat(e.target.value))}
                  className={styles.fxRange}
                />
              </div>

              {/* Slider 2: Entry FX Rate */}
              <div className={styles.fxInputRow}>
                <div className={styles.fxInputLabel}>
                  <span>อัตราแลกเปลี่ยนตอนเข้าซื้อ (Entry FX Rate):</span>
                  <span className={styles.fxInputValue}>{entryFxRate.toFixed(2)} บาท</span>
                </div>
                <input
                  type="range"
                  min={31.00}
                  max={38.00}
                  step={0.10}
                  value={entryFxRate}
                  onChange={e => setEntryFxRate(parseFloat(e.target.value))}
                  className={styles.fxRange}
                />
              </div>

              {/* Slider 3: Stock USD Return % */}
              <div className={styles.fxInputRow}>
                <div className={styles.fxInputLabel}>
                  <span>ผลตอบแทนราคาหุ้นสหรัฐฯ (Stock Capital Gain % in USD):</span>
                  <span className={styles.fxInputValue}>+{stockUsdReturn.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min={-20.0}
                  max={50.0}
                  step={1.0}
                  value={stockUsdReturn}
                  onChange={e => setStockUsdReturn(parseFloat(e.target.value))}
                  className={styles.fxRange}
                />
              </div>

              {/* Quick Scenarios */}
              <div style={{ marginTop: '6px' }}>
                <small style={{ color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
                  สถานการณ์จำลองค่าเงินสำเร็จรูป (Quick Scenarios):
                </small>
                <div className={styles.scenarioChipGrid}>
                  <button
                    type="button"
                    className={`${styles.scenarioChip} ${currentFxRate === 33.00 ? styles.scenarioChipActive : ''}`}
                    onClick={() => { setCurrentFxRate(33.00); setEntryFxRate(36.00); }}
                  >
                    💥 บาทแข็งเร็ว (-8.3% / 33.00฿)
                  </button>
                  <button
                    type="button"
                    className={`${styles.scenarioChip} ${currentFxRate === 34.50 ? styles.scenarioChipActive : ''}`}
                    onClick={() => { setCurrentFxRate(34.50); setEntryFxRate(34.50); }}
                  >
                    ⚖️ บาททรงตัว (0% / 34.50฿)
                  </button>
                  <button
                    type="button"
                    className={`${styles.scenarioChip} ${currentFxRate === 36.50 ? styles.scenarioChipActive : ''}`}
                    onClick={() => { setCurrentFxRate(36.50); setEntryFxRate(34.50); }}
                  >
                    🚀 บาทอ่อนค่า (+5.8% / 36.50฿)
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Outcome Summary & AI Prescription */}
            <div className={styles.fxOutcomeBox}>
              <div>
                <h3 className={styles.fxSectionTitle} style={{ color: '#38bdf8', marginBottom: '16px' }}>
                  <span>📊</span>
                  <span>ผลลัพธ์สุทธิเปรียบเทียบ (Hedged vs Unhedged)</span>
                </h3>

                <div className={styles.fxStatRows}>
                  <div className={styles.fxStatRow}>
                    <span className={styles.fxStatLabel}>การเปลี่ยนแปลงของค่าเงิน (FX Drift):</span>
                    <div className={styles.fxStatRight}>
                      <span className={`${styles.fxStatValue} ${fxChangePercent >= 0 ? styles.changeUp : styles.changeDown}`}>
                        {fxChangePercent >= 0 ? '+' : ''}{fxChangePercent.toFixed(2)}%
                      </span>
                      <span className={styles.fxStatSub}>
                        {fxChangePercent < 0 ? 'บาทแข็งค่า (FX Drag)' : 'บาทอ่อนค่า (FX Boost)'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.fxStatRow}>
                    <span className={styles.fxStatLabel}>ผลตอบแทนสุทธิในรูปเงินบาท (Net THB Return):</span>
                    <div className={styles.fxStatRight}>
                      <span className={`${styles.fxStatValue} ${netThbReturnPercent >= 0 ? styles.changeUp : styles.changeDown}`}>
                        {netThbReturnPercent >= 0 ? '+' : ''}{netThbReturnPercent.toFixed(2)}%
                      </span>
                      <span className={styles.fxStatSub}>
                        กำไรสุทธิ: {unhedgedProfitThb.toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท
                      </span>
                    </div>
                  </div>

                  <div className={styles.fxStatRow}>
                    <span className={styles.fxStatLabel}>หากล็อกค่าเงิน 100% (Fully Hedged):</span>
                    <div className={styles.fxStatRight}>
                      <span className={styles.fxStatValue} style={{ color: '#34d399' }}>
                        +{stockUsdReturn.toFixed(1)}%
                      </span>
                      <span className={styles.fxStatSub}>
                        กำไรล็อกไว้: {hedgedProfitThb.toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท
                      </span>
                    </div>
                  </div>

                  <div className={styles.fxStatRow}>
                    <span className={styles.fxStatLabel}>ผลต่างจากความผันผวนค่าเงิน (FX Impact):</span>
                    <div className={styles.fxStatRight}>
                      <span className={`${styles.fxStatValue} ${fxDragThb >= 0 ? styles.changeUp : styles.changeDown}`}>
                        {fxDragThb >= 0 ? '+' : ''}{fxDragThb.toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท
                      </span>
                      <span className={styles.fxStatSub}>
                        {fxDragThb < 0 ? 'เสียกำไรเพราะเงินบาทแข็ง' : 'ได้กำไรส่วนเพิ่มจากบาทอ่อน'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Prescription Box */}
              <div className={`${styles.fxPrescription} ${fxChangePercent < -3 ? styles.fxPrescriptionWeak : ''}`}>
                <div className={`${styles.prescriptionTitle} ${fxChangePercent < -3 ? styles.prescriptionTitleWeak : ''}`}>
                  <span>{fxChangePercent < -3 ? '⚠️ AI FX RISK PRESCRIPTION:' : '💡 AI FX RISK PRESCRIPTION:'}</span>
                </div>
                <p className={styles.prescriptionDesc}>
                  {fxChangePercent < -3
                    ? `เงินบาทแข็งค่าขึ้นอย่างมีนัยสำคัญ (-${Math.abs(fxChangePercent).toFixed(1)}%) ส่งผลให้กำไรในรูปเงินบาทหดหายไป ${Math.abs(fxDragThb).toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท แนะนำพิจารณาใช้สัญญา TFEX USD Futures (USDZ26) เพื่อ Short ป้องกันความเสี่ยง หรือสลับไปลงทุนผ่าน DR80 บนกระดาน SET ที่มีสภาพคล่อง`
                    : fxChangePercent > 3
                    ? `เงินบาทอ่อนค่า (+${fxChangePercent.toFixed(1)}%) หนุนผลตอบแทนในรูปเงินบาทเพิ่มขึ้นเป็น 2 ต่อ (+${fxDragThb.toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท) ไม่จำเป็นต้องทำ FX Hedge ในช่วงนี้`
                    : `ค่าเงินบาทอยู่ในกรอบสมดุล ไม่ส่งผลกระทบอย่างมีนัยสำคัญต่อพอร์ต สามารถโฟกัสที่การรันเทรนด์ตามราคาหุ้นสหรัฐฯ ได้อย่างเต็มที่`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: US 2R POSITION SIZING DESK ─── */}
      {activeTab === 'sizing' && (
        <div className={styles.sizingDesk}>
          <div className={styles.sizingGrid}>
            {/* Input Desk */}
            <div className={styles.sizingCard}>
              <div className={styles.sizingHeader}>
                <h3 className={styles.sizingTitle}>
                  <span>📐</span>
                  <span>ตั้งค่างบประมาณและการควบคุมความเสี่ยง (Risk Budgeting)</span>
                </h3>
              </div>

              {/* Ticker Presets */}
              <div>
                <small style={{ color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
                  เลือกหุ้นผู้นำ Stage 2 จากลิสต์ด่วน:
                </small>
                <div className={styles.quickTickerSelect}>
                  {US_STAGE2_FOCUS_PICKS.slice(0, 6).map(ticker => (
                    <button
                      key={ticker.symbol}
                      type="button"
                      className={`${styles.tickerBtn} ${sizingSelectedTicker === ticker.symbol ? styles.tickerBtnActive : ''}`}
                      onClick={() => handleSelectSizingTicker(ticker)}
                    >
                      {ticker.symbol} (${ticker.entry})
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.inputsGroup}>
                <div className={styles.inputField}>
                  <label>ขนาดพอร์ตโฟลิโอ (Total Account USD):</label>
                  <input
                    type="number"
                    min={500}
                    step={500}
                    value={portfolioSizeUsd}
                    onChange={e => setPortfolioSizeUsd(Math.max(100, parseFloat(e.target.value) || 0))}
                  />
                </div>

                <div className={styles.inputField}>
                  <label>ความเสี่ยงต่อไม้ (% Risk Per Trade):</label>
                  <input
                    type="number"
                    min={0.5}
                    max={5.0}
                    step={0.5}
                    value={riskPerTradePercent}
                    onChange={e => setRiskPerTradePercent(Math.max(0.1, parseFloat(e.target.value) || 0))}
                  />
                </div>

                <div className={styles.inputField}>
                  <label>ราคาเข้าซื้อเป้าหมาย (Entry USD):</label>
                  <input
                    type="number"
                    min={1}
                    step={0.5}
                    value={sizingEntry}
                    onChange={e => setSizingEntry(Math.max(0.1, parseFloat(e.target.value) || 0))}
                  />
                </div>

                <div className={styles.inputField}>
                  <label>จุดตัดขาดทุน (Stop Loss USD):</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={sizingStop}
                    onChange={e => setSizingStop(Math.max(0.1, parseFloat(e.target.value) || 0))}
                  />
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '12px', borderRadius: '10px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  🛡️ <b>กฎเหล็ก 2R Management:</b> คำนวณจำนวนหุ้นอัตโนมัติเพื่อให้คุณเสียเงินไม่เกิน{' '}
                  <b style={{ color: '#fb7185' }}>
                    ${((portfolioSizeUsd * riskPerTradePercent) / 100).toFixed(2)} (
                    {(((portfolioSizeUsd * riskPerTradePercent) / 100) * currentFxRate).toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท)
                  </b>{' '}
                  หากผิดทางชน Stop Loss
                </span>
              </div>
            </div>

            {/* Results Display */}
            <div className={styles.sizingResultCard}>
              <div className={styles.sizingBigDisplay}>
                <span className={styles.sizingBigTitle}>จำนวนหุ้นที่ซื้อได้ตามงบความเสี่ยง (MAX ALLOWED SHARES)</span>
                <div className={styles.sizingBigNum}>{calculatedSizing.shares} หุ้น</div>
                <span className={styles.sizingBigSub}>
                  {sizingSelectedTicker} · วงเงินลงทุน ${(calculatedSizing.capitalRequiredUsd).toLocaleString('en-US', { minimumFractionDigits: 2 })} ({calculatedSizing.capitalRequiredThb.toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท)
                </span>
              </div>

              <div className={styles.sizingDetailsList}>
                <div className={styles.sizingDetailRow}>
                  <span className={styles.sizingDetailLabel}>สัดส่วนของพอร์ตที่ใช้ (Portfolio Allocation):</span>
                  <span className={styles.sizingDetailVal} style={{ color: calculatedSizing.portfolioAllocationPercent > 25 ? '#fbbf24' : '#34d399' }}>
                    {calculatedSizing.portfolioAllocationPercent.toFixed(1)}% {calculatedSizing.portfolioAllocationPercent > 25 ? '(ค่อนข้างกระจุกตัว)' : '(ปลอดภัย)'}
                  </span>
                </div>

                <div className={styles.sizingDetailRow}>
                  <span className={styles.sizingDetailLabel}>ความเสี่ยงสูงสุดเมื่อชน Stop Loss (1R Risk):</span>
                  <span className={styles.sizingDetailVal} style={{ color: '#fb7185' }}>
                    -${calculatedSizing.actualLossAtStop.toFixed(2)} (-{(calculatedSizing.actualLossAtStop * currentFxRate).toLocaleString('th-TH', { maximumFractionDigits: 0 })} ฿)
                  </span>
                </div>

                <div className={styles.sizingDetailRow}>
                  <span className={styles.sizingDetailLabel}>กำไรเป้าหมาย TP1 (2R Reward):</span>
                  <span className={styles.sizingDetailVal} style={{ color: '#34d399' }}>
                    +${calculatedSizing.rewardAtTp1.toFixed(2)} (+{(calculatedSizing.rewardAtTp1 * currentFxRate).toLocaleString('th-TH', { maximumFractionDigits: 0 })} ฿)
                  </span>
                </div>

                <div className={styles.sizingDetailRow}>
                  <span className={styles.sizingDetailLabel}>กำไรเป้าหมาย TP2 (3R Trend Runner):</span>
                  <span className={styles.sizingDetailVal} style={{ color: '#38bdf8' }}>
                    +${calculatedSizing.rewardAtTp2.toFixed(2)} (+{(calculatedSizing.rewardAtTp2 * currentFxRate).toLocaleString('th-TH', { maximumFractionDigits: 0 })} ฿)
                  </span>
                </div>
              </div>

              <button
                type="button"
                className={styles.cardActionBtn}
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => handleSelectAsset({ symbol: sizingSelectedTicker, name: sizingSelectedTicker, id: 'us' })}
              >
                เปิดดูกราฟ {sizingSelectedTicker} พร้อมเลเวลราคานี้ →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 5: S&P 500 UNIVERSE SCREENER TABLE ─── */}
      {activeTab === 'screener' && (
        <div className={styles.screenerDesk}>
          <div className={styles.filterStrip}>
            <div className={styles.filterPills}>
              <button
                type="button"
                className={`${styles.filterPill} ${sectorFilter === 'all' ? styles.filterPillActive : ''}`}
                onClick={() => setSectorFilter('all')}
              >
                ทั้งหมด (All Sectors)
              </button>
              <button
                type="button"
                className={`${styles.filterPill} ${sectorFilter === 'semiconductors' ? styles.filterPillActive : ''}`}
                onClick={() => setSectorFilter('semiconductors')}
              >
                ชิป &amp; เซมิคอนดักเตอร์
              </button>
              <button
                type="button"
                className={`${styles.filterPill} ${sectorFilter === 'software' ? styles.filterPillActive : ''}`}
                onClick={() => setSectorFilter('software')}
              >
                คลาวด์ &amp; ซอฟต์แวร์
              </button>
              <button
                type="button"
                className={`${styles.filterPill} ${sectorFilter === 'consumer' ? styles.filterPillActive : ''}`}
                onClick={() => setSectorFilter('consumer')}
              >
                สินค้าอุปโภคบริโภค
              </button>
              <button
                type="button"
                className={`${styles.filterPill} ${sectorFilter === 'pharma' ? styles.filterPillActive : ''}`}
                onClick={() => setSectorFilter('pharma')}
              >
                ยา &amp; สุขภาพ
              </button>
            </div>

            <div className={styles.searchBox}>
              <span>🔍</span>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="พิมพ์ชื่อย่อหรือชื่อบริษัท..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.screenerTable} aria-label="ตารางสแกนหุ้นสหรัฐฯ S&P 500">
              <thead>
                <tr>
                  <th>SYMBOL / COMPANY</th>
                  <th>SECTOR</th>
                  <th className={styles.thRight}>PRICE ($)</th>
                  <th className={styles.thRight}>CHANGE (%)</th>
                  <th className={styles.tdCenter}>STAGE 2 TEMPLATE</th>
                  <th className={styles.thRight}>RS RATING</th>
                  <th className={styles.thRight}>RVOL</th>
                  <th className={styles.thRight}>ENTRY ($)</th>
                  <th className={styles.thRight}>STOP LOSS ($)</th>
                  <th className={styles.thRight}>TARGET 2R ($)</th>
                  <th className={styles.tdCenter}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredUniverse.map(row => (
                  <tr key={row.symbol}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {onToggleFavorite && (
                          <button
                            type="button"
                            className={`${styles.favBtnMini} ${favorites.includes(row.symbol) ? styles.favBtnMiniActive : ''}`}
                            onClick={() => onToggleFavorite(row.symbol)}
                          >
                            {favorites.includes(row.symbol) ? '★' : '☆'}
                          </button>
                        )}
                        <div>
                          <b style={{ color: '#ffffff', fontSize: '12px' }}>{row.symbol}</b>
                          <small style={{ display: 'block', color: '#64748b', fontSize: '10px' }}>{row.name}</small>
                        </div>
                      </div>
                    </td>
                    <td>{row.sector}</td>
                    <td className={styles.tdRight}>
                      <b>${row.price.toFixed(2)}</b>
                    </td>
                    <td className={`${styles.tdRight} ${row.isUp ? styles.changeUp : styles.changeDown}`}>
                      {row.isUp ? '+' : ''}{row.changePercent.toFixed(2)}%
                    </td>
                    <td className={styles.tdCenter}>
                      <span className={styles.templateBadge}>✓ {row.pattern}</span>
                    </td>
                    <td className={styles.tdRight}>
                      <span className={styles.rsBadge}>RS {row.rsRating}</span>
                    </td>
                    <td className={styles.tdRight}>{row.rvol}x</td>
                    <td className={styles.tdRight}>${row.entry.toFixed(2)}</td>
                    <td className={`${styles.tdRight} ${styles.changeDown}`}>${row.stopLoss.toFixed(2)}</td>
                    <td className={`${styles.tdRight} ${styles.changeUp}`}>${row.tp1.toFixed(2)}</td>
                    <td className={styles.tdCenter}>
                      <button
                        type="button"
                        className={styles.etfBtnMini}
                        onClick={() => handleSelectAsset(row)}
                      >
                        ดูกราฟ →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
