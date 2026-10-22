'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Code2,
  Compass,
  Layers,
  LockKeyhole,
  LogOut,
  Sparkles,
  TrendingUp,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';

export const PRO_TOOLS_CONFIG = [
  {
    id: 'risk',
    href: '/risk',
    label: 'บริหารความเสี่ยง',
    sublabel: 'Dynamic 2R & Sizing',
    icon: BarChart3,
    badge: '2R Risk',
    color: '#0d9488', // Teal
  },
  {
    id: 'calendar',
    href: '/calendar',
    label: 'ปฏิทินเศรษฐกิจ',
    sublabel: 'Macro & Impact',
    icon: Calendar,
    badge: 'Macro',
    color: '#d97706', // Amber
  },
  {
    id: 'developers',
    href: '/developers',
    label: 'SMC Playground',
    sublabel: 'BOS / CHoCH / FVG API',
    icon: Code2,
    badge: 'API / EA',
    color: '#7c3aed', // Purple
  },
  {
    id: 'daytrade',
    href: '/daytrade?market=forex',
    label: 'Daytrade CFD / TFEX',
    sublabel: '15m Momentum / US CFD',
    icon: TrendingUp,
    badge: '15m Desk',
    color: '#0284c7', // Sky Blue
  },
  {
    id: 'thai',
    href: '/thai',
    label: 'Stage 2 Screener',
    sublabel: 'Minervini Trend & RS Leaders',
    icon: Compass,
    badge: 'Stage 2',
    color: '#059669', // Emerald
  },
  {
    id: 'dr-strategy',
    href: '/dr-strategy',
    label: 'Strategy Radar',
    sublabel: 'Camarilla & Trade Ledger',
    icon: Sparkles,
    badge: 'Radar & Audio',
    color: '#f59e0b', // Amber
  },
];

export default function ProToolsNav({ current = 'risk' }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);

  // Fetch session status on mount
  useEffect(() => {
    let active = true;
    fetch('/api/account', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (active && data?.account) {
          setSession(data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    } catch {
      setBusy(false);
    }
  };

  const currentTool = PRO_TOOLS_CONFIG.find((t) => t.id === current) || PRO_TOOLS_CONFIG[0];

  return (
    <>
      {/* 1. Horizontal Sub-Navigation Bar */}
      <div className="ng-pro-suite-nav">
        <div className="ng-pro-suite-inner">
          <div className="ng-pro-suite-left">
            <Link
              href="/#pro-analysis-suite"
              className="ng-suite-back-pill"
              title="กลับสู่หมวดชุดเครื่องมือวิเคราะห์เชิงลึกระดับสถาบันบนหน้าหลัก"
            >
              <ArrowLeft size={14} />
              <span>รวมเครื่องมือสถาบัน</span>
            </Link>
            <div className="ng-suite-title-group">
              <span className="ng-suite-badge">
                <Sparkles size={12} /> PRO ANALYSIS SUITE
              </span>
              <span className="ng-suite-divider">/</span>
              <span className="ng-suite-caption">สลับเครื่องมือได้ทันที</span>
            </div>
          </div>

          {/* Navigation Pills */}
          <nav className="ng-pro-suite-pills" aria-label="สลับเครื่องมือวิเคราะห์ระดับสถาบัน">
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

      {/* 2. Floating Quick Switcher FAB (Always Accessible Anywhere on the Page) */}
      <aside className="ng-floating-pro-dock" aria-label="แถบสลับเครื่องมือด่วน">
        <button
          type="button"
          className={`ng-pro-fab ${drawerOpen ? 'is-open' : ''}`}
          onClick={() => setDrawerOpen(!drawerOpen)}
          aria-expanded={drawerOpen}
          aria-label="เปิดเมนูสลับเครื่องมือวิเคราะห์ด่วน"
        >
          <span className="ng-fab-pulse" />
          <Zap size={16} />
          <span className="ng-fab-text">สลับเครื่องมือสถาบัน</span>
          <span className="ng-fab-count">{PRO_TOOLS_CONFIG.length}</span>
        </button>

        {drawerOpen && (
          <div className="ng-pro-drawer-overlay" onClick={() => setDrawerOpen(false)}>
            <div
              className="ng-pro-drawer-card"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="pro-drawer-title"
            >
              <div className="ng-pro-drawer-header">
                <div>
                  <span className="ng-pro-badge">
                    <Sparkles size={13} /> QUICK SUITE SWITCHER
                  </span>
                  <h3 id="pro-drawer-title">ชุดเครื่องมือวิเคราะห์เชิงลึกระดับสถาบัน</h3>
                  <p>คลิกสลับเครื่องมือได้ทันที ไม่ต้องย้อนกลับหน้าแรก</p>
                </div>
                <button
                  type="button"
                  className="ng-drawer-close"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="ปิดเมนู"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Tools List */}
              <div className="ng-pro-drawer-grid">
                {PRO_TOOLS_CONFIG.map((tool) => {
                  const Icon = tool.icon;
                  const isActive = current === tool.id;
                  return (
                    <Link
                      key={tool.id}
                      href={tool.href}
                      className={`ng-drawer-tool-card ${isActive ? 'is-active' : ''}`}
                      onClick={() => setDrawerOpen(false)}
                    >
                      <div className="ng-drawer-tool-icon" style={{ color: tool.color }}>
                        <Icon size={20} />
                      </div>
                      <div className="ng-drawer-tool-info">
                        <div className="ng-drawer-tool-top">
                          <strong>{tool.label}</strong>
                          <span className="ng-drawer-badge">{tool.badge}</span>
                        </div>
                        <small>{tool.sublabel}</small>
                      </div>
                      {isActive ? (
                        <span className="ng-drawer-active-tag">กำลังเปิดอยู่</span>
                      ) : (
                        <ArrowUpRight size={16} className="ng-drawer-arrow" />
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* User / Trial Status & 1-Click Demo Login in Drawer */}
              <div className="ng-drawer-auth-box">
                {session?.account ? (
                  <div className="ng-drawer-member-row">
                    <div className="ng-drawer-member-info">
                      <UserCheck size={18} className="ng-text-emerald" />
                      <div>
                        <strong>{session.account.displayName}</strong>
                        <small>
                          {session.rights?.label} · พอร์ต {session.account.broker} (••
                          {session.account.portfolioLast4})
                        </small>
                      </div>
                    </div>
                    <div className="ng-drawer-member-actions">
                      <Link href="/account" className="ng-drawer-acc-link" onClick={() => setDrawerOpen(false)}>
                        จัดการสิทธิ
                      </Link>
                      <button
                        type="button"
                        className="ng-drawer-logout-btn"
                        onClick={handleLogout}
                        disabled={busy}
                        title="ออกจากระบบ"
                      >
                        <LogOut size={14} /> ออกจากระบบ
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ng-drawer-demo-banner"><strong>เข้าสู่ระบบสมาชิก</strong><p>เชื่อมบัญชี LINE และแจ้งเลขพอร์ตเพื่อเริ่มใช้สิทธิสมาชิก</p><Link href="/account">เปิดบัญชีสมาชิก ↗</Link></div>
                )}
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
