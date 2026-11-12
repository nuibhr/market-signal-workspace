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

export const TELEGRAM_MARKET_CATEGORIES = Object.freeze({
  thai: {
    id: 'thai',
    badge: '🇹🇭 โพยหุ้นไทย SET100',
    hashtag: '#หุ้นไทย #SET100',
    path: '/thai',
    envChatKey: 'TELEGRAM_CHAT_ID_THAI',
    envThreadKey: 'TELEGRAM_THREAD_ID_THAI',
    scheduleNote: '09:30 โพยเช้า · 13:30 โพยบ่าย · 17:30 การบ้านเย็น',
  },
  dr: {
    id: 'dr',
    badge: '🌐 โพย DR80 หุ้นโลก',
    hashtag: '#DR80 #หุ้นต่างประเทศ',
    path: '/dr',
    envChatKey: 'TELEGRAM_CHAT_ID_DR',
    envThreadKey: 'TELEGRAM_THREAD_ID_DR',
    scheduleNote: '09:30 โพยเช้า · 13:30 โพยบ่าย · 17:30 การบ้านเย็น (เทียบ Fair Value)',
  },
  tfex: {
    id: 'tfex',
    badge: '⚡ โพย TFEX & SET50 Futures',
    hashtag: '#TFEX #S50 #GO',
    path: '/tfex',
    envChatKey: 'TELEGRAM_CHAT_ID_TFEX',
    envThreadKey: 'TELEGRAM_THREAD_ID_TFEX',
    scheduleNote: '09:30 เปิดตลาดเช้า · 13:30 เปิดตลาดบ่าย · แจ้งเตือน LONG/SHORT',
  },
  us: {
    id: 'us',
    badge: '🇺🇸 โพยหุ้นอเมริกา S&P 500',
    hashtag: '#USStocks #Stage2 #Dime',
    path: '/us',
    envChatKey: 'TELEGRAM_CHAT_ID_US',
    envThreadKey: 'TELEGRAM_THREAD_ID_US',
    scheduleNote: '19:30 ตั้งคำสั่ง GTC ล่วงหน้า · 06:00 สรุปปิดตลาดสหรัฐฯ',
  },
  forex: {
    id: 'forex',
    badge: '🥇 โพย Forex & Gold (Pro Copy EA)',
    hashtag: '#XAUUSD #Forex #ProCopyEA',
    path: '/forex',
    envChatKey: 'TELEGRAM_CHAT_ID_FOREX',
    envThreadKey: 'TELEGRAM_THREAD_ID_FOREX',
    scheduleNote: 'แจ้งเตือนเรียลไทม์ 4 จังหวะ (Entry / Lock Profit / TP1 / TP2)',
  },
});

export const TELEGRAM_ROUND_LABELS = Object.freeze({
  morning_0930: '🌅 รอบเช้า 09:30 น. · เช้านี้เล่นอะไรดี?',
  afternoon_1330: '☀️ รอบบ่าย 13:30 น. · บ่ายนี้เล่นอะไรดี?',
  evening_1730: '🌙 รอบเย็น 17:30 น. · หุ้นการบ้านเฝ้าพรุ่งนี้',
});

export function resolveTelegramCategoryDestination(category = 'thai', env = process.env, explicitThreadId = null) {
  const cat = TELEGRAM_MARKET_CATEGORIES[category] || TELEGRAM_MARKET_CATEGORIES.thai;
  const chatId = (cat.envChatKey && env?.[cat.envChatKey]) ? env[cat.envChatKey] : env?.TELEGRAM_CHAT_ID;
  const rawThread = explicitThreadId ?? (cat.envThreadKey ? env?.[cat.envThreadKey] : null);
  const parsedThread = Number(rawThread);
  const messageThreadId = Number.isInteger(parsedThread) && parsedThread > 0 ? parsedThread : null;
  return { chatId, messageThreadId, categoryMeta: cat };
}

export function formatTelegramMarketPlaybookMessage({
  category = 'thai',
  round = 'morning_0930',
  picks = [],
  regime = 'ตลาดเอื้อ (SET100 / Global)',
  appOrigin = 'https://nugaom-ai-pick.nuibhr1.workers.dev',
} = {}) {
  const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cat = TELEGRAM_MARKET_CATEGORIES[category] || TELEGRAM_MARKET_CATEGORIES.thai;
  const roundTitle = TELEGRAM_ROUND_LABELS[round] || TELEGRAM_ROUND_LABELS.morning_0930;
  const dateStr = new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' });
  const unit = category === 'us' || category === 'forex' ? '$' : category === 'tfex' ? 'จุด' : '฿';

  const lines = (picks || []).slice(0, 5).map((item, idx) => {
    const sym = esc(item.symbol || '—');
    const rawEntry = item.entry ?? '—';
    const rawTp = item.tp1 ?? item.target ?? '—';
    const rawSl = item.sl ?? item.stop ?? '—';
    const entry = Number.isFinite(Number(rawEntry)) ? Number(rawEntry).toLocaleString('en-US', { maximumFractionDigits: 2 }) : esc(rawEntry);
    const tp1 = Number.isFinite(Number(rawTp)) ? Number(rawTp).toLocaleString('en-US', { maximumFractionDigits: 2 }) : esc(rawTp);
    const sl = Number.isFinite(Number(rawSl)) ? Number(rawSl).toLocaleString('en-US', { maximumFractionDigits: 2 }) : esc(rawSl);
    const note = item.note ? ` · <i>${esc(item.note)}</i>` : '';
    return `${idx + 1}. <b><code>#${sym}</code></b>${note}\n   🟢 แนวรับ/จุดเข้า: <code>${entry} ${unit}</code> | 🎯 เป้า TP1: <code>${tp1} ${unit}</code> | 🔴 จุดคัท SL: <code>${sl} ${unit}</code>`;
  });

  return `📣 <b>[${esc(cat.badge)}]</b>\n<b>${esc(roundTitle)}</b>
────────────────────────
📅 <b>ประจำวันที่:</b> ${esc(dateStr)}
📊 <b>ภาวะตลาด:</b> ${esc(regime)}

${lines.length ? lines.join('\n\n') : '• กำลังอัปเดตรายชื่อเข้าแผนรอบล่าสุด'}
────────────────────────
💡 <b>วินัย 2R Management:</b> ตั้งรับที่โซนแนวรับ ไม่ไล่ราคา แบ่งขายล็อกกำไร 50% ที่ TP1 และยก Stop บังทุนเสมอ
🏷️ <b>หมวดหมู่:</b> ${esc(cat.hashtag)}
🔗 <b>เปิดกราฟ &amp; ฟังเสียงอ่านโพย:</b> <a href="${appOrigin}${cat.path}">เปิดหน้า ${esc(cat.badge)} ↗</a>`;
}

export async function sendTelegramMessage({ token, chatId, messageThreadId = null, text, parseMode = 'HTML', fetcher = fetch } = {}) {
  if (!token || !chatId) {
    throw Object.assign(new Error('TELEGRAM_CREDENTIALS_REQUIRED'), { code: 'TELEGRAM_CREDENTIALS_REQUIRED' });
  }

  const payload = {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: false,
  };
  if (Number.isInteger(Number(messageThreadId)) && Number(messageThreadId) > 0) {
    payload.message_thread_id = Number(messageThreadId);
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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

export async function createTelegramInviteLink({
  token,
  chatId,
  name,
  expireDate,
  memberLimit = 1,
  createsJoinRequest = false,
  fetcher = fetch
} = {}) {
  if (!token || !chatId) {
    throw Object.assign(new Error('TELEGRAM_CREDENTIALS_REQUIRED'), { code: 'TELEGRAM_CREDENTIALS_REQUIRED' });
  }

  const url = `https://api.telegram.org/bot${token}/createChatInviteLink`;
  const body = {
    chat_id: chatId,
    creates_join_request: Boolean(createsJoinRequest),
  };
  if (name) body.name = String(name).slice(0, 32);
  if (Number.isFinite(memberLimit) && memberLimit > 0) body.member_limit = memberLimit;
  if (Number.isFinite(expireDate) && expireDate > 0) body.expire_date = Math.floor(expireDate / 1000);

  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const errorMsg = data.description || `HTTP_${response.status}`;
    throw Object.assign(new Error(errorMsg), { code: 'TELEGRAM_INVITE_FAILED', details: data });
  }

  return {
    success: true,
    inviteLink: data.result?.invite_link,
    name: data.result?.name,
    memberLimit: data.result?.member_limit,
    expireDate: data.result?.expire_date,
  };
}

export async function kickTelegramChatMember({ token, chatId, userId, fetcher = fetch } = {}) {
  if (!token || !chatId) {
    throw Object.assign(new Error('TELEGRAM_CREDENTIALS_REQUIRED'), { code: 'TELEGRAM_CREDENTIALS_REQUIRED' });
  }
  if (!userId) {
    throw Object.assign(new Error('TELEGRAM_USER_ID_REQUIRED'), { code: 'TELEGRAM_USER_ID_REQUIRED' });
  }

  // Step 1: Ban the member to kick them out immediately
  const banUrl = `https://api.telegram.org/bot${token}/banChatMember`;
  const banResponse = await fetcher(banUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, user_id: userId }),
    signal: AbortSignal.timeout(10000),
  });

  const banData = await banResponse.json().catch(() => ({}));
  if (!banResponse.ok || !banData.ok) {
    const errorMsg = banData.description || `HTTP_${banResponse.status}`;
    throw Object.assign(new Error(errorMsg), { code: 'TELEGRAM_KICK_FAILED', details: banData });
  }

  // Step 2: Unban immediately with only_if_banned: true so they can rejoin in the future when renewed!
  const unbanUrl = `https://api.telegram.org/bot${token}/unbanChatMember`;
  await fetcher(unbanUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, user_id: userId, only_if_banned: true }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => {});

  return { success: true, kicked: true, userId };
}

export async function unbanTelegramChatMember({ token, chatId, userId, fetcher = fetch } = {}) {
  if (!token || !chatId) {
    throw Object.assign(new Error('TELEGRAM_CREDENTIALS_REQUIRED'), { code: 'TELEGRAM_CREDENTIALS_REQUIRED' });
  }
  if (!userId) {
    throw Object.assign(new Error('TELEGRAM_USER_ID_REQUIRED'), { code: 'TELEGRAM_USER_ID_REQUIRED' });
  }

  const unbanUrl = `https://api.telegram.org/bot${token}/unbanChatMember`;
  const response = await fetcher(unbanUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, user_id: userId, only_if_banned: true }),
    signal: AbortSignal.timeout(8000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const errorMsg = data.description || `HTTP_${response.status}`;
    throw Object.assign(new Error(errorMsg), { code: 'TELEGRAM_UNBAN_FAILED', details: data });
  }

  return { success: true, unbanned: true, userId };
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
