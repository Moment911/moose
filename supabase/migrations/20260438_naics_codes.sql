-- Add NAICS code fields to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS naics_code text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS naics_title text;
CREATE INDEX IF NOT EXISTS idx_clients_naics ON clients(naics_code);
