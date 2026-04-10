-- ============================================================
-- Discovery Intelligence — Builds 2-5
-- Prep sheet, follow-up email, readiness score, sessions,
-- notes application, industry templates, objections section.
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE koto_discovery_engagements ADD COLUMN IF NOT EXISTS prep_sheet jsonb;
ALTER TABLE koto_discovery_engagements ADD COLUMN IF NOT EXISTS prep_sheet_generated_at timestamptz;

ALTER TABLE koto_discovery_engagements ADD COLUMN IF NOT EXISTS followup_email jsonb;
ALTER TABLE koto_discovery_engagements ADD COLUMN IF NOT EXISTS followup_sent_at timestamptz;

ALTER TABLE koto_discovery_engagements ADD COLUMN IF NOT EXISTS readiness_score integer;
ALTER TABLE koto_discovery_engagements ADD COLUMN IF NOT EXISTS readiness_label text;
ALTER TABLE koto_discovery_engagements ADD COLUMN IF NOT EXISTS readiness_calculated_at timestamptz;

ALTER TABLE koto_discovery_engagements ADD COLUMN IF NOT EXISTS sessions jsonb DEFAULT '[]'::jsonb;

-- general_notes already exists from 20260448_discovery_phase_2.sql
-- This guarantees it's present on any database that skipped that migration:
ALTER TABLE koto_discovery_engagements ADD COLUMN IF NOT EXISTS general_notes text;

CREATE INDEX IF NOT EXISTS idx_disc_eng_readiness
  ON koto_discovery_engagements(readiness_score DESC)
  WHERE readiness_score IS NOT NULL;
