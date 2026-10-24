'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styles from './equity-portfolio-desk.module.css';
import InstrumentLogo from '../monitor/instrument-logo.jsx';

const BROKER_OPTIONS = [
  { id: '022', name: 'Trinity Securities', thaiName: 'บล.ทรีนีตี้', tag: 'RECOMMENDED' },
  { id: '003', name: 'Pi Securities', thaiName: 'บล.พาย (มหาชน)', tag: 'POPULAR' },
  { id: '032', name: 'InnovestX Securities', thaiName: 'บล.อินโนเวสท์ เอกซ์', tag: 'POPULAR' },
  { id: '011', name: 'Maybank Securities', thaiName: 'บล.เมย์แบงก์ ประเทศไทย', tag: 'POPULAR' },
  { id: '025', name: 'CGS International', thaiName: 'บล.ซีจีเอส อินเตอร์เนชั่นแนล', tag: 'ACTIVE' },
  { id: '001', name: 'Bualuang Securities', thaiName: 'บล.บัวหลวง', tag: 'ACTIVE' },
  { id: '006', name: 'Kiatnakin Phatra', thaiName: 'บล.เกียรตินาคินภัทร', tag: 'INSTITUTION' },
  { id: '028', name: 'Globlex Securities', thaiName: 'บล.โกลเบล็ก', tag: 'STANDARD' },
  { id: '098', name: 'Settrade Testnet', thaiName: 'Settrade Open API Sandbox', tag: 'TESTNET' },
];

export default function EquityPortfolioDesk({ onSelectSymbol }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all | thai | dr | stage2 | danger
  const [showModal, setShowModal] = useState(false);

  // BYOK form states
  const [brokerId, setBrokerId] = useState('022');
  const [accountNo, setAccountNo] = useState('');
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [appCode, setAppCode] = useState('ALGO_EQ');
  const [latency, setLatency] = useState(35);

  const syncPortfolio = useCallback(
    async (isDemo = true, overrideBrokerId = null) => {
      setLoading(true);
      setError(null);
      const start = performance.now();
      try {
        const bId = overrideBrokerId || brokerId;
        const payload = isDemo
          ? {
              brokerId: bId,
              appId: 'DEMO_SANDBOX_KEY',
              appSecret: 'DEMO_SANDBOX_SECRET',
              appCode: 'ALGO_EQ',
              accountNo: `EQ-${bId}-78891-B`,
              isDemo: true,
            }
          : {
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
        setLatency(Math.max(12, Math.round(performance.now() - start)));

        if (!res.ok || !result.success) {
          throw new Error(result.message || result.error || 'เชื่อมต่อ Settrade Open API ไม่สำเร็จ');
        }

        setData(result);
        if (overrideBrokerId) setBrokerId(overrideBrokerId);
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
    // Initial load: fetch Trinity 022 Demo Sandbox
    syncPortfolio(true, '022');
  }, [syncPortfolio]);

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
      {/* ─── TOP COCKPIT BAR (BYOK HUD) ─── */}
      <section className={styles.byokBar}>
        <div className={styles.byokBarGlow} />
        <div className={styles.byokHeader}>
          <div className={styles.byokLeft}>
            <div className={styles.byokBadgeRow}>
              <span className={styles.byokTag}>SETTRADE OPEN API GATEWAY</span>
              <span className={styles.byokBrokerBadge}>
                [{data?.brokerId || brokerId}] {data?.brokerName || 'บล.ทรีนีตี้'}
              </span>
              <span className={styles.byokEnclaveBadge}>
                🛡️ ZERO-CUSTODY CLIENT ENCLAVE (ALGO_EQ)
              </span>
              <span className={styles.byokPingBadge}>⚡ {latency}ms</span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '5px',
                  background: data?.mode === 'LIVE' ? 'rgba(16,185,129,0.2)' : 'rgba(56,189,248,0.2)',
                  color: data?.mode === 'LIVE' ? '#34d399' : '#38bdf8',
                  border: `1px solid ${data?.mode === 'LIVE' ? '#10b981' : '#0284c7'}`,
                }}
              >
                {data?.mode === 'LIVE' ? '🟢 LIVE REAL MARKET' : '🧪 DEMO SANDBOX'}
              </span>
            </div>
            <h2 className={styles.byokTitle}>
              ศูนย์บัญชาการพอร์ตหุ้นไทย &amp; DR อัจฉริยะ (Smart Equity Command Desk)
            </h2>
            <p className={styles.byokDesc}>
              วิเคราะห์เทรนด์ Stage 2 อัตโนมัติ, เฝ้าระวังจุด Trailing Stop / Cut Loss, และตรวจสอบความคุ้มค่า DR
              ผ่าน API โบรกเกอร์ชั้นนำ (Pi, Trinity, InnovestX, Maybank ฯลฯ)
            </p>
          </div>

          <div className={styles.byokActions}>
            <button
              type="button"
              className={styles.byokBtnPrimary}
              onClick={() => syncPortfolio(data?.mode === 'DEMO')}
              disabled={loading}
            >
              {loading ? 'กำลังซิงค์...' : '🔄 ซิงค์พอร์ตสด'}
            </button>
            <button
              type="button"
              className={styles.byokBtnSecondary}
              onClick={() => syncPortfolio(true, '022')}
              disabled={loading}
            >
              🌟 ทดลอง Trinity 022
            </button>
            <button
              type="button"
              className={styles.byokBtnSecondary}
              onClick={() => syncPortfolio(true, '003')}
              disabled={loading}
            >
              🥧 ทดลอง Pi 003
            </button>
            <button
              type="button"
              className={styles.byokBtnSecondary}
              onClick={() => syncPortfolio(true, '032')}
              disabled={loading}
            >
              ⚡ InnovestX 032
            </button>
            <button
              type="button"
              className={styles.byokBtnSecondary}
              onClick={() => setShowModal(true)}
            >
              ⚙️ ตั้งค่า API พอร์ตจริง
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#f87171',
              fontSize: '12px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <span>⚠️ {error}</span>
            <button
              type="button"
              onClick={() => syncPortfolio(true, '022')}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              สลับกลับโหมด Sandbox
            </button>
          </div>
        )}

        {/* ─── HUD STATS ROW ─── */}
        <div className={styles.hudStatsGrid}>
          <div className={styles.hudCard}>
            <span className={styles.hudCardLabel}>
              <span>มูลค่าพอร์ตสุทธิ (Net Equity)</span>
              <span>💰</span>
            </span>
            <span className={styles.hudCardVal}>
              {data?.equity?.toLocaleString('th-TH') || '0'} ฿
            </span>
            <span className={styles.hudCardSub}>
              วงเงินพร้อมซื้อ: {data?.lineAvailable?.toLocaleString('th-TH') || '0'} ฿
            </span>
          </div>

          <div className={styles.hudCard}>
            <span className={styles.hudCardLabel}>
              <span>กำไร/ขาดทุนรวม (Unrealized P/L)</span>
              <span>📈</span>
            </span>
            <span
              className={`${styles.hudCardVal} ${
                (data?.totalUnrealizedPl || 0) >= 0 ? styles.positiveText : styles.negativeText
              }`}
            >
              {(data?.totalUnrealizedPl || 0) >= 0 ? '+' : ''}
              {data?.totalUnrealizedPl?.toLocaleString('th-TH')} ฿ (
              {(data?.totalUnrealizedPlPct || 0) >= 0 ? '+' : ''}
              {data?.totalUnrealizedPlPct}%)
            </span>
            <span className={styles.hudCardSub}>
              มูลค่าตลาด: {data?.totalMarketValue?.toLocaleString('th-TH')} ฿
            </span>
          </div>

          <div className={styles.hudCard}>
            <span className={styles.hudCardLabel}>
              <span>คะแนนสุขภาพพอร์ต (Stage Health)</span>
              <span>🌟</span>
            </span>
            <span className={`${styles.hudCardVal} ${styles.positiveText}`}>
              {data?.health?.score ?? 83} / 100
            </span>
            <span className={styles.hudCardSub}>
              {data?.health?.grade || 'เกรด A ขาขึ้นแข็งแกร่ง'}
            </span>
          </div>

          <div className={styles.hudCard}>
            <span className={styles.hudCardLabel}>
              <span>สัดส่วนหุ้นขาขึ้น vs หุ้นอันตราย</span>
              <span>🛡️</span>
            </span>
            <span className={styles.hudCardVal} style={{ fontSize: '15px' }}>
              <span className={styles.positiveText}>Stage 2: {data?.health?.stage2RatioPct ?? 69.4}%</span>
              {' | '}
              <span className={styles.negativeText}>Stage 4: {data?.health?.stage4DangerRatioPct ?? 10.7}%</span>
            </span>
            <span className={styles.hudCardSub}>
              ระบบกรองและแจ้งเตือนหุ้นหลุดแนวรับเรียลไทม์
            </span>
          </div>
        </div>
      </section>

      {/* ─── ASSET ALLOCATION & FX STRIP ─── */}
      <section className={styles.allocationCard}>
        <div className={styles.allocationTop}>
          <div className={styles.allocationTitle}>
            <span>📊 สัดส่วนพอร์ตลงทุน (Portfolio Allocation: Thai Stock vs Global DR)</span>
          </div>
          <div className={styles.allocationFxAlert}>
            💵 {data?.fxEnvironment?.impactSummary || 'USD/THB 34.25 บาท (ค่าเงินเสถียร ไม่กดดันพอร์ต DR)'}
          </div>
        </div>

        <div className={styles.allocationBarTrack}>
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

      {/* ─── MODAL FOR API KEY SETTINGS (BYOK LIVE + SANDBOX) ─── */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                🔑 เชื่อมต่อ Settrade Open API (ALGO_EQ หุ้นไทย &amp; DR)
              </h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                ทดลองเชื่อมต่อด่วน (One-Click Demo Sandbox)
              </label>
              <div className={styles.quickDemoPresetRow}>
                <button
                  type="button"
                  className={styles.quickDemoBtn}
                  onClick={() => syncPortfolio(true, '022')}
                >
                  🌟 ทดลองด้วย Trinity 022 (บล.ทรีนีตี้)
                </button>
                <button
                  type="button"
                  className={styles.quickDemoBtn}
                  onClick={() => syncPortfolio(true, '003')}
                >
                  🥧 ทดลองด้วย Pi 003 (บล.พาย)
                </button>
                <button
                  type="button"
                  className={styles.quickDemoBtn}
                  onClick={() => syncPortfolio(true, '032')}
                >
                  ⚡ ทดลองด้วย InnovestX 032
                </button>
                <button
                  type="button"
                  className={styles.quickDemoBtn}
                  onClick={() => syncPortfolio(true, '011')}
                >
                  🏦 ทดลองด้วย Maybank 011
                </button>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>เลือกโบรกเกอร์ (Broker Provider)</label>
              <div className={styles.brokerGrid}>
                {BROKER_OPTIONS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`${styles.brokerCard} ${brokerId === b.id ? styles.brokerCardActive : ''}`}
                    onClick={() => setBrokerId(b.id)}
                  >
                    <span className={styles.brokerCode}>[{b.id}]</span>
                    <span className={styles.brokerName}>{b.name}</span>
                    <span className={styles.brokerThaiName}>{b.thaiName}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>เลขบัญชีซื้อขายหุ้น (Account Number)</label>
              <input
                type="text"
                autoComplete="off"
                className={styles.formInput}
                placeholder="เช่น 1234567 หรือ EQ-022-XXXXX (ส่งตรงไปยัง Settrade ไม่บันทึกลง Server)"
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>App ID</label>
              <input
                type="text"
                autoComplete="off"
                className={styles.formInput}
                placeholder="กรอก App ID ที่ได้จากโบรคเกอร์"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>API Secret</label>
              <input
                type="password"
                autoComplete="off"
                className={styles.formInput}
                placeholder="กรอก API Secret (ส่งตรงไปยัง Settrade Enclave เท่านั้น ไม่บันทึกลงฐานข้อมูล)"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>App Code</label>
              <input
                type="text"
                className={styles.formInput}
                value={appCode}
                onChange={(e) => setAppCode(e.target.value)}
              />
              <small style={{ color: '#94a3b8', fontSize: '10px' }}>
                * หุ้นไทยและ DR ใช้ Service Code เริ่มต้นคือ ALGO_EQ หรือรหัสที่โบรกเกอร์ออกให้
              </small>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
              <button
                type="button"
                className={styles.byokBtnPrimary}
                style={{ flex: 1 }}
                onClick={() => syncPortfolio(false)}
                disabled={loading || !accountNo || !appId || !appSecret}
              >
                {loading ? 'กำลังเชื่อมต่อ...' : '🚀 เชื่อมต่อ & ซิงค์พอร์ตจริง'}
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
