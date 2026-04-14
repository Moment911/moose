ALTER TABLE automations ADD COLUMN IF NOT EXISTS last_run_at timestamptz;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS run_count int DEFAULT 0;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
