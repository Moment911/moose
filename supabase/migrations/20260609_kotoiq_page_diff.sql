-- ============================================================
-- KotoIQ — Page Diff Engine + Noise Filter (Phase B)
--
-- For each tracked competitor URL: snapshot daily, extract
-- structured content (H1, CTAs, hero, body, meta, schema),
-- diff against the prior snapshot, and have Claude Haiku
-- classify each diff as meaningful / a/b_test / widget / typo /
-- irrelevant. Only `meaningful` triggers alerts.
--
-- Three tables:
--   kotoiq_tracked_pages    — what to watch
--   kotoiq_page_snapshots   — point-in-time content captures
--   kotoiq_page_changes     — classified diffs, alerts, reviews
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_tracked_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  competitor_domain text NOT NULL,          -- 'acmecorp.com'
  url text NOT NULL,                        -- full URL
  page_type text,                           -- 'home'|'pricing'|'features'|'blog_post'|'landing'|'about'|'other'
  check_frequency text DEFAULT 'daily',     -- 'daily'|'weekly'
  is_active boolean DEFAULT true,
  fetch_blocked_until timestamptz,          -- set if anti-bot keeps failing; auto-retry after this
  last_checked_at timestamptz,
  added_at timestamptz DEFAULT now(),
  added_by uuid,                            -- user id (no FK — auth.users lives in a different schema)
  UNIQUE (client_id, url)
);

CREATE INDEX IF NOT EXISTS idx_tracked_pages_client_active
  ON kotoiq_tracked_pages(client_id, is_active);
CREATE INDEX IF NOT EXISTS idx_tracked_pages_domain
  ON kotoiq_tracked_pages(competitor_domain);

CREATE TABLE IF NOT EXISTS kotoiq_page_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_page_id uuid NOT NULL REFERENCES kotoiq_tracked_pages(id) ON DELETE CASCADE,
  content_hash text NOT NULL,               -- SHA-256 of normalized content
  http_status int,
  fetch_ms int,
  h1 text,
  h2_list jsonb,                            -- ['Feature 1', 'Feature 2', ...]
  cta_list jsonb,                           -- [{text, href, position}]
  hero_copy text,                           -- first ~500 chars above the fold
  body_text text,                           -- normalized body (stripped of nav/footer/script)
  meta_title text,
  meta_description text,
  schema_orgs jsonb,                        -- extracted JSON-LD
  word_count int,
  detected_tech jsonb,                      -- {esp, cms, analytics, chat, ads, framework, font}
  pricing_extracted jsonb,                  -- only populated if page_type='pricing'
  captured_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_snapshots_page_time
  ON kotoiq_page_snapshots(tracked_page_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_snapshots_hash
  ON kotoiq_page_snapshots(content_hash);

CREATE TABLE IF NOT EXISTS kotoiq_page_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tracked_page_id uuid NOT NULL REFERENCES kotoiq_tracked_pages(id) ON DELETE CASCADE,
  from_snapshot_id uuid REFERENCES kotoiq_page_snapshots(id) ON DELETE SET NULL,
  to_snapshot_id uuid NOT NULL REFERENCES kotoiq_page_snapshots(id) ON DELETE CASCADE,
  diff_summary text,                        -- human-readable one-liner for the alert
  classification text NOT NULL,             -- 'meaningful'|'ab_test'|'widget'|'typo'|'irrelevant'
  classifier_confidence numeric(3,2),       -- 0.00-1.00
  classifier_reason text,
  fields_changed jsonb,                     -- ['h1', 'cta_list', 'hero_copy']
  diff_details jsonb,                       -- structured before/after per changed field
  severity text,                            -- 'high'|'medium'|'low' (only if meaningful)
  detected_at timestamptz DEFAULT now(),
  alerted_at timestamptz,
  reviewed_by uuid,                         -- user id (no FK — auth.users lives in a different schema)
  user_reclassification text                -- captures user correction for future tuning
);

CREATE INDEX IF NOT EXISTS idx_page_changes_class_time
  ON kotoiq_page_changes(classification, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_changes_client_time
  ON kotoiq_page_changes(client_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_changes_page_time
  ON kotoiq_page_changes(tracked_page_id, detected_at DESC);

ALTER TABLE kotoiq_tracked_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_page_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_page_changes ENABLE ROW LEVEL SECURITY;
