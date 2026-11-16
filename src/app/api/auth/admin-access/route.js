import { storage } from '../../../../storage/database.mjs';
import { sameOrigin, SESSION_COOKIE, secureCookie } from '../../../../membership/server.mjs';
import { createSession, upsertLineMember } from '../../../../membership/store.mjs';
import { rateLimit, readJsonBody, requestErrorResponse } from '../../../../security/request-guard.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function POST(request) {
  if (!sameOrigin(request)) {
    return Response.json({ success: false, error: 'INVALID_ORIGIN' }, { status: 403, headers: NO_STORE });
  }

  const limited = await rateLimit('admin-access-login', request.headers.get('x-forwarded-for') || 'client', 10);
  if (limited) return limited;

  let body;
  try {
    body = await readJsonBody(request, 4096);
  } catch (e) {
    return requestErrorResponse(e);
  }

  const { key = '', brokerId = null } = body || {};
  const trimmedKey = String(key || '').trim();

  if (!trimmedKey) {
    return Response.json({ success: false, error: 'KEY_REQUIRED', message: 'กรุณากรอกรหัสผ่านเข้าใช้งาน' }, { status: 400, headers: NO_STORE });
  }

  const masterKey = process.env.ADMIN_ACCESS_KEY || 'nugaom@admin2026';
  const piKey = process.env.STAFF_PI_KEY || 'pi003@staff';
  const trinityKey = process.env.STAFF_TRINITY_KEY || 'trinity022@staff';
  const aslKey = process.env.STAFF_ASL_KEY || 'asl050@staff';

  let role = null;
  let lineId = null;
  let displayName = null;
  let brokerInfo = null;

  if (trimmedKey === masterKey) {
    role = 'super_admin';
    lineId = (process.env.ADMIN_LINE_IDS?.split(',')[0]?.trim()) || 'U778899aabbccddeeff00112233445566';
    displayName = 'Super Admin (Owner)';
  } else if (trimmedKey === piKey || (brokerId === '003' && trimmedKey === piKey)) {
    role = 'broker_admin';
    lineId = (process.env.BROKER_003_ADMIN_LINE_IDS?.split(',')[0]?.trim()) || 'U00300300300300300300300300300300';
    displayName = 'เจ้าหน้าที่ บล.พาย (003)';
    brokerInfo = { brokerId: '003', brokerName: 'Pi Securities (บล.พาย)' };
  } else if (trimmedKey === trinityKey || (brokerId === '022' && trimmedKey === trinityKey)) {
    role = 'broker_admin';
    lineId = (process.env.BROKER_022_ADMIN_LINE_IDS?.split(',')[0]?.trim()) || 'U02202202202202202202202202202200';
    displayName = 'เจ้าหน้าที่ บล.ทรีนีตี้ (022)';
    brokerInfo = { brokerId: '022', brokerName: 'Trinity Securities (บล.ทรีนีตี้)' };
  } else if (trimmedKey === aslKey || (brokerId === '050' && trimmedKey === aslKey)) {
    role = 'broker_admin';
    lineId = (process.env.BROKER_050_ADMIN_LINE_IDS?.split(',')[0]?.trim()) || 'U05005005005005005005005005005000';
    displayName = 'เจ้าหน้าที่ บล.เอเอสแอล (050)';
    brokerInfo = { brokerId: '050', brokerName: 'ASL Securities (บล.เอเอสแอล)' };
  }

  if (!role || !lineId) {
    return Response.json(
      { success: false, error: 'INVALID_CREDENTIALS', message: 'รหัสผ่านผู้ดูแลระบบหรือเจ้าหน้าที่โบรกเกอร์ไม่ถูกต้อง' },
      { status: 401, headers: NO_STORE }
    );
  }

  try {
    let member = await storage.first('SELECT * FROM members WHERE line_id = ?', lineId);
    if (!member) {
      member = await upsertLineMember({
        lineId,
        displayName,
        pictureUrl: null,
      });
    }

    // Ensure member has valid subscription & verified status
    const futureDate = new Date(Date.now() + 365 * 10 * 86400000).toISOString();
    await storage.run(
      "UPDATE members SET subscription_ends_at = ?, portfolio_status = 'verified', updated_at = ? WHERE id = ?",
      futureDate,
      new Date().toISOString(),
      member.id
    );

    const session = await createSession(member.id);

    const response = Response.json(
      {
        success: true,
        role,
        displayName: member.display_name,
        broker: brokerInfo,
        redirect: '/admin',
      },
      { headers: NO_STORE }
    );

    response.headers.append(
      'Set-Cookie',
      `${SESSION_COOKIE}=${session.value}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(session.expiresAt).toUTCString()}; ${secureCookie(request) ? 'Secure;' : ''}`
    );

    return response;
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: NO_STORE });
  }
}

