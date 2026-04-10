-- ============================================================
-- Onboarding hotfix
-- Ensures every column the OnboardingPage + API rely on exists,
-- extends token expiry to NULL (no expiry) for direct-ID links,
-- and backfills an onboarding_token on every client row so the
-- /onboard/:clientId URL the ClientDetailPage generates always
-- resolves to a working engagement.
-- Idempotent — safe to re-run.
-- ============================================================

-- Ensure onboarding columns exist on clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_token       text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_answers     jsonb DEFAULT '{}'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_sent_at     timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_status      text;

-- Ensure the onboarding_tokens table exists (older installs may not have it)
CREATE TABLE IF NOT EXISTS onboarding_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  expires_at timestamptz,
  used_at    timestamptz,
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_tokens_token  ON onboarding_tokens(token);
CREATE INDEX IF NOT EXISTS idx_onboarding_tokens_client ON onboarding_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_onboarding_token ON clients(onboarding_token);

-- RLS: allow public read so /onboard/:id can load without auth
ALTER TABLE onboarding_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "onboarding_tokens_public_read" ON onboarding_tokens;
CREATE POLICY "onboarding_tokens_public_read" ON onboarding_tokens FOR SELECT USING (true);
DROP POLICY IF EXISTS "onboarding_tokens_all"        ON onboarding_tokens;
CREATE POLICY "onboarding_tokens_all"        ON onboarding_tokens FOR ALL USING (true) WITH CHECK (true);

-- Clear expiry on legacy tokens so old shared links keep working
UPDATE onboarding_tokens SET expires_at = NULL WHERE expires_at IS NOT NULL;

-- Backfill a token on every client so /onboard/:clientId resolves cleanly
UPDATE clients
   SET onboarding_token = replace(gen_random_uuid()::text, '-', '')
 WHERE onboarding_token IS NULL OR onboarding_token = '';
