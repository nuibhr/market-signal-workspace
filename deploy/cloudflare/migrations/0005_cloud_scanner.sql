CREATE TABLE scanner_jobs (
  id TEXT PRIMARY KEY,market TEXT NOT NULL,session_key TEXT NOT NULL,slot TEXT NOT NULL,
  payload_json TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,
  available_at INTEGER NOT NULL,lease_until INTEGER,lease_token TEXT,last_enqueued_at INTEGER,
  error_code TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE INDEX scanner_jobs_dispatch ON scanner_jobs(state,available_at,lease_until);
CREATE INDEX scanner_jobs_market ON scanner_jobs(market,updated_at DESC);
CREATE TABLE provider_cache (id TEXT PRIMARY KEY,payload_json TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX provider_cache_expiry ON provider_cache(expires_at);
CREATE TABLE cloud_scanner_state (id INTEGER PRIMARY KEY CHECK(id=1),last_scheduled_at TEXT,last_consumed_at TEXT,cron TEXT,dispatch_count INTEGER NOT NULL DEFAULT 0);
