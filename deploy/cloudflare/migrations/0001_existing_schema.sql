-- Schema only: generated from existing app. No customer data or secrets.
CREATE TABLE ai_conversations (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      chat_id TEXT NOT NULL,
      checkpoint_id TEXT,
      updated_at TEXT NOT NULL
    );

CREATE TABLE ai_credit_accounts (
      member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
      balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0)
    );

CREATE TABLE ai_credit_events (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      actor_id TEXT REFERENCES members(id),
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

CREATE TABLE ai_questions (
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

CREATE TABLE auto_pick_decisions (
      run_id TEXT NOT NULL REFERENCES auto_pick_runs(id), symbol TEXT NOT NULL,
      decision TEXT NOT NULL, score REAL, reason TEXT, source_time TEXT,
      PRIMARY KEY (run_id,symbol)
    );

CREATE TABLE auto_pick_events (
      id TEXT PRIMARY KEY, pick_id TEXT NOT NULL REFERENCES auto_pick_signals(id),
      event_type TEXT NOT NULL, bar_time INTEGER, price REAL, detail TEXT,
      created_at TEXT NOT NULL
    , bar_day TEXT);

CREATE TABLE auto_pick_runs (
      id TEXT PRIMARY KEY, market TEXT NOT NULL, slot TEXT NOT NULL, status TEXT NOT NULL,
      started_at TEXT NOT NULL, finished_at TEXT, scanned INTEGER NOT NULL DEFAULT 0,
      candidates INTEGER NOT NULL DEFAULT 0, error_code TEXT
    );

CREATE TABLE auto_pick_scan_progress (
      market TEXT NOT NULL, session_key TEXT NOT NULL, symbol TEXT NOT NULL,
      state TEXT NOT NULL, reason TEXT, attempts INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL, rule_version TEXT, PRIMARY KEY (market,session_key,symbol)
    );

CREATE TABLE auto_pick_signals (
      id TEXT PRIMARY KEY, market TEXT NOT NULL, symbol TEXT NOT NULL,
      session_day TEXT NOT NULL, status TEXT NOT NULL, published_at TEXT NOT NULL,
      entry_price REAL, entered_at TEXT, exit_price REAL, exited_at TEXT,
      last_checked_15m INTEGER, source TEXT NOT NULL, plan_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(market,symbol,session_day)
    );

CREATE TABLE auto_pick_worker_heartbeat (
      id INTEGER PRIMARY KEY CHECK (id=1), last_seen_at TEXT NOT NULL
    );

CREATE TABLE customer_daily_reports(member_id TEXT PRIMARY KEY, report_json TEXT NOT NULL);

CREATE TABLE customer_holdings(member_id TEXT NOT NULL, market TEXT NOT NULL, symbol TEXT NOT NULL, cost REAL NOT NULL, quantity REAL NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(member_id,market,symbol));

CREATE TABLE historical_replay_summaries(
    report_day TEXT NOT NULL, market TEXT NOT NULL, symbol TEXT NOT NULL, model TEXT NOT NULL,
    result_json TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(report_day,market,symbol,model));

CREATE TABLE line_oauth_flows (
      token_hash TEXT PRIMARY KEY, state TEXT NOT NULL, nonce TEXT NOT NULL, verifier TEXT NOT NULL, expires_at INTEGER NOT NULL
    );

CREATE TABLE members (
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

CREATE TABLE membership_events (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id),
      actor_id TEXT REFERENCES members(id),
      event_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      details TEXT
    );

CREATE TABLE monthly_codes (
      code_hash TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id),
      created_by TEXT NOT NULL REFERENCES members(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      redeemed_at TEXT
    );

CREATE TABLE renewal_requests (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id),
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      resolved_by TEXT REFERENCES members(id)
    );

CREATE TABLE request_limits(bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at INTEGER NOT NULL);

CREATE TABLE scanner_candles(symbol TEXT NOT NULL,timeframe TEXT NOT NULL,time TEXT NOT NULL,bar_json TEXT NOT NULL,source TEXT,PRIMARY KEY(symbol,timeframe,time));

CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );

CREATE INDEX ai_questions_conversation ON ai_questions(member_id,conversation_id,created_at);

CREATE INDEX ai_questions_member_day ON ai_questions(member_id,day_key,status);

CREATE INDEX auto_pick_events_recent ON auto_pick_events(created_at DESC);

CREATE INDEX auto_pick_signals_status ON auto_pick_signals(status,market);
