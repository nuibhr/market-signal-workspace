-- Partner/Co-Admin 30% Affiliate Program & Referral Attribution
ALTER TABLE members ADD COLUMN referred_by_code TEXT;
ALTER TABLE members ADD COLUMN referred_by_member_id TEXT;
ALTER TABLE members ADD COLUMN referred_at TEXT;

CREATE TABLE IF NOT EXISTS affiliate_partners (
  member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  commission_rate_pct REAL NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused')),
  payout_note TEXT,
  created_by TEXT REFERENCES members(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id TEXT PRIMARY KEY,
  affiliate_member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  referred_member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  interval TEXT NOT NULL DEFAULT 'month',
  invoice_id TEXT NOT NULL UNIQUE,
  stripe_event_id TEXT NOT NULL,
  gross_amount_thb REAL NOT NULL,
  commission_rate_pct REAL NOT NULL DEFAULT 30,
  commission_thb REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled')),
  payout_note TEXT,
  paid_at TEXT,
  paid_by TEXT REFERENCES members(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS members_referred_by_idx ON members(referred_by_member_id);
CREATE INDEX IF NOT EXISTS affiliate_commissions_partner_idx ON affiliate_commissions(affiliate_member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_commissions_status_idx ON affiliate_commissions(status, created_at DESC);
