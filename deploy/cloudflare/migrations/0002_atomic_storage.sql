-- Additive migration; no customer records or credentials in this file.
ALTER TABLE members ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN mutation_key TEXT;
ALTER TABLE monthly_codes ADD COLUMN redemption_token TEXT;
ALTER TABLE renewal_requests ADD COLUMN resolution_token TEXT;
ALTER TABLE ai_questions ADD COLUMN reservation_token TEXT;
ALTER TABLE auto_pick_signals ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE auto_pick_signals ADD COLUMN mutation_key TEXT;
CREATE UNIQUE INDEX renewal_one_pending ON renewal_requests(member_id) WHERE status='pending';
CREATE UNIQUE INDEX ai_one_pending ON ai_questions(member_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS auto_pick_signals_closed ON auto_pick_signals(market,exited_at DESC,id DESC) WHERE status IN ('TARGET','STOP','EXIT');
CREATE TABLE customer_favorites (
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  market TEXT NOT NULL, symbol TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY(member_id,market,symbol)
);
CREATE TABLE customer_preferences (
  member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  favorites_imported_at TEXT,
  favorites_import_token TEXT
);
CREATE TRIGGER ai_reservation_guard BEFORE INSERT ON ai_questions BEGIN
  SELECT RAISE(ABORT,'QUESTION_IN_PROGRESS') WHERE EXISTS(SELECT 1 FROM ai_questions WHERE member_id=NEW.member_id AND status='pending');
  SELECT RAISE(ABORT,'FREE_QUOTA_EXHAUSTED') WHERE NEW.charge_type='free' AND (SELECT COUNT(*) FROM ai_questions WHERE member_id=NEW.member_id AND day_key=NEW.day_key AND charge_type='free')>=5;
  SELECT RAISE(ABORT,'INSUFFICIENT_AI_CREDITS') WHERE NEW.charge_type='credit' AND COALESCE((SELECT balance FROM ai_credit_accounts WHERE member_id=NEW.member_id),0)<1;
END;
CREATE TRIGGER ai_reservation_charge AFTER INSERT ON ai_questions WHEN NEW.charge_type='credit' BEGIN
  UPDATE ai_credit_accounts SET balance=balance-1 WHERE member_id=NEW.member_id;
  INSERT INTO ai_credit_events(id,member_id,actor_id,amount,balance_after,reason,created_at)
    SELECT 'ai-charge:'||NEW.id||':'||COALESCE(NEW.reservation_token,NEW.created_at),NEW.member_id,NEW.member_id,-1,balance,'ai-question',NEW.created_at
    FROM ai_credit_accounts WHERE member_id=NEW.member_id;
END;
CREATE TRIGGER ai_reservation_refund AFTER DELETE ON ai_questions WHEN OLD.status='pending' AND OLD.charge_type='credit' BEGIN
  UPDATE ai_credit_accounts SET balance=balance+1 WHERE member_id=OLD.member_id;
  INSERT INTO ai_credit_events(id,member_id,actor_id,amount,balance_after,reason,created_at)
    SELECT 'ai-refund:'||OLD.id||':'||COALESCE(OLD.reservation_token,OLD.created_at),OLD.member_id,NULL,1,balance,'interrupted-question-refund',strftime('%Y-%m-%dT%H:%M:%fZ','now')
    FROM ai_credit_accounts WHERE member_id=OLD.member_id;
END;
CREATE TRIGGER signal_event_no_update BEFORE UPDATE ON auto_pick_events BEGIN
  SELECT RAISE(ABORT,'IMMUTABLE_SIGNAL_EVENT');
END;
CREATE TRIGGER signal_event_no_delete BEFORE DELETE ON auto_pick_events BEGIN
  SELECT RAISE(ABORT,'IMMUTABLE_SIGNAL_EVENT');
END;
