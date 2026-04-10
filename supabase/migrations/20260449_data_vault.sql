-- ============================================================
-- Universal Data Vault — write-once history of every meaningful
-- record across the platform plus restorable snapshots.
-- ============================================================

-- Vault entries — one row per logical record write
CREATE TABLE IF NOT EXISTS koto_data_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  client_id uuid,

  -- record_type identifies the kind of thing being stored:
  --   discovery_field, discovery_intel_card, discovery_compile,
  --   transcript_import, voice_call, opportunity, scout_lead, etc.
  record_type text NOT NULL,
  source text,           -- 'discovery', 'voice', 'scout', 'opportunities', 'manual', etc.
  source_id text,        -- the id of the underlying record (engagement_id, call_id, etc)

  -- Free-form labels for table display
  title text,
  summary text,

  -- Full payload (the canonical data we want to remember)
  data jsonb DEFAULT '{}'::jsonb,

  -- Markers
  source_meta jsonb DEFAULT '{}'::jsonb,  -- { is_test: bool, generated_at, ... }
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_agency ON koto_data_vault(agency_id);
CREATE INDEX IF NOT EXISTS idx_vault_record_type ON koto_data_vault(record_type);
CREATE INDEX IF NOT EXISTS idx_vault_source ON koto_data_vault(source);
CREATE INDEX IF NOT EXISTS idx_vault_source_id ON koto_data_vault(source_id);
CREATE INDEX IF NOT EXISTS idx_vault_client ON koto_data_vault(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vault_created ON koto_data_vault(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vault_test ON koto_data_vault((source_meta->>'is_test')) WHERE source_meta->>'is_test' = 'true';
CREATE INDEX IF NOT EXISTS idx_vault_active ON koto_data_vault(agency_id, created_at DESC) WHERE is_deleted = false;

-- Snapshots — point-in-time captures of an entire engagement / module
CREATE TABLE IF NOT EXISTS koto_data_vault_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  source_type text NOT NULL,    -- 'discovery_engagement', 'voice_campaign', etc.
  source_id text NOT NULL,
  label text,
  payload jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS idx_vault_snap_agency ON koto_data_vault_snapshots(agency_id);
CREATE INDEX IF NOT EXISTS idx_vault_snap_source ON koto_data_vault_snapshots(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_vault_snap_created ON koto_data_vault_snapshots(created_at DESC);

-- RLS — permissive (the API uses service role + scopes by agency_id in code)
ALTER TABLE koto_data_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_data_vault_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vault_all" ON koto_data_vault;
CREATE POLICY "vault_all" ON koto_data_vault FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "vault_snap_all" ON koto_data_vault_snapshots;
CREATE POLICY "vault_snap_all" ON koto_data_vault_snapshots FOR ALL USING (true) WITH CHECK (true);

-- Auto-update updated_at on koto_data_vault
CREATE OR REPLACE FUNCTION update_vault_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vault_updated ON koto_data_vault;
CREATE TRIGGER trg_vault_updated BEFORE UPDATE ON koto_data_vault
  FOR EACH ROW EXECUTE FUNCTION update_vault_updated_at();
