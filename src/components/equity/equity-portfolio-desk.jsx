'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styles from './equity-portfolio-desk.module.css';
import InstrumentLogo from '../monitor/instrument-logo.jsx';

// ─── OFFICIAL BROKERAGE PARTNERS (EXCLUSIVELY PI & TRINITY) ───
const BROKER_OPTIONS = [
  {
    id: '003',
    name: 'Pi Securities',
    thaiName: 'บล.พาย (มหาชน)',
    tag: 'OFFICIAL PARTNER',
    badge: '🥧 บล.พาย',
    tagline: 'แอป Pi Financial ซื้อขายหุ้นไทย & DR ทั่วโลก มาร์เก็ตติ้งดูแลส่วนตัวระดับ VIP',
  },
  {
    id: '022',
    name: 'Trinity Securities',
    thaiName: 'บล.ทรีนีตี้',
    tag: 'OFFICIAL PARTNER',
    badge: '🌟 บล.ทรีนีตี้',
    tagline: 'โบรกเกอร์ชั้นนำ บทวิเคราะห์แม่นยำ พร้อม Settrade Open API เต็มประสิทธิภาพ',
  },
];

const INTEREST_OPTIONS = [
  { id: 'thai', label: '🇹🇭 หุ้นไทย Stage 2 (SET50 / SET100)' },
  { id: 'dr', label: '🌐 DR หุ้นนอกสหรัฐฯ & ยุโรป (NVDA80, AAPL80)' },
  { id: 'tfex', label: '📈 TFEX & Block Trade สัญญาดัชนี / หุ้น' },
  { id: 'algo', label: '🤖 AI อัลกอริทึม & ระบบเตือน Trailing Stop' },
];

function generateDemoPortfolio(brokerId = '022', appCode = 'ALGO_EQ') {
  const isPi = brokerId === '003';
  const brokerName = isPi ? 'Pi Securities (บล.พาย)' : 'Trinity Securities (บล.ทรีนีตี้)';
  const usdThbRate = 34.25;

  const demoHoldings = isPi
    ? [
        {
          symbol: 'CPALL',
          market: 'THAI',
          assetType: 'EQUITY',
          sector: 'COMMERCE',
          section: 'SET50',
          quantity: 2500,
          avgCost: 59.5,
          marketPrice: 65.5,
          marketValue: 163750,
          costValue: 148750,
          unrealizedPl: 15000,
          unrealizedPlPct: 10.08,
          stage: 2,
          stageName: 'Stage 2 ขาขึ้นแข็งแกร่ง (Trend Leader)',
          stageColor: '#10b981',
          trailingStop: 63.5,
          cutLossPrice: 58.0,
          action: 'HOLD & LET PROFIT RUN',
          actionNote: 'ราคายก Low ยืนเหนือ EMA20 สวยงาม ถือรันเทรนด์ตามรอบ',
        },
        {
          symbol: 'NVDA80',
          market: 'DR',
          assetType: 'DR_US',
          sector: 'SEMICONDUCTORS',
          section: 'DR Global',
          quantity: 4000,
          avgCost: 38.0,
          marketPrice: 44.5,
          marketValue: 178000,
          costValue: 152000,
          unrealizedPl: 26000,
          unrealizedPlPct: 17.11,
          stage: 2,
          stageName: 'Stage 2 Super Momentum',
          stageColor: '#10b981',
          trailingStop: 41.8,
          cutLossPrice: 36.5,
          action: 'TAKE PROFIT 50%',
          actionNote: 'กำไรแตะเป้า 2R (+17%) แบ่งขายล็อคกำไรครึ่งหนึ่งตามวินัย',
          drMeta: {
            underlying: 'NVDA (NASDAQ)',
            usPrice: 138.2,
            fairPrice: 44.1,
            spreadPct: 0.9,
            fairStatus: 'FAIR (สอดคล้องราคาแม่)',
            fxImpact: 'USD/THB 34.25 (ผลกระทบค่าเงิน -0.3%)',
          },
        },
        {
          symbol: 'TSLA80',
          market: 'DR',
          assetType: 'DR_US',
          sector: 'AUTOMOTIVE',
          section: 'DR Global',
          quantity: 3000,
          avgCost: 32.5,
          marketPrice: 37.0,
          marketValue: 111000,
          costValue: 97500,
          unrealizedPl: 13500,
          unrealizedPlPct: 13.85,
          stage: 2,
          stageName: 'Stage 2 High Momentum',
          stageColor: '#10b981',
          trailingStop: 35.2,
          cutLossPrice: 31.0,
          action: 'HOLD & RUN TREND',
          actionNote: 'แรงซื้อ DR หุ้นแม่ทะลุแนวต้านสำคัญ ถือรันเทรนด์ต่อ',
          drMeta: {
            underlying: 'TSLA (NASDAQ)',
            usPrice: 220.5,
            fairPrice: 36.8,
            spreadPct: 0.54,
            fairStatus: 'FAIR (พรีเมียมต่ำ ปลอดภัย)',
            fxImpact: 'USD/THB 34.25 (ผลกระทบค่าเงิน -0.2%)',
          },
        },
        {
          symbol: 'GULF',
          market: 'THAI',
          assetType: 'EQUITY',
          sector: 'ENERGY',
          section: 'SET50',
          quantity: 2000,
          avgCost: 62.0,
          marketPrice: 63.5,
          marketValue: 127000,
          costValue: 124000,
          unrealizedPl: 3000,
          unrealizedPlPct: 2.42,
          stage: 1,
          stageName: 'Stage 1 สะสมฐาน (Base Building)',
          stageColor: '#f59e0b',
          trailingStop: 61.5,
          cutLossPrice: 59.5,
          action: 'HOLD BASE',
          actionNote: 'พักตัวสร้างฐานเหนือแนวรับสำคัญ ถือจับตาจังหวะเบรคเอาท์',
        },
        {
          symbol: 'HANA',
          market: 'THAI',
          assetType: 'EQUITY',
          sector: 'ELECTRONICS',
          section: 'SET100',
          quantity: 2000,
          avgCost: 40.5,
          marketPrice: 37.75,
          marketValue: 75500,
          costValue: 81000,
          unrealizedPl: -5500,
          unrealizedPlPct: -6.79,
          stage: 4,
          stageName: 'Stage 4 ขาลงอันตราย (หลุด EMA50)',
          stageColor: '#f43f5e',
          trailingStop: null,
          cutLossPrice: 37.0,
          action: '🚨 REDUCE / CUT LOSS NOW',
          actionNote: 'หลุดแนวรับ EMA50 ขาดทุนเกิน 6% แนะนำตัดขาดทุนก่อนเสียหายหนัก',
        },
      ]
    : [
        {
          symbol: 'DELTA',
          market: 'THAI',
          assetType: 'EQUITY',
          sector: 'ELECTRONICS',
          section: 'SET50',
          quantity: 1500,
          avgCost: 110.0,
          marketPrice: 135.5,
          marketValue: 203250,
          costValue: 165000,
          unrealizedPl: 38250,
          unrealizedPlPct: 23.18,
          stage: 2,
          stageName: 'Stage 2 ขาขึ้นแข็งแกร่ง (Trend Leader)',
          stageColor: '#10b981',
          trailingStop: 128.0,
          cutLossPrice: 121.0,
          action: 'HOLD & LET PROFIT RUN',
          actionNote: 'ราคายืนเหนือ EMA20/50 แข็งแกร่ง ถือรันเทรนด์ ห้ามขายหมู',
        },
        {
          symbol: 'NVDA80',
          market: 'DR',
          assetType: 'DR_US',
          sector: 'SEMICONDUCTORS',
          section: 'DR Global',
          quantity: 4000,
          avgCost: 38.0,
          marketPrice: 44.5,
          marketValue: 178000,
          costValue: 152000,
          unrealizedPl: 26000,
          unrealizedPlPct: 17.11,
          stage: 2,
          stageName: 'Stage 2 Super Momentum',
          stageColor: '#10b981',
          trailingStop: 41.8,
          cutLossPrice: 36.5,
          action: 'TAKE PROFIT 50%',
          actionNote: 'กำไรแตะเป้า 2R (+17%) แบ่งขายล็อคกำไรครึ่งหนึ่งตามวินัย',
          drMeta: {
            underlying: 'NVDA (NASDAQ)',
            usPrice: 138.2,
            fairPrice: 44.1,
            spreadPct: 0.9,
            fairStatus: 'FAIR (สอดคล้องราคาแม่)',
            fxImpact: 'USD/THB 34.25 (ผลกระทบค่าเงิน -0.3%)',
          },
        },
        {
          symbol: 'AAPL80',
          market: 'DR',
          assetType: 'DR_US',
          sector: 'TECHNOLOGY',
          section: 'DR Global',
          quantity: 5000,
          avgCost: 28.2,
          marketPrice: 31.4,
          marketValue: 157000,
          costValue: 141000,
          unrealizedPl: 16000,
          unrealizedPlPct: 11.35,
          stage: 2,
          stageName: 'Stage 2 High Conviction',
          stageColor: '#10b981',
          trailingStop: 30.1,
          cutLossPrice: 27.0,
          action: 'HOLD & RUN TREND',
          actionNote: 'หุ้นแม่ All-Time High ถือต่อตามแนวเส้น EMA20',
          drMeta: {
            underlying: 'AAPL (NASDAQ)',
            usPrice: 235.4,
            fairPrice: 31.25,
            spreadPct: 0.48,
            fairStatus: 'FAIR (พรีเมียมต่ำ ปลอดภัย)',
            fxImpact: 'USD/THB 34.25 (ผลกระทบค่าเงิน -0.2%)',
          },
        },
        {
          symbol: 'BDMS',
          market: 'THAI',
          assetType: 'EQUITY',
          sector: 'HEALTHCARE',
          section: 'SET100',
          quantity: 6000,
          avgCost: 28.5,
          marketPrice: 29.25,
          marketValue: 175500,
          costValue: 171000,
          unrealizedPl: 4500,
          unrealizedPlPct: 2.63,
          stage: 1,
          stageName: 'Stage 1 สะสมฐาน (Base Building)',
          stageColor: '#f59e0b',
          trailingStop: 28.25,
          cutLossPrice: 27.5,
          action: 'HOLD BASE',
          actionNote: 'พักตัวสร้างฐานสวย มี Volume สะสม ไม่หลุดแนวรับสำคัญ',
        },
        {
          symbol: 'PTT',
          market: 'THAI',
          assetType: 'EQUITY',
          sector: 'ENERGY',
          section: 'SET100',
          quantity: 3000,
          avgCost: 33.0,
          marketPrice: 31.5,
          marketValue: 94500,
          costValue: 99000,
          unrealizedPl: -4500,
          unrealizedPlPct: -4.55,
          stage: 4,
          stageName: 'Stage 4 ขาลงอันตราย (หลุด EMA50)',
          stageColor: '#f43f5e',
          trailingStop: null,
          cutLossPrice: 31.0,
          action: '🚨 REDUCE / CUT LOSS NOW',
          actionNote: 'หลุดแนวรับ EMA50 กลายเป็น Stage 4 แนะนำตัดขาดทุนก่อนเสียหายหนัก',
        },
      ];

  const cashBalance = isPi ? 150000 : 120000;
  const totalMarketValue = demoHoldings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalCostValue = demoHoldings.reduce((sum, h) => sum + h.costValue, 0);
  const totalUnrealizedPl = totalMarketValue - totalCostValue;
  const totalUnrealizedPlPct = ((totalUnrealizedPl / totalCostValue) * 100).toFixed(2);
  const equity = totalMarketValue + cashBalance;

  const thaiStockValue = demoHoldings.filter((h) => h.market === 'THAI').reduce((sum, h) => sum + h.marketValue, 0);
  const drStockValue = demoHoldings.filter((h) => h.market === 'DR').reduce((sum, h) => sum + h.marketValue, 0);

  const thaiStockPct = ((thaiStockValue / totalMarketValue) * 100).toFixed(1);
  const drStockPct = ((drStockValue / totalMarketValue) * 100).toFixed(1);

  let healthNumerator = 0;
  for (const h of demoHoldings) {
    const factor = h.stage === 2 ? 1.0 : h.stage === 1 ? 0.7 : h.stage === 3 ? 0.3 : 0.0;
    healthNumerator += h.marketValue * factor;
  }
  const healthScore = Math.round((healthNumerator / totalMarketValue) * 100);

  return {
    success: true,
    mode: 'DEMO',
    accountNo: isPi ? 'EQ-003-88912-P' : 'EQ-022-78891-B',
    brokerId,
    brokerName,
    appCode,
    asOf: new Date().toISOString(),
    equity,
    cashBalance,
    lineAvailable: cashBalance,
    totalMarketValue,
    totalCostValue,
    totalUnrealizedPl,
    totalUnrealizedPlPct: Number(totalUnrealizedPlPct),
    allocation: {
      thaiStockValue,
      thaiStockPct: Number(thaiStockPct),
      drStockValue,
      drStockPct: Number(drStockPct),
      cashBalance,
      cashPct: Number(((cashBalance / equity) * 100).toFixed(1)),
    },
    health: {
      score: healthScore,
      grade: healthScore >= 80 ? 'เกรด A (พอร์ตขาขึ้นแข็งแกร่ง)' : healthScore >= 60 ? 'เกรด B (สมดุลปานกลาง)' : 'เกรด C (ความเสี่ยงสูง)',
      stage2RatioPct: Number(((demoHoldings.filter((h) => h.stage === 2).reduce((s, h) => s + h.marketValue, 0) / totalMarketValue) * 100).toFixed(1)),
      stage4DangerRatioPct: Number(((demoHoldings.filter((h) => h.stage === 4).reduce((s, h) => s + h.marketValue, 0) / totalMarketValue) * 100).toFixed(1)),
    },
    fxEnvironment: {
      usdThb: usdThbRate,
      impactSummary: 'ค่าเงินบาททรงตัว 34.25 บาท/USD ไม่มีความเสี่ยง FX กดดันพอร์ต DR สหรัฐฯ อย่างมีนัยสำคัญ',
    },
    holdings: demoHoldings,
    notice: `เชื่อมต่อผ่านระบบจำลอง Settrade Open API (${appCode} Zero-Custody Sandbox) ไม่มีการจัดเก็บกุญแจในฐานข้อมูล`,
  };
}

export default function EquityPortfolioDesk({ onSelectSymbol }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all | thai | dr | stage2 | danger
  const [showModal, setShowModal] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);

  // BYOK form states (Pre-configured for Trinity 022)
  const [brokerId, setBrokerId] = useState('022');
  const [accountNo, setAccountNo] = useState('99242240');
  const [appId, setAppId] = useState('2Ojgos6LlYIEU3n0');
  const [appSecret, setAppSecret] = useState('AMeylhfYKDRtm2yC+qyN+ivzRXceX23b93zGvMCTe4vF');
  const [appCode, setAppCode] = useState('ALGO_EQ');
  const [latency, setLatency] = useState(35);
  const [showSecret, setShowSecret] = useState(false);

  // Partner Lead Form states
  const [leadBroker, setLeadBroker] = useState('003'); // default Pi
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadLine, setLeadLine] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadInterests, setLeadInterests] = useState(['thai', 'dr']);
  const [leadNotes, setLeadNotes] = useState('');
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(null);
  const [leadError, setLeadError] = useState(null);

  const syncPortfolio = useCallback(
    async (isDemo = true, overrideBrokerId = null) => {
      setLoading(true);
      setError(null);
      const start = performance.now();
      const bId = overrideBrokerId || brokerId;

      if (isDemo) {
        // First try server demo sandbox, fallback gracefully to instant local generator
        try {
          const res = await fetch('/api/equity/portfolio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brokerId: bId,
              isDemo: true,
              appCode: 'ALGO_EQ',
            }),
          });
          if (res.ok) {
            const result = await res.json();
            if (result.success) {
              setData(result);
              if (overrideBrokerId) setBrokerId(overrideBrokerId);
              setLatency(Math.max(12, Math.round(performance.now() - start)));
              setLoading(false);
              return;
            }
          }
        } catch {
          // Gracefully fallback
        }

        // Instant local demo generation (zero-error for guests/visitors)
        const demoData = generateDemoPortfolio(bId, appCode);
        setData(demoData);
        if (overrideBrokerId) setBrokerId(overrideBrokerId);
        setLatency(18);
        setLoading(false);
        return;
      }

      // LIVE REAL BROKER CONNECTION VIA SETTRADE OPEN API
      try {
        const payload = {
          brokerId: bId,
          accountNo: accountNo.trim(),
          appId: appId.trim(),
          appSecret: appSecret.trim(),
          appCode: appCode.trim() || 'ALGO_EQ',
          isDemo: false,
        };

        const res = await fetch('/api/equity/portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await res.json();
        setLatency(Math.max(15, Math.round(performance.now() - start)));

        if (!res.ok || !result.success) {
          const errCode = result.error?.code || result.error || 'CONNECT_FAILED';
          const errMsg =
            errCode === 'OWNER_ONLY' || errCode === 'AUTHENTICATION_REQUIRED' || errCode === 'FORBIDDEN'
              ? '🔒 การเชื่อมต่อ Settrade Open API พอร์ตสดสงวนสำหรับบัญชีผู้ดูแลระบบ หรือท่านสามารถเปิดพอร์ตใหม่กับพาร์ทเนอร์ Pi หรือ Trinity เพื่อรับสิทธิพิเศษ'
              : result.message || 'เชื่อมต่อ Settrade Open API ไม่สำเร็จ กรุณาตรวจสอบรหัสบัญชีและกุญแจ API';
          throw new Error(errMsg);
        }

        setData(result);
        setShowModal(false);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [brokerId, accountNo, appId, appSecret, appCode]
  );

  useEffect(() => {
    // Initial load: Trinity 022 Demo Sandbox
    syncPortfolio(true, '022');
  }, [syncPortfolio]);

  const handleInterestToggle = (interestId) => {
    setLeadInterests((prev) =>
      prev.includes(interestId) ? prev.filter((id) => id !== interestId) : [...prev, interestId]
    );
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    setLeadSubmitting(true);
    setLeadError(null);

    const interestLabels = leadInterests.map((id) => {
      const match = INTEREST_OPTIONS.find((opt) => opt.id === id);
      return match ? match.label : id;
    });

    try {
      const res = await fetch('/api/equity/partner-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokerId: leadBroker,
          fullName: leadName,
          phone: leadPhone,
          lineId: leadLine,
          email: leadEmail,
          interests: interestLabels,
          notes: leadNotes,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      }

      setLeadSuccess(result);
    } catch (err) {
      setLeadError(err.message);
    } finally {
      setLeadSubmitting(false);
    }
  };

  const holdings = data?.holdings || [];

  const filteredHoldings = useMemo(() => {
    if (filter === 'thai') return holdings.filter((h) => h.market === 'THAI');
    if (filter === 'dr') return holdings.filter((h) => h.market === 'DR');
    if (filter === 'stage2') return holdings.filter((h) => h.stage === 2);
    if (filter === 'danger') return holdings.filter((h) => h.stage === 4);
    return holdings;
  }, [holdings, filter]);

  const drHoldings = useMemo(() => holdings.filter((h) => h.market === 'DR'), [holdings]);

  return (
    <div className={styles.container}>
      {/* ─── UNIFIED LUXURY FINTECH COCKPIT (BORDERLESS HERO DESK) ─── */}
      <section className={styles.cockpitHeroDesk}>
        <div className={styles.cockpitAmbientGlow} />

        {/* Cockpit Header with Floating Micro-Pills */}
        <div className={styles.cockpitHeader}>
          <div className={styles.cockpitLeft}>
            <div className={styles.badgeRow}>
              <span className={styles.gatewayPill}>SETTRADE OPEN API GATEWAY</span>
              <span className={styles.brokerPill}>
                [{data?.brokerId || brokerId}] {data?.brokerName || 'บล.ทรีนีตี้'}
              </span>
              <span className={styles.enclavePill}>
                🛡️ ZERO-CUSTODY CLIENT ENCLAVE (ALGO_EQ)
              </span>
              <span className={styles.latencyPill}>⚡ {latency}ms</span>
              <span
                className={styles.modePill}
                style={{
                  background: data?.mode === 'LIVE' ? 'rgba(16,185,129,0.2)' : 'rgba(56,189,248,0.2)',
                  color: data?.mode === 'LIVE' ? '#34d399' : '#38bdf8',
                }}
              >
                {data?.mode === 'LIVE' ? '🟢 LIVE REAL MARKET' : '🧪 DEMO SANDBOX'}
              </span>
            </div>
            <h2 className={styles.cockpitTitle}>
              ศูนย์บัญชาการพอร์ตหุ้นไทย &amp; DR อัจฉริยะ (Smart Equity Command Desk)
            </h2>
            <p className={styles.cockpitDesc}>
              วิเคราะห์เทรนด์ Stage 2 อัตโนมัติ, เฝ้าระวังจุด Trailing Stop / Cut Loss, และตรวจสอบความคุ้มค่า DR
              ผ่าน 2 พันธมิตรโบรกเกอร์อย่างเป็นทางการ (บล.พาย Pi Securities &amp; บล.ทรีนีตี้ Trinity Securities)
            </p>
          </div>

          <div className={styles.cockpitActions}>
            <button
              type="button"
              className={styles.actionBtnPrimary}
              onClick={() => syncPortfolio(data?.mode === 'DEMO')}
              disabled={loading}
            >
              {loading ? 'กำลังซิงค์...' : '🔄 ซิงค์พอร์ต'}
            </button>
            <button
              type="button"
              className={styles.actionBtnSecondary}
              onClick={() => syncPortfolio(true, '003')}
              disabled={loading}
              style={{
                background: (data?.brokerId || brokerId) === '003' ? 'rgba(168,85,247,0.25)' : undefined,
                boxShadow: (data?.brokerId || brokerId) === '003' ? '0 0 16px rgba(168,85,247,0.3)' : undefined,
                color: (data?.brokerId || brokerId) === '003' ? '#c084fc' : undefined,
              }}
            >
              🥧 ทดลอง บล.พาย (003)
            </button>
            <button
              type="button"
              className={styles.actionBtnSecondary}
              onClick={() => syncPortfolio(true, '022')}
              disabled={loading}
              style={{
                background: (data?.brokerId || brokerId) === '022' ? 'rgba(34,211,238,0.25)' : undefined,
                boxShadow: (data?.brokerId || brokerId) === '022' ? '0 0 16px rgba(34,211,238,0.3)' : undefined,
                color: (data?.brokerId || brokerId) === '022' ? '#38bdf8' : undefined,
              }}
            >
              🌟 ทดลอง บล.ทรีนีตี้ (022)
            </button>
            <button
              type="button"
              className={styles.partnerActionBtn}
              onClick={() => {
                setLeadSuccess(null);
                setLeadError(null);
                setShowLeadModal(true);
              }}
            >
              📝 เปิดพอร์ตใหม่กับพาร์ทเนอร์
            </button>
            <button
              type="button"
              className={styles.actionBtnSecondary}
              onClick={() => setShowModal(true)}
            >
              ⚙️ ตั้งค่า API พอร์ตจริง
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 18px',
              color: '#f87171',
              fontSize: '12px',
              marginTop: '16px',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
              backdropFilter: 'blur(12px)',
            }}
          >
            <span>⚠️ {error}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => syncPortfolio(true, '022')}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  color: '#fff',
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                สลับกลับโหมด Sandbox
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setShowLeadModal(true);
                }}
                style={{
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(5,150,105,0.35))',
                  border: 'none',
                  color: '#34d399',
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                📝 เปิดพอร์ตใหม่กับพาร์ทเนอร์
              </button>
            </div>
          </div>
        )}

        {/* ─── HERO KPI STRIP (OPEN BORDERLESS METRICS) ─── */}
        <div className={styles.kpiHeroStrip}>
          <div className={styles.kpiHeroMetric}>
            <div className={styles.kpiHeroLabel}>
              <span>มูลค่าพอร์ตสุทธิ (Net Equity)</span>
              <span>💰</span>
            </div>
            <div className={styles.kpiHeroValue}>
              {data?.equity?.toLocaleString('th-TH') || '0'} ฿
            </div>
            <div className={styles.kpiHeroSub}>
              วงเงินพร้อมซื้อ: {data?.lineAvailable?.toLocaleString('th-TH') || '0'} ฿
            </div>
          </div>

          <div className={styles.kpiHeroMetric}>
            <div className={styles.kpiHeroLabel}>
              <span>กำไร/ขาดทุนรวม (Unrealized P/L)</span>
              <span>📈</span>
            </div>
            <div
              className={`${styles.kpiHeroValue} ${
                (data?.totalUnrealizedPl || 0) >= 0 ? styles.positiveText : styles.negativeText
              }`}
            >
              {(data?.totalUnrealizedPl || 0) >= 0 ? '+' : ''}
              {data?.totalUnrealizedPl?.toLocaleString('th-TH')} ฿ (
              {(data?.totalUnrealizedPlPct || 0) >= 0 ? '+' : ''}
              {data?.totalUnrealizedPlPct}%)
            </div>
            <div className={styles.kpiHeroSub}>
              มูลค่าตลาด: {data?.totalMarketValue?.toLocaleString('th-TH')} ฿
            </div>
          </div>

          <div className={styles.kpiHeroMetric}>
            <div className={styles.kpiHeroLabel}>
              <span>คะแนนสุขภาพพอร์ต (Stage Health)</span>
              <span>🌟</span>
            </div>
            <div className={`${styles.kpiHeroValue} ${styles.positiveText}`}>
              {data?.health?.score ?? 83} / 100
            </div>
            <div className={styles.kpiHeroSub}>
              {data?.health?.grade || 'เกรด A ขาขึ้นแข็งแกร่ง'}
            </div>
          </div>

          <div className={styles.kpiHeroMetric}>
            <div className={styles.kpiHeroLabel}>
              <span>สัดส่วนหุ้นขาขึ้น vs หุ้นอันตราย</span>
              <span>🛡️</span>
            </div>
            <div className={styles.kpiHeroValue} style={{ fontSize: '18px' }}>
              <span className={styles.positiveText}>Stage 2: {data?.health?.stage2RatioPct ?? 69.4}%</span>
              {' · '}
              <span className={styles.negativeText}>Stage 4: {data?.health?.stage4DangerRatioPct ?? 10.7}%</span>
            </div>
            <div className={styles.kpiHeroSub}>
              ระบบกรองและแจ้งเตือนหุ้นหลุดแนวรับเรียลไทม์
            </div>
          </div>
        </div>

        {/* ─── INTEGRATED ALLOCATION RIBBON (SEAMLESS STREAM) ─── */}
        <div className={styles.allocationRibbon}>
          <div className={styles.allocationHeader}>
            <div className={styles.allocationTitle}>
              <span>📊 สัดส่วนพอร์ตลงทุน (Portfolio Allocation: Thai Stock vs Global DR)</span>
            </div>
            <div className={styles.allocationFxPill}>
              💵 {data?.fxEnvironment?.impactSummary || 'USD/THB 34.25 บาท (ค่าเงินเสถียร ไม่กดดันพอร์ต DR)'}
            </div>
          </div>

          <div className={styles.allocationTrack}>
            <div
              className={styles.barThai}
              style={{ width: `${data?.allocation?.thaiStockPct || 62}%` }}
              title={`หุ้นไทย ${data?.allocation?.thaiStockPct || 62}%`}
            />
            <div
              className={styles.barDr}
              style={{ width: `${data?.allocation?.drStockPct || 38}%` }}
              title={`DR หุ้นโลก ${data?.allocation?.drStockPct || 38}%`}
            />
          </div>

          <div className={styles.allocationLegend}>
            <span>
              <span className={styles.legendDot} style={{ background: '#06b6d4' }} />
              🇹🇭 หุ้นไทย SET100: {data?.allocation?.thaiStockPct || 62}% (
              {data?.allocation?.thaiStockValue?.toLocaleString('th-TH') || '0'} ฿)
            </span>
            <span>
              <span className={styles.legendDot} style={{ background: '#a855f7' }} />
              🌐 DR หุ้นโลก: {data?.allocation?.drStockPct || 38}% (
              {data?.allocation?.drStockValue?.toLocaleString('th-TH') || '0'} ฿)
            </span>
            <span>
              <span className={styles.legendDot} style={{ background: '#10b981' }} />
              💵 เงินสดคงเหลือ: {data?.allocation?.cashBalance?.toLocaleString('th-TH') || '0'} ฿ (
              {data?.allocation?.cashPct || 12}%)
            </span>
          </div>
        </div>
      </section>

      {/* ─── FILTER TABS & STAGE-DIAGNOSED TABLE ─── */}
      <div className={styles.tableToolbar}>
        <div className={styles.filterTabs}>
          <button
            type="button"
            className={`${styles.filterTabBtn} ${filter === 'all' ? styles.filterTabBtnActive : ''}`}
            onClick={() => setFilter('all')}
          >
            ทั้งหมด ({holdings.length})
          </button>
          <button
            type="button"
            className={`${styles.filterTabBtn} ${filter === 'thai' ? styles.filterTabBtnActive : ''}`}
            onClick={() => setFilter('thai')}
          >
            🇹🇭 หุ้นไทย ({holdings.filter((h) => h.market === 'THAI').length})
          </button>
          <button
            type="button"
            className={`${styles.filterTabBtn} ${filter === 'dr' ? styles.filterTabBtnActive : ''}`}
            onClick={() => setFilter('dr')}
          >
            🌐 DR หุ้นโลก ({holdings.filter((h) => h.market === 'DR').length})
          </button>
          <button
            type="button"
            className={`${styles.filterTabBtn} ${filter === 'stage2' ? styles.filterTabBtnActive : ''}`}
            onClick={() => setFilter('stage2')}
          >
            🟢 Stage 2 ขาขึ้น ({holdings.filter((h) => h.stage === 2).length})
          </button>
          <button
            type="button"
            className={`${styles.filterTabBtn} ${filter === 'danger' ? styles.filterTabBtnActive : ''}`}
            onClick={() => setFilter('danger')}
          >
            🔴 Stage 4 อันตราย ({holdings.filter((h) => h.stage === 4).length})
          </button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.portfolioTable}>
          <thead>
            <tr>
              <th>สินทรัพย์ / สัญลักษณ์</th>
              <th>จำนวนหุ้น</th>
              <th>ราคาตลาด / ทุนเฉลี่ย</th>
              <th>มูลค่าพอร์ต</th>
              <th>กำไร / ขาดทุน (P/L)</th>
              <th>วินิจฉัย Stage (1-4)</th>
              <th>แนว Cut Loss / Trailing</th>
              <th>ใบสั่งยา AI (Prescription)</th>
              <th>การกระทำ</th>
            </tr>
          </thead>
          <tbody>
            {filteredHoldings.map((item) => {
              const isProfit = (item.unrealizedPl || 0) >= 0;
              return (
                <tr key={item.symbol}>
                  <td>
                    <div className={styles.symbolCell}>
                      <InstrumentLogo
                        asset={{
                          symbol: item.symbol,
                          market: item.market === 'DR' ? 'dr' : 'thai',
                          name: item.symbol,
                        }}
                      />
                      <div className={styles.symbolInfo}>
                        <span className={styles.symbolName}>
                          <b>{item.symbol}</b>
                          {item.market === 'THAI' ? (
                            <span className={styles.tagThai}>{item.section || 'SET100'}</span>
                          ) : (
                            <span className={styles.tagDr}>DR-US</span>
                          )}
                        </span>
                        <span className={styles.symbolSub}>{item.sector || '—'}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>
                    {item.quantity?.toLocaleString('th-TH')} หุ้น
                  </td>
                  <td style={{ fontFamily: 'ui-monospace, monospace' }}>
                    <div>{item.marketPrice ? `${item.marketPrice.toFixed(2)} ฿` : '—'}</div>
                    <small style={{ color: '#94a3b8' }}>
                      ทุน {item.avgCost ? `${item.avgCost.toFixed(2)} ฿` : '—'}
                    </small>
                  </td>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>
                    {item.marketValue ? `${item.marketValue.toLocaleString('th-TH')} ฿` : '—'}
                  </td>
                  <td>
                    <div
                      className={isProfit ? styles.positiveText : styles.negativeText}
                      style={{ fontFamily: 'ui-monospace, monospace' }}
                    >
                      {item.unrealizedPl !== null
                        ? `${isProfit ? '+' : ''}${item.unrealizedPl.toLocaleString('th-TH')} ฿`
                        : '—'}
                    </div>
                    <small className={isProfit ? styles.positiveText : styles.negativeText}>
                      {item.unrealizedPlPct !== null
                        ? `${isProfit ? '+' : ''}${item.unrealizedPlPct.toFixed(2)}%`
                        : ''}
                    </small>
                  </td>
                  <td>
                    {item.stage === 2 && (
                      <span className={`${styles.stageBadge} ${styles.stage2Badge}`}>
                        🟢 Stage 2 ขาขึ้นแข็งแกร่ง
                      </span>
                    )}
                    {item.stage === 1 && (
                      <span className={`${styles.stageBadge} ${styles.stage1Badge}`}>
                        🟡 Stage 1 สร้างฐานสะสม
                      </span>
                    )}
                    {item.stage === 4 && (
                      <span className={`${styles.stageBadge} ${styles.stage4Badge}`}>
                        🚨 Stage 4 ขาลงหลุด EMA50
                      </span>
                    )}
                    {!item.stage && (
                      <span className={`${styles.stageBadge} ${styles.stage1Badge}`}>
                        {item.stageName || 'รอประเมิน'}
                      </span>
                    )}
                  </td>
                  <td style={{ fontFamily: 'ui-monospace, monospace' }}>
                    {item.trailingStop ? (
                      <div>
                        <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                          {item.trailingStop.toFixed(2)} ฿
                        </span>
                        <br />
                        <small style={{ color: '#94a3b8' }}>Trailing Stop</small>
                      </div>
                    ) : item.cutLossPrice ? (
                      <div>
                        <span style={{ color: '#fb7185', fontWeight: 700 }}>
                          {item.cutLossPrice.toFixed(2)} ฿
                        </span>
                        <br />
                        <small style={{ color: '#fb7185' }}>Cut Loss ด่วน</small>
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div className={styles.actionChip}>
                      {item.action?.includes('HOLD') && (
                        <span className={`${styles.actionBadge} ${styles.actionHold}`}>
                          💎 {item.action}
                        </span>
                      )}
                      {item.action?.includes('TAKE PROFIT') && (
                        <span className={`${styles.actionBadge} ${styles.actionTakeProfit}`}>
                          🎯 {item.action}
                        </span>
                      )}
                      {item.action?.includes('CUT') && (
                        <span className={`${styles.actionBadge} ${styles.actionCutLoss}`}>
                          🚨 {item.action}
                        </span>
                      )}
                      {!item.action?.includes('HOLD') &&
                        !item.action?.includes('TAKE PROFIT') &&
                        !item.action?.includes('CUT') && (
                          <span className={`${styles.actionBadge} ${styles.actionHold}`}>
                            {item.action || 'ตรวจแผนจากกราฟ'}
                          </span>
                        )}
                      <span className={styles.actionNote}>{item.actionNote}</span>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.filterTabBtn}
                      style={{ padding: '4px 8px', fontSize: '10px' }}
                      onClick={() => onSelectSymbol?.(item.symbol)}
                    >
                      กราฟ ↗
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── DR ARBITRAGE & FAIR VALUE DESK ─── */}
      {drHoldings.length > 0 && (
        <section className={styles.drSection}>
          <div className={styles.drSectionHeader}>
            <div className={styles.drSectionTitle}>
              <span>🌐 โต๊ะตรวจสอบความคุ้มค่า DR ต่างประเทศ (DR Arbitrage &amp; Fair Value Guard)</span>
            </div>
            <span style={{ fontSize: '11px', color: '#c084fc', fontWeight: 700 }}>
              คำนวณจากราคาหุ้นแม่สหรัฐฯ สด + อัตราแลกเปลี่ยน USD/THB 34.25
            </span>
          </div>

          <div className={styles.drCardsGrid}>
            {drHoldings.map((dr) => (
              <div key={dr.symbol} className={styles.drCard}>
                <div className={styles.drCardTop}>
                  <div className={styles.drCardSymbol}>
                    {dr.symbol} ({dr.drMeta?.underlying || 'Global Stock'})
                  </div>
                  <span className={styles.drFairBadge}>{dr.drMeta?.fairStatus || 'FAIR VALUE'}</span>
                </div>

                <div className={styles.drMetricsRow}>
                  <div className={styles.drMetricItem}>
                    <span className={styles.drMetricLabel}>หุ้นแม่สหรัฐฯ</span>
                    <span className={styles.drMetricVal}>
                      {dr.drMeta?.usPrice ? `$${dr.drMeta.usPrice.toFixed(2)}` : 'Realtime'}
                    </span>
                  </div>
                  <div className={styles.drMetricItem}>
                    <span className={styles.drMetricLabel}>ราคาเหมาะสม (Fair)</span>
                    <span className={styles.drMetricVal}>
                      {dr.drMeta?.fairPrice ? `${dr.drMeta.fairPrice.toFixed(2)} ฿` : '—'}
                    </span>
                  </div>
                  <div className={styles.drMetricItem}>
                    <span className={styles.drMetricLabel}>สเปรดส่วนต่าง</span>
                    <span className={styles.drMetricVal} style={{ color: '#34d399' }}>
                      {dr.drMeta?.spreadPct ? `+${dr.drMeta.spreadPct}%` : 'Fair'}
                    </span>
                  </div>
                </div>

                <div className={styles.drFxLine}>
                  <span>💡 {dr.drMeta?.fxImpact || 'อัตราแลกเปลี่ยน USD/THB ทรงตัว'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── MODAL 1: PARTNER ACCOUNT OPENING (VIP INTRODUCING BROKER FLOW) ─── */}
      {showLeadModal && (
        <div className={styles.modalOverlay} onClick={() => setShowLeadModal(false)}>
          <div className={styles.partnerLeadCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleGroup}>
                <span className={styles.modalKicker} style={{ color: '#34d399' }}>
                  👑 VIP INTRODUCING BROKER (IB) CONCIERGE
                </span>
                <h3 className={styles.modalTitle}>
                  ยื่นขอเปิดพอร์ต VIP กับโบรกเกอร์พันธมิตร
                </h3>
                <p className={styles.modalSubtitle}>
                  บล.พาย (003) &amp; บล.ทรีนีตี้ (022) — มาร์เก็ตติ้งส่วนตัวจะติดต่อดูแลท่านโดยตรง
                </p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setShowLeadModal(false)}
              >
                ✕
              </button>
            </div>

            {leadSuccess ? (
              <div className={styles.vipSuccessCard}>
                <div className={styles.vipCrownIcon}>👑</div>
                <h4 className={styles.vipSuccessTitle}>ยื่นคำขอเปิดพอร์ต VIP เรียบร้อยแล้ว!</h4>
                <span className={styles.vipLeadBadge}>
                  รหัสคำขออ้างอิง: {leadSuccess.leadId}
                </span>
                <p style={{ fontSize: '13px', color: '#cbd5e1', margin: '4px 0 10px 0', lineHeight: 1.5 }}>
                  ข้อมูลของท่านได้รับการลงทะเบียนในระบบความปลอดภัยเรียบร้อยแล้ว<br />
                  เจ้าหน้าที่ผู้แนะนำการลงทุน (มาร์เก็ตติ้ง) จาก{' '}
                  <strong style={{ color: leadSuccess.brokerId === '003' ? '#c084fc' : '#38bdf8' }}>
                    {leadSuccess.brokerName}
                  </strong>{' '}
                  จะติดต่อดูแลท่านเป็นกรณีพิเศษ
                </p>

                <div className={styles.vipTimelineBox}>
                  <div className={styles.vipTimelineStep}>
                    <div className={styles.vipStepNum}>1</div>
                    <div className={styles.vipStepText}>
                      <span className={styles.vipStepTitle}>รับเรื่องคำขอเปิดพอร์ต VIP สำเร็จ</span>
                      <span className={styles.vipStepDesc}>
                        ระบบส่งรายละเอียดของท่านตรงไปยังหัวหน้าทีมมาร์เก็ตติ้ง {leadSuccess.brokerName} เรียบร้อยแล้ว
                      </span>
                    </div>
                  </div>
                  <div className={styles.vipTimelineStep}>
                    <div className={styles.vipStepNum}>2</div>
                    <div className={styles.vipStepText}>
                      <span className={styles.vipStepTitle}>มาร์เก็ตติ้งส่วนตัวติดต่อกลับ</span>
                      <span className={styles.vipStepDesc}>
                        เจ้าหน้าที่ IC จะติดต่อท่านทางโทรศัพท์หรือ LINE เพื่อแนะนำขั้นตอนการเปิดบัญชีและส่งเอกสารยืนยันตัวตน
                      </span>
                    </div>
                  </div>
                  <div className={styles.vipTimelineStep}>
                    <div className={styles.vipStepNum}>3</div>
                    <div className={styles.vipStepText}>
                      <span className={styles.vipStepTitle}>อนุมัติบัญชี &amp; รับสิทธิ์เชื่อมต่อ API ทันที</span>
                      <span className={styles.vipStepDesc}>
                        เมื่อบัญชีได้รับการอนุมัติ ท่านจะได้รับสิทธิ์เชื่อมต่อ Settrade Open API พอร์ตสดและสิทธิ์ใช้งานฟีเจอร์พรีเมียม
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.vipCloseBtn}
                  onClick={() => setShowLeadModal(false)}
                >
                  ✓ รับทราบและปิดหน้าต่าง
                </button>
              </div>
            ) : (
              <form onSubmit={handleLeadSubmit}>
                {/* ─── SEGMENTED BROKER TAB SWITCHER ─── */}
                <div className={styles.brokerSegmentedBar}>
                  <button
                    type="button"
                    className={`${styles.brokerSegmentedTab} ${leadBroker === '003' ? styles.brokerSegmentedTabPiActive : ''}`}
                    onClick={() => setLeadBroker('003')}
                  >
                    <span>🥧</span>
                    <span>บล.พาย Pi Securities (003)</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.brokerSegmentedTab} ${leadBroker === '022' ? styles.brokerSegmentedTabTrinityActive : ''}`}
                    onClick={() => setLeadBroker('022')}
                  >
                    <span>🌟</span>
                    <span>บล.ทรีนีตี้ Trinity (022)</span>
                  </button>
                </div>

                {/* ─── DUAL LUXURY BROKER CARDS ─── */}
                <div className={styles.dualBrokerGrid}>
                  {/* PI SECURITIES 003 */}
                  <div
                    className={`${styles.luxuryBrokerCard} ${styles.luxuryBrokerCardPi} ${leadBroker === '003' ? styles.luxuryBrokerCardSelectedPi : ''}`}
                    onClick={() => setLeadBroker('003')}
                  >
                    <div className={styles.cardTopRow}>
                      <span className={styles.brokerEmblemPi}>🥧 บล.พาย (003)</span>
                      {leadBroker === '003' ? (
                        <span className={styles.statusIndicatorActivePi}>🟢 ✓ กำลังเลือก</span>
                      ) : (
                        <span className={styles.statusIndicatorInactive}>⚪ คลิกเพื่อเลือก</span>
                      )}
                    </div>
                    <h4 className={styles.cardBrokerName}>Pi Securities (มหาชน)</h4>
                    <p className={styles.cardBrokerSub}>
                      แอป Pi Financial ซื้อขายหุ้นไทย &amp; DR ทั่วโลก มาร์เก็ตติ้งดูแลส่วนตัว
                    </p>
                    <ul className={styles.brokerPerksList}>
                      <li>✨ มาร์เก็ตติ้งโทร/ไลน์ติดต่อดูแลเอกสารถึงที่</li>
                      <li>✨ สิทธิ์เข้าห้องซิกแนล &amp; สแกนหุ้น Stage 2 อัจฉริยะ</li>
                      <li>✨ รองรับ Settrade Open API พอร์ตสด</li>
                    </ul>
                  </div>

                  {/* TRINITY SECURITIES 022 */}
                  <div
                    className={`${styles.luxuryBrokerCard} ${styles.luxuryBrokerCardTrinity} ${leadBroker === '022' ? styles.luxuryBrokerCardSelectedTrinity : ''}`}
                    onClick={() => setLeadBroker('022')}
                  >
                    <div className={styles.cardTopRow}>
                      <span className={styles.brokerEmblemTrinity}>🌟 บล.ทรีนีตี้ (022)</span>
                      {leadBroker === '022' ? (
                        <span className={styles.statusIndicatorActiveTrinity}>🟢 ✓ กำลังเลือก</span>
                      ) : (
                        <span className={styles.statusIndicatorInactive}>⚪ คลิกเพื่อเลือก</span>
                      )}
                    </div>
                    <h4 className={styles.cardBrokerName}>Trinity Securities</h4>
                    <p className={styles.cardBrokerSub}>
                      โบรกเกอร์ชั้นนำ บทวิเคราะห์แม่นยำ พร้อม Settrade Open API เต็มประสิทธิภาพ
                    </p>
                    <ul className={styles.brokerPerksList}>
                      <li>✨ ทีมงานมาร์เก็ตติ้งและ Algorithm ดูแลประสานงานตรง</li>
                      <li>✨ บทวิเคราะห์เจาะลึกทั้งหุ้นไทย บล็อกเทรด TFEX และ DR</li>
                      <li>✨ สิทธิ์เชื่อมต่อระบบความปลอดภัย Zero-Custody Enclave</li>
                    </ul>
                  </div>
                </div>

                {/* ─── FORM FIELDS IN GLASS CARD ─── */}
                <div className={styles.formGlassCard}>
                  <div className={styles.formGridTwoCol}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        <span>ชื่อ - นามสกุล *</span>
                      </label>
                      <div className={styles.formInputBox}>
                        <span className={styles.inputIcon}>👤</span>
                        <input
                          type="text"
                          required
                          className={styles.formInput}
                          placeholder="เช่น สมชาย ใจดี"
                          value={leadName}
                          onChange={(e) => setLeadName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        <span>เบอร์โทรศัพท์มือถือ *</span>
                      </label>
                      <div className={styles.formInputBox}>
                        <span className={styles.inputIcon}>📞</span>
                        <input
                          type="tel"
                          required
                          className={styles.formInput}
                          placeholder="เช่น 0812345678"
                          value={leadPhone}
                          onChange={(e) => setLeadPhone(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={styles.formGridTwoCol} style={{ marginTop: '12px' }}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        <span>LINE ID (สำหรับมาร์เก็ตติ้งติดต่อสะดวก)</span>
                      </label>
                      <div className={styles.formInputBox}>
                        <span className={styles.inputIcon}>💬</span>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="เช่น somchai_trader"
                          value={leadLine}
                          onChange={(e) => setLeadLine(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        <span>อีเมล (Email)</span>
                      </label>
                      <div className={styles.formInputBox}>
                        <span className={styles.inputIcon}>📧</span>
                        <input
                          type="email"
                          className={styles.formInput}
                          placeholder="somchai@example.com"
                          value={leadEmail}
                          onChange={(e) => setLeadEmail(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={styles.formGroup} style={{ marginTop: '12px' }}>
                    <label className={styles.formLabel}>
                      <span>สินทรัพย์และบริการที่ท่านสนใจ (เลือกได้หลายข้อ)</span>
                    </label>
                    <div className={styles.interestPillsGrid}>
                      {INTEREST_OPTIONS.map((opt) => {
                        const isSelected = leadInterests.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={`${styles.interestPillBtn} ${isSelected ? styles.interestPillBtnActive : ''}`}
                            onClick={() => handleInterestToggle(opt.id)}
                          >
                            <span>{opt.label}</span>
                            <span style={{ fontSize: '13px', fontWeight: 800 }}>{isSelected ? '✓' : '+'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.formGroup} style={{ marginTop: '12px' }}>
                    <label className={styles.formLabel}>
                      <span>หมายเหตุเพิ่มเติมหรือช่วงเวลาที่สะดวกรับสาย</span>
                    </label>
                    <div className={styles.formInputBox}>
                      <span className={styles.inputIcon}>📝</span>
                      <input
                        type="text"
                        className={styles.formInput}
                        placeholder="เช่น สนใจเปิดพอร์ตเพื่อเทรด DR และรับสิทธิ์เชื่อมต่อ AI โทรช่วงบ่าย"
                        value={leadNotes}
                        onChange={(e) => setLeadNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {leadError && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid #ef4444',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: '#f87171',
                      fontSize: '12px',
                      marginBottom: '12px',
                    }}
                  >
                    ⚠️ {leadError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button
                    type="submit"
                    className={styles.submitBtnVIP}
                    disabled={leadSubmitting || !leadName.trim() || !leadPhone.trim()}
                  >
                    {leadSubmitting
                      ? 'กำลังส่งข้อมูลให้มาร์เก็ตติ้ง...'
                      : `👑 ยืนยันขอเปิดพอร์ต VIP (${leadBroker === '003' ? 'บล.พาย' : 'บล.ทรีนีตี้'})`}
                  </button>
                  <button
                    type="button"
                    className={styles.byokBtnSecondary}
                    onClick={() => setShowLeadModal(false)}
                  >
                    ยกเลิก
                  </button>
                </div>

                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                  <small style={{ color: '#94a3b8', fontSize: '10px' }}>
                    🔒 ข้อมูลของท่านจะถูกส่งตรงไปยังหัวหน้าทีมมาร์เก็ตติ้งของโบรกเกอร์ที่ท่านเลือก เพื่อติดต่อแนะนำการเปิดพอร์ตและอำนวยความสะดวกเป็นกรณีพิเศษ
                  </small>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL 2: BYOK SETTRADE OPEN API SETTINGS (ผูกพอร์ตจริง) ─── */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleGroup}>
                <span className={styles.modalKicker} style={{ color: '#38bdf8' }}>
                  🛡️ ZERO-CUSTODY SETTRADE OPEN API (ALGO_EQ)
                </span>
                <h3 className={styles.modalTitle}>
                  🔑 ผูกพอร์ตจริงด้วย Settrade Open API
                </h3>
                <p className={styles.modalSubtitle}>
                  เชื่อมต่อตรงกับศูนย์รับส่งคำสั่ง Settrade Open API ไม่มีการจัดเก็บ API Secret ลงฐานข้อมูล
                </p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            {/* ─── SEGMENTED BROKER TAB SWITCHER ─── */}
            <div className={styles.brokerSegmentedBar}>
              <button
                type="button"
                className={`${styles.brokerSegmentedTab} ${brokerId === '003' ? styles.brokerSegmentedTabPiActive : ''}`}
                onClick={() => setBrokerId('003')}
              >
                <span>🥧</span>
                <span>บล.พาย Pi Securities (003)</span>
              </button>
              <button
                type="button"
                className={`${styles.brokerSegmentedTab} ${brokerId === '022' ? styles.brokerSegmentedTabTrinityActive : ''}`}
                onClick={() => setBrokerId('022')}
              >
                <span>🌟</span>
                <span>บล.ทรีนีตี้ Trinity (022)</span>
              </button>
            </div>

            {/* ─── DUAL LUXURY BROKER CARDS ─── */}
            <div className={styles.dualBrokerGrid}>
              {/* PI SECURITIES 003 */}
              <div
                className={`${styles.luxuryBrokerCard} ${styles.luxuryBrokerCardPi} ${brokerId === '003' ? styles.luxuryBrokerCardSelectedPi : ''}`}
                onClick={() => setBrokerId('003')}
              >
                <div className={styles.cardTopRow}>
                  <span className={styles.brokerEmblemPi}>🥧 บล.พาย (003)</span>
                  {brokerId === '003' ? (
                    <span className={styles.statusIndicatorActivePi}>🟢 ✓ กำลังเลือก</span>
                  ) : (
                    <span className={styles.statusIndicatorInactive}>⚪ คลิกเพื่อเลือก</span>
                  )}
                </div>
                <h4 className={styles.cardBrokerName}>Pi Securities (มหาชน)</h4>
                <p className={styles.cardBrokerSub}>
                  เชื่อมต่อพอร์ต บล.พาย ดึงข้อมูลหุ้นไทย &amp; DR พร้อมวิเคราะห์ Stage 2
                </p>
                <ul className={styles.brokerPerksList}>
                  <li>✓ รองรับ Settrade Open API (ALGO_EQ)</li>
                  <li>✓ มาร์เก็ตติ้งดูแลระบบส่วนตัว</li>
                </ul>
              </div>

              {/* TRINITY SECURITIES 022 */}
              <div
                className={`${styles.luxuryBrokerCard} ${styles.luxuryBrokerCardTrinity} ${brokerId === '022' ? styles.luxuryBrokerCardSelectedTrinity : ''}`}
                onClick={() => setBrokerId('022')}
              >
                <div className={styles.cardTopRow}>
                  <span className={styles.brokerEmblemTrinity}>🌟 บล.ทรีนีตี้ (022)</span>
                  {brokerId === '022' ? (
                    <span className={styles.statusIndicatorActiveTrinity}>🟢 ✓ กำลังเลือก</span>
                  ) : (
                    <span className={styles.statusIndicatorInactive}>⚪ คลิกเพื่อเลือก</span>
                  )}
                </div>
                <h4 className={styles.cardBrokerName}>Trinity Securities</h4>
                <p className={styles.cardBrokerSub}>
                  เชื่อมต่อพอร์ต บล.ทรีนีตี้ พร้อมระบบคำนวณ Trailing Stop &amp; Cut Loss
                </p>
                <ul className={styles.brokerPerksList}>
                  <li>✓ ซัพพอร์ตเต็มประสิทธิภาพผ่าน Settrade Enclave</li>
                  <li>✓ บทวิเคราะห์เชิงปริมาณและสถิติแม่นยำ</li>
                </ul>
              </div>
            </div>

            {/* ─── IB CONCIERGE BANNER ─── */}
            <div className={styles.ibConciergeBanner}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>👑</span>
                <div>
                  <div className={styles.ibTextTitle}>ยังไม่มีบัญชีซื้อขายกับ บล.พาย หรือ บล.ทรีนีตี้?</div>
                  <div className={styles.ibTextSub}>
                    ยื่นขอเปิดพอร์ต VIP กับมาร์เก็ตติ้งโบรกเกอร์พันธมิตร เพื่อรับสิทธิ์เชื่อมต่อ API และฟีเจอร์พรีเมียมฟรี
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={styles.partnerBtn}
                style={{ fontSize: '11px', padding: '6px 12px', whiteSpace: 'nowrap' }}
                onClick={() => {
                  setShowModal(false);
                  setShowLeadModal(true);
                }}
              >
                เปิดพอร์ต VIP ↗
              </button>
            </div>

            {/* ─── QUICK DEMO PRESET ROW ─── */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                <span>ทดลองเชื่อมต่อด่วน (One-Click Demo Sandbox)</span>
              </label>
              <div className={styles.quickDemoPresetRow}>
                <button
                  type="button"
                  className={styles.quickDemoBtn}
                  onClick={() => {
                    setBrokerId('003');
                    syncPortfolio(true, '003');
                    setShowModal(false);
                  }}
                  style={{
                    background: brokerId === '003' ? 'rgba(168,85,247,0.3)' : undefined,
                    boxShadow: brokerId === '003' ? '0 0 16px rgba(168,85,247,0.35)' : undefined,
                    color: brokerId === '003' ? '#ffffff' : undefined,
                  }}
                >
                  🥧 ทดลองพอร์ต บล.พาย (003 Sandbox)
                </button>
                <button
                  type="button"
                  className={styles.quickDemoBtn}
                  onClick={() => {
                    setBrokerId('022');
                    syncPortfolio(true, '022');
                    setShowModal(false);
                  }}
                  style={{
                    background: brokerId === '022' ? 'rgba(6,182,212,0.3)' : undefined,
                    boxShadow: brokerId === '022' ? '0 0 16px rgba(6,182,212,0.35)' : undefined,
                    color: brokerId === '022' ? '#ffffff' : undefined,
                  }}
                >
                  🌟 ทดลองพอร์ต บล.ทรีนีตี้ (022 Sandbox)
                </button>
              </div>
            </div>

            {/* ─── LUXURY FORM INPUTS CARD ─── */}
            <div className={styles.formGlassCard}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  <span>เลขบัญชีซื้อขายหุ้น (Account Number) *</span>
                </label>
                <div className={styles.formInputBox}>
                  <span className={styles.inputIcon}>🏷️</span>
                  <input
                    type="text"
                    autoComplete="off"
                    className={styles.formInput}
                    placeholder="เช่น 99242240 หรือเลขบัญชีที่โบรกเกอร์ออกให้"
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  <span>App ID (Settrade Open API) *</span>
                </label>
                <div className={styles.formInputBox}>
                  <span className={styles.inputIcon}>🔑</span>
                  <input
                    type="text"
                    autoComplete="off"
                    className={styles.formInput}
                    placeholder="กรอก App ID ที่ได้รับจากโบรกเกอร์"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  <span>API Secret (เข้ารหัสปลอดภัยใน Enclave) *</span>
                </label>
                <div className={styles.formInputBox}>
                  <span className={styles.inputIcon}>🔒</span>
                  <input
                    type={showSecret ? 'text' : 'password'}
                    autoComplete="off"
                    className={styles.formInput}
                    style={{ paddingRight: '40px' }}
                    placeholder="กรอก API Secret (ส่งตรงไปยัง Settrade Enclave เท่านั้น)"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.toggleSecretBtn}
                    onClick={() => setShowSecret(!showSecret)}
                    title={showSecret ? 'ซ่อนรหัส' : 'แสดงรหัส'}
                  >
                    {showSecret ? '👁️‍🗨️' : '👁️'}
                  </button>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  <span>App Code (Default: ALGO_EQ)</span>
                </label>
                <div className={styles.formInputBox}>
                  <span className={styles.inputIcon}>⚙️</span>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={appCode}
                    onChange={(e) => setAppCode(e.target.value)}
                  />
                </div>
                <small style={{ color: '#94a3b8', fontSize: '10px', marginTop: '4px', display: 'block' }}>
                  * หุ้นไทยและ DR ใช้ Service Code เริ่มต้นคือ ALGO_EQ หรือรหัสที่โบรกเกอร์กำหนด
                </small>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
              <button
                type="button"
                className={styles.byokBtnPrimary}
                style={{ flex: 1, padding: '12px 20px', fontSize: '13px' }}
                onClick={() => syncPortfolio(false)}
                disabled={loading || !accountNo || !appId || !appSecret}
              >
                {loading
                  ? 'กำลังเชื่อมต่อ...'
                  : `🚀 เชื่อมต่อ & ซิงค์พอร์ตสด (${brokerId === '003' ? 'บล.พาย' : 'บล.ทรีนีตี้'})`}
              </button>
              <button
                type="button"
                className={styles.byokBtnSecondary}
                onClick={() => setShowModal(false)}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
