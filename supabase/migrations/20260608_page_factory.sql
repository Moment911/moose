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
