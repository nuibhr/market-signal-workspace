-- Switch partner broker monthly qualification target from 1,000,000 THB trading volume to 1,000 THB monthly commission per member.
UPDATE members SET broker_volume_target_thb = 1000 WHERE broker_volume_target_thb = 1000000;
UPDATE monthly_codes SET min_volume_thb = 1000 WHERE grant_type = 'partner_vip' AND min_volume_thb = 1000000;

