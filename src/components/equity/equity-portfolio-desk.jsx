'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styles from './equity-portfolio-desk.module.css';
import InstrumentLogo from '../monitor/instrument-logo.jsx';

// ─── OFFICIAL BROKERAGE PARTNERS (PI 003, TRINITY 022 & ASL 050) ───
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
  {
    id: '050',
    name: 'ASL Securities',
    thaiName: 'บล.เอเอสแอล',
    tag: 'OFFICIAL PARTNER',
    badge: '⚡ บล.เอเอสแอล',
    tagline: 'โบรกเกอร์นวัตกรรมใหม่ เทรดไว ค่าคอมคุ้มค่า พร้อม Settrade Streaming & Open API',
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
  const isAsl = brokerId === '050';
  const brokerName = isPi
    ? 'Pi Securities (บล.พาย)'
    : isAsl
      ? 'ASL Securities (บล.เอเอสแอล)'
      : 'Trinity Securities (บล.ทรีนีตี้)';
  const usdThbRate = 34.25;

  let demoHoldings;
  if (isPi) {
    demoHoldings = [
        {
          symbol: 'DELTA',
          name: 'Delta Electronics (Thailand)',
          market: 'THAI',
          section: 'SET50',
          sector: 'ELECTRONICS',
          quantity: 1200,
          avgCost: 72.5,
          marketPrice: 84.0,
          marketValue: 100800,
          unrealizedPl: 13800,
          unrealizedPlPct: 15.86,
          stage: 2,
          stageName: 'Stage 2 (Uptrend Leader)',
          trailingStop: 79.5,
          cutLossPrice: 69.5,
          action: 'HOLD (RUN PROFIT)',
          actionNote: 'ราคายกไฮยกโลว์เหนือ EMA20 รันกำไรตาม Trailing Stop',
        },
        {
          symbol: 'NVDA80',
          name: 'NVIDIA DR (US Underlying)',
          market: 'DR',
          section: 'DR-US',
          sector: 'TECH',
          quantity: 2500,
          avgCost: 48.0,
          marketPrice: 54.5,
          marketValue: 136250,
          unrealizedPl: 16250,
          unrealizedPlPct: 13.54,
          stage: 2,
          stageName: 'Stage 2 (Global Tech Leader)',
          trailingStop: 51.5,
          cutLossPrice: 46.0,
          action: 'HOLD (AI MOMENTUM)',
          actionNote: 'หุ้นแม่สหรัฐฯ ทำ ATH ค่าเงินบาททรงตัว ไม่เสียเปรียบ FX',
          drMeta: {
            underlying: 'NVDA.US',
            usPrice: 141.5,
            fxRate: usdThbRate,
            fairPrice: 53.8,
            spreadPct: 1.3,
            fairStatus: 'FAIR VALUE',
            fxImpact: 'เสถียร (บาท 34.25)',
          },
        },
        {
          symbol: 'GULF',
          name: 'Gulf Energy Development',
          market: 'THAI',
          section: 'SET50',
          sector: 'ENERGY',
          quantity: 3000,
          avgCost: 46.0,
          marketPrice: 48.75,
          marketValue: 146250,
          unrealizedPl: 8250,
          unrealizedPlPct: 5.98,
          stage: 2,
          stageName: 'Stage 2 (Base Breakout)',
          trailingStop: 46.5,
          cutLossPrice: 44.0,
          action: 'HOLD (BREAKOUT)',
          actionNote: 'เบรกแนวต้าน 46.50 พร้อมวอลุ่ม ยืนเหนือ EMA50 แข็งแกร่ง',
        },
        {
          symbol: 'SPY80',
          name: 'SPDR S&P 500 ETF DR',
          market: 'DR',
          section: 'DR-US',
          sector: 'BROAD_MARKET',
          quantity: 1500,
          avgCost: 19.5,
          marketPrice: 20.2,
          marketValue: 30300,
          unrealizedPl: 1050,
          unrealizedPlPct: 3.59,
          stage: 2,
          stageName: 'Stage 2 (Steady Up)',
          trailingStop: 19.4,
          cutLossPrice: 18.8,
          action: 'HOLD (CORE GLOBAL)',
          actionNote: 'สเปรด Fair กระจายความเสี่ยงตลาดโลก',
          drMeta: {
            underlying: 'SPY.US',
            usPrice: 585.0,
            fxRate: usdThbRate,
            fairPrice: 20.15,
            spreadPct: 0.25,
            fairStatus: 'FAIR VALUE',
            fxImpact: 'เสถียร (บาท 34.25)',
          },
        },
        {
          symbol: 'CPALL',
          name: 'CP ALL Public Company Limited',
          market: 'THAI',
          section: 'SET50',
          sector: 'COMMERCE',
          quantity: 3500,
          avgCost: 65.5,
          marketPrice: 61.25,
          marketValue: 214375,
          unrealizedPl: -14875,
          unrealizedPlPct: -6.49,
          stage: 4,
          stageName: 'Stage 4 (Downtrend Risk)',
          trailingStop: null,
          cutLossPrice: 62.0,
          action: 'CUT LOSS / REDUCE',
          actionNote: 'หลุด EMA50 และ EMA200 แนะนำลดพอร์ตเพื่อจำกัด Drawdown',
        },
    ];
  } else if (isAsl) {
    demoHoldings = [
      {
        symbol: 'DELTA',
        name: 'Delta Electronics (Thailand)',
        market: 'THAI',
        section: 'SET50',
        sector: 'ELECTRONICS',
        quantity: 1500,
        avgCost: 75.0,
        marketPrice: 84.0,
        marketValue: 126000,
        unrealizedPl: 13500,
        unrealizedPlPct: 12.0,
        stage: 2,
        stageName: 'Stage 2 (Mega Leader)',
        trailingStop: 80.0,
        cutLossPrice: 72.0,
        action: 'HOLD (RUN PROFIT)',
        actionNote: 'หุ้นผู้นำกลุ่มอิเล็กทรอนิกส์ ยกฐานไฮใหม่ต่อเนื่อง เทรดว่องไวผ่านระบบ ASL',
      },
      {
        symbol: 'NVDA80',
        name: 'NVIDIA DR (US Underlying)',
        market: 'DR',
        section: 'DR-US',
        sector: 'TECH',
        quantity: 2200,
        avgCost: 49.0,
        marketPrice: 54.5,
        marketValue: 119900,
        unrealizedPl: 12100,
        unrealizedPlPct: 11.22,
        stage: 2,
        stageName: 'Stage 2 (AI Supercycle)',
        trailingStop: 51.5,
        cutLossPrice: 47.0,
        action: 'HOLD (AI MOMENTUM)',
        actionNote: 'โมเมนตัม AI โลกแข็งแกร่ง สเปรด Fair ค่าคอมคุ้มค่าผ่าน บล.เอเอสแอล',
        drMeta: {
          underlying: 'NVDA.US',
          usPrice: 141.5,
          fxRate: usdThbRate,
          fairPrice: 53.8,
          spreadPct: 1.3,
          fairStatus: 'FAIR VALUE',
          fxImpact: 'เสถียร (บาท 34.25)',
        },
      },
      {
        symbol: 'BDMS',
        name: 'Bangkok Dusit Medical Services',
        market: 'THAI',
        section: 'SET50',
        sector: 'HEALTHCARE',
        quantity: 5000,
        avgCost: 26.5,
        marketPrice: 28.5,
        marketValue: 142500,
        unrealizedPl: 10000,
        unrealizedPlPct: 7.55,
        stage: 2,
        stageName: 'Stage 2 (Defensive Growth)',
        trailingStop: 27.5,
        cutLossPrice: 25.5,
        action: 'HOLD (ACCUMULATE)',
        actionNote: 'เบรกกรอบสะสม ยืนเหนือ EMA20/50 ปันผลสม่ำเสมอ ความเสี่ยงต่ำ',
      },
      {
        symbol: 'TSLA80',
        name: 'Tesla Inc. DR (US Underlying)',
        market: 'DR',
        section: 'DR-US',
        sector: 'AUTO_TECH',
        quantity: 1800,
        avgCost: 15.5,
        marketPrice: 17.2,
        marketValue: 30960,
        unrealizedPl: 3060,
        unrealizedPlPct: 10.97,
        stage: 2,
        stageName: 'Stage 2 (High Beta Breakout)',
        trailingStop: 16.2,
        cutLossPrice: 14.8,
        action: 'HOLD (MOMENTUM)',
        actionNote: 'แรงซื้อ DR หุ้นเทคเก็งกำไร โมเมนตัมระยะสั้นเข้าทางระบบเทรดไว',
        drMeta: {
          underlying: 'TSLA.US',
          usPrice: 250.0,
          fxRate: usdThbRate,
          fairPrice: 17.1,
          spreadPct: 0.58,
          fairStatus: 'FAIR VALUE',
          fxImpact: 'เสถียร (บาท 34.25)',
        },
      },
      {
        symbol: 'EA',
        name: 'Energy Absolute PCL',
        market: 'THAI',
        section: 'SET100',
        sector: 'ENERGY',
        quantity: 3000,
        avgCost: 7.2,
        marketPrice: 6.4,
        marketValue: 19200,
        unrealizedPl: -2400,
        unrealizedPlPct: -11.11,
        stage: 4,
        stageName: 'Stage 4 (Downtrend Risk)',
        trailingStop: null,
        cutLossPrice: 6.8,
        action: 'CUT LOSS / EXIT',
        actionNote: 'ราคาหลุดแนวรับโครงสร้างหลัก แนะนำจำกัดความเสี่ยงตามวินัย',
      },
    ];
  } else {
    demoHoldings = [
        {
          symbol: 'PTT',
          name: 'PTT Public Company Limited',
          market: 'THAI',
          section: 'SET50',
          sector: 'ENERGY',
          quantity: 4000,
          avgCost: 32.5,
          marketPrice: 34.0,
          marketValue: 136000,
          unrealizedPl: 6000,
          unrealizedPlPct: 4.62,
          stage: 2,
          stageName: 'Stage 2 (Accumulation Exit)',
          trailingStop: 33.25,
          cutLossPrice: 31.5,
          action: 'HOLD (RECOVERY)',
          actionNote: 'ยืนเหนือ EMA50 และยกโลว์ต่อเนื่อง แนวโน้มทดสอบ 35.50',
        },
        {
          symbol: 'AAPL80',
          name: 'Apple Inc. DR (US Underlying)',
          market: 'DR',
          section: 'DR-US',
          sector: 'TECH',
          quantity: 3500,
          avgCost: 52.0,
          marketPrice: 58.5,
          marketValue: 204750,
          unrealizedPl: 22750,
          unrealizedPlPct: 12.5,
          stage: 2,
          stageName: 'Stage 2 (Superperformance)',
          trailingStop: 56.0,
          cutLossPrice: 50.0,
          action: 'HOLD (STRONG TREND)',
          actionNote: 'Apple Intelligence ไดรฟ์อัปเกรดไซเคิล ทะลุแนวต้านสำคัญ',
          drMeta: {
            underlying: 'AAPL.US',
            usPrice: 231.0,
            fxRate: usdThbRate,
            fairPrice: 58.1,
            spreadPct: 0.69,
            fairStatus: 'FAIR VALUE',
            fxImpact: 'เสถียร (บาท 34.25)',
          },
        },
        {
          symbol: 'ADVANC',
          name: 'Advanced Info Service',
          market: 'THAI',
          section: 'SET50',
          sector: 'ICT',
          quantity: 1000,
          avgCost: 260.0,
          marketPrice: 282.0,
          marketValue: 282000,
          unrealizedPl: 22000,
          unrealizedPlPct: 8.46,
          stage: 2,
          stageName: 'Stage 2 (Leader)',
          trailingStop: 274.0,
          cutLossPrice: 255.0,
          action: 'HOLD (LEADER)',
          actionNote: 'หุ้นผู้นำกลุ่ม ICT กระแสเงินสดแข็งแกร่ง รันเทรนด์ตาม EMA20',
        },
        {
          symbol: 'NDX01',
          name: 'Nasdaq 100 DR (US Underlying)',
          market: 'DR',
          section: 'DR-US',
          sector: 'BROAD_TECH',
          quantity: 4000,
          avgCost: 31.0,
          marketPrice: 32.5,
          marketValue: 130000,
          unrealizedPl: 6000,
          unrealizedPlPct: 4.84,
          stage: 2,
          stageName: 'Stage 2 (Tech Momentum)',
          trailingStop: 31.5,
          cutLossPrice: 30.0,
          action: 'HOLD (TECH CORE)',
          actionNote: 'สเปรด Fair ไม่มีพรีเมียมเกินจริง',
          drMeta: {
            underlying: 'QQQ.US',
            usPrice: 492.0,
            fxRate: usdThbRate,
            fairPrice: 32.4,
            spreadPct: 0.31,
            fairStatus: 'FAIR VALUE',
            fxImpact: 'เสถียร (บาท 34.25)',
          },
        },
        {
          symbol: 'KCE',
          name: 'KCE Electronics PCL',
          market: 'THAI',
          section: 'SET100',
          sector: 'ELECTRONICS',
          quantity: 2500,
          avgCost: 41.5,
          marketPrice: 37.75,
          marketValue: 94375,
          unrealizedPl: -9375,
          unrealizedPlPct: -9.04,
          stage: 4,
          stageName: 'Stage 4 (Downtrend Risk)',
          trailingStop: null,
          cutLossPrice: 39.0,
          action: 'CUT LOSS ด่วน',
          actionNote: 'หลุด Low ก่อนหน้า และหลุด EMA200 แนะนำตัดขาดทุนตามระบบ',
        },
      ];
  }

  const totalMarketValue = demoHoldings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalCost = demoHoldings.reduce((sum, h) => sum + h.quantity * h.avgCost, 0);
  const totalUnrealizedPl = totalMarketValue - totalCost;
  const totalUnrealizedPlPct = ((totalUnrealizedPl / totalCost) * 100).toFixed(2);

  const thaiStockValue = demoHoldings.filter((h) => h.market === 'THAI').reduce((sum, h) => sum + h.marketValue, 0);
  const drStockValue = demoHoldings.filter((h) => h.market === 'DR').reduce((sum, h) => sum + h.marketValue, 0);

  const thaiStockPct = ((thaiStockValue / totalMarketValue) * 100).toFixed(1);
  const drStockPct = ((drStockValue / totalMarketValue) * 100).toFixed(1);

  const cashBalance = 120000;
  const equity = totalMarketValue + cashBalance;

  const stage2Count = demoHoldings.filter((h) => h.stage === 2).length;
  const healthScore = Math.round((stage2Count / demoHoldings.length) * 100);

  return {
    success: true,
    mode: 'DEMO',
    brokerId,
    brokerName,
    appCode,
    equity,
    totalMarketValue,
    lineAvailable: cashBalance,
    cashBalance,
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

  // Unified Modal Suite State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('lead'); // 'lead' | 'api' | 'demo'

  // BYOK form states (Zero-Custody: never pre-populate live credentials in client bundle)
  const [brokerId, setBrokerId] = useState('022');
  const [accountNo, setAccountNo] = useState('');
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [appCode, setAppCode] = useState('ALGO_EQ');
  const [latency, setLatency] = useState(18);
  const [showSecret, setShowSecret] = useState(false);

  // Partner Lead Form states
  const [leadBroker, setLeadBroker] = useState('003'); // default Pi
  const [leadType, setLeadType] = useState('existing_port'); // 'existing_port' | 'new_account'
  const [leadAccountNo, setLeadAccountNo] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadLine, setLeadLine] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadInterests, setLeadInterests] = useState(['thai', 'dr']);
  const [leadNotes, setLeadNotes] = useState('');
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(null);
  const [leadError, setLeadError] = useState(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [manualInviteLink, setManualInviteLink] = useState(null);

  const handleCopyInvite = (link) => {
    if (!link) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        setCopiedInvite(true);
        setTimeout(() => setCopiedInvite(false), 3000);
      });
    }
  };

  const handleFetchInvite = async (leadId) => {
    setInviteLoading(true);
    try {
      const res = await fetch('/api/alerts/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-invite',
          leadId,
          memberName: leadName || 'VIP Member',
        }),
      });
      const data = await res.json();
      if (data.ok && data.inviteLink) {
        setManualInviteLink(data.inviteLink);
      }
    } catch (e) {
      console.warn('Failed to fetch invite link:', e);
    } finally {
      setInviteLoading(false);
    }
  };

  const syncPortfolio = useCallback(
    async (isDemo = true, overrideBrokerId = null) => {
      setLoading(true);
      setError(null);
      const start = performance.now();
      const bId = overrideBrokerId || brokerId;

      if (isDemo) {
        const demoData = generateDemoPortfolio(bId, appCode);
        setData(demoData);
        if (overrideBrokerId) setBrokerId(overrideBrokerId);
        setLatency(Math.max(12, Math.round(performance.now() - start)));
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
        setModalOpen(false);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [brokerId, accountNo, appId, appSecret, appCode]
  );

  useEffect(() => {
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

    if (leadType === 'existing_port' && !leadAccountNo.trim()) {
      setLeadError('กรุณากรอกเลขบัญชีซื้อขายหุ้น (Account No.) เพื่อยืนยันสิทธิ์ VIP');
      setLeadSubmitting(false);
      return;
    }

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
          leadType,
          accountNo: leadType === 'existing_port' ? leadAccountNo.trim() : null,
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
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            'nugaom_subscription_demo',
            JSON.stringify({
              active: true,
              tier: 'trial',
              leadId: result.leadId,
              broker: result.brokerName,
              activatedAt: new Date().toISOString(),
              expiresAt: Date.now() + 14 * 86400000,
            })
          );
        } catch {}
      }
    } catch (err) {
      setLeadError(err.message);
    } finally {
      setLeadSubmitting(false);
    }
  };

  const [studioMode, setStudioMode] = useState('lead'); // 'lead' | 'api' | 'demo'

  const focusInlineStudio = (bId = '003', type = 'new_account', mode = 'lead') => {
    setStudioMode(mode);
    if (mode === 'lead') {
      setLeadBroker(bId);
      setLeadType(type);
      setLeadSuccess(null);
      setLeadError(null);
    } else if (mode === 'api' && bId) {
      setBrokerId(bId);
    }
    if (typeof document !== 'undefined') {
      requestAnimationFrame(() => {
        document.getElementById('vip-inline-studio')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  };

  const openLeadModal = (bId = '003', type = 'new_account') => {
    setLeadBroker(bId);
    setLeadType(type);
    setLeadAccountNo('');
    setStudioMode('lead');
    setModalTab('lead');
    setLeadSuccess(null);
    setLeadError(null);
    focusInlineStudio(bId, type, 'lead');
  };

  const openApiModal = (bId = null) => {
    if (bId) setBrokerId(bId);
    setStudioMode('api');
    setModalTab('api');
    focusInlineStudio(bId || brokerId, leadType, 'api');
  };

  const openDemoModal = () => {
    setStudioMode('demo');
    setModalTab('demo');
    focusInlineStudio(brokerId, leadType, 'demo');
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
    <div className={styles.deskWrapper}>
      {/* ─── 1. COMMAND DESK HERO SURFACE (PREMIUM FINTECH CANVASES) ─── */}
      <section className={styles.commandDesk}>
        <div className={styles.ambientGlow} />

        {/* Top Intelligence Ribbon */}
        <header className={styles.deskHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.liveGatewayStrip}>
              <span className={styles.gatewayBadge}>
                <span className={styles.livePulseDot} />
                SETTRADE OPEN API GATEWAY
              </span>
              <span className={styles.enclaveBadge}>
                🛡️ ZERO-CUSTODY CLIENT ENCLAVE
              </span>
              <span className={styles.latencyBadge}>⚡ {latency}ms</span>
              <span
                className={styles.statusBadge}
                data-mode={data?.mode || 'DEMO'}
              >
                {data?.mode === 'LIVE' ? '🟢 LIVE REAL MARKET' : '🧪 DEMO SANDBOX'}
              </span>
            </div>

            <h2 className={styles.heroTitle}>
              ศูนย์บัญชาการพอร์ตอัจฉริยะ (Smart Equity Desk)
            </h2>
            <p className={styles.heroSubtitle}>
              วิเคราะห์เทรนด์ Stage 2 อัตโนมัติ · เฝ้าระวังจุด Trailing Stop เรียลไทม์ · ตรวจสอบความคุ้มค่า DR หุ้นโลก
            </p>
            <div className={styles.partnerBadgeRow}>
              <span className={styles.partnerKicker}>พันธมิตรโบรกเกอร์อย่างเป็นทางการ:</span>
              <button
                type="button"
                className={`${styles.partnerChip} ${(data?.brokerId || brokerId) === '003' ? styles.partnerChipActivePi : ''}`}
                onClick={() => syncPortfolio(true, '003')}
              >
                🥧 บล.พาย Pi (003)
              </button>
              <button
                type="button"
                className={`${styles.partnerChip} ${(data?.brokerId || brokerId) === '022' ? styles.partnerChipActiveTrinity : ''}`}
                onClick={() => syncPortfolio(true, '022')}
              >
                🌟 บล.ทรีนีตี้ Trinity (022)
              </button>
              <button
                type="button"
                className={`${styles.partnerChip} ${(data?.brokerId || brokerId) === '050' ? styles.partnerChipActiveAsl : ''}`}
                onClick={() => syncPortfolio(true, '050')}
              >
                ⚡ บล.เอเอสแอล ASL (050)
              </button>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.btnSync}
              onClick={() => syncPortfolio(data?.mode === 'DEMO')}
              disabled={loading}
            >
              {loading ? 'กำลังซิงค์...' : '🔄 ซิงค์พอร์ต'}
            </button>
            <button
              type="button"
              className={styles.btnPrimaryApi}
              onClick={() => openApiModal()}
            >
              ⚡ เชื่อมต่อพอร์ต API
            </button>
            <button
              type="button"
              className={styles.btnExistingPortLead}
              onClick={() => openLeadModal('003', 'existing_port')}
            >
              👤 มีพอร์ตแล้ว? แจ้งเลขพอร์ต VIP
            </button>
            <button
              type="button"
              className={styles.btnVipLead}
              onClick={() => openLeadModal('003', 'new_account')}
            >
              👑 เปิดพอร์ตใหม่ VIP
            </button>
          </div>
        </header>

        {/* Error Notification */}
        {error && (
          <div className={styles.errorAlert}>
            <span>⚠️ {error}</span>
            <div className={styles.errorActions}>
              <button
                type="button"
                className={styles.errorBtn}
                onClick={() => syncPortfolio(true, '022')}
              >
                สลับกลับโหมด Sandbox
              </button>
              <button
                type="button"
                className={styles.errorBtnVip}
                onClick={() => openLeadModal('003')}
              >
                👑 เปิดพอร์ตใหม่กับพาร์ทเนอร์
              </button>
            </div>
          </div>
        )}

        {/* ─── 1.5 PROMINENT BROKER PARTNER & VIP ONBOARDING HUB ─── */}
        <section className={styles.partnerHubSection}>
          <div className={styles.partnerHubHeader}>
            <div className={styles.partnerHubTitleGroup}>
              <span className={styles.partnerHubBadge}>🏛️ ศูนย์บริการบัญชีหุ้นและพันธมิตรโบรกเกอร์ (Broker Partner &amp; VIP Hub)</span>
              <h3 className={styles.partnerHubHeading}>
                เปิดพอร์ตใหม่ หรือ แจ้งเลขพอร์ตเดิม ปลดล็อกสิทธิ์ VIP ใช้งานฟรีทันที
              </h3>
              <p className={styles.partnerHubSub}>
                ร่วมมือกับ 3 บริษัทหลักทรัพย์ชั้นนำ บล.พาย (003), บล.ทรีนีตี้ (022) และ บล.เอเอสแอล (050) เพื่อมอบสิทธิ์ใช้งาน AI Core Engine, เชื่อมต่อพอร์ตสด Settrade Open API และมีผู้เชี่ยวชาญ IC ดูแลส่วนบุคคล
              </p>
            </div>
            <div className={styles.partnerHubQuickActions}>
              <button
                type="button"
                className={styles.partnerHubQuickBtnExisting}
                onClick={() => openLeadModal('003', 'existing_port')}
              >
                👤 มีพอร์ตแล้ว? แจ้งเลขพอร์ต VIP
              </button>
              <button
                type="button"
                className={styles.partnerHubQuickBtnNew}
                onClick={() => openLeadModal('003', 'new_account')}
              >
                ✨ ยังไม่มีพอร์ต? ขอเปิดบัญชีใหม่
              </button>
            </div>
          </div>

          <div className={styles.partnerShowcaseGrid}>
            {/* Pi Card */}
            <div className={`${styles.partnerShowcaseCard} ${styles.cardPiGlow}`}>
              <div className={styles.partnerShowcaseTop}>
                <div className={styles.partnerBrandInfo}>
                  <span className={styles.brokerTagPi}>003 · PI FINANCIAL</span>
                  <h4 className={styles.brokerBrandName}>บล.พาย (Pi Securities)</h4>
                </div>
                <span className={styles.brokerEmblemPi}>🥧</span>
              </div>
              <p className={styles.partnerBrandDesc}>
                แอป Pi Financial ซื้อขายหุ้นไทย &amp; DR ระดับโลก มาร์เก็ตติ้งส่วนตัวดูแลเอกสารรวดเร็ว
              </p>
              <ul className={styles.partnerPerksList}>
                <li><span className={styles.perkCheckPi}>✓</span> สิทธิ์ VIP สแกนหุ้นโมเมนตัมฟรี</li>
                <li><span className={styles.perkCheckPi}>✓</span> เทรด DR สากลด้วยเงินบาทสะดวกสบาย</li>
                <li><span className={styles.perkCheckPi}>✓</span> ทีมงาน IC ติดต่ออำนวยความสะดวกตรง</li>
              </ul>
              <div className={styles.partnerCardActions}>
                <button
                  type="button"
                  className={styles.partnerCardBtnExistingPi}
                  onClick={() => openLeadModal('003', 'existing_port')}
                >
                  👤 แจ้งเลขพอร์ตพาย
                </button>
                <button
                  type="button"
                  className={styles.partnerCardBtnNewPi}
                  onClick={() => openLeadModal('003', 'new_account')}
                >
                  ✨ เปิดบัญชีใหม่
                </button>
              </div>
            </div>

            {/* Trinity Card */}
            <div className={`${styles.partnerShowcaseCard} ${styles.cardTrinityGlow}`}>
              <div className={styles.partnerShowcaseTop}>
                <div className={styles.partnerBrandInfo}>
                  <span className={styles.brokerTagTrinity}>022 · TRINITY</span>
                  <h4 className={styles.brokerBrandName}>บล.ทรีนีตี้ (Trinity Securities)</h4>
                </div>
                <span className={styles.brokerEmblemTrinity}>🌟</span>
              </div>
              <p className={styles.partnerBrandDesc}>
                โบรกเกอร์ชั้นนำ บทวิเคราะห์แม่นยำ พร้อมเชื่อมต่อ Settrade Open API พอร์ตสดได้ทันที
              </p>
              <ul className={styles.partnerPerksList}>
                <li><span className={styles.perkCheckTrinity}>✓</span> สิทธิ์เชื่อมต่อ Settrade Open API เต็มระบบ</li>
                <li><span className={styles.perkCheckTrinity}>✓</span> วิเคราะห์พอร์ต Zero-Custody ไม่เก็บรหัส</li>
                <li><span className={styles.perkCheckTrinity}>✓</span> ทีมงาน Algorithm และ AI ช่วยดูแล</li>
              </ul>
              <div className={styles.partnerCardActions}>
                <button
                  type="button"
                  className={styles.partnerCardBtnExistingTrinity}
                  onClick={() => openLeadModal('022', 'existing_port')}
                >
                  👤 แจ้งเลขพอร์ตทรีนีตี้
                </button>
                <button
                  type="button"
                  className={styles.partnerCardBtnNewTrinity}
                  onClick={() => openLeadModal('022', 'new_account')}
                >
                  ✨ เปิดบัญชีใหม่
                </button>
              </div>
            </div>

            {/* ASL Card */}
            <div className={`${styles.partnerShowcaseCard} ${styles.cardAslGlow}`}>
              <div className={styles.partnerShowcaseTop}>
                <div className={styles.partnerBrandInfo}>
                  <span className={styles.brokerTagAsl}>050 · ASL SECURITIES</span>
                  <h4 className={styles.brokerBrandName}>บล.เอเอสแอล (ASL Securities)</h4>
                </div>
                <span className={styles.brokerEmblemAsl}>⚡</span>
              </div>
              <p className={styles.partnerBrandDesc}>
                โบรกเกอร์นวัตกรรมใหม่ เทรดไว ค่าคอมคุ้มค่า รองรับ Streaming &amp; Open API
              </p>
              <ul className={styles.partnerPerksList}>
                <li><span className={styles.perkCheckAsl}>✓</span> อัตราค่าคอมมิชชั่นสุดคุ้มค่า</li>
                <li><span className={styles.perkCheckAsl}>✓</span> สิทธิ์ใช้งานห้องสัญญาณ VIP ฟรี</li>
                <li><span className={styles.perkCheckAsl}>✓</span> มาร์เก็ตติ้งส่วนตัวดูแลสิทธิพิเศษ</li>
              </ul>
              <div className={styles.partnerCardActions}>
                <button
                  type="button"
                  className={styles.partnerCardBtnExistingAsl}
                  onClick={() => openLeadModal('050', 'existing_port')}
                >
                  👤 แจ้งเลขพอร์ตเอเอสแอล
                </button>
                <button
                  type="button"
                  className={styles.partnerCardBtnNewAsl}
                  onClick={() => openLeadModal('050', 'new_account')}
                >
                  ✨ เปิดบัญชีใหม่
                </button>
              </div>
            </div>
          </div>

          {/* ─── INLINE LIQUID GLASS VIP CONCIERGE & API STUDIO ─── */}
          <div id="vip-inline-studio" className={styles.inlineStudioSurface}>
            <div className={styles.suiteNav}>
              <button
                type="button"
                className={`${styles.suiteNavTab} ${studioMode === 'lead' && leadType === 'existing_port' ? styles.suiteNavTabActiveLead : ''}`}
                onClick={() => {
                  setStudioMode('lead');
                  setLeadType('existing_port');
                  setLeadSuccess(null);
                }}
              >
                <span>👤 มีพอร์ตแล้ว · แจ้งเลขพอร์ตรับสิทธิ์ VIP</span>
                <span className={styles.recBadge}>ไม่ต้องย้ายโบรค</span>
              </button>
              <button
                type="button"
                className={`${styles.suiteNavTab} ${studioMode === 'lead' && leadType === 'new_account' ? styles.suiteNavTabActiveLead : ''}`}
                onClick={() => {
                  setStudioMode('lead');
                  setLeadType('new_account');
                  setLeadSuccess(null);
                }}
              >
                <span>👑 ยังไม่มีพอร์ต · ขอเปิดบัญชีใหม่ VIP</span>
              </button>
              <button
                type="button"
                className={`${styles.suiteNavTab} ${studioMode === 'api' ? styles.suiteNavTabActiveApi : ''}`}
                onClick={() => setStudioMode('api')}
              >
                <span>⚡ ผูกพอร์ตจริง Settrade API</span>
              </button>
            </div>

            {studioMode === 'lead' && (
              <div className={styles.tabContent}>
                {leadSuccess ? (
                  <div className={styles.vipSuccessState}>
                    <div className={styles.vipSuccessIcon}>
                      {leadSuccess.leadType === 'existing_port' ? '🛡️' : '👑'}
                    </div>
                    <h3 className={styles.vipSuccessHeading}>
                      {leadSuccess.leadType === 'existing_port'
                        ? 'แจ้งเลขพอร์ตยืนยันสิทธิ์ VIP เรียบร้อยแล้ว!'
                        : 'ยื่นคำขอเปิดพอร์ต VIP เรียบร้อยแล้ว!'}
                    </h3>
                    <div className={styles.leadIdChip}>รหัสคำขอ: {leadSuccess.leadId}</div>
                    <p className={styles.vipSuccessDesc}>
                      {leadSuccess.leadType === 'existing_port' ? (
                        <>
                          ข้อมูลเลขพอร์ต <strong style={{ color: '#38bdf8' }}>{leadSuccess.accountNo || leadAccountNo}</strong> ถูกส่งตรงถึงทีมมาร์เก็ตติ้งของ{' '}
                          <strong style={{ color: leadSuccess.brokerId === '003' ? '#c084fc' : leadSuccess.brokerId === '050' ? '#fbbf24' : '#38bdf8' }}>
                            {leadSuccess.brokerName}
                          </strong>{' '}
                          เรียบร้อยแล้ว เจ้าหน้าที่ IC จะตรวจสอบเลขพอร์ตและเปิดสิทธิ์การใช้งาน VIP ให้ท่านทันที
                        </>
                      ) : (
                        <>
                          ข้อมูลของท่านถูกส่งตรงถึงหัวหน้าทีมมาร์เก็ตติ้งของ{' '}
                          <strong style={{ color: leadSuccess.brokerId === '003' ? '#c084fc' : leadSuccess.brokerId === '050' ? '#fbbf24' : '#38bdf8' }}>
                            {leadSuccess.brokerName}
                          </strong>{' '}
                          เรียบร้อยแล้ว เจ้าหน้าที่ IC จะติดต่อท่านเพื่อดูแลการเปิดพอร์ตแบบ Fast-track
                        </>
                      )}
                    </p>
                    {/* Instant Trial Banner */}
                    <div className={styles.trialActivatedBadge}>
                      <span style={{ fontSize: '16px' }}>🌟</span>
                      <div>
                        <strong>เปิดสิทธิ์ใช้งาน VIP Pro Trial 14 วันบนเครื่องของคุณแล้ว!</strong>
                        <div style={{ fontSize: '11px', opacity: 0.85 }}>เข้าถึงระบบสแกนหุ้น Stage 2, คำนวณ 2R Sizing และเรดาร์สัญญาณได้ทันที</div>
                      </div>
                    </div>

                    {/* Telegram VIP Closed-Loop Invite Card */}
                    {(leadSuccess.inviteLink || manualInviteLink) ? (
                      <div className={styles.telegramVipCard}>
                        <div className={styles.telegramVipHeader}>
                          <strong>✈️ ลิงก์เข้ากลุ่ม Telegram VIP พิเศษเฉพาะคุณ</strong>
                          <span>1 สิทธิ์ / 24 ชม.</span>
                        </div>
                        <p className={styles.telegramVipDesc}>
                          รับการแจ้งเตือนสัญญาณหุ้นไทย โพยเช้า 09:30, หุ้นการบ้าน 17:30, DR หุ้นนอก และ TFEX แบบ Real-time ทันทีที่ระบบพบจังหวะ
                        </p>
                        <div className={styles.telegramActionRow}>
                          <a
                            href={leadSuccess.inviteLink || manualInviteLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.telegramJoinBtn}
                          >
                            🚀 เปิด Telegram เพื่อเข้ากลุ่มทันที ↗
                          </a>
                          <button
                            type="button"
                            className={styles.telegramCopyBtn}
                            onClick={() => handleCopyInvite(leadSuccess.inviteLink || manualInviteLink)}
                          >
                            {copiedInvite ? '✓ คัดลอกลิงก์แล้ว' : '📋 คัดลอกลิงก์'}
                          </button>
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '10px', color: '#94a3b8' }}>
                          * ลิงก์ใช้ได้ 1 ครั้งสำหรับบัญชี Telegram ของท่าน เพื่อความปลอดภัยและสงวนสิทธิ์เฉพาะสมาชิก
                        </div>
                      </div>
                    ) : (
                      <div className={styles.telegramVipCard}>
                        <div className={styles.telegramVipHeader}>
                          <strong>✈️ รับลิงก์เข้ากลุ่ม Telegram VIP</strong>
                        </div>
                        <p className={styles.telegramVipDesc}>
                          กดรับลิงก์เชิญพิเศษ 1-Time Invite เพื่อเข้าร่วมกลุ่มแจ้งเตือนสัญญาณเทรดและแผนประจำวัน
                        </p>
                        <button
                          type="button"
                          className={styles.telegramJoinBtn}
                          onClick={() => handleFetchInvite(leadSuccess.leadId)}
                          disabled={inviteLoading}
                        >
                          {inviteLoading ? 'กำลังสร้างลิงก์เชิญ…' : '✈️ กดรับลิงก์เข้ากลุ่ม Telegram VIP ทันที'}
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      className={styles.btnPrimaryVip}
                      onClick={() => setLeadSuccess(null)}
                      style={{ maxWidth: '320px', width: '100%' }}
                    >
                      ✓ ส่งคำขอเพิ่มหรือกลับหน้าแบบฟอร์ม
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleLeadSubmit} className={styles.leadForm}>
                    <div className={styles.brokerPickGrid}>
                      <div
                        className={`${styles.brokerPickCard} ${styles.cardPi} ${leadBroker === '003' ? styles.brokerPickCardActivePi : ''}`}
                        onClick={() => setLeadBroker('003')}
                      >
                        <div className={styles.brokerPickHeader}>
                          <span className={styles.brokerLogoBadgePi}>🥧 บล.พาย (003)</span>
                          <span className={leadBroker === '003' ? styles.chosenIndicatorPi : styles.unchosenIndicator}>
                            {leadBroker === '003' ? '🟢 ✓ กำลังเลือก' : 'คลิกเลือก'}
                          </span>
                        </div>
                        <strong className={styles.brokerTitle}>Pi Securities (มหาชน)</strong>
                        <p className={styles.brokerDesc}>เทรดหุ้นไทย &amp; DR โลก ผ่านแอป Pi Financial มาร์เก็ตติ้งดูแล VIP</p>
                      </div>

                      <div
                        className={`${styles.brokerPickCard} ${styles.cardTrinity} ${leadBroker === '022' ? styles.brokerPickCardActiveTrinity : ''}`}
                        onClick={() => setLeadBroker('022')}
                      >
                        <div className={styles.brokerPickHeader}>
                          <span className={styles.brokerLogoBadgeTrinity}>🌟 บล.ทรีนีตี้ (022)</span>
                          <span className={leadBroker === '022' ? styles.chosenIndicatorTrinity : styles.unchosenIndicator}>
                            {leadBroker === '022' ? '🟢 ✓ กำลังเลือก' : 'คลิกเลือก'}
                          </span>
                        </div>
                        <strong className={styles.brokerTitle}>Trinity Securities</strong>
                        <p className={styles.brokerDesc}>บทวิเคราะห์สถิติแม่นยำ พร้อมเชื่อมต่อ Settrade Open API เต็มระบบ</p>
                      </div>

                      <div
                        className={`${styles.brokerPickCard} ${styles.cardAsl} ${leadBroker === '050' ? styles.brokerPickCardActiveAsl : ''}`}
                        onClick={() => setLeadBroker('050')}
                      >
                        <div className={styles.brokerPickHeader}>
                          <span className={styles.brokerLogoBadgeAsl}>⚡ บล.เอเอสแอล (050)</span>
                          <span className={leadBroker === '050' ? styles.chosenIndicatorAsl : styles.unchosenIndicator}>
                            {leadBroker === '050' ? '🟢 ✓ กำลังเลือก' : 'คลิกเลือก'}
                          </span>
                        </div>
                        <strong className={styles.brokerTitle}>ASL Securities</strong>
                        <p className={styles.brokerDesc}>เทรดไว ค่าคอมคุ้มค่า พร้อม Settrade Streaming &amp; Open API</p>
                      </div>
                    </div>

                    <div className={styles.formFieldsBox}>
                      {leadType === 'existing_port' && (
                        <div className={styles.accountNoHighlightBox}>
                          <div className={styles.accountNoHeader}>
                            <label className={styles.inputLabelBold}>
                              🏷️ เลขที่บัญชีซื้อขายหุ้น (Account Number) *
                            </label>
                            <span className={styles.accountNoBrokerPill}>
                              บล.{leadBroker === '003' ? 'พาย (003)' : leadBroker === '022' ? 'ทรีนีตี้ (022)' : 'เอเอสแอล (050)'}
                            </span>
                          </div>
                          <div className={styles.inputWrapLarge}>
                            <input
                              type="text"
                              required
                              className={styles.textInputLarge}
                              placeholder="กรอกเลขพอร์ต 6-8 หลักของท่าน เช่น 99242240"
                              value={leadAccountNo}
                              onChange={(e) => setLeadAccountNo(e.target.value)}
                            />
                          </div>
                          <p className={styles.accountNoHelper}>
                            🔒 ข้อมูลเลขพอร์ตส่งตรงให้เจ้าหน้าที่ บล.{leadBroker === '003' ? 'พาย' : leadBroker === '022' ? 'ทรีนีตี้' : 'เอเอสแอล'} ตรวจสอบยืนยันสิทธิ์ VIP เท่านั้น (เฉพาะทีมโบรคของท่านที่เห็นข้อมูลนี้)
                          </p>
                        </div>
                      )}

                      <div className={styles.inputTwoCol}>
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>ชื่อ - นามสกุล *</label>
                          <div className={styles.inputWrap}>
                            <span className={styles.inputIcon}>👤</span>
                            <input
                              type="text"
                              required
                              className={styles.textInput}
                              placeholder="เช่น สมชาย ใจดี"
                              value={leadName}
                              onChange={(e) => setLeadName(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>เบอร์โทรศัพท์มือถือ *</label>
                          <div className={styles.inputWrap}>
                            <span className={styles.inputIcon}>📞</span>
                            <input
                              type="tel"
                              required
                              className={styles.textInput}
                              placeholder="เช่น 0812345678"
                              value={leadPhone}
                              onChange={(e) => setLeadPhone(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className={styles.inputTwoCol} style={{ marginTop: '12px' }}>
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>LINE ID (สำหรับเจ้าหน้าที่ติดต่อกลับ)</label>
                          <div className={styles.inputWrap}>
                            <span className={styles.inputIcon}>💬</span>
                            <input
                              type="text"
                              className={styles.textInput}
                              placeholder="เช่น somchai_trader"
                              value={leadLine}
                              onChange={(e) => setLeadLine(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>หมายเหตุเพิ่มเติม / เวลาที่สะดวก</label>
                          <div className={styles.inputWrap}>
                            <span className={styles.inputIcon}>📝</span>
                            <input
                              type="text"
                              className={styles.textInput}
                              placeholder={leadType === 'existing_port' ? 'เช่น มีพอร์ตอยู่แล้ว ต้องการเปิดสิทธิ์ VIP' : 'เช่น สนใจเปิดพอร์ตเทรดหุ้นไทยและ DR'}
                              value={leadNotes}
                              onChange={(e) => setLeadNotes(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className={styles.inputGroup} style={{ marginTop: '14px' }}>
                        <label className={styles.inputLabel}>สินทรัพย์และบริการที่ท่านสนใจ</label>
                        <div className={styles.interestChipsRow}>
                          {INTEREST_OPTIONS.map((opt) => {
                            const isSelected = leadInterests.includes(opt.id);
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                className={`${styles.interestChip} ${isSelected ? styles.interestChipActive : ''}`}
                                onClick={() => handleInterestToggle(opt.id)}
                              >
                                <span>{opt.label}</span>
                                <b>{isSelected ? '✓' : '+'}</b>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {leadError && <div className={styles.leadErrorBar}>⚠️ {leadError}</div>}

                    <div className={styles.formFooterRow}>
                      <button
                        type="submit"
                        className={styles.btnPrimaryVip}
                        disabled={leadSubmitting || !leadName.trim() || !leadPhone.trim() || (leadType === 'existing_port' && !leadAccountNo.trim())}
                      >
                        {leadSubmitting
                          ? 'กำลังส่งข้อมูลให้เจ้าหน้าที่...'
                          : leadType === 'existing_port'
                            ? `👤 ยืนยันแจ้งเลขพอร์ตรับสิทธิ์ VIP (${leadBroker === '003' ? 'บล.พาย 003' : leadBroker === '022' ? 'บล.ทรีนีตี้ 022' : 'บล.เอเอสแอล 050'})`
                            : `👑 ยืนยันขอเปิดบัญชีใหม่ VIP (${leadBroker === '003' ? 'บล.พาย 003' : leadBroker === '022' ? 'บล.ทรีนีตี้ 022' : 'บล.เอเอสแอล 050'})`}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {studioMode === 'api' && (
              <div className={styles.tabContent}>
                <div className={styles.brokerPickGrid}>
                  <div
                    className={`${styles.brokerPickCard} ${styles.cardPi} ${brokerId === '003' ? styles.brokerPickCardActivePi : ''}`}
                    onClick={() => setBrokerId('003')}
                  >
                    <div className={styles.brokerPickHeader}>
                      <span className={styles.brokerLogoBadgePi}>🥧 บล.พาย (003)</span>
                      <span className={brokerId === '003' ? styles.chosenIndicatorPi : styles.unchosenIndicator}>
                        {brokerId === '003' ? '🟢 ✓ กำลังเลือก' : 'คลิกเลือก'}
                      </span>
                    </div>
                    <strong className={styles.brokerTitle}>Pi Securities (003)</strong>
                  </div>
                  <div
                    className={`${styles.brokerPickCard} ${styles.cardTrinity} ${brokerId === '022' ? styles.brokerPickCardActiveTrinity : ''}`}
                    onClick={() => setBrokerId('022')}
                  >
                    <div className={styles.brokerPickHeader}>
                      <span className={styles.brokerLogoBadgeTrinity}>🌟 บล.ทรีนีตี้ (022)</span>
                      <span className={brokerId === '022' ? styles.chosenIndicatorTrinity : styles.unchosenIndicator}>
                        {brokerId === '022' ? '🟢 ✓ กำลังเลือก' : 'คลิกเลือก'}
                      </span>
                    </div>
                    <strong className={styles.brokerTitle}>Trinity Securities (022)</strong>
                  </div>
                  <div
                    className={`${styles.brokerPickCard} ${styles.cardAsl} ${brokerId === '050' ? styles.brokerPickCardActiveAsl : ''}`}
                    onClick={() => setBrokerId('050')}
                  >
                    <div className={styles.brokerPickHeader}>
                      <span className={styles.brokerLogoBadgeAsl}>⚡ บล.เอเอสแอล (050)</span>
                      <span className={brokerId === '050' ? styles.chosenIndicatorAsl : styles.unchosenIndicator}>
                        {brokerId === '050' ? '🟢 ✓ กำลังเลือก' : 'คลิกเลือก'}
                      </span>
                    </div>
                    <strong className={styles.brokerTitle}>ASL Securities (050)</strong>
                  </div>
                </div>

                <div className={styles.formFieldsBox}>
                  <div className={styles.inputTwoCol}>
                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>เลขบัญชีซื้อขายหุ้น (Account Number) *</label>
                      <div className={styles.inputWrap}>
                        <span className={styles.inputIcon}>🏷️</span>
                        <input
                          type="text"
                          autoComplete="off"
                          className={styles.textInput}
                          placeholder="เช่น 99242240"
                          value={accountNo}
                          onChange={(e) => setAccountNo(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>App ID (Settrade Open API) *</label>
                      <div className={styles.inputWrap}>
                        <span className={styles.inputIcon}>🔑</span>
                        <input
                          type="text"
                          autoComplete="off"
                          className={styles.textInput}
                          placeholder="กรอก App ID"
                          value={appId}
                          onChange={(e) => setAppId(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className={styles.inputGroup} style={{ marginTop: '12px' }}>
                    <label className={styles.inputLabel}>API Secret (Zero-Custody Enclave) *</label>
                    <div className={styles.inputWrap}>
                      <span className={styles.inputIcon}>🔒</span>
                      <input
                        type={showSecret ? 'text' : 'password'}
                        autoComplete="off"
                        className={styles.textInput}
                        style={{ paddingRight: '45px' }}
                        placeholder="กรอก API Secret"
                        value={appSecret}
                        onChange={(e) => setAppSecret(e.target.value)}
                      />
                      <button
                        type="button"
                        className={styles.eyeBtn}
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        {showSecret ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles.formFooterRow}>
                  <button
                    type="button"
                    className={styles.btnPrimaryApiSubmit}
                    onClick={() => syncPortfolio(false)}
                    disabled={loading || !accountNo.trim() || !appId.trim() || !appSecret.trim()}
                  >
                    {loading ? 'กำลังเชื่อมต่อ Settrade...' : '⚡ ยืนยันเชื่อมต่อพอร์ตจริง'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ─── 2. TRIO INTELLIGENCE COCKPIT (3 HIGH-IMPACT GLASS TILES) ─── */}
        <div className={styles.trioCockpitGrid}>
          {/* Tile 1: Net Asset Value & Purchasing Power */}
          <div className={styles.cockpitTile}>
            <div className={styles.tileHeader}>
              <span className={styles.tileLabel}>มูลค่าพอร์ตสุทธิ (NET EQUITY)</span>
              <span className={styles.tileIcon}>💰</span>
            </div>
            <div className={styles.tileValueRow}>
              <span className={styles.tileBigValue}>
                ฿{data?.equity?.toLocaleString('th-TH') || '0'}
              </span>
              <span
                className={`${styles.plBadge} ${
                  (data?.totalUnrealizedPl || 0) >= 0 ? styles.plPositive : styles.plNegative
                }`}
              >
                {(data?.totalUnrealizedPl || 0) >= 0 ? '+' : ''}
                ฿{data?.totalUnrealizedPl?.toLocaleString('th-TH')} (
                {(data?.totalUnrealizedPlPct || 0) >= 0 ? '+' : ''}
                {data?.totalUnrealizedPlPct}%)
              </span>
            </div>
            <div className={styles.tileFooter}>
              <span>วงเงินพร้อมซื้อ: ฿{data?.lineAvailable?.toLocaleString('th-TH') || '0'}</span>
              <span>•</span>
              <span>มูลค่าหุ้นในตลาด: ฿{data?.totalMarketValue?.toLocaleString('th-TH') || '0'}</span>
            </div>
          </div>

          {/* Tile 2: Minervini Stage 2 Health Matrix */}
          <div className={styles.cockpitTile}>
            <div className={styles.tileHeader}>
              <span className={styles.tileLabel}>คะแนนสุขภาพพอร์ต (STAGE HEALTH)</span>
              <span className={styles.tileIcon}>🌟</span>
            </div>
            <div className={styles.tileValueRow}>
              <span className={styles.tileBigValue} style={{ color: '#34d399' }}>
                {data?.health?.score ?? 82}
                <small style={{ fontSize: '15px', color: '#94a3b8', fontWeight: 500 }}> / 100</small>
              </span>
              <span className={styles.gradeBadge}>
                {data?.health?.grade || 'เกรด A ขาขึ้นแข็งแกร่ง'}
              </span>
            </div>
            <div className={styles.stageBarWrapper}>
              <div
                className={styles.stageBarSegmentUp}
                style={{ width: `${data?.health?.stage2RatioPct ?? 66.6}%` }}
                title={`Stage 2 ขาขึ้น: ${data?.health?.stage2RatioPct ?? 66.6}%`}
              />
              <div
                className={styles.stageBarSegmentDown}
                style={{ width: `${data?.health?.stage4DangerRatioPct ?? 11.7}%` }}
                title={`Stage 4 อันตราย: ${data?.health?.stage4DangerRatioPct ?? 11.7}%`}
              />
            </div>
            <div className={styles.stageLegendRow}>
              <span className={styles.stageLegendItemUp}>
                🟢 Stage 2 ขาขึ้น: {data?.health?.stage2RatioPct ?? 66.6}%
              </span>
              <span className={styles.stageLegendItemDown}>
                🔴 Stage 4 อันตราย: {data?.health?.stage4DangerRatioPct ?? 11.7}%
              </span>
            </div>
          </div>

          {/* Tile 3: Global Asset Allocation & FX Shield */}
          <div className={styles.cockpitTile}>
            <div className={styles.tileHeader}>
              <span className={styles.tileLabel}>สัดส่วนพอร์ต หุ้นไทย vs DR หุ้นโลก</span>
              <span className={styles.fxShieldPill}>
                💵 {data?.fxEnvironment?.usdThb || 34.25} บาท/USD
              </span>
            </div>
            <div className={styles.allocationTrack}>
              <div
                className={styles.trackThai}
                style={{ width: `${data?.allocation?.thaiStockPct || 62}%` }}
                title={`หุ้นไทย: ${data?.allocation?.thaiStockPct || 62}%`}
              />
              <div
                className={styles.trackDr}
                style={{ width: `${data?.allocation?.drStockPct || 38}%` }}
                title={`DR หุ้นโลก: ${data?.allocation?.drStockPct || 38}%`}
              />
            </div>
            <div className={styles.allocationPillRow}>
              <span className={styles.allocTagThai}>
                🇹🇭 หุ้นไทย {data?.allocation?.thaiStockPct || 62}% (฿{data?.allocation?.thaiStockValue?.toLocaleString('th-TH') || '0'})
              </span>
              <span className={styles.allocTagDr}>
                🌐 DR หุ้นโลก {data?.allocation?.drStockPct || 38}% (฿{data?.allocation?.drStockValue?.toLocaleString('th-TH') || '0'})
              </span>
            </div>
            <div className={styles.fxNotice}>
              💡 {data?.fxEnvironment?.impactSummary || 'ค่าเงินเสถียร ไม่มีความเสี่ยง FX กดดันมูลค่า DR'}
            </div>
          </div>
        </div>

        {/* ─── 3. FILTER CAPSULES & HOLDINGS TABLE ─── */}
        <div className={styles.holdingsSection}>
          <div className={styles.filterBar}>
            <div className={styles.filterPillsGroup}>
              <button
                type="button"
                className={`${styles.filterPill} ${filter === 'all' ? styles.filterPillActive : ''}`}
                onClick={() => setFilter('all')}
              >
                ทั้งหมด ({holdings.length})
              </button>
              <button
                type="button"
                className={`${styles.filterPill} ${filter === 'thai' ? styles.filterPillActive : ''}`}
                onClick={() => setFilter('thai')}
              >
                🇹🇭 หุ้นไทย ({holdings.filter((h) => h.market === 'THAI').length})
              </button>
              <button
                type="button"
                className={`${styles.filterPill} ${filter === 'dr' ? styles.filterPillActive : ''}`}
                onClick={() => setFilter('dr')}
              >
                🌐 DR หุ้นโลก ({holdings.filter((h) => h.market === 'DR').length})
              </button>
              <button
                type="button"
                className={`${styles.filterPill} ${filter === 'stage2' ? styles.filterPillActive : ''}`}
                onClick={() => setFilter('stage2')}
              >
                🟢 Stage 2 ขาขึ้น ({holdings.filter((h) => h.stage === 2).length})
              </button>
              <button
                type="button"
                className={`${styles.filterPill} ${filter === 'danger' ? styles.filterPillActive : ''}`}
                onClick={() => setFilter('danger')}
              >
                🔴 Stage 4 อันตราย ({holdings.filter((h) => h.stage === 4).length})
              </button>
            </div>
          </div>

          <div className={styles.tableGlassSurface}>
            <table className={styles.table}>
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
                  <th>กราฟ</th>
                </tr>
              </thead>
              <tbody>
                {filteredHoldings.map((item) => {
                  const isProfit = (item.unrealizedPl || 0) >= 0;
                  return (
                    <tr key={item.symbol} className={styles.tableRow}>
                      <td>
                        <div className={styles.symbolCell}>
                          <InstrumentLogo
                            asset={{
                              symbol: item.symbol,
                              market: item.market === 'DR' ? 'dr' : 'thai',
                              name: item.symbol,
                            }}
                          />
                          <div className={styles.symbolDetails}>
                            <div className={styles.symbolHeading}>
                              <span className={styles.symbolCode}>{item.symbol}</span>
                              {item.market === 'THAI' ? (
                                <span className={styles.marketBadgeThai}>{item.section || 'SET100'}</span>
                              ) : (
                                <span className={styles.marketBadgeDr}>DR-US</span>
                              )}
                            </div>
                            <span className={styles.sectorText}>{item.sector || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td className={styles.monoCell}>
                        {item.quantity?.toLocaleString('th-TH')} หุ้น
                      </td>
                      <td className={styles.monoCell}>
                        <div>{item.marketPrice ? `${item.marketPrice.toFixed(2)} ฿` : '—'}</div>
                        <small className={styles.costSub}>
                          ทุน {item.avgCost ? `${item.avgCost.toFixed(2)} ฿` : '—'}
                        </small>
                      </td>
                      <td className={styles.monoCell} style={{ fontWeight: 700 }}>
                        {item.marketValue ? `฿${item.marketValue.toLocaleString('th-TH')}` : '—'}
                      </td>
                      <td className={styles.monoCell}>
                        <div className={isProfit ? styles.positiveText : styles.negativeText}>
                          {item.unrealizedPl !== null
                            ? `${isProfit ? '+' : ''}฿${item.unrealizedPl.toLocaleString('th-TH')}`
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
                          <span className={styles.stageTagStage2}>
                            🟢 Stage 2 ขาขึ้นแข็งแกร่ง
                          </span>
                        )}
                        {item.stage === 1 && (
                          <span className={styles.stageTagStage1}>
                            🟡 Stage 1 สร้างฐานสะสม
                          </span>
                        )}
                        {item.stage === 4 && (
                          <span className={styles.stageTagStage4}>
                            🚨 Stage 4 ขาลงหลุดแนวรับ
                          </span>
                        )}
                        {!item.stage && (
                          <span className={styles.stageTagStage1}>
                            {item.stageName || 'รอประเมิน'}
                          </span>
                        )}
                      </td>
                      <td className={styles.monoCell}>
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
                        <div className={styles.prescriptionBox}>
                          {item.action?.includes('HOLD') && (
                            <span className={styles.rxHold}>💎 {item.action}</span>
                          )}
                          {item.action?.includes('TAKE PROFIT') && (
                            <span className={styles.rxTakeProfit}>🎯 {item.action}</span>
                          )}
                          {item.action?.includes('CUT') && (
                            <span className={styles.rxCutLoss}>🚨 {item.action}</span>
                          )}
                          {!item.action?.includes('HOLD') &&
                            !item.action?.includes('TAKE PROFIT') &&
                            !item.action?.includes('CUT') && (
                              <span className={styles.rxHold}>{item.action || 'ตรวจแผนจากกราฟ'}</span>
                            )}
                          <span className={styles.rxNote}>{item.actionNote}</span>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.chartLinkBtn}
                          onClick={() =>
                            onSelectSymbol?.({
                              symbol: item.symbol,
                              id: item.market === 'DR' ? 'dr' : 'thai',
                              name: item.name || item.symbol,
                            })
                          }
                        >
                          ดูกราฟ ↗
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── 4. DR ARBITRAGE & FAIR VALUE GUARD ─── */}
        {drHoldings.length > 0 && (
          <div className={styles.drGuardSection}>
            <div className={styles.drGuardHeader}>
              <div>
                <h3 className={styles.drGuardTitle}>
                  🌐 โต๊ะตรวจสอบความคุ้มค่า DR ต่างประเทศ (DR Arbitrage &amp; Fair Value Guard)
                </h3>
                <p className={styles.drGuardSub}>
                  คำนวณเปรียบเทียบจากราคาหุ้นแม่สหรัฐฯ สด + อัตราแลกเปลี่ยน USD/THB 34.25 แบบเรียลไทม์
                </p>
              </div>
            </div>

            <div className={styles.drGrid}>
              {drHoldings.map((dr) => (
                <div key={dr.symbol} className={styles.drCard}>
                  <div className={styles.drCardTop}>
                    <span className={styles.drSymbolText}>
                      {dr.symbol} ({dr.drMeta?.underlying || 'Global Stock'})
                    </span>
                    <span className={styles.drStatusBadge}>
                      {dr.drMeta?.fairStatus || 'FAIR VALUE'}
                    </span>
                  </div>
                  <div className={styles.drStatsRow}>
                    <div className={styles.drStatCol}>
                      <span className={styles.drStatLabel}>หุ้นแม่สหรัฐฯ</span>
                      <span className={styles.drStatVal}>
                        {dr.drMeta?.usPrice ? `$${dr.drMeta.usPrice.toFixed(2)}` : 'Realtime'}
                      </span>
                    </div>
                    <div className={styles.drStatCol}>
                      <span className={styles.drStatLabel}>ราคาเหมาะสม (Fair)</span>
                      <span className={styles.drStatVal}>
                        {dr.drMeta?.fairPrice ? `${dr.drMeta.fairPrice.toFixed(2)} ฿` : '—'}
                      </span>
                    </div>
                    <div className={styles.drStatCol}>
                      <span className={styles.drStatLabel}>สเปรดส่วนต่าง</span>
                      <span className={styles.drStatVal} style={{ color: '#34d399' }}>
                        {dr.drMeta?.spreadPct ? `+${dr.drMeta.spreadPct}%` : 'Fair'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.drCardFooter}>
                    <span>💡 {dr.drMeta?.fxImpact || 'อัตราแลกเปลี่ยน USD/THB ทรงตัว ไร้ความเสี่ยง FX'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ─── 5. REDESIGNED LUXURY ONBOARDING & CONNECTION SUITE (MODAL) ─── */}
      {modalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setModalOpen(false)}>
          <div className={styles.modalSuite} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.suiteCloseBtn}
              onClick={() => setModalOpen(false)}
            >
              ✕
            </button>

            {/* Segmented Modal Navigation */}
            <div className={styles.suiteNav}>
              <button
                type="button"
                className={`${styles.suiteNavTab} ${modalTab === 'lead' ? styles.suiteNavTabActiveLead : ''}`}
                onClick={() => setModalTab('lead')}
              >
                <span>👑 เปิดพอร์ต / ยืนยันสิทธิ์ VIP</span>
                <span className={styles.recBadge}>แนะนำ</span>
              </button>
              <button
                type="button"
                className={`${styles.suiteNavTab} ${modalTab === 'api' ? styles.suiteNavTabActiveApi : ''}`}
                onClick={() => setModalTab('api')}
              >
                <span>⚡ ผูกพอร์ต Settrade API</span>
              </button>
              <button
                type="button"
                className={`${styles.suiteNavTab} ${modalTab === 'demo' ? styles.suiteNavTabActiveDemo : ''}`}
                onClick={() => setModalTab('demo')}
              >
                <span>🧪 พอร์ตจำลอง Sandbox</span>
              </button>
            </div>

            {/* TAB CONTENT 1: VIP ACCOUNT OPENING & PORTFOLIO VERIFICATION (IB CONCIERGE) */}
            {modalTab === 'lead' && (
              <div className={styles.tabContent}>
                {leadSuccess ? (
                  leadSuccess.leadType === 'existing_port' ? (
                    <div className={styles.vipSuccessState}>
                      <div className={styles.vipSuccessIcon}>🛡️</div>
                      <h3 className={styles.vipSuccessHeading}>แจ้งเลขพอร์ตยืนยันสิทธิ์ VIP เรียบร้อยแล้ว!</h3>
                      <div className={styles.leadIdChip}>รหัสคำขอ: {leadSuccess.leadId}</div>
                      <p className={styles.vipSuccessDesc}>
                        ข้อมูลเลขพอร์ต <strong style={{ color: '#38bdf8' }}>{leadSuccess.accountNo || leadAccountNo}</strong> ถูกส่งตรงถึงหัวหน้าทีมมาร์เก็ตติ้งของ{' '}
                        <strong style={{ color: leadSuccess.brokerId === '003' ? '#c084fc' : leadSuccess.brokerId === '050' ? '#fbbf24' : '#38bdf8' }}>
                          {leadSuccess.brokerName}
                        </strong>{' '}
                        เรียบร้อยแล้ว เจ้าหน้าที่ IC จะทำการตรวจสอบเลขพอร์ตและเปิดสิทธิ์การใช้งาน VIP เต็มระบบให้ท่าน
                      </p>

                      {/* Instant Trial Banner */}
                      <div className={styles.trialActivatedBadge}>
                        <span style={{ fontSize: '16px' }}>🌟</span>
                        <div>
                          <strong>เปิดสิทธิ์ใช้งาน VIP Pro Trial 14 วันบนเครื่องของคุณแล้ว!</strong>
                          <div style={{ fontSize: '11px', opacity: 0.85 }}>เข้าถึงระบบสแกนหุ้น Stage 2, คำนวณ 2R Sizing และเรดาร์สัญญาณได้ทันที</div>
                        </div>
                      </div>

                      {/* Telegram VIP Closed-Loop Invite Card */}
                      {(leadSuccess.inviteLink || manualInviteLink) ? (
                        <div className={styles.telegramVipCard}>
                          <div className={styles.telegramVipHeader}>
                            <strong>✈️ ลิงก์เข้ากลุ่ม Telegram VIP พิเศษเฉพาะคุณ</strong>
                            <span>1 สิทธิ์ / 24 ชม.</span>
                          </div>
                          <p className={styles.telegramVipDesc}>
                            รับการแจ้งเตือนสัญญาณหุ้นไทย โพยเช้า 09:30, หุ้นการบ้าน 17:30, DR หุ้นนอก และ TFEX แบบ Real-time ทันที
                          </p>
                          <div className={styles.telegramActionRow}>
                            <a
                              href={leadSuccess.inviteLink || manualInviteLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.telegramJoinBtn}
                            >
                              🚀 เปิด Telegram เพื่อเข้ากลุ่มทันที ↗
                            </a>
                            <button
                              type="button"
                              className={styles.telegramCopyBtn}
                              onClick={() => handleCopyInvite(leadSuccess.inviteLink || manualInviteLink)}
                            >
                              {copiedInvite ? '✓ คัดลอกลิงก์แล้ว' : '📋 คัดลอกลิงก์'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.telegramVipCard}>
                          <div className={styles.telegramVipHeader}>
                            <strong>✈️ รับลิงก์เข้ากลุ่ม Telegram VIP</strong>
                          </div>
                          <button
                            type="button"
                            className={styles.telegramJoinBtn}
                            onClick={() => handleFetchInvite(leadSuccess.leadId)}
                            disabled={inviteLoading}
                          >
                            {inviteLoading ? 'กำลังสร้างลิงก์เชิญ…' : '✈️ กดรับลิงก์เข้ากลุ่ม Telegram VIP ทันที'}
                          </button>
                        </div>
                      )}

                      <div className={styles.timelineCard}>
                        <div className={styles.timelineRow}>
                          <div className={styles.timelineStepNumber}>1</div>
                          <div className={styles.timelineStepInfo}>
                            <strong>ระบบส่งเลขพอร์ตตรงถึงโบรกเกอร์</strong>
                            <span>ข้อมูลเลขบัญชีถูกส่งไปยังทีมมาร์เก็ตติ้งของโบรกเกอร์ทันที</span>
                          </div>
                        </div>
                        <div className={styles.timelineRow}>
                          <div className={styles.timelineStepNumber}>2</div>
                          <div className={styles.timelineStepInfo}>
                            <strong>มาร์เก็ตติ้ง IC ตรวจสอบเลขบัญชี</strong>
                            <span>เจ้าหน้าที่ตรวจสอบความถูกต้องและอนุมัติสิทธิ์ VIP ประจำตัว</span>
                          </div>
                        </div>
                        <div className={styles.timelineRow}>
                          <div className={styles.timelineStepNumber}>3</div>
                          <div className={styles.timelineStepInfo}>
                            <strong>ปลดล็อกสิทธิ์ VIP &amp; เชื่อมต่อระบบ AI ทันที</strong>
                            <span>รับสิทธิ์ใช้งานระบบสแกนหุ้น Stage 2, เรดาร์สัญญาณ และ Settrade Open API</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={styles.btnPrimaryVip}
                        onClick={() => setModalOpen(false)}
                        style={{ marginTop: '16px', width: '100%' }}
                      >
                        ✓ รับทราบและปิดหน้าต่าง
                      </button>
                    </div>
                  ) : (
                    <div className={styles.vipSuccessState}>
                      <div className={styles.vipSuccessIcon}>👑</div>
                      <h3 className={styles.vipSuccessHeading}>ยื่นคำขอเปิดพอร์ต VIP เรียบร้อยแล้ว!</h3>
                      <div className={styles.leadIdChip}>รหัสคำขอ: {leadSuccess.leadId}</div>
                      <p className={styles.vipSuccessDesc}>
                        ข้อมูลของท่านถูกส่งตรงถึงหัวหน้าทีมมาร์เก็ตติ้งของ{' '}
                        <strong style={{ color: leadSuccess.brokerId === '003' ? '#c084fc' : leadSuccess.brokerId === '050' ? '#fbbf24' : '#38bdf8' }}>
                          {leadSuccess.brokerName}
                        </strong>{' '}
                        เรียบร้อยแล้ว เจ้าหน้าที่ IC จะติดต่อท่านเป็นกรณีพิเศษเพื่อดูแลเรื่องเอกสารเปิดพอร์ต
                      </p>

                      {/* Instant Trial Banner */}
                      <div className={styles.trialActivatedBadge}>
                        <span style={{ fontSize: '16px' }}>🌟</span>
                        <div>
                          <strong>เปิดสิทธิ์ใช้งาน VIP Pro Trial 14 วันบนเครื่องของคุณแล้ว!</strong>
                          <div style={{ fontSize: '11px', opacity: 0.85 }}>เข้าถึงระบบสแกนหุ้น Stage 2, คำนวณ 2R Sizing และเรดาร์สัญญาณได้ทันที</div>
                        </div>
                      </div>

                      {/* Telegram VIP Closed-Loop Invite Card */}
                      {(leadSuccess.inviteLink || manualInviteLink) ? (
                        <div className={styles.telegramVipCard}>
                          <div className={styles.telegramVipHeader}>
                            <strong>✈️ ลิงก์เข้ากลุ่ม Telegram VIP พิเศษเฉพาะคุณ</strong>
                            <span>1 สิทธิ์ / 24 ชม.</span>
                          </div>
                          <p className={styles.telegramVipDesc}>
                            รับการแจ้งเตือนสัญญาณหุ้นไทย โพยเช้า 09:30, หุ้นการบ้าน 17:30, DR หุ้นนอก และ TFEX แบบ Real-time ทันที
                          </p>
                          <div className={styles.telegramActionRow}>
                            <a
                              href={leadSuccess.inviteLink || manualInviteLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.telegramJoinBtn}
                            >
                              🚀 เปิด Telegram เพื่อเข้ากลุ่มทันที ↗
                            </a>
                            <button
                              type="button"
                              className={styles.telegramCopyBtn}
                              onClick={() => handleCopyInvite(leadSuccess.inviteLink || manualInviteLink)}
                            >
                              {copiedInvite ? '✓ คัดลอกลิงก์แล้ว' : '📋 คัดลอกลิงก์'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.telegramVipCard}>
                          <div className={styles.telegramVipHeader}>
                            <strong>✈️ รับลิงก์เข้ากลุ่ม Telegram VIP</strong>
                          </div>
                          <button
                            type="button"
                            className={styles.telegramJoinBtn}
                            onClick={() => handleFetchInvite(leadSuccess.leadId)}
                            disabled={inviteLoading}
                          >
                            {inviteLoading ? 'กำลังสร้างลิงก์เชิญ…' : '✈️ กดรับลิงก์เข้ากลุ่ม Telegram VIP ทันที'}
                          </button>
                        </div>
                      )}

                      <div className={styles.timelineCard}>
                        <div className={styles.timelineRow}>
                          <div className={styles.timelineStepNumber}>1</div>
                          <div className={styles.timelineStepInfo}>
                            <strong>ระบบส่งข้อมูลตรงถึงโบรคเกอร์</strong>
                            <span>คำขอเปิดพอร์ต VIP ถูกส่งไปยังทีมมาร์เก็ตติ้งของโบรกเกอร์ทันที</span>
                          </div>
                        </div>
                        <div className={styles.timelineRow}>
                          <div className={styles.timelineStepNumber}>2</div>
                          <div className={styles.timelineStepInfo}>
                            <strong>มาร์เก็ตติ้งส่วนตัวติดต่อกลับ</strong>
                            <span>เจ้าหน้าที่แนะนำขั้นตอนการเปิดบัญชีและส่งเอกสารยืนยันตัวตนทางโทรศัพท์หรือ LINE</span>
                          </div>
                        </div>
                        <div className={styles.timelineRow}>
                          <div className={styles.timelineStepNumber}>3</div>
                          <div className={styles.timelineStepInfo}>
                            <strong>อนุมัติพอร์ต &amp; เชื่อมต่อระบบ AI ทันที</strong>
                            <span>เมื่อพอร์ตเปิดสำเร็จ รับสิทธิ์เชื่อมต่อ Settrade Open API พอร์ตสดและสิทธิ์ใช้งานเต็มรูปแบบ</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={styles.btnPrimaryVip}
                        onClick={() => setModalOpen(false)}
                        style={{ marginTop: '16px', width: '100%' }}
                      >
                        ✓ รับทราบและปิดหน้าต่าง
                      </button>
                    </div>
                  )
                ) : (
                  <form onSubmit={handleLeadSubmit} className={styles.leadForm}>
                    <div className={styles.formLeadHeader}>
                      <div className={styles.trustBadgesRow}>
                        <span className={styles.trustBadgeItem}>🛡️ โบรกเกอร์พันธมิตรทางการ</span>
                        <span className={styles.trustBadgeItem}>🔒 Zero-Custody ไร้ความเสี่ยง</span>
                        <span className={styles.trustBadgeItem}>⚡ อนุมัติสิทธิ์ VIP รวดเร็ว</span>
                      </div>
                      <h3 className={styles.modalHeading}>
                        {leadType === 'existing_port'
                          ? '👤 แจ้งเลขพอร์ตเพื่อรับสิทธิ์ VIP ใช้งานฟรี'
                          : '👑 ยื่นขอเปิดพอร์ต VIP กับโบรกเกอร์พันธมิตร'}
                      </h3>
                      <p className={styles.modalSubheading}>
                        {leadType === 'existing_port'
                          ? 'มีพอร์ตกับ บล.พาย (003), บล.ทรีนีตี้ (022) หรือ บล.เอเอสแอล (050) อยู่แล้ว แจ้งเลขพอร์ตเพื่อรับสิทธิ์ห้องสแกน AI และเชื่อมต่อ Open API โดยไม่ต้องย้ายโบรค'
                          : 'เปิดบัญชีใหม่กับ บล.พาย (003), บล.ทรีนีตี้ (022) หรือ บล.เอเอสแอล (050) เพื่อรับสิทธิ์ VIP ฟรี พร้อมทีมมาร์เก็ตติ้ง IC ดูแลส่วนบุคคล'}
                      </p>
                    </div>

                    {/* Liquid Glass Lead Type Switcher */}
                    <div className={styles.leadTypeSwitcher}>
                      <button
                        type="button"
                        className={`${styles.leadTypeBtn} ${leadType === 'existing_port' ? styles.leadTypeBtnActive : ''}`}
                        onClick={() => setLeadType('existing_port')}
                      >
                        <span className={styles.leadTypeBtnIcon}>👤</span>
                        <div className={styles.leadTypeBtnTextWrap}>
                          <strong>มีพอร์ตแล้ว</strong>
                          <small>แจ้งเลขพอร์ตรับสิทธิ์ VIP</small>
                        </div>
                      </button>
                      <button
                        type="button"
                        className={`${styles.leadTypeBtn} ${leadType === 'new_account' ? styles.leadTypeBtnActive : ''}`}
                        onClick={() => setLeadType('new_account')}
                      >
                        <span className={styles.leadTypeBtnIcon}>✨</span>
                        <div className={styles.leadTypeBtnTextWrap}>
                          <strong>ยังไม่มีพอร์ต</strong>
                          <small>ขอเปิดบัญชีหุ้นใหม่</small>
                        </div>
                      </button>
                    </div>

                    {/* Mode Guidance Card */}
                    <div className={styles.leadModeGuidanceCard}>
                      {leadType === 'existing_port' ? (
                        <p>
                          💡 <b>มีพอร์ตอยู่แล้ว:</b> เพียงเลือกโบรกเกอร์และระบุเลขพอร์ตของท่าน ข้อมูลจะถูกส่งตรงให้เจ้าหน้าที่โบรกเกอร์ตรวจสอบยืนยันสิทธิ์ VIP ให้ท่านทันที โดยไม่ต้องย้ายโบรค
                        </p>
                      ) : (
                        <p>
                          ✨ <b>เปิดบัญชีใหม่:</b> เจ้าหน้าที่ IC ของโบรกเกอร์จะติดต่อท่านเพื่อช่วยดูแลเรื่องเอกสารเปิดพอร์ตออนไลน์แบบ Fast-track พร้อมมอบสิทธิ์ VIP ทันทีที่พอร์ตเปิดสำเร็จ
                        </p>
                      )}
                    </div>

                    {/* Trio Interactive Broker Cards */}
                    <div className={styles.brokerPickGrid}>
                      <div
                        className={`${styles.brokerPickCard} ${styles.cardPi} ${leadBroker === '003' ? styles.brokerPickCardActivePi : ''}`}
                        onClick={() => setLeadBroker('003')}
                      >
                        <div className={styles.brokerPickHeader}>
                          <span className={styles.brokerLogoBadgePi}>🥧 บล.พาย (003)</span>
                          {leadBroker === '003' ? (
                            <span className={styles.chosenIndicatorPi}>🟢 ✓ กำลังเลือก</span>
                          ) : (
                            <span className={styles.unchosenIndicator}>⚪ คลิกเลือก</span>
                          )}
                        </div>
                        <strong className={styles.brokerTitle}>Pi Securities (มหาชน)</strong>
                        <p className={styles.brokerDesc}>
                          แอป Pi Financial ซื้อขายหุ้นไทย &amp; DR ทั่วโลก มาร์เก็ตติ้งดูแลส่วนตัวระดับ VIP
                        </p>
                        <div className={styles.perkList}>
                          <span>✓ มาร์เก็ตติ้งโทร/ไลน์ดูแลเอกสารเปิดบัญชี</span>
                          <span>✓ สิทธิ์เข้าห้องสแกนหุ้น Stage 2 อัจฉริยะ</span>
                        </div>
                      </div>

                      <div
                        className={`${styles.brokerPickCard} ${styles.cardTrinity} ${leadBroker === '022' ? styles.brokerPickCardActiveTrinity : ''}`}
                        onClick={() => setLeadBroker('022')}
                      >
                        <div className={styles.brokerPickHeader}>
                          <span className={styles.brokerLogoBadgeTrinity}>🌟 บล.ทรีนีตี้ (022)</span>
                          {leadBroker === '022' ? (
                            <span className={styles.chosenIndicatorTrinity}>🟢 ✓ กำลังเลือก</span>
                          ) : (
                            <span className={styles.unchosenIndicator}>⚪ คลิกเลือก</span>
                          )}
                        </div>
                        <strong className={styles.brokerTitle}>Trinity Securities</strong>
                        <p className={styles.brokerDesc}>
                          โบรกเกอร์ชั้นนำ บทวิเคราะห์สถิติแม่นยำ พร้อม Settrade Open API เต็มระบบ
                        </p>
                        <div className={styles.perkList}>
                          <span>✓ ทีมงานมาร์เก็ตติ้งและ Algorithm ดูแลตรง</span>
                          <span>✓ สิทธิ์เชื่อมต่อระบบความปลอดภัย Zero-Custody Enclave</span>
                        </div>
                      </div>

                      <div
                        className={`${styles.brokerPickCard} ${styles.cardAsl} ${leadBroker === '050' ? styles.brokerPickCardActiveAsl : ''}`}
                        onClick={() => setLeadBroker('050')}
                      >
                        <div className={styles.brokerPickHeader}>
                          <span className={styles.brokerLogoBadgeAsl}>⚡ บล.เอเอสแอล (050)</span>
                          {leadBroker === '050' ? (
                            <span className={styles.chosenIndicatorAsl}>🟢 ✓ กำลังเลือก</span>
                          ) : (
                            <span className={styles.unchosenIndicator}>⚪ คลิกเลือก</span>
                          )}
                        </div>
                        <strong className={styles.brokerTitle}>ASL Securities</strong>
                        <p className={styles.brokerDesc}>
                          โบรกเกอร์นวัตกรรมใหม่ เทรดไว ค่าคอมคุ้มค่า พร้อม Settrade Streaming &amp; Open API
                        </p>
                        <div className={styles.perkList}>
                          <span>✓ เจ้าหน้าที่การตลาดดูแลสิทธิพิเศษ VIP เฉพาะราย</span>
                          <span>✓ สิทธิ์เชื่อมต่อระบบความปลอดภัย Zero-Custody Enclave</span>
                        </div>
                      </div>
                    </div>

                    {/* Form Input Fields */}
                    <div className={styles.formFieldsBox}>
                      {leadType === 'existing_port' && (
                        <div className={styles.accountNoHighlightBox}>
                          <div className={styles.accountNoHeader}>
                            <label className={styles.inputLabelBold}>
                              🏷️ เลขที่บัญชีซื้อขายหุ้น (Account Number) *
                            </label>
                            <span className={styles.accountNoBrokerPill}>
                              บล.{leadBroker === '003' ? 'พาย (003)' : leadBroker === '022' ? 'ทรีนีตี้ (022)' : 'เอเอสแอล (050)'}
                            </span>
                          </div>
                          <div className={styles.inputWrapLarge}>
                            <input
                              type="text"
                              required
                              className={styles.textInputLarge}
                              placeholder="เช่น 99242240 หรือเลขพอร์ต 6-8 หลักของท่าน"
                              value={leadAccountNo}
                              onChange={(e) => setLeadAccountNo(e.target.value)}
                            />
                          </div>
                          <p className={styles.accountNoHelper}>
                            🔒 ข้อมูลเลขพอร์ตจะถูกส่งให้เจ้าหน้าที่ บล.{leadBroker === '003' ? 'พาย' : leadBroker === '022' ? 'ทรีนีตี้' : 'เอเอสแอล'} ตรวจสอบยืนยันสิทธิ์ VIP โดยไม่มีการเข้าถึงข้อมูลการซื้อขายส่วนตัว
                          </p>
                        </div>
                      )}

                      <div className={styles.inputTwoCol}>
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>ชื่อ - นามสกุล *</label>
                          <div className={styles.inputWrap}>
                            <span className={styles.inputIcon}>👤</span>
                            <input
                              type="text"
                              required
                              className={styles.textInput}
                              placeholder="เช่น สมชาย ใจดี"
                              value={leadName}
                              onChange={(e) => setLeadName(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>เบอร์โทรศัพท์มือถือ *</label>
                          <div className={styles.inputWrap}>
                            <span className={styles.inputIcon}>📞</span>
                            <input
                              type="tel"
                              required
                              className={styles.textInput}
                              placeholder="เช่น 0812345678"
                              value={leadPhone}
                              onChange={(e) => setLeadPhone(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className={styles.inputTwoCol} style={{ marginTop: '12px' }}>
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>LINE ID (สำหรับมาร์เก็ตติ้งติดต่อสะดวก)</label>
                          <div className={styles.inputWrap}>
                            <span className={styles.inputIcon}>💬</span>
                            <input
                              type="text"
                              className={styles.textInput}
                              placeholder="เช่น somchai_trader"
                              value={leadLine}
                              onChange={(e) => setLeadLine(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>อีเมล (Email)</label>
                          <div className={styles.inputWrap}>
                            <span className={styles.inputIcon}>📧</span>
                            <input
                              type="email"
                              className={styles.textInput}
                              placeholder="somchai@example.com"
                              value={leadEmail}
                              onChange={(e) => setLeadEmail(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className={styles.inputGroup} style={{ marginTop: '14px' }}>
                        <label className={styles.inputLabel}>สินทรัพย์และบริการที่ท่านสนใจ</label>
                        <div className={styles.interestChipsRow}>
                          {INTEREST_OPTIONS.map((opt) => {
                            const isSelected = leadInterests.includes(opt.id);
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                className={`${styles.interestChip} ${isSelected ? styles.interestChipActive : ''}`}
                                onClick={() => handleInterestToggle(opt.id)}
                              >
                                <span>{opt.label}</span>
                                <b>{isSelected ? '✓' : '+'}</b>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className={styles.inputGroup} style={{ marginTop: '12px' }}>
                        <label className={styles.inputLabel}>หมายเหตุเพิ่มเติมหรือช่วงเวลาที่สะดวกรับสาย</label>
                        <div className={styles.inputWrap}>
                          <span className={styles.inputIcon}>📝</span>
                          <input
                            type="text"
                            className={styles.textInput}
                            placeholder={leadType === 'existing_port' ? 'เช่น มีพอร์ตเอเอสแอลอยู่แล้ว ต้องการเปิดสิทธิ์เข้าห้อง VIP' : 'เช่น สนใจเปิดพอร์ตเพื่อเทรด DR และรับสิทธิ์เชื่อมต่อ AI โทรช่วงบ่าย'}
                            value={leadNotes}
                            onChange={(e) => setLeadNotes(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {leadError && (
                      <div className={styles.leadErrorBar}>
                        ⚠️ {leadError}
                      </div>
                    )}

                    <div className={styles.formFooterRow}>
                      <button
                        type="submit"
                        className={styles.btnPrimaryVip}
                        disabled={leadSubmitting || !leadName.trim() || !leadPhone.trim() || (leadType === 'existing_port' && !leadAccountNo.trim())}
                      >
                        {leadSubmitting
                          ? 'กำลังส่งข้อมูลให้เจ้าหน้าที่...'
                          : leadType === 'existing_port'
                            ? `👤 ยืนยันแจ้งเลขพอร์ตรับสิทธิ์ VIP (${leadBroker === '003' ? 'บล.พาย' : leadBroker === '022' ? 'บล.ทรีนีตี้' : 'บล.เอเอสแอล'})`
                            : `👑 ยืนยันยื่นคำขอเปิดพอร์ต VIP (${leadBroker === '003' ? 'บล.พาย' : leadBroker === '022' ? 'บล.ทรีนีตี้' : 'บล.เอเอสแอล'})`}
                      </button>
                      <button
                        type="button"
                        className={styles.btnSecondaryCancel}
                        onClick={() => setModalOpen(false)}
                      >
                        ยกเลิก
                      </button>
                    </div>

                    <div className={styles.trustDisclaimer}>
                      🔒 ข้อมูลของท่านจะถูกส่งตรงไปยังหัวหน้าทีมมาร์เก็ตติ้งของโบรกเกอร์ที่ท่านเลือก เพื่อติดต่อแนะนำการเปิดพอร์ตหรือตรวจสอบยืนยันสิทธิพิเศษเป็นกรณีพิเศษ
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB CONTENT 2: REAL SETTRADE OPEN API CONNECTION */}
            {modalTab === 'api' && (
              <div className={styles.tabContent}>
                <div className={styles.formLeadHeader}>
                  <h3 className={styles.modalHeading}>
                    ผูกพอร์ตจริงด้วย Settrade Open API
                  </h3>
                  <p className={styles.modalSubheading}>
                    เชื่อมต่อตรงกับศูนย์รับส่งคำสั่ง Settrade Open API โดยไม่มีการจัดเก็บกุญแจในฐานข้อมูล
                  </p>
                </div>

                {/* Broker Picker */}
                <div className={styles.brokerPickGrid}>
                  <div
                    className={`${styles.brokerPickCard} ${styles.cardPi} ${brokerId === '003' ? styles.brokerPickCardActivePi : ''}`}
                    onClick={() => setBrokerId('003')}
                  >
                    <div className={styles.brokerPickHeader}>
                      <span className={styles.brokerLogoBadgePi}>🥧 บล.พาย (003)</span>
                      {brokerId === '003' ? (
                        <span className={styles.chosenIndicatorPi}>🟢 ✓ กำลังเลือก</span>
                      ) : (
                        <span className={styles.unchosenIndicator}>⚪ คลิกเลือก</span>
                      )}
                    </div>
                    <strong className={styles.brokerTitle}>Pi Securities (มหาชน)</strong>
                    <p className={styles.brokerDesc}>เชื่อมต่อพอร์ต บล.พาย ดึงหุ้นไทย &amp; DR พร้อมวิเคราะห์ Stage 2</p>
                  </div>

                  <div
                    className={`${styles.brokerPickCard} ${styles.cardTrinity} ${brokerId === '022' ? styles.brokerPickCardActiveTrinity : ''}`}
                    onClick={() => setBrokerId('022')}
                  >
                    <div className={styles.brokerPickHeader}>
                      <span className={styles.brokerLogoBadgeTrinity}>🌟 บล.ทรีนีตี้ (022)</span>
                      {brokerId === '022' ? (
                        <span className={styles.chosenIndicatorTrinity}>🟢 ✓ กำลังเลือก</span>
                      ) : (
                        <span className={styles.unchosenIndicator}>⚪ คลิกเลือก</span>
                      )}
                    </div>
                    <strong className={styles.brokerTitle}>Trinity Securities</strong>
                    <p className={styles.brokerDesc}>เชื่อมต่อพอร์ต บล.ทรีนีตี้ พร้อมคำนวณ Trailing Stop &amp; Cut Loss</p>
                  </div>

                  <div
                    className={`${styles.brokerPickCard} ${styles.cardAsl} ${brokerId === '050' ? styles.brokerPickCardActiveAsl : ''}`}
                    onClick={() => setBrokerId('050')}
                  >
                    <div className={styles.brokerPickHeader}>
                      <span className={styles.brokerLogoBadgeAsl}>⚡ บล.เอเอสแอล (050)</span>
                      {brokerId === '050' ? (
                        <span className={styles.chosenIndicatorAsl}>🟢 ✓ กำลังเลือก</span>
                      ) : (
                        <span className={styles.unchosenIndicator}>⚪ คลิกเลือก</span>
                      )}
                    </div>
                    <strong className={styles.brokerTitle}>ASL Securities</strong>
                    <p className={styles.brokerDesc}>เชื่อมต่อพอร์ต บล.เอเอสแอล ดึงหุ้นไทย &amp; DR พร้อมวิเคราะห์ Stage 2</p>
                  </div>
                </div>

                {/* VIP IB Prompt Strip */}
                <div className={styles.ibConciergeStrip}>
                  <div className={styles.ibConciergeLeft}>
                    <span style={{ fontSize: '20px' }}>👑</span>
                    <div>
                      <strong>ยังไม่มีบัญชีซื้อขายกับ บล.พาย, บล.ทรีนีตี้ หรือ บล.เอเอสแอล?</strong>
                      <p>ยื่นขอเปิดพอร์ต VIP หรือแจ้งเลขพอร์ตเพื่อรับสิทธิ์เชื่อมต่อ API และฟีเจอร์พรีเมียมฟรี</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.ibConciergeLinkBtn}
                    onClick={() => setModalTab('lead')}
                  >
                    เปิดพอร์ต VIP ↗
                  </button>
                </div>

                {/* Inputs Box */}
                <div className={styles.formFieldsBox}>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>เลขบัญชีซื้อขายหุ้น (Account Number) *</label>
                    <div className={styles.inputWrap}>
                      <span className={styles.inputIcon}>🏷️</span>
                      <input
                        type="text"
                        autoComplete="off"
                        className={styles.textInput}
                        placeholder="เช่น 99242240 หรือเลขบัญชีที่โบรกเกอร์ออกให้"
                        value={accountNo}
                        onChange={(e) => setAccountNo(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className={styles.inputGroup} style={{ marginTop: '12px' }}>
                    <label className={styles.inputLabel}>App ID (Settrade Open API) *</label>
                    <div className={styles.inputWrap}>
                      <span className={styles.inputIcon}>🔑</span>
                      <input
                        type="text"
                        autoComplete="off"
                        className={styles.textInput}
                        placeholder="กรอก App ID ที่ได้รับจากโบรกเกอร์"
                        value={appId}
                        onChange={(e) => setAppId(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className={styles.inputGroup} style={{ marginTop: '12px' }}>
                    <label className={styles.inputLabel}>API Secret (เข้ารหัสปลอดภัยใน Enclave) *</label>
                    <div className={styles.inputWrap}>
                      <span className={styles.inputIcon}>🔒</span>
                      <input
                        type={showSecret ? 'text' : 'password'}
                        autoComplete="off"
                        className={styles.textInput}
                        style={{ paddingRight: '45px' }}
                        placeholder="กรอก API Secret (ส่งตรงไปยัง Settrade Enclave เท่านั้น)"
                        value={appSecret}
                        onChange={(e) => setAppSecret(e.target.value)}
                      />
                      <button
                        type="button"
                        className={styles.eyeBtn}
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        {showSecret ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles.formFooterRow}>
                  <button
                    type="button"
                    className={styles.btnPrimaryApiSubmit}
                    onClick={() => syncPortfolio(false)}
                    disabled={loading || !accountNo.trim() || !appId.trim() || !appSecret.trim()}
                  >
                    {loading ? 'กำลังเชื่อมต่อ Settrade...' : '⚡ ยืนยันเชื่อมต่อพอร์ตจริง'}
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondaryCancel}
                    onClick={() => setModalOpen(false)}
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: ONE-CLICK SANDBOX DEMO */}
            {modalTab === 'demo' && (
              <div className={styles.tabContent}>
                <div className={styles.formLeadHeader}>
                  <h3 className={styles.modalHeading}>
                    วันคลิก ทดลองโหมด Sandbox (Demo)
                  </h3>
                  <p className={styles.modalSubheading}>
                    สัมผัสประสบการณ์วินิจฉัยพอร์ต Stage 2 และการคำนวณ Trailing Stop ได้ทันทีโดยไม่ต้องกรอกรหัส
                  </p>
                </div>

                <div className={styles.demoChoiceRow}>
                  <button
                    type="button"
                    className={styles.demoBigBtnPi}
                    onClick={() => {
                      syncPortfolio(true, '003');
                      setModalOpen(false);
                    }}
                  >
                    <span className={styles.demoBtnIcon}>🥧</span>
                    <strong className={styles.demoBtnTitle}>ทดลองพอร์ต บล.พาย (003 Sandbox)</strong>
                    <span className={styles.demoBtnSub}>จำลองพอร์ตหุ้นไทย SET100 และ DR NVDA80</span>
                  </button>

                  <button
                    type="button"
                    className={styles.demoBigBtnTrinity}
                    onClick={() => {
                      syncPortfolio(true, '022');
                      setModalOpen(false);
                    }}
                  >
                    <span className={styles.demoBtnIcon}>🌟</span>
                    <strong className={styles.demoBtnTitle}>ทดลองพอร์ต บล.ทรีนีตี้ (022 Sandbox)</strong>
                    <span className={styles.demoBtnSub}>จำลองพอร์ตหุ้นไทย Stage 2 และ DR AAPL80</span>
                  </button>

                  <button
                    type="button"
                    className={styles.demoBigBtnAsl}
                    onClick={() => {
                      syncPortfolio(true, '050');
                      setModalOpen(false);
                    }}
                  >
                    <span className={styles.demoBtnIcon}>⚡</span>
                    <strong className={styles.demoBtnTitle}>ทดลองพอร์ต บล.เอเอสแอล (050 Sandbox)</strong>
                    <span className={styles.demoBtnSub}>จำลองพอร์ตเทรดไว Stage 2 และ DR TSLA80</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
