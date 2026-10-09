CREATE TABLE coach_portfolios (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES members(id),
  name TEXT NOT NULL,
  currency TEXT NOT NULL CHECK(currency IN ('THB','USD')),
  initial_minor INTEGER NOT NULL CHECK(initial_minor > 0),
  cash_minor INTEGER NOT NULL CHECK(cash_minor >= 0),
  published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  version INTEGER NOT NULL DEFAULT 0,
  last_operation TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(owner_id,currency)
);
CREATE TABLE coach_trades (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES coach_portfolios(id),
  symbol TEXT NOT NULL,
  market TEXT NOT NULL CHECK(market IN ('thai','dr','us')),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  entry_micro INTEGER NOT NULL CHECK(entry_micro > 0),
  entry_fee_minor INTEGER NOT NULL CHECK(entry_fee_minor >= 0),
  cost_minor INTEGER NOT NULL CHECK(cost_minor > 0),
  entry_note TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  entry_actor TEXT NOT NULL REFERENCES members(id),
  exit_micro INTEGER,
  exit_fee_minor INTEGER,
  proceeds_minor INTEGER,
  pnl_minor INTEGER,
  exit_note TEXT,
  closed_at TEXT,
  exit_actor TEXT REFERENCES members(id),
  CHECK((closed_at IS NULL AND exit_micro IS NULL AND pnl_minor IS NULL) OR
        (closed_at IS NOT NULL AND exit_micro > 0 AND exit_fee_minor >= 0 AND proceeds_minor >= 0 AND pnl_minor IS NOT NULL))
);
CREATE INDEX coach_trades_history ON coach_trades(portfolio_id,opened_at DESC,id);
CREATE INDEX coach_trades_closed ON coach_trades(portfolio_id,closed_at,id);
CREATE INDEX coach_portfolios_public ON coach_portfolios(published,active,created_at DESC);
CREATE TABLE coach_operations (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES coach_portfolios(id),
  actor_id TEXT NOT NULL REFERENCES members(id),
  payload_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  trade_id TEXT,
  created_at TEXT NOT NULL
);
