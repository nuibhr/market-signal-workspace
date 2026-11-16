import test from 'node:test';
import assert from 'node:assert/strict';
import {
  issueMemberJoinRequestInvite,
  handleTelegramWebhookUpdate,
  kickExpiredTelegramVipMembers,
  kickMemberFromVipIfExpired,
  kickInactivePartnerBrokerMembers,
} from './vip-access.mjs';

function makeMockDb(initial = {}) {
  const invites = new Map(Object.entries(initial.invites || {}));
  const vipMembers = new Map(Object.entries(initial.vipMembers || {}));
  const members = new Map(Object.entries(initial.members || {}));

  return {
    invites,
    vipMembers,
    members,
    async first(sql, ...args) {
      if (sql.includes('FROM telegram_vip_invites WHERE invite_link')) {
        return invites.get(args[0]) || null;
      }
      if (sql.includes('FROM members WHERE id')) {
        return members.get(args[0]) || null;
      }
      if (sql.includes("FROM telegram_vip_members WHERE member_id = ? AND status = 'active'")) {
        const row = vipMembers.get(args[0]);
        return row?.status === 'active' ? row : null;
      }
      return null;
    },
    async all(sql, ...args) {
      if (sql.includes('FROM telegram_vip_members v')) {
        return [...vipMembers.values()]
          .filter((v) => v.status === 'active')
          .map((v) => {
            const m = members.get(v.member_id);
            return m
              ? {
                  ...v,
                  m_id: m.id,
                  line_id: m.line_id,
                  display_name: m.display_name,
                  trial_ends_at: m.trial_ends_at,
                  subscription_ends_at: m.subscription_ends_at,
                }
              : null;
          })
          .filter(Boolean);
      }
      if (sql.includes('FROM members m')) {
        const nowIso = args[0];
        return [...members.values()]
          .filter((m) => m.subscription_ends_at && m.subscription_ends_at > nowIso)
          .map((m) => {
            const v = vipMembers.get(m.id);
            const activeVip = v?.status === 'active' ? v : null;
            return {
              ...m,
              vip_chat_id: activeVip?.chat_id || null,
              telegram_user_id: activeVip?.telegram_user_id || null,
              telegram_username: activeVip?.telegram_username || null,
              vip_status: activeVip?.status || null,
            };
          });
      }
      return [];
    },
    async run(sql, ...args) {
      if (sql.includes('INSERT INTO telegram_vip_invites')) {
        const [invite_link, member_id, chat_id, created_at, expires_at] = args;
        invites.set(invite_link, { invite_link, member_id, chat_id, status: 'pending', created_at, expires_at, resolved_at: null });
        return { changes: 1 };
      }
      if (sql.includes('UPDATE telegram_vip_invites SET status=?')) {
        const [status, telegram_user_id, telegram_username, resolved_at, invite_link] = args;
        const row = invites.get(invite_link);
        if (row) invites.set(invite_link, { ...row, status, telegram_user_id, telegram_username, resolved_at });
        return { changes: row ? 1 : 0 };
      }
      if (sql.includes("UPDATE telegram_vip_invites SET status='approved'")) {
        const [telegram_user_id, telegram_username, resolved_at, invite_link] = args;
        const row = invites.get(invite_link);
        if (row) invites.set(invite_link, { ...row, status: 'approved', telegram_user_id, telegram_username, resolved_at });
        return { changes: row ? 1 : 0 };
      }
      if (sql.includes('DELETE FROM telegram_vip_members WHERE telegram_user_id')) {
        const [tgId, keepMemberId] = args;
        for (const [mid, row] of vipMembers.entries()) {
          if (row.telegram_user_id === tgId && mid !== keepMemberId) vipMembers.delete(mid);
        }
        return { changes: 1 };
      }
      if (sql.includes('INSERT INTO telegram_vip_members')) {
        const [member_id, chat_id, telegram_user_id, telegram_username, joined_at, updated_at] = args;
        vipMembers.set(member_id, { member_id, chat_id, telegram_user_id, telegram_username, status: 'active', joined_at, kicked_at: null, kick_reason: null, updated_at });
        return { changes: 1 };
      }
      if (sql.includes("vip_revoked_reason = ?") || sql.includes("vip_revoked_reason = 'NO_TRADING_ACTIVITY'")) {
        const hasReason = args.length === 5;
        const subEnd = args[0];
        const vipRevokedReason = hasReason ? args[1] : 'NO_TRADING_ACTIVITY';
        const revokedAt = hasReason ? args[2] : args[1];
        const updatedAt = hasReason ? args[3] : args[2];
        const memberId = hasReason ? args[4] : args[3];
        const m = members.get(memberId);
        if (m) members.set(memberId, { ...m, subscription_ends_at: subEnd, vip_revoked_reason: vipRevokedReason, vip_revoked_at: revokedAt, updated_at: updatedAt });
        return { changes: m ? 1 : 0 };
      }
      if (sql.includes("UPDATE telegram_vip_members SET status='kicked'")) {
        const hasReason = args.length === 4;
        const kicked_at = args[0];
        const kick_reason = hasReason ? args[1] : (sql.includes("'NO_TRADING_ACTIVITY'") ? 'NO_TRADING_ACTIVITY' : 'MEMBERSHIP_EXPIRED');
        const updated_at = hasReason ? args[2] : args[1];
        const member_id = hasReason ? args[3] : args[2];
        const row = vipMembers.get(member_id);
        if (row) vipMembers.set(member_id, { ...row, status: 'kicked', kicked_at, kick_reason, updated_at });
        return { changes: row ? 1 : 0 };
      }
      return { changes: 0 };
    },
  };
}

const env = { TELEGRAM_BOT_TOKEN: 'bot-token', TELEGRAM_CHAT_ID: '-1004434206194' };
const now = Date.parse('2026-11-13T10:00:00Z');

test('issueMemberJoinRequestInvite creates createsJoinRequest invite and stores pending mapping', async () => {
  const db = makeMockDb();
  const captured = [];
  const res = await issueMemberJoinRequestInvite({
    member: { id: 'mem-1', display_name: 'Nui' },
    token: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID,
    now,
    db,
    createInvite: async (opts) => {
      captured.push(opts);
      return { inviteLink: 'https://t.me/+joinReq1', name: opts.name };
    },
  });

  assert.equal(res.inviteLink, 'https://t.me/+joinReq1');
  assert.equal(res.requiresApproval, true);
  assert.equal(captured[0].createsJoinRequest, true);
  assert.equal(captured[0].memberLimit, undefined);
  assert.equal(db.invites.get('https://t.me/+joinReq1').member_id, 'mem-1');
  assert.equal(db.invites.get('https://t.me/+joinReq1').status, 'pending');
});

test('handleTelegramWebhookUpdate approves active member, binds telegram_user_id, and revokes link', async () => {
  const db = makeMockDb({
    members: {
      'mem-1': { id: 'mem-1', line_id: 'U123', display_name: 'Alice', subscription_ends_at: '2026-12-01T00:00:00Z' },
    },
    invites: {
      'https://t.me/+joinReq1': {
        invite_link: 'https://t.me/+joinReq1',
        member_id: 'mem-1',
        chat_id: env.TELEGRAM_CHAT_ID,
        status: 'pending',
        expires_at: '2026-11-14T10:00:00Z',
      },
    },
  });

  const actions = [];
  const res = await handleTelegramWebhookUpdate(
    {
      chat_join_request: {
        chat: { id: -1004434206194 },
        from: { id: 99887766, username: 'alice_tg' },
        invite_link: { invite_link: 'https://t.me/+joinReq1' },
      },
    },
    {
      env,
      now,
      db,
      withMemberBilling: async (m) => m,
      checkIsAdmin: () => false,
      approveJoin: async (p) => actions.push(['approve', p.userId]),
      declineJoin: async (p) => actions.push(['decline', p.userId]),
      revokeInvite: async (p) => actions.push(['revoke', p.inviteLink]),
    }
  );

  assert.equal(res.handled, true);
  assert.equal(res.decision, 'approved');
  assert.equal(res.telegramUserId, '99887766');
  assert.deepEqual(actions, [['approve', '99887766'], ['revoke', 'https://t.me/+joinReq1']]);
  assert.equal(db.vipMembers.get('mem-1').telegram_user_id, '99887766');
  assert.equal(db.vipMembers.get('mem-1').status, 'active');
  assert.equal(db.invites.get('https://t.me/+joinReq1').status, 'approved');
});

test('handleTelegramWebhookUpdate declines expired member or reused invite link', async () => {
  const db = makeMockDb({
    members: {
      'mem-exp': { id: 'mem-exp', line_id: 'U999', display_name: 'Expired', trial_ends_at: '2026-11-01T00:00:00Z' },
    },
    invites: {
      'https://t.me/+expiredMemberLink': {
        invite_link: 'https://t.me/+expiredMemberLink',
        member_id: 'mem-exp',
        chat_id: env.TELEGRAM_CHAT_ID,
        status: 'pending',
        expires_at: '2026-11-14T10:00:00Z',
      },
    },
  });

  const declined = [];
  const res = await handleTelegramWebhookUpdate(
    {
      chat_join_request: {
        chat: { id: -1004434206194 },
        from: { id: 55443322, username: 'bob_tg' },
        invite_link: { invite_link: 'https://t.me/+expiredMemberLink' },
      },
    },
    {
      env,
      now,
      db,
      withMemberBilling: async (m) => m,
      checkIsAdmin: () => false,
      approveJoin: async () => { throw Error('should not approve'); },
      declineJoin: async (p) => declined.push(p.userId),
      revokeInvite: async () => {},
    }
  );

  assert.equal(res.decision, 'declined');
  assert.equal(res.reason, 'MEMBERSHIP_INACTIVE');
  assert.deepEqual(declined, ['55443322']);
  assert.equal(db.vipMembers.size, 0);
  assert.equal(db.invites.get('https://t.me/+expiredMemberLink').status, 'declined');
});

test('kickExpiredTelegramVipMembers kicks only expired tracked members and keeps active/admin members', async () => {
  const db = makeMockDb({
    members: {
      'mem-active': { id: 'mem-active', line_id: 'U1', display_name: 'Active', subscription_ends_at: '2099-01-01T00:00:00Z' },
      'mem-expired': { id: 'mem-expired', line_id: 'U2', display_name: 'Expired', subscription_ends_at: '2020-01-01T00:00:00Z' },
      'mem-admin': { id: 'mem-admin', line_id: 'U_ADMIN', display_name: 'Boss' },
    },
    vipMembers: {
      'mem-active': { member_id: 'mem-active', chat_id: env.TELEGRAM_CHAT_ID, telegram_user_id: '101', telegram_username: 'active', status: 'active', joined_at: '2026-10-01T00:00:00Z' },
      'mem-expired': { member_id: 'mem-expired', chat_id: env.TELEGRAM_CHAT_ID, telegram_user_id: '202', telegram_username: 'expired', status: 'active', joined_at: '2026-10-01T00:00:00Z' },
      'mem-admin': { member_id: 'mem-admin', chat_id: env.TELEGRAM_CHAT_ID, telegram_user_id: '303', telegram_username: 'boss', status: 'active', joined_at: '2026-10-01T00:00:00Z' },
    },
  });

  const kickedIds = [];
  const res = await kickExpiredTelegramVipMembers({
    env,
    now,
    db,
    withMemberBilling: async (m) => m,
    checkIsAdmin: (m) => m.line_id === 'U_ADMIN',
    kickMember: async ({ userId }) => {
      kickedIds.push(userId);
      return { kicked: true };
    },
  });

  assert.equal(res.checkedCount, 3);
  assert.equal(res.expiredCount, 1);
  assert.equal(res.kickedCount, 1);
  assert.deepEqual(kickedIds, ['202']);
  assert.equal(db.vipMembers.get('mem-expired').status, 'kicked');
  assert.equal(db.vipMembers.get('mem-active').status, 'active');
  assert.equal(db.vipMembers.get('mem-admin').status, 'active');

  // Verify single-member helper also respects active state
  const skipActive = await kickMemberFromVipIfExpired('mem-active', {
    env,
    now,
    db,
    withMemberBilling: async (m) => m,
    checkIsAdmin: () => false,
    kickMember: async () => { throw Error('should skip active'); },
  });
  assert.equal(skipActive.skipped, true);
});

test('webhook declines Trial and BASIC (starter) join requests, and approves PRO VIP & Partner VIP', async () => {
  const prevStarter = process.env.STRIPE_PRICE_STARTER_MONTHLY;
  const prevPro = process.env.STRIPE_PRICE_PRO_MONTHLY;
  process.env.STRIPE_PRICE_STARTER_MONTHLY = 'price_starter';
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro';
  try {
  const future = '2099-01-01T00:00:00Z';
  const db = makeMockDb({
    members: {
      'mem-trial': { id: 'mem-trial', line_id: 'Utrial', display_name: 'Trial User', trial_ends_at: future },
      'mem-starter': { id: 'mem-starter', line_id: 'Ubasic', display_name: 'Basic User' },
      'mem-pro': { id: 'mem-pro', line_id: 'Upro', display_name: 'Pro User' },
      'mem-partner': { id: 'mem-partner', line_id: 'Upartner', display_name: 'Partner VIP', subscription_ends_at: future },
    },
    invites: {
      'https://t.me/+trialLink': { invite_link: 'https://t.me/+trialLink', member_id: 'mem-trial', chat_id: env.TELEGRAM_CHAT_ID, status: 'pending', expires_at: future },
      'https://t.me/+basicLink': { invite_link: 'https://t.me/+basicLink', member_id: 'mem-starter', chat_id: env.TELEGRAM_CHAT_ID, status: 'pending', expires_at: future },
      'https://t.me/+proLink': { invite_link: 'https://t.me/+proLink', member_id: 'mem-pro', chat_id: env.TELEGRAM_CHAT_ID, status: 'pending', expires_at: future },
      'https://t.me/+partnerLink': { invite_link: 'https://t.me/+partnerLink', member_id: 'mem-partner', chat_id: env.TELEGRAM_CHAT_ID, status: 'pending', expires_at: future },
    },
  });

  const withMemberBilling = async (m) => {
    if (m.id === 'mem-starter') return { ...m, billing: { plan_id: 'starter', status: 'active', paid_until: future } };
    if (m.id === 'mem-pro') return { ...m, billing: { plan_id: 'pro', status: 'active', paid_until: future } };
    return m;
  };

  const approved = [];
  const declined = [];
  const runJoin = (invite_link, userId) =>
    handleTelegramWebhookUpdate(
      { chat_join_request: { chat: { id: -1004434206194 }, from: { id: userId, username: `u_${userId}` }, invite_link: { invite_link } } },
      {
        env,
        now,
        db,
        withMemberBilling,
        checkIsAdmin: () => false,
        approveJoin: async (p) => approved.push(p.userId),
        declineJoin: async (p) => declined.push(p.userId),
        revokeInvite: async () => {},
      }
    );

  assert.equal((await runJoin('https://t.me/+trialLink', 111)).decision, 'declined');
  assert.equal((await runJoin('https://t.me/+basicLink', 222)).decision, 'declined');
  assert.equal((await runJoin('https://t.me/+proLink', 333)).decision, 'approved');
  assert.equal((await runJoin('https://t.me/+partnerLink', 444)).decision, 'approved');
  assert.deepEqual(declined, ['111', '222']);
  assert.deepEqual(approved, ['333', '444']);
  } finally {
    if (prevStarter === undefined) delete process.env.STRIPE_PRICE_STARTER_MONTHLY; else process.env.STRIPE_PRICE_STARTER_MONTHLY = prevStarter;
    if (prevPro === undefined) delete process.env.STRIPE_PRICE_PRO_MONTHLY; else process.env.STRIPE_PRICE_PRO_MONTHLY = prevPro;
  }
});

test('kickInactivePartnerBrokerMembers revokes and kicks non-trading Partner VIPs while sparing traders, Stripe Pro and admins', async () => {
  const future = '2099-01-01T00:00:00Z';
  const oldDate = '2026-09-01T00:00:00Z';
  const recentDate = '2026-11-10T00:00:00Z';
  const db = makeMockDb({
    members: {
      'broker-lazy': { id: 'broker-lazy', line_id: 'Ulazy', display_name: 'No Trade', broker: 'Pi', subscription_ends_at: future, portfolio_verified_at: oldDate, broker_last_trade_at: null, created_at: oldDate },
      'broker-active': { id: 'broker-active', line_id: 'Uactive', display_name: 'Active Trader', broker: 'Trinity', subscription_ends_at: future, portfolio_verified_at: oldDate, broker_last_trade_at: recentDate, created_at: oldDate },
      'stripe-pro': { id: 'stripe-pro', line_id: 'Ustripe', display_name: 'Stripe Pro', subscription_ends_at: future, portfolio_verified_at: oldDate, created_at: oldDate },
      'admin-vip': { id: 'admin-vip', line_id: 'U_ADMIN', display_name: 'Admin', subscription_ends_at: future, created_at: oldDate },
    },
    vipMembers: {
      'broker-lazy': { member_id: 'broker-lazy', chat_id: env.TELEGRAM_CHAT_ID, telegram_user_id: '701', status: 'active' },
      'broker-active': { member_id: 'broker-active', chat_id: env.TELEGRAM_CHAT_ID, telegram_user_id: '702', status: 'active' },
      'stripe-pro': { member_id: 'stripe-pro', chat_id: env.TELEGRAM_CHAT_ID, telegram_user_id: '703', status: 'active' },
      'admin-vip': { member_id: 'admin-vip', chat_id: env.TELEGRAM_CHAT_ID, telegram_user_id: '704', status: 'active' },
    },
  });

  const withMemberBilling = async (m) =>
    m.id === 'stripe-pro' ? { ...m, billing: { plan_id: 'pro', status: 'active', paid_until: future } } : m;
  const checkIsAdmin = (m) => m.line_id === 'U_ADMIN';

  const preview = await kickInactivePartnerBrokerMembers({
    inactivityDays: 30,
    dryRun: true,
    env,
    now,
    db,
    withMemberBilling,
    checkIsAdmin,
    kickMember: async () => { throw Error('dryRun must not kick'); },
  });
  assert.equal(preview.matchedCount, 1);
  assert.equal(preview.candidates[0].memberId, 'broker-lazy');

  const kicked = [];
  const res = await kickInactivePartnerBrokerMembers({
    inactivityDays: 30,
    dryRun: false,
    env,
    now,
    db,
    withMemberBilling,
    checkIsAdmin,
    kickMember: async ({ userId }) => {
      kicked.push(userId);
      return { kicked: true };
    },
  });
  assert.equal(res.revokedCount, 1);
  assert.equal(res.kickedCount, 1);
  assert.deepEqual(kicked, ['701']);
  assert.equal(db.members.get('broker-lazy').vip_revoked_reason, 'NO_TRADING_ACTIVITY');
  assert.equal(db.vipMembers.get('broker-lazy').status, 'kicked');
  assert.equal(db.vipMembers.get('broker-lazy').kick_reason, 'NO_TRADING_ACTIVITY');
  assert.equal(db.vipMembers.get('broker-active').status, 'active');
  assert.equal(db.vipMembers.get('stripe-pro').status, 'active');
  assert.equal(db.vipMembers.get('admin-vip').status, 'active');
});

test('kickInactivePartnerBrokerMembers enforces 1,000 THB/month commission when requireMinVolume=true and respects graceDays & Stripe', async () => {
  const future = '2099-01-01T00:00:00Z';
  const activeMonth = new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 7);
  const twentyDaysAgo = new Date(now - 20 * 86400000).toISOString();
  const twoDaysAgo = new Date(now - 2 * 86400000).toISOString();
  const yesterday = new Date(now - 1 * 86400000).toISOString();

  const db = makeMockDb({
    members: {
      'under-target': {
        id: 'under-target',
        line_id: 'U_UNDER',
        display_name: 'Under Target',
        broker: 'PI',
        portfolio_verified_at: twentyDaysAgo,
        broker_last_trade_at: yesterday,
        broker_volume_month: activeMonth,
        broker_monthly_volume_thb: 450,
        broker_volume_target_thb: 1000,
        subscription_ends_at: future,
      },
      'qualified-1k': {
        id: 'qualified-1k',
        line_id: 'U_QUAL',
        display_name: 'Qualified 1.5k Comm',
        broker: 'TRINITY',
        portfolio_verified_at: twentyDaysAgo,
        broker_last_trade_at: yesterday,
        broker_volume_month: activeMonth,
        broker_monthly_volume_thb: 1500,
        broker_volume_target_thb: 1000,
        subscription_ends_at: future,
      },
      'new-grace': {
        id: 'new-grace',
        line_id: 'U_GRACE',
        display_name: 'New Partner 2d',
        broker: 'ASL',
        portfolio_verified_at: twoDaysAgo,
        broker_last_trade_at: yesterday,
        broker_volume_month: activeMonth,
        broker_monthly_volume_thb: 100,
        subscription_ends_at: future,
      },
      'stripe-pro': {
        id: 'stripe-pro',
        line_id: 'U_STRIPE',
        display_name: 'Stripe VIP',
        portfolio_verified_at: twentyDaysAgo,
        broker_monthly_volume_thb: 0,
        subscription_ends_at: future,
      },
    },
    vipMembers: {
      'under-target': { member_id: 'under-target', chat_id: env.TELEGRAM_CHAT_ID, telegram_user_id: '801', status: 'active' },
      'qualified-1k': { member_id: 'qualified-1k', chat_id: env.TELEGRAM_CHAT_ID, telegram_user_id: '802', status: 'active' },
      'new-grace': { member_id: 'new-grace', chat_id: env.TELEGRAM_CHAT_ID, telegram_user_id: '803', status: 'active' },
      'stripe-pro': { member_id: 'stripe-pro', chat_id: env.TELEGRAM_CHAT_ID, telegram_user_id: '804', status: 'active' },
    },
  });

  const withMemberBilling = async (m) =>
    m.id === 'stripe-pro' ? { ...m, billing: { plan_id: 'pro', status: 'active', paid_until: future } } : m;

  const preview = await kickInactivePartnerBrokerMembers({
    inactivityDays: 30,
    requireMinVolume: true,
    minMonthlyVolumeThb: 1000,
    graceDays: 7,
    dryRun: true,
    env,
    now,
    db,
    withMemberBilling,
    checkIsAdmin: () => false,
    kickMember: async () => { throw Error('dryRun must not kick'); },
  });

  assert.equal(preview.matchedCount, 1);
  assert.equal(preview.candidates[0].memberId, 'under-target');
  assert.equal(preview.candidates[0].reason, 'VOLUME_BELOW_TARGET');
  assert.equal(preview.candidates[0].deficitThb, 550);

  const kicked = [];
  const res = await kickInactivePartnerBrokerMembers({
    inactivityDays: 30,
    requireMinVolume: true,
    minMonthlyVolumeThb: 1000,
    graceDays: 7,
    dryRun: false,
    env,
    now,
    db,
    withMemberBilling,
    checkIsAdmin: () => false,
    kickMember: async ({ userId }) => {
      kicked.push(userId);
      return { kicked: true };
    },
  });

  assert.equal(res.revokedCount, 1);
  assert.equal(res.kickedCount, 1);
  assert.deepEqual(kicked, ['801']);
  assert.equal(db.members.get('under-target').vip_revoked_reason, 'VOLUME_BELOW_TARGET');
  assert.equal(db.vipMembers.get('under-target').status, 'kicked');
  assert.equal(db.vipMembers.get('under-target').kick_reason, 'VOLUME_BELOW_TARGET');
  assert.equal(db.vipMembers.get('qualified-1k').status, 'active');
  assert.equal(db.vipMembers.get('new-grace').status, 'active');
  assert.equal(db.vipMembers.get('stripe-pro').status, 'active');
});
