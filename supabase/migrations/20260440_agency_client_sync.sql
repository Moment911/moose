-- Agency/Client data model sync

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS owner_name text;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS owner_email text;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS plan text DEFAULT 'starter';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS zip text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes text;
