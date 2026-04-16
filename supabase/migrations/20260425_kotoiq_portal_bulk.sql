-- ─────────────────────────────────────────────────────────────
-- KotoIQ: Client Portal + Bulk Operations
--
-- Adds tables for:
--   - kotoiq_bulk_runs: agency-wide bulk operations (audits, briefs, etc.)
--   - kotoiq_bulk_run_clients: per-client status inside a bulk run
--   - kotoiq_portal_views: analytics for public client portal views
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kotoiq_bulk_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  operation text NOT NULL,
  total_clients integer DEFAULT 0,
  completed_clients integer DEFAULT 0,
  failed_clients integer DEFAULT 0,
  options jsonb DEFAULT '{}',
  status text DEFAULT 'running',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS kotoiq_bulk_run_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_run_id uuid NOT NULL REFERENCES kotoiq_bulk_runs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status text DEFAULT 'queued', -- queued | running | complete | failed
  result_summary jsonb DEFAULT '{}',
  error text,
  started_at timestamptz,
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS kotoiq_portal_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  viewer_ip text,
  viewer_user_agent text,
  viewed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bulk_runs_agency ON kotoiq_bulk_runs(agency_id);
CREATE INDEX IF NOT EXISTS idx_bulk_run_clients_run ON kotoiq_bulk_run_clients(bulk_run_id);
CREATE INDEX IF NOT EXISTS idx_portal_views_client ON kotoiq_portal_views(client_id);

-- RLS (permissive — application-layer enforces scoping)
ALTER TABLE kotoiq_bulk_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_bulk_run_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_portal_views ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kotoiq_bulk_runs' AND policyname = 'bulk_runs_all') THEN
    CREATE POLICY "bulk_runs_all" ON kotoiq_bulk_runs FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kotoiq_bulk_run_clients' AND policyname = 'bulk_run_clients_all') THEN
    CREATE POLICY "bulk_run_clients_all" ON kotoiq_bulk_run_clients FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kotoiq_portal_views' AND policyname = 'portal_views_all') THEN
    CREATE POLICY "portal_views_all" ON kotoiq_portal_views FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
