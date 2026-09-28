import { DatabaseSync } from 'node:sqlite';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DAY = 86_400_000;
let database;

function db() {
  if (database) return database;
  const path = resolve(process.cwd(), process.env.DATABASE_PATH || './data/nugaom.sqlite');
  mkdirSync(dirname(path), { recursive: true });
  database = new DatabaseSync(path);
  database.exec(`PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      line_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      picture_url TEXT,
      broker TEXT,
      portfolio_hash TEXT UNIQUE,
      portfolio_last4 TEXT,
      portfolio_status TEXT NOT NULL DEFAULT 'missing',
      portfolio_submitted_at TEXT,
      portfolio_verified_at TEXT,
      trial_started_at TEXT,
      trial_ends_at TEXT,
      subscription_ends_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS monthly_codes (
      code_hash TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id),
      created_by TEXT NOT NULL REFERENCES members(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      redeemed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS renewal_requests (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id),
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      resolved_by TEXT REFERENCES members(id)
    );
    CREATE TABLE IF NOT EXISTS membership_events (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id),
      actor_id TEXT REFERENCES members(id),
      event_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      details TEXT
    );
    CREATE TABLE IF NOT EXISTS ai_credit_accounts (
      member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
      balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0)
    );
    CREATE TABLE IF NOT EXISTS ai_credit_events (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      actor_id TEXT REFERENCES members(id),
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_questions (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      conversation_id TEXT,
      question_text TEXT,
      day_key TEXT NOT NULL,
      charge_type TEXT NOT NULL CHECK(charge_type IN ('free','credit')),
      status TEXT NOT NULL CHECK(status IN ('pending','completed')),
      created_at TEXT NOT NULL,
      response_json TEXT
    );
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      chat_id TEXT NOT NULL,
      checkpoint_id TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ai_questions_member_day ON ai_questions(member_id,day_key,status);`);
  const questionColumns = new Set(database.prepare('PRAGMA table_info(ai_questions)').all().map(column => column.name));
  if (!questionColumns.has('conversation_id')) database.exec('ALTER TABLE ai_questions ADD COLUMN conversation_id TEXT');
  if (!questionColumns.has('question_text')) database.exec('ALTER TABLE ai_questions ADD COLUMN question_text TEXT');
  database.exec('CREATE INDEX IF NOT EXISTS ai_questions_conversation ON ai_questions(member_id,conversation_id,created_at)');
  return database;
}

// Shared persistent connection for membership and the signal/event ledger.
export function sharedDatabase() { return db(); }

export function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function sessionDigest(value) { return createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('hex'); }
export function token() { return randomBytes(32).toString('base64url'); }
export function isConfigured() {
  return Boolean(process.env.LINE_CHANNEL_ID && process.env.LINE_CHANNEL_SECRET && process.env.LINE_REDIRECT_URI && process.env.SESSION_SECRET?.length >= 32 && process.env.PORTFOLIO_HASH_SECRET?.length >= 32);
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
export function upsertLineMember({ lineId, displayName, pictureUrl }) {
  const now = new Date().toISOString();
  db().prepare(`INSERT INTO members (id,line_id,display_name,picture_url,created_at,updated_at)
    VALUES (?,?,?,?,?,?) ON CONFLICT(line_id) DO UPDATE SET display_name=excluded.display_name,
    picture_url=excluded.picture_url,updated_at=excluded.updated_at`).run(token(), lineId, displayName.slice(0, 80), pictureUrl || null, now, now);
  return db().prepare('SELECT * FROM members WHERE line_id=?').get(lineId);
}
export function createSession(memberId) {
  const value = token();
  const expiresAt = new Date(Date.now() + 30 * DAY).toISOString();
  db().prepare('INSERT INTO sessions (token_hash,member_id,expires_at) VALUES (?,?,?)').run(sessionDigest(value), memberId, expiresAt);
  return { value, expiresAt };
}
export function sessionMember(value) {
  if (!value) return null;
  return db().prepare(`SELECT m.* FROM sessions s JOIN members m ON m.id=s.member_id
    WHERE s.token_hash=? AND s.expires_at>?`).get(sessionDigest(value), new Date().toISOString()) || null;
}
export function deleteSession(value) { if (value) db().prepare('DELETE FROM sessions WHERE token_hash=?').run(sessionDigest(value)); }
export function isAdmin(member) { return Boolean(member && process.env.ADMIN_LINE_IDS?.split(',').map(id => id.trim()).includes(member.line_id)); }

function event(memberId, actorId, eventType, details = null) {
  db().prepare('INSERT INTO membership_events VALUES (?,?,?,?,?,?)').run(token(), memberId, actorId, eventType, new Date().toISOString(), details);
}
function transaction(action) {
  db().exec('BEGIN IMMEDIATE');
  try { const result = action(); db().exec('COMMIT'); return result; }
  catch (error) { db().exec('ROLLBACK'); throw error; }
}
export function submitPortfolio(member, brokerInput, numberInput) {
  const broker = String(brokerInput ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!/^[\p{L}\p{M}\p{N} .&-]{2,40}$/u.test(broker)) throw new Error('INVALID_BROKER');
  const number = normalizePortfolio(numberInput);
  const hash = portfolioDigest(broker, number);
  return transaction(() => {
    const current = db().prepare('SELECT * FROM members WHERE id=?').get(member.id);
    if (current.portfolio_hash && current.portfolio_hash !== hash) throw new Error('PORTFOLIO_CHANGE_REQUIRES_ADMIN');
    const existing = db().prepare('SELECT id FROM members WHERE portfolio_hash=?').get(hash);
    if (existing && existing.id !== member.id) throw new Error('PORTFOLIO_ALREADY_USED');
    const now = new Date().toISOString();
    const trialEnd = current.trial_ends_at || new Date(Date.now() + 14 * DAY).toISOString();
    db().prepare(`UPDATE members SET broker=?,portfolio_hash=?,portfolio_last4=?,portfolio_status=CASE WHEN portfolio_status='verified' THEN 'verified' ELSE 'pending' END,
      portfolio_submitted_at=COALESCE(portfolio_submitted_at,?),trial_started_at=COALESCE(trial_started_at,?),trial_ends_at=COALESCE(trial_ends_at,?),updated_at=? WHERE id=?`)
      .run(broker, hash, number.slice(-4), now, now, trialEnd, now, member.id);
    event(member.id, member.id, 'portfolio_submitted', broker);
    return db().prepare('SELECT * FROM members WHERE id=?').get(member.id);
  });
}
export function listAdminMembers() {
  return db().prepare(`SELECT m.id,m.display_name,m.broker,m.portfolio_last4,m.portfolio_status,m.trial_ends_at,m.subscription_ends_at,m.created_at,COALESCE(c.balance,0) AS ai_credits
    FROM members m LEFT JOIN ai_credit_accounts c ON c.member_id=m.id WHERE m.portfolio_hash IS NOT NULL ORDER BY CASE m.portfolio_status WHEN 'pending' THEN 0 ELSE 1 END,m.updated_at DESC LIMIT 100`).all();
}
export function verifyPortfolio(admin, memberId, numberInput) {
  const number = normalizePortfolio(numberInput);
  return transaction(() => {
    const member = db().prepare('SELECT * FROM members WHERE id=?').get(memberId);
    if (!member?.portfolio_hash || member.portfolio_hash !== portfolioDigest(member.broker, number)) throw new Error('PORTFOLIO_MISMATCH');
    const now = new Date().toISOString();
    db().prepare("UPDATE members SET portfolio_status='verified',portfolio_verified_at=?,updated_at=? WHERE id=?").run(now, now, memberId);
    event(memberId, admin.id, 'portfolio_verified');
  });
}
export function rejectPortfolio(admin, memberId) {
  return transaction(() => {
    const member = db().prepare('SELECT * FROM members WHERE id=?').get(memberId);
    if (!member || member.portfolio_status !== 'pending') throw new Error('REQUEST_UNAVAILABLE');
    db().prepare("UPDATE members SET broker=NULL,portfolio_hash=NULL,portfolio_last4=NULL,portfolio_status='missing',portfolio_submitted_at=NULL,updated_at=? WHERE id=?")
      .run(new Date().toISOString(), memberId);
    event(memberId, admin.id, 'portfolio_rejected');
  });
}
function extendMonth(member) {
  const start = member.subscription_ends_at && Date.parse(member.subscription_ends_at) > Date.now() ? new Date(member.subscription_ends_at) : new Date();
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 2, 0)).getUTCDate();
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, Math.min(start.getUTCDate(), lastDay),
    start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), start.getUTCMilliseconds()));
  db().prepare('UPDATE members SET subscription_ends_at=?,updated_at=? WHERE id=?').run(end.toISOString(), new Date().toISOString(), member.id);
  return end.toISOString();
}
export function issueCode(admin, memberId) {
  return transaction(() => {
    const member = db().prepare('SELECT * FROM members WHERE id=?').get(memberId);
    if (!member || member.portfolio_status !== 'verified') throw new Error('PORTFOLIO_NOT_VERIFIED');
    const code = `NUG-${randomBytes(12).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();
    db().prepare('INSERT INTO monthly_codes VALUES (?,?,?,?,?,NULL)').run(digest(code), member.id, admin.id, now, new Date(Date.now() + 30 * DAY).toISOString());
    event(member.id, admin.id, 'code_issued');
    return code;
  });
}
export function redeemCode(member, codeInput) {
  const code = String(codeInput ?? '').trim().toUpperCase();
  if (!/^NUG-[A-F0-9]{24}$/.test(code)) throw new Error('INVALID_CODE');
  return transaction(() => {
    const current = db().prepare('SELECT * FROM members WHERE id=?').get(member.id);
    if (current.portfolio_status !== 'verified') throw new Error('PORTFOLIO_NOT_VERIFIED');
    const record = db().prepare('SELECT * FROM monthly_codes WHERE code_hash=?').get(digest(code));
    if (!record || record.member_id !== member.id || record.redeemed_at || record.expires_at <= new Date().toISOString()) throw new Error('CODE_UNAVAILABLE');
    db().prepare('UPDATE monthly_codes SET redeemed_at=? WHERE code_hash=?').run(new Date().toISOString(), record.code_hash);
    const endsAt = extendMonth(current);
    event(member.id, member.id, 'code_redeemed', endsAt);
    return endsAt;
  });
}
export function requestRenewal(member) {
  return transaction(() => {
    if (member.portfolio_status !== 'verified') throw new Error('PORTFOLIO_NOT_VERIFIED');
    const existing = db().prepare("SELECT id FROM renewal_requests WHERE member_id=? AND status='pending'").get(member.id);
    if (existing) return existing.id;
    const id = token();
    db().prepare('INSERT INTO renewal_requests (id,member_id,created_at) VALUES (?,?,?)').run(id, member.id, new Date().toISOString());
    event(member.id, member.id, 'renewal_requested');
    return id;
  });
}
export function listRenewals() {
  return db().prepare(`SELECT r.id,r.member_id,r.created_at,m.display_name,m.broker,m.portfolio_last4
    FROM renewal_requests r JOIN members m ON m.id=r.member_id WHERE r.status='pending' ORDER BY r.created_at LIMIT 100`).all();
}
export function approveRenewal(admin, requestId) {
  return transaction(() => {
    const request = db().prepare('SELECT * FROM renewal_requests WHERE id=? AND status=?').get(requestId, 'pending');
    if (!request) throw new Error('REQUEST_UNAVAILABLE');
    const member = db().prepare('SELECT * FROM members WHERE id=?').get(request.member_id);
    if (member.portfolio_status !== 'verified') throw new Error('PORTFOLIO_NOT_VERIFIED');
    db().prepare("UPDATE renewal_requests SET status='approved',resolved_at=?,resolved_by=? WHERE id=?").run(new Date().toISOString(), admin.id, requestId);
    const endsAt = extendMonth(member);
    event(member.id, admin.id, 'renewal_approved', endsAt);
    return endsAt;
  });
}
export function rejectRenewal(admin, requestId) {
  return transaction(() => {
    const request = db().prepare('SELECT * FROM renewal_requests WHERE id=? AND status=?').get(requestId, 'pending');
    if (!request) throw new Error('REQUEST_UNAVAILABLE');
    db().prepare("UPDATE renewal_requests SET status='rejected',resolved_at=?,resolved_by=? WHERE id=?").run(new Date().toISOString(), admin.id, requestId);
    event(request.member_id, admin.id, 'renewal_rejected');
  });
}
export function accountSummary(member) {
  if (!member) return null;
  const renewal = db().prepare("SELECT id,created_at FROM renewal_requests WHERE member_id=? AND status='pending'").get(member.id);
  return { id: member.id, displayName: member.display_name, pictureUrl: member.picture_url,
    broker: member.broker, portfolioLast4: member.portfolio_last4, portfolioStatus: member.portfolio_status,
    trialStartedAt: member.trial_started_at, trialEndsAt: member.trial_ends_at,
    subscriptionEndsAt: member.subscription_ends_at, renewalPending: Boolean(renewal), admin: isAdmin(member) };
}

const AI_FREE_DAILY = 5;
function bangkokDay() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function creditBalance(memberId) {
  return db().prepare('SELECT balance FROM ai_credit_accounts WHERE member_id=?').get(memberId)?.balance ?? 0;
}
function creditChange(memberId, amount, actorId, reason) {
  db().prepare('INSERT INTO ai_credit_accounts (member_id,balance) VALUES (?,0) ON CONFLICT(member_id) DO NOTHING').run(memberId);
  const changed = db().prepare('UPDATE ai_credit_accounts SET balance=balance+? WHERE member_id=? AND balance+?>=0').run(amount, memberId, amount);
  if (!changed.changes) throw new Error('INSUFFICIENT_AI_CREDITS');
  const balance = creditBalance(memberId);
  db().prepare('INSERT INTO ai_credit_events VALUES (?,?,?,?,?,?,?)').run(token(), memberId, actorId, amount, balance, reason, new Date().toISOString());
  return balance;
}
export function aiQuota(member) {
  if (!member) return { freeLimit: AI_FREE_DAILY, freeUsed: 0, freeRemaining: 0, credits: 0, day: bangkokDay() };
  const day = bangkokDay();
  const freeUsed = db().prepare("SELECT COUNT(*) AS n FROM ai_questions WHERE member_id=? AND day_key=? AND charge_type='free'").get(member.id, day).n;
  return { freeLimit: AI_FREE_DAILY, freeUsed, freeRemaining: Math.max(0, AI_FREE_DAILY - freeUsed), credits: creditBalance(member.id), day };
}
export function reserveAiQuestion(member, requestId, question, conversationId) {
  if (!/^[a-f0-9-]{36}$/i.test(requestId)) throw new Error('INVALID_REQUEST_ID');
  if (!/^[a-f0-9-]{36}$/i.test(conversationId) || typeof question !== 'string' || question.length < 3 || question.length > 700) throw new Error('INVALID_REQUEST');
  return transaction(() => {
    // Reclaim interrupted provider calls so a crash cannot strand a free slot or credit.
    const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
    const abandoned = db().prepare("SELECT id,charge_type FROM ai_questions WHERE member_id=? AND status='pending' AND created_at<?").all(member.id, cutoff);
    for (const item of abandoned) {
      db().prepare('DELETE FROM ai_questions WHERE id=?').run(item.id);
      if (item.charge_type === 'credit') creditChange(member.id, 1, null, 'interrupted-question-refund');
    }
    const previous = db().prepare('SELECT * FROM ai_questions WHERE id=?').get(requestId);
    if (previous) {
      if (previous.member_id !== member.id) throw new Error('INVALID_REQUEST_ID');
      return { kind: previous.status === 'completed' ? 'cached' : 'pending', response: previous.response_json ? JSON.parse(previous.response_json) : null, quota: aiQuota(member) };
    }
    const active = db().prepare("SELECT id FROM ai_questions WHERE member_id=? AND status='pending' LIMIT 1").get(member.id);
    if (active) throw new Error('QUESTION_IN_PROGRESS');
    const quota = aiQuota(member);
    const chargeType = quota.freeRemaining > 0 ? 'free' : 'credit';
    if (chargeType === 'credit') creditChange(member.id, -1, member.id, `ai-question:${requestId}`);
    db().prepare('INSERT INTO ai_questions (id,member_id,conversation_id,question_text,day_key,charge_type,status,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(requestId, member.id, conversationId, question, quota.day, chargeType, 'pending', new Date().toISOString());
    return { kind: 'reserved', chargeType, quota: aiQuota(member) };
  });
}
export function aiConversation(member, conversationId) {
  if (!/^[a-f0-9-]{36}$/i.test(conversationId)) throw new Error('INVALID_CONVERSATION_ID');
  const row = db().prepare('SELECT member_id,chat_id,checkpoint_id FROM ai_conversations WHERE id=?').get(conversationId);
  if (row && row.member_id !== member.id) throw new Error('INVALID_CONVERSATION_ID');
  return row ? { chatId: row.chat_id, checkpointId: row.checkpoint_id } : null;
}
export function latestAiConversation(member) {
  if (!member) return null;
  return db().prepare('SELECT id FROM ai_conversations WHERE member_id=? ORDER BY updated_at DESC LIMIT 1').get(member.id)?.id ?? null;
}
export function aiHistory(member, conversationId) {
  if (!member || !conversationId) return [];
  if (!/^[a-f0-9-]{36}$/i.test(conversationId)) throw new Error('INVALID_CONVERSATION_ID');
  const rows = db().prepare("SELECT id,question_text,response_json,created_at FROM ai_questions WHERE member_id=? AND conversation_id=? AND status='completed' ORDER BY created_at DESC LIMIT 30").all(member.id, conversationId);
  return rows.reverse().flatMap(row => {
    if (!row.response_json || !row.question_text) return [];
    let answer;
    try { answer = JSON.parse(row.response_json); } catch { return []; }
    return [{ id: `${row.id}:question`, role: 'user', text: row.question_text, at: row.created_at },
      { id: `${row.id}:answer`, role: 'assistant', text: answer.answer, sources: answer.sources ?? [], chargeType: answer.chargeType, at: answer.generatedAt }];
  });
}
export function completeAiQuestion(member, requestId, response, conversation = null) {
  return transaction(() => {
    if (conversation?.chatId) db().prepare(`INSERT INTO ai_conversations (id,member_id,chat_id,checkpoint_id,updated_at) VALUES (?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET chat_id=excluded.chat_id,checkpoint_id=excluded.checkpoint_id,updated_at=excluded.updated_at WHERE member_id=excluded.member_id`)
      .run(conversation.id, member.id, conversation.chatId, conversation.checkpointId, new Date().toISOString());
    const updated = db().prepare("UPDATE ai_questions SET status='completed',response_json=? WHERE id=? AND member_id=? AND status='pending'")
      .run(JSON.stringify(response), requestId, member.id);
    if (!updated.changes) throw new Error('REQUEST_UNAVAILABLE');
    return aiQuota(member);
  });
}
export function releaseAiQuestion(member, requestId) {
  return transaction(() => {
    const item = db().prepare('SELECT charge_type FROM ai_questions WHERE id=? AND member_id=? AND status=?').get(requestId, member.id, 'pending');
    if (!item) return aiQuota(member);
    db().prepare('DELETE FROM ai_questions WHERE id=?').run(requestId);
    if (item.charge_type === 'credit') creditChange(member.id, 1, null, `ai-question-refund:${requestId}`);
    return aiQuota(member);
  });
}
export function grantAiCredits(admin, memberId, amount) {
  if (!isAdmin(admin)) throw new Error('FORBIDDEN');
  if (!Number.isInteger(amount) || amount < 1 || amount > 1000) throw new Error('INVALID_CREDIT_AMOUNT');
  return transaction(() => {
    const member = db().prepare('SELECT id FROM members WHERE id=?').get(memberId);
    if (!member) throw new Error('REQUEST_UNAVAILABLE');
    return creditChange(memberId, amount, admin.id, 'admin-grant');
  });
}
