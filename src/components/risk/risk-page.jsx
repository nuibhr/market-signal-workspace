'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  DollarSign,
  HelpCircle,
  Percent,
  PieChart,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { calculatePositionSize } from '../../risk/calculator.mjs';
import MobileDock from '../mobile-dock.jsx';
import SoundMonitorPill from '../monitor/sound-monitor-pill.jsx';
import ProToolsNav from '../pro-tools-nav.jsx';
import '../../app/landing.css';
import '../../app/market-pages.css';

const PRESET_MARKETS = [
  { id: 'thai', label: 'หุ้นไทย (SET/mai)', currency: 'THB', defaultEntry: 50.0, defaultSl: 48.0, step: 0.25 },
  { id: 'tfex', label: 'TFEX SET50', currency: 'THB', defaultEntry: 920.0, defaultSl: 915.0, step: 0.5 },
  { id: 'us', label: 'หุ้นสหรัฐฯ (US Equity)', currency: 'USD', defaultEntry: 150.0, defaultSl: 145.0, step: 0.5 },
  { id: 'gold', label: 'Gold (XAU/USD)', currency: 'USD', defaultEntry: 2650.0, defaultSl: 2642.0, step: 1.0 },
  { id: 'forex', label: 'Forex (EUR/USD)', currency: 'USD', defaultEntry: 1.085, defaultSl: 1.082, step: 0.0005 },
];

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
        setCapital(5000); // sensible default in USD
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

  return (
    <div className="ng-market-page">
      <header className="ng-market-header">
        <div className="ng-market-header-inner">
          <div className="ng-brand-area">
            <Link href="/#pro-analysis-suite" className="ng-back-link" title="กลับสู่หน้ารวมเครื่องมือสถาบัน">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <span className="ng-page-badge">RISK &amp; POSITION SUITE</span>
              <h1 className="ng-page-title">เครื่องมือบริหารความเสี่ยง &amp; คำนวณขนาดไม้</h1>
            </div>
          </div>
          <div className="ng-header-right">
            <SoundMonitorPill />
            <Link href="/account" className="ng-account-pill">
              บัญชีของฉัน
            </Link>
          </div>
        </div>
      </header>

      {/* Pro Suite Quick Switcher Bar */}
      <ProToolsNav current="risk" />

      <main className="ng-market-content">
        {/* Market Selector Tabs */}
        <div className="ng-market-tabs" role="tablist" aria-label="เลือกตลาด">
          {PRESET_MARKETS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={market === m.id}
              className={`ng-tab-btn ${market === m.id ? 'is-active' : ''}`}
              onClick={() => handleMarketChange(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Calculator Layout: 2 Columns on Desktop, 1 Column on Mobile */}
        <div className="ng-calc-grid">
          {/* Left Column: Interactive Inputs */}
          <section className="ng-calc-card">
            <div className="ng-card-heading">
              <div className="ng-card-icon-title">
                <Calculator size={20} className="ng-text-accent" />
                <h2>ตั้งค่าความเสี่ยง &amp; พารามิเตอร์เทรด</h2>
              </div>
              <span className="ng-currency-badge">สกุลเงิน: {currentPreset.currency}</span>
            </div>

            <div className="ng-form-body">
              {/* Account Capital */}
              <div className="ng-form-group">
                <label htmlFor="capital-input">
                  เงินทุนในพอร์ต ({currentPreset.currency})
                  <span className="ng-label-hint">ยอดเงินสุทธิที่ใช้คำนวณสัดส่วนความเสี่ยง</span>
                </label>
                <div className="ng-input-affix">
                  <span className="ng-affix-label">{currentPreset.currency === 'THB' ? '฿' : '$'}</span>
                  <input
                    id="capital-input"
                    type="number"
                    min="1"
                    step="1000"
                    value={capital}
                    onChange={(e) => setCapital(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Risk Percent */}
              <div className="ng-form-group">
                <label>
                  ความเสี่ยงต่อไม้ (Risk per trade)
                  <span className="ng-label-hint">แนะนำ 1% - 2% สำหรับการเทรดระยะยาวที่ยั่งยืน</span>
                </label>
                <div className="ng-pill-group">
                  {[0.5, 1.0, 1.5, 2.0, 3.0].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      className={`ng-preset-pill ${riskPercent === pct ? 'is-active' : ''}`}
                      onClick={() => setRiskPercent(pct)}
                    >
                      {pct}%
                    </button>
                  ))}
                  <div className="ng-custom-pct">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="10"
                      value={riskPercent}
                      onChange={(e) => setRiskPercent(Number(e.target.value))}
                    />
                    <span>%</span>
                  </div>
                </div>
              </div>

              {/* Side Long / Short */}
              <div className="ng-form-group">
                <label>ทิศทางโพซิชัน (Side)</label>
                <div className="ng-side-toggle">
                  <button
                    type="button"
                    className={`ng-side-btn ng-side-long ${side === 'long' ? 'is-active' : ''}`}
                    onClick={() => {
                      setSide('long');
                      if (stopLossPrice >= entryPrice) {
                        setStopLossPrice(entryPrice * 0.96);
                      }
                    }}
                  >
                    <TrendingUp size={16} />
                    <span>LONG (ซื้อเก็งกำไรขาขึ้น)</span>
                  </button>
                  <button
                    type="button"
                    className={`ng-side-btn ng-side-short ${side === 'short' ? 'is-active' : ''}`}
                    onClick={() => {
                      setSide('short');
                      if (stopLossPrice <= entryPrice) {
                        setStopLossPrice(entryPrice * 1.04);
                      }
                    }}
                  >
                    <TrendingDown size={16} />
                    <span>SHORT (เก็งกำไรขาลง)</span>
                  </button>
                </div>
              </div>

              {/* Price Entry & Stop Loss */}
              <div className="ng-input-duo">
                <div className="ng-form-group">
                  <label htmlFor="entry-input">ราคาเข้า (Entry Price)</label>
                  <input
                    id="entry-input"
                    type="number"
                    step={currentPreset.step}
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(Number(e.target.value))}
                  />
                </div>
                <div className="ng-form-group">
                  <label htmlFor="sl-input">จุดตัดขาดทุน (Stop Loss)</label>
                  <input
                    id="sl-input"
                    type="number"
                    step={currentPreset.step}
                    value={stopLossPrice}
                    onChange={(e) => setStopLossPrice(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Target Multiple */}
              <div className="ng-form-group">
                <label>
                  เป้าหมายกำไร (Target Multiple / Reward:Risk)
                </label>
                <div className="ng-pill-group">
                  {[1.5, 2.0, 2.5, 3.0].map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`ng-preset-pill ${targetMultiple === m ? 'is-active' : ''}`}
                      onClick={() => setTargetMultiple(m)}
                    >
                      {m}R
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: Calculated Results & Sizing Advice */}
          <section className="ng-calc-card ng-results-card">
            <div className="ng-card-heading">
              <div className="ng-card-icon-title">
                <Scale size={20} className="ng-text-accent" />
                <h2>ผลการคำนวณขนาดไม้ &amp; ความคุ้มค่า</h2>
              </div>
              <span className="ng-tag-risk">ความเสี่ยง: {calc.riskAmount?.toLocaleString()} {currentPreset.currency}</span>
            </div>

            {calc.isValid ? (
              <div className="ng-results-body">
                {/* Hero Position Size Display */}
                <div className="ng-hero-size-box">
                  <span className="ng-size-label">ขนาดออเดอร์ที่แนะนำ (Position Size)</span>
                  <div className="ng-size-value">
                    <span className="ng-number">{calc.units?.toLocaleString()}</span>
                    <span className="ng-unit">{calc.unitLabel}</span>
                  </div>
                  <div className="ng-size-sub">
                    มูลค่าโพซิชั่น: <strong>{calc.positionValue?.toLocaleString()} {currentPreset.currency}</strong>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="ng-metrics-2x2">
                  <div className="ng-metric-box ng-box-loss">
                    <span className="ng-box-kicker">ขาดทุนสูงสุด (Max Loss)</span>
                    <strong className="ng-box-val">-{calc.expectedLoss?.toLocaleString()} {currentPreset.currency}</strong>
                    <small>ระยะ SL: {calc.stopDistance} ({calc.stopPercent}%)</small>
                  </div>
                  <div className="ng-metric-box ng-box-gain">
                    <span className="ng-box-kicker">กำไรที่เป้า ({calc.targetMultiple}R Gain)</span>
                    <strong className="ng-box-val">+{calc.expectedGain?.toLocaleString()} {currentPreset.currency}</strong>
                    <small>ราคาเป้าหมาย: {calc.targetPrice}</small>
                  </div>
                  <div className="ng-metric-box">
                    <span className="ng-box-kicker">อัตราส่วน Risk : Reward</span>
                    <strong className="ng-box-val ng-text-accent">{calc.riskRewardRatio}</strong>
                    <small>คุ้มค่าตามเกณฑ์ขั้นต่ำ 1:1.5</small>
                  </div>
                  <div className="ng-metric-box">
                    <span className="ng-box-kicker">เงินมัดจำประมาณการ (Margin)</span>
                    <strong className="ng-box-val">{calc.marginRequired?.toLocaleString()} {currentPreset.currency}</strong>
                    <small>คำนวณตามประเภทบัญชี</small>
                  </div>
                </div>

                {/* Practical Advice Banner */}
                <div className="ng-advice-banner">
                  <div className="ng-advice-icon">
                    {calc.units > 0 ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                  </div>
                  <div>
                    <h4>คำแนะนำก่อนส่งคำสั่ง:</h4>
                    {calc.units === 0 ? (
                      <p>
                        ระยะ Stop Loss กว้างเกินไปเมื่อเทียบกับวงเงินความเสี่ยง ({calc.riskAmount} {currentPreset.currency})
                        ทำให้ไม่สามารถเปิดได้แม้แต่ 1 {calc.unitLabel} — ลองขยับจุด SL ให้กระชับขึ้น หรือเพิ่มวงเงิน
                      </p>
                    ) : (
                      <p>
                        วางคำสั่ง {side.toUpperCase()} จำนวน <strong>{calc.units?.toLocaleString()} {calc.unitLabel}</strong> ที่ราคา {calc.entryPrice}
                        พร้อมตั้ง Stop Loss อัตโนมัติที่ {calc.stopLossPrice} ทันที โดยไม่เลื่อนจุดตัดขาดทุนหนีราคา
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="ng-error-box">
                <ShieldAlert size={24} className="ng-text-danger" />
                <p>{calc.error}</p>
              </div>
            )}

            <div className="ng-calc-footer">
              <span className="ng-calc-note">
                * เครื่องมือช่วยคำนวณเชิงคณิตศาสตร์ ไม่มีการส่งคำสั่งซื้อขายจริง โปรดตรวจสภาพคล่องในตลาดจริงก่อนส่งออเดอร์
              </span>
              <Link href="/daytrade" className="ng-action-link">
                ไปยังหน้า Daytrade Scanner <ArrowUpRight size={14} />
              </Link>
            </div>
          </section>
        </div>
      </main>

      <MobileDock />
    </div>
  );
}
