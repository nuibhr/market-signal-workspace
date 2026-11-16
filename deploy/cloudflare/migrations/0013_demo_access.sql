-- Per-browser demo access is temporary and separate from paid entitlement.
CREATE TABLE demo_access (
  member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('onboarding','trial','starter','pro','ultimate','expired')),
  expires_at TEXT NOT NULL
);
