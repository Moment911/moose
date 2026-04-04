-- ══════════════════════════════════════════════════════════════════════════════
-- SCOUT SEARCH HISTORY
-- Saves every search + all lead results for historical comparison
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scout_searches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid REFERENCES agencies(id) ON DELETE CASCADE,
  -- what was searched
  query         text NOT NULL,
  location      text,
  mode          text DEFAULT 'prospect',  -- prospect | competitor | market
  -- results snapshot
  result_count  int DEFAULT 0,
  results       jsonb DEFAULT '[]',       -- full lead array snapshot
  stats         jsonb DEFAULT '{}',       -- { hot, warm, avgScore, realData }
  data_source   text DEFAULT 'google',    -- google | ai | mixed
  -- meta
  created_at    timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_scout_searches_agency    ON scout_searches(agency_id);
CREATE INDEX IF NOT EXISTS idx_scout_searches_created   ON scout_searches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scout_searches_query     ON scout_searches(query, location);

-- Add search_id foreign key to prospect_reports so reports link back to searches
ALTER TABLE prospect_reports ADD COLUMN IF NOT EXISTS search_id uuid REFERENCES scout_searches(id) ON DELETE SET NULL;
ALTER TABLE prospect_reports ADD COLUMN IF NOT EXISTS search_query text;
ALTER TABLE prospect_reports ADD COLUMN IF NOT EXISTS search_location text;

-- RLS
ALTER TABLE scout_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_scout_searches" ON scout_searches FOR ALL USING (true) WITH CHECK (true);

