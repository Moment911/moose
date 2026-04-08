-- Unified opportunities table
CREATE TABLE IF NOT EXISTS koto_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id),
  source text NOT NULL CHECK (source IN ('web_visitor','import','scout','voice_call','inbound_call','manual')),
  stage text NOT NULL DEFAULT 'new' CHECK (stage IN ('new','engaged','qualified','proposal','won','lost','archived')),
  score integer DEFAULT 0,
  hot boolean DEFAULT false,

  -- Contact info
  company_name text,
  contact_name text,
  contact_email text,
  contact_phone text,
  website text,
  industry text,
  sic_code text,

  -- Source references
  visitor_session_id text,
  scout_lead_id uuid,
  voice_call_id uuid,
  voice_lead_id uuid,
  import_source text,

  -- Intelligence
  intent_signals jsonb DEFAULT '[]'::jsonb,
  intel jsonb DEFAULT '{}'::jsonb,
  tags text[] DEFAULT '{}',

  -- GHL sync
  ghl_contact_id text,
  ghl_opportunity_id text,
  ghl_pushed_at timestamptz,

  -- Notes
  notes text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opps_agency ON koto_opportunities(agency_id);
CREATE INDEX IF NOT EXISTS idx_opps_source ON koto_opportunities(source);
CREATE INDEX IF NOT EXISTS idx_opps_stage ON koto_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opps_hot ON koto_opportunities(hot) WHERE hot = true;
CREATE INDEX IF NOT EXISTS idx_opps_score ON koto_opportunities(score DESC);
CREATE INDEX IF NOT EXISTS idx_opps_visitor ON koto_opportunities(visitor_session_id) WHERE visitor_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opps_scout ON koto_opportunities(scout_lead_id) WHERE scout_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opps_voice ON koto_opportunities(voice_call_id) WHERE voice_call_id IS NOT NULL;

-- Page views per opportunity
CREATE TABLE IF NOT EXISTS koto_opportunity_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES koto_opportunities(id) ON DELETE CASCADE,
  url text NOT NULL,
  page_title text,
  duration_seconds integer DEFAULT 0,
  referrer text,
  viewed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opp_views_opp ON koto_opportunity_page_views(opportunity_id);

-- Activity timeline
CREATE TABLE IF NOT EXISTS koto_opportunity_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES koto_opportunities(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opp_activities_opp ON koto_opportunity_activities(opportunity_id);

-- RLS
ALTER TABLE koto_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_opportunity_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_opportunity_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency_opps" ON koto_opportunities;
CREATE POLICY "agency_opps" ON koto_opportunities FOR ALL USING (agency_id = auth.uid());

DROP POLICY IF EXISTS "agency_opp_views" ON koto_opportunity_page_views;
CREATE POLICY "agency_opp_views" ON koto_opportunity_page_views FOR ALL
  USING (opportunity_id IN (SELECT id FROM koto_opportunities WHERE agency_id = auth.uid()));

DROP POLICY IF EXISTS "agency_opp_activities" ON koto_opportunity_activities;
CREATE POLICY "agency_opp_activities" ON koto_opportunity_activities FOR ALL
  USING (opportunity_id IN (SELECT id FROM koto_opportunities WHERE agency_id = auth.uid()));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_opp_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_opp_updated ON koto_opportunities;
CREATE TRIGGER trg_opp_updated BEFORE UPDATE ON koto_opportunities
  FOR EACH ROW EXECUTE FUNCTION update_opp_updated_at();
