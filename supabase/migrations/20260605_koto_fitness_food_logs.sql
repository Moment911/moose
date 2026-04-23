-- ─────────────────────────────────────────────────────────────────────────────
-- Trainer Phase B — Food photo log + agency-level macro cache
--
--   koto_fitness_food_logs  — one row per logged food event for a trainee.
--   koto_fitness_food_cache — agency-level, normalized-name cache of macro
--                             values so repeat entries skip Claude vision.
--
-- Design notes
--   - items is jsonb so Claude vision responses + manual entries share shape:
--       [{ name, kcal, protein_g, fat_g, carb_g, portion? }, ...]
--   - total_* columns denormalize the sums for cheap daily/weekly reporting
--     without scanning items jsonb in every query.
--   - photo_url is nullable — manual entries don't upload a photo.
--   - log_date is a generated column so "today's intake" queries are a
--     single covered index lookup instead of a timestamp range scan.
--   - The cache is agency-scoped: a Koto multi-tenant deployment doesn't
--     leak one team's food library to another.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. koto_fitness_food_logs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.koto_fitness_food_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  trainee_id      uuid NOT NULL REFERENCES public.koto_fitness_trainees(id) ON DELETE CASCADE,
  logged_at       timestamptz NOT NULL DEFAULT now(),
  log_date        date GENERATED ALWAYS AS ((logged_at AT TIME ZONE 'UTC')::date) STORED,
  items           jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_kcal      integer NOT NULL DEFAULT 0,
  total_protein_g numeric(7,1) NOT NULL DEFAULT 0,
  total_fat_g     numeric(7,1) NOT NULL DEFAULT 0,
  total_carb_g    numeric(7,1) NOT NULL DEFAULT 0,
  source          text NOT NULL CHECK (source IN ('photo','manual')),
  photo_url       text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koto_fitness_food_logs_trainee_date
  ON public.koto_fitness_food_logs (trainee_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_koto_fitness_food_logs_agency_date
  ON public.koto_fitness_food_logs (agency_id, log_date DESC);

ALTER TABLE public.koto_fitness_food_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "koto_fitness_food_logs_all" ON public.koto_fitness_food_logs;
CREATE POLICY "koto_fitness_food_logs_all" ON public.koto_fitness_food_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.koto_fitness_food_logs_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_koto_fitness_food_logs_updated
  ON public.koto_fitness_food_logs;
CREATE TRIGGER trg_koto_fitness_food_logs_updated
  BEFORE UPDATE ON public.koto_fitness_food_logs
  FOR EACH ROW EXECUTE FUNCTION public.koto_fitness_food_logs_set_updated_at();


-- ── 2. koto_fitness_food_cache ───────────────────────────────────────────────
-- Normalized-name macro cache shared across all trainees in an agency.
-- Any athlete logging "grilled chicken breast 6oz" uses the macros the
-- agency has already seen for that name, skipping a Claude vision call.
CREATE TABLE IF NOT EXISTS public.koto_fitness_food_cache (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name_key        text NOT NULL,  -- lowercased, whitespace-collapsed
  display_name    text NOT NULL,  -- original casing for UI
  kcal            integer NOT NULL,
  protein_g       numeric(6,1) NOT NULL,
  fat_g           numeric(6,1) NOT NULL,
  carb_g          numeric(6,1) NOT NULL,
  portion_hint    text,           -- e.g. "6oz", "1 cup", nullable
  seen_count      integer NOT NULL DEFAULT 1,
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, name_key)
);

CREATE INDEX IF NOT EXISTS idx_koto_fitness_food_cache_agency_seen
  ON public.koto_fitness_food_cache (agency_id, seen_count DESC);

ALTER TABLE public.koto_fitness_food_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "koto_fitness_food_cache_all" ON public.koto_fitness_food_cache;
CREATE POLICY "koto_fitness_food_cache_all" ON public.koto_fitness_food_cache
  FOR ALL USING (true) WITH CHECK (true);
