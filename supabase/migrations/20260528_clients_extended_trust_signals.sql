-- Extended trust signal columns on clients table.
-- These feed into AI Pages E-E-A-T, schema, and AEO content generation.
-- Idempotent — safe to re-run.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_methods text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS insurance_accepted text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS languages_spoken text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS booking_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS author_photo_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS license_number text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS specialties text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS guarantees text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS awards text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS team_size text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS video_testimonial_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS response_time text;
