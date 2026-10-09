import { createHash, createHmac, randomBytes } from 'node:crypto';
import { storage, operation as op } from '../storage/database.mjs';
const DAY = 86_400_000;

export function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function sessionDigest(value) { return createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('hex'); }
export function token() { return randomBytes(32).toString('base64url'); }
export function isConfigured() {
  try {
    const redirect = new URL(process.env.LINE_REDIRECT_URI);
    if (redirect.pathname !== '/api/auth/line/callback' || redirect.search || redirect.hash) return false;
    if (process.env.NODE_ENV === 'production' && (redirect.protocol !== 'https:' || !process.env.APP_ORIGIN || new URL(process.env.APP_ORIGIN).origin !== redirect.origin)) return false;
    return Boolean(process.env.LINE_CHANNEL_ID && process.env.LINE_CHANNEL_SECRET && process.env.SESSION_SECRET?.length >= 32 && process.env.PORTFOLIO_HASH_SECRET?.length >= 32);
  } catch { return false; }
}
export function portfolioDigest(broker, number) {
  if (!process.env.PORTFOLIO_HASH_SECRET || process.env.PORTFOLIO_HASH_SECRET.length < 32) throw new Error('PORTFOLIO_HASH_SECRET missing');
  return createHmac('sha256', process.env.PORTFOLIO_HASH_SECRET).update(`${broker.toUpperCase()}:${number.replace(/\s|-/g, '').toUpperCase()}`).digest('hex');
}
export function normalizePortfolio(value) {
  const number = String(value ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z0-9]{5,24}$/.test(number)) throw new Error('INVALID_PORTFOLIO');
  return number;
}
export function isAdmin(member) { return Boolean(member && process.env.ADMIN_LINE_IDS?.split(',').map(id => id.trim()).includes(member.line_id)); }

const AI_FREE_DAILY = 5;
function bangkokDay() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
async function memberById(id) { return storage.first('SELECT * FROM members WHERE id=?', id); }
function audit(memberId, actorId, type, details, mutation) {
  return op(`INSERT INTO membership_events (id,member_id,actor_id,event_type,created_at,details)
    SELECT ?,id,?,?,?,? FROM members WHERE id=? AND mutation_key=?`,
    token(), actorId, type, new Date().toISOString(), details ?? null, memberId, mutation);
}
// Read outside the transaction, then compare the version inside an atomic SQL batch.
async function mutateMember(memberId, actorId, type, prepare) {
  for (let attempt=0; attempt<4; attempt++) {
    const member = await memberById(memberId);
    if (!member) throw new Error('REQUEST_UNAVAILABLE');
    const { set, params, details } = prepare(member);
    const mutation=token();
    const result=await storage.batch([
      op(`UPDATE members SET ${set},updated_at=?,version=version+1,mutation_key=? WHERE id=? AND version=?`,
        ...params,new Date().toISOString(),mutation,memberId,member.version),
      audit(memberId,actorId,type,details,mutation),
      op('SELECT * FROM members WHERE id=?',memberId),
    ]);
    if (result[0].changes) return result[2].results[0];
  }
  throw new Error('REQUEST_UNAVAILABLE');
}
export async function upsertLineMember({ lineId, displayName, pictureUrl }) {
  const now=new Date().toISOString();
  const result=await storage.batch([
    op(`INSERT INTO members (id,line_id,display_name,picture_url,created_at,updated_at)
      VALUES (?,?,?,?,?,?) ON CONFLICT(line_id) DO UPDATE SET display_name=excluded.display_name,
      picture_url=excluded.picture_url,updated_at=excluded.updated_at,version=members.version+1`,
      token(),lineId,displayName.slice(0,80),pictureUrl||null,now,now),
    op('SELECT * FROM members WHERE line_id=?',lineId),
  ]);
  return result[1].results[0];
}
export async function createLineFlow() {
  const value=token(),state=token(),nonce=token(),verifier=token();
  await storage.batch([op('DELETE FROM line_oauth_flows WHERE expires_at<?',Date.now()),
    op('INSERT INTO line_oauth_flows VALUES(?,?,?,?,?)',sessionDigest(value),state,nonce,verifier,Date.now()+600000)]);
  return {value,state,nonce,verifier};
}
export async function consumeLineFlow(value) {
  if(typeof value!=='string'||value.length>100)return null;
  return storage.first('DELETE FROM line_oauth_flows WHERE token_hash=? RETURNING state,nonce,verifier,expires_at',sessionDigest(value));
}
export async function createSession(memberId) {
  const value=token(),expiresAt=new Date(Date.now()+30*DAY).toISOString();
  await storage.batch([op('DELETE FROM sessions WHERE expires_at<=?',new Date().toISOString()),
    op('INSERT INTO sessions (token_hash,member_id,expires_at) VALUES (?,?,?)',sessionDigest(value),memberId,expiresAt)]);
  return {value,expiresAt};
}
export async function sessionMember(value) {
  if(typeof value!=='string'||value.length>100)return null;
  return storage.first(`SELECT m.* FROM sessions s JOIN members m ON m.id=s.member_id
    WHERE s.token_hash=? AND s.expires_at>?`,sessionDigest(value),new Date().toISOString());
}
export async function deleteSession(value) { if(value)await storage.run('DELETE FROM sessions WHERE token_hash=?',sessionDigest(value)); }
export async function submitPortfolio(member,brokerInput,numberInput) {
  const broker=String(brokerInput??'').trim().replace(/\s+/g,' ').toUpperCase();
  if(!/^[\p{L}\p{M}\p{N} .&-]{2,40}$/u.test(broker))throw new Error('INVALID_BROKER');
  const number=normalizePortfolio(numberInput),hash=portfolioDigest(broker,number);
  try { return await mutateMember(member.id,member.id,'portfolio_submitted',current=>{
    if(current.portfolio_hash&&current.portfolio_hash!==hash)throw new Error('PORTFOLIO_CHANGE_REQUIRES_ADMIN');
    const now=new Date().toISOString();
    return {set:`broker=?,portfolio_hash=?,portfolio_last4=?,portfolio_status=CASE WHEN portfolio_status='verified' THEN 'verified' ELSE 'pending' END,
      portfolio_submitted_at=COALESCE(portfolio_submitted_at,?),trial_started_at=COALESCE(trial_started_at,?),trial_ends_at=COALESCE(trial_ends_at,?)`,
      params:[broker,hash,number.slice(-4),now,now,new Date(Date.now()+14*DAY).toISOString()],details:broker};
  }); } catch(error) {
    if(String(error.message).includes('members.portfolio_hash'))throw new Error('PORTFOLIO_ALREADY_USED');
    throw error;
  }
}
export async function listAdminMembers() {
  return storage.all(`SELECT m.id,m.display_name,m.broker,m.portfolio_last4,m.portfolio_status,m.trial_ends_at,m.subscription_ends_at,m.created_at,COALESCE(c.balance,0) AS ai_credits
    FROM members m LEFT JOIN ai_credit_accounts c ON c.member_id=m.id WHERE m.portfolio_hash IS NOT NULL ORDER BY CASE m.portfolio_status WHEN 'pending' THEN 0 ELSE 1 END,m.updated_at DESC LIMIT 100`);
}
export async function verifyPortfolio(admin,memberId,numberInput) {
  if(!isAdmin(admin))throw new Error('FORBIDDEN');
  const number=normalizePortfolio(numberInput);
  await mutateMember(memberId,admin.id,'portfolio_verified',member=>{
    if(!member.portfolio_hash||member.portfolio_hash!==portfolioDigest(member.broker,number))throw new Error('PORTFOLIO_MISMATCH');
    return {set:"portfolio_status='verified',portfolio_verified_at=?",params:[new Date().toISOString()]};
  });
}
export async function rejectPortfolio(admin,memberId) {
  if(!isAdmin(admin))throw new Error('FORBIDDEN');
  await mutateMember(memberId,admin.id,'portfolio_rejected',member=>{
    if(member.portfolio_status!=='pending')throw new Error('REQUEST_UNAVAILABLE');
    return {set:"broker=NULL,portfolio_hash=NULL,portfolio_last4=NULL,portfolio_status='missing',portfolio_submitted_at=NULL",params:[]};
  });
}
function monthEnd(member) {
  const start=member.subscription_ends_at&&Date.parse(member.subscription_ends_at)>Date.now()?new Date(member.subscription_ends_at):new Date();
  const lastDay=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+2,0)).getUTCDate();
  return new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,Math.min(start.getUTCDate(),lastDay),
    start.getUTCHours(),start.getUTCMinutes(),start.getUTCSeconds(),start.getUTCMilliseconds())).toISOString();
}
function adminRequestId(value) {
  const id=value??token();
  if(typeof id!=='string'||!/^[-_a-zA-Z0-9]{16,100}$/.test(id))throw new Error('INVALID_REQUEST_ID');
  return id;
}
export async function issueCode(admin,memberId,requestId) {
  if(!isAdmin(admin))throw new Error('FORBIDDEN');
  const request=adminRequestId(requestId);
  // The same acknowledged request returns the same code without storing its plaintext.
  const code=`NUG-${createHmac('sha256',process.env.SESSION_SECRET).update(`monthly-code:${admin.id}:${memberId}:${request}`).digest('hex').slice(0,24).toUpperCase()}`;
  const hash=digest(code),now=new Date().toISOString();
  const result=await storage.batch([
    op(`INSERT OR IGNORE INTO monthly_codes (code_hash,member_id,created_by,created_at,expires_at)
      SELECT ?,id,?,?,? FROM members WHERE id=? AND portfolio_status='verified'`,hash,admin.id,now,new Date(Date.now()+30*DAY).toISOString(),memberId),
    op(`INSERT OR IGNORE INTO membership_events SELECT ?,member_id,?,'code_issued',created_at,NULL FROM monthly_codes WHERE code_hash=?`,
      `code-issued:${hash}`,admin.id,hash),
    op('SELECT member_id,expires_at,redeemed_at,revoked_at FROM monthly_codes WHERE code_hash=?',hash),
  ]);
  const record=result[2].results[0];
  if(!record||record.member_id!==memberId)throw new Error('PORTFOLIO_NOT_VERIFIED');
  if(record.redeemed_at||record.revoked_at||record.expires_at<=now)throw new Error('CODE_UNAVAILABLE');
  return code;
}
export async function revokeCode(admin,memberId,codeId) {
  if(!isAdmin(admin))throw new Error('FORBIDDEN');
  if(typeof codeId!=='string'||!/^[a-f0-9]{64}$/.test(codeId))throw new Error('INVALID_CODE');
  const now=new Date().toISOString();
  const result=await storage.batch([
    op(`UPDATE monthly_codes SET revoked_at=?,revoked_by=?,expires_at=?
      WHERE code_hash=? AND member_id=? AND redeemed_at IS NULL AND revoked_at IS NULL AND expires_at>?`,
      now,admin.id,now,codeId,memberId,now),
    op(`INSERT OR IGNORE INTO membership_events SELECT ?,member_id,?,'code_revoked',?,NULL
      FROM monthly_codes WHERE code_hash=? AND member_id=? AND revoked_at=? AND revoked_by=?`,
      `code-revoked:${codeId}`,admin.id,now,codeId,memberId,now,admin.id),
  ]);
  if(!result[0].changes)throw new Error('CODE_UNAVAILABLE');
}
export async function redeemCode(member,codeInput) {
  const code=String(codeInput??'').trim().toUpperCase();
  if(!/^NUG-[A-F0-9]{24}$/.test(code))throw new Error('INVALID_CODE');
  for(let attempt=0;attempt<4;attempt++) {
    const current=await memberById(member.id);
    if(current?.portfolio_status!=='verified')throw new Error('PORTFOLIO_NOT_VERIFIED');
    const endsAt=monthEnd(current),mutation=token(),now=new Date().toISOString();
    const result=await storage.batch([
      op(`UPDATE monthly_codes SET redeemed_at=?,redemption_token=? WHERE code_hash=? AND member_id=? AND redeemed_at IS NULL AND expires_at>?
        AND EXISTS(SELECT 1 FROM members WHERE id=? AND portfolio_status='verified' AND version=?)`,now,mutation,digest(code),member.id,now,member.id,current.version),
      op(`UPDATE members SET subscription_ends_at=?,updated_at=?,version=version+1,mutation_key=? WHERE id=? AND version=?
        AND EXISTS(SELECT 1 FROM monthly_codes WHERE code_hash=? AND redemption_token=?)`,endsAt,now,mutation,member.id,current.version,digest(code),mutation),
      audit(member.id,member.id,'code_redeemed',endsAt,mutation),
    ]);
    if(result[0].changes&&result[1].changes)return endsAt;
    const record=await storage.first('SELECT member_id,redeemed_at,expires_at FROM monthly_codes WHERE code_hash=?',digest(code));
    if(!record||record.member_id!==member.id||record.redeemed_at||record.expires_at<=now)throw new Error('CODE_UNAVAILABLE');
  }
  throw new Error('REQUEST_UNAVAILABLE');
}
export async function requestRenewal(member) {
  const id=token(),now=new Date().toISOString();
  const results=await storage.batch([
    op(`INSERT OR IGNORE INTO renewal_requests (id,member_id,created_at) SELECT ?,id,? FROM members WHERE id=? AND portfolio_status='verified'`,id,now,member.id),
    op(`INSERT INTO membership_events SELECT ?,member_id,member_id,'renewal_requested',?,NULL FROM renewal_requests WHERE id=?`,token(),now,id),
    op("SELECT id FROM renewal_requests WHERE member_id=? AND status='pending'",member.id),
  ]);
  if(!results[2].results.length)throw new Error('PORTFOLIO_NOT_VERIFIED');
  return results[2].results[0].id;
}
export async function listRenewals() {
  return storage.all(`SELECT r.id,r.member_id,r.created_at,m.display_name,m.broker,m.portfolio_last4
    FROM renewal_requests r JOIN members m ON m.id=r.member_id WHERE r.status='pending' ORDER BY r.created_at LIMIT 100`);
}
export async function approveRenewal(admin,requestId,reference='') {
  if(!isAdmin(admin))throw new Error('FORBIDDEN');
  if(typeof reference!=='string'||reference.length>160)throw new Error('INVALID_NOTE');
  for(let attempt=0;attempt<4;attempt++) {
    const request=await storage.first("SELECT * FROM renewal_requests WHERE id=? AND status='pending'",requestId);
    if(!request)throw new Error('REQUEST_UNAVAILABLE');
    const member=await memberById(request.member_id);
    if(member?.portfolio_status!=='verified')throw new Error('PORTFOLIO_NOT_VERIFIED');
    const endsAt=monthEnd(member),mutation=token(),now=new Date().toISOString();
    const result=await storage.batch([
      op(`UPDATE renewal_requests SET status='approved',resolved_at=?,resolved_by=?,resolution_token=? WHERE id=? AND status='pending'
        AND EXISTS(SELECT 1 FROM members WHERE id=? AND portfolio_status='verified' AND version=?)`,now,admin.id,mutation,requestId,member.id,member.version),
      op(`UPDATE members SET subscription_ends_at=?,updated_at=?,version=version+1,mutation_key=? WHERE id=? AND version=?
        AND EXISTS(SELECT 1 FROM renewal_requests WHERE id=? AND resolution_token=?)`,endsAt,now,mutation,member.id,member.version,requestId,mutation),
      audit(member.id,admin.id,'renewal_approved',JSON.stringify({subscriptionEndsAt:endsAt,reference:reference.trim()}),mutation),
    ]);
    if(result[0].changes&&result[1].changes)return endsAt;
  }
  throw new Error('REQUEST_UNAVAILABLE');
}
export async function rejectRenewal(admin,requestId) {
  if(!isAdmin(admin))throw new Error('FORBIDDEN');
  const mutation=token(),now=new Date().toISOString();
  const result=await storage.batch([
    op("UPDATE renewal_requests SET status='rejected',resolved_at=?,resolved_by=?,resolution_token=? WHERE id=? AND status='pending'",now,admin.id,mutation,requestId),
    op(`INSERT INTO membership_events SELECT ?,member_id,?,'renewal_rejected',?,NULL FROM renewal_requests WHERE id=? AND resolution_token=?`,token(),admin.id,now,requestId,mutation),
  ]);
  if(!result[0].changes)throw new Error('REQUEST_UNAVAILABLE');
}
export async function accountSummary(member) {
  if(!member)return null;
  const renewal=await storage.first("SELECT id FROM renewal_requests WHERE member_id=? AND status='pending'",member.id);
  return {id:member.id,displayName:member.display_name,pictureUrl:member.picture_url,broker:member.broker,
    portfolioLast4:member.portfolio_last4,portfolioStatus:member.portfolio_status,trialStartedAt:member.trial_started_at,
    trialEndsAt:member.trial_ends_at,subscriptionEndsAt:member.subscription_ends_at,renewalPending:Boolean(renewal),admin:isAdmin(member),coach:Boolean(await storage.first('SELECT id FROM coach_portfolios WHERE owner_id=? LIMIT 1',member.id))};
}
export async function aiQuota(member) {
  const day=bangkokDay();
  if(!member)return {freeLimit:AI_FREE_DAILY,freeUsed:0,freeRemaining:0,credits:0,day};
  const row=await storage.first(`SELECT (SELECT COUNT(*) FROM ai_questions WHERE member_id=? AND day_key=? AND charge_type='free') AS used,
    COALESCE((SELECT balance FROM ai_credit_accounts WHERE member_id=?),0) AS credits`,member.id,day,member.id);
  return {freeLimit:AI_FREE_DAILY,freeUsed:row.used,freeRemaining:Math.max(0,AI_FREE_DAILY-row.used),credits:row.credits,day};
}
export async function reserveAiQuestion(member,requestId,question,conversationId) {
  if(!/^[a-f0-9-]{36}$/i.test(requestId))throw new Error('INVALID_REQUEST_ID');
  if(!/^[a-f0-9-]{36}$/i.test(conversationId)||typeof question!=='string'||question.length<3||question.length>700)throw new Error('INVALID_REQUEST');
  const reservationToken=token(),day=bangkokDay(),now=new Date().toISOString();
  let results;
  try { results=await storage.batch([
    op("DELETE FROM ai_questions WHERE member_id=? AND status='pending' AND created_at<?",member.id,new Date(Date.now()-300000).toISOString()),
    op(`INSERT INTO ai_questions (id,member_id,conversation_id,question_text,day_key,charge_type,status,created_at,reservation_token)
      SELECT ?,?,?,?,?,CASE WHEN (SELECT COUNT(*) FROM ai_questions WHERE member_id=? AND day_key=? AND charge_type='free')<5 THEN 'free' ELSE 'credit' END,'pending',?,?
      WHERE NOT EXISTS(SELECT 1 FROM ai_questions WHERE id=?)`,requestId,member.id,conversationId,question,day,member.id,day,now,reservationToken,requestId),
    op('SELECT * FROM ai_questions WHERE id=?',requestId),
  ]); } catch(error) {
    for(const code of ['QUESTION_IN_PROGRESS','INSUFFICIENT_AI_CREDITS','FREE_QUOTA_EXHAUSTED'])if(String(error.message).includes(code))throw new Error(code);
    throw error;
  }
  const previous=results[2].results[0];
  if(!previous||previous.member_id!==member.id||previous.conversation_id!==conversationId||previous.question_text!==question)throw new Error('INVALID_REQUEST_ID');
  return {kind:previous.reservation_token===reservationToken?'reserved':previous.status==='completed'?'cached':'pending',
    response:previous.response_json?JSON.parse(previous.response_json):null,chargeType:previous.charge_type,
    reservationToken:previous.reservation_token,quota:await aiQuota(member)};
}
export async function aiConversation(member,conversationId) {
  if(!/^[a-f0-9-]{36}$/i.test(conversationId))throw new Error('INVALID_CONVERSATION_ID');
  const row=await storage.first('SELECT member_id,chat_id,checkpoint_id FROM ai_conversations WHERE id=?',conversationId);
  if(row&&row.member_id!==member.id)throw new Error('INVALID_CONVERSATION_ID');
  return row?{chatId:row.chat_id,checkpointId:row.checkpoint_id}:null;
}
export async function latestAiConversation(member) {
  if(!member)return null;
  return (await storage.first('SELECT id FROM ai_conversations WHERE member_id=? ORDER BY updated_at DESC LIMIT 1',member.id))?.id??null;
}
export async function aiHistory(member,conversationId) {
  if(!member||!conversationId)return [];
  if(!/^[a-f0-9-]{36}$/i.test(conversationId))throw new Error('INVALID_CONVERSATION_ID');
  const rows=await storage.all("SELECT id,question_text,response_json,created_at FROM ai_questions WHERE member_id=? AND conversation_id=? AND status='completed' ORDER BY created_at DESC LIMIT 30",member.id,conversationId);
  return rows.reverse().flatMap(row=>{
    if(!row.response_json||!row.question_text)return [];
    let answer;try{answer=JSON.parse(row.response_json);}catch{return [];}
    return [{id:`${row.id}:question`,role:'user',text:row.question_text,at:row.created_at},
      {id:`${row.id}:answer`,role:'assistant',text:answer.answer,sources:answer.sources??[],chargeType:answer.chargeType,at:answer.generatedAt}];
  });
}
export async function completeAiQuestion(member,requestId,response,conversation=null,reservationToken) {
  if(!reservationToken)throw new Error('REQUEST_UNAVAILABLE');
  const queries=[op("UPDATE ai_questions SET status='completed',response_json=? WHERE id=? AND member_id=? AND status='pending' AND reservation_token=?",
    JSON.stringify(response),requestId,member.id,reservationToken)];
  if(conversation?.chatId)queries.push(op(`INSERT INTO ai_conversations (id,member_id,chat_id,checkpoint_id,updated_at)
    SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM ai_questions WHERE id=? AND member_id=? AND status='completed' AND reservation_token=? AND response_json=?)
    ON CONFLICT(id) DO UPDATE SET chat_id=excluded.chat_id,checkpoint_id=excluded.checkpoint_id,updated_at=excluded.updated_at WHERE member_id=excluded.member_id`,
    conversation.id,member.id,conversation.chatId,conversation.checkpointId??null,new Date().toISOString(),requestId,member.id,reservationToken,JSON.stringify(response)));
  const result=await storage.batch(queries);
  if(!result[0].changes)throw new Error('REQUEST_UNAVAILABLE');
  return aiQuota(member);
}
export async function releaseAiQuestion(member,requestId,reservationToken) {
  if(reservationToken)await storage.run("DELETE FROM ai_questions WHERE id=? AND member_id=? AND status='pending' AND reservation_token=?",requestId,member.id,reservationToken);
  return aiQuota(member);
}
export async function grantAiCredits(admin,memberId,amount,requestId,note='') {
  if(!isAdmin(admin))throw new Error('FORBIDDEN');
  if(!Number.isInteger(amount)||amount<1||amount>1000)throw new Error('INVALID_CREDIT_AMOUNT');
  if(typeof note!=='string'||note.length>200)throw new Error('INVALID_NOTE');
  note=note.trim();
  const id=digest(`credit-grant:${admin.id}:${adminRequestId(requestId)}`);
  if(!await memberById(memberId))throw new Error('REQUEST_UNAVAILABLE');
  const result=await storage.batch([
    op(`INSERT OR IGNORE INTO admin_credit_grants(id,actor_id,member_id,amount,note,created_at)
      VALUES(?,?,?,?,?,?)`,id,admin.id,memberId,amount,note,new Date().toISOString()),
    op('SELECT actor_id,member_id,amount,note,applied FROM admin_credit_grants WHERE id=?',id),
    op('SELECT balance FROM ai_credit_accounts WHERE member_id=?',memberId),
  ]);
  const grant=result[1].results[0];
  if(!grant||grant.actor_id!==admin.id||grant.member_id!==memberId||grant.amount!==amount||grant.note!==note||grant.applied!==1)
    throw new Error('INVALID_REQUEST_ID');
  return result[2].results[0].balance;
}
