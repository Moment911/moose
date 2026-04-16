-- ─────────────────────────────────────────────────────────────
-- KotoIQ Sitemap Scale — supports massive multi-sitemap sites
-- Designed to handle 10,000+ URL sitemaps with sitemap-index recursion
-- ─────────────────────────────────────────────────────────────

-- Crawl runs — track sitemap ingestion jobs
CREATE TABLE IF NOT EXISTS kotoiq_sitemap_crawls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status text DEFAULT 'running', -- running | complete | failed
  sitemaps_found integer DEFAULT 0,
  sitemaps_processed integer DEFAULT 0,
  urls_discovered integer DEFAULT 0,
  urls_saved integer DEFAULT 0,
  depth_reached integer DEFAULT 0,
  errors jsonb DEFAULT '[]',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sitemap_crawls_client ON kotoiq_sitemap_crawls(client_id);
CREATE INDEX IF NOT EXISTS idx_sitemap_crawls_status ON kotoiq_sitemap_crawls(status);

-- Discovered URLs — persisted to support downstream engines processing
-- URLs in chunks without re-crawling the sitemap every time
CREATE TABLE IF NOT EXISTS kotoiq_sitemap_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  crawl_id uuid REFERENCES kotoiq_sitemap_crawls(id) ON DELETE CASCADE,

  url text NOT NULL,
  lastmod timestamptz,
  priority numeric(3,2),
  changefreq text,
  source_sitemap text,

  -- Downstream-engine processing status
  processed_by jsonb DEFAULT '[]', -- e.g., ['content_refresh', 'internal_links']
  last_processed_at timestamptz,

  discovered_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sitemap_urls_client ON kotoiq_sitemap_urls(client_id);
CREATE INDEX IF NOT EXISTS idx_sitemap_urls_crawl ON kotoiq_sitemap_urls(crawl_id);
CREATE INDEX IF NOT EXISTS idx_sitemap_urls_lastmod ON kotoiq_sitemap_urls(lastmod);
CREATE INDEX IF NOT EXISTS idx_sitemap_urls_url ON kotoiq_sitemap_urls(url);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sitemap_urls_client_url ON kotoiq_sitemap_urls(client_id, url);

-- Engine processing jobs — for chunked processing of huge sitemaps
-- Each engine that processes URLs creates a job, processes in batches,
-- and tracks progress so runs can be resumed
CREATE TABLE IF NOT EXISTS kotoiq_processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  engine text NOT NULL, -- content_refresh | internal_links | on_page | schema | ...
  status text DEFAULT 'queued', -- queued | running | paused | complete | failed
  total_urls integer DEFAULT 0,
  processed_urls integer DEFAULT 0,
  failed_urls integer DEFAULT 0,
  batch_size integer DEFAULT 50,
  concurrency integer DEFAULT 10,
  current_offset integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  errors jsonb DEFAULT '[]',
  started_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_client ON kotoiq_processing_jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON kotoiq_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_engine ON kotoiq_processing_jobs(engine);
