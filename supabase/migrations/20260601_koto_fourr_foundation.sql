-- ============================================================
-- 4R Method Intake — koto_fourr_* foundation
--
-- Adds the DB surface for the 4R Method conversational intake system:
--   - agency_features.fourr_method boolean column (feature flag)
--   - koto_fourr_patients: patient intake record with demographics, pain,
--     medical history, lifestyle, goals, red flags, and conversation_log
--   - koto_fourr_patient_users: user ↔ patient mapping (mirrors trainee_users)
--   - koto_fourr_protocols: generated protocol output (assessment, phase
--     recommendation, modality plan, protocol schedule)
--
-- RLS pattern: service-role only (USING/WITH CHECK true); app-layer
-- enforces agency_id scoping via explicit .eq('agency_id', agencyId).
-- ============================================================

-- ── 1. agency_features.fourr_method boolean ──────────────────────────────
ALTER TABLE public.agency_features
  ADD COLUMN IF NOT EXISTS fourr_method boolean NOT NULL DEFAULT false;

-- ── 2. koto_fourr_patients ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.koto_fourr_patients (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id                  uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,

  -- Identity
  full_name                  text NOT NULL,
  email                      text,
  phone                      text,

  -- Demographics
  age                        int,
  sex                        text,
  height_cm                  numeric,
  weight_kg                  numeric,

  -- Chief complaint
  chief_complaint            text,
  pain_locations             jsonb,       -- ["lower_back", "neck", "right_shoulder"]
  pain_severity              int CHECK (pain_severity IS NULL OR (pain_severity BETWEEN 1 AND 10)),
  pain_duration              text,        -- "3 months", "2 years", "1 week"
  pain_type                  text CHECK (pain_type IS NULL OR pain_type IN (
                                'sharp', 'dull', 'burning', 'aching',
                                'throbbing', 'radiating', 'stiffness'
                             )),
  pain_frequency             text CHECK (pain_frequency IS NULL OR pain_frequency IN (
                                'constant', 'intermittent', 'occasional',
                                'activity_dependent', 'morning_only', 'night_only'
                             )),
  aggravating_factors        text,
  relieving_factors          text,

  -- Medical history
  medical_conditions         text,        -- "None" or list
  surgeries                  text,        -- "None" or list
  medications                text,        -- "None" or list

  -- Previous treatments
  previous_chiro             text,        -- "None" or description
  previous_pt                text,        -- "None" or description
  previous_other_treatments  text,        -- massage, injections, etc.
  imaging_done               text,        -- "None" or "X-ray lower back 2024"

  -- Lifestyle
  occupation                 text,
  occupation_activity        text CHECK (occupation_activity IS NULL OR occupation_activity IN (
                                'sedentary', 'light', 'moderate', 'heavy'
                             )),
  exercise_frequency         text,        -- "3x/week", "none", "daily walks"
  sleep_hours_avg            numeric,
  sleep_quality              text CHECK (sleep_quality IS NULL OR sleep_quality IN (
                                'good', 'fair', 'poor'
                             )),
  stress_level               int CHECK (stress_level IS NULL OR (stress_level BETWEEN 1 AND 10)),

  -- Goals + safety
  goals                      jsonb,       -- ["pain_relief", "mobility", "performance"]
  red_flags                  jsonb,       -- ["numbness_tingling", "recent_trauma"] or []

  -- Free-text narrative (drives all protocol prompts)
  about_you                  text,

  -- Conversation state
  conversation_log           jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Internal
  status                     text NOT NULL DEFAULT 'intake_in_progress'
                             CHECK (status IN (
                                'intake_in_progress', 'intake_complete',
                                'protocol_generated', 'archived'
                             )),
  archived_at                timestamptz,

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koto_fourr_patients_agency_status
  ON public.koto_fourr_patients (agency_id, status);
CREATE INDEX IF NOT EXISTS idx_koto_fourr_patients_agency_archived
  ON public.koto_fourr_patients (agency_id, archived_at);

ALTER TABLE public.koto_fourr_patients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "koto_fourr_patients_all" ON public.koto_fourr_patients;
CREATE POLICY "koto_fourr_patients_all" ON public.koto_fourr_patients
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.koto_fourr_patients_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_koto_fourr_patients_updated
  ON public.koto_fourr_patients;
CREATE TRIGGER trg_koto_fourr_patients_updated
  BEFORE UPDATE ON public.koto_fourr_patients
  FOR EACH ROW EXECUTE FUNCTION public.koto_fourr_patients_set_updated_at();

-- ── 3. koto_fourr_patient_users ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.koto_fourr_patient_users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id            uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  patient_id           uuid NOT NULL REFERENCES public.koto_fourr_patients(id) ON DELETE CASCADE,

  user_id              uuid,             -- populated on signup
  invite_email         text,
  invite_status        text NOT NULL DEFAULT 'active'
                       CHECK (invite_status IN (
                          'pending', 'invited', 'active', 'bounced', 'revoked'
                       )),

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_koto_fourr_patient_users_patient
  ON public.koto_fourr_patient_users (patient_id);
CREATE INDEX IF NOT EXISTS idx_koto_fourr_patient_users_user
  ON public.koto_fourr_patient_users (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_koto_fourr_patient_users_agency
  ON public.koto_fourr_patient_users (agency_id);

ALTER TABLE public.koto_fourr_patient_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "koto_fourr_patient_users_all" ON public.koto_fourr_patient_users;
CREATE POLICY "koto_fourr_patient_users_all" ON public.koto_fourr_patient_users
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.koto_fourr_patient_users_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_koto_fourr_patient_users_updated
  ON public.koto_fourr_patient_users;
CREATE TRIGGER trg_koto_fourr_patient_users_updated
  BEFORE UPDATE ON public.koto_fourr_patient_users
  FOR EACH ROW EXECUTE FUNCTION public.koto_fourr_patient_users_set_updated_at();

-- ── 4. koto_fourr_protocols ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.koto_fourr_protocols (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id            uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  patient_id           uuid NOT NULL REFERENCES public.koto_fourr_patients(id) ON DELETE CASCADE,

  -- Sonnet chain outputs (each is the tool_use args jsonb)
  assessment           jsonb,            -- clinical assessment
  phase_recommendation jsonb,            -- which R-phases + rationale
  modality_plan        jsonb,            -- per-phase modality selections
  protocol_schedule    jsonb,            -- week-by-week timeline

  model                text,
  generated_at         timestamptz,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koto_fourr_protocols_patient
  ON public.koto_fourr_protocols (patient_id);

ALTER TABLE public.koto_fourr_protocols ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "koto_fourr_protocols_all" ON public.koto_fourr_protocols;
CREATE POLICY "koto_fourr_protocols_all" ON public.koto_fourr_protocols
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.koto_fourr_protocols_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_koto_fourr_protocols_updated
  ON public.koto_fourr_protocols;
CREATE TRIGGER trg_koto_fourr_protocols_updated
  BEFORE UPDATE ON public.koto_fourr_protocols
  FOR EACH ROW EXECUTE FUNCTION public.koto_fourr_protocols_set_updated_at();
