'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  Compass,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

export const PRO_TOOLS_CONFIG = [
  {
    id: 'risk',
    href: '/risk',
    label: 'คำนวณไม้ & ความเสี่ยง',
    sublabel: 'คุมพอร์ตด้วยความเสี่ยง 2R ไม่ให้พอร์ตแตก',
    icon: BarChart3,
    badge: 'คุมความเสี่ยง 2R',
    color: '#0d9488', // Teal
  },
  {
    id: 'thai',
    href: '/thai',
    label: 'สแกนหุ้นขาขึ้นรอบใหญ่',
    sublabel: 'Minervini Stage 2 หุ้นผู้นำตลาด',
    icon: Compass,
    badge: 'Stage 2',
    color: '#059669', // Emerald
  },
  {
    id: 'us',
    href: '/us',
    label: 'สแกนหุ้นสหรัฐฯ S&P 500',
    sublabel: 'คัดหุ้น Growth & Thematic ETFs ทรงพลัง',
    icon: TrendingUp,
    badge: 'US 500',
    color: '#38bdf8', // Cyan
  },
  {
    id: 'daytrade',
    href: '/daytrade?market=forex',
    label: 'เดย์เทรด 15m Desk',
    sublabel: 'จับจังหวะสั้น TFEX & สัญญา CFD',
    icon: TrendingUp,
    badge: '15m Desk',
    color: '#0284c7', // Sky Blue
  },
  {
    id: 'dr-strategy',
    href: '/dr-strategy',
    label: 'เรดาร์แจ้งเตือนเสียง DR',
    sublabel: 'ระบบเฝ้าดูและแจ้งเตือนเสียงภาษาไทย',
    icon: Sparkles,
    badge: 'Voice Alert',
    color: '#f59e0b', // Amber
  },
  {
    id: 'calendar',
    href: '/calendar',
    label: 'ปฏิทินเศรษฐกิจ & ข่าว',
    sublabel: 'เช็กวันประกาศตัวเลขสำคัญก่อนเข้าเทรด',
    icon: Calendar,
    badge: 'ข่าวสำคัญ',
    color: '#d97706', // Amber
  },
];

export default function ProToolsNav({ current = 'risk' }) {
  return (
    <div className="ng-pro-suite-nav">
      <div className="ng-pro-suite-inner">
        <div className="ng-pro-suite-left">
          <Link
            href="/thai"
            className="ng-suite-back-pill"
            title="กลับสู่กระดานเทรดหลัก (Trading Terminal)"
          >
            <ArrowLeft size={14} />
            <span>← กลับกระดานเทรด</span>
          </Link>
          <div className="ng-suite-title-group">
            <span className="ng-suite-badge">
              <Sparkles size={12} /> PRO TRADING TOOLS
            </span>
            <span className="ng-suite-divider">/</span>
            <span className="ng-suite-caption">เครื่องมือช่วยเทรดมือโปร</span>
          </div>
        </div>

        {/* Navigation Pills */}
        <nav className="ng-pro-suite-pills" aria-label="สลับเครื่องมือช่วยเทรดมือโปร">
          {PRO_TOOLS_CONFIG.map((tool) => {
            const Icon = tool.icon;
            const isActive = current === tool.id;
            return (
              <Link
                key={tool.id}
                href={tool.href}
                className={`ng-pro-pill ${isActive ? 'is-active' : ''}`}
                style={{ '--pill-accent': tool.color }}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="ng-pill-icon">
                  <Icon size={14} />
                </span>
                <span className="ng-pill-text">{tool.label}</span>
                <span className="ng-pill-badge">{tool.badge}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
