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
