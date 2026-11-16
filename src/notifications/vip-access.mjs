import { storage, operation as op } from '../storage/database.mjs';
import { withBilling } from '../billing/store.mjs';
import { isAdmin as defaultIsAdmin } from '../membership/store.mjs';
import { membershipFor as defaultMembershipFor } from '../membership/rights.mjs';
import {
  approveTelegramJoinRequest,
  createTelegramInviteLink,
  declineTelegramJoinRequest,
  kickTelegramChatMember,
  revokeTelegramInviteLink,
} from './broadcaster.mjs';

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

let tablesInitialized = null;
export async function ensureTelegramVipTables(db = storage) {
  if (db !== storage) return;
  if (!tablesInitialized) {
    tablesInitialized = (async () => {
      await db.run(`CREATE TABLE IF NOT EXISTS telegram_vip_invites (
        invite_link TEXT PRIMARY KEY,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined','revoked','expired')),
        telegram_user_id TEXT,
        telegram_username TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        resolved_at TEXT
      )`);
      await db.run(`CREATE TABLE IF NOT EXISTS telegram_vip_members (
        member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL,
        telegram_user_id TEXT NOT NULL UNIQUE,
        telegram_username TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','kicked')),
        joined_at TEXT NOT NULL,
        kicked_at TEXT,
        kick_reason TEXT,
        updated_at TEXT NOT NULL
      )`);
    })().catch((err) => {
      tablesInitialized = null;
      throw err;
    });
  }
  return tablesInitialized;
}

export function isVipMembershipActive(member, { checkIsAdmin = defaultIsAdmin, checkMembership = defaultMembershipFor } = {}) {
  if (!member) return false;
  if (checkIsAdmin(member)) return true;
  const rights = checkMembership(member);
  return Boolean(rights.capabilities?.telegramVip);
}

export async function issueMemberJoinRequestInvite({
  member,
  token,
  chatId,
  name,
  now = Date.now(),
  createInvite = createTelegramInviteLink,
  db = storage,
} = {}) {
  if (!member?.id) {
    throw Object.assign(new Error('MEMBER_REQUIRED'), { code: 'MEMBER_REQUIRED' });
  }
  await ensureTelegramVipTables(db);
  const createdAt = new Date(now).toISOString();
  const expiresAtMs = now + INVITE_TTL_MS;
  const expiresAt = new Date(expiresAtMs).toISOString();
  const linkName = (name || `VIP · ${member.display_name || member.id}`).slice(0, 32);

  const created = await createInvite({
    token,
    chatId,
    name: linkName,
    createsJoinRequest: true,
    expireDate: expiresAtMs,
  });

  if (created?.inviteLink) {
    await db.run(
      `INSERT INTO telegram_vip_invites (invite_link, member_id, chat_id, status, created_at, expires_at)
       VALUES (?, ?, ?, 'pending', ?, ?)
       ON CONFLICT(invite_link) DO UPDATE SET member_id=excluded.member_id, chat_id=excluded.chat_id, status='pending', created_at=excluded.created_at, expires_at=excluded.expires_at, resolved_at=NULL`,
      created.inviteLink,
      member.id,
      String(chatId),
      createdAt,
      expiresAt
    );
  }

  return {
    inviteLink: created.inviteLink,
    name: created.name || linkName,
    requiresApproval: true,
    expiresAt,
  };
}

export async function handleTelegramWebhookUpdate(
  update,
  {
    env = process.env,
    now = Date.now(),
    db = storage,
    withMemberBilling = withBilling,
    checkIsAdmin = defaultIsAdmin,
    checkMembership = defaultMembershipFor,
    approveJoin = approveTelegramJoinRequest,
    declineJoin = declineTelegramJoinRequest,
    revokeInvite = revokeTelegramInviteLink,
  } = {}
) {
  const joinReq = update?.chat_join_request;
  if (!joinReq) {
    return { handled: false, reason: 'NO_JOIN_REQUEST' };
  }

  const token = env.TELEGRAM_BOT_TOKEN;
  const configuredChatId = String(env.TELEGRAM_CHAT_ID || '').trim();
  const chatId = String(joinReq.chat?.id ?? '');
  const telegramUserId = String(joinReq.from?.id ?? '').trim();
  const telegramUsername = joinReq.from?.username || joinReq.from?.first_name || null;
  const inviteLink = joinReq.invite_link?.invite_link || '';

  if (!token || !configuredChatId || chatId !== configuredChatId || !telegramUserId) {
    return { handled: false, reason: 'CHAT_MISMATCH_OR_UNCONFIGURED' };
  }

  await ensureTelegramVipTables(db);
  const nowIso = new Date(now).toISOString();

  async function rejectRequest(reason, existingStatus = null) {
    await declineJoin({ token, chatId, userId: telegramUserId }).catch(() => {});
    if (inviteLink) {
      await revokeInvite({ token, chatId, inviteLink }).catch(() => {});
      if (existingStatus === 'pending') {
        await db.run(
          `UPDATE telegram_vip_invites SET status=?, telegram_user_id=?, telegram_username=?, resolved_at=? WHERE invite_link=?`,
          reason === 'INVITE_EXPIRED' ? 'expired' : 'declined',
          telegramUserId,
          telegramUsername,
          nowIso,
          inviteLink
        );
      }
    }
    return { handled: true, decision: 'declined', reason, telegramUserId };
  }

  if (!inviteLink) {
    return rejectRequest('MISSING_INVITE_LINK');
  }

  const invite = await db.first('SELECT * FROM telegram_vip_invites WHERE invite_link = ?', inviteLink);
  if (!invite || invite.status !== 'pending') {
    return rejectRequest('INVITE_INVALID_OR_USED');
  }

  if (Date.parse(invite.expires_at) <= now) {
    return rejectRequest('INVITE_EXPIRED', 'pending');
  }

  const rawMember = await db.first('SELECT * FROM members WHERE id = ?', invite.member_id);
  const member = rawMember ? await withMemberBilling(rawMember) : null;
  if (!isVipMembershipActive(member, { checkIsAdmin, checkMembership })) {
    return rejectRequest('MEMBERSHIP_INACTIVE', 'pending');
  }

  // Re-bind telegram_user_id cleanly in case a user switches LINE/member accounts.
  if (db === storage && typeof db.batch === 'function') {
    await db.batch([
      op('DELETE FROM telegram_vip_members WHERE telegram_user_id = ? AND member_id != ?', telegramUserId, member.id),
      op(
        `INSERT INTO telegram_vip_members (member_id, chat_id, telegram_user_id, telegram_username, status, joined_at, kicked_at, kick_reason, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, NULL, NULL, ?)
         ON CONFLICT(member_id) DO UPDATE SET chat_id=excluded.chat_id, telegram_user_id=excluded.telegram_user_id, telegram_username=excluded.telegram_username, status='active', joined_at=excluded.joined_at, kicked_at=NULL, kick_reason=NULL, updated_at=excluded.updated_at`,
        member.id,
        chatId,
        telegramUserId,
        telegramUsername,
        nowIso,
        nowIso
      ),
      op(
        `UPDATE telegram_vip_invites SET status='approved', telegram_user_id=?, telegram_username=?, resolved_at=? WHERE invite_link=?`,
        telegramUserId,
        telegramUsername,
        nowIso,
        inviteLink
      ),
    ]);
  } else {
    await db.run('DELETE FROM telegram_vip_members WHERE telegram_user_id = ? AND member_id != ?', telegramUserId, member.id);
    await db.run(
      `INSERT INTO telegram_vip_members (member_id, chat_id, telegram_user_id, telegram_username, status, joined_at, kicked_at, kick_reason, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, NULL, NULL, ?)
       ON CONFLICT(member_id) DO UPDATE SET chat_id=excluded.chat_id, telegram_user_id=excluded.telegram_user_id, telegram_username=excluded.telegram_username, status='active', joined_at=excluded.joined_at, kicked_at=NULL, kick_reason=NULL, updated_at=excluded.updated_at`,
      member.id,
      chatId,
      telegramUserId,
      telegramUsername,
      nowIso,
      nowIso
    );
    await db.run(
      `UPDATE telegram_vip_invites SET status='approved', telegram_user_id=?, telegram_username=?, resolved_at=? WHERE invite_link=?`,
      telegramUserId,
      telegramUsername,
      nowIso,
      inviteLink
    );
  }

  await approveJoin({ token, chatId, userId: telegramUserId });
  await revokeInvite({ token, chatId, inviteLink }).catch(() => {});

  return { handled: true, decision: 'approved', memberId: member.id, telegramUserId };
}

export async function getTelegramVipTrackingSummary({
  db = storage,
  withMemberBilling = withBilling,
  checkIsAdmin = defaultIsAdmin,
  checkMembership = defaultMembershipFor,
} = {}) {
  await ensureTelegramVipTables(db);
  const rows = await db.all(
    `SELECT v.member_id, v.chat_id, v.telegram_user_id, v.telegram_username, v.joined_at,
            m.id AS m_id, m.line_id, m.display_name, m.trial_ends_at, m.subscription_ends_at
     FROM telegram_vip_members v
     JOIN members m ON m.id = v.member_id
     WHERE v.status = 'active'`
  );

  const expired = [];
  for (const row of rows) {
    const member = await withMemberBilling({
      id: row.m_id,
      line_id: row.line_id,
      display_name: row.display_name,
      trial_ends_at: row.trial_ends_at,
      subscription_ends_at: row.subscription_ends_at,
    });
    if (!isVipMembershipActive(member, { checkIsAdmin, checkMembership })) {
      const rights = checkMembership(member);
      expired.push({
        memberId: row.member_id,
        chatId: row.chat_id,
        telegramUserId: row.telegram_user_id,
        telegramUsername: row.telegram_username,
        displayName: row.display_name,
        tier: rights.tier,
      });
    }
  }

  return {
    activeTrackedCount: rows.length,
    expiredCount: expired.length,
    expiredMembers: expired,
  };
}

export async function kickExpiredTelegramVipMembers({
  env = process.env,
  now = Date.now(),
  db = storage,
  withMemberBilling = withBilling,
  checkIsAdmin = defaultIsAdmin,
  checkMembership = defaultMembershipFor,
  kickMember = kickTelegramChatMember,
} = {}) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const fallbackChatId = env.TELEGRAM_CHAT_ID;
  const summary = await getTelegramVipTrackingSummary({ db, withMemberBilling, checkIsAdmin, checkMembership });
  const nowIso = new Date(now).toISOString();

  const kicked = [];
  const failed = [];

  for (const entry of summary.expiredMembers) {
    const targetChatId = entry.chatId || fallbackChatId;
    if (!token || !targetChatId) {
      failed.push(entry.telegramUserId);
      continue;
    }
    try {
      await kickMember({ token, chatId: targetChatId, userId: entry.telegramUserId });
      await db.run(
        `UPDATE telegram_vip_members SET status='kicked', kicked_at=?, kick_reason='MEMBERSHIP_EXPIRED', updated_at=? WHERE member_id=?`,
        nowIso,
        nowIso,
        entry.memberId
      );
      kicked.push(entry.telegramUserId);
    } catch {
      failed.push(entry.telegramUserId);
    }
  }

  return {
    ok: true,
    checkedCount: summary.activeTrackedCount,
    expiredCount: summary.expiredCount,
    kickedCount: kicked.length,
    kicked,
    failed,
  };
}

export async function kickMemberFromVipIfExpired(
  memberId,
  {
    env = process.env,
    now = Date.now(),
    db = storage,
    withMemberBilling = withBilling,
    checkIsAdmin = defaultIsAdmin,
    checkMembership = defaultMembershipFor,
    kickMember = kickTelegramChatMember,
    reason = 'SUBSCRIPTION_ENDED',
  } = {}
) {
  if (!memberId || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return { skipped: true };
  await ensureTelegramVipTables(db);
  const tracked = await db.first(`SELECT * FROM telegram_vip_members WHERE member_id = ? AND status = 'active'`, memberId);
  if (!tracked) return { skipped: true };

  const rawMember = await db.first('SELECT * FROM members WHERE id = ?', memberId);
  const member = rawMember ? await withMemberBilling(rawMember) : null;
  if (isVipMembershipActive(member, { checkIsAdmin, checkMembership })) {
    return { skipped: true, reason: 'STILL_ACTIVE' };
  }

  await kickMember({ token: env.TELEGRAM_BOT_TOKEN, chatId: tracked.chat_id || env.TELEGRAM_CHAT_ID, userId: tracked.telegram_user_id });
  const nowIso = new Date(now).toISOString();
  await db.run(
    `UPDATE telegram_vip_members SET status='kicked', kicked_at=?, kick_reason=?, updated_at=? WHERE member_id=?`,
    nowIso,
    reason,
    nowIso,
    memberId
  );
  return { kicked: true, telegramUserId: tracked.telegram_user_id };
}

export async function kickInactivePartnerBrokerMembers({
  inactivityDays = 30,
  minMonthlyVolumeThb = 1_000,
  requireMinVolume = false,
  volumeMonth = null,
  graceDays = 0,
  dryRun = false,
  env = process.env,
  now = Date.now(),
  db = storage,
  withMemberBilling = withBilling,
  checkIsAdmin = defaultIsAdmin,
  kickMember = kickTelegramChatMember,
} = {}) {
  await ensureTelegramVipTables(db);
  const days = Math.max(1, Math.min(365, Math.floor(Number(inactivityDays) || 30)));
  const grace = Math.max(0, Math.min(365, Math.floor(Number(graceDays) || 0)));
  const defaultTarget = Math.max(0, Math.floor(Number(minMonthlyVolumeThb) || 1_000));
  const activeMonth = (typeof volumeMonth === 'string' && /^\d{4}-\d{2}$/.test(volumeMonth))
    ? volumeMonth
    : new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 7);
  const nowIso = new Date(now).toISOString();
  const cutoffIso = new Date(now - days * 86400000).toISOString();
  const graceCutoffIso = grace > 0 ? new Date(now - grace * 86400000).toISOString() : null;
  const token = env.TELEGRAM_BOT_TOKEN;
  const fallbackChatId = env.TELEGRAM_CHAT_ID;

  const rows = await db.all(
    `SELECT m.*, v.chat_id AS vip_chat_id, v.telegram_user_id, v.telegram_username, v.status AS vip_status
     FROM members m
     LEFT JOIN telegram_vip_members v ON v.member_id = m.id AND v.status = 'active'
     WHERE m.subscription_ends_at IS NOT NULL AND m.subscription_ends_at > ?`,
    nowIso
  );

  const inactiveMembers = [];
  for (const row of rows) {
    if (checkIsAdmin(row)) continue;
    const billed = await withMemberBilling(row);
    const hasStripePaid = Boolean(
      billed?.billing?.plan_id &&
      ['active', 'past_due'].includes(billed.billing.status) &&
      Date.parse(billed.billing.paid_until) > now
    );
    if (hasStripePaid) continue;

    const lastActivity = row.broker_last_trade_at || row.portfolio_verified_at || row.portfolio_submitted_at || row.created_at;
    const isInactive = Boolean(lastActivity && Date.parse(lastActivity) <= Date.parse(cutoffIso));

    const targetThb = Math.max(0, Number(row.broker_volume_target_thb) || defaultTarget);
    const rowMonth = row.broker_volume_month || null;
    const monthlyVolumeThb = rowMonth === activeMonth ? Math.max(0, Number(row.broker_monthly_volume_thb) || 0) : 0;
    const verifiedOrCreated = row.portfolio_verified_at || row.portfolio_submitted_at || row.created_at;
    const insideGrace = Boolean(graceCutoffIso && verifiedOrCreated && Date.parse(verifiedOrCreated) > Date.parse(graceCutoffIso));
    const isUnderVolume = Boolean(requireMinVolume && !insideGrace && monthlyVolumeThb < targetThb);

    if (!isInactive && !isUnderVolume) continue;

    const reason = isInactive ? 'NO_TRADING_ACTIVITY' : 'VOLUME_BELOW_TARGET';

    inactiveMembers.push({
      memberId: row.id,
      displayName: row.display_name,
      broker: row.broker,
      reason,
      lastActivityAt: lastActivity,
      monthlyVolumeThb,
      targetThb,
      deficitThb: Math.max(0, targetThb - monthlyVolumeThb),
      volumeMonth: activeMonth,
      telegramUserId: row.telegram_user_id || null,
      chatId: row.vip_chat_id || fallbackChatId || null,
    });
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      inactivityDays: days,
      requireMinVolume: Boolean(requireMinVolume),
      minMonthlyVolumeThb: defaultTarget,
      volumeMonth: activeMonth,
      graceDays: grace,
      cutoffAt: cutoffIso,
      matchedCount: inactiveMembers.length,
      revokedCount: 0,
      kickedCount: 0,
      candidates: inactiveMembers,
      kicked: [],
      failed: [],
    };
  }

  const revoked = [];
  const kicked = [];
  const failed = [];

  for (const entry of inactiveMembers) {
    try {
      await db.run(
        `UPDATE members
         SET subscription_ends_at = ?, vip_revoked_reason = ?, vip_revoked_at = ?, updated_at = ?
         WHERE id = ?`,
        nowIso,
        entry.reason,
        nowIso,
        nowIso,
        entry.memberId
      );
      revoked.push(entry.memberId);
      if (entry.telegramUserId && token && entry.chatId) {
        await kickMember({ token, chatId: entry.chatId, userId: entry.telegramUserId });
        await db.run(
          `UPDATE telegram_vip_members SET status='kicked', kicked_at=?, kick_reason=?, updated_at=? WHERE member_id=?`,
          nowIso,
          entry.reason,
          nowIso,
          entry.memberId
        );
        kicked.push(entry.telegramUserId);
      }
    } catch {
      failed.push(entry.telegramUserId || entry.memberId);
    }
  }

  return {
    ok: true,
    dryRun: false,
    inactivityDays: days,
    requireMinVolume: Boolean(requireMinVolume),
    minMonthlyVolumeThb: defaultTarget,
    volumeMonth: activeMonth,
    graceDays: grace,
    cutoffAt: cutoffIso,
    matchedCount: inactiveMembers.length,
    revokedCount: revoked.length,
    kickedCount: kicked.length,
    revoked,
    kicked,
    failed,
  };
}

