'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShieldCheck, KeyRound, ArrowRight, Lock, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import styles from './admin-login-card.module.css';

const BROKER_TABS = [
  { id: 'super', label: '👑 ผู้ดูแลระบบ (Super Admin)', brokerId: null, hint: 'เข้าดูได้ทุกส่วน ควบคุมระบบทั้งหมด' },
  { id: '003', label: '🥧 บล.พาย (Pi 003)', brokerId: '003', hint: 'ดูเฉพาะรายชื่อลูกค้า บล.พาย (003)' },
  { id: '022', label: '🌟 บล.ทรีนีตี้ (Trinity 022)', brokerId: '022', hint: 'ดูเฉพาะรายชื่อลูกค้า บล.ทรีนีตี้ (022)' },
  { id: '050', label: '⚡ บล.เอเอสแอล (ASL 050)', brokerId: '050', hint: 'ดูเฉพาะรายชื่อลูกค้า บล.เอเอสแอล (050)' },
];

export default function AdminLoginCard() {
  const [selectedTab, setSelectedTab] = useState('super');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const activeTab = BROKER_TABS.find((t) => t.id === selectedTab) || BROKER_TABS[0];

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!key.trim() || busy) return;
    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/auth/admin-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: key.trim(),
          brokerId: activeTab.brokerId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'รหัสเข้าใช้งานไม่ถูกต้อง');
      }

      // Success: reload to let server re-verify session
      window.location.href = data.redirect || '/admin';
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.brandHeader}>
          <div className={styles.logoWrap}>
            <Image src="/nugaom-mascot.png" alt="Nugaom AI" width={48} height={48} priority />
          </div>
          <h1>Nugaom AI Pick</h1>
          <span className={styles.badge}>
            <ShieldCheck size={14} /> ADMIN &amp; BROKER STAFF PORTAL
          </span>
          <p className={styles.subtitle}>
            ศูนย์จัดการหลังบ้านและระบบมอนิเตอร์ลูกค้าเปิดพอร์ต 3 โบรกเกอร์ (Pi, Trinity, ASL)
          </p>
        </div>

        {/* Role Tabs */}
        <div className={styles.tabList} role="tablist">
          {BROKER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selectedTab === tab.id}
              className={`${styles.tabBtn} ${selectedTab === tab.id ? styles.tabBtnActive : ''}`}
              onClick={() => {
                setSelectedTab(tab.id);
                setError('');
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.scopeNotice}>
          <span>ขอบเขตสิทธิ์:</span> {activeTab.hint}
        </div>

        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="admin-key">
              <KeyRound size={15} /> รหัสผ่านเข้าใช้งาน ({activeTab.label.split(' ')[1] || 'ผู้ดูแล'}):
            </label>
            <div className={styles.passwordField}>
              <input
                id="admin-key"
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="กรอกรหัสผ่านเข้าใช้งาน..."
                required
                autoComplete="current-password"
                disabled={busy}
              />
              <button
                type="button"
                className={styles.toggleVisibility}
                onClick={() => setShowKey((v) => !v)}
                tabIndex={-1}
                aria-label={showKey ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className={styles.errorBox} role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className={styles.submitBtn} disabled={busy || !key.trim()}>
            {busy ? 'กำลังตรวจสอบสิทธิ์…' : 'เข้าสู่ระบบหลังบ้าน'}
            {!busy && <ArrowRight size={16} />}
          </button>
        </form>

        <div className={styles.footerLinks}>
          <Link href="/" className={styles.backHome}>
            <ArrowLeft size={14} /> กลับหน้าหลัก Nugaom
          </Link>
          <span className={styles.securityNote}>
            <Lock size={12} /> เข้ารหัสความปลอดภัย SSL/TLS ระดับสูง
          </span>
        </div>
      </div>
    </div>
  );
}

