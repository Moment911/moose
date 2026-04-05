
-- ═══════════════════════════════════════════════════════════════════
-- GHL / CRM INTEGRATION SCHEMA
-- ═══════════════════════════════════════════════════════════════════

-- CRM integration credentials per agency
CREATE TABLE IF NOT EXISTS crm_integrations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id         uuid REFERENCES agencies(id) ON DELETE CASCADE,
  provider          text NOT NULL,          -- 'gohighlevel','hubspot','salesforce'
  name              text,                   -- display name
  status            text DEFAULT 'pending', -- pending, connected, disconnected, error
  access_token      text,
  refresh_token     text,
  token_expires_at  timestamptz,
  location_id       text,                   -- GHL location/sub-account ID
  company_id        text,                   -- GHL company ID
  last_sync_at      timestamptz,
  total_synced      int DEFAULT 0,
  sync_config       jsonb DEFAULT '{}',     -- field mapping overrides, filters
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(agency_id, provider, location_id)
);

-- Sync log — every record push/pull
CREATE TABLE IF NOT EXISTS crm_sync_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id  uuid REFERENCES crm_integrations(id) ON DELETE CASCADE,
  agency_id       uuid,
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  direction       text,   -- 'push' (Koto→GHL), 'pull' (GHL→Koto), 'webhook'
  entity_type     text,   -- 'contact','opportunity','appointment'
  entity_id       text,   -- GHL entity ID
  moose_id        uuid,   -- Koto record ID
  action          text,   -- 'create','update','skip','error'
  status          text,   -- 'success','error'
  error_message   text,
  payload         jsonb,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_sync_log_integration ON crm_sync_log(integration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_sync_log_client      ON crm_sync_log(client_id);

-- Custom field mapping: GHL field key → Koto client column
CREATE TABLE IF NOT EXISTS crm_field_mappings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id  uuid REFERENCES crm_integrations(id) ON DELETE CASCADE,
  agency_id       uuid,
  ghl_field_key   text NOT NULL,    -- GHL custom field key or standard field name
  ghl_field_name  text,             -- human label
  ghl_field_type  text,             -- text, number, date, dropdown, etc
  koto_field      text NOT NULL,    -- column name in clients table or 'notes', 'tags', 'custom'
  koto_label      text,
  direction       text DEFAULT 'both',  -- 'push','pull','both'
  transform       text,             -- optional: 'uppercase','lowercase','date_format'
  active          boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_field_mappings_integration ON crm_field_mappings(integration_id);

-- GHL columns on clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ghl_contact_id  text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ghl_location_id text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS crm_source      text;    -- 'ghl','hubspot',etc
ALTER TABLE clients ADD COLUMN IF NOT EXISTS crm_synced_at   timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS crm_raw         jsonb;   -- raw CRM data snapshot
CREATE INDEX IF NOT EXISTS idx_clients_ghl ON clients(ghl_contact_id) WHERE ghl_contact_id IS NOT NULL;

SELECT 'GHL/CRM schema ready ✓' as result;
