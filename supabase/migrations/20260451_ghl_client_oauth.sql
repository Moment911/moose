-- Per-client GHL OAuth tokens
ALTER TABLE koto_ghl_client_mappings ADD COLUMN IF NOT EXISTS access_token text;
ALTER TABLE koto_ghl_client_mappings ADD COLUMN IF NOT EXISTS refresh_token text;
ALTER TABLE koto_ghl_client_mappings ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;
ALTER TABLE koto_ghl_client_mappings ADD COLUMN IF NOT EXISTS company_id text;
ALTER TABLE koto_ghl_client_mappings ADD COLUMN IF NOT EXISTS connection_type text DEFAULT 'oauth';
ALTER TABLE koto_ghl_client_mappings ADD COLUMN IF NOT EXISTS contacts_synced int DEFAULT 0;
ALTER TABLE koto_ghl_client_mappings ADD COLUMN IF NOT EXISTS calls_synced int DEFAULT 0;
