-- Retry counters are per symbol/session; no trading records or prices are changed.
ALTER TABLE auto_pick_scan_progress ADD COLUMN source_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE auto_pick_worker_heartbeat ADD COLUMN runtime_version TEXT;
