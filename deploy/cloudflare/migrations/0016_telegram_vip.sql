CREATE TABLE IF NOT EXISTS telegram_vip_invites (
  invite_link TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined','revoked','expired')),
  telegram_user_id TEXT,
  telegram_username TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS telegram_vip_invites_member ON telegram_vip_invites(member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS telegram_vip_members (
  member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  telegram_user_id TEXT NOT NULL UNIQUE,
  telegram_username TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','kicked')),
  joined_at TEXT NOT NULL,
  kicked_at TEXT,
  kick_reason TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS telegram_vip_members_status ON telegram_vip_members(status, chat_id);

