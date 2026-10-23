import {
  formatTelegramTradeMessage,
  formatTelegramEaSignalMessage,
  formatTelegramAdminAnnouncement,
  sendTelegramMessage,
  verifyTelegramBot
} from '../../../../notifications/broadcaster.mjs';

const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

export async function GET(request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const configured = Boolean(token && chatId);

  return Response.json({
    status: 'ok',
    configured,
    hasToken: Boolean(token),
    hasChatId: Boolean(chatId),
    chatIdMasked: chatId ? `${chatId.slice(0, 4)}***` : null,
    provider: 'telegram',
    cost: 'FREE · 100% Unlimited',
  }, { headers });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action = 'test', token = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID, signal, eaSignal } = body;

    if (!token || !chatId) {
      return Response.json({
        ok: false,
        error: 'กรุณากรอก Bot Token และ Chat ID / Channel ID ให้ครบถ้วน'
      }, { status: 400, headers });
    }

    if (action === 'verify') {
      const bot = await verifyTelegramBot({ token });
      if (!bot.valid) {
        return Response.json({ ok: false, error: `โทเคนไม่ถูกต้อง: ${bot.error}` }, { status: 400, headers });
      }
      return Response.json({ ok: true, botName: bot.botName, username: bot.username }, { headers });
    }

    const appOrigin = process.env.APP_ORIGIN || 'https://nugaom-ai-pick.nuibhr1.workers.dev';
    let text = '';
    let symbolReported = null;
    let sideReported = null;

    if (action === 'ea-signal') {
      const targetSignal = eaSignal || signal || {
        symbol: 'XAUUSD',
        side: 'BUY',
        stage: 'ENTRY',
        strategyName: 'Gold London/NY Trend Pullback',
        entry: 2724.50,
        stopLoss: 2712.00,
        lockBuffer: 2728.50,
        tp1: 2742.00,
        tp2: 2758.00,
        recommendedLot: '0.04 Lot',
      };
      text = formatTelegramEaSignalMessage(targetSignal, { appOrigin });
      symbolReported = targetSignal.symbol;
      sideReported = targetSignal.side;
    } else if (action === 'announcement') {
      text = formatTelegramAdminAnnouncement({
        title: body.title || 'ประกาศจากแอดมิน Nugaom AI VIP',
        body: body.message || body.body || 'อัปเดตระบบและแผนเทรดวันนี้เรียบร้อยครับ',
        author: body.author || 'แอดมินน้องนักออม',
        appOrigin,
      });
      symbolReported = 'ANNOUNCEMENT';
      sideReported = 'INFO';
    } else if (action === 'custom' && body.text) {
      text = body.text;
    } else {
      // Default signal for test
      const trade = signal || {
        symbol: 'XAUUSD',
        side: 'LONG',
        signalTime: Math.floor(Date.now() / 1000),
        atr: 8.25,
        trigger: 2720.50,
        plan: {
          entry: 2720.50,
          stop: 2704.00,
          target: 2753.50,
          risk: 16.50,
        }
      };

      text = formatTelegramTradeMessage(trade, { appOrigin });
      symbolReported = trade.symbol;
      sideReported = trade.side;
    }

    const result = await sendTelegramMessage({
      token,
      chatId,
      text,
      parseMode: 'HTML',
    });

    return Response.json({
      ok: true,
      message: 'ส่งสัญญาณเข้า Telegram สำเร็จเรียบร้อย!',
      messageId: result.messageId,
      symbol: symbolReported,
      side: sideReported,
    }, { headers });

  } catch (error) {
    return Response.json({
      ok: false,
      error: error.message || 'เกิดข้อผิดพลาดในการส่งข้อความเข้า Telegram'
    }, { status: 500, headers });
  }
}
