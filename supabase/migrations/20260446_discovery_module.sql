-- ============================================================
-- Discovery Intelligence Module
-- 4 tables: engagements, domains, share_tokens, comments
-- ============================================================

-- ── Engagements ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS koto_discovery_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  client_id uuid,
  client_name text NOT NULL,
  client_industry text,

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','research_running','research_complete','call_scheduled','call_complete','compiled','shared','archived')),

  -- Client onboarding form
  client_form_token text UNIQUE,
  client_form_sent_at timestamptz,
  client_form_submitted_at timestamptz,
  client_form_expires_at timestamptz,
  client_answers jsonb DEFAULT '{}'::jsonb,

  -- AI pre-research intel cards
  intel_cards jsonb DEFAULT '[]'::jsonb,

  -- 10 discovery sections + fields
  sections jsonb DEFAULT '[]'::jsonb,

  -- Compiled output
  executive_summary text,
  compiled_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disc_eng_agency ON koto_discovery_engagements(agency_id);
CREATE INDEX IF NOT EXISTS idx_disc_eng_client ON koto_discovery_engagements(client_id);
CREATE INDEX IF NOT EXISTS idx_disc_eng_status ON koto_discovery_engagements(status);
CREATE INDEX IF NOT EXISTS idx_disc_eng_form_token ON koto_discovery_engagements(client_form_token) WHERE client_form_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_disc_eng_created ON koto_discovery_engagements(created_at DESC);

-- ── Domains (tech stack scanner) ────────────────────────────
CREATE TABLE IF NOT EXISTS koto_discovery_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES koto_discovery_engagements(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL,
  url text NOT NULL,
  domain_type text NOT NULL DEFAULT 'primary'
    CHECK (domain_type IN ('primary','secondary','funnel','ecommerce','product','microsite','custom')),
  scan_status text NOT NULL DEFAULT 'pending'
    CHECK (scan_status IN ('pending','scanning','complete','failed')),
  last_scanned_at timestamptz,
  tech_stack jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disc_dom_eng ON koto_discovery_domains(engagement_id);
CREATE INDEX IF NOT EXISTS idx_disc_dom_agency ON koto_discovery_domains(agency_id);
CREATE INDEX IF NOT EXISTS idx_disc_dom_status ON koto_discovery_domains(scan_status);

-- ── Share tokens ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS koto_discovery_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES koto_discovery_engagements(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL,
  token text UNIQUE NOT NULL,
  recipient_email text,
  recipient_name text,
  visible_section_ids text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  view_count integer DEFAULT 0,
  last_viewed_at timestamptz,
  view_events jsonb DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_disc_share_eng ON koto_discovery_share_tokens(engagement_id);
CREATE INDEX IF NOT EXISTS idx_disc_share_agency ON koto_discovery_share_tokens(agency_id);
CREATE INDEX IF NOT EXISTS idx_disc_share_token ON koto_discovery_share_tokens(token);

-- ── Comments (collaboration) ────────────────────────────────
CREATE TABLE IF NOT EXISTS koto_discovery_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES koto_discovery_engagements(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL,
  section_id text NOT NULL,
  author_display_name text NOT NULL,
  content text NOT NULL,
  parent_comment_id uuid REFERENCES koto_discovery_comments(id) ON DELETE CASCADE,
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disc_cmt_eng ON koto_discovery_comments(engagement_id);
CREATE INDEX IF NOT EXISTS idx_disc_cmt_section ON koto_discovery_comments(engagement_id, section_id);
CREATE INDEX IF NOT EXISTS idx_disc_cmt_parent ON koto_discovery_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE koto_discovery_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_discovery_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_discovery_share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_discovery_comments ENABLE ROW LEVEL SECURITY;

-- Permissive policies (API uses service role key; agency scoping enforced in route handler)
DROP POLICY IF EXISTS "disc_eng_all" ON koto_discovery_engagements;
CREATE POLICY "disc_eng_all" ON koto_discovery_engagements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "disc_dom_all" ON koto_discovery_domains;
CREATE POLICY "disc_dom_all" ON koto_discovery_domains FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "disc_share_all" ON koto_discovery_share_tokens;
CREATE POLICY "disc_share_all" ON koto_discovery_share_tokens FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "disc_cmt_all" ON koto_discovery_comments;
CREATE POLICY "disc_cmt_all" ON koto_discovery_comments FOR ALL USING (true) WITH CHECK (true);

-- ── Auto-update updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_disc_eng_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_disc_eng_updated ON koto_discovery_engagements;
CREATE TRIGGER trg_disc_eng_updated BEFORE UPDATE ON koto_discovery_engagements
  FOR EACH ROW EXECUTE FUNCTION update_disc_eng_updated_at();
