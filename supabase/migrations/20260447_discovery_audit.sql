-- ============================================================
-- Discovery Intelligence — audit + interview flags columns
-- ============================================================

ALTER TABLE koto_discovery_engagements
  ADD COLUMN IF NOT EXISTS audit_data jsonb;

ALTER TABLE koto_discovery_engagements
  ADD COLUMN IF NOT EXISTS audit_generated_at timestamptz;

ALTER TABLE koto_discovery_engagements
  ADD COLUMN IF NOT EXISTS interview_flags jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_disc_eng_has_audit
  ON koto_discovery_engagements(agency_id)
  WHERE audit_data IS NOT NULL;
