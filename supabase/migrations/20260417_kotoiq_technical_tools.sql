-- ─────────────────────────────────────────────────────────────
-- KotoIQ Technical SEO Tools — GSC Audit, Bing Audit, Backlink Opportunities
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kotoiq_gsc_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  days_analyzed integer,
  summary jsonb DEFAULT '{}',
  indexing_issues jsonb DEFAULT '[]',
  ctr_anomalies jsonb DEFAULT '[]',
  impression_decay jsonb DEFAULT '[]',
  cannibalization jsonb DEFAULT '[]',
  striking_distance jsonb DEFAULT '[]',
  ai_recommendations jsonb DEFAULT '[]',
  overall_health_score numeric(5,2),
  scanned_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kotoiq_bing_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  site_url text,
  ranking_summary jsonb DEFAULT '{}',
  top_queries jsonb DEFAULT '[]',
  crawl_stats jsonb DEFAULT '{}',
  google_vs_bing jsonb DEFAULT '[]',
  opportunities jsonb DEFAULT '[]',
  ai_recommendations jsonb DEFAULT '[]',
  scanned_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kotoiq_backlink_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  opportunity_type text,
  target_domain text,
  target_url text,
  domain_authority numeric(5,2),
  relevance_score numeric(5,2),
  ease_score numeric(5,2),
  priority text,
  outreach_template text,
  strategy_notes text,
  status text DEFAULT 'open',
  acquired_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsc_audits_client ON kotoiq_gsc_audits(client_id);
CREATE INDEX IF NOT EXISTS idx_bing_audits_client ON kotoiq_bing_audits(client_id);
CREATE INDEX IF NOT EXISTS idx_backlink_opps_client ON kotoiq_backlink_opportunities(client_id);
