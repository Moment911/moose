-- ══════════════════════════════════════════════════════════════════════════════
-- PROSPECT REPORTS
-- Shareable, editable intelligence reports with prospect auth
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS prospect_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  -- unique shareable token (URL slug)
  token           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  -- business data (from Google Places + pipeline)
  business_name   text NOT NULL,
  business_address text,
  business_phone  text,
  business_website text,
  business_type   text,
  google_rating   numeric,
  google_reviews  int,
  place_id        text,
  -- full lead snapshot (JSON blob)
  lead_data       jsonb DEFAULT '{}',
  -- AI analysis results
  ai_analysis     jsonb DEFAULT '{}',
  -- revenue model
  revenue_data    jsonb DEFAULT '{}',
  -- prospect customizations (what they edit in the public view)
  customizations  jsonb DEFAULT '{}',
  -- prospect who claimed this report
  prospect_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prospect_name   text,
  prospect_email  text,
  prospect_phone  text,
  prospect_company text,
  -- tracking
  views           int DEFAULT 0,
  claimed_at      timestamptz,
  last_viewed_at  timestamptz,
  pdf_url         text,
  status          text DEFAULT 'active',  -- active | expired | converted
  expires_at      timestamptz DEFAULT (now() + interval '90 days'),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Prospect auth sessions (track who viewed what)
CREATE TABLE IF NOT EXISTS prospect_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     uuid REFERENCES prospect_reports(id) ON DELETE CASCADE,
  prospect_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(report_id, prospect_id)
);

CREATE INDEX IF NOT EXISTS idx_prospect_reports_token    ON prospect_reports(token);
CREATE INDEX IF NOT EXISTS idx_prospect_reports_agency   ON prospect_reports(agency_id);
CREATE INDEX IF NOT EXISTS idx_prospect_reports_prospect ON prospect_reports(prospect_id);

-- RLS
ALTER TABLE prospect_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_prospect_reports" ON prospect_reports;
CREATE POLICY "allow_all_prospect_reports" ON prospect_reports FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow_all_prospect_sessions" ON prospect_sessions;
CREATE POLICY "allow_all_prospect_sessions" ON prospect_sessions FOR ALL USING (true) WITH CHECK (true);
