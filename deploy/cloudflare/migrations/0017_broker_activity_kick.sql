-- Track verified broker trading activity and VIP revocation for partner-broker auto-kick.
ALTER TABLE members ADD COLUMN broker_trade_checked_at TEXT;
ALTER TABLE members ADD COLUMN broker_last_trade_at TEXT;
ALTER TABLE members ADD COLUMN vip_revoked_reason TEXT;
ALTER TABLE members ADD COLUMN vip_revoked_at TEXT;

