'use client';
import { TrendingUp, Radar, ShieldCheck, CandlestickChart, Award } from 'lucide-react';
import InstrumentLogo from '../monitor/instrument-logo.jsx';
import styles from './thai-workspace.module.css';

const VIEW_ICONS = {
  stage2: TrendingUp,
  radar: Radar,
  portfolio: ShieldCheck,
  chart: CandlestickChart,
  results: Award,
};

export const THAI_VIEWS = [
  { id: 'stage2', hash: '#section-auto-pick', label: 'สแกนหุ้นขาขึ้น (Stage 2)', note: 'คัดหุ้นเด่น & เช็คแนวรับแนวต้าน' },
  { id: 'radar', hash: '#section-radar', label: 'เรดาร์สัญญาณสด (Radar)', note: 'แผนเฝ้ารายวัน & เสียงแจ้งเตือน' },
  { id: 'portfolio', hash: '#section-portfolio', label: 'เปิดพอร์ต / ยืนยันสิทธิ์ VIP', note: 'พาย 003 · ทรีนีตี้ 022 · เอเอสแอล 050' },
  { id: 'chart', hash: '#chart-panel', label: 'กราฟเทคนิค (Chart)', note: 'แท่งเทียน & อินดิเคเตอร์' },
  { id: 'results', hash: '#section-results', label: 'บันทึกผลงาน (Trade Ledger)', note: 'ประวัติ & สถิติชนะ 100 ไม้' },
];

export function thaiViewForHash(hash) {
  return THAI_VIEWS.find((v) => v.hash === hash)?.id ?? 'stage2';
}

export default function ThaiWorkspaceNav({ view = 'stage2', symbol, onNavigate, onOpenScanner }) {
  return (
    <section id="thai-workspace-navigation" className={styles.toolbar} aria-label="พื้นที่ทำงานหุ้นไทย">
      <div className={styles.heading}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/nugaom-mascot.png"
            alt="โลโก้ Nugaom AI"
            width="42"
            height="42"
            style={{ borderRadius: '12px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.35)' }}
          />
          <div>
            <h1>หุ้นไทย <small>SET100 + mai</small></h1>
            <p>เลือกเครื่องมือวิเคราะห์ โพยเช้า 09:30 · บ่าย 13:30 · การบ้านเย็น 17:30 และเปิดกราฟหุ้นที่สนใจ</p>
          </div>
        </div>
        <span className={styles.symbol}>
          {symbol ? <InstrumentLogo asset={{ market: 'thai', symbol }} /> : null}
          <span>กำลังวิเคราะห์ <b>{symbol}</b></span>
        </span>
      </div>
      <div className={styles.row}>
        <nav aria-label="เลือกเครื่องมือหุ้นไทย" className={styles.views}>
          {THAI_VIEWS.map((v) => {
            const Icon = VIEW_ICONS[v.id];
            return (
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
                {Icon && <Icon size={15} style={{ opacity: 0.85, flexShrink: 0 }} />}
                <b>{v.label}</b>
                <small>{v.note}</small>
              </a>
            );
          })}
        </nav>
        <button type="button" className={styles.scan} onClick={onOpenScanner}>
          สแกนตามสไตล์ (Multi-Strategy) ↗
        </button>
      </div>
    </section>
  );
}

