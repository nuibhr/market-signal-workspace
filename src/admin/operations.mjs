import { storage } from '../storage/database.mjs';
import { aiQuota, isAdmin } from '../membership/store.mjs';
import { membershipFor } from '../membership/rights.mjs';

const fields=`m.id,m.display_name,m.picture_url,m.broker,m.portfolio_last4,m.portfolio_status,
  m.portfolio_submitted_at,m.portfolio_verified_at,m.trial_started_at,m.trial_ends_at,
  m.subscription_ends_at,m.created_at,m.updated_at`;
const tierSql=`CASE WHEN m.subscription_ends_at>? THEN 'subscriber'
  WHEN m.trial_ends_at>? AND m.portfolio_status<>'missing' THEN 'trial'
  WHEN m.trial_ends_at IS NULL THEN 'onboarding'
  WHEN m.trial_ends_at>? AND m.portfolio_status='missing' THEN 'portfolio-fix' ELSE 'expired' END`;
function requireAdmin(admin){if(!isAdmin(admin))throw new Error('FORBIDDEN');}
function pagination(page,size=12){return {page:Math.max(1,Math.min(100000,parseInt(page,10)||1)),pageSize:size};}
function pageFor(total,page,pageSize){return Math.min(page,Math.max(1,Math.ceil(total/pageSize)));}
function queryText(input){return typeof input==='string'?input.trim().slice(0,80):'';}
const like=value=>`%${value.replace(/[\\%_]/g,'\\$&')}%`;
const withTier=row=>({...row,tier:membershipFor(row).tier,tierLabel:membershipFor(row).label});

export async function adminMemberships(admin,options={}){
  requireAdmin(admin);
  const now=new Date().toISOString(),query=queryText(options.q),filter=options.filter||'all';
  const cte=`WITH directory AS (SELECT ${fields},COALESCE(c.balance,0) AS ai_credits,${tierSql} AS tier
    FROM members m LEFT JOIN ai_credit_accounts c ON c.member_id=m.id)`;
  const params=[now,now,now],where=[];
  if(query){where.push("(display_name LIKE ? ESCAPE '\\' OR broker LIKE ? ESCAPE '\\' OR portfolio_last4 LIKE ? ESCAPE '\\')");params.push(like(query),like(query),like(query));}
  if(filter==='pending')where.push("portfolio_status='pending'");
  else if(['trial','subscriber','expired','onboarding','portfolio-fix'].includes(filter)){where.push('tier=?');params.push(filter);}
  const clause=where.length?`WHERE ${where.join(' AND ')}`:'';
  let {page,pageSize}=pagination(options.page);
  const {total}=await storage.first(`${cte} SELECT COUNT(*) AS total FROM directory ${clause}`,...params);
  page=pageFor(total,page,pageSize);
  const members=(await storage.all(`${cte} SELECT * FROM directory ${clause}
    ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?`,...params,pageSize,(page-1)*pageSize)).map(withTier);
  const summary=await storage.first(`${cte} SELECT COUNT(*) AS total,
    COALESCE(SUM(portfolio_status='pending'),0) AS pendingPortfolios,
    COALESCE(SUM(tier='subscriber'),0) AS subscribers,COALESCE(SUM(tier='trial'),0) AS trials,
    COALESCE(SUM(tier='expired'),0) AS expired,COALESCE(SUM(tier IN ('onboarding','portfolio-fix')),0) AS onboarding
    FROM directory`,now,now,now);
  const renewalState=['pending','approved','rejected','all'].includes(options.renewalState)?options.renewalState:'pending';
  const renewalWhere=renewalState==='all'?'':'WHERE r.status=?',renewalParams=renewalState==='all'?[]:[renewalState];
  const {total:renewalTotal}=await storage.first(`SELECT COUNT(*) AS total FROM renewal_requests r ${renewalWhere}`,...renewalParams);
  const renewalPage=pageFor(renewalTotal,pagination(options.renewalPage,7).page,7);
  const renewals=await storage.all(`SELECT r.id,r.member_id,r.status,r.created_at,r.resolved_at,
    m.display_name,m.broker,m.portfolio_last4,a.display_name AS resolved_by_name
    FROM renewal_requests r JOIN members m ON m.id=r.member_id LEFT JOIN members a ON a.id=r.resolved_by
    ${renewalWhere} ORDER BY r.created_at DESC,r.id DESC LIMIT 7 OFFSET ?`,...renewalParams,(renewalPage-1)*7);
  const pending=await storage.first("SELECT COUNT(*) AS n FROM renewal_requests WHERE status='pending'");
  return {members,summary:{...summary,pendingRenewals:pending.n},total,page,pageSize,query,filter,
    renewals,renewalTotal,renewalPage,renewalPageSize:7,renewalState,updatedAt:new Date().toISOString()};
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
  const row=await storage.first(`SELECT ${fields},COALESCE(c.balance,0) AS ai_credits
    FROM members m LEFT JOIN ai_credit_accounts c ON c.member_id=m.id WHERE m.id=?`,id);
  if(!row)throw new Error('REQUEST_UNAVAILABLE');
  const [audit,codes,quota,workspace]=await Promise.all([
    adminAudit(admin,{memberId:id}),
    storage.all(`SELECT code_hash AS id,created_at,expires_at,redeemed_at,revoked_at
      FROM monthly_codes WHERE member_id=? ORDER BY created_at DESC LIMIT 20`,id),
    aiQuota(row),
    storage.first(`SELECT
      (SELECT COUNT(*) FROM customer_favorites WHERE member_id=?) AS favorites,
      (SELECT COUNT(*) FROM customer_holdings WHERE member_id=?) AS holdings,
      (SELECT COUNT(*) FROM sessions WHERE member_id=? AND expires_at>?) AS sessions`,id,id,id,new Date().toISOString()),
  ]);
  const now=new Date().toISOString();
  return {member:withTier(row),audit,quota,workspace,codes:codes.map(code=>({...code,
    status:code.redeemed_at?'redeemed':code.revoked_at?'revoked':code.expires_at<=now?'expired':'available'}))};
}
