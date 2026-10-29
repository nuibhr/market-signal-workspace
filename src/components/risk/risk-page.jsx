'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Calculator,
  CandlestickChart,
  CheckCircle2,
  Compass,
  DollarSign,
  HelpCircle,
  Percent,
  PieChart,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { calculatePositionSize } from '../../risk/calculator.mjs';
import MobileDock from '../mobile-dock.jsx';
import SoundMonitorPill from '../monitor/sound-monitor-pill.jsx';
import ProToolsNav from '../pro-tools-nav.jsx';
import MarketNavigation from '../market-navigation.jsx';
import styles from './risk-page.module.css';

const PRESET_MARKETS = [
  { id: 'thai', label: '🇹🇭 หุ้นไทย (SET/mai)', currency: 'THB', defaultEntry: 50.0, defaultSl: 48.0, step: 0.25 },
  { id: 'tfex', label: '⚡ TFEX SET50', currency: 'THB', defaultEntry: 920.0, defaultSl: 915.0, step: 0.5 },
  { id: 'us', label: '🇺🇸 หุ้นสหรัฐฯ (US Equity)', currency: 'USD', defaultEntry: 150.0, defaultSl: 145.0, step: 0.5 },
  { id: 'gold', label: '🟡 ทองคำ (XAU/USD)', currency: 'USD', defaultEntry: 2650.0, defaultSl: 2642.0, step: 1.0 },
  { id: 'forex', label: '💱 Forex (EUR/USD)', currency: 'USD', defaultEntry: 1.085, defaultSl: 1.082, step: 0.0005 },
];

const MARKET_TERMINAL_MAP = {
  thai: { href: '/thai', name: 'หุ้นไทย (SET)', chartHref: '/thai#chart-panel', scannerHref: '/thai#section-auto-pick' },
  tfex: { href: '/tfex', name: 'TFEX S50 Series', chartHref: '/tfex#chart-panel', scannerHref: '/tfex' },
  us: { href: '/us', name: 'หุ้นสหรัฐฯ (US 500)', chartHref: '/us#chart-panel', scannerHref: '/us' },
  gold: { href: '/forex', name: 'ทองคำ XAU/USD (Forex Desk)', chartHref: '/forex#forex-content', scannerHref: '/forex' },
  forex: { href: '/forex', name: 'Forex MT5 Desk', chartHref: '/forex#forex-content', scannerHref: '/forex' },
};

export default function RiskPage() {
  const [market, setMarket] = useState('thai');
  const [capital, setCapital] = useState(100000);
  const [riskPercent, setRiskPercent] = useState(1.0);
  const [side, setSide] = useState('long');
  const [entryPrice, setEntryPrice] = useState(50.0);
  const [stopLossPrice, setStopLossPrice] = useState(48.0);
  const [targetMultiple, setTargetMultiple] = useState(2.0);

  // Switch market preset
  const handleMarketChange = (newMarketId) => {
    setMarket(newMarketId);
    const preset = PRESET_MARKETS.find((m) => m.id === newMarketId);
    if (preset) {
      setEntryPrice(preset.defaultEntry);
      setStopLossPrice(preset.defaultSl);
      if (preset.currency === 'USD' && capital > 20000) {
        setCapital(5000);
      } else if (preset.currency === 'THB' && capital < 20000) {
        setCapital(100000);
      }
    }
  };

  const currentPreset = useMemo(() => PRESET_MARKETS.find((m) => m.id === market) || PRESET_MARKETS[0], [market]);

  const calc = useMemo(() => {
    return calculatePositionSize({
      market,
      capital,
      riskPercent,
      side,
      entryPrice,
      stopLossPrice,
      targetMultiple,
    });
  }, [market, capital, riskPercent, side, entryPrice, stopLossPrice, targetMultiple]);

  const terminalInfo = MARKET_TERMINAL_MAP[market] || MARKET_TERMINAL_MAP.thai;

  const quickCapitalPresets = currentPreset.currency === 'THB'
    ? [50000, 100000, 300000, 500000, 1000000]
    : [2000, 5000, 10000, 25000, 50000];

  const formatCurrency = (val) => {
    if (!Number.isFinite(val)) return '—';
    return val.toLocaleString('th-TH');
  };

  const slDistance = Math.abs(entryPrice - stopLossPrice);
  const slPercent = entryPrice > 0 ? ((slDistance / entryPrice) * 100).toFixed(2) : '0';
  const calculatedTp = side === 'long'
    ? entryPrice + slDistance * targetMultiple
    : entryPrice - slDistance * targetMultiple;

  return (
    <div className={styles.riskPage}>
      {/* ── 1. Top Header ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brandArea}>
            <Link
              href={terminalInfo.href}
              className={styles.backLink}
              title={`กลับสู่หน้ากระดานเทรด ${terminalInfo.name}`}
            >
              <ArrowLeft size={16} />
              <span>กลับสู่กระดาน</span>
            </Link>
            <div>
              <span className={styles.pageBadge}>PRO ANALYSIS SUITE · RISK &amp; POSITION</span>
              <h1 className={styles.pageTitle}>คำนวณขนาดไม้ &amp; คุมความเสี่ยงทุกตลาด</h1>
            </div>
          </div>
          <div className={styles.headerRight}>
            <SoundMonitorPill />
            <Link href="/account" className={styles.accountPill}>
              บัญชีของฉัน
            </Link>
          </div>
        </div>

        {/* Global Market Destinations Navigation */}
        <div className={styles.navStrip}>
          <MarketNavigation current="risk" />
        </div>
      </header>

      {/* Pro Tools Sub Navigation */}
      <ProToolsNav current="risk" />

      {/* ── 2. Main Content ── */}
      <main className={styles.mainContent}>
        {/* Market Switcher Tabs */}
        <div className={styles.marketTabsBar} role="tablist" aria-label="เลือกตลาด">
          {PRESET_MARKETS.map((m) => {
            const isActive = market === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`${styles.marketTabBtn} ${isActive ? styles.marketTabActive : ''}`}
                onClick={() => handleMarketChange(m.id)}
              >
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Calculator Grid: 2 Columns on Desktop, 1 Column on Mobile */}
        <div className={styles.calcGrid}>
          {/* ── Left Column: Interactive Inputs ── */}
          <section className={styles.calcCard} aria-label="ตั้งค่าความเสี่ยงและพารามิเตอร์เทรด">
            <div className={styles.cardHeading}>
              <div className={styles.cardTitle}>
                <Calculator size={18} style={{ color: '#38bdf8' }} />
                <h2>ตั้งค่าความเสี่ยง &amp; พารามิเตอร์</h2>
              </div>
              <span className={styles.currencyBadge}>
                {currentPreset.currency} · {currentPreset.label.split(' ')[0]}
              </span>
            </div>

            <div className={styles.formBody}>
              {/* Account Capital */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="capital-input">
                  <span>เงินทุนในพอร์ต ({currentPreset.currency})</span>
                  <span className={styles.labelHint}>วงเงินที่ใช้คำนวณสัดส่วนความเสี่ยง</span>
                </label>
                <div className={styles.inputWithAffix}>
                  <span className={styles.inputAffix}>{currentPreset.currency === 'THB' ? '฿' : '$'}</span>
                  <input
                    id="capital-input"
                    className={styles.inputField}
                    type="number"
                    min="1"
                    step="1000"
                    value={capital}
                    onChange={(e) => setCapital(Number(e.target.value))}
                  />
                </div>
                {/* Quick Capital Preset Buttons */}
                <div className={styles.quickPresetRow}>
                  {quickCapitalPresets.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      className={styles.quickPresetBtn}
                      onClick={() => setCapital(amt)}
                    >
                      {currentPreset.currency === 'THB' ? `${amt / 1000}K` : `$${amt / 1000}K`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Risk Percent */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  <span>ความเสี่ยงต่อไม้ (Risk per trade)</span>
                  <span className={styles.labelHint} style={{ color: '#34d399' }}>
                    งบเสี่ยงไม้ละ: {currentPreset.currency === 'THB' ? '฿' : '$'}{formatCurrency((capital * riskPercent) / 100)}
                  </span>
                </label>
                <div className={styles.pillGroup}>
                  {[0.5, 1.0, 1.5, 2.0, 3.0].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      className={`${styles.presetPill} ${riskPercent === pct ? styles.presetPillActive : ''}`}
                      onClick={() => setRiskPercent(pct)}
                    >
                      {pct}%
                    </button>
                  ))}
                  <div className={styles.customInputGroup}>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="10"
                      value={riskPercent}
                      onChange={(e) => setRiskPercent(Number(e.target.value))}
                      aria-label="เปอร์เซ็นต์ความเสี่ยงที่กำหนดเอง"
                    />
                    <span>%</span>
                  </div>
                </div>
              </div>

              {/* Side Long / Short Toggle */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  <span>ทิศทางโพซิชัน (Position Side)</span>
                </label>
                <div className={styles.sideToggle}>
                  <button
                    type="button"
                    className={`${styles.sideBtnLong} ${side === 'long' ? styles.sideBtnActiveLong : ''}`}
                    onClick={() => {
                      setSide('long');
                      if (stopLossPrice >= entryPrice) {
                        setStopLossPrice(Number((entryPrice * 0.96).toFixed(4)));
                      }
                    }}
                  >
                    <TrendingUp size={16} />
                    <span>LONG (เก็งกำไรขาขึ้น)</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.sideBtnShort} ${side === 'short' ? styles.sideBtnActiveShort : ''}`}
                    onClick={() => {
                      setSide('short');
                      if (stopLossPrice <= entryPrice) {
                        setStopLossPrice(Number((entryPrice * 1.04).toFixed(4)));
                      }
                    }}
                  >
                    <TrendingDown size={16} />
                    <span>SHORT (เก็งกำไรขาลง)</span>
                  </button>
                </div>
              </div>

              {/* Entry Price & Stop Loss */}
              <div className={styles.dualInputs}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="entry-input">
                    <span>ราคาเข้า (Entry)</span>
                  </label>
                  <div className={styles.inputWithAffix}>
                    <input
                      id="entry-input"
                      className={styles.inputField}
                      type="number"
                      step={currentPreset.step}
                      value={entryPrice}
                      onChange={(e) => setEntryPrice(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="sl-input">
                    <span>จุดตัดขาดทุน (Stop Loss)</span>
                  </label>
                  <div className={styles.inputWithAffix}>
                    <input
                      id="sl-input"
                      className={styles.inputField}
                      type="number"
                      step={currentPreset.step}
                      value={stopLossPrice}
                      onChange={(e) => setStopLossPrice(Number(e.target.value))}
                    />
                  </div>
                  <div className={styles.slDistanceBadge}>
                    <span>ระยะ SL: {slDistance.toFixed(currentPreset.step < 0.01 ? 4 : 2)} ({slPercent}%)</span>
                  </div>
                </div>
              </div>

              {/* Target Multiple R:R */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  <span>เป้าหมายกำไร (Reward:Risk Multiple)</span>
                  <span className={styles.labelHint} style={{ color: '#38bdf8' }}>
                    TP คาดการณ์: {calculatedTp.toFixed(currentPreset.step < 0.01 ? 4 : 2)}
                  </span>
                </label>
                <div className={styles.pillGroup}>
                  {[1.5, 2.0, 2.5, 3.0].map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`${styles.presetPill} ${targetMultiple === m ? styles.presetPillActive : ''}`}
                      onClick={() => setTargetMultiple(m)}
                    >
                      {m}R {m === 2.0 ? '★ แนะนำ' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Right Column: Calculated Results & Sizing Advice ── */}
          <section className={`${styles.calcCard} ${styles.resultsCard}`} aria-label="ผลการคำนวณขนาดไม้และความคุ้มค่า">
            <div className={styles.cardHeading}>
              <div className={styles.cardTitle}>
                <Scale size={18} style={{ color: '#38bdf8' }} />
                <h2>ผลลัพธ์ขนาดไม้ &amp; แผนเทรด</h2>
              </div>
              <span className={styles.riskTag}>
                ความเสี่ยง: {currentPreset.currency === 'THB' ? '฿' : '$'}{formatCurrency(calc.riskAmount)}
              </span>
            </div>

            {calc.isValid ? (
              <div>
                {/* Hero Position Size Display */}
                <div className={styles.heroSizeBox}>
                  <div className={styles.heroSizeLabel}>ขนาดออเดอร์ที่แนะนำ (Position Size)</div>
                  <div className={styles.heroSizeValue}>
                    <span className={styles.heroSizeNumber}>{calc.units?.toLocaleString()}</span>
                    <span className={styles.heroSizeUnit}>{calc.unitLabel}</span>
                  </div>
                  <div className={styles.heroSizeSub}>
                    มูลค่าออเดอร์รวม: <strong>{currentPreset.currency === 'THB' ? '฿' : '$'}{formatCurrency(calc.positionValue)}</strong>
                    {calc.marginRequired ? ` · เงินวางหลักประกัน: ${currentPreset.currency === 'THB' ? '฿' : '$'}${formatCurrency(calc.marginRequired)}` : ''}
                  </div>
                </div>

                {/* Key Metrics 2x2 Grid */}
                <div className={styles.metrics2x2}>
                  <div className={`${styles.metricBox} ${styles.boxLoss}`}>
                    <span className={styles.metricKicker}>🛑 ขาดทุนตามแผน (Risk 1R)</span>
                    <strong className={styles.metricVal}>
                      -{currentPreset.currency === 'THB' ? '฿' : '$'}{formatCurrency(calc.expectedLoss)}
                    </strong>
                    <span className={styles.metricSub}>ระยะ SL: {calc.stopDistance} ({calc.stopPercent}%)</span>
                  </div>

                  <div className={`${styles.metricBox} ${styles.boxGain}`}>
                    <span className={styles.metricKicker}>🎯 กำไรที่เป้าหมาย ({calc.targetMultiple}R)</span>
                    <strong className={styles.metricVal}>
                      +{currentPreset.currency === 'THB' ? '฿' : '$'}{formatCurrency(calc.expectedGain)}
                    </strong>
                    <span className={styles.metricSub}>ราคาเป้าหมาย: {calc.targetPrice}</span>
                  </div>

                  <div className={styles.metricBox}>
                    <span className={styles.metricKicker}>⚖️ อัตราส่วน Risk : Reward</span>
                    <strong className={styles.metricVal} style={{ color: '#38bdf8' }}>
                      {calc.riskRewardRatio}
                    </strong>
                    <span className={styles.metricSub}>
                      {calc.costBasis === 'estimated-0.157-percent-per-side' ? 'รวมค่าคอมมิชชั่นประมาณ 0.157%' : 'ก่อนค่าธรรมเนียมและสลิปเพจ'}
                    </span>
                  </div>

                  <div className={styles.metricBox}>
                    <span className={styles.metricKicker}>💳 เงินมัดจำประมาณการ (Margin)</span>
                    <strong className={styles.metricVal}>
                      {currentPreset.currency === 'THB' ? '฿' : '$'}{formatCurrency(calc.marginRequired)}
                    </strong>
                    <span className={styles.metricSub}>คำนวณตามประเภทบัญชี</span>
                  </div>
                </div>

                {/* Trade Blueprint Summary */}
                <div className={styles.tradeBlueprintCard}>
                  <div className={styles.blueprintTitle}>
                    {calc.units > 0 ? <ShieldCheck size={18} style={{ color: '#34d399' }} /> : <ShieldAlert size={18} style={{ color: '#fb7185' }} />}
                    <span>สรุปคำสั่งก่อนเปิดไม้ (Trade Blueprint):</span>
                  </div>
                  {calc.units === 0 ? (
                    <div style={{ color: '#fca5a5', fontSize: '12px', lineHeight: 1.5 }}>
                      งบความเสี่ยงที่ตั้งไว้ ({currentPreset.currency === 'THB' ? '฿' : '$'}{formatCurrency(calc.riskAmount)}) ไม่เพียงพอสำหรับขนาดขั้นต่ำ 1 {calc.unitLabel} — ลองขยับ Stop Loss ให้กระชับขึ้น หรือเพิ่มวงเงินในพอร์ต
                    </div>
                  ) : (
                    <div className={styles.blueprintList}>
                      <div className={styles.blueprintItem}>
                        <span>คำสั่ง:</span>
                        <strong style={{ color: side === 'long' ? '#34d399' : '#fb7185' }}>
                          {side.toUpperCase()} จำนวน {calc.units?.toLocaleString()} {calc.unitLabel}
                        </strong>
                      </div>
                      <div className={styles.blueprintItem}>
                        <span>ราคาเข้า / Stop Loss:</span>
                        <strong>เข้าที่ {calc.entryPrice} ➔ ตัดขาดทุนที่ {calc.stopLossPrice} (ไม่ถอย SL)</strong>
                      </div>
                      <div className={styles.blueprintItem}>
                        <span>เป้าหมายทำกำไร:</span>
                        <strong style={{ color: '#38bdf8' }}>
                          เป้าหมาย {calc.targetPrice} (สัดส่วน {calc.riskRewardRatio})
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.errorBox}>
                <ShieldAlert size={22} style={{ flexShrink: 0 }} />
                <span>{calc.error}</span>
              </div>
            )}

            {/* Quick Action Navigation */}
            <div className={styles.calcFooter}>
              <span className={styles.calcNote}>
                * เครื่องมือช่วยคำนวณเชิงคณิตศาสตร์เพื่อคุมความเสี่ยง ไม่มีการส่งคำสั่งซื้อขายจริง โปรดตรวจสภาพคล่องในตลาดก่อนตัดสินใจ
              </span>
              <div className={styles.actionLinks}>
                <Link
                  href={terminalInfo.chartHref}
                  className={`${styles.actionLink} ${styles.actionLinkPrimary}`}
                  title={`ดูกราฟสด ${terminalInfo.name}`}
                >
                  <CandlestickChart size={15} />
                  <span>เปิดดูกราฟจริง {terminalInfo.name}</span>
                  <ArrowUpRight size={13} />
                </Link>
                <Link
                  href={terminalInfo.scannerHref}
                  className={styles.actionLink}
                  title={`เปิดสแกนเนอร์ ${terminalInfo.name}`}
                >
                  <Compass size={15} />
                  <span>สแกนเนอร์ {terminalInfo.name}</span>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Mobile Sticky Navigation Dock */}
      <MobileDock />
    </div>
  );
}
