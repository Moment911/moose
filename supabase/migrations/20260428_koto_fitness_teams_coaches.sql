-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-04-28 — Teams & Coaches (v2 — DO NOT RUN YET)
--
-- Multi-level access: athletes → coaches → teams
-- Run this when the teams/coaches feature is ready to build.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Teams ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.koto_fitness_teams (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name            text NOT NULL,
  sport           text,               -- 'baseball', 'football', 'basketball', etc.
  description     text,
  logo_url        text,
  created_by      uuid,               -- user_id of the coach who created it
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koto_fitness_teams_agency
  ON public.koto_fitness_teams (agency_id);

ALTER TABLE public.koto_fitness_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "koto_fitness_teams_all" ON public.koto_fitness_teams
  FOR ALL USING (true) WITH CHECK (true);

-- ── 2. Team Members (athlete ↔ team mapping) ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.koto_fitness_team_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         uuid NOT NULL REFERENCES public.koto_fitness_teams(id) ON DELETE CASCADE,
  trainee_id      uuid REFERENCES public.koto_fitness_trainees(id) ON DELETE CASCADE,
  user_id         uuid,               -- coach's auth user_id (if role=coach)
  role            text NOT NULL DEFAULT 'athlete'
                    CHECK (role IN ('athlete', 'coach', 'assistant', 'viewer')),
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'invited', 'removed')),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, trainee_id)
);

CREATE INDEX IF NOT EXISTS idx_koto_fitness_team_members_team
  ON public.koto_fitness_team_members (team_id, role);
CREATE INDEX IF NOT EXISTS idx_koto_fitness_team_members_trainee
  ON public.koto_fitness_team_members (trainee_id);

ALTER TABLE public.koto_fitness_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "koto_fitness_team_members_all" ON public.koto_fitness_team_members
  FOR ALL USING (true) WITH CHECK (true);

-- ── 3. Invitations ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.koto_fitness_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  type            text NOT NULL
                    CHECK (type IN ('coach_to_athlete', 'athlete_to_coach', 'team_invite')),
  from_user_id    uuid,               -- who sent it
  to_email        text NOT NULL,       -- recipient email
  team_id         uuid REFERENCES public.koto_fitness_teams(id) ON DELETE CASCADE,
  trainee_id      uuid REFERENCES public.koto_fitness_trainees(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'athlete',
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  message         text,               -- optional personal note
  token           text UNIQUE,         -- magic link token
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koto_fitness_invitations_email
  ON public.koto_fitness_invitations (to_email, status);
CREATE INDEX IF NOT EXISTS idx_koto_fitness_invitations_token
  ON public.koto_fitness_invitations (token) WHERE token IS NOT NULL;

ALTER TABLE public.koto_fitness_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "koto_fitness_invitations_all" ON public.koto_fitness_invitations
  FOR ALL USING (true) WITH CHECK (true);

-- ── 4. Comments (coach → athlete feedback) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.koto_fitness_comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  trainee_id      uuid NOT NULL REFERENCES public.koto_fitness_trainees(id) ON DELETE CASCADE,
  author_id       uuid NOT NULL,       -- user_id of the commenter
  author_name     text,                -- cached display name
  author_role     text NOT NULL DEFAULT 'coach'
                    CHECK (author_role IN ('coach', 'assistant', 'athlete', 'ai')),
  target_type     text NOT NULL
                    CHECK (target_type IN ('workout', 'meal', 'progress', 'general', 'plan')),
  target_id       uuid,               -- FK to the specific log/plan row (nullable for 'general')
  content         text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koto_fitness_comments_trainee
  ON public.koto_fitness_comments (trainee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_koto_fitness_comments_target
  ON public.koto_fitness_comments (target_type, target_id);

ALTER TABLE public.koto_fitness_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "koto_fitness_comments_all" ON public.koto_fitness_comments
  FOR ALL USING (true) WITH CHECK (true);

-- ── 5. Coach profiles ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.koto_fitness_coaches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id         uuid UNIQUE,         -- auth user_id
  full_name       text NOT NULL,
  email           text,
  phone           text,
  title           text,                -- "Head Coach", "Pitching Coach", "Trainer"
  sport           text,                -- primary sport
  certifications  text,                -- "CSCS, NSCA-CPT"
  bio             text,
  avatar_url      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koto_fitness_coaches_agency
  ON public.koto_fitness_coaches (agency_id);

ALTER TABLE public.koto_fitness_coaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "koto_fitness_coaches_all" ON public.koto_fitness_coaches
  FOR ALL USING (true) WITH CHECK (true);
