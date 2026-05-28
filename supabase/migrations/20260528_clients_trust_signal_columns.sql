-- Add trust signal columns to clients table for E-E-A-T auto-population.
-- These fields feed into AI Pages campaign generation so the master is
-- written with real business data from the start. Idempotent.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS yelp_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS bbb_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS price_range text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS certifications text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS key_result text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS author_credentials text;
