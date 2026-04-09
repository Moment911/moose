-- ============================================================
-- Discovery Intelligence — Phase 2 columns
-- Run after 20260447_discovery_audit.sql
-- ============================================================

ALTER TABLE koto_discovery_engagements
  ADD COLUMN IF NOT EXISTS general_notes text;

ALTER TABLE koto_discovery_engagements
  ADD COLUMN IF NOT EXISTS version_history jsonb DEFAULT '[]'::jsonb;

ALTER TABLE koto_discovery_engagements
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid;

ALTER TABLE koto_discovery_engagements
  ADD COLUMN IF NOT EXISTS assigned_to_name text;

ALTER TABLE koto_discovery_engagements
  ADD COLUMN IF NOT EXISTS last_opened_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_disc_eng_assigned
  ON koto_discovery_engagements(assigned_to_user_id)
  WHERE assigned_to_user_id IS NOT NULL;
