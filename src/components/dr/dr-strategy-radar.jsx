'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  BarChart2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Compass,
  DollarSign,
  HelpCircle,
  Landmark,
  Layers,
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

export default function DrStrategyRadar({ onSelectSymbol, currentMarket = 'dr' }) {
  const [activeTab, setActiveTab] = useState('dr-scanner'); // 'dr-scanner' | 'dr-bridge' | 'thai-dividend'
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'bullish' | 'buyzone' | 'highscore'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSymbol, setExpandedSymbol] = useState('AAPL80');
  const [addedPicks, setAddedPicks] = useState([]);

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

  const handleTogglePick = (symbol) => {
    setAddedPicks((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
  };

  return (
    <section className={styles.container} aria-label="DR Strategy & Thai Dividend Radar">
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

                  {/* Camarilla Pivots Drawer */}
                  <div className={styles.detailsToggle}>
                    <button
                      type="button"
                      onClick={() => setExpandedSymbol(isExpanded ? null : item.symbol)}
                      className={styles.toggleBtn}
                    >
                      <span>ระดับราคา Camarilla Pivots (8 Levels)</span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className={styles.camarillaDrawer}>
                      <div className={styles.camGrid}>
                        <div className={styles.camItem}>
                          <span className={styles.camR}>R4 (Breakout)</span>
                          <b>{cam.R4.toFixed(2)}</b>
                        </div>
                        <div className={styles.camItem}>
                          <span className={styles.camR}>R3 (TP2 Zone)</span>
                          <b>{cam.R3.toFixed(2)}</b>
                        </div>
                        <div className={styles.camItem}>
                          <span className={styles.camR}>R2</span>
                          <b>{cam.R2.toFixed(2)}</b>
                        </div>
                        <div className={styles.camItem}>
                          <span className={styles.camR}>R1 (TP1 Target)</span>
                          <b>{cam.R1.toFixed(2)}</b>
                        </div>
                        <div className={`${styles.camItem} ${styles.camPivotItem}`}>
                          <span className={styles.camP}>Pivot Point</span>
                          <b>{cam.pivot.toFixed(2)}</b>
                        </div>
                        <div className={styles.camItem}>
                          <span className={styles.camS}>S1</span>
                          <b>{cam.S1.toFixed(2)}</b>
                        </div>
                        <div className={styles.camItem}>
                          <span className={styles.camS}>S2 (Buy Buffer)</span>
                          <b>{cam.S2.toFixed(2)}</b>
                        </div>
                        <div className={styles.camItem}>
                          <span className={styles.camS}>S3 (Ideal Entry)</span>
                          <b>{cam.S3.toFixed(2)}</b>
                        </div>
                        <div className={styles.camItem}>
                          <span className={styles.camS}>S4 (Hard SL)</span>
                          <b>{cam.S4.toFixed(2)}</b>
                        </div>
                      </div>

                      <div className={styles.techNote}>
                        <p>
                          <b>สูตรคำนวณ Camarilla:</b> โซนรอรับที่ดีที่สุดคือบริเวณ <b>S2-S3 ({cam.S2.toFixed(2)} – {cam.S3.toFixed(2)})</b>{' '}
                          โดยมีจุด Stop Loss ชัดเจนใต้ระดับ <b>S4 ({cam.S4.toFixed(2)})</b>{' '}
                          และมีเป้าหมายทำกำไรระลอกแรกที่ <b>R1 ({cam.R1.toFixed(2)})</b> / ระลอกสองที่ <b>R3 ({cam.R3.toFixed(2)})</b>
                        </p>
                      </div>
                    </div>
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
