-- ═══════════════════════════════════════════════════════════════════════
-- Reddit lead-gen v0 (dogfood) — koto_reddit_config + koto_reddit_leads
--
-- Find buyer-intent Reddit threads, AI-score them, AI-draft a reply in the
-- brand voice. A HUMAN reviews + posts manually (NO auto-posting).
--
-- Lightweight provenance: source_url + fetched_at columns on the row (a live
-- Reddit URL is its own source of truth — no createVerifiedData wrapper).
-- Intent scores are AI-derived and labelled "AI-estimated" in the UI.
--
-- Agency isolation: agency_id on both tables + RLS. Momenta is the AGENCY;
-- client_id points at Momenta's own client row (never null).
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Per-client listening config (manual seed for v0) ──────────────────
CREATE TABLE IF NOT EXISTS koto_reddit_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   uuid NOT NULL,
  client_id   uuid NOT NULL,
  subreddits  text[] NOT NULL DEFAULT '{}',   -- e.g. {hvacadvice, phoenix}
  keywords    text[] NOT NULL DEFAULT '{}',   -- e.g. {"AC not cooling", "hvac recommendation"}
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reddit_config_agency_client
  ON koto_reddit_config(agency_id, client_id);

-- ── Discovered threads + AI scores + drafts ───────────────────────────
CREATE TABLE IF NOT EXISTS koto_reddit_leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid NOT NULL,
  client_id     uuid NOT NULL,
  thread_url    text NOT NULL,              -- canonical permalink (dedup key)
  subreddit     text,
  title         text,
  body_snippet  text,                       -- truncated selftext for context
  intent_score  int,                        -- 0-100, AI-estimated
  intent_reason text,                       -- one-line AI justification
  draft_reply   text,                       -- generated lazily on demand
  status        text NOT NULL DEFAULT 'new'
                CHECK (status IN ('new','drafted','posted','skipped')),
  source_url    text NOT NULL,              -- provenance: where it was fetched from
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Dedup: one row per (client, thread) so the daily feed never re-surfaces a
-- thread already drafted/posted/skipped.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reddit_leads_client_thread
  ON koto_reddit_leads(agency_id, client_id, thread_url);
CREATE INDEX IF NOT EXISTS idx_reddit_leads_agency_client
  ON koto_reddit_leads(agency_id, client_id);
CREATE INDEX IF NOT EXISTS idx_reddit_leads_score
  ON koto_reddit_leads(agency_id, client_id, intent_score DESC);

-- ── RLS — defense in depth (server uses service-role, but enforce anyway) ──
ALTER TABLE koto_reddit_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_reddit_leads  ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; these policies guard any anon/authed direct access.
DROP POLICY IF EXISTS reddit_config_agency_isolation ON koto_reddit_config;
CREATE POLICY reddit_config_agency_isolation ON koto_reddit_config
  FOR ALL
  USING (agency_id::text = current_setting('request.jwt.claims', true)::json->>'agency_id')
  WITH CHECK (agency_id::text = current_setting('request.jwt.claims', true)::json->>'agency_id');

DROP POLICY IF EXISTS reddit_leads_agency_isolation ON koto_reddit_leads;
CREATE POLICY reddit_leads_agency_isolation ON koto_reddit_leads
  FOR ALL
  USING (agency_id::text = current_setting('request.jwt.claims', true)::json->>'agency_id')
  WITH CHECK (agency_id::text = current_setting('request.jwt.claims', true)::json->>'agency_id');
