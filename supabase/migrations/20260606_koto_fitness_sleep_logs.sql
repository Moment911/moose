-- ─────────────────────────────────────────────────────────────────────────────
-- Trainer Phase C — Sleep log
--
--   koto_fitness_sleep_logs — one row per athlete per night.
--
-- Design notes
--   - sleep_date is the wake-up calendar date (so a 10pm–6am session
--     logs under the wake-up day, matching common tracker conventions).
--   - UNIQUE(trainee_id, sleep_date) so the athlete can only have one
--     entry per night; re-submits update in place via upsert.
--   - hours_slept stored as numeric(3,1) to allow e.g. 7.5.
--   - quality_1_10 is optional (some athletes log only hours).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.koto_fitness_sleep_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  trainee_id    uuid NOT NULL REFERENCES public.koto_fitness_trainees(id) ON DELETE CASCADE,
  sleep_date    date NOT NULL,
  hours_slept   numeric(3,1) NOT NULL CHECK (hours_slept >= 0 AND hours_slept <= 24),
  quality_1_10  smallint CHECK (quality_1_10 IS NULL OR (quality_1_10 >= 1 AND quality_1_10 <= 10)),
  bed_time      time,
  wake_time     time,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainee_id, sleep_date)
);

CREATE INDEX IF NOT EXISTS idx_koto_fitness_sleep_logs_trainee_date
  ON public.koto_fitness_sleep_logs (trainee_id, sleep_date DESC);
CREATE INDEX IF NOT EXISTS idx_koto_fitness_sleep_logs_agency_date
  ON public.koto_fitness_sleep_logs (agency_id, sleep_date DESC);

ALTER TABLE public.koto_fitness_sleep_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "koto_fitness_sleep_logs_all" ON public.koto_fitness_sleep_logs;
CREATE POLICY "koto_fitness_sleep_logs_all" ON public.koto_fitness_sleep_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.koto_fitness_sleep_logs_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_koto_fitness_sleep_logs_updated
  ON public.koto_fitness_sleep_logs;
CREATE TRIGGER trg_koto_fitness_sleep_logs_updated
  BEFORE UPDATE ON public.koto_fitness_sleep_logs
  FOR EACH ROW EXECUTE FUNCTION public.koto_fitness_sleep_logs_set_updated_at();
