-- ══════════════════════════════════════════════════════════════════════════════
-- MOOSE AI — PENDING MIGRATIONS
-- Run this entire script in Supabase SQL Editor (copy → paste → Run)
-- Safe to run multiple times — all statements use IF NOT EXISTS / IF EXISTS
-- ══════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- MIGRATION 20260416 — Q&A Knowledge Base (expands desk_knowledge)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS question          text;
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS answer            text;
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS answer_short      text;
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS source            text DEFAULT 'manual';
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS web_sources       jsonb DEFAULT '[]';
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS is_verified       boolean DEFAULT false;
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS is_public         boolean DEFAULT true;
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS view_count        int DEFAULT 0;
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS helpful_count     int DEFAULT 0;
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS not_helpful_count int DEFAULT 0;
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS related_ids       uuid[] DEFAULT '{}';
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS updated_at        timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_desk_knowledge_question ON desk_knowledge
  USING gin(to_tsvector('english', coalesce(question,'') || ' ' || coalesce(answer,'')));
CREATE INDEX IF NOT EXISTS idx_desk_knowledge_source   ON desk_knowledge(source);
CREATE INDEX IF NOT EXISTS idx_desk_knowledge_verified ON desk_knowledge(is_verified);
CREATE INDEX IF NOT EXISTS idx_desk_knowledge_public   ON desk_knowledge(is_public);

-- ────────────────────────────────────────────────────────────────────────────
-- MIGRATION 20260417 — Performance Marketing Engine (9 new tables + exec log)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS perf_campaigns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id        uuid,
  ads_campaign_id  text,
  name             text NOT NULL,
  status           text,
  campaign_type    text,
  budget_amount    numeric,
  budget_type      text DEFAULT 'DAILY',
  bidding_strategy text,
  target_cpa       numeric,
  target_roas      numeric,
  impressions      bigint DEFAULT 0,
  clicks           bigint DEFAULT 0,
  cost             numeric DEFAULT 0,
  conversions      numeric DEFAULT 0,
  conv_value       numeric DEFAULT 0,
  ctr              numeric,
  avg_cpc          numeric,
  cpa              numeric,
  roas             numeric,
  impression_share numeric,
  lost_is_budget   numeric,
  lost_is_rank     numeric,
  metrics_start    date,
  metrics_end      date,
  synced_at        timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now(),
  UNIQUE(client_id, ads_campaign_id)
);

CREATE TABLE IF NOT EXISTS perf_ad_groups (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id      uuid REFERENCES perf_campaigns(id) ON DELETE CASCADE,
  ads_adgroup_id   text,
  name             text NOT NULL,
  status           text,
  default_bid      numeric,
  impressions      bigint DEFAULT 0,
  clicks           bigint DEFAULT 0,
  cost             numeric DEFAULT 0,
  conversions      numeric DEFAULT 0,
  avg_cpc          numeric,
  ctr              numeric,
  cpa              numeric,
  quality_score    int,
  synced_at        timestamptz DEFAULT now(),
  UNIQUE(client_id, ads_adgroup_id)
);

CREATE TABLE IF NOT EXISTS perf_keywords (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid REFERENCES clients(id) ON DELETE CASCADE,
  ad_group_id      uuid REFERENCES perf_ad_groups(id) ON DELETE CASCADE,
  ads_keyword_id   text,
  keyword          text NOT NULL,
  match_type       text,
  status           text,
  bid              numeric,
  avg_cpc          numeric,
  impressions      bigint DEFAULT 0,
  clicks           bigint DEFAULT 0,
  cost             numeric DEFAULT 0,
  conversions      numeric DEFAULT 0,
  conv_rate        numeric,
  avg_position     numeric,
  quality_score    int,
  first_page_bid   numeric,
  top_of_page_bid  numeric,
  search_volume    int,
  synced_at        timestamptz DEFAULT now(),
  UNIQUE(client_id, ads_keyword_id)
);

CREATE TABLE IF NOT EXISTS perf_ads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid REFERENCES clients(id) ON DELETE CASCADE,
  ad_group_id      uuid REFERENCES perf_ad_groups(id) ON DELETE CASCADE,
  ads_ad_id        text,
  ad_type          text,
  status           text,
  headlines        text[],
  descriptions     text[],
  final_urls       text[],
  display_url      text,
  impressions      bigint DEFAULT 0,
  clicks           bigint DEFAULT 0,
  cost             numeric DEFAULT 0,
  conversions      numeric DEFAULT 0,
  ctr              numeric,
  ad_strength      text,
  policy_summary   text,
  synced_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS perf_search_terms (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id      uuid REFERENCES perf_campaigns(id) ON DELETE CASCADE,
  ad_group_id      uuid REFERENCES perf_ad_groups(id) ON DELETE CASCADE,
  search_term      text NOT NULL,
  match_type       text,
  impressions      bigint DEFAULT 0,
  clicks           bigint DEFAULT 0,
  cost             numeric DEFAULT 0,
  conversions      numeric DEFAULT 0,
  is_negative      boolean DEFAULT false,
  period_start     date,
  period_end       date,
  synced_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS perf_pages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid REFERENCES clients(id) ON DELETE CASCADE,
  url              text NOT NULL,
  page_title       text,
  meta_desc        text,
  h1               text,
  word_count       int,
  has_cta          boolean DEFAULT false,
  cta_text         text,
  has_form         boolean DEFAULT false,
  has_phone        boolean DEFAULT false,
  load_ok          boolean DEFAULT true,
  http_status      int,
  ai_score         int,
  ai_headline_score int,
  ai_content_score  int,
  ai_cta_score      int,
  ai_summary       text,
  ai_strengths     text[],
  ai_weaknesses    text[],
  primary_keywords text[],
  best_for_queries text[],
  sessions         int DEFAULT 0,
  bounce_rate      numeric,
  avg_session_secs int,
  goal_completions int DEFAULT 0,
  conv_rate        numeric,
  sitemap_source   text,
  scanned_at       timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now(),
  UNIQUE(client_id, url)
);

CREATE TABLE IF NOT EXISTS perf_recommendations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id        uuid,
  type             text NOT NULL,
  priority         text DEFAULT 'medium',
  title            text NOT NULL,
  description      text NOT NULL,
  current_state    jsonb DEFAULT '{}',
  recommended      jsonb DEFAULT '{}',
  est_impact       text,
  est_impact_val   numeric,
  confidence       numeric DEFAULT 0.8,
  related_entity   text,
  related_id       uuid,
  status           text DEFAULT 'pending',
  applied_at       timestamptz,
  dismissed_at     timestamptz,
  data_sources     text[],
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS perf_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid REFERENCES clients(id) ON DELETE CASCADE,
  snapshot_date    date NOT NULL,
  ads_spend        numeric DEFAULT 0,
  ads_clicks       bigint DEFAULT 0,
  ads_impressions  bigint DEFAULT 0,
  ads_conversions  numeric DEFAULT 0,
  ads_roas         numeric,
  ads_cpa          numeric,
  ga4_sessions     int DEFAULT 0,
  ga4_users        int DEFAULT 0,
  ga4_bounce_rate  numeric,
  ga4_goal_completions int DEFAULT 0,
  gsc_clicks       int DEFAULT 0,
  gsc_impressions  int DEFAULT 0,
  gsc_ctr          numeric,
  gsc_avg_position numeric,
  gmb_searches     int DEFAULT 0,
  gmb_views        int DEFAULT 0,
  gmb_calls        int DEFAULT 0,
  gmb_directions   int DEFAULT 0,
  gmb_website_clicks int DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  UNIQUE(client_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS perf_alerts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id        uuid,
  alert_type       text NOT NULL,
  severity         text DEFAULT 'warning',
  title            text NOT NULL,
  detail           text,
  metric_name      text,
  metric_value     numeric,
  metric_threshold numeric,
  metric_prev      numeric,
  pct_change       numeric,
  acknowledged     boolean DEFAULT false,
  acknowledged_at  timestamptz,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS perf_execution_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rec_id           uuid REFERENCES perf_recommendations(id) ON DELETE SET NULL,
  client_id        uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id        uuid,
  rec_type         text,
  rec_title        text,
  status           text DEFAULT 'success',
  detail           text,
  error            text,
  rollback_data    jsonb DEFAULT '{}',
  dry_run          boolean DEFAULT false,
  applied_by       text,
  applied_at       timestamptz DEFAULT now(),
  rolled_back_at   timestamptz,
  rolled_back_by   text
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_perf_campaigns_client     ON perf_campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_perf_adgroups_campaign    ON perf_ad_groups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_perf_keywords_adgroup     ON perf_keywords(ad_group_id);
CREATE INDEX IF NOT EXISTS idx_perf_keywords_client      ON perf_keywords(client_id);
CREATE INDEX IF NOT EXISTS idx_perf_pages_client         ON perf_pages(client_id);
CREATE INDEX IF NOT EXISTS idx_perf_recs_client          ON perf_recommendations(client_id, status);
CREATE INDEX IF NOT EXISTS idx_perf_snapshots_date       ON perf_snapshots(client_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_perf_alerts_client        ON perf_alerts(client_id, acknowledged);
CREATE INDEX IF NOT EXISTS idx_perf_search_terms_client  ON perf_search_terms(client_id);
CREATE INDEX IF NOT EXISTS idx_perf_log_client           ON perf_execution_log(client_id, applied_at DESC);

-- ── RLS (permissive for now) ──────────────────────────────────────────────────
ALTER TABLE perf_campaigns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_ad_groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_keywords        ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_ads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_search_terms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_pages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_snapshots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_alerts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_execution_log   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='perf_campaigns'       AND policyname='perf_campaigns_all')    THEN CREATE POLICY perf_campaigns_all       ON perf_campaigns       FOR ALL USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='perf_ad_groups'       AND policyname='perf_adgroups_all')     THEN CREATE POLICY perf_adgroups_all        ON perf_ad_groups       FOR ALL USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='perf_keywords'        AND policyname='perf_keywords_all')     THEN CREATE POLICY perf_keywords_all        ON perf_keywords        FOR ALL USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='perf_ads'             AND policyname='perf_ads_all')          THEN CREATE POLICY perf_ads_all             ON perf_ads             FOR ALL USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='perf_search_terms'    AND policyname='perf_search_terms_all') THEN CREATE POLICY perf_search_terms_all    ON perf_search_terms    FOR ALL USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='perf_pages'           AND policyname='perf_pages_all')        THEN CREATE POLICY perf_pages_all           ON perf_pages           FOR ALL USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='perf_recommendations' AND policyname='perf_recs_all')         THEN CREATE POLICY perf_recs_all            ON perf_recommendations FOR ALL USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='perf_snapshots'       AND policyname='perf_snapshots_all')    THEN CREATE POLICY perf_snapshots_all       ON perf_snapshots       FOR ALL USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='perf_alerts'          AND policyname='perf_alerts_all')       THEN CREATE POLICY perf_alerts_all          ON perf_alerts          FOR ALL USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='perf_execution_log'   AND policyname='perf_log_all')          THEN CREATE POLICY perf_log_all             ON perf_execution_log   FOR ALL USING (true) WITH CHECK (true); END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- DONE — all tables, indexes, RLS policies created
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Grid rank heatmap scans (Local Rank Tracker - Grid tab) ──────────────────
CREATE TABLE IF NOT EXISTS local_rank_grid_scans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  keyword         text NOT NULL,
  center_location text NOT NULL,
  center_lat      numeric,
  center_lng      numeric,
  target_business text,
  grid_size       int DEFAULT 3,
  grid_spacing_km numeric DEFAULT 1.5,
  grid_results    jsonb DEFAULT '[]',
  avg_rank        numeric,
  best_rank       int,
  worst_rank      int,
  ranked_cells    int,
  total_cells     int,
  scanned_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grid_scans_client  ON local_rank_grid_scans(client_id);
CREATE INDEX IF NOT EXISTS idx_grid_scans_keyword ON local_rank_grid_scans(client_id, keyword);
CREATE INDEX IF NOT EXISTS idx_grid_scans_date    ON local_rank_grid_scans(scanned_at DESC);
ALTER TABLE local_rank_grid_scans ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='local_rank_grid_scans' AND policyname='allow_all_grid_scans') THEN
    CREATE POLICY "allow_all_grid_scans" ON local_rank_grid_scans FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Local rank tracking scans (Local Rank Tracker - Single Scan tab) ─────────
CREATE TABLE IF NOT EXISTS local_rank_scans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  keyword         text NOT NULL,
  location        text NOT NULL,
  target_business text,
  target_domain   text,
  radius_km       int DEFAULT 16,
  target_rank     int,
  total_results   int DEFAULT 0,
  results         jsonb DEFAULT '[]',
  ai_analysis     jsonb DEFAULT '{}',
  scanned_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rank_scans_client  ON local_rank_scans(client_id);
CREATE INDEX IF NOT EXISTS idx_rank_scans_keyword ON local_rank_scans(client_id, keyword, location);
CREATE INDEX IF NOT EXISTS idx_rank_scans_scanned ON local_rank_scans(scanned_at DESC);
ALTER TABLE local_rank_scans ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='local_rank_scans' AND policyname='allow_all_rank_scans') THEN
    CREATE POLICY "allow_all_rank_scans" ON local_rank_scans FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Reviews management ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  platform        text NOT NULL DEFAULT 'google',
  reviewer_name   text,
  reviewer_photo  text,
  rating          int,
  review_text     text,
  review_date     timestamptz,
  review_id       text,
  response_text   text,
  responded_at    timestamptz,
  ai_response     text,
  sentiment       text,
  is_responded    boolean DEFAULT false,
  source_url      text,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_client   ON reviews(client_id);
CREATE INDEX IF NOT EXISTS idx_reviews_platform ON reviews(client_id, platform);
CREATE INDEX IF NOT EXISTS idx_reviews_rating   ON reviews(client_id, rating);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='allow_all_reviews') THEN
    CREATE POLICY "allow_all_reviews" ON reviews FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Client portal sessions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_portal_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  token           text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  email           text,
  name            text,
  expires_at      timestamptz DEFAULT now() + interval '30 days',
  last_accessed_at timestamptz,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_client ON client_portal_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token  ON client_portal_sessions(token);
ALTER TABLE client_portal_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_portal_sessions' AND policyname='allow_all_portal_sessions') THEN
    CREATE POLICY "allow_all_portal_sessions" ON client_portal_sessions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Stripe subscriptions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id               uuid REFERENCES agencies(id) ON DELETE CASCADE,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  plan                    text DEFAULT 'starter',
  status                  text DEFAULT 'trialing',
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean DEFAULT false,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subscriptions' AND policyname='allow_all_subscriptions') THEN
    CREATE POLICY "allow_all_subscriptions" ON subscriptions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Add google_place_id to clients (for auto-refresh of reviews) ─────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_rating    numeric;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_review_count int;

-- ── Extended client fields ────────────────────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address       text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS city          text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS state         text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS zip           text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes         text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS monthly_value numeric;

-- ── GBP Audits ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gbp_audits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid,
  place_id        text NOT NULL,
  business_name   text,
  score           int,
  completeness    int,
  audit_data      jsonb DEFAULT '{}',
  competitors     jsonb DEFAULT '[]',
  recommendations jsonb DEFAULT '[]',
  audited_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gbp_audits_client ON gbp_audits(client_id);
CREATE INDEX IF NOT EXISTS idx_gbp_audits_date   ON gbp_audits(client_id, audited_at DESC);

-- ── Keyword tracking (for keyword gap tool) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_tracked_keywords (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id   uuid,
  keyword     text NOT NULL,
  location    text,
  volume      int,
  difficulty  int,
  rank        int,
  rank_url    text,
  opportunity text,
  source      text DEFAULT 'gsc',
  tracked_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_kw_client ON seo_tracked_keywords(client_id);

-- ── Citation tracking ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS citation_checks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id     uuid,
  directory     text NOT NULL,
  directory_url text,
  found         boolean DEFAULT false,
  name_match    boolean,
  phone_match   boolean,
  address_match boolean,
  listing_url   text,
  checked_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_citations_client ON citation_checks(client_id);

-- ── Competitor snapshots ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitor_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid,
  competitor_name text,
  place_id        text,
  rating          numeric,
  review_count    int,
  snapshot_data   jsonb DEFAULT '{}',
  snapped_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_competitor_snaps_client ON competitor_snapshots(client_id);

-- ── SEO monthly reports ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_monthly_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id    uuid,
  month        text NOT NULL,
  report_data  jsonb DEFAULT '{}',
  ai_narrative text,
  pdf_url      text,
  emailed_at   timestamptz,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_reports_client ON seo_monthly_reports(client_id);
