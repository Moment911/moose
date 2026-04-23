-- KotoIQ Sync Log + Recommendations — missing tables that many features depend on

CREATE TABLE IF NOT EXISTS kotoiq_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source text NOT NULL, -- 'quick_scan', 'full_sync', 'deep_enrich', 'gsc', 'ga4', 'ads'
  status text DEFAULT 'running', -- 'running', 'complete', 'failed'
  records_synced integer DEFAULT 0,
  error_message text,
  metadata jsonb DEFAULT '{}',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sync_log_client ON kotoiq_sync_log(client_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON kotoiq_sync_log(status);

CREATE TABLE IF NOT EXISTS kotoiq_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL,
  type text, -- 'new_content', 'link_build', 'quick_win', 'schema_fix', 'gbp_action'
  priority text DEFAULT 'medium', -- 'critical', 'high', 'medium'
  title text,
  detail text,
  estimated_impact text,
  effort text, -- 'quick_win', 'moderate', 'major_project'
  status text DEFAULT 'pending', -- 'pending', 'in_progress', 'done', 'dismissed'
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recs_client ON kotoiq_recommendations(client_id);

-- Also ensure kotoiq_competitors exists (used by scorecard to auto-resolve competitors)
CREATE TABLE IF NOT EXISTS kotoiq_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  domain text NOT NULL,
  overlap_score numeric(5,2),
  common_keywords integer,
  competitor_da numeric(5,2),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitors_client ON kotoiq_competitors(client_id);

-- Knowledge Graph Exports (used by export_knowledge_graph action)
CREATE TABLE IF NOT EXISTS kotoiq_knowledge_graph_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  format text DEFAULT 'wikidata', -- 'wikidata', 'json_ld', 'rdf_turtle'
  content text,
  entity_properties jsonb DEFAULT '{}',
  related_entities jsonb DEFAULT '[]',
  kp_likelihood numeric(5,2),
  submitted_to_wikidata boolean DEFAULT false,
  wikidata_entry_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kg_exports_client ON kotoiq_knowledge_graph_exports(client_id);
