import {withBilling} from '../billing/store.mjs';
import {configuredPlans,stripeMode} from '../billing/plans.mjs';
import { storage } from '../storage/database.mjs';
import { aiQuota, isAdmin } from '../membership/store.mjs';
import { membershipFor } from '../membership/rights.mjs';

const fields=`m.id,m.display_name,m.picture_url,m.broker,m.portfolio_last4,m.portfolio_status,
  m.portfolio_submitted_at,m.portfolio_verified_at,m.trial_started_at,m.trial_ends_at,
  m.subscription_ends_at,m.broker_trade_checked_at,m.broker_last_trade_at,
  m.broker_monthly_volume_thb,m.broker_volume_month,m.broker_volume_target_thb,
  m.vip_revoked_reason,m.vip_revoked_at,
  m.created_at,m.updated_at`;
const tierSql=`CASE WHEN m.subscription_ends_at>? THEN 'subscriber'
  WHEN m.trial_ends_at>? AND m.portfolio_status<>'missing' THEN 'trial'
  WHEN m.trial_ends_at IS NULL THEN 'onboarding'
  WHEN m.trial_ends_at>? AND m.portfolio_status='missing' THEN 'portfolio-fix' ELSE 'expired' END`;
const DAY=86400000;
const bangkokDay=(ts=Date.now())=>new Date(ts+7*3600000).toISOString().slice(0,10);
const bangkokMonth=(ts=Date.now())=>bangkokDay(ts).slice(0,7);
function requireAdmin(admin){if(!isAdmin(admin))throw new Error('FORBIDDEN');}
function pagination(page,size=12){return {page:Math.max(1,Math.min(100000,parseInt(page,10)||1)),pageSize:Math.max(1,Math.min(50,parseInt(size,10)||12))};}
function pageFor(total,page,pageSize){return Math.min(page,Math.max(1,Math.ceil(total/pageSize)));}
function queryText(input){return typeof input==='string'?input.trim().slice(0,80):'';}
const like=value=>`%${value.replace(/[\\%_]/g,'\\$&')}%`;
const withTier=async(row,currentMonth=bangkokMonth())=>{
  const rights=membershipFor(await withBilling(row));
  const targetThb=Math.max(0,Number(row.broker_volume_target_thb)||1_000);
  const monthlyVolumeThb=row.broker_volume_month===currentMonth?Math.max(0,Number(row.broker_monthly_volume_thb)||0):0;
  const expiresAt=rights.expiresAt||null;
  const daysRemaining=expiresAt?Math.ceil((Date.parse(expiresAt)-Date.now())/DAY):null;
  return {
    ...row,
    tier:rights.tier,
    tierLabel:rights.billingSource==='stripe'?rights.planName:rights.label,
    planId:rights.planId,
    planName:rights.planName,
    billingSource:rights.billingSource,
    aiDailyLimit:rights.limits?.freeAiQuestionsDaily??3,
    aiUsedToday:Number(row.ai_used_today)||0,
    monthlyVolumeThb,
    volumeTargetThb:targetThb,
    volumeProgressPct:targetThb>0?Math.min(100,Math.round((monthlyVolumeThb/targetThb)*100)):100,
    volumeQualified:monthlyVolumeThb>=targetThb,
    daysRemaining,
    expiresAt,
  };
};
function directoryTier(now){
 let plans,mode;try{plans=configuredPlans();mode=stripeMode();}catch{return {sql:tierSql,params:[now,now,now],stripePlanSql:'NULL',stripePlanParams:[]};}
 if(!plans.length)return {sql:tierSql,params:[now,now,now],stripePlanSql:'NULL',stripePlanParams:[]};
 const planPlaceholders=plans.map(()=>'?').join(',');
 const stripePaid=`EXISTS(SELECT 1 FROM billing_subscriptions bs WHERE bs.member_id=m.id AND bs.mode=? AND bs.status IN ('active','past_due') AND bs.paid_until>? AND bs.plan_id IN (${planPlaceholders}))`;
 const stripePlanSql=`(SELECT bs.plan_id FROM billing_subscriptions bs WHERE bs.member_id=m.id AND bs.mode=? AND bs.status IN ('active','past_due') AND bs.paid_until>? AND bs.plan_id IN (${planPlaceholders}) ORDER BY bs.paid_until DESC LIMIT 1)`;
 return {
   sql:tierSql.replace('m.subscription_ends_at>?',`(${stripePaid} OR m.subscription_ends_at>?)`),
   params:[mode,now,...plans.map(p=>p.id),now,now,now],
   stripePlanSql,
   stripePlanParams:[mode,now,...plans.map(p=>p.id)],
 };
}

export async function adminMemberships(admin,options={}){
  requireAdmin(admin);
  const ts=Date.now(),now=new Date(ts).toISOString(),soon7d=new Date(ts+7*DAY).toISOString();
  const today=bangkokDay(ts),currentMonth=today.slice(0,7);
  const query=queryText(options.q),filter=options.filter||'all';
  const tier=directoryTier(now);
  const cte=`WITH directory AS (SELECT ${fields},COALESCE(c.balance,0) AS ai_credits,
    ${tier.stripePlanSql} AS stripe_plan_id,
    tg.status AS tg_status,tg.telegram_user_id,tg.telegram_username,tg.joined_at AS tg_joined_at,tg.kicked_at AS tg_kicked_at,tg.kick_reason AS tg_kick_reason,
    (SELECT COUNT(*) FROM ai_questions aq WHERE aq.member_id=m.id AND aq.day_key=? AND aq.charge_type='free') AS ai_used_today,
    ${tier.sql} AS tier
    FROM members m
    LEFT JOIN ai_credit_accounts c ON c.member_id=m.id
    LEFT JOIN telegram_vip_members tg ON tg.member_id=m.id)`;
  const cteParams=[...tier.stripePlanParams,today,...tier.params];
  const params=[...cteParams],where=[];
  if(query){where.push("(display_name LIKE ? ESCAPE '\\' OR broker LIKE ? ESCAPE '\\' OR portfolio_last4 LIKE ? ESCAPE '\\' OR COALESCE(telegram_username,'') LIKE ? ESCAPE '\\')");params.push(like(query),like(query),like(query),like(query));}
  if(filter==='pending')where.push("portfolio_status='pending'");
  else if(['trial','subscriber','expired','onboarding','portfolio-fix'].includes(filter)){where.push('tier=?');params.push(filter);}
  else if(filter==='partner_vip')where.push("tier='subscriber' AND stripe_plan_id IS NULL");
  else if(filter==='stripe_pro')where.push("stripe_plan_id='pro'");
  else if(filter==='stripe_starter')where.push("stripe_plan_id='starter'");
  else if(filter==='volume_pass'){where.push("tier='subscriber' AND stripe_plan_id IS NULL AND COALESCE(broker_volume_month,'')=? AND COALESCE(broker_monthly_volume_thb,0)>=COALESCE(broker_volume_target_thb,1000)");params.push(currentMonth);}
  else if(filter==='volume_risk'){where.push("tier='subscriber' AND stripe_plan_id IS NULL AND (COALESCE(broker_volume_month,'')<>? OR COALESCE(broker_monthly_volume_thb,0)<COALESCE(broker_volume_target_thb,1000))");params.push(currentMonth);}
  else if(filter==='expiring_7d'){where.push("subscription_ends_at IS NOT NULL AND subscription_ends_at>? AND subscription_ends_at<=?");params.push(now,soon7d);}
  else if(filter==='revoked')where.push("vip_revoked_at IS NOT NULL");
  else if(filter==='telegram_active')where.push("tg_status='active'");
  const clause=where.length?`WHERE ${where.join(' AND ')}`:'';
  let {page,pageSize}=pagination(options.page,options.limit||12);
  const {total}=await storage.first(`${cte} SELECT COUNT(*) AS total FROM directory ${clause}`,...params);
  page=pageFor(total,page,pageSize);
  const rows=await storage.all(`${cte} SELECT * FROM directory ${clause}
    ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?`,...params,pageSize,(page-1)*pageSize);
  const members=await Promise.all(rows.map(row=>withTier(row,currentMonth)));
  const summary=await storage.first(`${cte} SELECT COUNT(*) AS total,
    COALESCE(SUM(portfolio_status='pending'),0) AS pendingPortfolios,
    COALESCE(SUM(tier='subscriber'),0) AS subscribers,COALESCE(SUM(tier='trial'),0) AS trials,
    COALESCE(SUM(tier='expired'),0) AS expired,COALESCE(SUM(tier IN ('onboarding','portfolio-fix')),0) AS onboarding,
    COALESCE(SUM(stripe_plan_id='pro'),0) AS stripeProCount,
    COALESCE(SUM(stripe_plan_id='starter'),0) AS stripeStarterCount,
    COALESCE(SUM(tier='subscriber' AND stripe_plan_id IS NULL),0) AS partnerVipCount,
    COALESCE(SUM(CASE WHEN tier='subscriber' AND stripe_plan_id IS NULL AND COALESCE(broker_volume_month,'')=? AND COALESCE(broker_monthly_volume_thb,0)>=COALESCE(broker_volume_target_thb,1000) THEN 1 ELSE 0 END),0) AS volumePassedCount,
    COALESCE(SUM(CASE WHEN tier='subscriber' AND stripe_plan_id IS NULL AND (COALESCE(broker_volume_month,'')<>? OR COALESCE(broker_monthly_volume_thb,0)<COALESCE(broker_volume_target_thb,1000)) THEN 1 ELSE 0 END),0) AS volumeRiskCount,
    COALESCE(SUM(CASE WHEN subscription_ends_at IS NOT NULL AND subscription_ends_at>? AND subscription_ends_at<=? THEN 1 ELSE 0 END),0) AS expiring7dCount,
    COALESCE(SUM(vip_revoked_at IS NOT NULL),0) AS revokedCount,
    COALESCE(SUM(tg_status='active'),0) AS telegramActiveCount,
    COALESCE(SUM(ai_used_today),0) AS aiUsedTodayTotal
    FROM directory`,...cteParams,currentMonth,currentMonth,now,soon7d);
  const renewalState=['pending','approved','rejected','all'].includes(options.renewalState)?options.renewalState:'pending';
  const renewalWhere=renewalState==='all'?'':'WHERE r.status=?',renewalParams=renewalState==='all'?[]:[renewalState];
  const {total:renewalTotal}=await storage.first(`SELECT COUNT(*) AS total FROM renewal_requests r ${renewalWhere}`,...renewalParams);
  const renewalPage=pageFor(renewalTotal,pagination(options.renewalPage,7).page,7);
  const renewals=await storage.all(`SELECT r.id,r.member_id,r.status,r.created_at,r.resolved_at,
    m.display_name,m.broker,m.portfolio_last4,a.display_name AS resolved_by_name
    FROM renewal_requests r JOIN members m ON m.id=r.member_id LEFT JOIN members a ON a.id=r.resolved_by
    ${renewalWhere} ORDER BY r.created_at DESC,r.id DESC LIMIT 7 OFFSET ?`,...renewalParams,(renewalPage-1)*7);
  const pending=await storage.first("SELECT COUNT(*) AS n FROM renewal_requests WHERE status='pending'");
  const availableCodes=await storage.first("SELECT COUNT(*) AS n FROM monthly_codes WHERE redeemed_at IS NULL AND revoked_at IS NULL AND expires_at>?",now);
  const estimatedMrrThb=(Number(summary?.stripeProCount)||0)*399+(Number(summary?.stripeStarterCount)||0)*159;
  return {members,summary:{...summary,estimatedMrrThb,pendingRenewals:pending.n,availableCodesCount:availableCodes.n,currentMonth},
    total,page,pageSize,query,filter,renewals,renewalTotal,renewalPage,renewalPageSize:7,renewalState,updatedAt:new Date().toISOString()};
}

export async function adminAudit(admin,{memberId=null,page=1}={}){
  requireAdmin(admin);
  const condition=memberId?'WHERE e.member_id=?':'',params=memberId?[memberId]:[];
  const ledger=`WITH ledger AS (
    SELECT e.id,e.member_id,e.actor_id,e.event_type,e.created_at,e.details,NULL AS amount,NULL AS balance_after,NULL AS note
      FROM membership_events e ${condition}
    UNION ALL SELECT e.id,e.member_id,e.actor_id,e.reason AS event_type,e.created_at,NULL AS details,e.amount,e.balance_after,g.note
      FROM ai_credit_events e LEFT JOIN admin_credit_grants g ON e.id='admin-grant:'||g.id ${condition}
  )`;
  const bindings=[...params,...params],{total}=await storage.first(`${ledger} SELECT COUNT(*) AS total FROM ledger`,...bindings);
  const safePage=pageFor(total,pagination(page,15).page,15);
  const events=await storage.all(`${ledger} SELECT l.*,m.display_name AS member_name,a.display_name AS actor_name
    FROM ledger l JOIN members m ON m.id=l.member_id LEFT JOIN members a ON a.id=l.actor_id
    ORDER BY l.created_at DESC,l.id DESC LIMIT 15 OFFSET ?`,...bindings,(safePage-1)*15);
  return {events,total,page:safePage,pageSize:15};
}

export async function adminMemberDetail(admin,id){
  requireAdmin(admin);
  const today=bangkokDay(),currentMonth=today.slice(0,7);
  const row=await storage.first(`SELECT ${fields},COALESCE(c.balance,0) AS ai_credits,
    tg.status AS tg_status,tg.telegram_user_id,tg.telegram_username,tg.joined_at AS tg_joined_at,tg.kicked_at AS tg_kicked_at,tg.kick_reason AS tg_kick_reason,
    (SELECT COUNT(*) FROM ai_questions aq WHERE aq.member_id=m.id AND aq.day_key=? AND aq.charge_type='free') AS ai_used_today
    FROM members m
    LEFT JOIN ai_credit_accounts c ON c.member_id=m.id
    LEFT JOIN telegram_vip_members tg ON tg.member_id=m.id
    WHERE m.id=?`,today,id);
  if(!row)throw new Error('REQUEST_UNAVAILABLE');
  const [audit,codes,quota,workspace]=await Promise.all([
    adminAudit(admin,{memberId:id}),
    storage.all(`SELECT code_hash AS id,grant_type,duration_days,min_volume_thb,note,created_at,expires_at,redeemed_at,revoked_at
      FROM monthly_codes WHERE member_id=? ORDER BY created_at DESC LIMIT 20`,id),
    aiQuota(row),
    storage.first(`SELECT
      (SELECT COUNT(*) FROM customer_favorites WHERE member_id=?) AS favorites,
      (SELECT COUNT(*) FROM customer_holdings WHERE member_id=?) AS holdings,
      (SELECT COUNT(*) FROM sessions WHERE member_id=? AND expires_at>?) AS sessions`,id,id,id,new Date().toISOString()),
  ]);
  const now=new Date().toISOString();
  return {member:await withTier(row,currentMonth),audit,quota,workspace,codes:codes.map(code=>({...code,
    status:code.redeemed_at?'redeemed':code.revoked_at?'revoked':code.expires_at<=now?'expired':'available'}))};
}
