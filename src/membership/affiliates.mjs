import { randomUUID } from 'node:crypto';
import { storage } from '../storage/database.mjs';
import { getBrokerStaffRole, isAdmin } from './store.mjs';
import { isDemoIdentity } from './demo-policy.mjs';

export const REFERRAL_COOKIE = 'nugaom_ref';
export const DEFAULT_COMMISSION_RATE_PCT = 30;

export function normalizeReferralCode(raw) {
  const code = String(raw ?? '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return null;
  return code;
}

export async function findActiveAffiliateByCode(rawCode) {
  const code = normalizeReferralCode(rawCode);
  if (!code) return null;
  return storage.first(
    `SELECT ap.*, m.display_name AS partner_name
     FROM affiliate_partners ap
     JOIN members m ON m.id = ap.member_id
     WHERE ap.code = ? AND ap.status = 'active'`,
    code
  );
}

export async function getAffiliateProfile(member) {
  if (!member?.id || isDemoIdentity(member)) return null;
  return storage.first('SELECT * FROM affiliate_partners WHERE member_id = ?', member.id);
}

/**
 * Auto-provision a default 30% affiliate code for Super Admin or Broker Staff entering /admin
 * so partner admins joining the platform always have an active referral link ready.
 */
export async function ensureStaffAffiliatePartner(member) {
  if (!member?.id || isDemoIdentity(member)) return null;
  const existing = await storage.first('SELECT * FROM affiliate_partners WHERE member_id = ?', member.id);
  if (existing) return existing;

  const brokerRole = getBrokerStaffRole(member);
  const superAdmin = isAdmin(member);
  if (!superAdmin && !brokerRole) return null;

  const basePrefix = brokerRole && !brokerRole.isSuper
    ? `STAFF${brokerRole.brokerId}`
    : 'ADMIN';
  let candidate = `${basePrefix}_${member.id.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()}`;
  const conflict = await storage.first('SELECT member_id FROM affiliate_partners WHERE code = ?', candidate);
  if (conflict) {
    candidate = `${basePrefix}_${randomUUID().slice(0, 5).toUpperCase()}`;
  }

  const now = new Date().toISOString();
  await storage.run(
    `INSERT OR IGNORE INTO affiliate_partners
      (member_id, code, commission_rate_pct, status, payout_note, created_by, created_at, updated_at)
     VALUES (?, ?, ?, 'active', '', ?, ?, ?)`,
    member.id, candidate, DEFAULT_COMMISSION_RATE_PCT, member.id, now, now
  );
  return storage.first('SELECT * FROM affiliate_partners WHERE member_id = ?', member.id);
}

export async function createOrUpdateAffiliatePartner(admin, {
  memberId,
  code,
  commissionRatePct = DEFAULT_COMMISSION_RATE_PCT,
  status = 'active',
  payoutNote = '',
} = {}) {
  if (!isAdmin(admin)) throw new Error('FORBIDDEN');
  const cleanMemberId = String(memberId ?? '').trim();
  if (!cleanMemberId) throw new Error('INVALID_MEMBER_ID');
  const target = await storage.first('SELECT id, display_name FROM members WHERE id = ?', cleanMemberId);
  if (!target) throw new Error('MEMBER_NOT_FOUND');

  const cleanCode = normalizeReferralCode(code);
  if (!cleanCode) throw new Error('INVALID_REFERRAL_CODE');
  const rate = Number(commissionRatePct);
  if (!Number.isFinite(rate) || rate < 1 || rate > 80) throw new Error('INVALID_COMMISSION_RATE');
  if (!['active', 'paused'].includes(status)) throw new Error('INVALID_STATUS');

  const existingByCode = await storage.first('SELECT member_id FROM affiliate_partners WHERE code = ?', cleanCode);
  if (existingByCode && existingByCode.member_id !== cleanMemberId) {
    throw new Error('REFERRAL_CODE_TAKEN');
  }

  const now = new Date().toISOString();
  const safeRate = Math.round(rate * 100) / 100;
  const safeNote = String(payoutNote ?? '').trim().slice(0, 200);

  await storage.run(
    `INSERT INTO affiliate_partners
      (member_id, code, commission_rate_pct, status, payout_note, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(member_id) DO UPDATE SET
       code = excluded.code,
       commission_rate_pct = excluded.commission_rate_pct,
       status = excluded.status,
       payout_note = excluded.payout_note,
       updated_at = excluded.updated_at`,
    cleanMemberId, cleanCode, safeRate, status, safeNote, admin.id, now, now
  );

  return storage.first(
    `SELECT ap.*, m.display_name AS partner_name
     FROM affiliate_partners ap
     JOIN members m ON m.id = ap.member_id
     WHERE ap.member_id = ?`,
    cleanMemberId
  );
}

/**
 * Bind first-touch referral attribution to a member before they hold any paid subscription.
 */
export async function attributeReferralToMember(memberId, rawCode) {
  if (!memberId) return { attributed: false, reason: 'MEMBER_REQUIRED' };
  const partner = await findActiveAffiliateByCode(rawCode);
  if (!partner) return { attributed: false, reason: 'INVALID_OR_INACTIVE_CODE' };
  if (partner.member_id === memberId) return { attributed: false, reason: 'SELF_REFERRAL_BLOCKED' };

  const member = await storage.first(
    'SELECT id, referred_by_code, subscription_ends_at FROM members WHERE id = ?',
    memberId
  );
  if (!member) return { attributed: false, reason: 'MEMBER_NOT_FOUND' };
  if (member.referred_by_code) return { attributed: false, reason: 'ALREADY_ATTRIBUTED' };

  const existingSub = await storage.first(
    "SELECT subscription_id FROM billing_subscriptions WHERE member_id = ? AND status IN ('active','past_due','canceled') LIMIT 1",
    memberId
  );
  if (existingSub || (member.subscription_ends_at && Date.parse(member.subscription_ends_at) > Date.now())) {
    return { attributed: false, reason: 'EXISTING_SUBSCRIBER' };
  }

  const now = new Date().toISOString();
  const res = await storage.run(
    `UPDATE members
     SET referred_by_code = ?, referred_by_member_id = ?, referred_at = ?
     WHERE id = ? AND referred_by_code IS NULL`,
    partner.code, partner.member_id, now, memberId
  );
  return {
    attributed: Boolean(res?.changes),
    code: partner.code,
    affiliateMemberId: partner.member_id,
  };
}

/**
 * Record 30% affiliate commission idempotently on verified paid Stripe invoice.
 */
export async function recordStripeAffiliateCommission({
  memberId,
  planId,
  interval = 'month',
  invoiceId,
  eventId,
  grossAmountSatang,
}) {
  if (!memberId || !invoiceId || !Number.isFinite(grossAmountSatang) || grossAmountSatang <= 0) {
    return { recorded: false, reason: 'MISSING_FIELDS' };
  }
  const member = await storage.first(
    'SELECT id, referred_by_code, referred_by_member_id FROM members WHERE id = ?',
    memberId
  );
  if (!member?.referred_by_member_id) return { recorded: false, reason: 'NO_REFERRER' };

  const partner = await storage.first(
    "SELECT * FROM affiliate_partners WHERE member_id = ? AND status = 'active'",
    member.referred_by_member_id
  );
  if (!partner) return { recorded: false, reason: 'PARTNER_INACTIVE' };

  const grossThb = Math.round(grossAmountSatang) / 100;
  const ratePct = Number(partner.commission_rate_pct ?? DEFAULT_COMMISSION_RATE_PCT);
  const commissionThb = Math.round(grossThb * ratePct) / 100;
  const now = new Date().toISOString();
  const id = `affc_${randomUUID()}`;

  const res = await storage.run(
    `INSERT OR IGNORE INTO affiliate_commissions
      (id, affiliate_member_id, referred_member_id, referral_code, plan_id, interval, invoice_id, stripe_event_id, gross_amount_thb, commission_rate_pct, commission_thb, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    id,
    partner.member_id,
    member.id,
    member.referred_by_code || partner.code,
    String(planId || 'pro'),
    String(interval || 'month'),
    String(invoiceId),
    String(eventId || invoiceId),
    grossThb,
    ratePct,
    commissionThb,
    now
  );

  return {
    recorded: Boolean(res?.changes),
    affiliateMemberId: partner.member_id,
    referralCode: partner.code,
    grossThb,
    commissionThb,
  };
}

export async function recordManualAffiliateCommission(admin, {
  referredMemberId,
  grossAmountThb,
  planId = 'pro',
  interval = 'month',
  note = '',
} = {}) {
  if (!isAdmin(admin)) throw new Error('FORBIDDEN');
  const gross = Number(grossAmountThb);
  if (!Number.isFinite(gross) || gross <= 0 || gross > 1_000_000) throw new Error('INVALID_AMOUNT');
  const member = await storage.first(
    'SELECT id, referred_by_code, referred_by_member_id FROM members WHERE id = ?',
    String(referredMemberId ?? '').trim()
  );
  if (!member?.referred_by_member_id) throw new Error('NO_REFERRER');

  const partner = await storage.first('SELECT * FROM affiliate_partners WHERE member_id = ?', member.referred_by_member_id);
  if (!partner) throw new Error('PARTNER_NOT_FOUND');

  const ratePct = Number(partner.commission_rate_pct ?? DEFAULT_COMMISSION_RATE_PCT);
  const commissionThb = Math.round(gross * ratePct) / 100;
  const now = new Date().toISOString();
  const id = `affc_${randomUUID()}`;
  const manualRef = `manual_${randomUUID()}`;

  await storage.run(
    `INSERT INTO affiliate_commissions
      (id, affiliate_member_id, referred_member_id, referral_code, plan_id, interval, invoice_id, stripe_event_id, gross_amount_thb, commission_rate_pct, commission_thb, status, payout_note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    id, partner.member_id, member.id, member.referred_by_code || partner.code,
    String(planId), String(interval), manualRef, manualRef,
    Math.round(gross * 100) / 100, ratePct, commissionThb, String(note ?? '').trim().slice(0, 180), now
  );
  return storage.first('SELECT * FROM affiliate_commissions WHERE id = ?', id);
}

export async function markAffiliateCommissionStatus(admin, commissionId, { status, payoutNote = '' } = {}) {
  if (!isAdmin(admin)) throw new Error('FORBIDDEN');
  if (!['paid', 'cancelled', 'pending'].includes(status)) throw new Error('INVALID_STATUS');
  const cleanId = String(commissionId ?? '').trim();
  const existing = await storage.first('SELECT * FROM affiliate_commissions WHERE id = ?', cleanId);
  if (!existing) throw new Error('COMMISSION_NOT_FOUND');

  const now = new Date().toISOString();
  const paidAt = status === 'paid' ? now : null;
  const paidBy = status === 'paid' ? admin.id : null;
  const safeNote = String(payoutNote ?? existing.payout_note ?? '').trim().slice(0, 200);

  await storage.run(
    `UPDATE affiliate_commissions
     SET status = ?, payout_note = ?, paid_at = ?, paid_by = ?
     WHERE id = ?`,
    status, safeNote, paidAt, paidBy, cleanId
  );
  return storage.first('SELECT * FROM affiliate_commissions WHERE id = ?', cleanId);
}

export async function listAffiliateDashboard(actor) {
  if (!actor?.id) throw new Error('FORBIDDEN');
  const superAdmin = isAdmin(actor);
  const myPartner = (await ensureStaffAffiliatePartner(actor)) ?? (await getAffiliateProfile(actor));
  if (!superAdmin && !myPartner) throw new Error('FORBIDDEN');

  const partnerFilterSql = superAdmin ? '' : 'WHERE ap.member_id = ?';
  const partnerArgs = superAdmin ? [] : [actor.id];

  const partners = await storage.all(
    `SELECT ap.*, m.display_name AS partner_name,
      (SELECT COUNT(*) FROM members rm WHERE rm.referred_by_member_id = ap.member_id) AS referred_count,
      (SELECT COUNT(DISTINCT rm.id) FROM members rm
       LEFT JOIN billing_subscriptions bs ON bs.member_id = rm.id AND bs.status IN ('active','past_due')
       WHERE rm.referred_by_member_id = ap.member_id
         AND (bs.subscription_id IS NOT NULL OR rm.subscription_ends_at > ?)) AS active_subscribers,
      COALESCE((SELECT SUM(ac.gross_amount_thb) FROM affiliate_commissions ac WHERE ac.affiliate_member_id = ap.member_id AND ac.status <> 'cancelled'), 0) AS total_gross_thb,
      COALESCE((SELECT SUM(ac.commission_thb) FROM affiliate_commissions ac WHERE ac.affiliate_member_id = ap.member_id AND ac.status = 'pending'), 0) AS pending_commission_thb,
      COALESCE((SELECT SUM(ac.commission_thb) FROM affiliate_commissions ac WHERE ac.affiliate_member_id = ap.member_id AND ac.status = 'paid'), 0) AS paid_commission_thb
     FROM affiliate_partners ap
     JOIN members m ON m.id = ap.member_id
     ${partnerFilterSql}
     ORDER BY total_gross_thb DESC, ap.created_at DESC`,
    new Date().toISOString(),
    ...partnerArgs
  );

  const commWhere = superAdmin ? '' : 'WHERE ac.affiliate_member_id = ?';
  const commArgs = superAdmin ? [] : [actor.id];
  const commissions = await storage.all(
    `SELECT ac.*,
      pm.display_name AS partner_name,
      rm.display_name AS customer_name
     FROM affiliate_commissions ac
     JOIN members pm ON pm.id = ac.affiliate_member_id
     JOIN members rm ON rm.id = ac.referred_member_id
     ${commWhere}
     ORDER BY ac.created_at DESC
     LIMIT 100`,
    ...commArgs
  );

  const refWhere = superAdmin ? 'WHERE rm.referred_by_member_id IS NOT NULL' : 'WHERE rm.referred_by_member_id = ?';
  const refArgs = superAdmin ? [] : [actor.id];
  const referrals = await storage.all(
    `SELECT rm.id, rm.display_name, rm.referred_by_code, rm.referred_at, rm.subscription_ends_at,
      bs.plan_id AS stripe_plan_id, bs.status AS stripe_status, bs.paid_until AS stripe_paid_until,
      pm.display_name AS partner_name
     FROM members rm
     LEFT JOIN members pm ON pm.id = rm.referred_by_member_id
     LEFT JOIN billing_subscriptions bs ON bs.member_id = rm.id AND bs.status IN ('active','past_due')
     ${refWhere}
     ORDER BY rm.referred_at DESC
     LIMIT 60`,
    ...refArgs
  );

  const candidates = superAdmin
    ? await storage.all(
        `SELECT m.id, m.display_name, m.line_id, ap.code AS existing_code
         FROM members m
         LEFT JOIN affiliate_partners ap ON ap.member_id = m.id
         WHERE m.line_id NOT LIKE 'Udemo_%'
         ORDER BY m.created_at DESC
         LIMIT 50`
      )
    : [];

  return {
    isSuper: superAdmin,
    myPartner,
    summary: {
      partnerCount: partners.length,
      referredTotal: partners.reduce((s, p) => s + Number(p.referred_count || 0), 0),
      activeSubscribers: partners.reduce((s, p) => s + Number(p.active_subscribers || 0), 0),
      totalGrossThb: Math.round(partners.reduce((s, p) => s + Number(p.total_gross_thb || 0), 0) * 100) / 100,
      pendingCommissionThb: Math.round(partners.reduce((s, p) => s + Number(p.pending_commission_thb || 0), 0) * 100) / 100,
      paidCommissionThb: Math.round(partners.reduce((s, p) => s + Number(p.paid_commission_thb || 0), 0) * 100) / 100,
    },
    partners,
    commissions,
    referrals,
    candidates,
  };
}
