-- KotoIQ Monitoring & Benchmarking
-- Competitor watch, integrations (Slack/Teams), industry benchmarks, scorecards

CREATE TABLE IF NOT EXISTS kotoiq_competitor_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  competitor_domains jsonb NOT NULL,
  alert_channels jsonb DEFAULT '{}',
  check_frequency text DEFAULT 'daily',
  last_checked_at timestamptz,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kotoiq_competitor_url_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id uuid REFERENCES kotoiq_competitor_watches(id) ON DELETE CASCADE,
  competitor_domain text NOT NULL,
  urls jsonb DEFAULT '[]',
  ranking_keywords jsonb DEFAULT '[]',
  backlinks jsonb DEFAULT '[]',
  snapshot_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kotoiq_competitor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id uuid REFERENCES kotoiq_competitor_watches(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  competitor_domain text,
  event_type text, -- 'new_content', 'ranking_gains', 'new_backlinks', 'serp_movement'
  event_data jsonb DEFAULT '{}',
  severity text DEFAULT 'info', -- 'critical', 'warning', 'info'
  alerted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kotoiq_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  integration_type text NOT NULL, -- 'slack', 'teams', 'email'
  webhook_url text,
  channels jsonb DEFAULT '[]',
  alert_types jsonb DEFAULT '[]',
  active boolean DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kotoiq_industry_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry text NOT NULL,
  sample_size integer,
  median_authority_score numeric(5,2),
  avg_authority_score numeric(5,2),
  median_eeat_score numeric(5,2),
  median_content_refresh_days numeric(8,2),
  median_publishing_velocity_per_month numeric(5,2),
  median_schema_coverage_pct numeric(5,2),
  median_da numeric(5,2),
  median_backlink_count integer,
  benchmarks_json jsonb DEFAULT '{}',
  calculated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kotoiq_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  competitor_domains jsonb DEFAULT '[]',
  client_scores jsonb DEFAULT '{}',
  competitor_scores jsonb DEFAULT '[]',
  gaps jsonb DEFAULT '[]',
  strengths jsonb DEFAULT '[]',
  recommended_focus jsonb DEFAULT '[]',
  overall_position text, -- 'leader', 'contender', 'challenger', 'behind'
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comp_watches_client ON kotoiq_competitor_watches(client_id);
CREATE INDEX IF NOT EXISTS idx_comp_snapshots_watch ON kotoiq_competitor_url_snapshots(watch_id);
CREATE INDEX IF NOT EXISTS idx_comp_events_client ON kotoiq_competitor_events(client_id);
CREATE INDEX IF NOT EXISTS idx_integrations_client ON kotoiq_integrations(client_id);
CREATE INDEX IF NOT EXISTS idx_integrations_agency ON kotoiq_integrations(agency_id);
CREATE INDEX IF NOT EXISTS idx_benchmarks_industry ON kotoiq_industry_benchmarks(industry);
CREATE INDEX IF NOT EXISTS idx_scorecards_client ON kotoiq_scorecards(client_id);
