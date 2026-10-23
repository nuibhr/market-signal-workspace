import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTelegramEaSignalMessage,
  formatTelegramAdminAnnouncement,
} from '../../notifications/broadcaster.mjs';

test('Admin Telegram VIP signal formatters cover all 4 stages', () => {
  const baseSignal = {
    symbol: 'XAUUSD',
    side: 'BUY',
    strategyName: 'Gold London/NY Trend Pullback',
    entry: 2724.50,
    stopLoss: 2712.00,
    lockBuffer: 2728.50,
    tp1: 2742.00,
    tp2: 2758.00,
    recommendedLot: '0.04 Lot',
  };

  const stages = ['ENTRY', 'LOCK_PROFIT', 'TP1', 'TP2'];
  for (const stage of stages) {
    const formatted = formatTelegramEaSignalMessage({ ...baseSignal, stage });
    assert.ok(formatted.includes('PRO COPY EA STABLE SIGNAL'));
    assert.ok(formatted.includes('#XAUUSD'));
    assert.ok(formatted.includes('2,724.5'));
    assert.ok(formatted.includes('2,712'));
    assert.ok(formatted.includes('0.04 Lot'));
  }
});

test('Admin Telegram VIP announcements render title, body, and VIP portal link', () => {
  const announcement = formatTelegramAdminAnnouncement({
    title: '⚠️ แจ้งเตือนข่าวกล่องแดงสำคัญ (Red News Blackout)',
    body: 'งดเปิดไม้ใหม่ทุกกรณีในช่วง 19:00 - 20:30 น. และขยับ SL ล็อคกำไรไม้เดิม',
    author: 'ทีมงาน Nugaom AI VIP',
    appOrigin: 'https://nugaom.ai',
  });

  assert.ok(announcement.includes('ประกาศสำคัญจากทีมงาน VIP'));
  assert.ok(announcement.includes('Red News Blackout'));
  assert.ok(announcement.includes('ทีมงาน Nugaom AI VIP'));
  assert.ok(announcement.includes('https://nugaom.ai/account'));
});
