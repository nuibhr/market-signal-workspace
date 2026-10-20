-- Existing local billing tables retain their limits; add the explicit paid-plan hard cap.
ALTER TABLE member_ai_limits ADD COLUMN allow_extra_credits INTEGER NOT NULL DEFAULT 1 CHECK(allow_extra_credits IN (0,1));
DROP TRIGGER ai_reservation_guard;
CREATE TRIGGER ai_reservation_guard BEFORE INSERT ON ai_questions WHEN NEW.status='pending' BEGIN
 SELECT RAISE(ABORT,'QUESTION_IN_PROGRESS') WHERE EXISTS(SELECT 1 FROM ai_questions WHERE member_id=NEW.member_id AND status='pending');
 SELECT RAISE(ABORT,'FREE_QUOTA_EXHAUSTED') WHERE NEW.charge_type='free' AND (SELECT COUNT(*) FROM ai_questions WHERE member_id=NEW.member_id AND day_key=NEW.day_key AND charge_type='free')>=COALESCE((SELECT free_daily_limit FROM member_ai_limits WHERE member_id=NEW.member_id),5);
 SELECT RAISE(ABORT,'AI_QUOTA_EXHAUSTED') WHERE NEW.charge_type='credit' AND COALESCE((SELECT allow_extra_credits FROM member_ai_limits WHERE member_id=NEW.member_id),1)=0;
 SELECT RAISE(ABORT,'INSUFFICIENT_AI_CREDITS') WHERE NEW.charge_type='credit' AND COALESCE((SELECT balance FROM ai_credit_accounts WHERE member_id=NEW.member_id),0)<1;
END;
