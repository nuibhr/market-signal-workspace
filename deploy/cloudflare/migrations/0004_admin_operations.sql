-- Admin operations are additive. Imported completed grants never replay their credit effect.
ALTER TABLE monthly_codes ADD COLUMN revoked_at TEXT;
ALTER TABLE monthly_codes ADD COLUMN revoked_by TEXT REFERENCES members(id);
CREATE TABLE admin_credit_grants (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES members(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 1000),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0 CHECK(applied IN (0,1))
);
CREATE TRIGGER admin_credit_grant_apply AFTER INSERT ON admin_credit_grants WHEN NEW.applied=0 BEGIN
  INSERT INTO ai_credit_accounts(member_id,balance) VALUES(NEW.member_id,NEW.amount)
    ON CONFLICT(member_id) DO UPDATE SET balance=balance+excluded.balance;
  INSERT INTO ai_credit_events(id,member_id,actor_id,amount,balance_after,reason,created_at)
    SELECT 'admin-grant:'||NEW.id,NEW.member_id,NEW.actor_id,NEW.amount,balance,'admin-grant',NEW.created_at
    FROM ai_credit_accounts WHERE member_id=NEW.member_id;
  UPDATE admin_credit_grants SET applied=1 WHERE id=NEW.id;
END;
CREATE INDEX admin_grants_member_recent ON admin_credit_grants(member_id,created_at DESC);
CREATE INDEX membership_events_member_recent ON membership_events(member_id,created_at DESC,id DESC);
CREATE INDEX membership_events_recent ON membership_events(created_at DESC,id DESC);
CREATE INDEX ai_credit_events_member_recent ON ai_credit_events(member_id,created_at DESC,id DESC);
CREATE INDEX monthly_codes_member_recent ON monthly_codes(member_id,created_at DESC);
CREATE INDEX renewals_status_recent ON renewal_requests(status,created_at DESC,id DESC);
CREATE INDEX members_recent ON members(updated_at DESC,id DESC);
