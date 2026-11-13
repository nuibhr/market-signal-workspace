import {configuredPlans,MEMBERSHIP_PLANS} from '../billing/plans.mjs';
import {demoEnabled} from './demo-policy.mjs';
export function membershipFor(member) {
  const now = Date.now();
  const demo=demoEnabled()&&Date.parse(member?.demo?.expiresAt)>now?member.demo:null;
  let plan;try{plan=demo?MEMBERSHIP_PLANS.find(p=>p.id===demo.role):configuredPlans().find(p=>p.id===member?.billing?.plan_id);}catch{plan=null;}
  const stripePaid=Boolean(!demo&&plan&&['active','past_due'].includes(member?.billing?.status)&&Date.parse(member.billing.paid_until)>now);
  const planPaid=stripePaid||Boolean(demo&&plan);
  const paid = planPaid || Boolean(!demo&&member?.subscription_ends_at && Date.parse(member.subscription_ends_at) > now);
  const trial = demo?demo.role==='trial':Boolean(member?.trial_ends_at && Date.parse(member.trial_ends_at) > now);
  const tier = !member ? 'guest' : paid ? 'subscriber' : trial ? 'trial' : demo?demo.role:member.trial_ends_at
    ? 'expired'
    : 'onboarding';
  const active = tier === 'subscriber' || tier === 'trial';
  const enabled=feature=>active&&(!planPaid||plan.features.includes(feature));
  return {
    tier,
    label: { guest: 'ยังไม่เข้าสู่ระบบ', subscriber: 'สมาชิก', trial: 'ทดลองใช้ฟรี', expired: 'สิทธิหมดอายุ', onboarding: 'สมาชิกใหม่', 'portfolio-fix': 'แจ้งเลขพอร์ตใหม่' }[tier],
    authenticated: Boolean(member),
    planId:planPaid?plan.id:null,planName:planPaid?plan.name:paid?'สมาชิกเดิม':trial?'ทดลองใช้ฟรี':null,
    billingSource:demo?'demo':stripePaid?'stripe':paid?'admin':null,
    expiresAt: demo?demo.expiresAt:stripePaid ? member.billing.paid_until : paid ? member.subscription_ends_at : trial ? member.trial_ends_at : null,
    capabilities: {
      symbolSearch: true, marketChart: true, manualDailyScan: enabled('manualDailyScan'), autoPickFeed: enabled('autoPickFeed'), aiQuestions: enabled('aiQuestions'),
      localWatchlist: true, multiTimeframe: true, serverAlerts: false,
      savedCloudWorkspace: false, deepScan: false, communityPosting: enabled('communityPosting'),
    },
    limits: { dailyScanSymbols: enabled('manualDailyScan') ? planPaid?plan.dailyScanSymbols:8 : 0, freeAiQuestionsDaily: enabled('aiQuestions') ? planPaid?plan.aiDailyLimit:5 : 0, extraAiQuestionCredits: 1, allowExtraAiCredits:!planPaid&&!demo },
  };
}
