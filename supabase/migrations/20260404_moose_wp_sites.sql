create table if not exists moose_wp_sites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  site_name text not null,
  site_url text not null unique,
  license_key text not null unique default concat('moose_', replace(gen_random_uuid()::text, '-', '')),
  connected boolean default false,
  last_ping timestamptz,
  wp_version text,
  plugin_version text,
  site_meta jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists moose_page_jobs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references moose_wp_sites(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  status text default 'queued',
  config jsonb not null default '{}',
  results jsonb default '[]',
  total int default 0,
  completed int default 0,
  error_msg text,
  created_at timestamptz default now(),
  completed_at timestamptz
);
create table if not exists moose_review_queue (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references moose_wp_sites(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  reviewer_name text,
  star_rating int,
  review_text text,
  response_text text,
  response_model text default 'claude',
  status text default 'pending',
  gbp_review_id text,
  created_at timestamptz default now()
);
create table if not exists moose_blog_jobs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references moose_wp_sites(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  topic text,
  keyword text,
  status text default 'queued',
  wp_post_id int,
  post_url text,
  word_count int,
  seo_score int,
  created_at timestamptz default now()
);
create index if not exists idx_moose_wp_sites_license on moose_wp_sites(license_key);
create index if not exists idx_moose_page_jobs_site on moose_page_jobs(site_id);
create index if not exists idx_moose_review_queue_site on moose_review_queue(site_id, status);

-- ── Expanded reviews table (multi-platform) ───────────────────────────────────
ALTER TABLE moose_review_queue ADD COLUMN IF NOT EXISTS platform text DEFAULT 'google'; -- google|yelp|facebook
ALTER TABLE moose_review_queue ADD COLUMN IF NOT EXISTS reviewer_avatar text;
ALTER TABLE moose_review_queue ADD COLUMN IF NOT EXISTS review_url text;
ALTER TABLE moose_review_queue ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE moose_review_queue ADD COLUMN IF NOT EXISTS response_posted_at timestamptz;
ALTER TABLE moose_review_queue ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE moose_review_queue ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- ── Per-client review widget settings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_widget_settings (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  site_id         uuid REFERENCES moose_wp_sites(id) ON DELETE SET NULL,
  -- Enable/disable (agency controls this to gate payment)
  widget_enabled  boolean DEFAULT true,
  badge_enabled   boolean DEFAULT true,
  -- Filtering
  min_stars       int DEFAULT 4,        -- only show reviews >= this rating
  max_reviews     int DEFAULT 20,       -- max to show in widget
  platforms       text[] DEFAULT ARRAY['google','yelp','facebook'],
  -- Display settings
  display_mode    text DEFAULT 'carousel', -- carousel|grid|list|badge
  badge_position  text DEFAULT 'bottom-left', -- bottom-left|bottom-right
  theme           text DEFAULT 'light',  -- light|dark|auto
  primary_color   text DEFAULT '#E8551A',
  show_platform_icons boolean DEFAULT true,
  show_reviewer_photo boolean DEFAULT true,
  show_date       boolean DEFAULT true,
  show_response   boolean DEFAULT false,
  -- Embed key (unique per client — used in the WordPress shortcode)
  embed_key       text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  -- Stats cache
  avg_rating      numeric(3,2) DEFAULT 0,
  total_reviews   int DEFAULT 0,
  last_fetched_at timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_widget_client ON review_widget_settings(client_id);
CREATE INDEX IF NOT EXISTS idx_review_widget_embed_key ON review_widget_settings(embed_key);
