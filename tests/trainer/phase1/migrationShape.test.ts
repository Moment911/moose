import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 1 Plan 01 — migration shape assertions.
//
// Koto has no live-Supabase test harness for migrations (Phase 8 tests are
// all pure unit tests against lib modules).  This suite does the next best
// thing: static SQL-file shape assertions.  Catches accidental drops of
// tables, columns, constraints, policies, or triggers when the migration
// gets touched later.
//
// DEVIATION from PLAN: the PLAN's spec of "cross-agency RLS isolation via
// current_setting('app.agency_id')" was based on the outlier pattern in
// 20260505_kotoiq_builder.sql.  Canonical Koto RLS (20260507 onward) uses
// USING (true) WITH CHECK (true) — service-role + app-layer scoping — so a
// live-DB cross-agency RLS test doesn't map to how isolation actually works
// here.  The PLAN's deviations_protocol explicitly instructed matching the
// canonical pattern; this test reflects that.
// ─────────────────────────────────────────────────────────────────────────────

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260525_koto_fitness_foundation.sql'
)

const SQL = readFileSync(MIGRATION_PATH, 'utf8')

describe('trainer phase 1 plan 01 — migration shape', () => {
  describe('agencies.features feature-flag column', () => {
    it('adds features jsonb column idempotently', () => {
      expect(SQL).toMatch(
        /ALTER TABLE public\.agencies[\s\S]*?ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '\{\}'::jsonb/
      )
    })

    it('indexes agencies where fitness_coach is enabled', () => {
      expect(SQL).toMatch(/idx_agencies_features_fitness_coach/)
      expect(SQL).toMatch(/features->>'fitness_coach'/)
    })
  })

  describe('koto_fitness_trainees', () => {
    it('creates the table with agency_id FK + ON DELETE CASCADE', () => {
      expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS public\.koto_fitness_trainees/)
      expect(SQL).toMatch(
        /agency_id\s+uuid NOT NULL REFERENCES public\.agencies\(id\) ON DELETE CASCADE/
      )
    })

    it('requires full_name', () => {
      expect(SQL).toMatch(/full_name\s+text NOT NULL/)
    })

    it('does NOT have a client_id column (trainees are flat under agency per DEC-01)', () => {
      // Only one specific match pattern; client_id would violate the flat model
      const traineesBlock = SQL.match(
        /CREATE TABLE IF NOT EXISTS public\.koto_fitness_trainees[\s\S]*?\);/
      )?.[0]
      expect(traineesBlock).toBeTruthy()
      expect(traineesBlock!).not.toMatch(/\bclient_id\b/)
    })

    it('constrains primary_goal to the 5 enum values', () => {
      expect(SQL).toMatch(
        /primary_goal[\s\S]*?CHECK \(primary_goal IN \(\s*'lose_fat',\s*'gain_muscle',\s*'maintain',\s*'performance',\s*'recomp'\s*\)\)/
      )
    })

    it('constrains equipment_access to the 4 enum values', () => {
      expect(SQL).toMatch(
        /equipment_access\s+text CHECK \(equipment_access IN \(\s*'none',\s*'bands',\s*'home_gym',\s*'full_gym'\s*\)\)/
      )
    })

    it('constrains training_days_per_week 0-7 inclusive (null-tolerant)', () => {
      expect(SQL).toMatch(/training_days_per_week[\s\S]*?BETWEEN 0 AND 7/)
    })

    it('constrains meals_per_day 3-6 inclusive (null-tolerant)', () => {
      expect(SQL).toMatch(/meals_per_day[\s\S]*?BETWEEN 3 AND 6/)
    })

    it('constrains stress_level 1-10 inclusive (null-tolerant)', () => {
      expect(SQL).toMatch(/stress_level[\s\S]*?BETWEEN 1 AND 10/)
    })

    it('constrains dietary_preference to the 7 enum values (including custom)', () => {
      expect(SQL).toMatch(
        /dietary_preference[\s\S]*?CHECK \(dietary_preference IN \(\s*'none',\s*'vegetarian',\s*'vegan',\s*'pescatarian',\s*'keto',\s*'paleo',\s*'custom'\s*\)\)/
      )
    })

    it('constrains occupation_activity to the 4 enum values', () => {
      expect(SQL).toMatch(
        /occupation_activity\s+text CHECK \(occupation_activity IN \(\s*'sedentary',\s*'light',\s*'moderate',\s*'heavy'\s*\)\)/
      )
    })

    it('ships status with default intake_complete + 3-value enum', () => {
      expect(SQL).toMatch(/status[\s\S]*?DEFAULT 'intake_complete'/)
      expect(SQL).toMatch(
        /status[\s\S]*?CHECK \(status IN \(\s*'intake_complete',\s*'plan_generated',\s*'archived'\s*\)\)/
      )
    })

    it('has archived_at soft-delete column', () => {
      expect(SQL).toMatch(/archived_at\s+timestamptz/)
    })

    it('indexes (agency_id, archived_at) and (agency_id, status)', () => {
      expect(SQL).toMatch(
        /idx_koto_fitness_trainees_agency_archived[\s\S]*?\(agency_id, archived_at\)/
      )
      expect(SQL).toMatch(
        /idx_koto_fitness_trainees_agency_status[\s\S]*?\(agency_id, status\)/
      )
    })
  })

  describe('koto_fitness_plans', () => {
    it('creates the table with trainee_id FK + ON DELETE CASCADE', () => {
      expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS public\.koto_fitness_plans/)
      expect(SQL).toMatch(
        /trainee_id\s+uuid NOT NULL REFERENCES public\.koto_fitness_trainees\(id\) ON DELETE CASCADE/
      )
    })

    it('ships block_number with default 1 (adjust-from-progress appends blocks)', () => {
      expect(SQL).toMatch(/block_number\s+int NOT NULL DEFAULT 1/)
    })

    it('has a jsonb column per Sonnet-chain step (baseline/workout/prefs/meals/grocery/adjust)', () => {
      expect(SQL).toMatch(/baseline\s+jsonb/)
      expect(SQL).toMatch(/workout_plan\s+jsonb/)
      expect(SQL).toMatch(/food_preferences\s+jsonb/)
      expect(SQL).toMatch(/meal_plan\s+jsonb/)
      expect(SQL).toMatch(/grocery_list\s+jsonb/)
      expect(SQL).toMatch(/adjustment_summary\s+jsonb/)
    })

    it('indexes by (trainee_id, block_number DESC) for history queries', () => {
      expect(SQL).toMatch(
        /idx_koto_fitness_plans_trainee_block[\s\S]*?\(trainee_id, block_number DESC\)/
      )
    })
  })

  describe('koto_fitness_workout_logs', () => {
    it('creates the table with plan_id FK + ON DELETE CASCADE', () => {
      expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS public\.koto_fitness_workout_logs/)
      expect(SQL).toMatch(
        /plan_id\s+uuid NOT NULL REFERENCES public\.koto_fitness_plans\(id\) ON DELETE CASCADE/
      )
    })

    it('requires exercise_id + exercise_name (joins back to workout_plan JSON)', () => {
      expect(SQL).toMatch(/exercise_id\s+text NOT NULL/)
      expect(SQL).toMatch(/exercise_name\s+text NOT NULL/)
    })

    it('constrains session_day_number 1-14 (two-week block)', () => {
      expect(SQL).toMatch(/session_day_number\s+int\s+NOT NULL CHECK \(session_day_number BETWEEN 1 AND 14\)/)
    })

    it('constrains rpe to 1-10 (null-tolerant — optional metric)', () => {
      expect(SQL).toMatch(/rpe\s+numeric CHECK \(rpe IS NULL OR \(rpe BETWEEN 1 AND 10\)\)/)
    })

    it('allows null actual_weight_kg (bodyweight exercises)', () => {
      // actual_weight_kg must be numeric but NOT NOT-NULL
      expect(SQL).toMatch(/actual_weight_kg\s+numeric,/)
    })

    it('indexes by (plan_id, session_day_number, exercise_id, set_number)', () => {
      expect(SQL).toMatch(
        /idx_koto_fitness_workout_logs_plan[\s\S]*?\(plan_id, session_day_number, exercise_id, set_number\)/
      )
    })
  })

  describe('koto_fitness_progress (v2 shell)', () => {
    it('creates the table with trainee_id FK', () => {
      expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS public\.koto_fitness_progress/)
      expect(SQL).toMatch(
        /trainee_id\s+uuid NOT NULL REFERENCES public\.koto_fitness_trainees\(id\) ON DELETE CASCADE/
      )
    })

    it('ships weight_kg + notes + photos jsonb (v2 Phase 4 populates)', () => {
      expect(SQL).toMatch(/weight_kg\s+numeric/)
      expect(SQL).toMatch(/photos\s+jsonb/)
    })

    it('indexes by (trainee_id, checked_in_at DESC)', () => {
      expect(SQL).toMatch(
        /idx_koto_fitness_progress_trainee[\s\S]*?\(trainee_id, checked_in_at DESC\)/
      )
    })
  })

  describe('RLS — service-role + app-layer scoping (20260507 canonical pattern)', () => {
    const tables = [
      'koto_fitness_trainees',
      'koto_fitness_plans',
      'koto_fitness_workout_logs',
      'koto_fitness_progress',
    ] as const

    for (const t of tables) {
      it(`enables RLS on ${t} with USING (true) WITH CHECK (true)`, () => {
        expect(SQL).toMatch(new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`))
        expect(SQL).toMatch(
          new RegExp(
            `CREATE POLICY "${t}_all" ON public\\.${t}[\\s\\S]*?FOR ALL USING \\(true\\) WITH CHECK \\(true\\)`
          )
        )
      })

      it(`drops the ${t}_all policy before creating it (idempotent re-run)`, () => {
        expect(SQL).toMatch(
          new RegExp(`DROP POLICY IF EXISTS "${t}_all" ON public\\.${t}`)
        )
      })
    }

    it('does NOT use the outlier current_setting(app.agency_id) pattern in any policy', () => {
      // The migration header comment mentions current_setting to explain the
      // deviation from 20260505; the check here is that no CREATE POLICY
      // line or USING/WITH CHECK clause uses that pattern in an executable
      // statement.  We strip "-- ..." line comments before matching.
      const uncommented = SQL.replace(/--[^\n]*/g, '')
      expect(uncommented).not.toMatch(/current_setting\(\s*'app\.agency_id/)
    })
  })

  describe('updated_at triggers — one CREATE FUNCTION per table (Phase 7 Plan 1 precedent)', () => {
    const tables = [
      'koto_fitness_trainees',
      'koto_fitness_plans',
      'koto_fitness_workout_logs',
      'koto_fitness_progress',
    ] as const

    for (const t of tables) {
      it(`defines ${t}_set_updated_at function + BEFORE UPDATE trigger`, () => {
        expect(SQL).toMatch(
          new RegExp(`CREATE OR REPLACE FUNCTION public\\.${t}_set_updated_at`)
        )
        expect(SQL).toMatch(new RegExp(`NEW\\.updated_at := now\\(\\)`))
        expect(SQL).toMatch(
          new RegExp(`DROP TRIGGER IF EXISTS trg_${t}_updated\\s+ON public\\.${t}`)
        )
        expect(SQL).toMatch(
          new RegExp(
            `CREATE TRIGGER trg_${t}_updated\\s+BEFORE UPDATE ON public\\.${t}[\\s\\S]*?EXECUTE FUNCTION public\\.${t}_set_updated_at\\(\\)`
          )
        )
      })
    }
  })

  describe('idempotency', () => {
    it('every CREATE TABLE uses IF NOT EXISTS', () => {
      const creates = SQL.match(/CREATE TABLE[\s\S]+?\(/g) ?? []
      expect(creates.length).toBeGreaterThanOrEqual(4)
      for (const c of creates) {
        expect(c).toMatch(/CREATE TABLE IF NOT EXISTS/)
      }
    })

    it('every CREATE INDEX uses IF NOT EXISTS', () => {
      const creates = SQL.match(/CREATE INDEX[\s\S]+?;/g) ?? []
      expect(creates.length).toBeGreaterThanOrEqual(7)
      for (const c of creates) {
        expect(c).toMatch(/CREATE INDEX IF NOT EXISTS/)
      }
    })

    it('agencies.features ALTER TABLE uses IF NOT EXISTS', () => {
      expect(SQL).toMatch(/ADD COLUMN IF NOT EXISTS features jsonb/)
    })
  })
})
