import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTelegramTradeMessage,
  formatTelegramEaSignalMessage,
  formatTelegramAdminAnnouncement,
  sendTelegramMessage,
  verifyTelegramBot,
  sendLineBroadcast
} from './broadcaster.mjs';

test('formatTelegramEaSignalMessage formats Pro Copy EA signal with lock profit and lot size', () => {
  const eaSignal = {
    symbol: 'XAUUSD',
    side: 'BUY',
    stage: 'LOCK_PROFIT',
    strategyName: 'Gold London/NY Trend Pullback',
    entry: 2724.50,
    stopLoss: 2712.00,
    lockBuffer: 2728.50,
    tp1: 2742.00,
    tp2: 2758.00,
    recommendedLot: '0.04 Lot',
  };

  const message = formatTelegramEaSignalMessage(eaSignal, { appOrigin: 'https://nugaom.ai' });
  assert.ok(message.includes('#XAUUSD'));
  assert.ok(message.includes('LOCK PROFIT'));
  assert.ok(message.includes('2,724.5'));
  assert.ok(message.includes('2,728.5'));
  assert.ok(message.includes('0.04 Lot'));
  assert.ok(message.includes('Risk-Free 100%'));
  assert.ok(message.includes('https://nugaom.ai/forex'));
});

test('formatTelegramAdminAnnouncement formats executive announcement with author and link', () => {
  const msg = formatTelegramAdminAnnouncement({
    title: 'ประกาศผลการสแกนปิดสัปดาห์',
    body: 'พอร์ต EA สัปดาห์นี้ Win Rate 72% ปิดกำไรสุทธิ +18.4R ขอบคุณสมาชิก VIP ทุกท่านครับ',
    author: 'แอดมินบอย',
    appOrigin: 'https://nugaom.ai'
  });

  assert.ok(msg.includes('ประกาศสำคัญจากทีมงาน VIP'));
  assert.ok(msg.includes('ประกาศผลการสแกนปิดสัปดาห์'));
  assert.ok(msg.includes('แอดมินบอย'));
  assert.ok(msg.includes('Win Rate 72%'));
  assert.ok(msg.includes('https://nugaom.ai/account'));
});

test('formatTelegramTradeMessage generates correct HTML formatting with Entry, SL, TP 2R', () => {
  const signal = {
    symbol: 'XAUUSD',
    side: 'LONG',
    signalTime: 1729684800,
    atr: 7.5,
    plan: {
      entry: 2720.5,
      stop: 2705.0,
      target: 2751.5,
      risk: 15.5
    }
  };

  const message = formatTelegramTradeMessage(signal, { appOrigin: 'https://example.com' });
  assert.ok(message.includes('#XAUUSD'));
  assert.ok(message.includes('LONG'));
  assert.ok(message.includes('2,720.5'));
  assert.ok(message.includes('2,705'));
  assert.ok(message.includes('2,751.5'));
  assert.ok(message.includes('1 : 2.0'));
  assert.ok(message.includes('https://example.com/forex?symbol=XAUUSD'));
});

test('sendTelegramMessage throws on missing credentials', async () => {
  await assert.rejects(sendTelegramMessage({ token: '', chatId: '123' }), { code: 'TELEGRAM_CREDENTIALS_REQUIRED' });
  await assert.rejects(sendTelegramMessage({ token: 'bot123', chatId: '' }), { code: 'TELEGRAM_CREDENTIALS_REQUIRED' });
});

test('sendTelegramMessage posts correct payload to Telegram API', async () => {
  let calledUrl = '';
  let calledBody = null;
  const mockFetcher = async (url, options) => {
    calledUrl = url;
    calledBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 999 } })
    };
  };

  const result = await sendTelegramMessage({
    token: '123456:ABC-DEF',
    chatId: '-100123456789',
    text: '<b>Test Alert</b>',
    fetcher: mockFetcher
  });

  assert.equal(result.success, true);
  assert.equal(result.messageId, 999);
  assert.equal(calledUrl, 'https://api.telegram.org/bot123456:ABC-DEF/sendMessage');
  assert.equal(calledBody.chat_id, '-100123456789');
  assert.equal(calledBody.text, '<b>Test Alert</b>');
  assert.equal(calledBody.parse_mode, 'HTML');
});

test('verifyTelegramBot verifies bot identity with getMe', async () => {
  const mockFetcher = async (url) => {
    if (url.includes('good_token')) {
      return {
        ok: true,
        json: async () => ({ ok: true, result: { first_name: 'NugaomBot', username: 'nugaom_bot' } })
      };
    }
    return {
      ok: false,
      json: async () => ({ ok: false, description: 'Unauthorized' })
    };
  };

  const valid = await verifyTelegramBot({ token: 'good_token', fetcher: mockFetcher });
  assert.equal(valid.valid, true);
  assert.equal(valid.botName, 'NugaomBot');

  const invalid = await verifyTelegramBot({ token: 'bad_token', fetcher: mockFetcher });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.error, 'Unauthorized');
});

test('sendLineBroadcast sends broadcast message to LINE API', async () => {
  let calledHeaders = {};
  const mockFetcher = async (url, options) => {
    calledHeaders = options.headers;
    return {
      ok: true,
      json: async () => ({})
    };
  };

  const res = await sendLineBroadcast({
    channelAccessToken: 'line_token_123',
    text: 'Hello LINE',
    fetcher: mockFetcher
  });

  assert.equal(res.success, true);
  assert.equal(calledHeaders.Authorization, 'Bearer line_token_123');
});
