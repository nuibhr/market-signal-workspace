CREATE TABLE IF NOT EXISTS partner_account_leads (
  id TEXT PRIMARY KEY,
  member_id TEXT,
  broker_id TEXT NOT NULL,
  broker_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  line_id TEXT,
  email TEXT,
  interests TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','in_progress','account_opened','cancelled')),
  notes TEXT,
  lead_type TEXT NOT NULL DEFAULT 'new_account',
  account_no TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS partner_leads_broker ON partner_account_leads(broker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS partner_leads_status ON partner_account_leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS partner_leads_type ON partner_account_leads(lead_type, created_at DESC);
