'use client';
import InstrumentLogo from '../monitor/instrument-logo.jsx';
import styles from './us-workspace-nav.module.css';

export const US_VIEWS = [
  { id: 'focus', hash: '#section-focus', label: '🎯 Stage 2 Picks' },
  { id: 'screener', hash: '#section-screener', label: '📊 S&P 500 Scanner' },
  { id: 'rotation', hash: '#section-rotation', label: '🌐 ETF Rotation' },
  { id: 'sizing', hash: '#section-sizing', label: '📐 Dime! & 2R Lab' },
  { id: 'fx', hash: '#section-fx', label: '💵 USD/THB Hedge' },
  { id: 'chart', hash: '#chart-panel', label: '📈 Interactive Chart' },
];

export default function UsWorkspaceNav({ activeTab = 'focus', symbol, onTabChange, onScrollToChart }) {
  return (
    <section id="us-workspace-navigation" className={styles.toolbar} aria-label="พื้นที่ทำงานหุ้นสหรัฐฯ และ Thematic ETFs">
      <div className={styles.heading}>
        <div className={styles.titleGroup} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/nugaom-mascot.png"
            alt="โลโก้ Nugaom AI"
            width="42"
            height="42"
            style={{ borderRadius: '12px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.35)' }}
          />
          <h1>
            <span>🇺🇸 หุ้นสหรัฐฯ &amp; Global ETFs</span>
            <span className={styles.scopeBadge}>S&amp;P 500 · NASDAQ 100</span>
          </h1>
        </div>
        <span className={styles.symbol}>
          {symbol ? <InstrumentLogo asset={{ market: 'us', symbol }} /> : null}
          <span className={styles.liveDot} />
          <span>วิเคราะห์:</span>
          <b>{symbol}</b>
        </span>
      </div>
      <div className={styles.row}>
        <nav aria-label="เลือกเครื่องมือหุ้นสหรัฐฯ" className={styles.views}>
          {US_VIEWS.map((v) => (
            <a
              key={v.id}
              href={v.hash}
              aria-current={activeTab === v.id ? 'location' : undefined}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                if (v.id === 'chart') {
                  if (onTabChange) onTabChange('chart');
                  if (onScrollToChart) onScrollToChart();
                } else {
                  if (onTabChange) onTabChange(v.id);
                  const el = document.getElementById('us-stage2-command-desk') || document.querySelector('[class*="us-stage2-desk_desk"]');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              <span>{v.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}
