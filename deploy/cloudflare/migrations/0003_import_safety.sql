-- Historical completed answers are records, not new credit reservations.
DROP TRIGGER ai_reservation_guard;
DROP TRIGGER ai_reservation_charge;
CREATE TRIGGER ai_reservation_guard BEFORE INSERT ON ai_questions WHEN NEW.status='pending' BEGIN
  SELECT RAISE(ABORT,'QUESTION_IN_PROGRESS') WHERE EXISTS(SELECT 1 FROM ai_questions WHERE member_id=NEW.member_id AND status='pending');
  SELECT RAISE(ABORT,'FREE_QUOTA_EXHAUSTED') WHERE NEW.charge_type='free' AND (SELECT COUNT(*) FROM ai_questions WHERE member_id=NEW.member_id AND day_key=NEW.day_key AND charge_type='free')>=5;
  SELECT RAISE(ABORT,'INSUFFICIENT_AI_CREDITS') WHERE NEW.charge_type='credit' AND COALESCE((SELECT balance FROM ai_credit_accounts WHERE member_id=NEW.member_id),0)<1;
END;
CREATE TRIGGER ai_reservation_charge AFTER INSERT ON ai_questions WHEN NEW.status='pending' AND NEW.charge_type='credit' BEGIN
  UPDATE ai_credit_accounts SET balance=balance-1 WHERE member_id=NEW.member_id;
  INSERT INTO ai_credit_events(id,member_id,actor_id,amount,balance_after,reason,created_at)
    SELECT 'ai-charge:'||NEW.id||':'||NEW.reservation_token,NEW.member_id,NEW.member_id,-1,balance,'ai-question',NEW.created_at
    FROM ai_credit_accounts WHERE member_id=NEW.member_id;
END;
