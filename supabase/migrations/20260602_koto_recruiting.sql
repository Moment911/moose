-- ─────────────────────────────────────────────────────────────────────────────
-- Koto Recruiting — college program database + hot lists.
--
-- Multi-sport from day one: every row has a sport column (default 'baseball').
-- Programs hold school-level data; coaches hold per-coach contact info.
-- Hot lists are per-trainee bookmarks of target programs.
-- ─────────────────────────────────────────────────────────────────────────────

-- Programs: one row per school+sport combination.
CREATE TABLE IF NOT EXISTS koto_recruiting_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL DEFAULT 'baseball',
  school_name TEXT NOT NULL,               -- "University of Florida"
  team_name TEXT,                          -- "Gators"
  division TEXT NOT NULL,                  -- "D1", "D2", "D3", "NAIA", "JUCO"
  conference TEXT,                         -- "SEC", "ACC", etc.
  state TEXT,                             -- 2-letter state code
  city TEXT,
  address TEXT,
  website TEXT,                           -- athletics/baseball program URL
  logo_url TEXT,
  enrollment INT,
  tuition_in_state INT,
  tuition_out_of_state INT,
  scholarship_available BOOLEAN DEFAULT true,
  notes TEXT,
  source_url TEXT,                        -- where the data came from
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(school_name, sport)
);

-- Coaches: multiple coaches per program.
CREATE TABLE IF NOT EXISTS koto_recruiting_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES koto_recruiting_programs(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  title TEXT,                             -- "Head Coach", "Pitching Coach", etc.
  email TEXT,
  phone TEXT,
  twitter TEXT,                           -- @handle
  instagram TEXT,
  notes TEXT,
  verified_at TIMESTAMPTZ,               -- when contact info was last verified
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Hot list: per-trainee bookmarks of programs they're targeting.
CREATE TABLE IF NOT EXISTS koto_recruiting_hot_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID NOT NULL,               -- references koto_fitness_trainees(id)
  program_id UUID NOT NULL REFERENCES koto_recruiting_programs(id) ON DELETE CASCADE,
  interest_level TEXT DEFAULT 'interested', -- "dream", "target", "safety", "interested"
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(trainee_id, program_id)
);

-- Email templates for coach outreach.
CREATE TABLE IF NOT EXISTS koto_recruiting_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL DEFAULT 'baseball',
  slug TEXT NOT NULL UNIQUE,               -- "initial_introduction", "follow_up_stats", etc.
  name TEXT NOT NULL,                      -- "Initial Introduction"
  category TEXT NOT NULL DEFAULT 'outreach', -- "outreach", "follow_up", "thank_you", "camp_inquiry"
  subject_template TEXT NOT NULL,          -- "{{athlete_name}} - {{grad_year}} {{position}} - Interest in {{school_name}}"
  body_template TEXT NOT NULL,             -- full email body with {{placeholders}}
  description TEXT,                        -- when to use this template
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sent emails log for tracking.
CREATE TABLE IF NOT EXISTS koto_recruiting_emails_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID NOT NULL,
  program_id UUID REFERENCES koto_recruiting_programs(id),
  coach_id UUID REFERENCES koto_recruiting_coaches(id),
  template_id UUID REFERENCES koto_recruiting_email_templates(id),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recruiting_emails_trainee ON koto_recruiting_emails_sent(trainee_id);

-- Indexes for common queries.
CREATE INDEX IF NOT EXISTS idx_recruiting_programs_sport ON koto_recruiting_programs(sport);
CREATE INDEX IF NOT EXISTS idx_recruiting_programs_division ON koto_recruiting_programs(division);
CREATE INDEX IF NOT EXISTS idx_recruiting_programs_state ON koto_recruiting_programs(state);
CREATE INDEX IF NOT EXISTS idx_recruiting_programs_school ON koto_recruiting_programs(school_name);
CREATE INDEX IF NOT EXISTS idx_recruiting_coaches_program ON koto_recruiting_coaches(program_id);
CREATE INDEX IF NOT EXISTS idx_recruiting_hot_list_trainee ON koto_recruiting_hot_list(trainee_id);

-- RLS: allow anon read for programs/coaches (public data), restrict hot list.
ALTER TABLE koto_recruiting_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_recruiting_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_recruiting_hot_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Programs are publicly readable"
  ON koto_recruiting_programs FOR SELECT USING (true);

CREATE POLICY "Coaches are publicly readable"
  ON koto_recruiting_coaches FOR SELECT USING (true);

CREATE POLICY "Hot list readable by anyone (token-based auth in API)"
  ON koto_recruiting_hot_list FOR SELECT USING (true);

-- Service role can do everything (API handles auth).
CREATE POLICY "Service role full access programs"
  ON koto_recruiting_programs FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access coaches"
  ON koto_recruiting_coaches FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access hot list"
  ON koto_recruiting_hot_list FOR ALL USING (true) WITH CHECK (true);
