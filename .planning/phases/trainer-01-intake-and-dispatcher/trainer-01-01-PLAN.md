---
phase: trainer-01-intake-and-dispatcher
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260NNN_koto_fitness_foundation.sql
  - tests/trainer/phase1/migrationShape.test.ts
autonomous: false
requirements: []
tags: [trainer, schema, foundation, rls, feature-flag]

must_haves:
  truths:
    - "agencies table gains a features jsonb column with default '{}'::jsonb; existing rows backfilled to {}"
    - "koto_fitness_trainees table exists with agency_id FK + archived_at soft delete + created_at/updated_at"
    - "koto_fitness_plans table exists as empty shell (Phase 2 writes rows)"
    - "koto_fitness_workout_logs table exists as empty shell (Phase 2 writes per-set log rows)"
    - "koto_fitness_progress table exists as empty shell (v2 writes weight/photo check-ins)"
    - "Every koto_fitness_* table has RLS enabled with agency_id-scoped SELECT/INSERT/UPDATE/DELETE policies"
    - "Cross-agency SELECT on koto_fitness_trainees returns zero rows under a non-matching session"
    - "updated_at trigger fires on UPDATE for every koto_fitness_* table"
  artifacts:
    - path: "supabase/migrations/20260NNN_koto_fitness_foundation.sql"
      provides: "Four new tables + agencies.features column + RLS + set_updated_at triggers"
      contains: "koto_fitness_trainees"
    - path: "tests/trainer/phase1/migrationShape.test.ts"
      provides: "Vitest integration test asserting shape + RLS isolation against a local Supabase"
  key_links:
    - from: "supabase/migrations/20260NNN_koto_fitness_foundation.sql"
      to: "src/hooks/useAuth.jsx"
      via: "agencies.features jsonb column read by the session loader to pass into UI feature-flag checks"
      pattern: "features jsonb"
---

<objective>
Ship the DB foundation every downstream Trainer plan depends on: four new `koto_fitness_*` tables, the `agencies.features` jsonb column that gates the whole module, RLS policies, and `updated_at` triggers.

**Purpose:** Plans 02 (API dispatcher) + 03 (UI) both read these tables. Phase 2 writes to `koto_fitness_plans` + `koto_fitness_workout_logs` (per-set logging feeds the adjust-from-progress Sonnet prompt per CONTEXT DEC-02/DEC-09). Phase 3 adds trainee-self-access RLS on top. v2 Phase 4 writes to `koto_fitness_progress` (weight/photo check-ins). Shipping the schema + flag column first means every subsequent plan executes against a stable contract.

**Output:** One migration file that (a) adds `features jsonb NOT NULL DEFAULT '{}'::jsonb` to `agencies`, (b) creates `koto_fitness_trainees` / `koto_fitness_plans` / `koto_fitness_workout_logs` / `koto_fitness_progress` with full column sets, FK constraints, RLS policies, and `set_updated_at` triggers, and (c) passes a cross-agency isolation test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/trainer-01-intake-and-dispatcher/trainer-01-CONTEXT.md
@_knowledge/database/tables.md
@_knowledge/data-integrity-standard.md
@AGENTS.md
@supabase/migrations/20260507_kotoiq_client_profile.sql
@supabase/migrations/20260520_kotoiq_agency_integrations.sql

<interfaces>
<!-- Existing Koto conventions this migration must follow. -->

Existing `agencies` table (partial shape; confirm columns in migrations before writing):
```
CREATE TABLE agencies (
  id uuid PRIMARY KEY,
  name text,
  slug text,
  -- ... branding, white-label, voice settings ...
  created_at timestamptz DEFAULT now()
);
```

Agency-isolated table pattern (from `20260507_kotoiq_client_profile.sql`):
```sql
CREATE TABLE koto_something (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  -- ... columns ...
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE koto_something ENABLE ROW LEVEL SECURITY;

CREATE POLICY "koto_something_agency_isolation"
  ON koto_something
  FOR ALL
  USING (agency_id = current_setting('app.agency_id', true)::uuid)
  WITH CHECK (agency_id = current_setting('app.agency_id', true)::uuid);

-- Per-table updated_at trigger (Phase 7 Plan 1 pattern — no shared helper)
CREATE OR REPLACE FUNCTION koto_something_set_updated_at() ... ;
CREATE TRIGGER koto_something_updated_at ... ;
```

Intake field enumeration (from CONTEXT D-15) — plan translates to SQL columns:
- Identity: full_name text NOT NULL, email text, phone text
- Basics: age int, sex text, height_cm numeric, current_weight_kg numeric, target_weight_kg numeric
- Goal: primary_goal text (enum-shaped via CHECK constraint)
- Experience: training_experience_years numeric, training_days_per_week int, equipment_access text
- Health: medical_flags text, injuries text, pregnancy_or_nursing boolean
- Food: dietary_preference text, allergies text, grocery_budget_usd_per_week numeric, meals_per_day int
- Lifestyle: sleep_hours_avg numeric, stress_level int (1-10), occupation_activity text
- Internal: trainer_notes text, status text (default 'intake_complete'), archived_at timestamptz
</interfaces>

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Draft the SQL migration — tables + agencies.features column + RLS + triggers</name>
  <files>supabase/migrations/20260NNN_koto_fitness_foundation.sql</files>
  <read_first>
    - `.planning/phases/trainer-01-intake-and-dispatcher/trainer-01-CONTEXT.md` §decisions D-01 through D-07 + D-18
    - `supabase/migrations/20260507_kotoiq_client_profile.sql` — canonical agency-scoped table + RLS shape
    - `supabase/migrations/20260520_kotoiq_agency_integrations.sql` — per-table trigger pattern (no shared `set_updated_at` helper)
    - Supabase RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security (open at implementation time — training data outdated)
  </read_first>
  <behavior>
    - Migration is idempotent: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for `agencies.features`, `DROP POLICY IF EXISTS` before `CREATE POLICY`, `CREATE OR REPLACE FUNCTION` for triggers
    - `agencies.features` column: `ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb`. Existing rows backfill to `{}` automatically via the `DEFAULT`
    - `koto_fitness_trainees`: full column set per CONTEXT D-15 + `status text NOT NULL DEFAULT 'intake_complete' CHECK (status IN ('intake_complete','plan_generated','archived'))` + `archived_at timestamptz`
    - `koto_fitness_plans`: shell columns — `id`, `agency_id`, `trainee_id uuid NOT NULL REFERENCES koto_fitness_trainees(id) ON DELETE CASCADE`, `baseline jsonb`, `roadmap jsonb`, `week_workout jsonb`, `week_meals jsonb`, `grocery_list jsonb`, `model text`, `generated_at timestamptz`, `created_at`, `updated_at`. No inserts in Phase 1
    - `koto_fitness_progress`: shell columns — `id`, `agency_id`, `trainee_id`, `checked_in_at`, `weight_kg`, `notes text`, `photos jsonb`, `created_at`, `updated_at`. No inserts in Phase 1
    - RLS on all three tables: `USING (agency_id = current_setting('app.agency_id', true)::uuid)` + matching `WITH CHECK`
    - Per-table `set_updated_at` functions (one `CREATE OR REPLACE FUNCTION` per table, per Phase 7 Plan 1 decision) + trigger `BEFORE UPDATE`
    - Indexes: `CREATE INDEX ON koto_fitness_trainees (agency_id, archived_at)` + `ON koto_fitness_trainees (agency_id, status)` + `ON koto_fitness_plans (trainee_id)` + `ON koto_fitness_progress (trainee_id, checked_in_at DESC)`
  </behavior>
  <action>
Write `supabase/migrations/20260NNN_koto_fitness_foundation.sql` (bump NNN to the next unused number at execute time — check `supabase/migrations/` for the latest). Structure:

```sql
-- Trainer Phase 1 Plan 1 — koto_fitness foundation
-- Adds: agencies.features jsonb column + koto_fitness_trainees / _plans / _progress
-- RLS: agency-isolated per Koto standard. Trainee-self-access added in Phase 3.

-- 1. agencies.features column (idempotent)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS agencies_features_fitness_coach_idx
  ON agencies ((features->>'fitness_coach'))
  WHERE features->>'fitness_coach' = 'true';

-- 2. koto_fitness_trainees
CREATE TABLE IF NOT EXISTS koto_fitness_trainees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  -- Identity
  full_name text NOT NULL,
  email text,
  phone text,
  -- Basics
  age int,
  sex text,
  height_cm numeric,
  current_weight_kg numeric,
  target_weight_kg numeric,
  -- Goal
  primary_goal text CHECK (primary_goal IN ('lose_fat','gain_muscle','maintain','performance','recomp')),
  -- Experience
  training_experience_years numeric,
  training_days_per_week int CHECK (training_days_per_week BETWEEN 0 AND 7),
  equipment_access text CHECK (equipment_access IN ('none','bands','home_gym','full_gym')),
  -- Health
  medical_flags text,
  injuries text,
  pregnancy_or_nursing boolean,
  -- Food
  dietary_preference text CHECK (dietary_preference IN ('none','vegetarian','vegan','pescatarian','keto','paleo','custom')),
  allergies text,
  grocery_budget_usd_per_week numeric,
  meals_per_day int CHECK (meals_per_day BETWEEN 3 AND 6),
  -- Lifestyle
  sleep_hours_avg numeric,
  stress_level int CHECK (stress_level BETWEEN 1 AND 10),
  occupation_activity text CHECK (occupation_activity IN ('sedentary','light','moderate','heavy')),
  -- Internal
  trainer_notes text,
  status text NOT NULL DEFAULT 'intake_complete' CHECK (status IN ('intake_complete','plan_generated','archived')),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS koto_fitness_trainees_agency_archived_idx
  ON koto_fitness_trainees (agency_id, archived_at);
CREATE INDEX IF NOT EXISTS koto_fitness_trainees_agency_status_idx
  ON koto_fitness_trainees (agency_id, status);

ALTER TABLE koto_fitness_trainees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS koto_fitness_trainees_agency_isolation ON koto_fitness_trainees;
CREATE POLICY koto_fitness_trainees_agency_isolation
  ON koto_fitness_trainees
  FOR ALL
  USING (agency_id = current_setting('app.agency_id', true)::uuid)
  WITH CHECK (agency_id = current_setting('app.agency_id', true)::uuid);

CREATE OR REPLACE FUNCTION koto_fitness_trainees_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS koto_fitness_trainees_updated_at ON koto_fitness_trainees;
CREATE TRIGGER koto_fitness_trainees_updated_at
  BEFORE UPDATE ON koto_fitness_trainees
  FOR EACH ROW EXECUTE FUNCTION koto_fitness_trainees_set_updated_at();

-- 3. koto_fitness_plans (shell for Phase 2 — schema reflects updated DEC-02 chain)
CREATE TABLE IF NOT EXISTS koto_fitness_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES koto_fitness_trainees(id) ON DELETE CASCADE,
  block_number int NOT NULL DEFAULT 1,  -- 1 = initial plan, 2+ = adjust-from-progress iterations
  baseline jsonb,
  workout_plan jsonb,             -- 2-week trackable program from generate_workout_plan
  food_preferences jsonb,         -- answers to elicit_food_preferences questions
  meal_plan jsonb,                -- 2-week menu from generate_meal_plan
  grocery_list jsonb,             -- aisle-organized list (same Sonnet call as meal_plan)
  adjustment_summary jsonb,       -- adjustments_made[] from adjust_from_progress (null for block_number=1)
  model text,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS koto_fitness_plans_trainee_idx ON koto_fitness_plans (trainee_id);

ALTER TABLE koto_fitness_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS koto_fitness_plans_agency_isolation ON koto_fitness_plans;
CREATE POLICY koto_fitness_plans_agency_isolation
  ON koto_fitness_plans
  FOR ALL
  USING (agency_id = current_setting('app.agency_id', true)::uuid)
  WITH CHECK (agency_id = current_setting('app.agency_id', true)::uuid);

CREATE OR REPLACE FUNCTION koto_fitness_plans_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS koto_fitness_plans_updated_at ON koto_fitness_plans;
CREATE TRIGGER koto_fitness_plans_updated_at
  BEFORE UPDATE ON koto_fitness_plans
  FOR EACH ROW EXECUTE FUNCTION koto_fitness_plans_set_updated_at();

-- 4. koto_fitness_workout_logs (per-set logging — feeds adjust_from_progress Sonnet prompt)
CREATE TABLE IF NOT EXISTS koto_fitness_workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES koto_fitness_trainees(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES koto_fitness_plans(id) ON DELETE CASCADE,
  session_day_number int NOT NULL,       -- 1-14 within the 2-week block
  session_logged_at timestamptz NOT NULL DEFAULT now(),
  exercise_id text NOT NULL,             -- stable slug e.g. 'barbell_back_squat' — matches workout_plan JSON
  exercise_name text NOT NULL,           -- denormalized for history display
  set_number int NOT NULL,               -- 1-based
  actual_weight_kg numeric,              -- nullable (bodyweight exercises)
  actual_reps int NOT NULL,
  rpe numeric CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS koto_fitness_workout_logs_plan_idx
  ON koto_fitness_workout_logs (plan_id, session_day_number, exercise_id, set_number);
CREATE INDEX IF NOT EXISTS koto_fitness_workout_logs_trainee_idx
  ON koto_fitness_workout_logs (trainee_id, session_logged_at DESC);

ALTER TABLE koto_fitness_workout_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS koto_fitness_workout_logs_agency_isolation ON koto_fitness_workout_logs;
CREATE POLICY koto_fitness_workout_logs_agency_isolation
  ON koto_fitness_workout_logs
  FOR ALL
  USING (agency_id = current_setting('app.agency_id', true)::uuid)
  WITH CHECK (agency_id = current_setting('app.agency_id', true)::uuid);

CREATE OR REPLACE FUNCTION koto_fitness_workout_logs_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS koto_fitness_workout_logs_updated_at ON koto_fitness_workout_logs;
CREATE TRIGGER koto_fitness_workout_logs_updated_at
  BEFORE UPDATE ON koto_fitness_workout_logs
  FOR EACH ROW EXECUTE FUNCTION koto_fitness_workout_logs_set_updated_at();

-- 5. koto_fitness_progress (shell for v2 — weight/photo check-ins)
CREATE TABLE IF NOT EXISTS koto_fitness_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES koto_fitness_trainees(id) ON DELETE CASCADE,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  weight_kg numeric,
  notes text,
  photos jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS koto_fitness_progress_trainee_idx
  ON koto_fitness_progress (trainee_id, checked_in_at DESC);

ALTER TABLE koto_fitness_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS koto_fitness_progress_agency_isolation ON koto_fitness_progress;
CREATE POLICY koto_fitness_progress_agency_isolation
  ON koto_fitness_progress
  FOR ALL
  USING (agency_id = current_setting('app.agency_id', true)::uuid)
  WITH CHECK (agency_id = current_setting('app.agency_id', true)::uuid);

CREATE OR REPLACE FUNCTION koto_fitness_progress_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS koto_fitness_progress_updated_at ON koto_fitness_progress;
CREATE TRIGGER koto_fitness_progress_updated_at
  BEFORE UPDATE ON koto_fitness_progress
  FOR EACH ROW EXECUTE FUNCTION koto_fitness_progress_set_updated_at();
```
  </action>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Vitest shape + RLS test</name>
  <files>tests/trainer/phase1/migrationShape.test.ts</files>
  <read_first>
    - Existing Phase 8 migration tests (e.g. `tests/kotoiq/phase8/profileConfig.test.ts`) for style + Supabase test-client setup
  </read_first>
  <behavior>
    - Test: `agencies` has a `features` column of type `jsonb` with default `{}`
    - Test: insert a trainee under agency A + set `app.agency_id` to A's uuid → SELECT returns 1 row
    - Test: set `app.agency_id` to agency B's uuid → SELECT returns 0 rows (cross-agency isolation)
    - Test: `UPDATE koto_fitness_trainees SET full_name = ...` bumps `updated_at`
    - Test: INSERT with `primary_goal = 'invalid'` raises check-constraint error
  </behavior>
  <action>
Write `tests/trainer/phase1/migrationShape.test.ts` using the local Supabase test helper (follow whatever Phase 8 tests use). Spin up two agencies, insert one trainee under each, toggle `app.agency_id`, assert visibility. If the project doesn't yet have a migration-test harness, scaffold it following `tests/kotoiq/phase8/` conventions.
  </action>
</task>

</tasks>

<verification>
- `pnpm supabase db reset` (or the project's equivalent) applies the migration cleanly
- `pnpm test tests/trainer/phase1/migrationShape.test.ts` passes
- `supabase db lint` shows no new warnings
- `git diff supabase/migrations/` is a single new SQL file; no edits to existing migrations
</verification>

<deviations_protocol>
- If `agencies.features` column already exists with a different default / type, STOP and flag — do not silently alter. Record in SUMMARY.md under "Deviations"
- If the Supabase RLS `current_setting('app.agency_id')` pattern is NOT how Koto sets agency context at query time (i.e. the app uses a different convention like a JWT claim), adapt policies to match the existing pattern in `20260507_kotoiq_client_profile.sql` — do NOT invent a new pattern
- If a later migration in `supabase/migrations/` has already added a `features` column (check before writing), merge gracefully — this plan's migration should be an additive no-op if the column is present
</deviations_protocol>
