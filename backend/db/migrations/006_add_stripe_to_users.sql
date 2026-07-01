ALTER TABLE users ADD COLUMN is_pro BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN subscription_status TEXT;
