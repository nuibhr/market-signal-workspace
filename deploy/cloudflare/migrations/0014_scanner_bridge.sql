-- Shared ownership and transaction fence for portable VPS scanners.

CREATE TABLE IF NOT EXISTS scanner_bridge_lease (
  id INTEGER PRIMARY KEY CHECK(id=1), holder TEXT NOT NULL, instance TEXT NOT NULL,
  until_ms INTEGER NOT NULL, heartbeat_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS scanner_bridge_guard (
  id INTEGER PRIMARY KEY CHECK(id=1),
  permit INTEGER NOT NULL CONSTRAINT scanner_lease_required CHECK(permit=1)
);
