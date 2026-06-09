-- ════════════════════════════════════════════════════════════════
-- ⚠️  APPLY MANUALLY via the Supabase SQL editor.
--     Do NOT run `supabase db push` — prod has migration-tracking drift.
--     Paste this entire file's contents into the SQL editor and run it.
-- ════════════════════════════════════════════════════════════════
--
-- KotoIQ — Gap-score columns on kotoiq_page_suggestions (Phase 11 / WS5)
--
-- scoreServiceCityGrid() re-expresses the signals analyzePageGaps already
-- computes as the EXPLICIT competitor-rank-driven formula:
--
--   score = (demand + competition_strength) × (1 − our_coverage)
--           ÷ max(difficulty, MIN_DIFFICULTY)
--
-- and buckets each service×city cell into quick_win / net_new / big_bet
-- (or low_demand_deprioritize for a client city no competitor targets).
--
-- This migration ADDs the columns those outputs persist into. The existing
-- additive `priority` column is KEPT untouched for back-compat — PageSuggestionsTab
-- still reads `priority`; the new gap-engine + guided shell read `score`/`bucket`.
--
--   score                — the explicit-formula score (numeric, unbounded; UI sorts desc)
--   bucket               — 'quick_win' | 'net_new' | 'big_bet' | 'low_demand_deprioritize'
--   our_coverage         — 0..1 coverage degree (0 = no page, 1 = strong ranking page)
--   competition_strength — competitor-rank strength signal feeding the formula
--   score_sources        — data-integrity provenance for the rank/difficulty facts
--                          (createVerifiedData {source_url, fetched_at, ...} per input)
--
-- Re-runnable: ADD COLUMN IF NOT EXISTS on every column.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE kotoiq_page_suggestions
  ADD COLUMN IF NOT EXISTS score                NUMERIC,
  ADD COLUMN IF NOT EXISTS bucket               TEXT,
  ADD COLUMN IF NOT EXISTS our_coverage         NUMERIC,
  ADD COLUMN IF NOT EXISTS competition_strength NUMERIC,
  ADD COLUMN IF NOT EXISTS score_sources        JSONB DEFAULT '{}'::jsonb;

-- Sort the ranked build order by the explicit-formula score (highest first),
-- and let the guided shell tally buckets cheaply.
CREATE INDEX IF NOT EXISTS idx_page_suggestions_score
  ON kotoiq_page_suggestions(score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_page_suggestions_bucket
  ON kotoiq_page_suggestions(bucket);
