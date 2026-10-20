-- Additive billing records; existing membership dates and customer ledgers are preserved.
CREATE TABLE billing_customers (
 member_id TEXT NOT NULL REFERENCES members(id), mode TEXT NOT NULL CHECK(mode IN ('test','live')),
 customer_id TEXT NOT NULL, PRIMARY KEY(member_id,mode), UNIQUE(customer_id,mode)
);
CREATE TABLE billing_subscriptions (
 subscription_id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), mode TEXT NOT NULL,
 plan_id TEXT, status TEXT NOT NULL, paid_until TEXT, cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
 last_event_created INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
);
CREATE INDEX billing_member ON billing_subscriptions(member_id,mode,paid_until);
CREATE TABLE billing_events (event_id TEXT PRIMARY KEY, mode TEXT NOT NULL, event_created INTEGER NOT NULL, mutation_token TEXT NOT NULL, received_at TEXT NOT NULL);
CREATE TABLE billing_checkouts (
 member_id TEXT NOT NULL REFERENCES members(id), mode TEXT NOT NULL, plan_id TEXT NOT NULL, request_key TEXT NOT NULL,
 session_id TEXT, url TEXT, expires_at INTEGER NOT NULL, lease_until INTEGER NOT NULL, PRIMARY KEY(member_id,mode)
);
CREATE TABLE member_ai_limits(member_id TEXT PRIMARY KEY REFERENCES members(id),free_daily_limit INTEGER NOT NULL CHECK(free_daily_limit>=0 AND free_daily_limit<=500));
DROP TRIGGER ai_reservation_guard;
CREATE TRIGGER ai_reservation_guard BEFORE INSERT ON ai_questions WHEN NEW.status='pending' BEGIN
 SELECT RAISE(ABORT,'QUESTION_IN_PROGRESS') WHERE EXISTS(SELECT 1 FROM ai_questions WHERE member_id=NEW.member_id AND status='pending');
 SELECT RAISE(ABORT,'FREE_QUOTA_EXHAUSTED') WHERE NEW.charge_type='free' AND (SELECT COUNT(*) FROM ai_questions WHERE member_id=NEW.member_id AND day_key=NEW.day_key AND charge_type='free')>=COALESCE((SELECT free_daily_limit FROM member_ai_limits WHERE member_id=NEW.member_id),5);
 SELECT RAISE(ABORT,'INSUFFICIENT_AI_CREDITS') WHERE NEW.charge_type='credit' AND COALESCE((SELECT balance FROM ai_credit_accounts WHERE member_id=NEW.member_id),0)<1;
END;
