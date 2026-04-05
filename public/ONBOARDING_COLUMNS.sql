
-- ── Onboarding tracking columns on clients ───────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_sent_at      timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_status       text DEFAULT 'not_sent';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_token        text;

SELECT 'Onboarding columns added ✓' as result;
