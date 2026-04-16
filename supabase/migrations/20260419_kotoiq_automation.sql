-- ─────────────────────────────────────────────────────────────
-- KotoIQ Automation Workflows
-- Tables powering:
--   1. Autonomous Content Pipeline    (kotoiq_pipeline_runs)
--   2. Voice Onboarding Auto-Setup    (kotoiq_auto_setup_runs)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kotoiq_pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id),
  keyword text,
  status text,
  human_score numeric(5,2),
  topicality_score numeric(5,2),
  plagiarism_score numeric(5,2),
  on_page_score numeric(5,2),
  brief_id uuid,
  content_html text,
  plain_text text,
  schema_json_ld jsonb,
  steps jsonb DEFAULT '[]',
  auto_published boolean DEFAULT false,
  published_url text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS kotoiq_auto_setup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status text,
  results jsonb DEFAULT '{}',
  error text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_client ON kotoiq_pipeline_runs(client_id);
CREATE INDEX IF NOT EXISTS idx_auto_setup_client ON kotoiq_auto_setup_runs(client_id);
