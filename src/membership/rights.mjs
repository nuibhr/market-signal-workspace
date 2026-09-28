export function membershipFor(member) {
  const now = Date.now();
  const paid = Boolean(member?.subscription_ends_at && Date.parse(member.subscription_ends_at) > now);
  const trial = Boolean(member?.trial_ends_at && member.portfolio_status !== 'missing' && Date.parse(member.trial_ends_at) > now);
  const tier = !member ? 'guest' : paid ? 'subscriber' : trial ? 'trial' : member.trial_ends_at
    ? member.portfolio_status === 'missing' && Date.parse(member.trial_ends_at) > now ? 'portfolio-fix' : 'expired'
    : 'onboarding';
  const active = tier === 'subscriber' || tier === 'trial';
  return {
    tier,
    label: { guest: 'ยังไม่เข้าสู่ระบบ', subscriber: 'สมาชิก', trial: 'ทดลองใช้ฟรี', expired: 'สิทธิหมดอายุ', onboarding: 'รอแจ้งเลขพอร์ต', 'portfolio-fix': 'แจ้งเลขพอร์ตใหม่' }[tier],
    authenticated: Boolean(member),
    expiresAt: paid ? member.subscription_ends_at : trial ? member.trial_ends_at : null,
    capabilities: {
      symbolSearch: true, marketChart: true, manualDailyScan: active, autoPickFeed: active, aiQuestions: active,
      localWatchlist: true, multiTimeframe: true, serverAlerts: false,
      savedCloudWorkspace: false, deepScan: false, communityPosting: false,
    },
    limits: { dailyScanSymbols: active ? 8 : 0, freeAiQuestionsDaily: active ? 5 : 0, extraAiQuestionCredits: 1 },
  };
}
