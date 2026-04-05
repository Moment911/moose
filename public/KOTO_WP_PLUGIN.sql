
-- ══════════════════════════════════════════════════════════════════════
-- KOTO SEO PLUGIN — WORDPRESS INTEGRATION
-- Single source of truth: koto_wp_sites
-- ══════════════════════════════════════════════════════════════════════

-- Drop old duplicate tables if they exist
DROP TABLE IF EXISTS lucy_wp_sites;
DROP TABLE IF EXISTS moose_wp_sites;

-- Single consolidated table
CREATE TABLE IF NOT EXISTS koto_wp_sites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  site_name       text NOT NULL,
  site_url        text NOT NULL,
  api_key         text NOT NULL,          -- plugin-generated key
  license_key     text UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  connected       boolean DEFAULT false,
  wp_version      text,
  plugin_version  text,
  last_ping       timestamptz,
  last_sync       timestamptz,
  -- Cached data from last sync
  pages_generated int DEFAULT 0,
  keywords_tracked int DEFAULT 0,
  gsc_connected   boolean DEFAULT false,
  ga4_connected   boolean DEFAULT false,
  site_settings   jsonb,                  -- cached plugin settings
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(agency_id, site_url)
);
CREATE INDEX IF NOT EXISTS idx_koto_wp_sites_agency  ON koto_wp_sites(agency_id);
CREATE INDEX IF NOT EXISTS idx_koto_wp_sites_client  ON koto_wp_sites(client_id);
CREATE INDEX IF NOT EXISTS idx_koto_wp_sites_license ON koto_wp_sites(license_key);

-- Log every command sent from Koto → plugin
CREATE TABLE IF NOT EXISTS koto_wp_commands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid REFERENCES koto_wp_sites(id) ON DELETE CASCADE,
  agency_id   uuid,
  command     text NOT NULL,      -- generate_batch, sync_gsc, etc.
  payload     jsonb,
  status      text DEFAULT 'pending',  -- pending|success|error
  response    jsonb,
  error       text,
  duration_ms int,
  created_at  timestamptz DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_wp_commands_site ON koto_wp_commands(site_id, created_at DESC);

-- Cache generated pages from plugin
CREATE TABLE IF NOT EXISTS koto_wp_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid REFERENCES koto_wp_sites(id) ON DELETE CASCADE,
  client_id       uuid,
  wp_post_id      int,
  title           text,
  slug            text,
  url             text,
  keyword         text,
  location        text,
  page_type       text,
  status          text DEFAULT 'published',
  word_count      int,
  seo_score       int,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wp_pages_site ON koto_wp_pages(site_id);

-- Cache rankings synced from plugin
CREATE TABLE IF NOT EXISTS koto_wp_rankings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid REFERENCES koto_wp_sites(id) ON DELETE CASCADE,
  keyword     text,
  position    numeric,
  clicks      int,
  impressions int,
  ctr         numeric,
  url         text,
  synced_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wp_rankings_site ON koto_wp_rankings(site_id, synced_at DESC);

SELECT 'Koto WordPress tables created ✓' as result;
