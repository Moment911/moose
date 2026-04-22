-- ============================================================
-- Trainer Phase 3 — koto_fitness_trainee_users
--
-- Links a Supabase auth user (auth.users) to a koto_fitness_trainees row
-- 1:1. Created when the agency clicks "Send invite" from the trainee
-- detail page; populated with user_id once the trainee accepts the
-- magic-link email and lands on /my-plan.
--
-- WHY not extend koto_fitness_trainees with a user_id column?
--   Separation of concerns:
--     - trainees row = trainer-curated data (intake, notes)
--     - trainee_users row = auth + invite lifecycle
--   A trainee might never accept an invite, or be re-invited. Keeping
--   the invite state on its own row avoids polluting the trainee row
--   with invite_status / invite_sent_at / etc., and keeps the trainee
--   list query shape clean.
--
-- RLS: follows the canonical koto_fitness_* pattern — service-role only
-- (USING (true) WITH CHECK (true)); trainee isolation is enforced at the
-- app layer by /api/trainer/my-plan resolving the trainee_id from the
-- authenticated user's mapping row, NOT from the request body.
--
-- Referenced decisions:
--   D-20  Disclaimer ack pinned at top of /my-plan; acked once per trainee.
--         `disclaimer_ack_at` mirrors auth.users.user_metadata.trainer_disclaimer_ack_at
--         so either source of truth answers "did this trainee accept?"
-- ============================================================

CREATE TABLE IF NOT EXISTS public.koto_fitness_trainee_users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id          uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  trainee_id         uuid NOT NULL REFERENCES public.koto_fitness_trainees(id) ON DELETE CASCADE,

  -- auth.users.id — NULL until invite accepted. UNIQUE so one auth user
  -- maps to at most one trainee record.
  user_id            uuid UNIQUE,

  invite_email       text NOT NULL,
  invite_status      text NOT NULL DEFAULT 'pending'
                     CHECK (invite_status IN (
                       'pending', 'invited', 'active', 'bounced', 'revoked'
                     )),
  invite_sent_at     timestamptz,
  invite_accepted_at timestamptz,
  disclaimer_ack_at  timestamptz,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- One invite row per trainee — resend_invite updates the existing row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_koto_fitness_trainee_users_trainee_unique
  ON public.koto_fitness_trainee_users (trainee_id);

-- Lookups by agency (invite dashboard) + by user_id (self-auth path in
-- /api/trainer/my-plan). user_id is already UNIQUE so no extra index.
CREATE INDEX IF NOT EXISTS idx_koto_fitness_trainee_users_agency
  ON public.koto_fitness_trainee_users (agency_id);

ALTER TABLE public.koto_fitness_trainee_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "koto_fitness_trainee_users_all" ON public.koto_fitness_trainee_users;
CREATE POLICY "koto_fitness_trainee_users_all" ON public.koto_fitness_trainee_users
  FOR ALL USING (true) WITH CHECK (true);  -- service-role only; scoped in app layer

CREATE OR REPLACE FUNCTION public.koto_fitness_trainee_users_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_koto_fitness_trainee_users_updated
  ON public.koto_fitness_trainee_users;
CREATE TRIGGER trg_koto_fitness_trainee_users_updated
  BEFORE UPDATE ON public.koto_fitness_trainee_users
  FOR EACH ROW EXECUTE FUNCTION public.koto_fitness_trainee_users_set_updated_at();
