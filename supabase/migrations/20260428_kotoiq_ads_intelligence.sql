-- KotoIQ Ads Intelligence — dimension, fact, recommendation, alert, and usage tables
-- Integrates the Ads Intelligence Platform into the KotoIQ module

-- ============================================================
-- DIMENSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_ads_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL,
  platform text NOT NULL DEFAULT 'google_ads',
  external_id text NOT NULL,
  name text NOT NULL,
  status text,
  channel text,
  budget_usd numeric(10,2),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE (client_id, platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_ads_campaigns_client ON kotoiq_ads_campaigns(client_id);

CREATE TABLE IF NOT EXISTS kotoiq_ads_ad_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES kotoiq_ads_campaigns(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  status text,
  UNIQUE (client_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_ads_ad_groups_client ON kotoiq_ads_ad_groups(client_id);
CREATE INDEX IF NOT EXISTS idx_ads_ad_groups_campaign ON kotoiq_ads_ad_groups(campaign_id);

CREATE TABLE IF NOT EXISTS kotoiq_ads_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_group_id uuid NOT NULL REFERENCES kotoiq_ads_ad_groups(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  text text NOT NULL,
  match_type text NOT NULL CHECK (match_type IN ('exact','phrase','broad')),
  status text,
  quality_score smallint,
  UNIQUE (client_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_ads_keywords_client ON kotoiq_ads_keywords(client_id);
CREATE INDEX IF NOT EXISTS idx_ads_keywords_ad_group ON kotoiq_ads_keywords(ad_group_id);

CREATE TABLE IF NOT EXISTS kotoiq_ads_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_group_id uuid REFERENCES kotoiq_ads_ad_groups(id) ON DELETE SET NULL,
  external_id text NOT NULL,
  type text,
  payload jsonb NOT NULL DEFAULT '{}',
  status text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (client_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_ads_ads_client ON kotoiq_ads_ads(client_id);

-- ============================================================
-- FACTS (daily grain)
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_ads_fact_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  campaign_id uuid NOT NULL REFERENCES kotoiq_ads_campaigns(id) ON DELETE CASCADE,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  cost_micros bigint NOT NULL DEFAULT 0,
  conversions numeric(12,2) NOT NULL DEFAULT 0,
  conversion_value numeric(14,2) NOT NULL DEFAULT 0,
  UNIQUE (client_id, date, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_ads_fc_client_date ON kotoiq_ads_fact_campaigns(client_id, date);

CREATE TABLE IF NOT EXISTS kotoiq_ads_fact_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  keyword_id uuid NOT NULL REFERENCES kotoiq_ads_keywords(id) ON DELETE CASCADE,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  cost_micros bigint NOT NULL DEFAULT 0,
  conversions numeric(12,2) NOT NULL DEFAULT 0,
  conversion_value numeric(14,2) NOT NULL DEFAULT 0,
  quality_score smallint,
  UNIQUE (client_id, date, keyword_id)
);

CREATE INDEX IF NOT EXISTS idx_ads_fk_client_date ON kotoiq_ads_fact_keywords(client_id, date);

CREATE TABLE IF NOT EXISTS kotoiq_ads_fact_search_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  campaign_id uuid REFERENCES kotoiq_ads_campaigns(id) ON DELETE SET NULL,
  ad_group_id uuid REFERENCES kotoiq_ads_ad_groups(id) ON DELETE SET NULL,
  keyword_id uuid REFERENCES kotoiq_ads_keywords(id) ON DELETE SET NULL,
  search_term text NOT NULL,
  match_type_used text,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  cost_micros bigint NOT NULL DEFAULT 0,
  conversions numeric(12,2) NOT NULL DEFAULT 0,
  conversion_value numeric(14,2) NOT NULL DEFAULT 0,
  status text,
  UNIQUE (client_id, date, ad_group_id, search_term)
);

CREATE INDEX IF NOT EXISTS idx_ads_fst_client_date ON kotoiq_ads_fact_search_terms(client_id, date);
CREATE INDEX IF NOT EXISTS idx_ads_fst_client_term ON kotoiq_ads_fact_search_terms(client_id, search_term);

CREATE TABLE IF NOT EXISTS kotoiq_ads_fact_gsc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  query text NOT NULL,
  page text,
  country text,
  device text,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  position numeric(6,2),
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ads_fgsc_unique ON kotoiq_ads_fact_gsc(client_id, date, query, COALESCE(page,''), COALESCE(country,''), COALESCE(device,''));
CREATE INDEX IF NOT EXISTS idx_ads_fgsc_client_date ON kotoiq_ads_fact_gsc(client_id, date);

CREATE TABLE IF NOT EXISTS kotoiq_ads_fact_ga4 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  source text,
  medium text,
  campaign text,
  landing_page text,
  sessions bigint NOT NULL DEFAULT 0,
  engaged_sessions bigint NOT NULL DEFAULT 0,
  conversions numeric(12,2) NOT NULL DEFAULT 0,
  revenue numeric(14,2) NOT NULL DEFAULT 0,
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ads_fga4_unique ON kotoiq_ads_fact_ga4(client_id, date, COALESCE(source,''), COALESCE(medium,''), COALESCE(campaign,''), COALESCE(landing_page,''));
CREATE INDEX IF NOT EXISTS idx_ads_fga4_client_date ON kotoiq_ads_fact_ga4(client_id, date);

-- ============================================================
-- RECOMMENDATIONS (with approval workflow)
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_ads_rec_negatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL,
  search_term text NOT NULL,
  proposed_match_type text NOT NULL CHECK (proposed_match_type IN ('exact','phrase','broad')),
  scope text NOT NULL DEFAULT 'account',
  reason text NOT NULL,
  rationale_md text,
  supporting_data jsonb DEFAULT '{}',
  estimated_savings_usd numeric(10,2),
  model_used text,
  prompt_version integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','applied')),
  reviewed_by uuid ,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_rec_neg_client ON kotoiq_ads_rec_negatives(client_id);
CREATE INDEX IF NOT EXISTS idx_ads_rec_neg_status ON kotoiq_ads_rec_negatives(status);

CREATE TABLE IF NOT EXISTS kotoiq_ads_rec_new_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL,
  keyword text NOT NULL,
  proposed_match_type text NOT NULL,
  proposed_ad_group text,
  rationale_md text,
  supporting_data jsonb DEFAULT '{}',
  est_monthly_clicks integer,
  est_cpc_usd numeric(10,2),
  intent text,
  priority text DEFAULT 'medium',
  model_used text,
  prompt_version integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','applied')),
  reviewed_by uuid ,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_rec_kw_client ON kotoiq_ads_rec_new_keywords(client_id);
CREATE INDEX IF NOT EXISTS idx_ads_rec_kw_status ON kotoiq_ads_rec_new_keywords(status);

CREATE TABLE IF NOT EXISTS kotoiq_ads_rec_ad_copy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL,
  platform text NOT NULL CHECK (platform IN ('google','meta','linkedin','tiktok')),
  campaign_id uuid REFERENCES kotoiq_ads_campaigns(id) ON DELETE SET NULL,
  variant_label text,
  payload jsonb NOT NULL DEFAULT '{}',
  brief_md text,
  rationale_md text,
  model_used text,
  prompt_version integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','applied')),
  reviewed_by uuid ,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_rec_copy_client ON kotoiq_ads_rec_ad_copy(client_id);
CREATE INDEX IF NOT EXISTS idx_ads_rec_copy_status ON kotoiq_ads_rec_ad_copy(status);

CREATE TABLE IF NOT EXISTS kotoiq_ads_rec_bid_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('campaign','ad_group','keyword')),
  entity_id uuid NOT NULL,
  current_value numeric(10,4),
  proposed_value numeric(10,4),
  rationale_md text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','applied')),
  reviewed_by uuid ,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_rec_bid_client ON kotoiq_ads_rec_bid_changes(client_id);

-- ============================================================
-- ALERTS
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_ads_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL,
  severity text NOT NULL CHECK (severity IN ('info','warn','critical')),
  metric text NOT NULL,
  scope text DEFAULT 'account',
  baseline numeric(14,4),
  observed numeric(14,4),
  delta_pct numeric(6,2),
  window_days integer,
  explanation_md text,
  contributors jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid ,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_alerts_client ON kotoiq_ads_alerts(client_id);
CREATE INDEX IF NOT EXISTS idx_ads_alerts_unack ON kotoiq_ads_alerts(client_id) WHERE acknowledged_at IS NULL;

-- ============================================================
-- LLM USAGE (per-call tracking for budget enforcement)
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_ads_llm_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL,
  task text NOT NULL,
  model text NOT NULL,
  prompt_tokens integer,
  completion_tokens integer,
  cost_usd numeric(10,4),
  latency_ms integer,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  prompt_version integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_llm_usage_client_month ON kotoiq_ads_llm_usage(client_id, created_at);

-- ============================================================
-- RAW UPLOADS (audit trail for CSV imports)
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_ads_raw_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL,
  source text NOT NULL,
  filename text NOT NULL,
  rows_imported integer,
  status text DEFAULT 'complete',
  uploaded_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_raw_uploads_client ON kotoiq_ads_raw_uploads(client_id);

-- ============================================================
-- SETTINGS (per-client ads intelligence config)
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_ads_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL,
  monthly_llm_budget_usd numeric(10,2) NOT NULL DEFAULT 100.00,
  target_cpa_usd numeric(10,2),
  target_roas numeric(6,2),
  brand_voice_md text,
  industry text,
  cron_enabled boolean NOT NULL DEFAULT false,
  report_recipients jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_settings_client ON kotoiq_ads_settings(client_id);

-- ============================================================
-- VIEW: Wasted spend in last 30 days
-- ============================================================

CREATE OR REPLACE VIEW v_kotoiq_ads_wasted_spend_30d AS
SELECT
  client_id,
  search_term,
  SUM(cost_micros) / 1e6 AS cost_usd,
  SUM(clicks) AS clicks,
  SUM(conversions) AS conversions,
  COUNT(DISTINCT ad_group_id) AS n_ad_groups,
  MIN(date) AS first_seen,
  MAX(date) AS last_seen
FROM kotoiq_ads_fact_search_terms
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  AND COALESCE(status, '') NOT IN ('added_as_negative', 'ignored')
GROUP BY client_id, search_term
HAVING SUM(conversions) = 0
   AND SUM(clicks) >= 5
   AND SUM(cost_micros) >= 20 * 1e6;

-- ============================================================
-- RLS — permissive policies (same pattern as other kotoiq tables)
-- ============================================================

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'kotoiq_ads_campaigns', 'kotoiq_ads_ad_groups', 'kotoiq_ads_keywords', 'kotoiq_ads_ads',
      'kotoiq_ads_fact_campaigns', 'kotoiq_ads_fact_keywords', 'kotoiq_ads_fact_search_terms',
      'kotoiq_ads_fact_gsc', 'kotoiq_ads_fact_ga4',
      'kotoiq_ads_rec_negatives', 'kotoiq_ads_rec_new_keywords', 'kotoiq_ads_rec_ad_copy', 'kotoiq_ads_rec_bid_changes',
      'kotoiq_ads_alerts', 'kotoiq_ads_llm_usage', 'kotoiq_ads_raw_uploads', 'kotoiq_ads_settings'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = tbl || '_all') THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (true) WITH CHECK (true)', tbl || '_all', tbl);
    END IF;
  END LOOP;
END $$;
