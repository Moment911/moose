-- ============================================================
-- Universal Data Vault — write-once history of every meaningful
-- record across the platform plus restorable snapshots.
--
-- This migration is idempotent AND patches older versions of the
-- koto_data_vault table that may have been created with an older
-- schema. Columns are added via ADD COLUMN IF NOT EXISTS so that
-- fresh installs and upgrades both converge on the same shape.
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS koto_data_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS koto_data_vault_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

-- ── koto_data_vault columns ────────────────────────────────
ALTER TABLE koto_data_vault ADD COLUMN IF NOT EXISTS agency_id uuid;
ALTER TABLE koto_data_vault ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE koto_data_vault ADD COLUMN IF NOT EXISTS record_type text;
ALTER TABLE koto_data_vault ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE koto_data_vault ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE koto_data_vault ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE koto_data_vault ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE koto_data_vault ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE koto_data_vault ADD COLUMN IF NOT EXISTS source_meta jsonb DEFAULT '{}'::jsonb;
ALTER TABLE koto_data_vault ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE koto_data_vault ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE koto_data_vault ADD COLUMN IF NOT EXISTS deleted_by text;
ALTER TABLE koto_data_vault ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ── koto_data_vault_snapshots columns ──────────────────────
ALTER TABLE koto_data_vault_snapshots ADD COLUMN IF NOT EXISTS agency_id uuid;
ALTER TABLE koto_data_vault_snapshots ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE koto_data_vault_snapshots ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE koto_data_vault_snapshots ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE koto_data_vault_snapshots ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE koto_data_vault_snapshots ADD COLUMN IF NOT EXISTS created_by text;

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vault_agency ON koto_data_vault(agency_id);
CREATE INDEX IF NOT EXISTS idx_vault_record_type ON koto_data_vault(record_type);
CREATE INDEX IF NOT EXISTS idx_vault_source ON koto_data_vault(source);
CREATE INDEX IF NOT EXISTS idx_vault_source_id ON koto_data_vault(source_id);
CREATE INDEX IF NOT EXISTS idx_vault_client ON koto_data_vault(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vault_created ON koto_data_vault(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vault_test ON koto_data_vault((source_meta->>'is_test')) WHERE source_meta->>'is_test' = 'true';
CREATE INDEX IF NOT EXISTS idx_vault_active ON koto_data_vault(agency_id, created_at DESC) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_vault_snap_agency ON koto_data_vault_snapshots(agency_id);
CREATE INDEX IF NOT EXISTS idx_vault_snap_source ON koto_data_vault_snapshots(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_vault_snap_created ON koto_data_vault_snapshots(created_at DESC);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE koto_data_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_data_vault_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vault_all" ON koto_data_vault;
CREATE POLICY "vault_all" ON koto_data_vault FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "vault_snap_all" ON koto_data_vault_snapshots;
CREATE POLICY "vault_snap_all" ON koto_data_vault_snapshots FOR ALL USING (true) WITH CHECK (true);

-- ── Auto-update trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_vault_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vault_updated ON koto_data_vault;
CREATE TRIGGER trg_vault_updated BEFORE UPDATE ON koto_data_vault
  FOR EACH ROW EXECUTE FUNCTION update_vault_updated_at();
