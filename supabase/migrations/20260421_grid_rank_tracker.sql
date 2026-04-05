-- Grid rank scan results
CREATE TABLE IF NOT EXISTS local_rank_grid_scans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  keyword         text NOT NULL,
  center_location text NOT NULL,
  center_lat      numeric,
  center_lng      numeric,
  target_business text,
  grid_size       int DEFAULT 3,        -- 3=3x3, 5=5x5, 7=7x7
  grid_spacing_km numeric DEFAULT 1.5,
  grid_results    jsonb DEFAULT '[]',   -- [{lat,lng,rank,label}]
  avg_rank        numeric,
  best_rank       int,
  worst_rank      int,
  ranked_cells    int,                  -- cells where business was found
  total_cells     int,
  scanned_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grid_scans_client  ON local_rank_grid_scans(client_id);
CREATE INDEX IF NOT EXISTS idx_grid_scans_keyword ON local_rank_grid_scans(client_id, keyword);
CREATE INDEX IF NOT EXISTS idx_grid_scans_date    ON local_rank_grid_scans(scanned_at DESC);

ALTER TABLE local_rank_grid_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_grid_scans" ON local_rank_grid_scans FOR ALL USING (true) WITH CHECK (true);
