'use client';

import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { soundPreference, saveSoundPreference } from '../../monitor/preferences.mjs';

export default function SoundMonitorPill() {
  const [enabled, setEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      setEnabled(soundPreference(window.localStorage));
    }
  }, []);

  const toggleSound = () => {
    const next = !enabled;
    setEnabled(next);
    if (typeof window !== 'undefined') {
      saveSoundPreference(window.localStorage, next);
    }
  };

  if (!mounted) {
    return (
      <button
        type="button"
        className="ng-sound-pill"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          color: '#64748b',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
        aria-label="กำลังโหลดตัวควบคุมเสียง"
      >
        <Volume2 size={15} />
        <span>ระบบเสียง</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleSound}
      className={`ng-sound-pill ${enabled ? 'active' : 'muted'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '20px',
        border: `1px solid ${enabled ? '#a7f3d0' : '#e2e8f0'}`,
        background: enabled ? '#ecfdf5' : '#ffffff',
        color: enabled ? '#065f46' : '#64748b',
        fontSize: '0.8rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      aria-pressed={enabled}
      title="เปิด/ปิดเสียงแจ้งเตือนระบบแบบเรียลไทม์"
    >
      {enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
      <span>{enabled ? 'เสียงแจ้งเตือน: เปิด' : 'เสียง: ปิด'}</span>
    </button>
  );
}
