'use client';

import React, { useState, useMemo } from 'react';
import { useDeskResource } from '../use-desk-resource.jsx';
import { buildTfexContracts } from '../../markets/tfex-contracts.mjs';
const valueText=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('th-TH',{maximumFractionDigits:d}):'—';
import styles from './tfex-terminal.module.css';

// ─── TFEX PRODUCT MASTER DATA ───
export const TFEX_SPECS = {
  S50: {
    symbol: 'S50Z26',
    root: 'S50',
    name: 'SET50 Index Futures',
    multiplier: 200,
    unit: 'จุดดัชนี',
    tickSize: 0.1,
    tickValueTHB: 20,
    im: 10850,
    mm: 7595,
    fm: 3255,
    spotPrice: 892.8,
    futuresPrice: 894.2,
    basis: 1.4,
    change: '+3.40',
    changePercent: '+0.38%',
    isUp: true,
  },
  GO: {
    symbol: 'GOZ26',
    root: 'GO',
    name: 'Gold Online Futures',
    multiplier: 300,
    unit: 'USD / oz',
    tickSize: 0.1,
    tickValueTHB: 30,
    im: 31500,
    mm: 22050,
    fm: 9450,
    spotPrice: 2652.8,
    futuresPrice: 2654.5,
    basis: 1.7,
    change: '+12.50',
    changePercent: '+0.47%',
    isUp: true,
  },
  SVF: {
    symbol: 'SVFZ26',
    root: 'SVF',
    name: 'Silver Online Futures',
    multiplier: 3000,
    unit: 'USD / oz',
    tickSize: 0.01,
    tickValueTHB: 30,
    im: 26250,
    mm: 18375,
    fm: 7875,
    spotPrice: 31.78,
    futuresPrice: 31.85,
    basis: 0.07,
    change: '-0.24',
    changePercent: '-0.75%',
    isUp: false,
  },
  USD: {
    symbol: 'USDZ26',
    root: 'USD',
    name: 'USD Futures',
    multiplier: 1000,
    unit: 'THB / USD',
    tickSize: 0.01,
    tickValueTHB: 10,
    im: 1050,
    mm: 735,
    fm: 315,
    spotPrice: 33.60,
    futuresPrice: 33.62,
    basis: 0.02,
    change: '-0.05',
    changePercent: '-0.15%',
    isUp: false,
  },
};

// ─── OPTIONS CHAIN STRIKES DATA (ATM ~ 890 - 900) ───
const OPTIONS_STRIKES_DATA = [
  { strike: 840, callPrice: 54.8, callBid: 54.2, callAsk: 55.4, callOi: 2450, callVol: 310, callIv: 13.5, putPrice: 1.2, putBid: 1.1, putAsk: 1.3, putOi: 8900, putVol: 1420, putIv: 18.2 },
  { strike: 850, callPrice: 45.2, callBid: 44.8, callAsk: 45.6, callOi: 3120, callVol: 450, callIv: 13.8, putPrice: 1.8, putBid: 1.7, putAsk: 1.9, putOi: 7850, putVol: 1200, putIv: 17.5 },
  { strike: 860, callPrice: 36.1, callBid: 35.7, callAsk: 36.5, callOi: 4200, callVol: 680, callIv: 14.0, putPrice: 2.7, putBid: 2.6, putAsk: 2.8, putOi: 6920, putVol: 980, putIv: 16.9 },
  { strike: 870, callPrice: 27.5, callBid: 27.2, callAsk: 27.8, callOi: 5400, callVol: 920, callIv: 14.2, putPrice: 4.1, putBid: 4.0, putAsk: 4.2, putOi: 6410, putVol: 1150, putIv: 16.2 },
  { strike: 880, callPrice: 19.8, callBid: 19.5, callAsk: 20.1, callOi: 6800, callVol: 1240, callIv: 14.5, putPrice: 6.4, putBid: 6.2, putAsk: 6.6, putOi: 5890, putVol: 1380, putIv: 15.6 },
  { strike: 890, callPrice: 13.2, callBid: 13.0, callAsk: 13.4, callOi: 8250, callVol: 2450, callIv: 14.8, putPrice: 9.8, putBid: 9.6, putAsk: 10.0, putOi: 7120, putVol: 2100, putIv: 15.1, isAtm: true },
  { strike: 900, callPrice: 7.9, callBid: 7.7, callAsk: 8.1, callOi: 9600, callVol: 2890, callIv: 15.2, putPrice: 14.5, putBid: 14.2, putAsk: 14.8, putOi: 5210, putVol: 1450, putIv: 14.7, isMaxPain: true },
  { strike: 910, callPrice: 4.2, callBid: 4.0, callAsk: 4.4, callOi: 7420, callVol: 1820, callIv: 15.7, putPrice: 20.8, putBid: 20.5, putAsk: 21.1, putOi: 3840, putVol: 820, putIv: 14.3 },
  { strike: 920, callPrice: 2.1, callBid: 2.0, callAsk: 2.2, callOi: 5800, callVol: 940, callIv: 16.3, putPrice: 28.7, putBid: 28.3, putAsk: 29.1, putOi: 2450, putVol: 410, putIv: 14.0 },
  { strike: 930, callPrice: 1.1, callBid: 1.0, callAsk: 1.2, callOi: 4200, callVol: 460, callIv: 17.1, putPrice: 37.9, putBid: 37.4, putAsk: 38.4, putOi: 1680, putVol: 220, putIv: 13.7 },
  { strike: 940, callPrice: 0.6, callBid: 0.5, callAsk: 0.7, callOi: 3100, callVol: 210, callIv: 18.0, putPrice: 47.4, putBid: 46.8, putAsk: 48.0, putOi: 1120, putVol: 110, putIv: 13.5 },
];

export const BROKER_OPTIONS = [
  { id: '022', name: 'Trinity Securities', thaiName: 'บล.ทรีนีตี้', popular: true, tag: 'RECOMMENDED' },
  { id: '003', name: 'Pi Securities', thaiName: 'บล.พาย (มหาชน)', popular: true, tag: 'POPULAR' },
  { id: '032', name: 'InnovestX Securities', thaiName: 'บล.อินโนเวสท์ เอกซ์', popular: true, tag: 'POPULAR' },
  { id: '011', name: 'Maybank Securities', thaiName: 'บล.เมย์แบงก์ (ไทย)', popular: true, tag: 'POPULAR' },
  { id: '025', name: 'CGS International', thaiName: 'บล.ซีจีเอส อินเตอร์เนชั่นแนล', popular: true, tag: 'ACTIVE' },
  { id: '001', name: 'Bualuang Securities', thaiName: 'บล.บัวหลวง', popular: false, tag: 'SUPPORTED' },
  { id: '006', name: 'Kiatnakin Phatra', thaiName: 'บล.เกียรตินาคินภัทร', popular: false, tag: 'SUPPORTED' },
  { id: '028', name: 'Globlex Securities', thaiName: 'บล.โกลเบล็ก', popular: false, tag: 'SUPPORTED' },
  { id: '098', name: 'Settrade Sandbox', thaiName: 'ระบบทดสอบ Sandbox', popular: false, tag: 'TESTNET' },
];

const PRODUCT_DEFAULTS=TFEX_SPECS;
export default function TfexTerminal({ selectedSymbol = 'S50Z26', onSelect }) {
  const contracts=useMemo(()=>buildTfexContracts(),[]);
  const quoteSymbols=Object.keys(PRODUCT_DEFAULTS).map(root=>contracts.find(c=>c.root===root&&c.symbol===selectedSymbol)?.symbol||contracts.find(c=>c.root===root)?.symbol).filter(Boolean);
  const quoteFeed=useDeskResource('/api/tfex/quotes?symbols='+quoteSymbols.join(','),{interval:45000});
  const optionSeries=contracts.find(c=>c.root==='S50'&&c.symbol===selectedSymbol)?.symbol||contracts.find(c=>c.root==='S50')?.symbol;
  const chainFeed=useDeskResource('/api/tfex/options?series='+optionSeries);
  const TFEX_SPECS=Object.fromEntries(Object.entries(PRODUCT_DEFAULTS).map(([root,spec])=>{
    const symbol=quoteSymbols.find(symbol=>symbol.startsWith(root)),quote=quoteFeed.data?.quotes?.find(q=>q.symbol===symbol);
    return [root,{...spec,symbol:symbol||spec.symbol,futuresPrice:quote?.price??NaN,spotPrice:root==='S50'?(quoteFeed.data?.underlying?.price??NaN):NaN,basis:root==='S50'&&quote?.price>0&&quoteFeed.data?.underlying?.price>0?quote.price-quoteFeed.data.underlying.price:NaN,volume:quote?.volume??null,openInterest:quote?.openInterest??null,
      change:quote?.change===null||!quote? '—':(quote.change>=0?'+':'')+valueText(quote.change),
      changePercent:quote?.changePercent===null||!quote?'—':valueText(quote.changePercent)+'%',isUp:quote?.change>=0}];
  }));
  const OPTIONS_STRIKES_DATA=chainFeed.data?.rows||[];

  const [activeTab, setActiveTab] = useState('options'); // 'options' | 'futures' | 'margin' | 'sizing'
  const [optionsFilter, setOptionsFilter] = useState('atm'); // 'atm' | 'all' | 'highOi'
  const [selectedStrategy, setSelectedStrategy] = useState(null);

  // Margin Shield State (Single Asset)
  const [marginEquity, setMarginEquity] = useState(200000);
  const [marginProduct, setMarginProduct] = useState('S50');
  const [marginContracts, setMarginContracts] = useState(5);
  const [marginSide, setMarginSide] = useState('LONG');
  const [marginEntry, setMarginEntry] = useState(894.2);

  // ─── TFEX WHAT-IF SIMULATOR STATE (Multi-Asset Portfolio Stress Testing) ───
  const [riskSubMode, setRiskSubMode] = useState('whatif'); // 'whatif' | 'single'
  const [whatIfEquity, setWhatIfEquity] = useState(300000);
  const [whatIfS50Side, setWhatIfS50Side] = useState('LONG');
  const [whatIfS50Contracts, setWhatIfS50Contracts] = useState(5);
  const [whatIfGoSide, setWhatIfGoSide] = useState('LONG');
  const [whatIfGoContracts, setWhatIfGoContracts] = useState(2);
  const [whatIfS50Shock, setWhatIfS50Shock] = useState(-15); // -15 points shock
  const [whatIfGoShock, setWhatIfGoShock] = useState(-20); // -20 USD shock

  // 2R Sizing State
  const [sizingCapital, setSizingCapital] = useState(300000);
  const [sizingRiskPct, setSizingRiskPct] = useState(2);
  const [sizingSlPoints, setSizingSlPoints] = useState(5.0);

  // Current product spec for single margin desk
  const currentSpec = TFEX_SPECS[marginProduct] || TFEX_SPECS.S50;

  // Single margin calculations
  const totalIm = marginContracts * currentSpec.im;
  const totalMm = marginContracts * currentSpec.mm;
  const totalFm = marginContracts * currentSpec.fm;
  const marginUsagePct = ((totalIm / marginEquity) * 100).toFixed(1);

  // Buffer in points
  const pointsToCall = marginContracts > 0
    ? Math.max(0, (marginEquity - totalMm) / (marginContracts * currentSpec.multiplier))
    : 0;

  const pointsToForce = marginContracts > 0
    ? Math.max(0, (marginEquity - totalFm) / (marginContracts * currentSpec.multiplier))
    : 0;

  const callPriceTrigger = marginSide === 'LONG'
    ? (marginEntry - pointsToCall).toFixed(2)
    : (marginEntry + pointsToCall).toFixed(2);

  const forcePriceTrigger = marginSide === 'LONG'
    ? (marginEntry - pointsToForce).toFixed(2)
    : (marginEntry + pointsToForce).toFixed(2);

  const isDangerousLeverage = pointsToCall < 30 || Number(marginUsagePct) > 75;
  const isModerateLeverage = pointsToCall >= 30 && pointsToCall < 70;

  // ─── What-If Multi-Asset Stress Calculations ───
  const simS50PointDiff = whatIfS50Side === 'LONG' ? whatIfS50Shock : -whatIfS50Shock;
  const simS50Pl = simS50PointDiff * whatIfS50Contracts * TFEX_SPECS.S50.multiplier;

  const simGoPointDiff = whatIfGoSide === 'LONG' ? whatIfGoShock : -whatIfGoShock;
  const simGoPl = simGoPointDiff * whatIfGoContracts * TFEX_SPECS.GO.multiplier;

  const simTotalPl = simS50Pl + simGoPl;
  const simNewEquity = Math.max(0, whatIfEquity + simTotalPl);

  const whatIfTotalIm = (whatIfS50Contracts * TFEX_SPECS.S50.im) + (whatIfGoContracts * TFEX_SPECS.GO.im);
  const whatIfTotalMm = (whatIfS50Contracts * TFEX_SPECS.S50.mm) + (whatIfGoContracts * TFEX_SPECS.GO.mm);
  const whatIfTotalFm = (whatIfS50Contracts * TFEX_SPECS.S50.fm) + (whatIfGoContracts * TFEX_SPECS.GO.fm);

  const whatIfMarginUsagePct = simNewEquity > 0 ? ((whatIfTotalIm / simNewEquity) * 100).toFixed(1) : '999';
  const whatIfBufferToCall = simNewEquity - whatIfTotalMm;
  const whatIfBufferToForce = simNewEquity - whatIfTotalFm;
  const isWhatIfCallTriggered = simNewEquity < whatIfTotalMm;
  const isWhatIfForceTriggered = simNewEquity < whatIfTotalFm;

  let deRiskAdvice = '';
  if (isWhatIfCallTriggered) {
    const deficit = Math.abs(whatIfBufferToCall);
    const s50ToTrim = Math.min(whatIfS50Contracts, Math.ceil(deficit / (TFEX_SPECS.S50.im * 0.7)));
    deRiskAdvice = `🚨 วิกฤต! พอร์ตจะโดน MARGIN CALL ทันที (เงินประกันขาด ${deficit.toLocaleString('en-US')} บาท) แนะนำปิด Long S50 ลงอย่างน้อย ${s50ToTrim} สัญญา หรือปิด GO 1 สัญญา เพื่อหยุดการขาดทุนและหลุดพ้นจากระดับ Margin Call ทันที!`;
  } else if (Number(whatIfMarginUsagePct) > 65) {
    deRiskAdvice = `⚠️ ความเสี่ยงเริ่มตึงตัว (Margin Usage ${whatIfMarginUsagePct}%): หากตลาดกระแทกตามสมมติฐานนี้ แนะนำ 'ลดสถานะ S50 ลง 2 สัญญา' (คืนเงินประกัน 21,700฿) หรือ 'ปิด GO 1 สัญญา' (คืนเงินประกัน 31,500฿) เพื่อดึง Margin Usage กลับมาต่ำกว่า 50% ให้ปลอดภัยต่อการเปิดกระโดด Gap ข้ามคืน!`;
  } else {
    deRiskAdvice = `✓ พอร์ตมีความปลอดภัยสูง: เงินทุนสำรองคงเหลือ ${Math.max(0, simNewEquity - whatIfTotalIm).toLocaleString('en-US')} บาท ยังรองรับการย่อตัวของ SET50 (${whatIfS50Shock >= 0 ? '+' : ''}${whatIfS50Shock} จุด) และทองคำ (${whatIfGoShock >= 0 ? '+' : ''}${whatIfGoShock}$) ได้โดยไม่โดน Margin Call`;
  }

  // Sizing calculations
  const maxRiskTHB = (sizingCapital * (sizingRiskPct / 100));
  const riskPerContractTHB = sizingSlPoints * currentSpec.multiplier;
  const calculatedContracts = riskPerContractTHB > 0 ? Math.floor(maxRiskTHB / riskPerContractTHB) : 0;
  const sizingImRequired = calculatedContracts * currentSpec.im;
  const sizingImOk = sizingImRequired <= sizingCapital;

  // Filtered options strikes
  const filteredStrikes = useMemo(() => {
    if (optionsFilter === 'atm') {
      return OPTIONS_STRIKES_DATA.filter(s => Math.abs(s.strike-(chainFeed.data?.underlyingPrice??NaN))<=25);
    }
    if (optionsFilter === 'highOi') {
      return OPTIONS_STRIKES_DATA.filter(s => s.callOi >= 6000 || s.putOi >= 6000);
    }
    return OPTIONS_STRIKES_DATA;
  }, [optionsFilter, chainFeed.data]);

  // Options sentiment metrics
  const totalCallOi = chainFeed.data?.summary?.totalCallOi??NaN;
  const totalPutOi = chainFeed.data?.summary?.totalPutOi??NaN;
  const pcrRatio = valueText(chainFeed.data?.summary?.pcr);
  const maxPainStrike = chainFeed.data?.summary?.maxPain??NaN;
  const spotDistanceToMaxPain = valueText(maxPainStrike-(chainFeed.data?.underlyingPrice??NaN),1);

  return (
    <section className={styles.terminal} aria-label="TFEX and SET50 Options Terminal">
      <div role="status" className={styles.optionsToolbar}>
        <span>{quoteFeed.busy?'กำลังโหลดราคา TFEX…':quoteFeed.error?'โหลดราคาไม่ได้: '+quoteFeed.error:'TFEX Open API · ได้รับ '+(quoteFeed.data?.receivedAt||'รอข้อมูล')+' · ดูเวลาอ้างอิงจากผู้ให้บริการ'}</span>
        <button type="button" onClick={()=>{quoteFeed.reload();chainFeed.reload();}}>โหลดราคาล่าสุด</button>
      </div>
      {chainFeed.error&&<p role="alert">Options Chain: {chainFeed.error}</p>}
      {/* ─── Header & Contract Selector ─── */}
      <div className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            TFEX &amp; SET50 OPTIONS PRO TERMINAL
          </div>
          <h2 className={styles.title}>
            <span>⚡ ศูนย์บัญชาการอนุพันธ์และออปชัน</span>
            <span className={styles.titleBadge}>Real API Feed</span>
          </h2>
          <div className={styles.headerMetricsRow}>
            <span className={styles.headerMetricPill}>Options Chain</span>
            <span className={styles.headerMetricPill}>PCR {pcrRatio}</span>
            <span className={styles.headerMetricPill}>Max Pain {valueText(maxPainStrike,0)} · {chainFeed.data?.summary?.covered??0} strikes</span>
            <span className={styles.headerMetricPill}>Margin Shield</span>
            <span className={styles.headerMetricPill}>2R Sizing</span>
          </div>
        </div>

        {/* Contract Ticker Strip */}
        <div className={styles.contractChips} role="group" aria-label="เลือกสัญญาซื้อขาย TFEX">
          {Object.values(TFEX_SPECS).map(item => {
            const isActive = selectedSymbol === item.symbol;
            return (
              <button
                key={item.symbol}
                type="button"
                className={`${styles.contractChip} ${isActive ? styles.contractChipActive : ''}`}
                onClick={() => onSelect && onSelect({ symbol: item.symbol, name: item.name, id: 'tfex' })}
                title={`เปิดดูกราฟและข้อมูลสัญญา ${item.symbol}`}
              >
                <span className={styles.chipSymbol}>{item.symbol}</span>
                <span className={styles.chipPrice}>{valueText(item.futuresPrice)}</span>
                <span className={item.isUp ? styles.chipChangeUp : styles.chipChangeDown}>
                  {item.changePercent}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Cyber Command Bar (Navigation Tabs) ─── */}
      <nav className={styles.commandBar} aria-label="เมนูระบบเทอร์มินัล TFEX">
        <div className={styles.commandTabsGroup}>
          <button
            type="button"
            className={`${styles.commandTab} ${activeTab === 'options' ? styles.commandTabActive : ''}`}
            onClick={() => setActiveTab('options')}
          >
            <div className={styles.commandTabHeader}>
              <span className={styles.commandTabIcon}>◈</span>
              <span className={styles.commandTabTitle}>Options Chain</span>
              <span className={styles.commandTabBadge}>PCR {pcrRatio}</span>
            </div>
          </button>

          <button
            type="button"
            className={`${styles.commandTab} ${activeTab === 'margin' ? styles.commandTabActive : ''}`}
            onClick={() => setActiveTab('margin')}
          >
            <div className={styles.commandTabHeader}>
              <span className={styles.commandTabIcon} style={{ color: '#22d3ee' }}>⚡</span>
              <span className={styles.commandTabTitle}>What-If Simulator</span>
              <span className={styles.commandTabBadge}>
                <span className={styles.livePulseDot} />
                Live Lab
              </span>
            </div>
          </button>

          <button
            type="button"
            className={`${styles.commandTab} ${activeTab === 'futures' ? styles.commandTabActive : ''}`}
            onClick={() => setActiveTab('futures')}
          >
            <div className={styles.commandTabHeader}>
              <span className={styles.commandTabIcon} style={{ color: '#38bdf8' }}>▲</span>
              <span className={styles.commandTabTitle}>Futures Matrix</span>
              <span className={styles.commandTabBadge}>ราคาจาก TFEX</span>
            </div>
          </button>

          <button
            type="button"
            className={`${styles.commandTab} ${activeTab === 'sizing' ? styles.commandTabActive : ''}`}
            onClick={() => setActiveTab('sizing')}
          >
            <div className={styles.commandTabHeader}>
              <span className={styles.commandTabIcon} style={{ color: '#10b981' }}>⌖</span>
              <span className={styles.commandTabTitle}>2R Sizing Desk</span>
              <span className={styles.commandTabBadge}>{calculatedContracts} สัญญา</span>
            </div>
          </button>
        </div>

        <span className={styles.commandBarGatewayPill}>READ-ONLY</span>
      </nav>

      {/* ─── TAB 1: SET50 OPTIONS CHAIN & VOLATILITY DESK ─── */}
      {activeTab === 'options' && (
        <div className={styles.optionsDesk}>
          {/* Sentiment Barometers Row */}
          <div className={styles.barometerGrid}>
            <div className={styles.barometerCard}>
              <div className={styles.barometerHeader}>
                <span className={styles.barometerTitle}>Put/Call Ratio (PCR)</span>
                <span className={`${styles.barometerTag} ${styles.barometerTagBull}`}>Bullish Hedging</span>
              </div>
              <div className={styles.barometerValue}>{pcrRatio}</div>
              <div className={styles.pcrMeter}>
                <div className={styles.pcrSegmentCall} style={{ width: '46%' }} title="Call OI (46%)" />
                <div className={styles.pcrSegmentPut} style={{ width: '54%' }} title="Put OI (54%)" />
              </div>
              <p className={styles.barometerDesc}>
                Put {valueText(totalPutOi)} / Call {valueText(totalCallOi)} · สถาบันตั้งรับแนวรับ
              </p>
            </div>

            <div className={styles.barometerCard}>
              <div className={styles.barometerHeader}>
                <span className={styles.barometerTitle}>Max Pain Strike</span>
                <span className={`${styles.barometerTag} ${styles.barometerTagNeutral}`}>Pin Magnet</span>
              </div>
              <div className={styles.barometerValue}>{valueText(maxPainStrike,1)} <small style={{ fontSize: '13px', color: '#94a3b8' }}>จุด</small></div>
              <p className={styles.barometerDesc}>
                จุดดึงดูดฝั่ง Option Sellers (ห่างจากดัชนีปัจจุบัน +{spotDistanceToMaxPain} จุด)
              </p>
            </div>

            <div className={styles.barometerCard}>
              <div className={styles.barometerHeader}>
                <span className={styles.barometerTitle}>Underlying Index Spread</span>
                <span className={`${styles.barometerTag} ${styles.barometerTagNeutral}`}>Contango</span>
              </div>
              <div className={styles.barometerValue}>+1.40 <small style={{ fontSize: '13px', color: '#94a3b8' }}>จุด</small></div>
              <p className={styles.barometerDesc}>
                S50Z26 vs Cash (892.80) · สภาพคล่อง Contango ปกติ
              </p>
            </div>
          </div>

          {/* Options Filter Controls */}
          <div className={styles.optionsControls}>
            <div className={styles.optionsFilterGroup}>
              <label>ฟิลเตอร์ Strike:</label>
              <button
                type="button"
                className={`${styles.filterPillBtn} ${optionsFilter === 'atm' ? styles.filterPillBtnActive : ''}`}
                onClick={() => setOptionsFilter('atm')}
              >
                ใกล้ราคาตลาด (ATM ±20 จุด)
              </button>
              <button
                type="button"
                className={`${styles.filterPillBtn} ${optionsFilter === 'highOi' ? styles.filterPillBtnActive : ''}`}
                onClick={() => setOptionsFilter('highOi')}
              >
                เน้นสภาพคล่อง (High OI)
              </button>
              <button
                type="button"
                className={`${styles.filterPillBtn} ${optionsFilter === 'all' ? styles.filterPillBtnActive : ''}`}
                onClick={() => setOptionsFilter('all')}
              >
                แสดง Strike ที่โหลด
              </button>
            </div>

            <div className={styles.underlyingSpot}>
              <span>ราคา Futures อ้างอิง:</span>
              <span className={styles.spotPill}>{valueText(chainFeed.data?.underlyingPrice)} จุด</span>
              <span>ซีรีส์: <b>{optionSeries}</b></span>
            </div>
          </div>

          {/* Options Chain Matrix */}
          <div className={styles.chainTableWrapper}>
            <table className={styles.chainTable} aria-label="ตาราง Options Chain สัญญา SET50 Index Options">
              <thead>
                <tr>
                  <th colSpan={6} className={styles.thCallGroup}>CALL OPTIONS (สิทธิซื้อ)</th>
                  <th rowSpan={2} className={styles.thStrikeGroup}>STRIKE (จุด)</th>
                  <th colSpan={6} className={styles.thPutGroup}>PUT OPTIONS (สิทธิขาย)</th>
                </tr>
                <tr>
                  <th className={styles.thCallGroup}>IV%</th>
                  <th className={styles.thCallGroup}>OI</th>
                  <th className={styles.thCallGroup}>Vol</th>
                  <th className={styles.thCallGroup}>Bid / Ask</th>
                  <th className={styles.thCallGroup}>ราคา (จุด)</th>
                  <th className={styles.thCallGroup}>คำสั่ง</th>

                  <th className={styles.thPutGroup}>คำสั่ง</th>
                  <th className={styles.thPutGroup}>ราคา (จุด)</th>
                  <th className={styles.thPutGroup}>Bid / Ask</th>
                  <th className={styles.thPutGroup}>Vol</th>
                  <th className={styles.thPutGroup}>OI</th>
                  <th className={styles.thPutGroup}>IV%</th>
                </tr>
              </thead>
              <tbody>
                {filteredStrikes.map(row => {
                  const isCallItm = row.strike < (chainFeed.data?.underlyingPrice??NaN);
                  const isPutItm = row.strike > (chainFeed.data?.underlyingPrice??NaN);
                  return (
                    <tr key={row.strike} className={row.isAtm ? styles.atmRow : ''}>
                      {/* CALL SIDE */}
                      <td className={isCallItm ? styles.callItm : ''}>{valueText(row.callIv)}%</td>
                      <td className={isCallItm ? styles.callItm : ''}>{valueText(row.callOi)}</td>
                      <td className={isCallItm ? styles.callItm : ''}>{valueText(row.callVol)}</td>
                      <td className={isCallItm ? styles.callItm : ''}>{valueText(row.callBid)} / {valueText(row.callAsk)}</td>
                      <td className={isCallItm ? styles.callItm : ''}>
                        <strong style={{ color: '#34d399' }}>{valueText(row.callPrice,1)}</strong>
                      </td>
                      <td className={isCallItm ? styles.callItm : ''}>
                        <button
                          type="button"
                          className={`${styles.actionBtnMini} ${styles.actionBtnCall}`}
                          onClick={() => setSelectedStrategy(`Long Call S50Z26C${row.strike} @ ${row.callPrice} จุด`)}
                        >
                          Long C
                        </button>
                      </td>

                      {/* STRIKE PRICE */}
                      <td className={styles.strikeCell}>
                        {row.strike}
                        {row.isAtm && <span className={styles.atmBadge}>★ ATM</span>}
                        {row.isMaxPain && <span className={styles.atmBadge} style={{ color: '#ec4899' }}>● MAX PAIN</span>}
                      </td>

                      {/* PUT SIDE */}
                      <td className={isPutItm ? styles.putItm : ''}>
                        <button
                          type="button"
                          className={`${styles.actionBtnMini} ${styles.actionBtnPut}`}
                          onClick={() => setSelectedStrategy(`Long Put S50Z26P${row.strike} @ ${row.putPrice} จุด`)}
                        >
                          Long P
                        </button>
                      </td>
                      <td className={isPutItm ? styles.putItm : ''}>
                        <strong style={{ color: '#fb7185' }}>{valueText(row.putPrice,1)}</strong>
                      </td>
                      <td className={isPutItm ? styles.putItm : ''}>{valueText(row.putBid)} / {valueText(row.putAsk)}</td>
                      <td className={isPutItm ? styles.putItm : ''}>{valueText(row.putVol)}</td>
                      <td className={isPutItm ? styles.putItm : ''}>{valueText(row.putOi)}</td>
                      <td className={isPutItm ? styles.putItm : ''}>{valueText(row.putIv)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Strategy Selection Toast if clicked */}
          {selectedStrategy && (
            <div style={{
              background: 'rgba(34, 211, 238, 0.15)',
              border: '1px solid #22d3ee',
              borderRadius: '10px',
              padding: '10px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px'
            }}>
              <span>📌 เลือกกลยุทธ์: <b>{selectedStrategy}</b> (ตัวคูณ 200 บาท/จุด)</span>
              <button
                type="button"
                onClick={() => setSelectedStrategy(null)}
                style={{ background: 'transparent', border: 0, color: '#22d3ee', cursor: 'pointer', fontWeight: 800 }}
              >
                ✕ ปิด
              </button>
            </div>
          )}

          {/* Options Strategy Playbook */}
          <div className={styles.playbookSection}>
            <div className={styles.playbookHeader}>
              <h3>💡 Options Playbook · กลยุทธ์ยอดนิยม</h3>
              <small style={{ color: '#94a3b8' }}>200 บาท/จุด</small>
            </div>

            <div className={styles.playbookGrid}>
              <div className={styles.playbookCard}>
                <div>
                  <h4 className={styles.playbookCardTitle}>🐂 Bull Call Spread</h4>
                  <p className={styles.playbookCardDesc}>
                    ซื้อ Call 890 + ขาย Call 910 · ดักทะลุ 900 จุด
                  </p>
                </div>
                <div className={styles.playbookRiskProfile}>
                  <span className={styles.riskLimited}>จำกัด: 1,880 ฿</span>
                  <span className={styles.riskDefined}>เป้าหมาย: 2,120 ฿</span>
                </div>
              </div>

              <div className={styles.playbookCard}>
                <div>
                  <h4 className={styles.playbookCardTitle}>🐻 Bear Put Spread</h4>
                  <p className={styles.playbookCardDesc}>
                    ซื้อ Put 890 + ขาย Put 870 · ดักหลุดแนวรับ
                  </p>
                </div>
                <div className={styles.playbookRiskProfile}>
                  <span className={styles.riskLimited}>จำกัด: 1,560 ฿</span>
                  <span className={styles.riskDefined}>เป้าหมาย: 2,440 ฿</span>
                </div>
              </div>

              <div className={styles.playbookCard}>
                <div>
                  <h4 className={styles.playbookCardTitle}>⚡ Long Straddle</h4>
                  <p className={styles.playbookCardDesc}>
                    ซื้อ Call 900 + Put 880 · ดักรับคลื่นผันผวน
                  </p>
                </div>
                <div className={styles.playbookRiskProfile}>
                  <span className={styles.riskLimited}>ต้นทุน: 2,860 ฿</span>
                  <span className={styles.riskDefined}>กำไร: ไม่จำกัด</span>
                </div>
              </div>

              <div className={styles.playbookCard}>
                <div>
                  <h4 className={styles.playbookCardTitle}>🛡️ Iron Condor</h4>
                  <p className={styles.playbookCardDesc}>
                    ขาย Call/Put OTM + ซื้อปีก · กินพรีเมียม 870-920
                  </p>
                </div>
                <div className={styles.playbookRiskProfile}>
                  <span className={styles.riskLimited}>กรอบ: 870-920</span>
                  <span className={styles.riskDefined}>รับพรีเมียม: 1,040 ฿</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: PORTFOLIO RISK & WHAT-IF SIMULATOR ─── */}
      {activeTab === 'margin' && (
        <div className={styles.marginDesk}>
          {/* Segmented Submode Control */}
          <div className={styles.segmentedSubmodeContainer}>
            <div className={styles.segmentedSubmodeTrack} role="tablist" aria-label="โหมดการวิเคราะห์ความเสี่ยง">
              <button
                type="button"
                className={`${styles.segmentedSubmodeItem} ${riskSubMode === 'whatif' ? styles.segmentedSubmodeItemActive : ''}`}
                onClick={() => setRiskSubMode('whatif')}
              >
                <span className={styles.segmentedIcon}>⚡</span>
                <span className={styles.segmentedLabel}>TFEX What-If Simulator</span>
                <span className={styles.segmentedChip}>Multi-Asset Lab</span>
              </button>
              <button
                type="button"
                className={`${styles.segmentedSubmodeItem} ${riskSubMode === 'single' ? styles.segmentedSubmodeItemActive : ''}`}
                onClick={() => setRiskSubMode('single')}
              >
                <span className={styles.segmentedIcon}>🛡️</span>
                <span className={styles.segmentedLabel}>Single Contract Margin Shield</span>
                <span className={styles.segmentedChip}>Individual Risk</span>
              </button>
            </div>
          </div>

          {/* ── SUBMODE 1: WHAT-IF SIMULATOR ── */}
          {riskSubMode === 'whatif' && (
            <div>
              <p className={styles.note}>จำลองความเสี่ยงจากค่าที่กรอกเอง ไม่เชื่อมบัญชีหรือรับ API key จากลูกค้า</p>
              {/* What-If Hero Banner */}
              <div className={styles.whatIfHero}>
                <div className={styles.whatIfHeroInfo}>
                  <span className={styles.whatIfHeroTag}>PORTFOLIO STRESS TESTING</span>
                  <h3>⚡ What-If Simulator · Stress Testing</h3>
                  <p>
                    S50 ({whatIfS50Contracts} สัญญา) + Gold ({whatIfGoContracts} สัญญา) · จำลอง SET50 {whatIfS50Shock >= 0 ? `+${whatIfS50Shock}` : whatIfS50Shock} จุด, ทอง {whatIfGoShock >= 0 ? `+${whatIfGoShock}` : whatIfGoShock}$
                  </p>
                </div>
                <div className={styles.whatIfPlTotal}>
                  <div className={styles.whatIfPlLabel}>กำไร/ขาดทุนจำลองสุทธิ (SIMULATED P/L)</div>
                  <div className={`${styles.whatIfPlValue} ${simTotalPl >= 0 ? styles.whatIfPlPositive : styles.whatIfPlNegative}`}>
                    {simTotalPl >= 0 ? `+${simTotalPl.toLocaleString('en-US')}` : simTotalPl.toLocaleString('en-US')} <small style={{ fontSize: '13px' }}>บาท</small>
                  </div>
                  <small style={{ color: '#94a3b8' }}>
                    Equity ใหม่: <b style={{ color: '#ffffff' }}>{simNewEquity.toLocaleString('en-US')} บาท</b>
                  </small>
                </div>
              </div>

              <div className={styles.whatIfGrid}>
                {/* Left Column: Holdings & Shocks */}
                <div className={styles.formCard}>
                  <h3 className={styles.formCardTitle}>📦 สถานะพอร์ตและปัจจัยกระแทก (Holdings & Shocks)</h3>

                  <div className={styles.formRow}>
                    <label>เงินสดในพอร์ต (Starting Equity): {whatIfEquity.toLocaleString('en-US')} บาท</label>
                    <div className={styles.presetGroup}>
                      {[150000, 200000, 300000, 500000, 1000000].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          className={styles.presetBtn}
                          onClick={() => setWhatIfEquity(amt)}
                        >
                          {(amt / 1000).toLocaleString('en-US')}k
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Position 1: S50 Index Futures */}
                  <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '12px', color: '#22d3ee' }}>1. SET50 Futures (S50Z26)</strong>
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>IM: {(whatIfS50Contracts * TFEX_SPECS.S50.im).toLocaleString('en-US')} ฿</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '10px', color: '#94a3b8' }}>ทิศทางสถานะ:</label>
                        <div className={styles.sideToggle}>
                          <button
                            type="button"
                            className={`${styles.sideBtn} ${whatIfS50Side === 'LONG' ? styles.sideBtnLongActive : ''}`}
                            onClick={() => setWhatIfS50Side('LONG')}
                            style={{ padding: '6px' }}
                          >
                            LONG 🟢
                          </button>
                          <button
                            type="button"
                            className={`${styles.sideBtn} ${whatIfS50Side === 'SHORT' ? styles.sideBtnShortActive : ''}`}
                            onClick={() => setWhatIfS50Side('SHORT')}
                            style={{ padding: '6px' }}
                          >
                            SHORT 🔴
                          </button>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: '#94a3b8' }}>จำนวนสัญญา (S50):</label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          className={styles.formInput}
                          value={whatIfS50Contracts}
                          onChange={e => setWhatIfS50Contracts(Math.max(1, Number(e.target.value)))}
                          style={{ padding: '6px 10px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Position 2: Gold Online Futures */}
                  <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '12px', color: '#fbbf24' }}>2. Gold Online Futures (GOZ26)</strong>
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>IM: {(whatIfGoContracts * TFEX_SPECS.GO.im).toLocaleString('en-US')} ฿</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '10px', color: '#94a3b8' }}>ทิศทางสถานะ:</label>
                        <div className={styles.sideToggle}>
                          <button
                            type="button"
                            className={`${styles.sideBtn} ${whatIfGoSide === 'LONG' ? styles.sideBtnLongActive : ''}`}
                            onClick={() => setWhatIfGoSide('LONG')}
                            style={{ padding: '6px' }}
                          >
                            LONG 🟢
                          </button>
                          <button
                            type="button"
                            className={`${styles.sideBtn} ${whatIfGoSide === 'SHORT' ? styles.sideBtnShortActive : ''}`}
                            onClick={() => setWhatIfGoSide('SHORT')}
                            style={{ padding: '6px' }}
                          >
                            SHORT 🔴
                          </button>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: '#94a3b8' }}>จำนวนสัญญา (GO):</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          className={styles.formInput}
                          value={whatIfGoContracts}
                          onChange={e => setWhatIfGoContracts(Math.max(1, Number(e.target.value)))}
                          style={{ padding: '6px 10px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stress Sliders */}
                  <div className={styles.stressControlCard}>
                    <div className={styles.stressTitle}>
                      <span>⚡ สมมติฐานการเปลี่ยนแปลงของ SET50:</span>
                      <b style={{ color: whatIfS50Shock >= 0 ? '#34d399' : '#fb7185', fontFamily: 'monospace' }}>
                        {whatIfS50Shock >= 0 ? `+${whatIfS50Shock}` : whatIfS50Shock} จุด
                      </b>
                    </div>
                    <input
                      type="range"
                      min={-40}
                      max={40}
                      step={1}
                      value={whatIfS50Shock}
                      onChange={e => setWhatIfS50Shock(Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--tfex-cyan)' }}
                    />
                    <div className={styles.scenarioPresetRow}>
                      {[-20, -15, -10, 0, 10, 15, 20].map(pts => (
                        <button
                          key={pts}
                          type="button"
                          className={styles.scenarioChip}
                          onClick={() => setWhatIfS50Shock(pts)}
                          style={whatIfS50Shock === pts ? { background: '#22d3ee', color: '#0f172a', fontWeight: 800 } : {}}
                        >
                          {pts >= 0 ? `+${pts}` : pts} pt
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.stressControlCard}>
                    <div className={styles.stressTitle}>
                      <span>⚡ สมมติฐานการเปลี่ยนแปลงของราคาทองคำ (GO):</span>
                      <b style={{ color: whatIfGoShock >= 0 ? '#34d399' : '#fb7185', fontFamily: 'monospace' }}>
                        {whatIfGoShock >= 0 ? `+${whatIfGoShock}` : whatIfGoShock} USD
                      </b>
                    </div>
                    <input
                      type="range"
                      min={-80}
                      max={80}
                      step={5}
                      value={whatIfGoShock}
                      onChange={e => setWhatIfGoShock(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#fbbf24' }}
                    />
                    <div className={styles.scenarioPresetRow}>
                      {[-40, -20, -10, 0, 10, 20, 40].map(usd => (
                        <button
                          key={usd}
                          type="button"
                          className={styles.scenarioChip}
                          onClick={() => setWhatIfGoShock(usd)}
                          style={whatIfGoShock === usd ? { background: '#fbbf24', color: '#0f172a', fontWeight: 800 } : {}}
                        >
                          {usd >= 0 ? `+${usd}` : usd}$
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preset Scenarios Buttons */}
                  <div style={{ marginTop: '10px' }}>
                    <small style={{ color: '#94a3b8', display: 'block', marginBottom: '6px' }}>สถานการณ์จำลองสำเร็จรูป:</small>
                    <div className={styles.scenarioPresetRow}>
                      <button
                        type="button"
                        className={styles.scenarioChip}
                        onClick={() => { setWhatIfS50Shock(-15); setWhatIfGoShock(-20); }}
                      >
                        💥 Panic Double Shock (-15pt S50, -20$ GO)
                      </button>
                      <button
                        type="button"
                        className={styles.scenarioChip}
                        onClick={() => { setWhatIfS50Shock(-20); setWhatIfGoShock(30); }}
                      >
                        🛡️ Flight to Gold (-20pt S50, +30$ GO)
                      </button>
                      <button
                        type="button"
                        className={styles.scenarioChip}
                        onClick={() => { setWhatIfS50Shock(15); setWhatIfGoShock(25); }}
                      >
                        🚀 Twin Bull (+15pt S50, +25$ GO)
                      </button>
                      <button
                        type="button"
                        className={styles.scenarioChip}
                        onClick={() => { setWhatIfS50Shock(0); setWhatIfGoShock(0); }}
                      >
                        🔄 ล้างค่า Baseline
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Outcomes & De-risking Guidance */}
                <div className={styles.metricsCard}>
                  <div>
                    <h3 className={styles.formCardTitle} style={{ marginBottom: '14px' }}>
                      📊 ผลกระทบต่อระดับเงินประกัน &amp; การทนผิดทาง
                    </h3>

                    <div className={styles.metricHero}>
                      <div className={`${styles.metricBox} ${isWhatIfCallTriggered ? styles.metricBoxForce : styles.metricBoxCall}`}>
                        <div className={styles.metricBoxLabel}>สถานะ MARGIN CALL</div>
                        <div className={`${styles.metricBoxValue} ${isWhatIfCallTriggered ? styles.metricBoxValueForce : styles.metricBoxValueCall}`}>
                          {isWhatIfCallTriggered ? 'TRIGGERED 🚨' : 'SAFE ZONE ✓'}
                        </div>
                        <div className={styles.metricBoxSub}>
                          {isWhatIfCallTriggered
                            ? `ขาดเงินประกัน MM: ${Math.abs(whatIfBufferToCall).toLocaleString('en-US')} ฿`
                            : `กันชนเหนือ MM: +${whatIfBufferToCall.toLocaleString('en-US')} ฿`}
                        </div>
                      </div>

                      <div className={styles.metricBox} style={{ borderColor: 'rgba(34, 211, 238, 0.4)' }}>
                        <div className={styles.metricBoxLabel}>สัดส่วน MARGIN USAGE</div>
                        <div className={styles.metricBoxValue} style={{ color: Number(whatIfMarginUsagePct) > 70 ? '#fb7185' : '#22d3ee' }}>
                          {whatIfMarginUsagePct}%
                        </div>
                        <div className={styles.metricBoxSub}>
                          IM รวม: <b>{whatIfTotalIm.toLocaleString('en-US')} ฿</b>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Impact Breakdown Rows */}
                  <div className={styles.marginBreakdown}>
                    <div className={styles.marginRow}>
                      <span>ผลกระทบสัญญา S50 ({whatIfS50Contracts} สัญญา @ {whatIfS50Shock} pt):</span>
                      <b style={{ color: simS50Pl >= 0 ? '#34d399' : '#fb7185' }}>
                        {simS50Pl >= 0 ? `+${simS50Pl.toLocaleString('en-US')}` : simS50Pl.toLocaleString('en-US')} บาท
                      </b>
                    </div>
                    <div className={styles.marginRow}>
                      <span>ผลกระทบสัญญา GO ({whatIfGoContracts} สัญญา @ {whatIfGoShock}$):</span>
                      <b style={{ color: simGoPl >= 0 ? '#34d399' : '#fb7185' }}>
                        {simGoPl >= 0 ? `+${simGoPl.toLocaleString('en-US')}` : simGoPl.toLocaleString('en-US')} บาท
                      </b>
                    </div>
                    <div className={styles.marginRow}>
                      <span>กำไร/ขาดทุนสุทธิ (Net P/L Impact):</span>
                      <b style={{ color: simTotalPl >= 0 ? '#34d399' : '#fb7185', fontSize: '13px' }}>
                        {simTotalPl >= 0 ? `+${simTotalPl.toLocaleString('en-US')}` : simTotalPl.toLocaleString('en-US')} บาท
                      </b>
                    </div>
                    <div className={styles.marginRow}>
                      <span>เงินสดคงเหลือสุทธิ (Simulated Equity):</span>
                      <b style={{ color: '#ffffff' }}>{simNewEquity.toLocaleString('en-US')} บาท</b>
                    </div>
                    <div className={styles.marginRow}>
                      <span>ระดับเงินประกันรักษาสภาพ (Combined MM 70%):</span>
                      <b>{whatIfTotalMm.toLocaleString('en-US')} บาท</b>
                    </div>
                    <div className={styles.marginRow}>
                      <span>ระดับบังคับปิดสัญญา (Combined FM 30%):</span>
                      <b style={{ color: '#fb7185' }}>{whatIfTotalFm.toLocaleString('en-US')} บาท</b>
                    </div>
                  </div>

                  {/* De-risking Action Prescription */}
                  <div className={styles.deRiskBox}>
                    <div className={styles.deRiskTitle}>
                      <span>🎯</span>
                      <span>คำแนะนำการปรับพอร์ตเพื่อคุมความเสี่ยง (De-Risking Action)</span>
                    </div>
                    <p className={styles.deRiskText}>
                      {deRiskAdvice}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SUBMODE 2: SINGLE CONTRACT SAFETY SHIELD ── */}
          {riskSubMode === 'single' && (
            <div>
              {/* Safety Shield Banner */}
              <div className={`${styles.shieldBanner} ${isDangerousLeverage ? styles.shieldBannerAlert : ''}`}>
                <span className={styles.shieldIcon}>{isDangerousLeverage ? '⚠️' : '🛡️'}</span>
                <div className={styles.shieldText}>
                  <strong>
                    {isDangerousLeverage
                      ? 'คำเตือน: ความเสี่ยงพอร์ต Overleverage สูง เสี่ยงต่อการโดน Margin Call!'
                      : isModerateLeverage
                        ? 'ระดับความเสี่ยงปานกลาง: ควรตั้ง Stop Loss ชัดเจนก่อนเปิดสถานะ'
                        : 'พอร์ตมีกันชนปลอดภัยสูง: ทนต่อความผันผวนและการเปิดกระโดด Gap ได้ดี'}
                  </strong>
                  <p>
                    เกณฑ์ TFEX: Initial (IM) · Maintenance (MM 70%) · Force Close (FM 30%)
                  </p>
                </div>
              </div>

              <div className={styles.marginGrid}>
                {/* Input Form */}
                <div className={styles.formCard}>
                  <h3 className={styles.formCardTitle}>⚙️ พารามิเตอร์พอร์ตจำลองรายสัญญา</h3>

                  <div className={styles.formRow}>
                    <label>เงินสดในพอร์ต (Equity): {marginEquity.toLocaleString('en-US')} บาท</label>
                    <div className={styles.presetGroup}>
                      {[50000, 100000, 200000, 500000, 1000000].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          className={styles.presetBtn}
                          onClick={() => setMarginEquity(amt)}
                        >
                          {(amt / 1000).toLocaleString('en-US')}k
                        </button>
                      ))}
                    </div>
                    <input
                      type="range"
                      min={30000}
                      max={1000000}
                      step={10000}
                      value={marginEquity}
                      onChange={e => setMarginEquity(Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--tfex-cyan)', margin: '8px 0' }}
                    />
                  </div>

                  <div className={styles.formRow}>
                    <label>สินค้าอนุพันธ์:</label>
                    <select
                      className={styles.formInput}
                      value={marginProduct}
                      onChange={e => {
                        const prod = e.target.value;
                        setMarginProduct(prod);
                        if(Number.isFinite(TFEX_SPECS[prod].futuresPrice))setMarginEntry(TFEX_SPECS[prod].futuresPrice);
                      }}
                    >
                      <option value="S50">S50 Index Futures (IM 10,850 ฿ · 200 ฿/จุด)</option>
                      <option value="GO">Gold Online Futures (IM 31,500 ฿ · 300 ฿/USD)</option>
                      <option value="SVF">Silver Online Futures (IM 26,250 ฿ · 3,000 ฿/USD)</option>
                      <option value="USD">USD Futures (IM 1,050 ฿ · 1,000 ฿/จุด)</option>
                    </select>
                  </div>

                  <div className={styles.formRow}>
                    <label>ทิศทางสถานะ (Position Side):</label>
                    <div className={styles.sideToggle}>
                      <button
                        type="button"
                        className={`${styles.sideBtn} ${marginSide === 'LONG' ? styles.sideBtnLongActive : ''}`}
                        onClick={() => setMarginSide('LONG')}
                      >
                        🟢 LONG (เก็งกำไรขาขึ้น)
                      </button>
                      <button
                        type="button"
                        className={`${styles.sideBtn} ${marginSide === 'SHORT' ? styles.sideBtnShortActive : ''}`}
                        onClick={() => setMarginSide('SHORT')}
                      >
                        🔴 SHORT (เก็งกำไรขาลง)
                      </button>
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <label>จำนวนสัญญา (Contracts): {marginContracts} สัญญา</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      className={styles.formInput}
                      value={marginContracts}
                      onChange={e => setMarginContracts(Math.max(1, Number(e.target.value)))}
                    />
                  </div>

                  <div className={styles.formRow}>
                    <label>ราคาต้นทุน (Entry Price):</label>
                    <input
                      type="number"
                      step={currentSpec.tickSize}
                      className={styles.formInput}
                      value={marginEntry}
                      onChange={e => setMarginEntry(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Calculations & Metrics Card */}
                <div className={styles.metricsCard}>
                  <div>
                    <h3 className={styles.formCardTitle} style={{ marginBottom: '14px' }}>
                      📊 ผลวิเคราะห์ความปลอดภัยของพอร์ต
                    </h3>

                    <div className={styles.metricHero}>
                      <div className={`${styles.metricBox} ${styles.metricBoxCall}`}>
                        <div className={styles.metricBoxLabel}>ทนผิดทางได้ก่อน MARGIN CALL</div>
                        <div className={`${styles.metricBoxValue} ${styles.metricBoxValueCall}`}>
                          {pointsToCall.toFixed(1)} <small style={{ fontSize: '13px' }}>{currentSpec.unit}</small>
                        </div>
                        <div className={styles.metricBoxSub}>
                          ระดับราคาเตือน: <b>{callPriceTrigger}</b>
                        </div>
                      </div>

                      <div className={`${styles.metricBox} ${styles.metricBoxForce}`}>
                        <div className={styles.metricBoxLabel}>ทนผิดทางได้ก่อน FORCE CLOSE</div>
                        <div className={`${styles.metricBoxValue} ${styles.metricBoxValueForce}`}>
                          {pointsToForce.toFixed(1)} <small style={{ fontSize: '13px' }}>{currentSpec.unit}</small>
                        </div>
                        <div className={styles.metricBoxSub}>
                          ระดับราคาบังคับปิด: <b>{forcePriceTrigger}</b>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Margin Usage Meter */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                      <span>สัดส่วนการใช้ Margin (IM Utilization):</span>
                      <b style={{ color: Number(marginUsagePct) > 75 ? '#fb7185' : '#34d399' }}>{marginUsagePct}%</b>
                    </div>
                    <div className={styles.meterTrack}>
                      <div
                        className={`${styles.meterFill} ${
                          Number(marginUsagePct) > 75
                            ? styles.meterFillDanger
                            : Number(marginUsagePct) > 40
                              ? styles.meterFillWarn
                              : styles.meterFillSafe
                        }`}
                        style={{ width: `${Math.min(100, Number(marginUsagePct))}%` }}
                      />
                    </div>
                  </div>

                  {/* Margin Breakdown Table */}
                  <div className={styles.marginBreakdown}>
                    <div className={styles.marginRow}>
                      <span>เงินประกันเริ่มต้น (IM Required):</span>
                      <b>{totalIm.toLocaleString('en-US')} บาท</b>
                    </div>
                    <div className={styles.marginRow}>
                      <span>เงินประกันรักษาสภาพ (MM 70%):</span>
                      <b>{totalMm.toLocaleString('en-US')} บาท</b>
                    </div>
                    <div className={styles.marginRow}>
                      <span>เงินประกันขั้นต่ำบังคับปิด (FM 30%):</span>
                      <b>{totalFm.toLocaleString('en-US')} บาท</b>
                    </div>
                    <div className={styles.marginRow}>
                      <span>เงินสดคงเหลือเพื่อรองรับความเสี่ยง:</span>
                      <b style={{ color: '#34d399' }}>{Math.max(0, marginEquity - totalIm).toLocaleString('en-US')} บาท</b>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: FUTURES MATRIX & BASIS DESK ─── */}
      {activeTab === 'futures' && (
        <div className={styles.futuresDesk}>
          {/* Basis Hero Banner */}
          <div className={styles.basisHero}>
            <div className={styles.basisInfo}>
              <div className={styles.basisTag}>S50 BASIS TRACKER</div>
              <h3>Basis ดัชนี SET50: {valueText(TFEX_SPECS.S50.basis)} จุด</h3>
              <p>
                Futures − SET50 Spot จากข้อมูลที่โหลด · ระดับ Entry/SL/2R/3R ด้านล่างเป็นเครื่องวางแผนตามระยะเดิมของโปรเจกต์
              </p>
            </div>
            <div className={styles.basisStatGrid}>
              <div className={styles.basisStatItem}>
                <span className={styles.basisStatLabel}>SET50 CASH SPOT</span>
                <span className={styles.basisStatValue}>{valueText(TFEX_SPECS.S50.spotPrice)}</span>
              </div>
              <div className={styles.basisStatItem}>
                <span className={styles.basisStatLabel}>{TFEX_SPECS.S50.symbol} FUTURES</span>
                <span className={styles.basisStatValue} style={{ color: '#22d3ee' }}>{valueText(TFEX_SPECS.S50.futuresPrice)}</span>
              </div>
              <div className={styles.basisStatItem}>
                <span className={styles.basisStatLabel}>FAIR BASIS TARGET (สมมติ)</span>
                <span className={styles.basisStatValue} style={{ color: '#34d399' }}>+1.20</span>
              </div>
            </div>
          </div>

          {/* Futures Market Cards */}
          <div className={styles.futuresGrid}>
            {/* S50 Futures */}
            <div className={styles.futuresCard}>
              <div className={styles.futuresCardHeader}>
                <div className={styles.futuresTitleGroup}>
                  <strong>{TFEX_SPECS.S50.symbol} · SET50 Index Futures</strong>
                  <small>ตัวคูณ 200 บาท/จุด · Tick 0.1 จุด (20 บาท)</small>
                </div>
                <span className={`${styles.biasPill} ${styles.biasPillBull}`}>🟢 BUY DIP (2R BIAS)</span>
              </div>

              <div className={styles.planLevelsGrid}>
                <div className={styles.planCol}>
                  <span className={styles.planLabel}>ENTRY ZONE</span>
                  <span className={styles.planPrice}>{valueText(TFEX_SPECS.S50.futuresPrice)}</span>
                  <span className={styles.planBaht}>จุดเข้าดักย่อ</span>
                </div>
                <div className={styles.planCol}>
                  <span className={styles.planLabel}>STOP LOSS</span>
                  <span className={`${styles.planPrice} ${styles.planRisk}`}>{valueText(TFEX_SPECS.S50.futuresPrice-5)}</span>
                  <span className={styles.planBaht}>-5.0 pt (-1,000฿)</span>
                </div>
                <div className={styles.planCol}>
                  <span className={styles.planLabel}>TARGET 1 (2R)</span>
                  <span className={`${styles.planPrice} ${styles.planReward}`}>{valueText(TFEX_SPECS.S50.futuresPrice+10)}</span>
                  <span className={styles.planBaht}>+10.0 pt (+2,000฿)</span>
                </div>
                <div className={styles.planCol}>
                  <span className={styles.planLabel}>TARGET 2 (3R)</span>
                  <span className={`${styles.planPrice} ${styles.planReward}`}>{valueText(TFEX_SPECS.S50.futuresPrice+15)}</span>
                  <span className={styles.planBaht}>+15.0 pt (+3,000฿)</span>
                </div>
              </div>

              <div className={styles.futuresCardFooter}>
                <span>Volume: <b>{valueText(TFEX_SPECS.S50.volume,0)} สัญญา</b></span>
                <span>Open Interest: <b>{valueText(TFEX_SPECS.S50.openInterest,0)} สัญญา</b></span>
                <button
                  type="button"
                  className={styles.filterPillBtn}
                  onClick={() => onSelect && onSelect({ symbol: TFEX_SPECS.S50.symbol, name: 'SET50 Index Futures', id: 'tfex' })}
                >
                  เปิดกราฟสัญญา →
                </button>
              </div>
            </div>

            {/* Gold Online Futures */}
            <div className={styles.futuresCard}>
              <div className={styles.futuresCardHeader}>
                <div className={styles.futuresTitleGroup}>
                  <strong>{TFEX_SPECS.GO.symbol} · Gold Online Futures</strong>
                  <small>ตัวคูณ 300 บาท/USD · ไร้ความเสี่ยงค่าเงินบาท</small>
                </div>
                <span className={`${styles.biasPill} ${styles.biasPillBull}`}>🟢 BULLISH MOMENTUM</span>
              </div>

              <div className={styles.planLevelsGrid}>
                <div className={styles.planCol}>
                  <span className={styles.planLabel}>ENTRY ZONE</span>
                  <span className={styles.planPrice}>{valueText(TFEX_SPECS.GO.futuresPrice)}</span>
                  <span className={styles.planBaht}>USD / oz</span>
                </div>
                <div className={styles.planCol}>
                  <span className={styles.planLabel}>STOP LOSS</span>
                  <span className={`${styles.planPrice} ${styles.planRisk}`}>{valueText(TFEX_SPECS.GO.futuresPrice-8)}</span>
                  <span className={styles.planBaht}>-8.0$ (-2,400฿)</span>
                </div>
                <div className={styles.planCol}>
                  <span className={styles.planLabel}>TARGET 1 (2R)</span>
                  <span className={`${styles.planPrice} ${styles.planReward}`}>{valueText(TFEX_SPECS.GO.futuresPrice+16)}</span>
                  <span className={styles.planBaht}>+16.0$ (+4,800฿)</span>
                </div>
                <div className={styles.planCol}>
                  <span className={styles.planLabel}>TARGET 2 (3R)</span>
                  <span className={`${styles.planPrice} ${styles.planReward}`}>{valueText(TFEX_SPECS.GO.futuresPrice+24)}</span>
                  <span className={styles.planBaht}>+24.0$ (+7,200฿)</span>
                </div>
              </div>

              <div className={styles.futuresCardFooter}>
                <span>Volume: <b>{valueText(TFEX_SPECS.GO.volume,0)} สัญญา</b></span>
                <span>Open Interest: <b>{valueText(TFEX_SPECS.GO.openInterest,0)} สัญญา</b></span>
                <button
                  type="button"
                  className={styles.filterPillBtn}
                  onClick={() => onSelect && onSelect({ symbol: TFEX_SPECS.GO.symbol, name: 'Gold Online Futures', id: 'tfex' })}
                >
                  เปิดกราฟสัญญา →
                </button>
              </div>
            </div>

            {/* Silver Online Futures */}
            <div className={styles.futuresCard}>
              <div className={styles.futuresCardHeader}>
                <div className={styles.futuresTitleGroup}>
                  <strong>{TFEX_SPECS.SVF.symbol} · Silver Online Futures</strong>
                  <small>ตัวคูณ 3,000 บาท/USD · สินค้า High-Beta</small>
                </div>
                <span className={`${styles.biasPill} ${styles.biasPillBear}`}>🔴 CONSOLIDATION</span>
              </div>

              <div className={styles.planLevelsGrid}>
                <div className={styles.planCol}>
                  <span className={styles.planLabel}>ENTRY ZONE</span>
                  <span className={styles.planPrice}>31.80</span>
                  <span className={styles.planBaht}>USD / oz</span>
                </div>
                <div className={styles.planCol}>
                  <span className={styles.planLabel}>STOP LOSS</span>
                  <span className={`${styles.planPrice} ${styles.planRisk}`}>31.40</span>
                  <span className={styles.planBaht}>-0.40$ (-1,200฿)</span>
                </div>
                <div className={styles.planCol}>
                  <span className={styles.planLabel}>TARGET 1 (2R)</span>
                  <span className={`${styles.planPrice} ${styles.planReward}`}>32.60</span>
                  <span className={styles.planBaht}>+0.80$ (+2,400฿)</span>
                </div>
                <div className={styles.planCol}>
                  <span className={styles.planLabel}>TARGET 2 (3R)</span>
                  <span className={`${styles.planPrice} ${styles.planReward}`}>33.00</span>
                  <span className={styles.planBaht}>+1.20$ (+3,600฿)</span>
                </div>
              </div>

              <div className={styles.futuresCardFooter}>
                <span>Volume: <b>6,400 สัญญา</b></span>
                <span>Open Interest: <b>12,800 สัญญา</b></span>
                <button
                  type="button"
                  className={styles.filterPillBtn}
                  onClick={() => onSelect && onSelect({ symbol: 'SVFZ26', name: 'Silver Online Futures', id: 'tfex' })}
                >
                  เปิดกราฟสัญญา →
                </button>
              </div>
            </div>

            {/* USD Futures */}
            <div className={styles.futuresCard}>
              <div className={styles.futuresCardHeader}>
                <div className={styles.futuresTitleGroup}>
                  <strong>USDZ26 · USD Futures</strong>
                  <small>ตัวคูณ 1,000 บาท/จุด · ป้องกันความเสี่ยงค่าเงิน</small>
                </div>
                <span className={`${styles.biasPill} ${styles.biasPillBear}`}>🔴 SHORT ON RALLY</span>
              </div>

              <div className={styles.planLevelsGrid}>
                <div className={styles.planCol}>
                  <span className={styles.planLabel}>ENTRY ZONE</span>
                  <span className={styles.planPrice}>33.70</span>
                  <span className={styles.planBaht}>THB / USD</span>
                </div>
                <div className={styles.planCol}>
                  <span className={styles.planLabel}>STOP LOSS</span>
                  <span className={`${styles.planPrice} ${styles.planRisk}`}>33.90</span>
                  <span className={styles.planBaht}>-0.20 pt (-200฿)</span>
                </div>
                <div className={styles.planCol}>
                  <span className={styles.planLabel}>TARGET 1 (2R)</span>
                  <span className={`${styles.planPrice} ${styles.planReward}`}>33.30</span>
                  <span className={styles.planBaht}>+0.40 pt (+400฿)</span>
                </div>
                <div className={styles.planCol}>
                  <span className={styles.planLabel}>TARGET 2 (3R)</span>
                  <span className={`${styles.planPrice} ${styles.planReward}`}>33.10</span>
                  <span className={styles.planBaht}>+0.60 pt (+600฿)</span>
                </div>
              </div>

              <div className={styles.futuresCardFooter}>
                <span>Volume: <b>18,200 สัญญา</b></span>
                <span>Open Interest: <b>42,100 สัญญา</b></span>
                <button
                  type="button"
                  className={styles.filterPillBtn}
                  onClick={() => onSelect && onSelect({ symbol: 'USDZ26', name: 'USD Futures', id: 'tfex' })}
                >
                  เปิดกราฟสัญญา →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: TFEX 2R POSITION SIZING DESK ─── */}
      {activeTab === 'sizing' && (
        <div className={styles.sizingDesk}>
          <div className={styles.sizingGrid}>
            {/* Input Desk */}
            <div className={styles.formCard}>
              <h3 className={styles.formCardTitle}>🎯 วางงบความเสี่ยงและระยะ Stop Loss</h3>

              <div className={styles.formRow}>
                <label>ขนาดพอร์ตลงทุน (Capital): {sizingCapital.toLocaleString('en-US')} บาท</label>
                <div className={styles.presetGroup}>
                  {[100000, 200000, 300000, 500000, 1000000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      className={styles.presetBtn}
                      onClick={() => setSizingCapital(amt)}
                    >
                      {(amt / 1000).toLocaleString('en-US')}k
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min={50000}
                  max={1000000}
                  step={25000}
                  value={sizingCapital}
                  onChange={e => setSizingCapital(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--tfex-cyan)', margin: '8px 0' }}
                />
              </div>

              <div className={styles.formRow}>
                <label>ความเสี่ยงสูงสุดต่อไม้ (% Risk Budget): {sizingRiskPct}%</label>
                <div className={styles.presetGroup}>
                  {[1, 1.5, 2, 3].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      className={styles.presetBtn}
                      onClick={() => setSizingRiskPct(pct)}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.formRow}>
                <label>ระยะ Stop Loss ที่ยอมรับ (จุดดัชนี): {sizingSlPoints} จุด</label>
                <input
                  type="number"
                  step={0.5}
                  min={1}
                  max={30}
                  className={styles.formInput}
                  value={sizingSlPoints}
                  onChange={e => setSizingSlPoints(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Sizing Output */}
            <div className={styles.metricsCard}>
              <div>
                <h3 className={styles.formCardTitle} style={{ marginBottom: '14px' }}>
                  💡 จำนวนสัญญาที่ปลอดภัยตามหลัก 2R
                </h3>

                <div className={styles.metricHero}>
                  <div className={styles.metricBox} style={{ borderColor: 'rgba(34, 211, 238, 0.4)' }}>
                    <div className={styles.metricBoxLabel}>จำนวนสัญญาแนะนำ (SAFE SIZE)</div>
                    <div className={styles.metricBoxValue} style={{ color: '#22d3ee' }}>
                      {calculatedContracts} <small style={{ fontSize: '13px' }}>สัญญา</small>
                    </div>
                    <div className={styles.metricBoxSub}>
                      ความเสี่ยงรวม: <b>{(calculatedContracts * riskPerContractTHB).toLocaleString('en-US')} บาท</b>
                    </div>
                  </div>

                  <div className={styles.metricBox} style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                    <div className={styles.metricBoxLabel}>กำไรเป้าหมาย 2R (+{(sizingSlPoints * 2).toFixed(1)} จุด)</div>
                    <div className={styles.metricBoxValue} style={{ color: '#34d399' }}>
                      +{(calculatedContracts * riskPerContractTHB * 2).toLocaleString('en-US')} <small style={{ fontSize: '13px' }}>บาท</small>
                    </div>
                    <div className={styles.metricBoxSub}>
                      Reward:Risk = <b>2.0 เท่า</b>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.marginBreakdown}>
                <div className={styles.marginRow}>
                  <span>งบความเสี่ยงที่ตั้งไว้ ({sizingRiskPct}% ของพอร์ต):</span>
                  <b>{maxRiskTHB.toLocaleString('en-US')} บาท</b>
                </div>
                <div className={styles.marginRow}>
                  <span>ความเสี่ยงต่อ 1 สัญญา (SL {sizingSlPoints} จุด):</span>
                  <b>{riskPerContractTHB.toLocaleString('en-US')} บาท</b>
                </div>
                <div className={styles.marginRow}>
                  <span>เงินประกัน IM ที่ต้องใช้ ({calculatedContracts} × 10,850 ฿):</span>
                  <b style={{ color: sizingImOk ? '#ffffff' : '#fb7185' }}>{sizingImRequired.toLocaleString('en-US')} บาท</b>
                </div>
                <div className={styles.marginRow}>
                  <span>สถานะเงินประกัน:</span>
                  <b style={{ color: sizingImOk ? '#34d399' : '#fb7185' }}>
                    {sizingImOk ? '✓ เงินประกันเพียงพอและปลอดภัย' : '⚠️ เกินงบ Margin ในพอร์ต!'}
                  </b>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}

