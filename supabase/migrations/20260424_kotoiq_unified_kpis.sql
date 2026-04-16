-- ─────────────────────────────────────────────────────────────
-- KotoIQ Unified KPIs — AI Visibility Score + Quick Win Queue
-- Rolls up signals from every existing KotoIQ tool into two
-- top-level KPIs used on the Dashboard tab.
-- ─────────────────────────────────────────────────────────────

-- Snapshots capture AI Visibility score over time (for trending)
CREATE TABLE IF NOT EXISTS kotoiq_ai_visibility_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ai_visibility_score numeric(5,2),
  grade text,
  topical_authority numeric(5,2),
  brand_serp numeric(5,2),
  eeat numeric(5,2),
  aeo numeric(5,2),
  components jsonb DEFAULT '{}',
  next_focus jsonb DEFAULT '[]',
  captured_at timestamptz DEFAULT now()
);

-- Unified queue of prioritized action items pulled from all tools
CREATE TABLE IF NOT EXISTS kotoiq_quick_win_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  source text,                    -- which tool generated it
  action_type text,
  effort text,                    -- quick_win | moderate | major_project
  effort_minutes integer,
  impact_score numeric(5,2),
  estimated_traffic_gain integer,
  estimated_revenue_gain numeric(10,2),
  priority integer,
  how_to_do_it text,
  related_data jsonb DEFAULT '{}',
  status text DEFAULT 'pending',  -- pending | in_progress | done | skipped
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_vis_client ON kotoiq_ai_visibility_snapshots(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_vis_captured ON kotoiq_ai_visibility_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_quick_win_client ON kotoiq_quick_win_queue(client_id);
CREATE INDEX IF NOT EXISTS idx_quick_win_priority ON kotoiq_quick_win_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_quick_win_status ON kotoiq_quick_win_queue(status);
