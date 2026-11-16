import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('Promo VIP & Partner ≥฿1,000/month commission monitor flow persists on SQLite and powers adminMemberships KPIs & filters', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nugaom-vip-monitor-'));
  const prevDbPath = process.env.DATABASE_PATH;
  const prevSession = process.env.SESSION_SECRET;
  const prevHash = process.env.PORTFOLIO_HASH_SECRET;
  const prevAdmins = process.env.ADMIN_LINE_IDS;

  process.env.DATABASE_PATH = join(dir, 'monitor.sqlite');
  process.env.SESSION_SECRET = 'monitor-session-secret-'.repeat(3);
  process.env.PORTFOLIO_HASH_SECRET = 'monitor-portfolio-secret-'.repeat(3);
  process.env.ADMIN_LINE_IDS = 'U_MONITOR_ADMIN_00000000000000001';

  try {
    const store = await import('../membership/store.mjs');
    const ops = await import('./operations.mjs');
    const { storage } = await import('../storage/database.mjs');
    const { membershipFor } = await import('../membership/rights.mjs');

    const admin = await store.upsertLineMember({
      lineId: process.env.ADMIN_LINE_IDS,
      displayName: 'Monitor Admin',
    });

    const promoUser = await store.upsertLineMember({
      lineId: 'U_PROMO_USER_00000000000000000002',
      displayName: 'Promo VIP User',
    });
    const partnerPass = await store.upsertLineMember({
      lineId: 'U_PARTNER_PASS_00000000000000003',
      displayName: 'Partner 1.5M User',
    });
    const partnerRisk = await store.upsertLineMember({
      lineId: 'U_PARTNER_RISK_00000000000000004',
      displayName: 'Partner 200k Risk',
    });

    // 1. Admin cannot issue default partner_vip code without verification
    await assert.rejects(
      store.issueCode(admin, promoUser.id, 'op-promo-blocked-01'),
      { message: 'PORTFOLIO_NOT_VERIFIED' }
    );

    // 2. Admin can issue a 14-day promo_vip code with allowUnverified: true and customer can redeem without broker verification
    const promoCode = await store.issueCode(admin, promoUser.id, 'op-promo-valid-01', {
      grantType: 'promo_vip',
      durationDays: 14,
      minVolumeThb: 0,
      note: 'แคมเปญต่อโปร 14 วัน',
      allowUnverified: true,
    });
    assert.ok(promoCode.startsWith('NUG-'));
    const promoRow = await storage.first('SELECT * FROM members WHERE id=?', promoUser.id);
    const promoEnds = await store.redeemCode(promoRow, promoCode);
    const promoDuration = Date.parse(promoEnds) - Date.now();
    assert.ok(promoDuration > 13 * 86400000 && promoDuration <= 15 * 86400000);

    const updatedPromoMember = await storage.first('SELECT * FROM members WHERE id=?', promoUser.id);
    assert.equal(membershipFor(updatedPromoMember).tier, 'subscriber');
    assert.equal(membershipFor(updatedPromoMember).capabilities.telegramVip, true);

    // 3. Admin links & verifies Partner Brokers (PI / TRINITY) with 1,000 THB/month commission targets
    const passRes = await store.verifyPartnerBrokerByAdmin(admin, partnerPass.id, {
      broker: 'PI',
      accountNo: 'PI-88990011',
      targetThb: 1000,
      monthlyVolumeThb: 1500,
      note: 'พอร์ต Pi ค่าคอม 1,500',
    });
    assert.equal(passRes.qualified, true);
    assert.equal(passRes.monthlyVolumeThb, 1500);

    const riskRes = await store.verifyPartnerBrokerByAdmin(admin, partnerRisk.id, {
      broker: 'TRINITY',
      accountNo: 'TR-55667788',
      targetThb: 1000,
      monthlyVolumeThb: 200,
      note: 'เริ่มเทรดเดือนแรก ค่าคอม 200',
    });
    assert.equal(riskRes.qualified, false);

    // Grant Partner VIP code to both verified accounts and redeem
    const passCode = await store.issueCode(admin, partnerPass.id, 'op-partner-pass-01', {
      grantType: 'partner_vip',
      durationDays: 30,
      minVolumeThb: 1000,
    });
    await store.redeemCode(await storage.first('SELECT * FROM members WHERE id=?', partnerPass.id), passCode);

    const riskCode = await store.issueCode(admin, partnerRisk.id, 'op-partner-risk-01', {
      grantType: 'partner_vip',
      durationDays: 30,
      minVolumeThb: 1000,
    });
    await store.redeemCode(await storage.first('SELECT * FROM members WHERE id=?', partnerRisk.id), riskCode);

    // 4. Verify Admin Fullset Monitor KPIs & filters
    const allView = await ops.adminMemberships(admin, { filter: 'all' });
    assert.equal(allView.summary.total, 4);
    assert.equal(allView.summary.volumePassedCount, 1);
    assert.ok(allView.summary.volumeRiskCount >= 1);

    const passFiltered = await ops.adminMemberships(admin, { filter: 'volume_pass' });
    assert.equal(passFiltered.total, 1);
    assert.equal(passFiltered.members[0].id, partnerPass.id);
    assert.equal(passFiltered.members[0].volumeQualified, true);
    assert.equal(passFiltered.members[0].volumeProgressPct, 100);

    const riskFiltered = await ops.adminMemberships(admin, { filter: 'volume_risk' });
    assert.ok(riskFiltered.members.some(m => m.id === partnerRisk.id));

    // 5. Revoke partnerRisk VIP, then broker staff for TRINITY records >= 1,000 commission -> clears revocation & extends VIP
    await store.revokePartnerVip(admin, partnerRisk.id, { reason: 'VOLUME_BELOW_TARGET' });
    let revokedRow = await storage.first('SELECT * FROM members WHERE id=?', partnerRisk.id);
    assert.equal(revokedRow.vip_revoked_reason, 'VOLUME_BELOW_TARGET');

    process.env.BROKER_022_ADMIN_LINE_IDS = 'U_TRINITY_OFFICER_0000000000001';
    const trinityStaff = await store.upsertLineMember({
      lineId: process.env.BROKER_022_ADMIN_LINE_IDS,
      displayName: 'Trinity Staff',
    });
    // Pi member cannot be modified by Trinity staff
    await assert.rejects(
      store.recordBrokerCommissionByStaff(trinityStaff, {
        memberId: partnerPass.id,
        brokerId: '003',
        commissionThb: 2000,
      }),
      { message: 'FORBIDDEN' }
    );
    // Trinity staff updates their own customer's commission to 1,200 THB & grants 30d VIP
    const staffUpdate = await store.recordBrokerCommissionByStaff(trinityStaff, {
      memberId: partnerRisk.id,
      brokerId: '022',
      commissionThb: 1200,
      extendVipDays: 30,
      note: 'ค่าคอมครบ 1,200 บ.',
    });
    assert.equal(staffUpdate.qualified, true);
    assert.equal(staffUpdate.monthlyCommissionThb, 1200);
    revokedRow = await storage.first('SELECT * FROM members WHERE id=?', partnerRisk.id);
    assert.equal(revokedRow.vip_revoked_reason, null);
    assert.equal(membershipFor(revokedRow).tier, 'subscriber');

    // 6. Verify adminMemberDetail returns enriched commission & code metadata
    const detail = await ops.adminMemberDetail(admin, partnerPass.id);
    assert.equal(detail.member.monthlyVolumeThb, 1500);
    assert.equal(detail.codes[0].grant_type, 'partner_vip');
    assert.equal(detail.codes[0].duration_days, 30);
    assert.equal(detail.codes[0].min_volume_thb, 1000);
  } finally {
    if (prevDbPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = prevDbPath;
    if (prevSession === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSession;
    if (prevHash === undefined) delete process.env.PORTFOLIO_HASH_SECRET;
    else process.env.PORTFOLIO_HASH_SECRET = prevHash;
    if (prevAdmins === undefined) delete process.env.ADMIN_LINE_IDS;
    else process.env.ADMIN_LINE_IDS = prevAdmins;
    rmSync(dir, { recursive: true, force: true });
  }
});
