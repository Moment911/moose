-- ============================================================
-- Trainer Phase 1 Plan 01 — koto_fitness_* foundation
--
-- Adds the DB surface for Koto Trainer, a new initiative separate from KotoIQ:
--   - agencies.features jsonb column (feature flag host — fitness_coach + future flags)
--   - koto_fitness_trainees: trainee record with full intake (flat under agency, not
--     nested under a client — per trainer-01-CONTEXT.md DEC-01)
--   - koto_fitness_plans: Phase 2 writes baseline/workout/meals/grocery here, block-
--     numbered for history (block 1 = initial, block N+1 = adjust-from-progress)
--   - koto_fitness_workout_logs: per-set logging (feeds adjust_from_progress Sonnet
--     prompt per DEC-09)
--   - koto_fitness_progress: v2 Phase 4 shell for weight/photo check-ins
--
-- Decisions referenced (see .planning/phases/trainer-01-intake-and-dispatcher/
-- trainer-01-CONTEXT.md):
--   DEC-02  v1 scope updated — 2-week plans + tracking + adjust loop
--   DEC-07  Table prefix koto_fitness_* (not koto_trainer_*)
--   D-01    New tables with agency_id FK + set_updated_at triggers
--   D-02    Trainees standalone (no client_id FK)
--   D-03    plans/progress tables shipped as shells (Phase 2/v2 populate)
--   D-04    agencies.features jsonb with default '{}'
--   D-05    RLS: agency-scoped isolation
--   D-07    Soft delete via archived_at
--
-- RLS pattern: mirrors 20260507_kotoiq_client_profile.sql and
-- 20260520_kotoiq_agency_integrations.sql — service-role only
-- (USING (true) WITH CHECK (true)); app-layer enforces agency_id scoping
-- via explicit .eq('agency_id', agencyId) in every query.  Trainee-self-
-- access policies deferred to Phase 3 (when trainees have auth accounts).
--
-- DEVIATION from PLAN 01: the drafted PLAN used
-- `current_setting('app.agency_id')::uuid` RLS; that pattern is an outlier
-- (only in 20260505_kotoiq_builder.sql).  Canonical Koto pattern is
-- service-role + app-layer scoping.  Deviations_protocol in the PLAN
-- explicitly instructs matching 20260507 — which is what this migration does.
--
-- updated_at trigger: per-table CREATE FUNCTION (this repo has never had a
-- shared set_updated_at() helper; each table ships its own — confirmed by
-- Phase 7 Plan 1 STATE note).
-- ============================================================

-- ── 1. agencies.features jsonb feature-flag host ──────────────────────────
-- Hosts fitness_coach (Phase 1 Trainer) plus any future per-agency toggles.
-- Existing rows backfill to '{}' automatically via DEFAULT.
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Partial index — only agencies that have fitness_coach enabled, for the
-- feature-flag sidebar-hydration query.
CREATE INDEX IF NOT EXISTS idx_agencies_features_fitness_coach
  ON public.agencies ((features->>'fitness_coach'))
  WHERE features->>'fitness_coach' = 'true';

-- ── 2. koto_fitness_trainees ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.koto_fitness_trainees (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id                  uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,

  -- Identity
  full_name                  text NOT NULL,
  email                      text,
  phone                      text,

  -- Basics
  age                        int,
  sex                        text,
  height_cm                  numeric,
  current_weight_kg          numeric,
  target_weight_kg           numeric,

  -- Goal
  primary_goal               text CHECK (primary_goal IN (
                                'lose_fat', 'gain_muscle', 'maintain',
                                'performance', 'recomp'
                             )),

  -- Experience
  training_experience_years  numeric,
  training_days_per_week     int  CHECK (
                                training_days_per_week IS NULL
                                OR (training_days_per_week BETWEEN 0 AND 7)
                             ),
  equipment_access           text CHECK (equipment_access IN (
                                'none', 'bands', 'home_gym', 'full_gym'
                             )),

  -- Health
  medical_flags              text,
  injuries                   text,
  pregnancy_or_nursing       boolean,

  -- Food (hard constraints only; soft preferences elicited by prompt 3 per DEC-10)
  dietary_preference         text CHECK (dietary_preference IN (
                                'none', 'vegetarian', 'vegan', 'pescatarian',
                                'keto', 'paleo', 'custom'
                             )),
  allergies                  text,
  grocery_budget_usd_per_week numeric,
  meals_per_day              int  CHECK (
                                meals_per_day IS NULL
                                OR (meals_per_day BETWEEN 3 AND 6)
                             ),

  -- Lifestyle
  sleep_hours_avg            numeric,
  stress_level               int  CHECK (
                                stress_level IS NULL
                                OR (stress_level BETWEEN 1 AND 10)
                             ),
  occupation_activity        text CHECK (occupation_activity IN (
                                'sedentary', 'light', 'moderate', 'heavy'
                             )),

  -- Internal
  trainer_notes              text,
  status                     text NOT NULL DEFAULT 'intake_complete'
                             CHECK (status IN (
                                'intake_complete', 'plan_generated', 'archived'
                             )),
  archived_at                timestamptz,

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koto_fitness_trainees_agency_archived
  ON public.koto_fitness_trainees (agency_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_koto_fitness_trainees_agency_status
  ON public.koto_fitness_trainees (agency_id, status);

ALTER TABLE public.koto_fitness_trainees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "koto_fitness_trainees_all" ON public.koto_fitness_trainees;
CREATE POLICY "koto_fitness_trainees_all" ON public.koto_fitness_trainees
  FOR ALL USING (true) WITH CHECK (true);  -- service-role only; scoped in app layer

CREATE OR REPLACE FUNCTION public.koto_fitness_trainees_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_koto_fitness_trainees_updated
  ON public.koto_fitness_trainees;
CREATE TRIGGER trg_koto_fitness_trainees_updated
  BEFORE UPDATE ON public.koto_fitness_trainees
  FOR EACH ROW EXECUTE FUNCTION public.koto_fitness_trainees_set_updated_at();

-- ── 3. koto_fitness_plans ─────────────────────────────────────────────────
-- Phase 1 ships the shell; Phase 2 writes rows.  block_number lets the
-- adjust-from-progress Sonnet prompt append new blocks without overwriting
-- history — agency + trainee see a timeline of blocks over time.
CREATE TABLE IF NOT EXISTS public.koto_fitness_plans (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id            uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  trainee_id           uuid NOT NULL REFERENCES public.koto_fitness_trainees(id) ON DELETE CASCADE,

  block_number         int NOT NULL DEFAULT 1,  -- 1 = initial, 2+ = adjust iterations

  -- Sonnet chain outputs (each is the tool_use args jsonb from its prompt)
  baseline             jsonb,  -- record_baseline
  workout_plan         jsonb,  -- record_workout_plan
  food_preferences     jsonb,  -- record_food_preferences_questions + answers envelope
  meal_plan            jsonb,  -- record_meal_plan (weeks[])
  grocery_list         jsonb,  -- record_meal_plan (grocery_list)
  adjustment_summary   jsonb,  -- adjustments_made[] (null for block_number=1)

  model                text,
  generated_at         timestamptz,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koto_fitness_plans_trainee
  ON public.koto_fitness_plans (trainee_id);
CREATE INDEX IF NOT EXISTS idx_koto_fitness_plans_trainee_block
  ON public.koto_fitness_plans (trainee_id, block_number DESC);

ALTER TABLE public.koto_fitness_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "koto_fitness_plans_all" ON public.koto_fitness_plans;
CREATE POLICY "koto_fitness_plans_all" ON public.koto_fitness_plans
  FOR ALL USING (true) WITH CHECK (true);  -- service-role only; scoped in app layer

CREATE OR REPLACE FUNCTION public.koto_fitness_plans_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_koto_fitness_plans_updated
  ON public.koto_fitness_plans;
CREATE TRIGGER trg_koto_fitness_plans_updated
  BEFORE UPDATE ON public.koto_fitness_plans
  FOR EACH ROW EXECUTE FUNCTION public.koto_fitness_plans_set_updated_at();

-- ── 4. koto_fitness_workout_logs ──────────────────────────────────────────
-- Per-set logs.  Phase 2 writes from the agency workout-log grid; Phase 3
-- opens trainee-self-entry via /my-plan.  The adjust-from-progress prompt
-- (prompt 5) joins logs to plans on exercise_id — keep that slug stable.
CREATE TABLE IF NOT EXISTS public.koto_fitness_workout_logs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id            uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  trainee_id           uuid NOT NULL REFERENCES public.koto_fitness_trainees(id) ON DELETE CASCADE,
  plan_id              uuid NOT NULL REFERENCES public.koto_fitness_plans(id) ON DELETE CASCADE,

  session_day_number   int  NOT NULL CHECK (session_day_number BETWEEN 1 AND 14),
  session_logged_at    timestamptz NOT NULL DEFAULT now(),

  exercise_id          text NOT NULL,   -- stable snake_case slug, joins to workout_plan JSON
  exercise_name        text NOT NULL,   -- denormalized for history display

  set_number           int  NOT NULL CHECK (set_number >= 1),
  actual_weight_kg     numeric,          -- nullable (bodyweight exercises)
  actual_reps          int  NOT NULL CHECK (actual_reps >= 0),
  rpe                  numeric CHECK (rpe IS NULL OR (rpe BETWEEN 1 AND 10)),
  notes                text,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koto_fitness_workout_logs_plan
  ON public.koto_fitness_workout_logs (plan_id, session_day_number, exercise_id, set_number);
CREATE INDEX IF NOT EXISTS idx_koto_fitness_workout_logs_trainee
  ON public.koto_fitness_workout_logs (trainee_id, session_logged_at DESC);

ALTER TABLE public.koto_fitness_workout_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "koto_fitness_workout_logs_all" ON public.koto_fitness_workout_logs;
CREATE POLICY "koto_fitness_workout_logs_all" ON public.koto_fitness_workout_logs
  FOR ALL USING (true) WITH CHECK (true);  -- service-role only; scoped in app layer

CREATE OR REPLACE FUNCTION public.koto_fitness_workout_logs_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_koto_fitness_workout_logs_updated
  ON public.koto_fitness_workout_logs;
CREATE TRIGGER trg_koto_fitness_workout_logs_updated
  BEFORE UPDATE ON public.koto_fitness_workout_logs
  FOR EACH ROW EXECUTE FUNCTION public.koto_fitness_workout_logs_set_updated_at();

-- ── 5. koto_fitness_progress ──────────────────────────────────────────────
-- Shell for v2 Phase 4: weight check-ins + photo uploads.  Phase 1 creates
-- the table so the schema is stable; v2 starts writing rows.
CREATE TABLE IF NOT EXISTS public.koto_fitness_progress (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id            uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  trainee_id           uuid NOT NULL REFERENCES public.koto_fitness_trainees(id) ON DELETE CASCADE,

  checked_in_at        timestamptz NOT NULL DEFAULT now(),
  weight_kg            numeric,
  notes                text,
  photos               jsonb,  -- [{ url, bucket_path, taken_at, pose }]

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koto_fitness_progress_trainee
  ON public.koto_fitness_progress (trainee_id, checked_in_at DESC);

ALTER TABLE public.koto_fitness_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "koto_fitness_progress_all" ON public.koto_fitness_progress;
CREATE POLICY "koto_fitness_progress_all" ON public.koto_fitness_progress
  FOR ALL USING (true) WITH CHECK (true);  -- service-role only; scoped in app layer

CREATE OR REPLACE FUNCTION public.koto_fitness_progress_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_koto_fitness_progress_updated
  ON public.koto_fitness_progress;
CREATE TRIGGER trg_koto_fitness_progress_updated
  BEFORE UPDATE ON public.koto_fitness_progress
  FOR EACH ROW EXECUTE FUNCTION public.koto_fitness_progress_set_updated_at();
