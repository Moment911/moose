-- ============================================================
-- Phase 7 — WR-07 mitigation
--
-- kotoiq_pipeline_runs (created in 20260419_kotoiq_automation.sql) was
-- declared without ENABLE ROW LEVEL SECURITY, so the browser anon key
-- could read every agency's pipeline runs by simply omitting the
-- defensive .eq('agency_id', ...) filter the LivePipelineRibbon component
-- adds in JS.  This migration brings the table in line with the standard
-- service-role-only policy used by every other kotoiq_* table (see
-- 20260507_kotoiq_client_profile.sql line 125-128 for the same pattern).
--
-- After this migration runs:
--   - The browser anon key can no longer read kotoiq_pipeline_runs.
--   - LivePipelineRibbon.jsx (which uses the anon key) will need to move
--     its read behind an authenticated /api/kotoiq/profile action, OR the
--     RLS policy can be tightened to permit reads where session JWT
--     agency_id matches the row.  See WR-07 in the phase REVIEW for
--     options.  Until that follow-up lands, the ribbon will quietly
--     return null for all browsers — graceful degradation, the page
--     still loads.
--
-- IMPORTANT — DEFERRED PUSH:
--   This SQL is NOT yet applied to live Supabase.  Operator must run
--   `supabase db push` (or paste the file into Supabase Studio's SQL
--   editor) once the kotoiq_pipeline_runs migration backlog is cleared.
--   The existing 20260419_kotoiq_automation.sql migration is in the same
--   backlog (per Plan 7 STATE.md "Known follow-ups"); apply both together.
-- ============================================================

ALTER TABLE kotoiq_pipeline_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kotoiq_pipeline_runs_all" ON kotoiq_pipeline_runs;
CREATE POLICY "kotoiq_pipeline_runs_all" ON kotoiq_pipeline_runs
  FOR ALL USING (true) WITH CHECK (true);   -- service-role only; scoped in app layer
