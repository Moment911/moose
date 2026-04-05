-- Local rank tracking scans
CREATE TABLE IF NOT EXISTS local_rank_scans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id     uuid REFERENCES agencies(id) ON DELETE CASCADE,
  keyword       text NOT NULL,
  location      text NOT NULL,
  target_business text,
  target_domain text,
  radius_km     int DEFAULT 16,
  target_rank   int,           -- null = not found in top 20
  total_results int DEFAULT 0,
  results       jsonb DEFAULT '[]',  -- full google_local array
  ai_analysis   jsonb DEFAULT '{}',
  scanned_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rank_scans_client    ON local_rank_scans(client_id);
CREATE INDEX IF NOT EXISTS idx_rank_scans_keyword   ON local_rank_scans(client_id, keyword, location);
CREATE INDEX IF NOT EXISTS idx_rank_scans_scanned   ON local_rank_scans(scanned_at DESC);

-- Enable RLS
ALTER TABLE local_rank_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_rank_scans" ON local_rank_scans FOR ALL USING (true) WITH CHECK (true);
