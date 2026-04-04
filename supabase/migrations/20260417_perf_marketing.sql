-- ══════════════════════════════════════════════════════════════════════════════
-- PERFORMANCE MARKETING ENGINE
-- Stores pulled data from Google Ads, GA4, Search Console, GMB, Sitemap
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Campaigns (Google Ads campaign level) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS perf_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid,
  ads_campaign_id text,                    -- Google Ads campaign ID
  name            text NOT NULL,
  status          text,                    -- ENABLED | PAUSED | REMOVED
  campaign_type   text,                    -- SEARCH | DISPLAY | SHOPPING | VIDEO
  budget_amount   numeric,                 -- daily budget in dollars
  budget_type     text DEFAULT 'DAILY',
  bidding_strategy text,                   -- TARGET_CPA | TARGET_ROAS | MAXIMIZE_CONVERSIONS etc
  target_cpa      numeric,
  target_roas     numeric,
  -- Aggregated metrics (latest sync)
  impressions     bigint DEFAULT 0,
  clicks          bigint DEFAULT 0,
  cost            numeric DEFAULT 0,       -- in dollars
  conversions     numeric DEFAULT 0,
  conv_value      numeric DEFAULT 0,
  ctr             numeric,                 -- click-through rate %
  avg_cpc         numeric,                 -- average cost per click
  cpa             numeric,                 -- cost per acquisition
  roas            numeric,                 -- return on ad spend
  impression_share numeric,               -- search impression share %
  lost_is_budget  numeric,               -- impression share lost to budget
  lost_is_rank    numeric,               -- impression share lost to rank
  -- Date range of metrics
  metrics_start   date,
  metrics_end     date,
  synced_at       timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

-- ── Ad groups ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS perf_ad_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id     uuid REFERENCES perf_campaigns(id) ON DELETE CASCADE,
  ads_adgroup_id  text,
  name            text NOT NULL,
  status          text,
  default_bid     numeric,
  impressions     bigint DEFAULT 0,
  clicks          bigint DEFAULT 0,
  cost            numeric DEFAULT 0,
  conversions     numeric DEFAULT 0,
  avg_cpc         numeric,
  ctr             numeric,
  cpa             numeric,
  quality_score   int,
  synced_at       timestamptz DEFAULT now()
);

-- ── Keywords ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS perf_keywords (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  ad_group_id     uuid REFERENCES perf_ad_groups(id) ON DELETE CASCADE,
  ads_keyword_id  text,
  keyword         text NOT NULL,
  match_type      text,                    -- BROAD | PHRASE | EXACT
  status          text,
  bid             numeric,                 -- manual CPC bid
  avg_cpc         numeric,                 -- actual avg CPC
  impressions     bigint DEFAULT 0,
  clicks          bigint DEFAULT 0,
  cost            numeric DEFAULT 0,
  conversions     numeric DEFAULT 0,
  conv_rate       numeric,
  avg_position    numeric,
  quality_score   int,
  first_page_bid  numeric,               -- Google's first page bid estimate
  top_of_page_bid numeric,              -- Google's top of page bid estimate
  search_volume   int,                   -- from keyword planner if available
  synced_at       timestamptz DEFAULT now()
);

-- ── Ad creatives ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS perf_ads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  ad_group_id     uuid REFERENCES perf_ad_groups(id) ON DELETE CASCADE,
  ads_ad_id       text,
  ad_type         text,                    -- RESPONSIVE_SEARCH_AD | EXPANDED_TEXT_AD
  status          text,
  headlines       text[],                  -- up to 15 for RSA
  descriptions    text[],                  -- up to 4 for RSA
  final_urls      text[],
  display_url     text,
  impressions     bigint DEFAULT 0,
  clicks          bigint DEFAULT 0,
  cost            numeric DEFAULT 0,
  conversions     numeric DEFAULT 0,
  ctr             numeric,
  ad_strength     text,                    -- POOR | AVERAGE | GOOD | EXCELLENT
  policy_summary  text,
  synced_at       timestamptz DEFAULT now()
);

-- ── Search terms (raw query report) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS perf_search_terms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id     uuid REFERENCES perf_campaigns(id) ON DELETE CASCADE,
  ad_group_id     uuid REFERENCES perf_ad_groups(id) ON DELETE CASCADE,
  search_term     text NOT NULL,
  match_type      text,
  impressions     bigint DEFAULT 0,
  clicks          bigint DEFAULT 0,
  cost            numeric DEFAULT 0,
  conversions     numeric DEFAULT 0,
  is_negative     boolean DEFAULT false,  -- flagged for negative keyword list
  period_start    date,
  period_end      date,
  synced_at       timestamptz DEFAULT now()
);

-- ── Sitemap pages + AI analysis ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS perf_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  url             text NOT NULL,
  page_title      text,
  meta_desc       text,
  h1              text,
  word_count      int,
  has_cta         boolean DEFAULT false,
  cta_text        text,
  has_form        boolean DEFAULT false,
  has_phone       boolean DEFAULT false,
  load_ok         boolean DEFAULT true,
  http_status     int,
  -- AI scoring
  ai_score        int,                     -- 0-100
  ai_headline_score int,                   -- headline quality
  ai_content_score  int,                   -- content depth/relevance
  ai_cta_score      int,                   -- call-to-action quality
  ai_summary      text,                    -- what this page is about
  ai_strengths    text[],
  ai_weaknesses   text[],
  primary_keywords text[],                 -- AI-extracted main keywords
  best_for_queries text[],                 -- what ad queries this page suits
  -- GA4 data (if connected)
  sessions        int DEFAULT 0,
  bounce_rate     numeric,
  avg_session_secs int,
  goal_completions int DEFAULT 0,
  conv_rate       numeric,
  -- meta
  sitemap_source  text,                    -- which sitemap this came from
  scanned_at      timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(client_id, url)
);

-- ── AI recommendations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS perf_recommendations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid,
  type            text NOT NULL,           -- bid|budget|negative_keyword|ad_copy|landing_page|audience|keyword_pause|keyword_add
  priority        text DEFAULT 'medium',   -- high|medium|low
  title           text NOT NULL,
  description     text NOT NULL,
  current_state   jsonb DEFAULT '{}',      -- what it is now
  recommended     jsonb DEFAULT '{}',      -- what to change it to
  est_impact      text,                    -- e.g. "Save $340/mo" or "+12% conversions"
  est_impact_val  numeric,                 -- numeric dollar/% value for sorting
  confidence      numeric DEFAULT 0.8,
  related_entity  text,                    -- campaign | ad_group | keyword | ad | page
  related_id      uuid,
  status          text DEFAULT 'pending',  -- pending | applied | dismissed | snoozed
  applied_at      timestamptz,
  dismissed_at    timestamptz,
  data_sources    text[],                  -- which data was used: ads|ga4|gsc|gmb
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── Daily cross-channel snapshots ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS perf_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  snapshot_date   date NOT NULL,
  -- Ads
  ads_spend       numeric DEFAULT 0,
  ads_clicks      bigint DEFAULT 0,
  ads_impressions bigint DEFAULT 0,
  ads_conversions numeric DEFAULT 0,
  ads_roas        numeric,
  ads_cpa         numeric,
  -- GA4
  ga4_sessions    int DEFAULT 0,
  ga4_users       int DEFAULT 0,
  ga4_bounce_rate numeric,
  ga4_goal_completions int DEFAULT 0,
  -- Search Console
  gsc_clicks      int DEFAULT 0,
  gsc_impressions int DEFAULT 0,
  gsc_ctr         numeric,
  gsc_avg_position numeric,
  -- GMB
  gmb_searches    int DEFAULT 0,
  gmb_views       int DEFAULT 0,
  gmb_calls       int DEFAULT 0,
  gmb_directions  int DEFAULT 0,
  gmb_website_clicks int DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(client_id, snapshot_date)
);

-- ── Alerts ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS perf_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid,
  alert_type      text NOT NULL,           -- roas_drop|cpa_spike|budget_exhausted|impression_share_drop|ctr_drop|spend_anomaly
  severity        text DEFAULT 'warning',  -- info|warning|critical
  title           text NOT NULL,
  detail          text,
  metric_name     text,
  metric_value    numeric,
  metric_threshold numeric,
  metric_prev     numeric,
  pct_change      numeric,
  acknowledged    boolean DEFAULT false,
  acknowledged_at timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_perf_campaigns_client    ON perf_campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_perf_ad_groups_campaign  ON perf_ad_groups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_perf_keywords_adgroup    ON perf_keywords(ad_group_id);
CREATE INDEX IF NOT EXISTS idx_perf_keywords_client     ON perf_keywords(client_id);
CREATE INDEX IF NOT EXISTS idx_perf_pages_client        ON perf_pages(client_id);
CREATE INDEX IF NOT EXISTS idx_perf_recs_client         ON perf_recommendations(client_id, status);
CREATE INDEX IF NOT EXISTS idx_perf_snapshots_date      ON perf_snapshots(client_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_perf_alerts_client       ON perf_alerts(client_id, acknowledged);
CREATE INDEX IF NOT EXISTS idx_perf_search_terms_client ON perf_search_terms(client_id);

-- ── RLS (open for now, tighten per agency later) ─────────────────────────────
ALTER TABLE perf_campaigns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_ad_groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_keywords        ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_ads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_search_terms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_pages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_snapshots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_alerts          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perf_campaigns_all"    ON perf_campaigns       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "perf_adgroups_all"     ON perf_ad_groups       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "perf_keywords_all"     ON perf_keywords        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "perf_ads_all"          ON perf_ads             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "perf_search_terms_all" ON perf_search_terms    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "perf_pages_all"        ON perf_pages           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "perf_recs_all"         ON perf_recommendations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "perf_snapshots_all"    ON perf_snapshots       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "perf_alerts_all"       ON perf_alerts          FOR ALL USING (true) WITH CHECK (true);
