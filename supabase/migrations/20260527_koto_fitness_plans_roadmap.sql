-- ============================================================
-- Trainer Phase 2 — add roadmap + phase_ref columns to koto_fitness_plans.
--
-- Phase 1's foundation migration (20260525_koto_fitness_foundation.sql)
-- shipped koto_fitness_plans with baseline / workout_plan / food_preferences
-- / meal_plan / grocery_list / adjustment_summary jsonb columns.  Phase 2
-- introduces a Sonnet "roadmap" prompt that plans the full 6-week training
-- arc in three phases, and the workout-generation prompt runs per-phase
-- (phase ∈ {1,2,3}).
--
-- Two additions:
--   - `roadmap`   jsonb  — output of the roadmap prompt (three-phase arc)
--   - `phase_ref` int    — which roadmap phase the current workout_plan is
--                         targeting (1, 2, or 3).  Null for block_number=1
--                         rows until generate_workout runs.
--
-- No index needed — always read via plan id from the generate route.
-- ============================================================

ALTER TABLE public.koto_fitness_plans
  ADD COLUMN IF NOT EXISTS roadmap jsonb;

ALTER TABLE public.koto_fitness_plans
  ADD COLUMN IF NOT EXISTS phase_ref int;
