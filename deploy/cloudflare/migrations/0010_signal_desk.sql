
CREATE TABLE signal_desk_observations (
 market TEXT NOT NULL, symbol TEXT NOT NULL, payload_json TEXT NOT NULL,
 checked_ms INTEGER NOT NULL, next_scan_ms INTEGER NOT NULL, PRIMARY KEY(market,symbol)
);
CREATE TABLE signal_desk_leases (market TEXT PRIMARY KEY, token TEXT NOT NULL, until_ms INTEGER NOT NULL, heartbeat_ms INTEGER NOT NULL);
CREATE TABLE signal_desk_profiles (id TEXT PRIMARY KEY, costs_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE signal_desk_preferences (member_id TEXT PRIMARY KEY REFERENCES members(id), us_profile TEXT NOT NULL REFERENCES signal_desk_profiles(id));
CREATE TABLE signal_desk_profile_access (member_id TEXT NOT NULL REFERENCES members(id),profile_id TEXT NOT NULL REFERENCES signal_desk_profiles(id),PRIMARY KEY(member_id,profile_id));
CREATE TABLE signal_desk_signals (
 id TEXT PRIMARY KEY, market TEXT NOT NULL, symbol TEXT NOT NULL, mode TEXT NOT NULL,
 cost_profile TEXT NOT NULL, rule_version TEXT NOT NULL, status TEXT NOT NULL,
 published_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0, last_operation TEXT NOT NULL
);
CREATE INDEX signal_desk_active ON signal_desk_signals(market,status,updated_at);
CREATE INDEX signal_desk_history ON signal_desk_signals(market,cost_profile,published_at DESC,id);
CREATE TABLE signal_desk_events (
 seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
 signal_id TEXT NOT NULL REFERENCES signal_desk_signals(id), market TEXT NOT NULL, symbol TEXT NOT NULL,
 type TEXT NOT NULL, created_at TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE INDEX signal_desk_event_signal ON signal_desk_events(signal_id,seq);
CREATE TRIGGER signal_desk_event_no_update BEFORE UPDATE ON signal_desk_events BEGIN SELECT RAISE(ABORT,'IMMUTABLE_SIGNAL_EVENT'); END;
CREATE TRIGGER signal_desk_event_no_delete BEFORE DELETE ON signal_desk_events BEGIN SELECT RAISE(ABORT,'IMMUTABLE_SIGNAL_EVENT'); END;
