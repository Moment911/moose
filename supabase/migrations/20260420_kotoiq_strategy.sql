-- ═══════════════════════════════════════════════════════════════════════════
-- KotoIQ — Strategic Plans & Knowledge Graph Exports
-- ═══════════════════════════════════════════════════════════════════════════
-- Tables backing the Strategy Engine (unified planner) and the Knowledge
-- Graph Exporter (Wikidata-ready submission packages).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_strategic_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id),
  timeframe text,
  attack_priorities jsonb DEFAULT '[]',
  defend_priorities jsonb DEFAULT '[]',
  abandon_list jsonb DEFAULT '[]',
  weekly_actions jsonb DEFAULT '[]',
  monthly_milestones jsonb DEFAULT '[]',
  resource_allocation jsonb DEFAULT '{}',
  executive_summary text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kotoiq_knowledge_graph_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  format text,
  content text,
  entity_properties jsonb DEFAULT '[]',
  related_entities jsonb DEFAULT '[]',
  kp_likelihood numeric(5,2),
  submitted_to_wikidata boolean DEFAULT false,
  wikidata_entry_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strategic_plans_client ON kotoiq_strategic_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_kg_exports_client ON kotoiq_knowledge_graph_exports(client_id);
