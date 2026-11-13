'use client';
import { useState } from 'react';
import { readApiJson } from '../security/api-response.mjs';

const DEFAULT_BTN_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
  color: '#fff',
  padding: '8px 14px',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
};

export default function TelegramVipJoinButton({
  label = '✈️ รับการบ้านหุ้นเข้า Telegram VIP ↗',
  className = '',
  style = null,
}) {
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [notice, setNotice] = useState(null);

  async function handleJoinVip() {
    if (inviteLink) {
      window.open(inviteLink, '_blank', 'noopener,noreferrer');
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch('/api/alerts/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-invite' }),
      });
      const data = await readApiJson(response);
      if (response.ok && data?.ok && data.inviteLink) {
        setInviteLink(data.inviteLink);
        const opened = window.open(data.inviteLink, '_blank', 'noopener,noreferrer');
        if (!opened) {
          setNotice({ type: 'ready', text: 'สร้างลิงก์เข้ากลุ่ม VIP แล้ว กดปุ่มเปิดกลุ่มด้านล่างได้เลย' });
        }
        return;
      }
      if (response.status === 401 || data?.error === 'SIGN_IN_REQUIRED') {
        setNotice({ type: 'signin', text: 'กรุณาเข้าสู่ระบบ LINE ก่อนเพื่อรับลิงก์เข้ากลุ่ม VIP', href: '/account', cta: 'เข้าสู่ระบบ ↗' });
        return;
      }
      if (response.status === 403 || data?.error === 'MEMBERSHIP_REQUIRED') {
        setNotice({ type: 'upgrade', text: 'สิทธิ์เฉพาะสมาชิก VIP / Trial หรือเปิดพอร์ตพาร์ทเนอร์', href: '/open-account', cta: 'เปิดพอร์ต / รับสิทธิ์ VIP ↗' });
        return;
      }
      setNotice({ type: 'error', text: 'ยังไม่สามารถสร้างลิงก์เข้ากลุ่ม VIP ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' });
    } catch {
      setNotice({ type: 'error', text: 'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
      <button
        type="button"
        onClick={handleJoinVip}
        disabled={loading}
        className={className || undefined}
        style={className ? (style || undefined) : { ...DEFAULT_BTN_STYLE, ...(style || {}) }}
      >
        {loading ? 'กำลังสร้างลิงก์เข้ากลุ่ม VIP…' : label}
      </button>
      {inviteLink && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', color: '#38bdf8' }}>
          <a href={inviteLink} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'underline' }}>
            🚀 เปิดกลุ่ม Telegram VIP (ลิงก์ใช้ได้ 1 ครั้ง) ↗
          </a>
        </div>
      )}
      {notice && (
        <div style={{ fontSize: '12px', color: notice.type === 'error' ? '#f87171' : '#fbbf24', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{notice.text}</span>
          {notice.href && (
            <a href={notice.href} style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'underline' }}>
              {notice.cta}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
