'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BellRing,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Filter,
  Flame,
  Globe,
  Info,
  Radio,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { MACRO_EVENTS, filterMacroEvents } from '../../calendar/events.mjs';
import MobileDock from '../mobile-dock.jsx';
import SoundMonitorPill from '../monitor/sound-monitor-pill.jsx';
import ProToolsNav from '../pro-tools-nav.jsx';
import MarketNavigation from '../market-navigation.jsx';
import '../../app/landing.css';
import '../../app/market-pages.css';

function getMarketLinkForTag(tag) {
  const t = String(tag).toLowerCase();
  if (t.includes('set') || t.includes('บาท') || t.includes('thb') || t.includes('หุ้นไทย')) return '/thai';
  if (t.includes('tfex') || t.includes('s50')) return '/tfex';
  if (t.includes('s&p') || t.includes('nasdaq') || t.includes('us') || t.includes('ดอลลาร์') || t.includes('หุ้นสหรัฐ')) return '/us';
  if (t.includes('ทอง') || t.includes('xau') || t.includes('forex') || t.includes('eur')) return '/forex';
  return '/thai';
}

export default function CalendarPage() {
  const [impactFilter, setImpactFilter] = useState('all');
  const [marketFilter, setMarketFilter] = useState('all');
  const [expandedId, setExpandedId] = useState('fed-fomc-rate');

  const events = useMemo(() => {
    return filterMacroEvents({ impact: impactFilter, market: marketFilter });
  }, [impactFilter, marketFilter]);

  return (
    <div className="ng-market-page">
      <header className="ng-market-header">
        <div className="ng-market-header-inner">
          <div className="ng-brand-area">
            <Link href="/thai" className="ng-back-link" title="กลับสู่กระดานเทรดหลัก">
              <ArrowLeft size={18} />
              <span className="ng-back-text">← กลับหน้ากระดาน</span>
            </Link>
            <div>
              <span className="ng-page-badge">PRO ANALYSIS SUITE · ECONOMIC INTELLIGENCE</span>
              <h1 className="ng-page-title">ปฏิทินเศรษฐกิจ &amp; ผลกระทบรายตลาด</h1>
            </div>
          </div>
          <div className="ng-header-right">
            <SoundMonitorPill />
            <Link href="/risk" className="ng-account-pill">
              เครื่องคำนวณความเสี่ยง
            </Link>
          </div>
        </div>

        {/* Universal Top Navigation across all markets and tools */}
        <div className="ng-header-nav-strip" style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
          <MarketNavigation current="calendar" />
        </div>
      </header>

      {/* Pro Suite Quick Switcher Bar */}
      <ProToolsNav current="calendar" />

      <main className="ng-market-content">
        {/* Quick Market Gateway */}
        <div
          className="ng-market-bridge-card"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 18px',
            marginBottom: '16px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
            border: '1px solid rgba(217, 119, 6, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                padding: '4px 8px',
                borderRadius: '6px',
                background: '#d97706',
                color: '#ffffff',
              }}
            >
              กระดานเทรดที่รับข่าว
            </span>
            <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
              คลิกสลับไปดูกระดานและสัญญาณตามตลาดที่สนใจ:
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Link
              href="/forex"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#c084fc',
                fontSize: '11px',
                fontWeight: '700',
                textDecoration: 'none',
                border: '1px solid rgba(168, 85, 247, 0.3)',
              }}
            >
              🌍 Forex &amp; ทองคำ
            </Link>
            <Link
              href="/thai"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                fontSize: '11px',
                fontWeight: '700',
                textDecoration: 'none',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              🇹🇭 หุ้นไทย (SET)
            </Link>
            <Link
              href="/tfex"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(234, 88, 12, 0.15)',
                color: '#fb923c',
                fontSize: '11px',
                fontWeight: '700',
                textDecoration: 'none',
                border: '1px solid rgba(234, 88, 12, 0.3)',
              }}
            >
              ⚡ TFEX S50
            </Link>
            <Link
              href="/us"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                fontSize: '11px',
                fontWeight: '700',
                textDecoration: 'none',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              🇺🇸 หุ้นสหรัฐฯ
            </Link>
          </div>
        </div>
        {/* Top Intelligence Banner */}
        <div className="ng-cal-banner">
          <div className="ng-cal-banner-left">
            <div className="ng-cal-icon-wrap">
              <Flame size={24} className="ng-text-danger" />
            </div>
            <div>
              <h3>รอการเชื่อมแหล่งข้อมูลปฏิทินที่ยืนยันแล้ว</h3>
              <p>
                ตัวเลขเศรษฐกิจที่มีระดับผลกระทบสูง (High Impact) มักทำให้ Spread กว้างขึ้นและเกิดความผันผวนรวดเร็ว
                ยังไม่แสดงวันประกาศ ตัวเลขคาดการณ์ หรือบทวิเคราะห์ที่ไม่มีที่มาจากแหล่งข้อมูล
              </p>
            </div>
          </div>
          <div className="ng-cal-banner-right">
            <span className="ng-cal-stat">
              <strong>{events.length}</strong> เหตุการณ์จากแหล่งข้อมูล
            </span>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="ng-cal-filters-bar">
          <div className="ng-filter-section">
            <span className="ng-filter-label"><Flame size={14} /> ระดับผลกระทบ:</span>
            <div className="ng-filter-pills">
              {[
                { id: 'all', label: 'ทั้งหมด' },
                { id: 'high', label: '🔥 สำคัญสูงสุด (High)' },
                { id: 'medium', label: '⚡ ปานกลาง (Medium)' },
                { id: 'low', label: 'ℹ️ ทั่วไป (Low)' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ng-filter-btn ${impactFilter === item.id ? 'is-active' : ''}`}
                  onClick={() => setImpactFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ng-filter-section">
            <span className="ng-filter-label"><Globe size={14} /> ตลาดที่กระทบ:</span>
            <div className="ng-filter-pills">
              {[
                { id: 'all', label: 'ทุกตลาด' },
                { id: 'thai', label: 'หุ้นไทย' },
                { id: 'tfex', label: 'TFEX' },
                { id: 'us', label: 'สหรัฐฯ' },
                { id: 'gold', label: 'ทองคำ' },
                { id: 'forex', label: 'Forex' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ng-filter-btn ${marketFilter === item.id ? 'is-active' : ''}`}
                  onClick={() => setMarketFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Events List */}
        <div className="ng-cal-list">
          {events.length === 0 ? (
            <div className="ng-empty-state">
              <CalendarIcon size={36} className="ng-text-muted" />
              <h3>ไม่พบเหตุการณ์ตามเงื่อนไขที่เลือก</h3>
              <p>ลองเปลี่ยนตัวกรองระดับผลกระทบหรือตลาดเพื่อดูรายการข่าวอื่น</p>
            </div>
          ) : (
            events.map((evt) => {
              const isExpanded = expandedId === evt.id;
              const isHigh = evt.impact === 'high';
              const isMed = evt.impact === 'medium';

              return (
                <article
                  key={evt.id}
                  className={`ng-cal-card ${isHigh ? 'is-high-impact' : ''}`}
                >
                  <div
                    className="ng-cal-card-summary"
                    onClick={() => setExpandedId(isExpanded ? null : evt.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="ng-cal-meta-col">
                      <span className="ng-country-flag">{evt.flag}</span>
                      <div>
                        <div className="ng-event-datetime">
                          <CalendarIcon size={13} />
                          <span>{evt.date}</span>
                          <Clock size={13} style={{ marginLeft: 6 }} />
                          <span>{evt.time}</span>
                        </div>
                        <h2 className="ng-event-title">{evt.title}</h2>
                      </div>
                    </div>

                    <div className="ng-cal-numbers-col">
                      <div className="ng-num-item">
                        <small>คาดการณ์ (Forecast)</small>
                        <strong>{evt.forecast}</strong>
                      </div>
                      <div className="ng-num-item">
                        <small>ครั้งก่อน (Previous)</small>
                        <span>{evt.previous}</span>
                      </div>
                      <div className="ng-num-item">
                        <small>ผลจริง (Actual)</small>
                        <span className="ng-actual-tag">รอประกาศ</span>
                      </div>
                    </div>

                    <div className="ng-cal-badge-col">
                      <span
                        className={`ng-impact-pill ${
                          isHigh ? 'impact-high' : isMed ? 'impact-medium' : 'impact-low'
                        }`}
                      >
                        {isHigh ? '🔥 HIGH' : isMed ? '⚡ MED' : 'ℹ️ LOW'}
                      </span>
                    </div>
                  </div>

                  {/* Expandable Deep Analysis Drawer */}
                  {isExpanded && (
                    <div className="ng-cal-card-details">
                      <div className="ng-detail-grid">
                        <div className="ng-detail-box ng-ai-box">
                          <div className="ng-detail-title">
                            <Sparkles size={16} className="ng-text-accent" />
                            <span>AI Market Impact Analysis:</span>
                          </div>
                          <p>{evt.aiAnalysis}</p>
                        </div>

                        <div className="ng-detail-box ng-action-box">
                          <div className="ng-detail-title">
                            <ShieldAlert size={16} className="ng-text-danger" />
                            <span>Actionable Trading Caution (ข้อควรระวัง):</span>
                          </div>
                          <p>{evt.actionPlan}</p>
                        </div>
                      </div>

                      <div className="ng-affected-strip">
                        <span className="ng-affected-label">สินทรัพย์และกระดานที่ได้รับผลกระทบ:</span>
                        <div className="ng-affected-tags">
                          {evt.affectedLabels.map((tag, idx) => (
                            <Link
                              key={idx}
                              href={getMarketLinkForTag(tag)}
                              className="ng-affected-tag"
                              style={{ textDecoration: 'none', cursor: 'pointer', transition: 'all 0.15s ease' }}
                              title={`เปิดดูกระดานที่เกี่ยวข้องกับ ${tag}`}
                            >
                              <span>{tag}</span>
                              <span style={{ fontSize: '10px', opacity: 0.7 }}>↗</span>
                            </Link>
                          ))}
                        </div>
                      </div>

                      {/* Action Links into Trading Terminal */}
                      <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Link
                          href={evt.market === 'thai' ? '/thai' : evt.market === 'tfex' ? '/tfex' : evt.market === 'us' ? '/us' : '/forex'}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 14px',
                            borderRadius: '8px',
                            background: 'rgba(217, 119, 6, 0.18)',
                            color: '#fbbf24',
                            border: '1px solid rgba(217, 119, 6, 0.4)',
                            fontSize: '12px',
                            fontWeight: '700',
                            textDecoration: 'none',
                          }}
                        >
                          <span>🚀 เปิดดูกระดาน {evt.market === 'thai' ? 'หุ้นไทย' : evt.market === 'tfex' ? 'TFEX S50' : evt.market === 'us' ? 'หุ้นสหรัฐฯ' : 'Forex & ทองคำ'} →</span>
                        </Link>
                        <Link
                          href="/risk"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 14px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: '#e2e8f0',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            fontSize: '12px',
                            fontWeight: '600',
                            textDecoration: 'none',
                          }}
                        >
                          <span>🛡️ คำนวณความเสี่ยง 2R รับมือความผันผวน</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </main>

      <MobileDock />
    </div>
  );
}
