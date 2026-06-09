-- ════════════════════════════════════════════════════════════════
-- ⚠️  APPLY MANUALLY via the Supabase SQL editor.
--     Do NOT run `supabase db push` — prod has migration-tracking drift.
--     Paste this entire file's contents into the SQL editor and run it.
-- ════════════════════════════════════════════════════════════════
--
-- KotoIQ — Day-1 Site Baseline (Phase 11 / WS2)
--
-- An IMMUTABLE, insert-only inventory of the client's OWN pages, captured
-- once at onboarding (and re-captured as new dated snapshots, never mutated).
-- Each row is one page's day-1 fact: url, title, h1, page_type, word_count,
-- content_hash (SHA-256 from pageContentExtractor). Later scans DIFF a current
-- content_hash against the latest baseline row per (client_id, url) — they
-- never UPDATE or DELETE an existing baseline row.
--
--   captureBaseline()      — discovers + extracts the client's pages, INSERTs.
--   diffAgainstBaseline()  — reads the latest baseline row per url, compares.
--
-- Immutability is enforced two ways:
--   1. The engine only ever INSERTs (never UPDATE/DELETE).
--   2. UNIQUE (client_id, url, captured_at) — a new capture is a new dated row,
--      so two captures of the same url coexist as a history, not an overwrite.
--
-- RLS mirrors kotoiq_page_suggestions' agency-isolation policy
-- (20260608_page_factory.sql lines 37-45): agency_members → auth.uid().
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_site_baseline (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  site_id       UUID,                       -- koto_wp_sites.id (nullable; pre-pair scans)
  url           TEXT NOT NULL,
  page_type     TEXT,                       -- inferPageType() output (home/pricing/blog_post/…)
  title         TEXT,                       -- ExtractedPage.meta_title
  h1            TEXT,                        -- ExtractedPage.h1
  word_count    INT,                        -- ExtractedPage.word_count
  content_hash  TEXT NOT NULL,              -- ExtractedPage.content_hash (SHA-256)
  source_url    TEXT NOT NULL,              -- data-integrity: where this fact was fetched from
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),  -- data-integrity: when it was fetched
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- snapshot timestamp (immutable key)
  UNIQUE (client_id, url, captured_at)       -- insert-only: a new capture = a new dated row
);

-- Latest-baseline-per-url lookups (diffAgainstBaseline) + history reads.
CREATE INDEX IF NOT EXISTS idx_site_baseline_client_captured
  ON kotoiq_site_baseline(client_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_baseline_client_url
  ON kotoiq_site_baseline(client_id, url);

ALTER TABLE kotoiq_site_baseline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency_isolation_site_baseline" ON kotoiq_site_baseline;
CREATE POLICY "agency_isolation_site_baseline"
  ON kotoiq_site_baseline
  FOR ALL
  USING (
    agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  );
