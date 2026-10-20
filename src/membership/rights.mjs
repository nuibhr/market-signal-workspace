import {configuredPlans} from '../billing/plans.mjs';
export function membershipFor(member) {
  const now = Date.now();
  let plan;try{plan=configuredPlans().find(p=>p.id===member?.billing?.plan_id);}catch{plan=null;}
  const stripePaid=Boolean(plan&&['active','past_due'].includes(member?.billing?.status)&&Date.parse(member.billing.paid_until)>now);
  const paid = stripePaid || Boolean(member?.subscription_ends_at && Date.parse(member.subscription_ends_at) > now);
  const trial = Boolean(member?.trial_ends_at && member.portfolio_status !== 'missing' && Date.parse(member.trial_ends_at) > now);
  const tier = !member ? 'guest' : paid ? 'subscriber' : trial ? 'trial' : member.trial_ends_at
    ? member.portfolio_status === 'missing' && Date.parse(member.trial_ends_at) > now ? 'portfolio-fix' : 'expired'
    : 'onboarding';
  const active = tier === 'subscriber' || tier === 'trial';
  const enabled=feature=>active&&(!stripePaid||plan.features.includes(feature));
  return {
    tier,
    label: { guest: 'ยังไม่เข้าสู่ระบบ', subscriber: 'สมาชิก', trial: 'ทดลองใช้ฟรี', expired: 'สิทธิหมดอายุ', onboarding: 'รอแจ้งเลขพอร์ต', 'portfolio-fix': 'แจ้งเลขพอร์ตใหม่' }[tier],
    authenticated: Boolean(member),
    planId:stripePaid?plan.id:null,planName:stripePaid?plan.name:paid?'สมาชิกเดิม':trial?'ทดลองใช้ฟรี':null,
    billingSource:stripePaid?'stripe':paid?'admin':null,
    expiresAt: stripePaid ? member.billing.paid_until : paid ? member.subscription_ends_at : trial ? member.trial_ends_at : null,
    capabilities: {
      symbolSearch: true, marketChart: true, manualDailyScan: enabled('manualDailyScan'), autoPickFeed: enabled('autoPickFeed'), aiQuestions: enabled('aiQuestions'),
      localWatchlist: true, multiTimeframe: true, serverAlerts: false,
      savedCloudWorkspace: false, deepScan: false, communityPosting: enabled('communityPosting'),
    },
    limits: { dailyScanSymbols: enabled('manualDailyScan') ? stripePaid?plan.dailyScanSymbols:8 : 0, freeAiQuestionsDaily: enabled('aiQuestions') ? stripePaid?plan.aiDailyLimit:5 : 0, extraAiQuestionCredits: 1, allowExtraAiCredits:!stripePaid },
  };
}
