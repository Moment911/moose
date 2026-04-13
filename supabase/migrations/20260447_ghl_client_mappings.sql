-- ══════════════════════════════════════════════════════════════════════════════
-- GHL PER-CLIENT LOCATION MAPPINGS
-- Each client can be assigned to a different GHL sub-account/location
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS koto_ghl_client_mappings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id         uuid NOT NULL,
  client_id         uuid NOT NULL,
  ghl_location_id   text NOT NULL,
  ghl_location_name text,
  ghl_contact_id    text,           -- the GHL contact ID for this client once synced
  status            text DEFAULT 'active' CHECK (status IN ('active','disconnected')),
  last_sync_at      timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ghl_client_map_unique ON koto_ghl_client_mappings(client_id, agency_id);
CREATE INDEX IF NOT EXISTS idx_ghl_client_map_agency ON koto_ghl_client_mappings(agency_id);
CREATE INDEX IF NOT EXISTS idx_ghl_client_map_location ON koto_ghl_client_mappings(ghl_location_id);

ALTER TABLE koto_ghl_client_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ghl_client_map_all" ON koto_ghl_client_mappings;
CREATE POLICY "ghl_client_map_all" ON koto_ghl_client_mappings FOR ALL USING (true) WITH CHECK (true);
