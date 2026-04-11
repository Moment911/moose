-- ─────────────────────────────────────────────────────────────
-- White-label branding columns + proposals table
--
-- Adds the agencies columns powering /api/agency/white-label
-- and creates the koto_proposals table used by the proposal
-- builder. Also adds clients.completion_email_sent_at so the
-- onboarding/complete route can stay idempotent.
-- ─────────────────────────────────────────────────────────────

-- White-label branding fields on agencies
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS custom_domain text;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#00C2CB';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#1a1a2e';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS favicon_url text;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS support_email text;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS white_label_enabled boolean DEFAULT false;

-- Idempotency guard for the completion email + PDF
ALTER TABLE clients ADD COLUMN IF NOT EXISTS completion_email_sent_at timestamptz;

-- Proposals table — used by /api/proposals and the proposal builder UI
CREATE TABLE IF NOT EXISTS koto_proposals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  status text DEFAULT 'draft',
  content jsonb NOT NULL,
  pdf_url text,
  monthly_investment numeric,
  services text[],
  viewed_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposals_client ON koto_proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_agency ON koto_proposals(agency_id);

ALTER TABLE koto_proposals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'koto_proposals' AND policyname = 'proposals_all'
  ) THEN
    CREATE POLICY "proposals_all" ON koto_proposals FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Index custom_domain for fast lookups in the white-label proxy path
CREATE INDEX IF NOT EXISTS idx_agencies_custom_domain ON agencies(custom_domain) WHERE custom_domain IS NOT NULL;
