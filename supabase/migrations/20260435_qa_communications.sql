-- QA & Communications tables

-- Communications log — tracks all email/SMS sent across platform
CREATE TABLE IF NOT EXISTS koto_communications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'voice', 'webhook')),
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  recipient text NOT NULL,
  subject text,
  body_preview text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'bounced')),
  provider text,
  provider_id text,
  error_message text,
  metadata jsonb DEFAULT '{}',
  client_id uuid,
  related_type text,
  related_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comms_agency ON koto_communications_log(agency_id);
CREATE INDEX IF NOT EXISTS idx_comms_created ON koto_communications_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_channel ON koto_communications_log(channel);

-- QA test runs
CREATE TABLE IF NOT EXISTS koto_qa_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid,
  triggered_by text DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  total_tests integer DEFAULT 0,
  passed integer DEFAULT 0,
  failed integer DEFAULT 0,
  skipped integer DEFAULT 0,
  health_score numeric DEFAULT 0,
  duration_ms integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- QA individual test results
CREATE TABLE IF NOT EXISTS koto_qa_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES koto_qa_runs(id) ON DELETE CASCADE,
  suite text NOT NULL,
  test_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('pass', 'fail', 'skip', 'warn')),
  duration_ms integer DEFAULT 0,
  message text,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- QA errors tracked
CREATE TABLE IF NOT EXISTS koto_qa_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid,
  suite text,
  error_type text NOT NULL,
  message text NOT NULL,
  stack text,
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by text,
  auto_healed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- QA repair actions
CREATE TABLE IF NOT EXISTS koto_qa_repairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_id uuid REFERENCES koto_qa_errors(id),
  repair_type text NOT NULL,
  description text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed', 'rolled_back')),
  auto boolean DEFAULT false,
  applied_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- QA metrics snapshots
CREATE TABLE IF NOT EXISTS koto_qa_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid,
  health_score numeric DEFAULT 0,
  test_coverage numeric DEFAULT 0,
  pass_rate numeric DEFAULT 0,
  mttr_minutes numeric DEFAULT 0,
  open_errors integer DEFAULT 0,
  total_repairs integer DEFAULT 0,
  total_self_heals integer DEFAULT 0,
  snapshot_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_runs_status ON koto_qa_runs(status);
CREATE INDEX IF NOT EXISTS idx_qa_results_run ON koto_qa_results(run_id);
CREATE INDEX IF NOT EXISTS idx_qa_errors_resolved ON koto_qa_errors(resolved);
CREATE INDEX IF NOT EXISTS idx_qa_metrics_time ON koto_qa_metrics(snapshot_at DESC);
