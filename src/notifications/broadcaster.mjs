/**
 * Multi-Channel Signal Notification Broadcaster
 * Supports Telegram (Recommended: 100% Free, Unlimited Broadcasts) & LINE Messaging API.
 */

export function formatTelegramTradeMessage(signal, { appOrigin = 'https://nugaom-ai-pick.nuibhr1.workers.dev' } = {}) {
  const isLong = signal.side === 'LONG';
  const sideEmoji = isLong ? '🟢' : '🔴';
  const sideTh = isLong ? 'BUY (ซื้อ / ฝั่ง LONG)' : 'SHORT (ขาย / ฝั่ง SHORT)';
  const symbol = signal.symbol || 'XAUUSD';
  const entry = Number.isFinite(signal.plan?.entry) ? signal.plan.entry.toLocaleString('en-US', { maximumFractionDigits: 4 }) : (signal.trigger ?? '—');
  const stop = Number.isFinite(signal.plan?.stop) ? signal.plan.stop.toLocaleString('en-US', { maximumFractionDigits: 4 }) : (signal.stop ?? '—');
  const target = Number.isFinite(signal.plan?.target) ? signal.plan.target.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—';
  const risk = Number.isFinite(signal.plan?.risk) ? signal.plan.risk.toFixed(2) : '—';
  const atr = Number.isFinite(signal.atr) ? signal.atr.toFixed(2) : '—';
  const timeStr = new Date(signal.signalTime ? signal.signalTime * 1000 : Date.now()).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });

  return `⚡ <b>NUGAOM AI · สัญญาณเดย์เทรด 15m คมชัด</b> ⚡
────────────────────────
🏆 <b>สินทรัพย์:</b> <code>#${symbol}</code> (${symbol.startsWith('XAU') ? 'Spot Gold / ทองคำ' : 'Forex Major'})
📊 <b>คำสั่ง:</b> ${sideEmoji} <b>${sideTh}</b>
⏱️ <b>เวลาแท่งปิด:</b> ${timeStr} น. (ไทม์เฟรม 15 นาที)

🎯 <b>จุดเข้า (Entry):</b> <code>${entry}</code>
🛑 <b>จุดตัดขาดทุน (SL):</b> <code>${stop}</code>
🏁 <b>เป้าหมายทำกำไร (TP 2R):</b> <code>${target}</code>
⚖️ <b>Risk/Reward Ratio:</b> 1 : 2.0 (ระยะเสี่ยง: ${risk} | ATR: ${atr})
────────────────────────
💡 <b>วินัยคุมพอร์ต:</b> คุมความเสี่ยงไม่เกิน 1–2% ของเงินทุน ไม่ Overtrade
🔗 <b>เปิดดูกราฟสด & สถิติย้อนหลัง:</b> <a href="${appOrigin}/forex?symbol=${encodeURIComponent(symbol)}">เปิด Nugaom Forex Terminal ↗</a>`;
}

export async function sendTelegramMessage({ token, chatId, text, parseMode = 'HTML', fetcher = fetch } = {}) {
  if (!token || !chatId) {
    throw Object.assign(new Error('TELEGRAM_CREDENTIALS_REQUIRED'), { code: 'TELEGRAM_CREDENTIALS_REQUIRED' });
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: false,
    }),
    signal: AbortSignal.timeout(10000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const errorMsg = data.description || `HTTP_${response.status}`;
    throw Object.assign(new Error(errorMsg), { code: 'TELEGRAM_DISPATCH_FAILED', details: data });
  }

  return { success: true, messageId: data.result?.message_id };
}

export async function verifyTelegramBot({ token, fetcher = fetch } = {}) {
  if (!token) return { valid: false, error: 'TOKEN_REQUIRED' };
  try {
    const response = await fetcher(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    if (response.ok && data.ok) {
      return { valid: true, botName: data.result?.first_name, username: data.result?.username };
    }
    return { valid: false, error: data.description || 'INVALID_TOKEN' };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

export async function sendLineBroadcast({ channelAccessToken, text, fetcher = fetch } = {}) {
  if (!channelAccessToken) {
    throw Object.assign(new Error('LINE_TOKEN_REQUIRED'), { code: 'LINE_TOKEN_REQUIRED' });
  }

  const response = await fetcher('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      messages: [{ type: 'text', text }],
    }),
    signal: AbortSignal.timeout(10000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.message || `HTTP_${response.status}`), { code: 'LINE_DISPATCH_FAILED', details: data });
  }

  return { success: true };
}
