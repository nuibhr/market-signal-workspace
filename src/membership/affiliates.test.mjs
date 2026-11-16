import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'nugaom-affiliates-'));
const prevDbPath = process.env.DATABASE_PATH;
const prevAdmins = process.env.ADMIN_LINE_IDS;
const prevPi = process.env.BROKER_003_ADMIN_LINE_IDS;
const prevSession = process.env.SESSION_SECRET;
const prevHash = process.env.PORTFOLIO_HASH_SECRET;

process.env.DATABASE_PATH = join(tempDir, 'affiliates.sqlite');
process.env.ADMIN_LINE_IDS = 'U_AFF_SUPER_OWNER';
process.env.BROKER_003_ADMIN_LINE_IDS = 'U_AFF_PI_STAFF';
process.env.SESSION_SECRET = 'aff-test-session-secret-'.repeat(3);
process.env.PORTFOLIO_HASH_SECRET = 'aff-test-hash-secret-'.repeat(3);

const { sharedDatabase } = await import('../storage/sqlite.mjs');
const { storage } = await import('../storage/database.mjs');
const { upsertLineMember, createSession } = await import('./store.mjs');
const { SESSION_COOKIE } = await import('./server.mjs');
const {
  createOrUpdateAffiliatePartner,
  attributeReferralToMember,
  recordStripeAffiliateCommission,
  markAffiliateCommissionStatus,
  listAffiliateDashboard,
  REFERRAL_COOKIE,
} = await import('./affiliates.mjs');
const referralRoute = await import('../app/api/referral/route.js');
const affiliatesRoute = await import('../app/api/admin/affiliates/route.js');

test.after(() => {
  sharedDatabase().close();
  if (prevDbPath === undefined) delete process.env.DATABASE_PATH; else process.env.DATABASE_PATH = prevDbPath;
  if (prevAdmins === undefined) delete process.env.ADMIN_LINE_IDS; else process.env.ADMIN_LINE_IDS = prevAdmins;
  if (prevPi === undefined) delete process.env.BROKER_003_ADMIN_LINE_IDS; else process.env.BROKER_003_ADMIN_LINE_IDS = prevPi;
  if (prevSession === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = prevSession;
  if (prevHash === undefined) delete process.env.PORTFOLIO_HASH_SECRET; else process.env.PORTFOLIO_HASH_SECRET = prevHash;
  rmSync(tempDir, { recursive: true, force: true });
});

test('30% affiliate flow: partner setup, first-touch attribution, Stripe 30% commission idempotency, multi-tenant view, and payout', async () => {
  const superAdmin = await upsertLineMember({ lineId: process.env.ADMIN_LINE_IDS, displayName: 'Owner' });
  const coAdmin = await upsertLineMember({ lineId: 'U_COADMIN_COACH_01', displayName: 'โค้ช A' });
  const piStaff = await upsertLineMember({ lineId: process.env.BROKER_003_ADMIN_LINE_IDS, displayName: 'เจ้าหน้าที่ บล.พาย' });
  const customer = await upsertLineMember({ lineId: 'U_SUBSCRIBER_01', displayName: 'ลูกค้าสมชาย' });
  const outsider = await upsertLineMember({ lineId: 'U_OUTSIDER_01', displayName: 'คนทั่วไป' });

  // 1. Super Admin creates partner code COACH30 at 30%
  const partner = await createOrUpdateAffiliatePartner(superAdmin, {
    memberId: coAdmin.id,
    code: 'COACH30',
    commissionRatePct: 30,
    payoutNote: 'PromptPay 081-234-5678',
  });
  assert.equal(partner.code, 'COACH30');
  assert.equal(partner.commission_rate_pct, 30);

  // 2. Referral API sets cookie and attributes eligible logged-in customer; blocks self-referral & overwrite
  const customerSession = await createSession(customer.id);
  const refRes = await referralRoute.POST(new Request('http://localhost:3000/api/referral', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      Cookie: `${SESSION_COOKIE}=${encodeURIComponent(customerSession.value)}`,
    },
    body: JSON.stringify({ code: 'coach30' }),
  }));
  assert.equal(refRes.status, 200);
  const refData = await refRes.json();
  assert.equal(refData.code, 'COACH30');
  assert.equal(refData.attribution.attributed, true);
  assert.ok(refRes.headers.get('set-cookie').includes(`${REFERRAL_COOKIE}=COACH30`));

  // First-touch protection & self-referral rejection
  const selfAttr = await attributeReferralToMember(coAdmin.id, 'COACH30');
  assert.equal(selfAttr.reason, 'SELF_REFERRAL_BLOCKED');
  await createOrUpdateAffiliatePartner(superAdmin, { memberId: piStaff.id, code: 'PI003', commissionRatePct: 30 });
  const overwriteAttr = await attributeReferralToMember(customer.id, 'PI003');
  assert.equal(overwriteAttr.reason, 'ALREADY_ATTRIBUTED');

  // 3. Stripe 399 THB PRO VIP invoice -> exact 119.70 THB (30%) once (idempotent on invoiceId)
  const comm1 = await recordStripeAffiliateCommission({
    memberId: customer.id,
    planId: 'pro',
    interval: 'month',
    invoiceId: 'in_test_399_01',
    eventId: 'evt_test_01',
    grossAmountSatang: 39900,
  });
  assert.equal(comm1.recorded, true);
  assert.equal(comm1.grossThb, 399);
  assert.equal(comm1.commissionThb, 119.7);

  const dup = await recordStripeAffiliateCommission({
    memberId: customer.id,
    planId: 'pro',
    interval: 'month',
    invoiceId: 'in_test_399_01',
    eventId: 'evt_test_02',
    grossAmountSatang: 39900,
  });
  assert.equal(dup.recorded, false);

  // 4. Multi-tenant isolation: Co-Admin sees ONLY their own 119.70 THB; outsider blocked (403); Broker Staff sees only own
  const coSession = await createSession(coAdmin.id);
  const coGet = await affiliatesRoute.GET(new Request('http://localhost:3000/api/admin/affiliates', {
    headers: { Cookie: `${SESSION_COOKIE}=${encodeURIComponent(coSession.value)}` },
  }));
  assert.equal(coGet.status, 200);
  const coDash = await coGet.json();
  assert.equal(coDash.isSuper, false);
  assert.equal(coDash.partners.length, 1);
  assert.equal(coDash.partners[0].code, 'COACH30');
  assert.equal(coDash.summary.pendingCommissionThb, 119.7);

  const outsiderSession = await createSession(outsider.id);
  const outGet = await affiliatesRoute.GET(new Request('http://localhost:3000/api/admin/affiliates', {
    headers: { Cookie: `${SESSION_COOKIE}=${encodeURIComponent(outsiderSession.value)}` },
  }));
  assert.equal(outGet.status, 403);

  // Co-Admin cannot mark payout or create partners (403)
  const coPost = await affiliatesRoute.POST(new Request('http://localhost:3000/api/admin/affiliates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      Cookie: `${SESSION_COOKIE}=${encodeURIComponent(coSession.value)}`,
    },
    body: JSON.stringify({ action: 'create-partner', memberId: outsider.id, code: 'HACK30' }),
  }));
  assert.equal(coPost.status, 403);

  // 5. Super Admin marks commission paid -> updates summary
  const superDashBefore = await listAffiliateDashboard(superAdmin);
  const commId = superDashBefore.commissions[0].id;
  await markAffiliateCommissionStatus(superAdmin, commId, { status: 'paid', payoutNote: 'KBANK slip #1' });
  const coDashAfter = await listAffiliateDashboard(coAdmin);
  assert.equal(coDashAfter.summary.pendingCommissionThb, 0);
  assert.equal(coDashAfter.summary.paidCommissionThb, 119.7);

  const row = await storage.first('SELECT status, commission_thb FROM affiliate_commissions WHERE id = ?', commId);
  assert.equal(row.status, 'paid');
  assert.equal(row.commission_thb, 119.7);
});
