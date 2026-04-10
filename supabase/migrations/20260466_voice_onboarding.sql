-- Voice onboarding — per-client phone + PIN model.
--
-- Each client onboarding session gets a dedicated Telnyx phone number
-- from a pool + a 4-digit PIN. The client calls the number, the Retell
-- agent asks for the PIN, verifies against the client row, and then
-- walks through the remaining onboarding questions. Multiple team
-- members can call the same number with the same PIN.
--
-- Pool numbers are provisioned dynamically via the Telnyx API,
-- assigned to a client for 30 days, then released back to the pool
-- (or deleted) when onboarding completes.

-- ── Phone pool ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS koto_onboarding_phone_pool (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number          text UNIQUE NOT NULL,
  display_number        text NOT NULL,
  telnyx_phone_id       text,
  telnyx_order_id       text,
  connection_id         text,
  provider              text DEFAULT 'telnyx',
  status                text DEFAULT 'available',
  assigned_to_client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  assigned_to_agency_id uuid,
  assigned_at           timestamptz,
  expires_at            timestamptz,
  released_at           timestamptz,
  total_assignments     int DEFAULT 0,
  total_calls           int DEFAULT 0,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_pool_status ON koto_onboarding_phone_pool(status);
CREATE INDEX IF NOT EXISTS idx_phone_pool_client ON koto_onboarding_phone_pool(assigned_to_client_id);

ALTER TABLE koto_onboarding_phone_pool ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "phone_pool_all" ON koto_onboarding_phone_pool;
CREATE POLICY "phone_pool_all" ON koto_onboarding_phone_pool
  FOR ALL USING (true) WITH CHECK (true);

-- ── Client columns for assigned phone + PIN ──────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_phone              text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_phone_display      text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_pin                text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_phone_assigned_at  timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_phone_expires_at   timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_recipients         jsonb DEFAULT '[]'::jsonb;

-- ── Agencies — per-agency fallback number + onboarding agent id ──
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS onboarding_phone_number text;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS onboarding_agent_id     text;

-- ── Recipients table — clean rebuild ─────────────────────────────
-- If a previous iteration of this migration created a different
-- shape, drop it so we can recreate with the canonical schema.
DROP TABLE IF EXISTS koto_onboarding_recipients;

CREATE TABLE koto_onboarding_recipients (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id         uuid NOT NULL,
  client_id         uuid REFERENCES clients(id) ON DELETE CASCADE,
  name              text NOT NULL,
  email             text NOT NULL,
  title             text,
  token             text UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  assigned_sections text[],
  role_label        text DEFAULT 'Team Member',
  -- 'invited' | 'opened' | 'in_progress' | 'complete' | 'abandoned'
  status            text DEFAULT 'invited',
  -- 'web' | 'voice' | 'email'
  source            text DEFAULT 'web',
  call_id           text,
  phone             text,
  invited_at        timestamptz DEFAULT now(),
  opened_at         timestamptz,
  completed_at      timestamptz,
  last_active_at    timestamptz,
  answers           jsonb DEFAULT '{}'::jsonb,
  fields_captured   jsonb DEFAULT '{}'::jsonb,
  fields_assigned   int  DEFAULT 0,
  fields_completed  int  DEFAULT 0,
  agency_note       text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboard_recipients_client ON koto_onboarding_recipients(client_id);
CREATE INDEX IF NOT EXISTS idx_onboard_recipients_token  ON koto_onboarding_recipients(token);
CREATE INDEX IF NOT EXISTS idx_onboard_recipients_call   ON koto_onboarding_recipients(call_id);
CREATE INDEX IF NOT EXISTS idx_onboard_recipients_agency ON koto_onboarding_recipients(agency_id, last_active_at DESC);

ALTER TABLE koto_onboarding_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboard_recipients_all" ON koto_onboarding_recipients;
CREATE POLICY "onboard_recipients_all" ON koto_onboarding_recipients
  FOR ALL USING (true) WITH CHECK (true);
