import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'nugaom-partner-leads-route-'));
const prevDbPath = process.env.DATABASE_PATH;
const prevSession = process.env.SESSION_SECRET;
const prevHash = process.env.PORTFOLIO_HASH_SECRET;

process.env.DATABASE_PATH = join(tempDir, 'leads.sqlite');
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'partner-leads-session-secret-'.repeat(3);
process.env.PORTFOLIO_HASH_SECRET = process.env.PORTFOLIO_HASH_SECRET || 'partner-leads-hash-secret-'.repeat(3);

const { GET, POST } = await import('./route.js');
const { getBrokerStaffRole, upsertLineMember, createSession } = await import('../../../../membership/store.mjs');
const { SESSION_COOKIE } = await import('../../../../membership/server.mjs');
const { membershipFor } = await import('../../../../membership/rights.mjs');
const { storage } = await import('../../../../storage/database.mjs');

test.after(() => {
  if (prevDbPath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = prevDbPath;
  if (prevSession === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = prevSession;
  if (prevHash === undefined) delete process.env.PORTFOLIO_HASH_SECRET;
  else process.env.PORTFOLIO_HASH_SECRET = prevHash;
  rmSync(tempDir, { recursive: true, force: true });
});

test('getBrokerStaffRole correctly classifies Super Admin vs Broker Officers', () => {
  const env = {
    ADMIN_LINE_IDS: 'U_SUPER_123',
    BROKER_003_ADMIN_LINE_IDS: 'U_PI_001',
    BROKER_022_ADMIN_LINE_IDS: 'U_TRINITY_001',
    BROKER_050_ADMIN_LINE_IDS: 'U_ASL_001',
  };

  // Super Admin
  const superRole = getBrokerStaffRole({ line_id: 'U_SUPER_123' }, env);
  assert.equal(superRole.isSuper, true);
  assert.equal(superRole.role, 'super_admin');

  // ASL Broker Admin
  const aslRole = getBrokerStaffRole({ line_id: 'U_ASL_001' }, env);
  assert.equal(aslRole.isSuper, false);
  assert.equal(aslRole.brokerId, '050');
  assert.equal(aslRole.brokerName, 'ASL Securities (บล.เอเอสแอล)');

  // Pi Broker Admin
  const piRole = getBrokerStaffRole({ line_id: 'U_PI_001' }, env);
  assert.equal(piRole.isSuper, false);
  assert.equal(piRole.brokerId, '003');

  // Trinity Broker Admin
  const trinityRole = getBrokerStaffRole({ line_id: 'U_TRINITY_001' }, env);
  assert.equal(trinityRole.isSuper, false);
  assert.equal(trinityRole.brokerId, '022');

  // Random member (not admin)
  const nonAdminRole = getBrokerStaffRole({ line_id: 'U_NORMAL_USER' }, env);
  assert.equal(nonAdminRole, null);
});

test('admin partner-leads GET denies unauthorized users', async () => {
  const req = new Request('http://localhost:3000/api/admin/partner-leads');
  const res = await GET(req);
  assert.equal(res.status, 403);
});

test('admin partner-leads POST denies unauthorized users', async () => {
  const req = new Request('http://localhost:3000/api/admin/partner-leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ id: 'lead_123', status: 'contacted' }),
  });
  const res = await POST(req);
  assert.equal(res.status, 403);
});

test('POST /api/admin/partner-leads record-commission enforces broker tenant isolation and extends 30d VIP at >= 1,000 THB', async () => {
  const prevPi = process.env.BROKER_003_ADMIN_LINE_IDS;
  const prevTrinity = process.env.BROKER_022_ADMIN_LINE_IDS;
  process.env.BROKER_003_ADMIN_LINE_IDS = 'U_PI_OFFICER_ROUTE_TEST';
  process.env.BROKER_022_ADMIN_LINE_IDS = 'U_TRINITY_OFFICER_ROUTE_TEST';

  try {
    const customer = await upsertLineMember({
      lineId: 'U_PI_CUSTOMER_ROUTE_TEST',
      displayName: 'ลูกค้าพอร์ต Pi',
    });
    const piStaff = await upsertLineMember({
      lineId: 'U_PI_OFFICER_ROUTE_TEST',
      displayName: 'เจ้าหน้าที่ บล.พาย',
    });
    const trinityStaff = await upsertLineMember({
      lineId: 'U_TRINITY_OFFICER_ROUTE_TEST',
      displayName: 'เจ้าหน้าที่ บล.ทรีนีตี้',
    });

    const now = new Date().toISOString();
    const leadId = 'lead_pi_comm_001';
    await storage.run(
      `INSERT INTO partner_account_leads
        (id, member_id, broker_id, broker_name, full_name, phone, line_id, email, interests, status, notes, lead_type, account_no, created_at, updated_at)
       VALUES (?, ?, '003', 'Pi Securities (บล.พาย)', 'สมชาย ทดสอบพาย', '0812345678', 'somchai_pi', 'somchai@example.com', '["หุ้นไทย Stage 2"]', 'account_opened', 'เปิดพอร์ตแล้ว', 'new_account', 'PI-778899', ?, ?)`,
      leadId, customer.id, now, now
    );

    const piSession = await createSession(piStaff.id);
    const trinitySession = await createSession(trinityStaff.id);

    // 1. Trinity staff cannot record commission on Pi's customer lead -> 403 FORBIDDEN_BROKER_MISMATCH
    const crossReq = new Request('http://localhost:3000/api/admin/partner-leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: `${SESSION_COOKIE}=${encodeURIComponent(trinitySession.value)}`,
      },
      body: JSON.stringify({
        id: leadId,
        action: 'record-commission',
        commissionThb: 1200,
        extendVip: true,
      }),
    });
    const crossRes = await POST(crossReq);
    assert.equal(crossRes.status, 403);
    const crossData = await crossRes.json();
    assert.equal(crossData.error, 'FORBIDDEN_BROKER_MISMATCH');

    // 2. Pi staff records 1,200 THB commission for Pi lead -> 200 & unlocks 30d VIP
    const okReq = new Request('http://localhost:3000/api/admin/partner-leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: `${SESSION_COOKIE}=${encodeURIComponent(piSession.value)}`,
      },
      body: JSON.stringify({
        id: leadId,
        action: 'record-commission',
        commissionThb: 1200,
        extendVip: true,
      }),
    });
    const okRes = await POST(okReq);
    const okData = await okRes.json();
    assert.equal(okRes.status, 200, JSON.stringify(okData));
    assert.equal(okData.success, true);
    assert.equal(okData.commissionThb, 1200);
    assert.equal(okData.memberOutcome?.qualified, true);

    const updatedMember = await storage.first('SELECT * FROM members WHERE id = ?', customer.id);
    assert.equal(updatedMember.broker_monthly_volume_thb, 1200);
    assert.equal(updatedMember.broker_volume_target_thb, 1000);
    assert.equal(updatedMember.portfolio_status, 'verified');
    assert.equal(updatedMember.broker, 'PI SECURITIES (003)');
    assert.equal(membershipFor(updatedMember).tier, 'subscriber');
    assert.equal(membershipFor(updatedMember).capabilities.telegramVip, true);
    assert.equal(membershipFor(updatedMember).planName, 'PRO VIP (พาร์ทเนอร์)');
    assert.equal(membershipFor(updatedMember).limits.dailyScanSymbols, 8);

    // 3. Pi staff GET sees enriched commission status
    const getReq = new Request('http://localhost:3000/api/admin/partner-leads', {
      headers: { Cookie: `${SESSION_COOKIE}=${encodeURIComponent(piSession.value)}` },
    });
    const getRes = await GET(getReq);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.leads.length, 1);
    assert.equal(getData.leads[0].currentCommissionThb, 1200);
    assert.equal(getData.leads[0].targetCommissionThb, 1000);
    assert.equal(getData.leads[0].commissionQualified, true);
  } finally {
    if (prevPi === undefined) delete process.env.BROKER_003_ADMIN_LINE_IDS;
    else process.env.BROKER_003_ADMIN_LINE_IDS = prevPi;
    if (prevTrinity === undefined) delete process.env.BROKER_022_ADMIN_LINE_IDS;
    else process.env.BROKER_022_ADMIN_LINE_IDS = prevTrinity;
  }
});

