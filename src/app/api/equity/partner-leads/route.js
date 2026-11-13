import { storage } from '../../../../storage/database.mjs';
import { currentMember, sameOrigin } from '../../../../membership/server.mjs';
import { isAdmin, getBrokerStaffRole, submitPortfolio } from '../../../../membership/store.mjs';
import { rateLimit, readJsonBody, requestErrorResponse } from '../../../../security/request-guard.mjs';
import { sendTelegramMessage, createTelegramInviteLink, resolveTelegramStaffLeadDestination } from '../../../../notifications/broadcaster.mjs';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

const BROKER_CONFIG = {
  '003': {
    id: '003',
    name: 'Pi Securities (บล.พาย)',
    thaiName: 'บล.พาย (มหาชน)',
    tag: 'OFFICIAL PARTNER',
  },
  '022': {
    id: '022',
    name: 'Trinity Securities (บล.ทรีนีตี้)',
    thaiName: 'บล.ทรีนีตี้',
    tag: 'OFFICIAL PARTNER',
  },
  '050': {
    id: '050',
    name: 'ASL Securities (บล.เอเอสแอล)',
    thaiName: 'บล.เอเอสแอล',
    tag: 'OFFICIAL PARTNER',
  },
};

export async function POST(request) {
  if (!sameOrigin(request)) {
    return Response.json({ success: false, error: 'INVALID_ORIGIN' }, { status: 403, headers: NO_STORE });
  }

  let body;
  try {
    body = await readJsonBody(request, 16384);
  } catch (e) {
    return requestErrorResponse(e);
  }

  const {
    brokerId = '022',
    leadType = 'new_account', // 'new_account' | 'existing_port'
    accountNo = '',
    fullName = '',
    phone = '',
    lineId = '',
    email = '',
    interests = [],
    notes = '',
  } = body || {};

  // Validate broker
  if (!BROKER_CONFIG[brokerId]) {
    return Response.json(
      { success: false, error: 'INVALID_BROKER', message: 'กรุณาเลือกโบรกเกอร์พันธมิตรที่ถูกต้อง (Pi 003, Trinity 022 หรือ ASL 050)' },
      { status: 400, headers: NO_STORE }
    );
  }

  const validLeadType = leadType === 'existing_port' ? 'existing_port' : 'new_account';
  const trimmedAccountNo = String(accountNo || '').trim().slice(0, 40);

  if (validLeadType === 'existing_port' && (!trimmedAccountNo || trimmedAccountNo.length < 3)) {
    return Response.json(
      { success: false, error: 'ACCOUNT_NO_REQUIRED', message: 'กรุณาระบุเลขที่บัญชีหุ้น / เลขพอร์ตเพื่อยืนยันสิทธิ์' },
      { status: 400, headers: NO_STORE }
    );
  }

  // Validate fullName
  const trimmedName = String(fullName || '').trim();
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    return Response.json(
      { success: false, error: 'INVALID_NAME', message: 'กรุณากรอกชื่อ-นามสกุลให้ถูกต้อง (2-100 ตัวอักษร)' },
      { status: 400, headers: NO_STORE }
    );
  }

  // Validate phone (Thai phone format, removing hyphens and spaces)
  const cleanedPhone = String(phone || '').replace(/[\s-]/g, '');
  if (!/^0[689]\d{8}$/.test(cleanedPhone) && !/^0\d{8,9}$/.test(cleanedPhone)) {
    return Response.json(
      { success: false, error: 'INVALID_PHONE', message: 'กรุณากรอกเบอร์โทรศัพท์มือถือ 10 หลักให้ถูกต้อง (เช่น 0812345678)' },
      { status: 400, headers: NO_STORE }
    );
  }

  // Optional lineId & email sanitization
  const trimmedLineId = String(lineId || '').trim().slice(0, 80);
  const trimmedEmail = String(email || '').trim().slice(0, 120);
  if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return Response.json(
      { success: false, error: 'INVALID_EMAIL', message: 'รูปแบบอีเมลไม่ถูกต้อง' },
      { status: 400, headers: NO_STORE }
    );
  }

  let member = null;
  try {
    member = await currentMember();
  } catch {
    member = null;
  }
  const rateLimitKey = member?.id || cleanedPhone || 'lead-rate-limit';
  const limited = await rateLimit('partner-lead-submit', rateLimitKey, 5);
  if (limited) return limited;

  const broker = BROKER_CONFIG[brokerId];
  const leadId = `lead_${randomUUID()}`;
  const now = new Date().toISOString();
  const safeInterests = Array.isArray(interests) ? interests.slice(0, 10).map((i) => String(i).slice(0, 50)) : [];
  const trimmedNotes = String(notes || '').trim().slice(0, 500);

  try {
    await storage.run(
      `INSERT INTO partner_account_leads (
        id, member_id, broker_id, broker_name, full_name, phone, line_id, email,
        interests, status, notes, lead_type, account_no, ip_hash, user_agent, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?)`,
      leadId,
      member?.id || null,
      brokerId,
      broker.name,
      trimmedName,
      cleanedPhone,
      trimmedLineId || null,
      trimmedEmail || null,
      JSON.stringify(safeInterests),
      trimmedNotes || null,
      validLeadType,
      trimmedAccountNo || null,
      request.headers.get('x-forwarded-for')?.slice(0, 50) || 'client',
      request.headers.get('user-agent')?.slice(0, 200) || null,
      now,
      now
    );

    // Dedicated Telegram Alert to Staff/Marketing Team ONLY (Never sent to customer channel!)
    const staffDest = resolveTelegramStaffLeadDestination(brokerId, process.env);
    if (process.env.TELEGRAM_BOT_TOKEN && staffDest.chatId) {
      const timeStr = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
      const dateStr = new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' });
      const interestLabels = safeInterests.length > 0 ? safeInterests.join(', ') : validLeadType === 'existing_port' ? 'ขอรับสิทธิ์ VIP รายเดือน' : 'หุ้นไทย & DR ทั่วไป';

      const alertHeader = validLeadType === 'existing_port'
        ? `👑 <b>[แจ้งเตือนทีมมาร์เก็ตติ้ง] ลูกค้ายืนยันเลขพอร์ต VIP!</b>`
        : `📝 <b>[แจ้งเตือนทีมมาร์เก็ตติ้ง] ลูกค้าใหม่ขอเปิดบัญชีหุ้น!</b>`;

      const alertText = `${alertHeader}
────────────────────────
🏛️ <b>โบรกเกอร์:</b> <b>${broker.name}</b> (รหัส ${brokerId})
${validLeadType === 'existing_port' ? `🆔 <b>เลขที่พอร์ต:</b> <code>${trimmedAccountNo}</code>\n` : ''}👤 <b>ชื่อ-สกุล:</b> ${trimmedName}
📞 <b>เบอร์โทรติดต่อ:</b> <code>${cleanedPhone}</code>
💬 <b>LINE ID:</b> <code>${trimmedLineId || '—'}</code>
📧 <b>อีเมล:</b> <code>${trimmedEmail || '—'}</code>
🎯 <b>${validLeadType === 'existing_port' ? 'สิทธิ์ที่ต้องการยืนยัน' : 'สิ่งที่สนใจ'}:</b> ${interestLabels}
${trimmedNotes ? `📝 <b>หมายเหตุ:</b> ${trimmedNotes}\n` : ''}⏱️ <b>เวลาส่งเรื่อง:</b> ${dateStr} เวลา ${timeStr} น.
────────────────────────
💾 <b>บันทึกในฐานข้อมูล:</b> ตาราง <code>partner_account_leads</code> (รหัส ${leadId})
⚡ <b>ขั้นตอนถัดไป (Action Required):</b>
${validLeadType === 'existing_port'
  ? `เจ้าหน้าที่/มาร์เก็ตติ้งของ ${broker.name} เข้าตรวจสอบในระบบหลังบ้านเพื่ออนุมัติสิทธิ์ VIP ให้ลูกค้า`
  : `เจ้าหน้าที่การตลาดของ ${broker.name} โทรติดต่อประสานงานเปิดบัญชีให้ลูกค้าโดยตรง`}`;

      sendTelegramMessage({
        token: process.env.TELEGRAM_BOT_TOKEN,
        chatId: staffDest.chatId,
        messageThreadId: staffDest.messageThreadId,
        text: alertText,
      }).catch((err) => {
        console.warn('[Partner Lead] Telegram staff notification skipped or failed:', err.message);
      });
    } else {
      console.info('[Partner Lead] Staff alert skipped: Dedicated staff Telegram channel not configured (TELEGRAM_CHAT_ID_STAFF / TELEGRAM_CHAT_ID_LEADS).');
    }

    // Sync portfolio to logged-in member record if available
    if (member && validLeadType === 'existing_port' && trimmedAccountNo) {
      try {
        await submitPortfolio(member, broker.name, trimmedAccountNo);
      } catch (err) {
        console.warn('[Partner Lead] Auto-submit portfolio to member record skipped:', err.message);
      }
    }

    // Generate personalized 1-time Telegram VIP Invite Link for Customer VIP channel
    const customerVipChatId = process.env.TELEGRAM_CHAT_ID_VIP || process.env.TELEGRAM_CHAT_ID_THAI || process.env.TELEGRAM_CHAT_ID;
    let inviteLink = null;
    if (process.env.TELEGRAM_BOT_TOKEN && customerVipChatId) {
      try {
        const invite = await createTelegramInviteLink({
          token: process.env.TELEGRAM_BOT_TOKEN,
          chatId: customerVipChatId,
          name: `VIP · ${trimmedName.slice(0, 16)} (${brokerId})`,
          memberLimit: 1,
          expireDate: Date.now() + 24 * 60 * 60 * 1000, // 24 hours validity
        });
        inviteLink = invite?.inviteLink || null;
      } catch (err) {
        console.warn('[Partner Lead] Telegram customer invite creation skipped or failed:', err.message);
      }
    }
    if (!inviteLink && (process.env.TELEGRAM_VIP_INVITE_LINK || process.env.TELEGRAM_INVITE_LINK)) {
      inviteLink = process.env.TELEGRAM_VIP_INVITE_LINK || process.env.TELEGRAM_INVITE_LINK;
    }

    const confirmMessage = validLeadType === 'existing_port'
      ? `บันทึกข้อมูลแจ้งเลขพอร์ต ${broker.name} เรียบร้อยแล้ว เจ้าหน้าที่จะตรวจสอบเพื่อยืนยันสิทธิ์ VIP ให้ท่านโดยเร็ว`
      : `บันทึกข้อมูลขอเปิดบัญชี ${broker.name} สำเร็จ เจ้าหน้าที่การตลาดจะติดต่อประสานงานดูแลท่านโดยเร็ว`;

    return Response.json(
      {
        success: true,
        leadId,
        brokerId,
        brokerName: broker.name,
        leadType: validLeadType,
        accountNo: trimmedAccountNo || null,
        inviteLink,
        trialActivated: true,
        message: confirmMessage,
      },
      { status: 201, headers: NO_STORE }
    );
  } catch (err) {
    console.error('[Partner Lead] Save failed:', err);
    return Response.json(
      { success: false, error: 'SAVE_FAILED', message: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง' },
      { status: 500, headers: NO_STORE }
    );
  }
}

export async function GET(request) {
  let member = null;
  try {
    member = await currentMember();
  } catch {
    member = null;
  }
  const role = getBrokerStaffRole(member);
  if (!role) {
    return Response.json({ success: false, error: 'FORBIDDEN' }, { status: 403, headers: NO_STORE });
  }

  const url = new URL(request.url);
  const reqBrokerId = url.searchParams.get('brokerId');
  const leadType = url.searchParams.get('leadType');
  const status = url.searchParams.get('status');
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

  // If officer for a specific broker, forcibly lock to their brokerId!
  const targetBrokerId = role.isSuper ? reqBrokerId : role.brokerId;

  let sql = 'SELECT * FROM partner_account_leads WHERE 1=1';
  const params = [];
  if (targetBrokerId) {
    sql += ' AND broker_id = ?';
    params.push(targetBrokerId);
  }
  if (leadType && ['new_account', 'existing_port'].includes(leadType)) {
    sql += ' AND lead_type = ?';
    params.push(leadType);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  try {
    const leads = await storage.all(sql, ...params);
    return Response.json({ success: true, leads, brokerRole: role }, { headers: NO_STORE });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: NO_STORE });
  }
}
