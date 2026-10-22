'use client';
import styles from './thai-workspace.module.css';

export const THAI_VIEWS = [
  { id: 'portfolio', hash: '#section-portfolio', label: '⚡ พอร์ต & API (ALGO_EQ)', note: 'ซิงค์ Trinity 022 / InnovestX' },
  { id: 'stage2', hash: '#section-auto-pick', label: 'Stage 2 Screener', note: 'Trend Template หุ้นขาขึ้น' },
  { id: 'radar', hash: '#section-radar', label: 'Strategy Radar', note: 'เรดาร์สัญญาณ & แผนเฝ้า' },
  { id: 'chart', hash: '#chart-panel', label: 'Interactive Chart', note: 'กราฟเทคนิค & อินดิเคเตอร์' },
  { id: 'results', hash: '#section-results', label: 'Trade Ledger', note: 'ประวัติ & ผลลัพธ์ 100 ไม้' },
];

export function thaiViewForHash(hash) {
  return THAI_VIEWS.find((v) => v.hash === hash)?.id ?? 'stage2';
}

export default function ThaiWorkspaceNav({ view = 'stage2', symbol, onNavigate, onOpenScanner }) {
  return (
    <section id="thai-workspace-navigation" className={styles.toolbar} aria-label="พื้นที่ทำงานหุ้นไทย">
      <div className={styles.heading}>
        <div>
          <h1>หุ้นไทย <small>SET100 + mai</small></h1>
          <p>เลือกเครื่องมือวิเคราะห์ และเปิดกราฟหุ้นที่สนใจ</p>
        </div>
        <span className={styles.symbol}>
          กำลังวิเคราะห์ <b>{symbol}</b>
        </span>
      </div>
      <div className={styles.row}>
        <nav aria-label="เลือกเครื่องมือหุ้นไทย" className={styles.views}>
          {THAI_VIEWS.map((v) => (
            <a
              key={v.id}
              href={v.hash}
              aria-current={view === v.id ? 'location' : undefined}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                onNavigate(v.id);
              }}
            >
              <b>{v.label}</b>
              <small>{v.note}</small>
            </a>
          ))}
        </nav>
        <button type="button" className={styles.scan} onClick={onOpenScanner}>
          สแกนตามสไตล์ (Multi-Strategy) ↗
        </button>
      </div>
    </section>
  );
}

