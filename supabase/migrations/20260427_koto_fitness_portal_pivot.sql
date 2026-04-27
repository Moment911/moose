-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-04-27 — Athlete Portal Pivot
--
-- 1. Baseball measurable columns on koto_fitness_trainees (IF NOT EXISTS —
--    some may already exist from intake-chat field extraction patches)
-- 2. field_confidence JSONB for flagging AI-estimated vs confirmed values
-- 3. koto_fitness_measurable_logs for longitudinal stat tracking
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Baseball columns on trainees ─────────────────────────────────────────

ALTER TABLE public.koto_fitness_trainees
  ADD COLUMN IF NOT EXISTS position_primary text,
  ADD COLUMN IF NOT EXISTS position_secondary text,
  ADD COLUMN IF NOT EXISTS throwing_hand text,
  ADD COLUMN IF NOT EXISTS batting_hand text,
  ADD COLUMN IF NOT EXISTS fastball_velo_peak numeric,
  ADD COLUMN IF NOT EXISTS fastball_velo_sit numeric,
  ADD COLUMN IF NOT EXISTS exit_velo numeric,
  ADD COLUMN IF NOT EXISTS sixty_time numeric,
  ADD COLUMN IF NOT EXISTS pop_time numeric,
  ADD COLUMN IF NOT EXISTS pitch_arsenal jsonb,
  ADD COLUMN IF NOT EXISTS grad_year integer,
  ADD COLUMN IF NOT EXISTS gpa numeric,
  ADD COLUMN IF NOT EXISTS high_school text,
  ADD COLUMN IF NOT EXISTS club_team text,
  ADD COLUMN IF NOT EXISTS travel_team text,
  ADD COLUMN IF NOT EXISTS video_link text,
  ADD COLUMN IF NOT EXISTS preferred_divisions jsonb,
  ADD COLUMN IF NOT EXISTS preferred_states jsonb,
  ADD COLUMN IF NOT EXISTS intended_major text,
  ADD COLUMN IF NOT EXISTS bullpen_sessions_per_week integer,
  ADD COLUMN IF NOT EXISTS games_per_week integer,
  ADD COLUMN IF NOT EXISTS practices_per_week integer;

-- ── 2. Field confidence tracking ────────────────────────────────────────────

ALTER TABLE public.koto_fitness_trainees
  ADD COLUMN IF NOT EXISTS field_confidence jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.koto_fitness_trainees.field_confidence IS
  'Tracks whether each field value was user-confirmed or AI-estimated. Shape: { "field_key": "confirmed"|"estimated" }';

-- ── 3. Longitudinal measurable logs ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.koto_fitness_measurable_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  trainee_id    uuid NOT NULL REFERENCES public.koto_fitness_trainees(id) ON DELETE CASCADE,
  measured_at   timestamptz NOT NULL DEFAULT now(),
  metric_key    text NOT NULL,
  value         numeric NOT NULL,
  unit          text NOT NULL,
  source        text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'ai_estimated', 'device', 'event')),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koto_fitness_measurable_logs_trainee_metric
  ON public.koto_fitness_measurable_logs (trainee_id, metric_key, measured_at DESC);

CREATE INDEX IF NOT EXISTS idx_koto_fitness_measurable_logs_agency
  ON public.koto_fitness_measurable_logs (agency_id, trainee_id);

ALTER TABLE public.koto_fitness_measurable_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "koto_fitness_measurable_logs_all" ON public.koto_fitness_measurable_logs;
CREATE POLICY "koto_fitness_measurable_logs_all" ON public.koto_fitness_measurable_logs
  FOR ALL USING (true) WITH CHECK (true);  -- service-role only; app-layer scoping
