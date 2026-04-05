ALTER TABLE clients ADD COLUMN IF NOT EXISTS sic_code text;
CREATE INDEX IF NOT EXISTS idx_clients_sic ON clients(sic_code);
