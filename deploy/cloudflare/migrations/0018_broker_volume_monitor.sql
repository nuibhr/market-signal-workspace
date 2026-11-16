-- Track monthly broker trading volume against VIP qualification target (default 1,000,000 THB/month) and promo/partner code metadata.
ALTER TABLE members ADD COLUMN broker_monthly_volume_thb REAL NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN broker_volume_month TEXT;
ALTER TABLE members ADD COLUMN broker_volume_target_thb REAL NOT NULL DEFAULT 1000000;
ALTER TABLE monthly_codes ADD COLUMN grant_type TEXT NOT NULL DEFAULT 'partner_vip';
ALTER TABLE monthly_codes ADD COLUMN duration_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE monthly_codes ADD COLUMN min_volume_thb REAL NOT NULL DEFAULT 1000000;
ALTER TABLE monthly_codes ADD COLUMN note TEXT;

