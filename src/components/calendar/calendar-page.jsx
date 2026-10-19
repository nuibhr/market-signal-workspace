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
import '../../app/landing.css';
import '../../app/market-pages.css';

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
            <Link href="/#pro-analysis-suite" className="ng-back-link" title="กลับสู่หน้ารวมเครื่องมือสถาบัน">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <span className="ng-page-badge">ECONOMIC INTELLIGENCE</span>
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
      </header>

      {/* Pro Suite Quick Switcher Bar */}
      <ProToolsNav current="calendar" />

      <main className="ng-market-content">
        {/* Top Intelligence Banner */}
        <div className="ng-cal-banner">
          <div className="ng-cal-banner-left">
            <div className="ng-cal-icon-wrap">
              <Flame size={24} className="ng-text-danger" />
            </div>
            <div>
              <h3>เตรียมพร้อมรับมือเหตุการณ์ข่าวสำคัญ (Macro Volatility)</h3>
              <p>
                ตัวเลขเศรษฐกิจที่มีระดับผลกระทบสูง (High Impact) มักทำให้ Spread กว้างขึ้นและเกิดความผันผวนรวดเร็ว
                ระบบ AI ช่วยสรุปทิศทางและแนวทางปฏิบัติก่อนและหลังการประกาศตัวเลข
              </p>
            </div>
          </div>
          <div className="ng-cal-banner-right">
            <span className="ng-cal-stat">
              <strong>{events.length}</strong> เหตุการณ์ที่ตรวจพบ
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
                        <span className="ng-affected-label">สินทรัพย์ที่ได้รับผลกระทบ:</span>
                        <div className="ng-affected-tags">
                          {evt.affectedLabels.map((tag, idx) => (
                            <span key={idx} className="ng-affected-tag">
                              {tag}
                            </span>
                          ))}
                        </div>
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
