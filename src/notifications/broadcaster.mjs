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
💡 <b>วินัยคุมพอร์ต:</b> คุมความเสี่ยงไม่เกิน 1–2% ของเงินทุน ไม่ Overtrade
🔗 <b>เปิดดูกราฟสด & สถิติย้อนหลัง:</b> <a href="${appOrigin}/forex?symbol=${encodeURIComponent(symbol)}">เปิด Nugaom Forex Terminal ↗</a>`;
}

export function formatTelegramEaSignalMessage(eaSignal, { appOrigin = 'https://nugaom-ai-pick.nuibhr1.workers.dev' } = {}) {
  const isLong = eaSignal.side === 'LONG' || eaSignal.side === 'BUY';
  const sideEmoji = isLong ? '🟢' : '🔴';
  const sideTh = isLong ? 'BUY' : 'SELL';
  const symbol = eaSignal.symbol || 'XAUUSD';
  const strategyName = eaSignal.strategyName || 'Gold London/NY Trend Pullback';
  const stage = eaSignal.stage || 'ENTRY';

  const stageLabels = {
    ENTRY: '⚡ เข้าไม้ใหม่ (NEW ENTRY)',
    LOCK_PROFIT: '🛡️ ขยับ SL ล็อคกำไรหน้าทุน (LOCK PROFIT)',
    TP1: '🎯 ถึงเป้าหมาย TP1 (เก็บเงินสด 50%)',
    TP2: '🏁 ปิดรันเนอร์ TP2 (จบรอบเทรนด์)',
  };

  const stageHeader = stageLabels[stage] || stageLabels.ENTRY;
  const entry = Number.isFinite(eaSignal.entry) ? eaSignal.entry.toLocaleString('en-US', { maximumFractionDigits: 4 }) : (eaSignal.entry ?? '—');
  const stopLoss = Number.isFinite(eaSignal.stopLoss) ? eaSignal.stopLoss.toLocaleString('en-US', { maximumFractionDigits: 4 }) : (eaSignal.stopLoss ?? '—');
  const lockBuffer = Number.isFinite(eaSignal.lockBuffer) ? eaSignal.lockBuffer.toLocaleString('en-US', { maximumFractionDigits: 4 }) : (eaSignal.lockBuffer ?? '—');
  const tp1 = Number.isFinite(eaSignal.tp1) ? eaSignal.tp1.toLocaleString('en-US', { maximumFractionDigits: 4 }) : (eaSignal.tp1 ?? '—');
  const tp2 = Number.isFinite(eaSignal.tp2) ? eaSignal.tp2.toLocaleString('en-US', { maximumFractionDigits: 4 }) : (eaSignal.tp2 ?? '—');
  const lotSize = eaSignal.recommendedLot || '0.02 - 0.05 Lot';
  const timeStr = new Date(eaSignal.time ? eaSignal.time * 1000 : Date.now()).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });

  const actionTip = stage === 'ENTRY'
    ? '1. เปิดแอป MT4/MT5 กรอก Entry, SL, TP1 ตามตัวเลขด้านบน\n2. ตั้งเตือนเมื่อราคาแตะจุด Lock Profit เพื่อเลื่อน SL มากันทุน'
    : stage === 'LOCK_PROFIT'
    ? `⚠️ <b>กรุณาขยับ Stop Loss ในแอป MT4/MT5 มาที่ ${lockBuffer} ทันที</b> ไม้นี้จะกลายเป็น Risk-Free 100%`
    : 'ปิดทำกำไรตามแผน ปลอดภัยและรักษาวินัย';

  return `🤖 <b>NUGAOM AI · PRO COPY EA STABLE SIGNAL</b> 🤖
────────────────────────
📢 <b>สถานะคำสั่ง:</b> <b>${stageHeader}</b>
🏆 <b>สินทรัพย์:</b> <code>#${symbol}</code>
📐 <b>กลยุทธ์:</b> ${strategyName}
📊 <b>ทิศทาง:</b> ${sideEmoji} <b>${sideTh}</b>
⏱️ <b>เวลาส่งสัญญาณ:</b> ${timeStr} น.

🎯 <b>ราคาเข้า (Entry):</b> <code>${entry}</code>
🛑 <b>ตัดขาดทุน (Initial SL):</b> <code>${stopLoss}</code>
🛡️ <b>จุดล็อคทุน (Lock Profit @ +1R):</b> <code>${lockBuffer}</code> (+0.5R Buffer)
💰 <b>เป้า 1 (TP1 50%):</b> <code>${tp1}</code>
🚀 <b>เป้า 2 (TP2 Runner):</b> <code>${tp2}</code>
📦 <b>ขนาด Lot แนะนำ:</b> <code>${lotSize}</code> (พอร์ต $500–$1,000)
────────────────────────
💡 <b>วิธีปฏิบัติใน 15 วินาที:</b>
${actionTip}
🔗 <b>เปิดดูผลงาน Live Ledger:</b> <a href="${appOrigin}/forex">เปิดดู Pro Copy EA Terminal ↗</a>`;
}

export function formatTelegramAdminAnnouncement({ title, body, author = 'แอดมินน้องนักออม', appOrigin = 'https://nugaom-ai-pick.nuibhr1.workers.dev' } = {}) {
  const timeStr = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' });

  return `📢 <b>NUGAOM AI · ประกาศสำคัญจากทีมงาน VIP</b> 📢
────────────────────────
📌 <b>หัวข้อ:</b> <b>${title}</b>
⏱️ <b>เวลา:</b> ${dateStr} ${timeStr} น.
👤 <b>ผู้ดูแล:</b> ${author}

${body}
────────────────────────
🔗 <b>เข้าสู่ระบบสมาชิก VIP:</b> <a href="${appOrigin}/account">เปิด Nugaom Member Portal ↗</a>`;
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
