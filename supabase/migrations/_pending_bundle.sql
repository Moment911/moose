-- ════════════════════════════════════════════════════════════════
-- KotoIQ pending migrations bundle (20260608 → 20260613)
-- Paste into Supabase SQL Editor in one shot.
-- Fully idempotent: IF NOT EXISTS on tables + indexes,
-- DROP POLICY IF EXISTS before each CREATE POLICY.
-- Generated: 2026-05-16T06:20:03Z
-- ════════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────
-- ▼▼▼ 20260608_kotoiq_aeo_visibility.sql ▼▼▼
-- ──────────────────────────────────────────────────────────────
-- ============================================================
-- KotoIQ — AEO Visibility Tracker (Phase A)
--
-- Continuous tracking of how each client's brand (and competitors)
-- appears in AI search answers across ChatGPT, Claude, Gemini,
-- Perplexity, and Google AI Overviews.
--
-- Three tables:
--   kotoiq_aeo_prompts        — the prompts we test per client
--   kotoiq_aeo_competitors    — brands to look for in answers
--   kotoiq_aeo_runs           — one row per (prompt × engine × run)
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_aeo_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  category text,                 -- 'commercial' | 'informational' | 'comparison' | 'local' | 'problem'
  intent text,                   -- free-text intent tag
  is_active boolean DEFAULT true,
  created_by text DEFAULT 'manual',  -- 'manual' | 'ai_seed' | 'csv'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aeo_prompts_client_active
  ON kotoiq_aeo_prompts(client_id, is_active);

CREATE TABLE IF NOT EXISTS kotoiq_aeo_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  aliases text[],                -- ['Acme', 'Acme Inc', 'AcmeCo']
  domain text,
  is_self boolean DEFAULT false, -- true for the client's own brand row
  added_at timestamptz DEFAULT now(),
  UNIQUE (client_id, brand_name)
);

CREATE INDEX IF NOT EXISTS idx_aeo_competitors_client
  ON kotoiq_aeo_competitors(client_id);

CREATE TABLE IF NOT EXISTS kotoiq_aeo_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES kotoiq_aeo_prompts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  engine text NOT NULL,          -- 'chatgpt' | 'claude' | 'gemini' | 'perplexity' | 'google_aio'
  raw_response text,
  response_ms int,
  cited_urls jsonb,              -- [{url, anchor, position}]
  brand_mentions jsonb,          -- [{brand, position, sentiment, snippet}]
  mention_count int DEFAULT 0,   -- denormalized total mentions across all tracked brands
  client_mentioned boolean DEFAULT false,  -- denormalized: did client's own brand appear
  client_position int,           -- 1, 2, 3 ... if mentioned; null if not
  error text,                    -- non-null if engine call failed
  cost_usd numeric(10,6) DEFAULT 0,
  run_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aeo_runs_client_time
  ON kotoiq_aeo_runs(client_id, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_aeo_runs_prompt_engine_time
  ON kotoiq_aeo_runs(prompt_id, engine, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_aeo_runs_client_mentioned
  ON kotoiq_aeo_runs(client_id, client_mentioned, run_at DESC);

-- RLS — keep consistent with other kotoiq_* tables (service-role only for now)
ALTER TABLE kotoiq_aeo_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_aeo_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_aeo_runs ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────
-- ▼▼▼ 20260608_page_factory.sql ▼▼▼
-- ──────────────────────────────────────────────────────────────
-- Page Factory: gap intelligence + style profiles + bulk generation tracking
-- Part of SEO Page Factory feature (scan → identify → build → publish)

-- ─── Page Suggestions (gap intelligence output) ────────────────────────────

CREATE TABLE IF NOT EXISTS kotoiq_page_suggestions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service       TEXT NOT NULL,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  county        TEXT,
  zip           TEXT,
  priority      INT DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  reason        TEXT,
  search_volume INT,
  keyword_difficulty INT,
  competitor_count   INT,
  competitor_urls    JSONB DEFAULT '[]'::jsonb,
  status        TEXT DEFAULT 'suggested'
                CHECK (status IN ('suggested','accepted','generating','built','published','dismissed')),
  campaign_id   UUID,  -- links to kotoiq_campaigns when built
  variant_id    UUID,  -- links to kotoiq_variants when generated
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_suggestions_agency   ON kotoiq_page_suggestions(agency_id);
CREATE INDEX IF NOT EXISTS idx_page_suggestions_client   ON kotoiq_page_suggestions(client_id);
CREATE INDEX IF NOT EXISTS idx_page_suggestions_status   ON kotoiq_page_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_page_suggestions_priority ON kotoiq_page_suggestions(priority DESC);

ALTER TABLE kotoiq_page_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency_isolation_page_suggestions" ON kotoiq_page_suggestions;
CREATE POLICY "agency_isolation_page_suggestions"
  ON kotoiq_page_suggestions
  FOR ALL
  USING (
    agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  );

-- ─── Style Profiles (reference HTML extraction) ───────────────────────────

CREATE TABLE IF NOT EXISTS kotoiq_style_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id        UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name             TEXT NOT NULL DEFAULT 'Default',
  source_url       TEXT,
  heading_pattern  JSONB,  -- {h1: "pattern", h2: "pattern", h3: "pattern"}
  section_structure JSONB, -- [{type, tag, class, content_hint}]
  class_conventions JSONB, -- {container, section, heading, paragraph, list, cta}
  tone             TEXT,
  content_density  TEXT CHECK (content_density IN ('sparse','moderate','dense')),
  word_count_target INT,
  raw_html         TEXT,   -- original reference HTML for re-extraction
  is_default       BOOLEAN DEFAULT false,
  metadata         JSONB DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_style_profiles_agency ON kotoiq_style_profiles(agency_id);
CREATE INDEX IF NOT EXISTS idx_style_profiles_client ON kotoiq_style_profiles(client_id);

ALTER TABLE kotoiq_style_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency_isolation_style_profiles" ON kotoiq_style_profiles;
CREATE POLICY "agency_isolation_style_profiles"
  ON kotoiq_style_profiles
  FOR ALL
  USING (
    agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  );

-- ─── Publish Watch (GSC indexation monitoring) ────────────────────────────

CREATE TABLE IF NOT EXISTS kotoiq_publish_watches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id    UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  publish_id   UUID NOT NULL,  -- references kotoiq_publishes
  url          TEXT NOT NULL,
  check_at     TIMESTAMPTZ NOT NULL,  -- scheduled check time
  check_type   TEXT NOT NULL CHECK (check_type IN ('24h','72h','7d','30d')),
  indexed      BOOLEAN,
  gsc_impressions INT,
  gsc_clicks      INT,
  gsc_position    NUMERIC(5,1),
  checked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_publish_watches_pending ON kotoiq_publish_watches(check_at)
  WHERE checked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_publish_watches_agency  ON kotoiq_publish_watches(agency_id);

ALTER TABLE kotoiq_publish_watches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency_isolation_publish_watches" ON kotoiq_publish_watches;
CREATE POLICY "agency_isolation_publish_watches"
  ON kotoiq_publish_watches
  FOR ALL
  USING (
    agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- ▼▼▼ 20260609_kotoiq_page_diff.sql ▼▼▼
-- ──────────────────────────────────────────────────────────────
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

-- ──────────────────────────────────────────────────────────────
-- ▼▼▼ 20260610_kotoiq_competitor_ads.sql ▼▼▼
-- ──────────────────────────────────────────────────────────────
-- ============================================================
-- KotoIQ — Competitor Ad Creative Library (Phase E)
--
-- Persists ad creatives discovered via Meta Ads Library API
-- (free, official) and Google Ads Transparency (public scrape).
-- One row per ad. Used by Competitor Ads tab + unified timeline.
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_competitor_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source text NOT NULL,            -- 'meta' | 'google'
  external_ad_id text,             -- Meta archive ID, Google ad ID
  brand_name text NOT NULL,        -- the brand we searched for
  page_name text,                  -- Facebook page name (Meta) / advertiser (Google)
  page_id text,                    -- FB page ID / Google advertiser ID
  platforms text[],                -- ['facebook','instagram'] | ['search','display']
  creative_snapshot_url text,      -- link to the rendered ad screenshot
  creative_image_url text,         -- direct image URL when available
  headline text,
  body_text text,
  cta_text text,
  link_url text,
  spend_range text,                -- e.g. "$100-$499"
  impressions_range text,
  currency text,
  delivery_start timestamptz,
  delivery_stop timestamptz,
  is_active boolean DEFAULT true,
  regions jsonb,                   -- [{region, percentage}]
  demographics jsonb,              -- [{age, gender, percentage}]
  raw jsonb,                       -- full API response for debugging
  detected_at timestamptz DEFAULT now(),
  UNIQUE (source, external_ad_id)
);

CREATE INDEX IF NOT EXISTS idx_competitor_ads_client_brand
  ON kotoiq_competitor_ads(client_id, brand_name);
CREATE INDEX IF NOT EXISTS idx_competitor_ads_active
  ON kotoiq_competitor_ads(client_id, is_active, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_ads_source_brand
  ON kotoiq_competitor_ads(source, brand_name);

ALTER TABLE kotoiq_competitor_ads ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────
-- ▼▼▼ 20260611_kotoiq_youtube_intel.sql ▼▼▼
-- ──────────────────────────────────────────────────────────────
-- ============================================================
-- KotoIQ — YouTube Intel (Phase F)
--
-- Tracks competitor YouTube channels and their recent uploads.
-- Uses the free YouTube Data API v3 (10K quota/day).
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_competitor_youtube_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  channel_id text NOT NULL,            -- YouTube channel ID (UC...)
  channel_handle text,                 -- @ChannelName
  channel_title text,
  channel_description text,
  thumbnail_url text,
  custom_url text,
  uploads_playlist_id text,
  country text,
  subscriber_count bigint,
  view_count bigint,
  video_count int,
  last_synced_at timestamptz,
  added_at timestamptz DEFAULT now(),
  UNIQUE (client_id, channel_id)
);
CREATE INDEX IF NOT EXISTS idx_yt_channels_client_brand
  ON kotoiq_competitor_youtube_channels(client_id, brand_name);

CREATE TABLE IF NOT EXISTS kotoiq_competitor_youtube_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  video_id text NOT NULL,
  title text,
  description text,
  thumbnail_url text,
  published_at timestamptz,
  duration_seconds int,
  view_count bigint,
  like_count bigint,
  comment_count bigint,
  is_short boolean DEFAULT false,
  fetched_at timestamptz DEFAULT now(),
  UNIQUE (client_id, video_id)
);
CREATE INDEX IF NOT EXISTS idx_yt_videos_client_pub
  ON kotoiq_competitor_youtube_videos(client_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_yt_videos_channel_pub
  ON kotoiq_competitor_youtube_videos(channel_id, published_at DESC);

ALTER TABLE kotoiq_competitor_youtube_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_competitor_youtube_videos ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────
-- ▼▼▼ 20260612_kotoiq_newsletter_intel.sql ▼▼▼
-- ──────────────────────────────────────────────────────────────
-- ============================================================
-- KotoIQ — Newsletter Intel (Phase G)
--
-- Track competitor email marketing by subscribing a unique alias
-- per brand to their newsletter. Resend inbound webhook posts
-- received emails; Haiku classifies journey stage + extracts CTA.
-- Manual paste-import also supported for any email source.
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_competitor_email_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  alias_email text NOT NULL UNIQUE,        -- intel-{hash}@hellokoto-inbound.com
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_aliases_client ON kotoiq_competitor_email_aliases(client_id, is_active);

CREATE TABLE IF NOT EXISTS kotoiq_competitor_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  alias_id uuid REFERENCES kotoiq_competitor_email_aliases(id) ON DELETE SET NULL,
  brand_name text NOT NULL,
  from_address text,
  from_name text,
  subject text,
  preview_text text,                       -- first ~120 chars of plain body
  body_html text,
  body_text text,
  links jsonb,                             -- [{url, anchor}]
  cta_texts jsonb,                         -- [{text, url}]
  journey_stage text,                      -- welcome | promo | nurture | cart_abandon | win_back | announcement | digest | other
  emotion text,                            -- urgent | informational | playful | exclusive | other
  promo_detected text,                     -- '20% off', 'Free shipping', etc.
  sent_at timestamptz,
  received_at timestamptz DEFAULT now(),
  ingestion_source text DEFAULT 'webhook', -- 'webhook' | 'manual_paste'
  classifier_cost_usd numeric(10,6)
);
CREATE INDEX IF NOT EXISTS idx_competitor_emails_client_brand ON kotoiq_competitor_emails(client_id, brand_name, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_emails_journey ON kotoiq_competitor_emails(client_id, journey_stage, received_at DESC);

ALTER TABLE kotoiq_competitor_email_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_competitor_emails ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────
-- ▼▼▼ 20260613_kotoiq_routines.sql ▼▼▼
-- ──────────────────────────────────────────────────────────────
-- ============================================================
-- KotoIQ — Today / Action Center routines (Phase: UX layer)
--
-- Tracks per-user, per-client completion of cadence routines.
-- Routines come from a code-defined catalog (todayEngine.ts);
-- this table just stores which ones the user has marked done
-- and when, so daily/weekly/monthly cadences can reset cleanly.
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_routine_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid,                                    -- attribution
  user_id uuid,                                      -- who marked it done (auth.users id)
  routine_id text NOT NULL,                          -- 'review_pulse' | 'reply_to_reviews' | ...
  cadence text NOT NULL,                             -- 'initial' | 'daily' | 'weekly' | 'monthly'
  completed_at timestamptz DEFAULT now(),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_routine_completions_client_routine_time
  ON kotoiq_routine_completions(client_id, routine_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_routine_completions_client_cadence_time
  ON kotoiq_routine_completions(client_id, cadence, completed_at DESC);

ALTER TABLE kotoiq_routine_completions ENABLE ROW LEVEL SECURITY;
