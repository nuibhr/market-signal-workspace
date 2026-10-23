'use client';
import styles from '../thai/thai-workspace.module.css';

export const US_VIEWS = [
  { id: 'focus', hash: '#section-focus', label: '🎯 Stage 2 Focus Picks', note: 'ผู้นำ Minervini เกรด A+' },
  { id: 'rotation', hash: '#section-rotation', label: '🌐 Thematic ETF Rotation', note: 'Fund Flow สถาบันวอลล์สตรีท' },
  { id: 'fx', hash: '#section-fx', label: '💵 USD/THB Hedge & Risk', note: 'จำลองผลกระทบค่าเงินบาท' },
  { id: 'sizing', hash: '#section-sizing', label: '📐 Dime! & 2R Sizing Desk', note: 'คำนวณเศษหุ้น & งบเงินบาท' },
  { id: 'screener', hash: '#section-screener', label: '📊 S&P 500 Screener', note: 'สแกนคัดทิ้งหุ้นขาลง 500 ตัว' },
  { id: 'chart', hash: '#chart-panel', label: '📈 Interactive Chart', note: 'ดูกราฟเทคนิค & แท่งราคา' },
];

export default function UsWorkspaceNav({ activeTab = 'focus', symbol, onTabChange, onScrollToChart }) {
  return (
    <section id="us-workspace-navigation" className={styles.toolbar} aria-label="พื้นที่ทำงานหุ้นสหรัฐฯ และ Thematic ETFs">
      <div className={styles.heading}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>🇺🇸 หุ้นสหรัฐฯ &amp; Global ETFs</span>
            <small style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              S&amp;P 500 + NASDAQ 100
            </small>
          </h1>
          <p>คัดกรองหุ้นผู้นำ Stage 2, สำรวจเมกะเทรนด์ Thematic ETFs, และคำนวณความเสี่ยงค่าเงิน USD/THB</p>
        </div>
        <span className={styles.symbol}>
          กำลังวิเคราะห์ <b>{symbol}</b>
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
              <b>{v.label}</b>
              <small>{v.note}</small>
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}
