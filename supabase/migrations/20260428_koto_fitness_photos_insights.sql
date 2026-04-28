-- Progress photos — stored in Supabase storage, metadata here
CREATE TABLE IF NOT EXISTS public.koto_fitness_progress_photos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  trainee_id      uuid NOT NULL REFERENCES public.koto_fitness_trainees(id) ON DELETE CASCADE,
  taken_at        timestamptz NOT NULL DEFAULT now(),
  pose            text NOT NULL DEFAULT 'front' CHECK (pose IN ('front', 'side', 'back')),
  storage_path    text NOT NULL,
  public_url      text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koto_fitness_progress_photos_trainee
  ON public.koto_fitness_progress_photos (trainee_id, taken_at DESC);

ALTER TABLE public.koto_fitness_progress_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "koto_fitness_progress_photos_all" ON public.koto_fitness_progress_photos
  FOR ALL USING (true) WITH CHECK (true);

-- AI weekly insights / plan adjustment log
CREATE TABLE IF NOT EXISTS public.koto_fitness_ai_insights (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  trainee_id      uuid NOT NULL REFERENCES public.koto_fitness_trainees(id) ON DELETE CASCADE,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  week_of         date NOT NULL,
  summary         text NOT NULL,
  whats_working   jsonb DEFAULT '[]'::jsonb,
  needs_attention jsonb DEFAULT '[]'::jsonb,
  plan_changes    jsonb DEFAULT '[]'::jsonb,
  data_snapshot   jsonb,
  modified_fields jsonb DEFAULT '[]'::jsonb,
  model           text DEFAULT 'sonnet',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koto_fitness_ai_insights_trainee
  ON public.koto_fitness_ai_insights (trainee_id, week_of DESC);

ALTER TABLE public.koto_fitness_ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "koto_fitness_ai_insights_all" ON public.koto_fitness_ai_insights
  FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', true)
ON CONFLICT (id) DO NOTHING;
