-- ══════════════════════════════════════════════════════════════════════════════
-- SEO HUB TABLES
-- Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- WordPress plugin site connections (one per client site)
CREATE TABLE IF NOT EXISTS wp_seo_sites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid REFERENCES agencies(id) ON DELETE CASCADE,
  client_id     uuid REFERENCES clients(id) ON DELETE CASCADE,
  site_url      text NOT NULL,
  site_name     text,
  api_token     text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  plugin_version text,
  is_active     boolean DEFAULT true,
  last_ping_at  timestamptz,
  last_sync_at  timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(client_id, site_url)
);

-- SEO connections to Google Search Console, Analytics, Ads, GBP
CREATE TABLE IF NOT EXISTS seo_connections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid REFERENCES clients(id) ON DELETE CASCADE,
  provider      text NOT NULL, -- search_console | analytics | ads | gmb
  connected     boolean DEFAULT false,
  access_token  text,
  refresh_token text,
  token_expires_at timestamptz,
  site_url      text,
  property_id   text,
  account_id    text,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(client_id, provider)
);

-- Keyword tracking
CREATE TABLE IF NOT EXISTS seo_keyword_tracking (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid REFERENCES clients(id) ON DELETE CASCADE,
  keyword       text NOT NULL,
  position      numeric,
  previous_position numeric,
  clicks        int DEFAULT 0,
  impressions   int DEFAULT 0,
  ctr           numeric,
  url           text,
  device        text DEFAULT 'desktop',
  country       text DEFAULT 'us',
  tracked_at    timestamptz DEFAULT now()
);

-- SEO reports
CREATE TABLE IF NOT EXISTS seo_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id     uuid REFERENCES agencies(id) ON DELETE CASCADE,
  title         text NOT NULL,
  report_type   text DEFAULT 'monthly', -- monthly | weekly | audit | custom
  content       jsonb DEFAULT '{}',
  summary       text,
  score         int,
  generated_at  timestamptz DEFAULT now(),
  sent_at       timestamptz,
  period_start  date,
  period_end    date
);

-- Plugin data sync (what the WP plugin pushes to us)
CREATE TABLE IF NOT EXISTS seo_plugin_data (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid REFERENCES wp_seo_sites(id) ON DELETE CASCADE,
  client_id     uuid REFERENCES clients(id) ON DELETE CASCADE,
  data_type     text NOT NULL, -- rankings | pages | score | gmb | pagespeed
  payload       jsonb DEFAULT '{}',
  synced_at     timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seo_connections_client    ON seo_connections(client_id);
CREATE INDEX IF NOT EXISTS idx_seo_keywords_client       ON seo_keyword_tracking(client_id);
CREATE INDEX IF NOT EXISTS idx_seo_reports_client        ON seo_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_wp_seo_sites_client       ON wp_seo_sites(client_id);
CREATE INDEX IF NOT EXISTS idx_wp_seo_sites_token        ON wp_seo_sites(api_token);
CREATE INDEX IF NOT EXISTS idx_seo_plugin_data_site      ON seo_plugin_data(site_id);

-- Enable row level security (basic - allow all for now)
ALTER TABLE wp_seo_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_keyword_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_plugin_data ENABLE ROW LEVEL SECURITY;

-- Permissive policies for service role
CREATE POLICY "allow_all_wp_seo_sites"       ON wp_seo_sites       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_seo_connections"    ON seo_connections     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_seo_keywords"       ON seo_keyword_tracking FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_seo_reports"        ON seo_reports         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_seo_plugin_data"    ON seo_plugin_data     FOR ALL USING (true) WITH CHECK (true);

-- Add metadata column to agencies for storing template content
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
