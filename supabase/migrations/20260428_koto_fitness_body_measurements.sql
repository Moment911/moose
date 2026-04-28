-- 2026-04-28 — Body Measurements tracking
-- 10 body part measurements logged periodically, stored in inches (US market)

CREATE TABLE IF NOT EXISTS public.koto_fitness_body_measurements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  trainee_id      uuid NOT NULL REFERENCES public.koto_fitness_trainees(id) ON DELETE CASCADE,
  measured_at     timestamptz NOT NULL DEFAULT now(),

  -- All measurements in inches
  chest           numeric,
  waist           numeric,
  hips            numeric,
  shoulders       numeric,
  neck            numeric,
  bicep_left      numeric,
  bicep_right     numeric,
  thigh_left      numeric,
  thigh_right     numeric,
  calf_left       numeric,
  calf_right      numeric,
  forearm_left    numeric,
  forearm_right   numeric,

  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koto_fitness_body_measurements_trainee
  ON public.koto_fitness_body_measurements (trainee_id, measured_at DESC);

ALTER TABLE public.koto_fitness_body_measurements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "koto_fitness_body_measurements_all" ON public.koto_fitness_body_measurements;
CREATE POLICY "koto_fitness_body_measurements_all" ON public.koto_fitness_body_measurements
  FOR ALL USING (true) WITH CHECK (true);
