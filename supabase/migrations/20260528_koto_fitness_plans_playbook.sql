-- ============================================================
-- Trainer Phase 2 — coaching playbook column
--
-- Adds the playbook jsonb to koto_fitness_plans so /api/trainer/generate
-- action=generate_playbook can persist the CoachingPlaybookOutput envelope
-- (nutrition protocol, supplement protocol, travel strategy, meal-prep
-- routine, recovery & sleep protocol, troubleshooting guide, closing
-- philosophy).  Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE public.koto_fitness_plans
  ADD COLUMN IF NOT EXISTS playbook jsonb;
