-- ============================================================
-- Platform access tracking
--
-- Stores which marketing platforms the agency has been granted
-- access to for each client. Populated by the onboarding form's
-- platform access checklist + the post-submit access setup email.
--
-- Shape: jsonb keyed by platform id → { granted_at, granted_by,
--   access_level, notes, account_id? }
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS platform_access jsonb DEFAULT '{}'::jsonb;
