-- ============================================================
-- KotoIQ — Auto-Fix Queue (OTTO-style)
--
-- Materializes findings from across all audits/recommendations
-- into a single queue. Each row is one suggested fix. User
-- approves/rejects/snoozes; runApprovedFixes() dispatches based
-- on fix_type (regenerate_brief, apply_schema, manual, etc.).
--
-- source_signature de-dupes re-scans: if scanForFixes() finds
-- the same finding twice across runs, we update the existing
-- queue row instead of creating a duplicate.
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_autofix_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid,

  -- Source attribution
  source_type text NOT NULL,
    -- 'recommendation' | 'schema_audit' | 'technical_deep' |
    -- 'content_inventory' | 'eeat_audit' | 'page_diff' | 'manual'
  source_id uuid,                    -- loose FK; source row may be deleted
  source_signature text NOT NULL,    -- de-dup key, e.g. 'schema_audit:<audit_id>:<url>:<schema_type>'

  -- Display
  title text NOT NULL,
  detail text,
  target_url text,
  severity text NOT NULL DEFAULT 'medium',  -- 'high' | 'medium' | 'low'
  estimated_impact text,
  effort text DEFAULT 'moderate',           -- 'quick_win' | 'moderate' | 'major_project'

  -- Fix dispatch
  fix_type text NOT NULL,
    -- 'regenerate_brief' | 'apply_schema' | 'add_internal_link' |
    -- 'refresh_content' | 'mark_done' | 'manual'
  fix_params jsonb DEFAULT '{}',

  -- Lifecycle
  status text NOT NULL DEFAULT 'pending',
    -- 'pending' | 'approved' | 'rejected' | 'running' |
    -- 'completed' | 'failed' | 'snoozed'
  approved_by uuid, approved_at timestamptz,
  rejected_at timestamptz, rejection_reason text,
  snoozed_until timestamptz,
  started_at timestamptz, completed_at timestamptz,
  result jsonb,                      -- {ok, message, artifact_id?}

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (client_id, source_signature)
);

CREATE INDEX IF NOT EXISTS idx_autofix_queue_client_status
  ON kotoiq_autofix_queue(client_id, status);
CREATE INDEX IF NOT EXISTS idx_autofix_queue_severity_created
  ON kotoiq_autofix_queue(client_id, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_autofix_queue_runnable
  ON kotoiq_autofix_queue(client_id, status, fix_type)
  WHERE status IN ('pending', 'approved');

ALTER TABLE kotoiq_autofix_queue ENABLE ROW LEVEL SECURITY;
