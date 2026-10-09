ALTER TABLE scanner_jobs ADD COLUMN priority INTEGER NOT NULL DEFAULT 1;
CREATE INDEX scanner_jobs_priority ON scanner_jobs(priority,created_at,id);
