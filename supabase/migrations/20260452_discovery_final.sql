-- ============================================================
-- Discovery Intelligence Module — Final 5 Features
-- Run this in Supabase SQL Editor before deploying.
-- Idempotent — safe to re-run.
-- ============================================================

-- Onboarding bridge
ALTER TABLE koto_discovery_engagements
  ADD COLUMN IF NOT EXISTS pushed_to_onboarding_at timestamptz;

-- ── Agency webhooks ────────────────────────────────────────
-- Create if missing. Policies are permissive; the API uses the
-- service role and scopes by agency_id in code.
CREATE TABLE IF NOT EXISTS koto_agency_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  events text[] DEFAULT '{}'::text[],
  secret text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Backfill the columns in case an older shape exists without them.
ALTER TABLE koto_agency_webhooks ADD COLUMN IF NOT EXISTS agency_id uuid;
ALTER TABLE koto_agency_webhooks ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE koto_agency_webhooks ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE koto_agency_webhooks ADD COLUMN IF NOT EXISTS events text[] DEFAULT '{}'::text[];
ALTER TABLE koto_agency_webhooks ADD COLUMN IF NOT EXISTS secret text;
ALTER TABLE koto_agency_webhooks ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE koto_agency_webhooks ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE koto_agency_webhooks ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_agency_webhooks_agency ON koto_agency_webhooks(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_webhooks_active ON koto_agency_webhooks(agency_id) WHERE is_active = true;

ALTER TABLE koto_agency_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhooks_all" ON koto_agency_webhooks;
CREATE POLICY "webhooks_all" ON koto_agency_webhooks FOR ALL USING (true) WITH CHECK (true);
