'use client';
import styles from './us-workspace-nav.module.css';

export const US_VIEWS = [
  { id: 'focus', hash: '#section-focus', label: '🎯 Stage 2 Picks' },
  { id: 'rotation', hash: '#section-rotation', label: '🌐 ETF Rotation' },
  { id: 'fx', hash: '#section-fx', label: '💵 USD/THB Hedge' },
  { id: 'sizing', hash: '#section-sizing', label: '📐 Dime! & 2R Lab' },
  { id: 'screener', hash: '#section-screener', label: '📊 S&P 500' },
  { id: 'chart', hash: '#chart-panel', label: '📈 Interactive Chart' },
];

export default function UsWorkspaceNav({ activeTab = 'focus', symbol, onTabChange, onScrollToChart }) {
  return (
    <section id="us-workspace-navigation" className={styles.toolbar} aria-label="พื้นที่ทำงานหุ้นสหรัฐฯ และ Thematic ETFs">
      <div className={styles.heading}>
        <div className={styles.titleGroup}>
          <h1>
            <span>🇺🇸 หุ้นสหรัฐฯ &amp; Global ETFs</span>
            <span className={styles.scopeBadge}>S&amp;P 500 + NASDAQ 100</span>
          </h1>
          <div className={styles.headerMetricsRow}>
            <span className={styles.headerMetricPill}>48 Stage 2 Leaders</span>
            <span className={styles.headerMetricPill}>312 Filtered Out</span>
            <span className={styles.headerMetricPill}>Risk ≤ 8%</span>
            <span className={styles.headerMetricPill}>Dime! 0.0001</span>
          </div>
        </div>
        <span className={styles.symbol}>
          <span className={styles.liveDot} />
          <span>วิเคราะห์</span>
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
