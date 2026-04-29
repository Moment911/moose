-- ============================================================
-- KotoIQ Agent Layer — Strategist / Captain / Tool orchestration
--
-- Three tables powering the agentic orchestration layer:
--   1. kotoiq_agent_goals   — durable intents (what to achieve)
--   2. kotoiq_agent_runs    — one Strategist invocation per goal
--   3. kotoiq_agent_actions  — one tool invocation per run step
--
-- All three carry agency_id + client_id for tenant isolation.
-- RLS pattern mirrors 20260427_kotoiq_client_activity.sql.
-- ============================================================

-- ── Goals ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kotoiq_agent_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  goal_type text NOT NULL CHECK (goal_type IN (
    'recover_decaying_content',
    'close_topical_gap',
    'defend_brand_serp'
  )),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','cancelled')),
  trigger text NOT NULL CHECK (trigger IN ('manual','schedule','threshold','bot')),
  schedule_cron text,
  threshold_config jsonb,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  budget_usd numeric(8,2) NOT NULL DEFAULT 5.00,
  budget_tokens int NOT NULL DEFAULT 200000,
  budget_actions int NOT NULL DEFAULT 10,
  requires_approval boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_goals_active
  ON kotoiq_agent_goals(client_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_agent_goals_agency
  ON kotoiq_agent_goals(agency_id);

ALTER TABLE kotoiq_agent_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency can read own agent goals" ON kotoiq_agent_goals
  FOR SELECT USING (agency_id::text = current_setting('request.jwt.claims', true)::json->>'agency_id');

-- ── Runs ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kotoiq_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES kotoiq_agent_goals(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL,
  client_id uuid NOT NULL,
  trigger text NOT NULL,
  status text NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning','awaiting_approval','executing','verifying','completed','failed','cancelled')),
  state_snapshot jsonb,
  plan jsonb,
  outcome jsonb,
  cost_usd numeric(8,4) NOT NULL DEFAULT 0,
  tokens_used int NOT NULL DEFAULT 0,
  actions_taken int NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_goal
  ON kotoiq_agent_runs(goal_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_client
  ON kotoiq_agent_runs(client_id, started_at DESC);

ALTER TABLE kotoiq_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency can read own agent runs" ON kotoiq_agent_runs
  FOR SELECT USING (agency_id::text = current_setting('request.jwt.claims', true)::json->>'agency_id');

-- ── Actions ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kotoiq_agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES kotoiq_agent_runs(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  client_id uuid NOT NULL,
  sequence int NOT NULL,
  captain text NOT NULL CHECK (captain IN ('content','semantic','authority')),
  tool_name text NOT NULL,
  input jsonb NOT NULL,
  output jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','executing','succeeded','failed','skipped')),
  approval_required boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  rejected_reason text,
  result_ref_table text,
  result_ref_id uuid,
  cost_usd numeric(8,4) NOT NULL DEFAULT 0,
  tokens_used int NOT NULL DEFAULT 0,
  duration_ms int,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_run
  ON kotoiq_agent_actions(run_id, sequence);
CREATE INDEX IF NOT EXISTS idx_agent_actions_pending_approval
  ON kotoiq_agent_actions(client_id, status)
  WHERE status = 'pending' AND approval_required = true;

ALTER TABLE kotoiq_agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency can read own agent actions" ON kotoiq_agent_actions
  FOR SELECT USING (agency_id::text = current_setting('request.jwt.claims', true)::json->>'agency_id');
