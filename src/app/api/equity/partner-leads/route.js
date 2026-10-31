import { storage } from '../../../../storage/database.mjs';
import { currentMember, sameOrigin } from '../../../../membership/server.mjs';
import { isAdmin } from '../../../../membership/store.mjs';
import { rateLimit, readJsonBody, requestErrorResponse } from '../../../../security/request-guard.mjs';
import { sendTelegramMessage } from '../../../../notifications/broadcaster.mjs';
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
      { success: false, error: 'INVALID_BROKER', message: 'กรุณาเลือกโบรกเกอร์พันธมิตรที่ถูกต้อง (Pi หรือ Trinity)' },
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
        interests, status, notes, ip_hash, user_agent, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?)`,
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
      request.headers.get('x-forwarded-for')?.slice(0, 50) || 'client',
      request.headers.get('user-agent')?.slice(0, 200) || null,
      now,
      now
    );

    // Instant Telegram Alert to Admin/Marketing team
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const timeStr = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
      const dateStr = new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' });
      const interestLabels = safeInterests.length > 0 ? safeInterests.join(', ') : 'หุ้นไทย & DR ทั่วไป';

      const alertText = `👑 <b>มีลูกค้าใหม่ขอเปิดพอร์ตผ่าน Nugaom Platform (IB Lead)!</b>
────────────────────────
🏛️ <b>โบรกเกอร์ที่เลือก:</b> <b>${broker.name}</b> (รหัส ${brokerId})
👤 <b>ชื่อ-สกุล:</b> ${trimmedName}
📞 <b>เบอร์โทรติดต่อ:</b> <code>${cleanedPhone}</code>
💬 <b>LINE ID:</b> <code>${trimmedLineId || '—'}</code>
📧 <b>อีเมล:</b> <code>${trimmedEmail || '—'}</code>
🎯 <b>สิ่งที่สนใจ:</b> ${interestLabels}
${trimmedNotes ? `📝 <b>หมายเหตุ:</b> ${trimmedNotes}\n` : ''}⏱️ <b>เวลายื่นเรื่อง:</b> ${dateStr} เวลา ${timeStr} น.
────────────────────────
💾 <b>บันทึกในฐานข้อมูล:</b> ตาราง <code>partner_account_leads</code> (รหัส ${leadId})
⚡ <b>ขั้นตอนถัดไป (Action Required):</b>
มาร์เก็ตติ้ง/ผู้ดูแลลูกค้าของโบรกเกอร์ ${broker.name} ประจำพาร์ทเนอร์แพลตฟอร์ม จะโทรติดต่อดูแลและอำนวยความสะดวกให้ลูกค้าโดยตรง`;

      sendTelegramMessage({
        token: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
        text: alertText,
      }).catch((err) => {
        console.warn('[Partner Lead] Telegram notification dispatch skipped or failed:', err.message);
      });
    }

    return Response.json(
      {
        success: true,
        leadId,
        brokerId,
        brokerName: broker.name,
        message: `บันทึกข้อมูลขอเปิดบัญชี ${broker.name} สำเร็จ เจ้าหน้าที่การตลาดจะติดต่อประสานงานดูแลท่านโดยเร็ว`,
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
  if (!member || !isAdmin(member)) {
    return Response.json({ success: false, error: 'FORBIDDEN' }, { status: 403, headers: NO_STORE });
  }

  const url = new URL(request.url);
  const brokerId = url.searchParams.get('brokerId');
  const status = url.searchParams.get('status');
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

  let sql = 'SELECT * FROM partner_account_leads WHERE 1=1';
  const params = [];
  if (brokerId) {
    sql += ' AND broker_id = ?';
    params.push(brokerId);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  try {
    const leads = await storage.all(sql, ...params);
    return Response.json({ success: true, leads }, { headers: NO_STORE });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: NO_STORE });
  }
}
