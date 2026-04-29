-- KotoIQ Behavior Analytics — Hotjar + Microsoft Clarity session/heatmap data

CREATE TABLE IF NOT EXISTS kotoiq_behavior_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('hotjar','clarity')),
  date date NOT NULL,
  page_url text NOT NULL,
  sessions integer DEFAULT 0,
  recordings_count integer DEFAULT 0,
  rage_clicks integer DEFAULT 0,
  dead_clicks integer DEFAULT 0,
  quick_backs integer DEFAULT 0,
  scroll_depth_avg numeric(5,2),
  device text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_behavior_sessions_unique
  ON kotoiq_behavior_sessions(client_id, provider, date, page_url, COALESCE(device,''));
CREATE INDEX IF NOT EXISTS idx_behavior_sessions_client ON kotoiq_behavior_sessions(client_id, date);

CREATE TABLE IF NOT EXISTS kotoiq_behavior_heatmaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('hotjar','clarity')),
  page_url text NOT NULL,
  heatmap_type text CHECK (heatmap_type IN ('click','move','scroll')),
  device text,
  sample_count integer DEFAULT 0,
  snapshot_url text,
  top_elements jsonb DEFAULT '[]',
  metadata jsonb DEFAULT '{}',
  synced_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_behavior_heatmaps_unique
  ON kotoiq_behavior_heatmaps(client_id, provider, page_url, COALESCE(heatmap_type,''), COALESCE(device,''));
CREATE INDEX IF NOT EXISTS idx_behavior_heatmaps_client ON kotoiq_behavior_heatmaps(client_id);

ALTER TABLE kotoiq_behavior_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_behavior_heatmaps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kotoiq_behavior_sessions' AND policyname = 'kotoiq_behavior_sessions_all') THEN
    CREATE POLICY kotoiq_behavior_sessions_all ON kotoiq_behavior_sessions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kotoiq_behavior_heatmaps' AND policyname = 'kotoiq_behavior_heatmaps_all') THEN
    CREATE POLICY kotoiq_behavior_heatmaps_all ON kotoiq_behavior_heatmaps FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
