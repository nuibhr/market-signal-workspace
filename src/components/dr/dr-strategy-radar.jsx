'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Activity,
  ArrowUpRight,
  Award,
  BarChart2,
  BookmarkCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Compass,
  DollarSign,
  FileText,
  HelpCircle,
  Landmark,
  Layers,
  ListChecks,
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
  Volume2,
  VolumeX,
  WalletCards,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import {
  calcIndicativePrice,
  generateMorningSignalSpeech,
  THAI_DIVIDEND_PORTFOLIO_MODEL,
} from '../../dr/strategy-tracker.mjs';
import { createSignalSpeaker } from '../../auto-pick/speech.mjs';
import styles from './dr-strategy.module.css';
import {requestStrategyFeed} from '../../dr/strategy-client.mjs';
import {radarChartAsset} from '../../dr/chart-target.mjs';
import {FEATURED_LIMIT,rankedRadarRows,pageRows} from '../../monitor/workflow.mjs';
import ScanRules from './scan-rules.jsx';
import SignalWorkflow from './signal-workflow.jsx';
import WholeMarketScans from './whole-market-scans.jsx';

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
  // Navigation tabs
  const [activeTab, setActiveTab] = useState(currentMarket === 'thai' ? 'thai-scanner' : 'dr-scanner');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'bullish' | 'buyzone' | 'highscore'
  const [ledgerFilter, setLedgerFilter] = useState('all'); // 'all' | 'dr' | 'thai' | 'buyzone' | 'tp' | 'sl'
  const [searchQuery, setSearchQuery] = useState('');
  const [allScanQuery,setAllScanQuery]=useState('');
  const [allScanMarket,setAllScanMarket]=useState('all');
  const [allScanPage,setAllScanPage]=useState(1);
  const [personalPage,setPersonalPage]=useState(1);
  const [expandedSymbol, setExpandedSymbol] = useState(null);
  const [addedPicks, setAddedPicks] = useState([]);

  // Scanning & Integration State
  const [isScanning, setIsScanning] = useState(false);
  const [scanType, setScanType] = useState('dr'); // 'dr' | 'thai'
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStep, setScanStep] = useState('');
  const [lastScanTime, setLastScanTime] = useState('ยังไม่สแกน');
  const [toastData, setToastData] = useState(null);
  const [marketClock, setMarketClock] = useState('09:00:00');

  // Voice Alert & Speech Synthesis State
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speechState, setSpeechState] = useState('idle');
  const speakerRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      speakerRef.current = createSignalSpeaker(window, (state) => {
        setSpeechState(state);
      });
    }
    return () => speakerRef.current?.stop();
  }, []);

  // Sync activeTab when currentMarket prop changes
  useEffect(() => {
    if (currentMarket === 'thai') {
      setActiveTab('thai-scanner');
    } else if (currentMarket === 'dr') {
      setActiveTab('dr-scanner');
    }
  }, [currentMarket]);

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

  // Live Data & Persisted Picks Integration (100% Real Market Data, No Static Mockups)
  const [liveData, setLiveData] = useState(null);
  const [feedError,setFeedError]=useState('');
  const [isPicksInitialized, setIsPicksInitialized] = useState(false);

  // Fetch live market data feed on mount and every 45 seconds
  useEffect(() => {
    const controller=new AbortController();
    let mounted=true;
    const loadFeed=async()=>{
      try {
        const data=await requestStrategyFeed({signal:controller.signal});
        if(mounted){setLiveData(data);setFeedError('');}
      } catch(error){if(mounted)setFeedError(error.message);}
    };
    loadFeed();
    const interval=setInterval(loadFeed,60000);
    return ()=>{mounted=false;controller.abort();clearInterval(interval);};
  }, []);

  useEffect(()=>{
    if(liveData?.updatedAt)setLastScanTime(new Date(liveData.updatedAt).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'})+' น.');
    if(liveData?.liveUsdThb)setCalcFxRate(liveData.liveUsdThb);
  },[liveData]);

  // Arbitrage Calculator inputs (Live real defaults)
  const [calcUnderlying, setCalcUnderlying] = useState('');
  const [calcFxRate, setCalcFxRate] = useState('');
  const [calcRatio, setCalcRatio] = useState(1000);
  const [calcMarketDr, setCalcMarketDr] = useState('');

  const scoredDRs=liveData?.scoredDRs??[];
  const scoredThaiStocks=liveData?.scoredThaiStocks??[];
  const liveDividendStocks=liveData?.liveDividendStocks??[];

  const topMorningThai = useMemo(() => {
    if (liveData?.topMorningThai?.length) return liveData.topMorningThai;
    return scoredThaiStocks
      .filter((s) => s.scored?.totalScore >= 8)
      .slice(0, 2)
      .map((s) => ({
        symbol: s.symbol,
        name: s.name,
        market: 'SET',
        currentPrice: s.currentPrice,
        entry: s.scored.entry,
        tp1: s.scored.tp1,
        tp2: s.scored.tp2,
        sl: s.scored.sl,
        status: s.currentPrice <= s.scored.entry * 1.01 ? 'In Buy Zone' : 'Waiting',
        statusThai: s.currentPrice <= s.scored.entry * 1.01 ? 'อยู่ในโซนซื้อ S2-S3' : 'รอรับย่อตัว',
        riskReward: s.scored.riskReward,
        changePct: s.changePct,
      }));
  }, [liveData, scoredThaiStocks]);

  const topMorningDr = useMemo(() => {
    if (liveData?.topMorningDr?.length) return liveData.topMorningDr;
    return scoredDRs
      .filter((s) => s.scored?.totalScore >= 8)
      .slice(0, 2)
      .map((s) => ({
        symbol: s.symbol,
        name: s.name,
        market: 'DR80',
        currentPrice: s.currentDrPrice,
        entry: s.scored.entry,
        tp1: s.scored.tp1,
        tp2: s.scored.tp2,
        sl: s.scored.sl,
        status: s.currentDrPrice <= s.scored.entry * 1.01 ? 'In Buy Zone' : 'Waiting',
        statusThai: s.currentDrPrice <= s.scored.entry * 1.01 ? 'อยู่ในโซนซื้อ S2-S3' : 'รอรับย่อตัว',
        riskReward: s.scored.riskReward,
        changePct: s.changePct,
      }));
  }, [liveData, scoredDRs]);

  const allMorningSignals = useMemo(() => {
    if (liveData?.allMorningSignals?.length) return liveData.allMorningSignals;
    return [...topMorningThai, ...topMorningDr];
  }, [liveData, topMorningThai, topMorningDr]);

  // Tracked Picks Ledger State (Loaded from localStorage or populated with live scan results)
  const [trackedPicks, setTrackedPicks] = useState([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nugaom_tracked_picks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTrackedPicks(parsed);
          setIsPicksInitialized(true);
          return;
        }
      }
    } catch {}

    if (liveData?.autoTrackedPicks?.length && !isPicksInitialized) {
      setTrackedPicks(liveData.autoTrackedPicks);
      setIsPicksInitialized(true);
      try {
        localStorage.setItem('nugaom_tracked_picks', JSON.stringify(liveData.autoTrackedPicks));
      } catch {}
    }
  }, [liveData, isPicksInitialized]);

  // Dynamically update trackedPicks current prices and returns with live data
  useEffect(() => {
    if (!liveData || !trackedPicks.length) return;
    const drMap = new Map((liveData.scoredDRs || []).map((d) => [d.symbol, d]));
    const thaiMap = new Map((liveData.scoredThaiStocks || []).map((t) => [t.symbol, t]));

    setTrackedPicks((prev) => {
      let changed = false;
      const updated = prev.map((p) => {
        const match = p.market === 'SET' ? thaiMap.get(p.symbol) : drMap.get(p.symbol);
        if (!match) return p;
        const cur = match.currentDrPrice ?? p.currentPrice;
        const ret = Math.round(((cur - p.entryPrice) / p.entryPrice) * 10000) / 100;
        const status=p.status; // Personal watch plans never produce server-side fills or closed outcomes.

        if (cur !== p.currentPrice || ret !== p.returnPct || status !== p.status) {
          changed = true;
          return { ...p, currentPrice: cur, returnPct: ret, status };
        }
        return p;
      });
      if (changed) {
        try { localStorage.setItem('nugaom_tracked_picks', JSON.stringify(updated)); } catch {}
      }
      return changed ? updated : prev;
    });
  }, [liveData]);

  const emptyKpis={active:'—',hitTp:'—',hitSl:'—',nearTp:'—',winRate:'—',avgReturn:'—'};
  const drKpis=liveData?.drKpis??emptyKpis;
  const thaiKpis=liveData?.thaiKpis??emptyKpis;

  // Audio Voice Playback Handlers
  const handlePlayMorningBriefing = () => {
    if (!speakerRef.current || !voiceEnabled) return;
    const text = generateMorningSignalSpeech({
      thaiPicks: topMorningThai,
      drPicks: topMorningDr,
    });
    speakerRef.current.play(text);
    setToastData({
      title: 'กำลังอ่านสรุปสัญญาณเช้านี้ 🔊',
      desc: 'ระบบกำลังอ่านสรุปราคาเข้า TP SL และสถานะของหุ้นไทยและ DR ประจำวันจากข้อมูลจริง',
      type: 'info',
    });
  };

  const handleSpeakSingle = (p) => {
    if (!speakerRef.current || !voiceEnabled) return;
    const text = `สัญญาณ ${p.symbol} ตลาด ${p.market === 'SET' ? 'หุ้นไทย' : 'DR'} ราคาเข้า ${p.entry.toFixed(2)} บาท เป้าหมายทำกำไร ${p.tp1.toFixed(2)} บาท ตัดขาดทุน ${p.sl.toFixed(2)} บาท สถานะ ${p.statusThai || p.status}`;
    speakerRef.current.play(text);
    setToastData({
      title: `อ่านสัญญาณ ${p.symbol} 🔊`,
      desc: `เข้า: ${p.entry.toFixed(2)} | TP: ${p.tp1.toFixed(2)} | SL: ${p.sl.toFixed(2)} | ${p.statusThai || p.status}`,
      type: 'info',
    });
  };

  // Filtered DRs
  const filteredDRs = useMemo(() => {
    return scoredDRs.filter((item) => {
      const matchesSearch =
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.underlying?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterMode === 'bullish') {
        return item.scored?.emaAligned || item.scored?.emaScore >= 2;
      }
      if (filterMode === 'buyzone') {
        return item.scored?.camScore === 4;
      }
      if (filterMode === 'highscore') {
        return item.scored?.totalScore >= 10;
      }
      return true;
    });
  }, [scoredDRs, searchQuery, filterMode]);

  // Filtered Thai Stocks
  const filteredThaiStocks = useMemo(() => {
    return scoredThaiStocks.filter((item) => {
      const matchesSearch =
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sector?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterMode === 'bullish') {
        return item.scored?.emaAligned || item.scored?.emaScore >= 2;
      }
      if (filterMode === 'buyzone') {
        return item.scored?.camScore === 4;
      }
      if (filterMode === 'highscore') {
        return item.scored?.totalScore >= 10;
      }
      return true;
    });
  }, [scoredThaiStocks, searchQuery, filterMode]);

  // Filtered Tracked Picks in Ledger
  const allScans=pageRows(rankedRadarRows([...scoredThaiStocks,...scoredDRs]).filter(item=>(allScanMarket==='all'||item.market===allScanMarket)&&`${item.symbol} ${item.name}`.toLowerCase().includes(allScanQuery.toLowerCase())),allScanPage);
  const showAllScans=market=>{setAllScanMarket(market);setAllScanQuery('');setAllScanPage(1);setActiveTab('all-scans');};

  const filteredTrackedPicks = useMemo(() => {
    return trackedPicks.filter((p) => {
      if (ledgerFilter === 'dr') return p.market === 'DR80';
      if (ledgerFilter === 'thai') return p.market === 'SET';
      if (ledgerFilter === 'buyzone') return p.status === 'In Buy Zone';
      if (ledgerFilter === 'tp') return p.status === 'Hit TP1' || p.status === 'Hit TP2';
      if (ledgerFilter === 'sl') return p.status === 'Hit SL';
      return true;
    });
  }, [trackedPicks, ledgerFilter]);

  const personalRows=pageRows(filteredTrackedPicks,personalPage);

  // Live calculation for Arbitrage sandbox
  const liveArbitrage = useMemo(() => {
    if(![calcUnderlying,calcFxRate,calcRatio,calcMarketDr].every(v=>Number(v)>0))return null;
    return calcIndicativePrice({
      underlyingUsd: Number(calcUnderlying),
      usdThbRate: Number(calcFxRate),
      conversionRatio: Number(calcRatio),
      currentDrPrice: Number(calcMarketDr),
    });
  }, [calcUnderlying, calcFxRate, calcRatio, calcMarketDr]);

  const handleTriggerScan = async (targetType='dr') => {
    if(isScanning)return;
    setIsScanning(true);setScanType(targetType);setScanProgress(20);
    setScanStep('กำลังโหลดแท่งปิดรายวันและคำนวณ EMA, RSI, MACD และ Camarilla…');
    try {
      const fresh=await requestStrategyFeed({refresh:true,signal:AbortSignal.timeout(60000)});
      setLiveData(fresh);setFeedError('');
      const coverage=fresh.coverage[targetType];
      if(!coverage.available)throw Error('ยังไม่มีแท่งปิดสำหรับตลาดนี้ กรุณาลองใหม่เมื่อแหล่งข้อมูลพร้อม');
      setScanProgress(100);
      const missing=fresh.unavailable.filter(i=>i.market===targetType).map(i=>i.symbol);
      setToastData({title:`สแกน${targetType==='thai'?'หุ้นไทย':' DR'}สำเร็จ`,
        desc:`คำนวณได้ ${coverage.available}/${coverage.total} ตัวจากแท่งปิดรายวัน${missing.length?' · ข้อมูลไม่พร้อม: '+missing.join(', '):''}`,type:'success'});

    } catch(error){setFeedError(error.message);setToastData({title:'ยังสแกนไม่สำเร็จ',desc:error.message,type:'error'});}
    finally {setIsScanning(false);}
  };

  const handleTogglePick = (item, marketType = 'DR80') => {
    const symbol = item.symbol;
    const isAlreadyIn = trackedPicks.some((p) => p.symbol === symbol);

    if (isAlreadyIn) {
      setTrackedPicks((prev) => {
        const updated = prev.filter((p) => p.symbol !== symbol);
        try {
          localStorage.setItem('nugaom_tracked_picks', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      setToastData({
        title: `นำ ${symbol} ออกจากบันทึก Picks`,
        desc: 'ปรับปรุงรายการติดตามเรียบร้อยแล้ว',
        type: 'info',
      });
    } else {
      const newEntry = {
        id: `custom_${Date.now()}`,
        symbol: item.symbol,
        name: item.name,
        market: marketType,
        entryPrice: item.scored.entry,
        currentPrice: item.currentDrPrice,
        tp1: item.scored.tp1,
        tp2: item.scored.tp2,
        sl: item.scored.sl,
        status: item.currentDrPrice <= item.scored.entry * 1.01 ? 'In Buy Zone' : 'Waiting',
        returnPct: Math.round(((item.currentDrPrice - item.scored.entry) / item.scored.entry) * 10000) / 100,
        riskReward: item.scored.riskReward,
        date: 'บันทึกใหม่วันนี้',
      };
      setTrackedPicks((prev) => {
        const updated = [newEntry, ...prev];
        try {
          localStorage.setItem('nugaom_tracked_picks', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      setToastData({
        title: `เพิ่ม ${symbol} เข้า ${marketType === 'SET' ? 'หุ้นไทย' : 'DR'} Picks แล้ว! 🎯`,
        desc: `เข้า: ${item.scored.entry.toFixed(2)} | TP1: ${item.scored.tp1.toFixed(2)} | SL: ${item.scored.sl.toFixed(2)}`,
        type: 'success',
      });
    }
  };

  const handleGoToChart = (item) => {
    const asset=radarChartAsset(item);
    if(!asset){setToastData({title:'ยังเปิดกราฟไม่ได้',desc:'ไม่พบสินทรัพย์นี้ในตลาดที่รองรับ',type:'error'});return;}
    if(onSelectSymbol)onSelectSymbol(asset);
    else window.location.assign(`/${asset.id}?symbol=${encodeURIComponent(asset.symbol)}#chart-panel`);
  };

  return (
    <section className={styles.container} aria-label="DR Strategy & Thai Equities Radar">
      <div className={styles.feedNotice} role="status" aria-live="polite">
        {feedError || (liveData ? `ผลสแกนแท่งปิดรายวัน · หุ้นไทย ${liveData.coverage.thai.available}/${liveData.coverage.thai.total} · DR ${liveData.coverage.dr.available}/${liveData.coverage.dr.total} · ${liveData.feedSource}` : 'กำลังโหลดข้อมูลสแกน…')}
        {liveData?.unavailable?.length>0&&<span>ข้อมูลไม่พร้อม: {liveData.unavailable.map(i=>i.symbol).join(', ')} · ไม่ใช้ราคาสมมติคำนวณ</span>}
      </div>
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
            <span>THAI EQUITIES & DR80 STRATEGY TRACKER</span>
          </div>
          <h2 className={styles.title}>
            เรดาร์สแกนหุ้นไทย &amp; DR <span>แยกฟีเจอร์ชัดเจน พร้อมระบบเสียงแจ้งเตือน</span>
          </h2>
          <p className={styles.subtitle}>
            คัดกรองชุดหุ้นไทยและ DR ที่ระบุด้านล่างด้วย 4 เสาหลักทางเทคนิค (Camarilla S2-S3, EMA 25/50/75, RSI, MACD)
            เลือกบันทึกแผนเฝ้าดูไว้ใน Picks พร้อมเสียงพูดบอกราคาเข้า, TP, SL และสถานะ
          </p>
        </div>

        <div className={styles.heroRight}>
          <div className={styles.statsGrid}>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>DR Universe</span>
              <strong className={styles.statVal}>{liveData?.coverage.dr.total??'—'} Tickers</strong>
              <small className={styles.statNote}>DR80 &amp; DR23</small>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>หุ้นไทย SET</span>
              <strong className={styles.statVal} style={{ color: '#38bdf8' }}>{liveData?.coverage.thai.total??'—'} หุ้นในชุดสแกน</strong>
              <small className={styles.statNote}>คัดกรองสัญญาณเช้า</small>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>Voice Alert</span>
              <strong className={styles.statVal} style={{ color: voiceEnabled ? '#10b981' : '#f59e0b' }}>
                {voiceEnabled ? '🔊 เสียงภาษาไทย' : '🔇 ปิดเสียง'}
              </strong>
              <small className={styles.statNote}>แจ้งเตือนราคาเข้า/TP</small>
            </div>
          </div>
        </div>
      </div>

      {/* ── TOP MORNING AUDIO SIGNAL BRIEFING BANNER ── */}
      <div className={styles.morningBriefingCard}>
        <div className={styles.morningTopRow}>
          <div className={styles.morningTitleGroup}>
            <div className={styles.morningIconWrap}>
              <Volume2 size={24} className={speechState === 'speaking' ? 'animate-bounce' : ''} />
            </div>
            <div>
              <h3 className={styles.morningHeading}>
                <span>สรุปแผนเฝ้าดูจาก Radar (กดฟังเอง)</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  ตลาด SET &amp; DR80
                </span>
              </h3>
              <p className={styles.morningSub}>
                สรุปแผนคัดกรองจากแท่งปิด · เสียงเหตุการณ์ Entry / TP / SL จริงจะประกาศจากคิวเซิร์ฟเวอร์เมื่อเข้าเงื่อนไข
              </p>
            </div>
          </div>

          <div className={styles.voiceControlsGroup}>
            <button
              type="button"
              onClick={handlePlayMorningBriefing}
              disabled={!voiceEnabled || speechState === 'speaking'}
              className={styles.voicePlayBtn}
            >
              <Volume2 size={15} className={speechState === 'speaking' ? 'animate-spin' : ''} />
              <span>{speechState === 'speaking' ? 'กำลังอ่านสัญญาณ...' : '🔊 ฟังเสียงประกาศสัญญาณเช้านี้'}</span>
            </button>
            <button
              type="button"
              onClick={() => {if(voiceEnabled)speakerRef.current?.stop();setVoiceEnabled(!voiceEnabled);}}
              className={`${styles.voiceToggleBtn} ${voiceEnabled ? styles.voiceToggleActive : ''}`}
            >
              {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span>{voiceEnabled ? 'เสียงเปิดอยู่' : 'ปิดเสียง'}</span>
            </button>
          </div>
        </div>

        <details className={styles.briefingDetails}><summary>ดูแผนเฝ้าดูสำหรับอ่านเสียง ({allMorningSignals.length}) · ยังไม่ยืนยัน Entry</summary>
        <div className={styles.morningCardsGrid}>
          {allMorningSignals.map((p) => {
            const isBuyZone = p.status === 'In Buy Zone';
            return (
              <div key={p.symbol} className={styles.morningPickBox}>
                <div className={styles.morningPickTop}>
                  <div className={styles.morningSymbolPill}>
                    <span>{p.symbol}</span>
                    <span className={styles.morningMarketTag}>{p.market}</span>
                  </div>
                  <span
                    className={`${styles.morningStatusPill} ${isBuyZone ? styles.statusInBuyZone : styles.statusWaiting}`}
                  >
                    {p.statusThai}
                  </span>
                </div>

                <div className={styles.morningPlanRow}>
                  <div className={styles.morningPlanItem}>
                    <span className={styles.morningPlanLabel}>เข้า</span>
                    <span className={styles.morningPlanVal} style={{ color: '#ffffff' }}>
                      {p.entry.toFixed(2)}
                    </span>
                  </div>
                  <div className={styles.morningPlanItem}>
                    <span className={styles.morningPlanLabel}>TP1</span>
                    <span className={styles.morningPlanVal} style={{ color: '#10b981' }}>
                      {p.tp1.toFixed(2)}
                    </span>
                  </div>
                  <div className={styles.morningPlanItem}>
                    <span className={styles.morningPlanLabel}>SL</span>
                    <span className={styles.morningPlanVal} style={{ color: '#ef4444' }}>
                      {p.sl.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className={styles.morningPickFooter}>
                  <span className="text-[10px] text-slate-400">R:R 1 : {p.riskReward.toFixed(2)}</span>
                  <div className="flex items-center gap-1.5">
                    {onSelectSymbol && (
                      <button
                        type="button"
                        onClick={() => handleGoToChart(p)}
                        className={styles.singleSpeakBtn}
                        title="เปิดดูกราฟเทคนิค TradingView"
                      >
                        <ArrowUpRight size={12} />
                        <span>ดูกราฟ</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSpeakSingle(p)}
                      className={styles.singleSpeakBtn}
                      title="คลิกเพื่อฟังเสียงสัญญาณของตัวนี้"
                    >
                      <Volume2 size={12} />
                      <span>ฟังตัวนี้</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </details>
      </div>

      <ScanRules coverage={liveData?.coverage}/>
      {/* Main Tabs Navigation */}
      <div className={styles.navTabs}>
        <button type="button" onClick={()=>showAllScans('all')} className={`${styles.tabBtn} ${activeTab==='all-scans'?styles.tabBtnActive:''}`}>สแกนรวม ({scoredThaiStocks.length+scoredDRs.length})</button>
        <button type="button" onClick={()=>setActiveTab('workflow')} className={`${styles.tabBtn} ${activeTab==='workflow'?styles.tabBtnActive:''}`}>รอเข้า / ติดตาม / แพ้ชนะ</button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('dr-scanner');
            setFilterMode('all');
          }}
          className={`${styles.tabBtn} ${activeTab === 'dr-scanner' ? styles.tabBtnActive : ''}`}
        >
          <Zap size={16} />
          <span>⚡ DR80 Scanner (DR Picks)</span>
          <span className={styles.tabCount}>{filteredDRs.length}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('thai-scanner');
            setFilterMode('all');
          }}
          className={`${styles.tabBtn} ${activeTab === 'thai-scanner' ? styles.tabBtnActive : ''}`}
        >
          <Target size={16} />
          <span>🇹🇭 หุ้นไทย Scanner (SET Picks)</span>
          <span className={styles.tabCount}>{filteredThaiStocks.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('picks-ledger')}
          className={`${styles.tabBtn} ${activeTab === 'picks-ledger' ? styles.tabBtnActive : ''}`}
        >
          <ListChecks size={16} />
          <span>📋 แผนเฝ้าดูส่วนตัว</span>
          <span className={styles.tabBadge} style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>
            {trackedPicks.length} ไม้
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dr-bridge')}
          className={`${styles.tabBtn} ${activeTab === 'dr-bridge' ? styles.tabBtnActive : ''}`}
        >
          <Coins size={16} />
          <span>Indicative &amp; Arbitrage Bridge</span>
          <span className={styles.tabBadge}>FX Quote</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('thai-dividend')}
          className={`${styles.tabBtn} ${activeTab === 'thai-dividend' ? styles.tabBtnActive : ''}`}
        >
          <PieChart size={16} />
          <span>พอร์ตหุ้นปันผลไทย (SETHD)</span>
          <span className={styles.tabBadge} style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
            {liveData?.avgDivYield&&liveData.avgDivYield!=='—'?`${liveData.avgDivYield}% Yield`:'รอข้อมูล Yield'}
          </span>
        </button>
      </div>

      {activeTab==='workflow'&&<SignalWorkflow market={currentMarket} onSelect={symbol=>handleGoToChart({symbol,market:currentMarket})}/>}
      {activeTab==='all-scans'&&<section className={styles.workflowPanel} aria-label="สแกนรวม">
        <h3>สแกนรวม · ทุกตัวในชุด Radar</h3>
        <p>หน้าเด่นแสดง 5 ตัว ส่วนที่เกินยังอยู่ที่นี่ · รายการเฝ้าดูไม่ใช่การยืนยัน Entry · จำนวนหุ้นที่สแกนไม่เปลี่ยนตามจำนวนที่แสดง</p>
        <div className={styles.workflowControls}>
          <label>ตลาด <select value={allScanMarket} onChange={e=>{setAllScanMarket(e.target.value);setAllScanPage(1);}}><option value="all">หุ้นไทย + DR</option><option value="SET">หุ้นไทย</option><option value="DR80">DR</option></select></label>
          <label>ค้นหา <input aria-label="ค้นหาในสแกนรวม" value={allScanQuery} onChange={e=>{setAllScanQuery(e.target.value);setAllScanPage(1);}}/></label>
        </div>
        <div className={styles.tableResponsive}><table className={styles.table}><thead><tr><th>หุ้น / ตลาด</th><th>คะแนน</th><th>ราคาแท่งปิด</th><th>Entry / SL / TP1</th><th>R:R</th><th>สถานะ</th><th>กราฟ</th></tr></thead><tbody>{allScans.rows.map(item=><tr key={`${item.market}:${item.symbol}`}><td><b>{item.symbol}</b><small>{item.market}</small></td><td>{item.scored.totalScore}/16</td><td>{item.currentDrPrice.toFixed(2)}<small>{item.dataAsOf}</small></td><td>{item.scored.entry.toFixed(2)} / {item.scored.sl.toFixed(2)} / {item.scored.tp1.toFixed(2)}</td><td>{item.scored.riskReward.toFixed(2)}</td><td>เฝ้าดู · ยังไม่ยืนยันเข้า</td><td><button type="button" onClick={()=>handleGoToChart(item)}>ดูกราฟ ↗</button></td></tr>)}</tbody></table></div>
        <nav className={styles.workflowPagination} aria-label="หน้าสแกนรวม"><button type="button" disabled={allScans.page===1} onClick={()=>setAllScanPage(p=>p-1)}>ก่อนหน้า</button><span>{allScans.page} / {allScans.pages} · ทั้งหมด {allScans.total} ตัว · หน้าละ 7</span><button type="button" disabled={allScans.page===allScans.pages} onClick={()=>setAllScanPage(p=>p+1)}>ถัดไป</button></nav>
        <WholeMarketScans initialMarket={currentMarket} onSelect={handleGoToChart}/>
      </section>}

      {/* ── Active Scanning Progress Overlay ── */}
      {isScanning && (
        <div className={styles.scanningBanner}>
          <div className={styles.scanningTopRow}>
            <span className={styles.scanningTitle}>
              <Loader2 size={16} className="animate-spin text-purple-400" />
              <span>
                กำลังสแกน {scanType === 'thai' ? 'ชุดหุ้นไทย' : 'ชุด DR'}...
              </span>
            </span>
            <span className="text-xs font-black text-purple-300">{scanProgress}%</span>
          </div>
          <div className={styles.scanningBarTrack}>
            <div className={styles.scanningBarFill} style={{ width: `${scanProgress}%` }} />
          </div>
          <p className="text-xs text-purple-200/80 m-0">{scanStep}</p>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 1: DR80 SCANNER (GLOBAL DRs)
          ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'dr-scanner' && (
        <div className={styles.tabContent}>
          {/* Bloomberg Header Bar */}
          <div className={styles.integrationBanner}>
            <div className={styles.integrationLeft}>
              <div className={styles.wifiIconBox}>
                <Wifi size={18} />
              </div>
              <div className={styles.integrationDetails}>
                <div className={styles.integrationTitleRow}>
                  <span className={styles.integrationTitle}>DR Daily Scanner</span>
                  <span className={styles.statusPillLive}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    แท่งปิดรายวัน
                  </span>
                  <span className={styles.statusPillTg}>ตรวจแหล่งข้อมูลด้านบน</span>
                </div>
                <div className={styles.sampleQuoteText}>
                  {liveData?.drSampleText ? (
                    <span>{liveData.drSampleText}</span>
                  ) : (
                    <span>กำลังรอแท่งปิด DR จากแหล่งข้อมูล</span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.integrationRight}>
              <div className={styles.lastScanInfo}>
                <Clock size={13} />
                <span>{marketClock} · สแกนล่าสุด {lastScanTime}</span>
              </div>
              <button
                type="button"
                onClick={() => handleTriggerScan('dr')}
                disabled={isScanning}
                className={styles.scanActionBtn}
              >
                <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
                <span>{isScanning ? 'กำลัง Scan DR...' : 'Scan DR ใหม่'}</span>
              </button>
            </div>
          </div>

          {/* Bloomberg Stats Cards (6 KPIs) */}
          <div className={styles.bloombergKpis}>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>แผน DR คะแนน ≥8</span>
              <strong className={styles.kpiVal} style={{ color: '#ffffff' }}>{drKpis.active}</strong>
              <span className={styles.kpiSub}>เข้าเกณฑ์จัดอันดับ</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>HIT TP</span>
              <strong className={styles.kpiVal} style={{ color: '#10b981' }}>{drKpis.hitTp}</strong>
              <span className={styles.kpiSub}>ถึงเป้ากำไร TP1/2</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>HIT SL</span>
              <strong className={styles.kpiVal} style={{ color: '#ef4444' }}>{drKpis.hitSl}</strong>
              <span className={styles.kpiSub}>ตัดขาดทุนตามวินัย</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>NEAR TP</span>
              <strong className={styles.kpiVal} style={{ color: '#38bdf8' }}>{drKpis.nearTp}</strong>
              <span className={styles.kpiSub}>ใกล้ถึงเป้า (&lt;2.0%)</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>WIN RATE</span>
              <strong className={styles.kpiVal} style={{ color: '#a855f7' }}>{drKpis.winRate}</strong>
              <span className={styles.kpiSub}>รอผลไม้ปิดจากบันทึกระบบ</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>AVG RETURN</span>
              <strong className={styles.kpiVal} style={{ color: '#10b981' }}>{drKpis.avgReturn}</strong>
              <span className={styles.kpiSub}>การเปลี่ยนแปลงแท่งล่าสุด</span>
            </div>
          </div>

          {/* Methodology Card */}
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
                Universe: <b>{liveData?.coverage.dr.total??0} DR</b> ในตลาด SET | แสดงคะแนน Confluence และ R:R ของแต่ละแผน | กดสแกนเพื่อโหลดข้อมูลใหม่
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

          <div className={styles.displayLimit}><span>แสดงเด่นสูงสุด 5 ตัว จากผลคัดกรอง {filteredDRs.length} ตัว · เป็นแผนเฝ้าดู ยังไม่ยืนยันเข้า</span><button type="button" onClick={()=>showAllScans('DR80')}>เปิดสแกนรวม DR ({filteredDRs.length})</button></div>
          {/* DR Cards Grid */}
          <div className={styles.cardsGrid}>
            {rankedRadarRows(filteredDRs).slice(0,FEATURED_LIMIT).map((item, index) => {
              const scored = item.scored;
              if (!scored) return null;
              const isExpanded = expandedSymbol === item.symbol;
              const isTracked = trackedPicks.some((p) => p.symbol === item.symbol);

              return (
                <div key={item.symbol} className={styles.card}>
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
                          {isTracked && <span className={styles.tagPicked}>ในพอร์ตติดตาม ★</span>}
                        </div>
                        <p className={styles.nameText}>{item.name} · หุ้นแม่ {item.underlying} · แท่งปิด {item.dataAsOf}</p>
                      </div>
                    </div>

                    <div className={styles.priceGroup}>
                      <span className={styles.priceVal}>{item.currentDrPrice.toFixed(2)} ฿</span>
                      <span className={`${styles.changeVal} ${item.changePct >= 0 ? styles.pos : styles.neg}`}>
                        {item.changePct >= 0 ? '+' : ''}{item.changePct.toFixed(2)}%
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
                          backgroundColor: scored.totalScore >= 11 ? '#10b981' : scored.totalScore >= 7 ? '#f59e0b' : '#ef4444',
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

                  {/* Price Progress Bar Slider */}
                  <PriceProgressBar sl={scored.sl} entry={scored.entry} current={item.currentDrPrice} tp2={scored.tp2} />

                  {/* Technical Accordion Toggle */}
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

                  {isExpanded && <TechnicalAccordion scored={scored} currentPrice={item.currentDrPrice} />}

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      onClick={() => handleTogglePick(item, 'DR80')}
                      className={`${styles.actionBtn} ${isTracked ? styles.actionBtnPicked : styles.actionBtnSecondary}`}
                    >
                      {isTracked ? '✓ บันทึกใน DR Picks แล้ว' : '+ เพิ่มเข้า DR Picks'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSpeakSingle({ symbol: item.symbol, entry: scored.entry, tp1: scored.tp1, sl: scored.sl, status: item.currentDrPrice <= scored.entry * 1.01 ? 'อยู่ในโซนซื้อ' : 'รอรับย่อ', market: 'DR80' })}
                      className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                      title="ฟังเสียงสัญญาณของ DR ตัวนี้"
                    >
                      <Volume2 size={14} /> ฟังเสียง
                    </button>
                    {onSelectSymbol && (
                      <button
                        type="button"
                        onClick={() => handleGoToChart(item)}
                        className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                        title="เปิดดูกราฟเทคนิค TradingView"
                      >
                        ดูกราฟ ↗
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 2: THAI EQUITIES SCANNER (SET100 / SETHD)
          ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'thai-scanner' && (
        <div className={styles.tabContent}>
          {/* Header Bar */}
          <div className={styles.integrationBanner}>
            <div className={styles.integrationLeft}>
              <div className={styles.wifiIconBox} style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.35)', color: '#38bdf8' }}>
                <Wifi size={18} />
              </div>
              <div className={styles.integrationDetails}>
                <div className={styles.integrationTitleRow}>
                  <span className={styles.integrationTitle}>Thai Daily Scanner</span>
                  <span className={styles.statusPillLive}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    แท่งปิดรายวัน
                  </span>
                  <span className={styles.statusPillTg}>Voice Alert: Ready</span>
                </div>
                <div className={styles.sampleQuoteText}>
                  {liveData?.thaiSampleText ? (
                    <span>{liveData.thaiSampleText}</span>
                  ) : (
                    <span>กำลังรอแท่งปิดหุ้นไทยจากแหล่งข้อมูล</span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.integrationRight}>
              <div className={styles.lastScanInfo}>
                <Clock size={13} />
                <span>{marketClock} · สแกนล่าสุด {lastScanTime}</span>
              </div>
              <button
                type="button"
                onClick={() => handleTriggerScan('thai')}
                disabled={isScanning}
                className={styles.scanActionBtn}
                style={{ background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)' }}
              >
                <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
                <span>{isScanning ? 'กำลัง Scan หุ้นไทย...' : 'Scan หุ้นไทยใหม่'}</span>
              </button>
            </div>
          </div>

          {/* Thai KPIs */}
          <div className={styles.bloombergKpis}>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>แผนหุ้นไทยคะแนน ≥8</span>
              <strong className={styles.kpiVal} style={{ color: '#38bdf8' }}>{thaiKpis.active}</strong>
              <span className={styles.kpiSub}>เข้าเกณฑ์จัดอันดับ</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>HIT TP</span>
              <strong className={styles.kpiVal} style={{ color: '#10b981' }}>{thaiKpis.hitTp}</strong>
              <span className={styles.kpiSub}>ถึงเป้ากำไร TP1/2</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>HIT SL</span>
              <strong className={styles.kpiVal} style={{ color: '#ef4444' }}>{thaiKpis.hitSl}</strong>
              <span className={styles.kpiSub}>ตัดขาดทุนตามวินัย</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>NEAR TP</span>
              <strong className={styles.kpiVal} style={{ color: '#38bdf8' }}>{thaiKpis.nearTp}</strong>
              <span className={styles.kpiSub}>ใกล้เป้า (&lt;2.0%)</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>WIN RATE</span>
              <strong className={styles.kpiVal} style={{ color: '#a855f7' }}>{thaiKpis.winRate}</strong>
              <span className={styles.kpiSub}>รอผลไม้ปิดจากบันทึกระบบ</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>AVG RETURN</span>
              <strong className={styles.kpiVal} style={{ color: '#10b981' }}>{thaiKpis.avgReturn}</strong>
              <span className={styles.kpiSub}>การเปลี่ยนแปลงแท่งล่าสุด</span>
            </div>
          </div>

          {/* Methodology Card */}
          <div className={styles.methodologyCard} style={{ background: 'rgba(2, 132, 199, 0.08)', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
            <Zap size={22} className={styles.methodologyIcon} style={{ color: '#38bdf8' }} />
            <div>
              <h4 className={styles.methodologyTitle} style={{ color: '#bae6fd' }}>
                วิธีคัดกรองหุ้นไทยวันนี้ (SET100 / SETHD 4-Pillar Confluence)
              </h4>
              <div className={styles.methodologyGrid}>
                <span>✅ <b>EMA 25 &gt; EMA 50 &gt; EMA 75:</b> หุ้นไทยที่มีโครงสร้างแนวโน้มขาขึ้นชัดเจน</span>
                <span>✅ <b>Camarilla Pivot S2-S3:</b> รอรับจังหวะย่อตัว ไม่ไล่ราคาซื้อบนยอด</span>
                <span>✅ <b>RSI 40 - 60:</b> โซนสะสมพลังเพื่อขึ้นต่อ ตัดตัว Overbought ออก</span>
                <span>✅ <b>MACD Histogram:</b> โมเมนตัมกำลังขยายตัวในแดนบวก</span>
              </div>
              <p className={styles.methodologyUniverse}>
                Universe: <b>{liveData?.coverage.thai.total??0} หุ้นในชุดสแกน</b> · เปรียบเทียบคะแนนและ R:R ก่อนเลือกแผนเฝ้าดู
              </p>
            </div>
          </div>

          {/* Controls Bar */}
          <div className={styles.controlsBar}>
            <div className={styles.searchBox}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="ค้นหาหุ้นไทย เช่น CPALL, BDMS, ADVANC, GULF..."
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

          <div className={styles.displayLimit}><span>แสดงเด่นสูงสุด 5 ตัว จากผลคัดกรอง {filteredThaiStocks.length} ตัว · เป็นแผนเฝ้าดู ยังไม่ยืนยันเข้า</span><button type="button" onClick={()=>showAllScans('SET')}>เปิดสแกนรวมหุ้นไทย ({filteredThaiStocks.length})</button></div>
          {/* Thai Cards Grid */}
          <div className={styles.cardsGrid}>
            {rankedRadarRows(filteredThaiStocks).slice(0,FEATURED_LIMIT).map((item, index) => {
              const scored = item.scored;
              if (!scored) return null;
              const isExpanded = expandedSymbol === item.symbol;
              const isTracked = trackedPicks.some((p) => p.symbol === item.symbol);

              return (
                <div key={item.symbol} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div className={styles.symbolGroup}>
                      <div className={styles.avatarBox} style={{ background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%)' }}>
                        <span>{item.symbol}</span>
                        <small>#{index + 1}</small>
                      </div>
                      <div>
                        <div className={styles.titleLine}>
                          <h3 className={styles.symbolText}>{item.symbol}</h3>
                          {scored.emaAligned && <span className={styles.tagEma}>EMA ขาขึ้น ✓</span>}
                          {isTracked && <span className={styles.tagPicked}>ในพอร์ตติดตาม ★</span>}
                        </div>
                        <p className={styles.nameText}>
                          {item.name} · กลุ่ม {item.sector}
                        </p>
                      </div>
                    </div>

                    <div className={styles.priceGroup}>
                      <span className={styles.priceVal}>{item.currentPrice.toFixed(2)} ฿</span>
                      <span className={`${styles.changeVal} ${item.changePct >= 0 ? styles.pos : styles.neg}`}>
                        {item.changePct >= 0 ? '+' : ''}{item.changePct.toFixed(2)}%
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
                          backgroundColor: scored.totalScore >= 11 ? '#10b981' : scored.totalScore >= 7 ? '#f59e0b' : '#ef4444',
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

                  {/* Price Progress Bar Slider */}
                  <PriceProgressBar sl={scored.sl} entry={scored.entry} current={item.currentPrice} tp2={scored.tp2} />

                  {/* Technical Accordion Toggle */}
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

                  {isExpanded && <TechnicalAccordion scored={scored} currentPrice={item.currentPrice} />}

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      onClick={() => handleTogglePick(item, 'SET')}
                      className={`${styles.actionBtn} ${isTracked ? styles.actionBtnPicked : styles.actionBtnSecondary}`}
                    >
                      {isTracked ? '✓ บันทึกใน หุ้นไทย Picks แล้ว' : '+ เพิ่มเข้า หุ้นไทย Picks'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSpeakSingle({ symbol: item.symbol, entry: scored.entry, tp1: scored.tp1, sl: scored.sl, status: item.currentPrice <= scored.entry * 1.01 ? 'อยู่ในโซนซื้อ' : 'รอรับย่อ', market: 'SET' })}
                      className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                      title="ฟังเสียงสัญญาณของหุ้นไทยตัวนี้"
                    >
                      <Volume2 size={14} /> ฟังเสียง
                    </button>
                    {onSelectSymbol && (
                      <button
                        type="button"
                        onClick={() => handleGoToChart(item)}
                        className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                        title="เปิดดูกราฟเทคนิค TradingView"
                      >
                        ดูกราฟ ↗
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 3: PICKS LEDGER & PERFORMANCE TRACKING
          ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'picks-ledger' && (
        <div className={styles.tabContent}>
          <div className={styles.ledgerContainer}>
            {/* Header Strip */}
            <div className={styles.ledgerHeaderBar}>
              <div>
                <h3 className="text-base font-extrabold text-white m-0 mb-1 flex items-center gap-2">
                  <ListChecks size={20} className="text-sky-400" />
                  <span>แผนเฝ้าดูส่วนตัว (บันทึกในเบราว์เซอร์นี้)</span>
                </h3>
                <p className="text-xs text-slate-400 m-0">
                  รายการที่กดบันทึกไว้เอง ไม่ใช่ออเดอร์หรือไม้จากเซิร์ฟเวอร์ · ไม่รวมสถิติแพ้ชนะ เปิดแท็บ “รอเข้า / ติดตาม / แพ้ชนะ” เพื่อดูไม้จริง
                </p>
              </div>

              <div className={styles.ledgerStatsStrip}>
                <div className={styles.ledgerStatPill}>
                  <span className="text-slate-400">ติดตามอยู่:</span>
                  <strong>{trackedPicks.length} ตัว</strong>
                </div>
                <div className={styles.ledgerStatPill}><span>Win rate</span><strong>ไม่นับบันทึกส่วนตัว</strong></div>
              </div>
            </div>

            <nav className={styles.workflowPagination} aria-label="หน้าแผนส่วนตัว"><button type="button" disabled={personalRows.page===1} onClick={()=>setPersonalPage(p=>p-1)}>ก่อนหน้า</button><span>{personalRows.page} / {personalRows.pages} · หน้าละ 7</span><button type="button" disabled={personalRows.page===personalRows.pages} onClick={()=>setPersonalPage(p=>p+1)}>ถัดไป</button></nav>
            {/* Filter Pills */}
            <div className={styles.filterPills}>
              {[
                { id: 'all', label: `ทั้งหมด (${trackedPicks.length})` },
                { id: 'thai', label: `หุ้นไทย Picks (${trackedPicks.filter(p => p.market === 'SET').length})` },
                { id: 'dr', label: `DR Picks (${trackedPicks.filter(p => p.market === 'DR80').length})` },
                { id: 'buyzone', label: 'อยู่ใน Buy Zone' },
                { id: 'tp', label: 'Hit TP (ถึงเป้า)' },
                { id: 'sl', label: 'Hit SL (ตัดขาดทุน)' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {setLedgerFilter(f.id);setPersonalPage(1);}}
                  className={`${styles.filterPill} ${ledgerFilter === f.id ? styles.filterPillActive : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Ledger Table */}
            <div className={styles.tableCard}>
              <div className={styles.tableResponsive}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>หุ้น / DR</th>
                      <th>ตลาด</th>
                      <th>ราคาเข้า</th>
                      <th>ราคาปัจจุบัน</th>
                      <th>ผลตอบแทน %</th>
                      <th>เป้าหมาย TP1 / TP2</th>
                      <th>ตัดขาดทุน SL</th>
                      <th>R:R</th>
                      <th className={styles.tableSliderCol}>ตำแหน่งราคา</th>
                      <th>สถานะ</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personalRows.rows.map((pick) => {
                      const pos = pick.returnPct >= 0;
                      return (
                        <tr key={pick.id}>
                          <td>
                            <b className="text-white text-sm">{pick.symbol}</b>
                            <small className="block text-slate-400 text-[11px]">{pick.name}</small>
                          </td>
                          <td>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded"
                              style={{
                                background: pick.market === 'SET' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: pick.market === 'SET' ? '#38bdf8' : '#f59e0b',
                              }}
                            >
                              {pick.market}
                            </span>
                          </td>
                          <td>
                            <span className="font-semibold text-slate-300">{pick.entryPrice.toFixed(2)} ฿</span>
                          </td>
                          <td>
                            <b className="text-white font-bold">{pick.currentPrice.toFixed(2)} ฿</b>
                          </td>
                          <td>
                            <strong
                              style={{ color: pos ? '#10b981' : '#ef4444', fontWeight: 800 }}
                            >
                              {pos ? '+' : ''}{pick.returnPct.toFixed(2)}%
                            </strong>
                          </td>
                          <td>
                            <span className="text-emerald-400 font-semibold">{pick.tp1.toFixed(2)}</span>
                            <small className="text-slate-400 block text-[10px]">TP2: {pick.tp2.toFixed(2)}</small>
                          </td>
                          <td>
                            <span className="text-red-400 font-semibold">{pick.sl.toFixed(2)}</span>
                          </td>
                          <td>
                            <span className="text-slate-300 font-medium">1 : {pick.riskReward.toFixed(2)}</span>
                          </td>
                          <td className={styles.tableSliderCol}>
                            <PriceProgressBar
                              sl={pick.sl}
                              entry={pick.entryPrice}
                              current={pick.currentPrice}
                              tp2={pick.tp2}
                            />
                          </td>
                          <td>
                            <span
                              className={`${styles.morningStatusPill} ${
                                pick.status.includes('Hit TP')
                                  ? styles.statusHitTp
                                  : pick.status.includes('Hit SL')
                                  ? styles.statusHitSl
                                  : pick.status === 'In Buy Zone'
                                  ? styles.statusInBuyZone
                                  : pick.status === 'Near TP'
                                  ? styles.statusNearTp
                                  : styles.statusWaiting
                              }`}
                            >
                              {pick.status}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              {onSelectSymbol && (
                                <button
                                  type="button"
                                  onClick={() => handleGoToChart(pick)}
                                  className={styles.singleSpeakBtn}
                                  title="เปิดดูกราฟเทคนิค TradingView"
                                >
                                  <ArrowUpRight size={13} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleSpeakSingle({ symbol: pick.symbol, entry: pick.entryPrice, tp1: pick.tp1, sl: pick.sl, status: pick.status, market: pick.market })}
                                className={styles.singleSpeakBtn}
                                title="ฟังเสียงเตือน"
                              >
                                <Volume2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTrackedPicks(prev => prev.filter(p => p.id !== pick.id));
                                  setToastData({
                                    title: `ลบ ${pick.symbol} ออกจากบันทึกแล้ว`,
                                    desc: 'อัปเดตรายการเรียบร้อย',
                                    type: 'info',
                                  });
                                }}
                                className="text-slate-500 hover:text-red-400 text-xs px-1.5 py-1 rounded transition"
                                title="ลบออกจากบันทึก"
                              >
                                ×
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 4: INDICATIVE & ARBITRAGE BRIDGE
          ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'dr-bridge' && (
        <div className={styles.tabContent}>
          <div className={styles.bridgeIntroCard}>
            <div className={styles.bridgeIconWrap}>
              <Coins size={28} className="text-amber-400" />
            </div>
            <div>
              <h3 className={styles.bridgeTitle}>Indicative Fair Value &amp; Arbitrage Spread Bridge</h3>
              <p className={styles.bridgeDesc}>
                เปรียบเทียบมูลค่าที่แท้จริงของ DR กับราคาตลาดหุ้นแม่ (Underlying USD) ผ่านอัตราแลกเปลี่ยน (USD/THB)
                ทำให้เห็นทันทีว่า DR บนกระดาน SET ปัจจุบันกำลังเทรดถูกกว่า (Discount) หรือแพงกว่า (Premium)
              </p>
            </div>
          </div>

          {/* Interactive Calculator Sandbox */}
          <div className={styles.sandboxCard}>
            <div className={styles.sandboxHeader}>
              <Zap size={18} />
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
            <h4 className={styles.tableHeading}>ตารางเปรียบเทียบ Arbitrage ของ DR80 ยอดนิยม</h4><p role="status">แสดงส่วนต่างเมื่อราคา DR หุ้นแม่ และ FX มีเวลาอ้างอิงห่างกันไม่เกิน 15 นาที · หากเวลาไม่ตรงกันจะยังไม่แสดง Fair Price</p>
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>DR Symbol</th>
                    <th>หุ้นแม่ / สกุลเงิน</th>
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
                        <td>{item.underlyingUsd?.toFixed(2)} {item.currency}</td>
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

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 5: THAI HIGH-DIVIDEND PORTFOLIO (SETHD)
          ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'thai-dividend' && (
        <div className={styles.tabContent}><p role="status">ยังไม่มีแหล่งข้อมูลเงินปันผลและวัน XD ที่ยืนยันแล้ว จึงยังไม่แสดง Yield หรือคะแนนความปลอดภัย · สัดส่วนด้านล่างเป็นโมเดลประกอบการศึกษา</p>
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
                <strong>{liveData?.avgDivYield&&liveData.avgDivYield!=='—'?`${liveData.avgDivYield}%`:'—'}</strong>
                <small>รอข้อมูลเงินปันผลที่ยืนยันแล้ว</small>
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
              <span>เรดาร์หุ้นปันผลเด่น &amp; ปฏิทินวันขึ้นเครื่องหมาย XD (Thai Dividend Radar)</span>
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
                  {liveDividendStocks.map((stock) => (
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
