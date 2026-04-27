-- ============================================================
-- Trainer — add baseball recruiting + workload columns to trainees
--
-- The intake page (`/intake/:traineeId`) and the trainer detail page
-- both treat these as flat columns on `koto_fitness_trainees`, but the
-- foundation migration only created the core/health/diet/lifestyle set.
-- The intake-chat-token route writes them via fire-and-forget, so the
-- "column does not exist" errors never reached the user — answers were
-- silently dropped.
--
-- This migration creates the columns. Types match how the UI renders
-- them: integer/numeric where it does math, text for pill ranges
-- ("2-3", "60-80"), text[] for the multi-select preferences.
-- ============================================================

ALTER TABLE public.koto_fitness_trainees
  -- Recruiting
  ADD COLUMN IF NOT EXISTS grad_year             int,
  ADD COLUMN IF NOT EXISTS position_primary      text,
  ADD COLUMN IF NOT EXISTS position_secondary    text,
  ADD COLUMN IF NOT EXISTS throwing_hand         text,
  ADD COLUMN IF NOT EXISTS batting_hand          text,
  ADD COLUMN IF NOT EXISTS gpa                   numeric,
  ADD COLUMN IF NOT EXISTS test_type             text,
  ADD COLUMN IF NOT EXISTS test_score            int,
  ADD COLUMN IF NOT EXISTS fastball_velo_peak    numeric,
  ADD COLUMN IF NOT EXISTS fastball_velo_sit     numeric,
  ADD COLUMN IF NOT EXISTS exit_velo             numeric,
  ADD COLUMN IF NOT EXISTS sixty_time            numeric,
  ADD COLUMN IF NOT EXISTS pop_time              numeric,
  ADD COLUMN IF NOT EXISTS high_school           text,
  ADD COLUMN IF NOT EXISTS high_school_state     text,
  ADD COLUMN IF NOT EXISTS travel_team           text,
  ADD COLUMN IF NOT EXISTS video_link            text,
  ADD COLUMN IF NOT EXISTS preferred_divisions   text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS preferred_states      text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS intended_major        text,

  -- Workload
  ADD COLUMN IF NOT EXISTS club_team                  text,
  ADD COLUMN IF NOT EXISTS practices_per_week         text,
  ADD COLUMN IF NOT EXISTS bullpen_sessions_per_week  text,
  ADD COLUMN IF NOT EXISTS game_appearances_per_week  text,
  ADD COLUMN IF NOT EXISTS avg_pitch_count            text,
  ADD COLUMN IF NOT EXISTS pitch_arsenal              text,
  ADD COLUMN IF NOT EXISTS long_toss_routine          text,
  ADD COLUMN IF NOT EXISTS arm_soreness               text,
  ADD COLUMN IF NOT EXISTS games_per_week             text,
  ADD COLUMN IF NOT EXISTS offseason_training         text,
  ADD COLUMN IF NOT EXISTS other_sports               text;

-- Schema drift fix: an earlier hand-applied schema landed several workload
-- columns as `integer`, but the intake form sends pill *ranges* like "2-3"
-- and "60-80". Coerce those columns to text so inserts don't reject. The
-- USING clause preserves any pre-existing integer values as their string
-- form. Idempotent — re-running this is a no-op once the type is text.
DO $$
DECLARE
  col_name text;
  workload_cols text[] := ARRAY[
    'practices_per_week',
    'bullpen_sessions_per_week',
    'game_appearances_per_week',
    'avg_pitch_count',
    'games_per_week'
  ];
BEGIN
  FOREACH col_name IN ARRAY workload_cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'koto_fitness_trainees'
        AND column_name = col_name
        AND data_type = 'integer'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.koto_fitness_trainees ALTER COLUMN %I TYPE text USING %I::text',
        col_name, col_name
      );
    END IF;
  END LOOP;
END $$;
