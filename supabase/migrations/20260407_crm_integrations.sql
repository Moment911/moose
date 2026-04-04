-- ══════════════════════════════════════════════════════════════════════════════
-- CRM Integrations — GHL, HubSpot, Salesforce, Zapier, etc.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crm_integrations (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id       uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  provider        text NOT NULL, -- 'gohighlevel'|'hubspot'|'salesforce'|'zapier'|'make'|'custom'
  name            text NOT NULL, -- display name e.g. "My GHL Account"
  status          text NOT NULL DEFAULT 'disconnected', -- 'connected'|'disconnected'|'error'|'syncing'
  -- OAuth tokens (encrypted)
  access_token    text,
  refresh_token   text,
  token_expires_at timestamptz,
  -- Connection details
  location_id     text,   -- GHL sub-account/location ID
  company_id      text,   -- GHL company ID
  webhook_secret  text,   -- for verifying inbound webhooks
  -- Config
  config          jsonb DEFAULT '{}',   -- provider-specific settings
  sync_settings   jsonb DEFAULT '{}',   -- what to sync and how
  -- Stats
  last_sync_at    timestamptz,
  last_error      text,
  total_synced    int DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_sync_log (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id uuid NOT NULL REFERENCES crm_integrations(id) ON DELETE CASCADE,
  agency_id     uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id     uuid REFERENCES clients(id) ON DELETE SET NULL,
  direction     text NOT NULL, -- 'push'|'pull'|'webhook'
  entity_type   text NOT NULL, -- 'contact'|'opportunity'|'appointment'|'note'|'tag'
  entity_id     text,          -- external ID in the CRM
  moose_id      uuid,          -- local ID in Moose
  action        text NOT NULL, -- 'create'|'update'|'delete'|'skip'
  status        text NOT NULL DEFAULT 'success', -- 'success'|'error'|'skipped'
  payload       jsonb DEFAULT '{}',
  error_msg     text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_integrations_agency ON crm_integrations(agency_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_log_integration ON crm_sync_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_log_created ON crm_sync_log(created_at DESC);

-- Map Moose clients to external CRM contacts
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ghl_contact_id text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ghl_location_id text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hubspot_contact_id text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS crm_external_ids jsonb DEFAULT '{}';
