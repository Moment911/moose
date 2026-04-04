-- Client Profiles: comprehensive client data for agency management
create table if not exists client_profiles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references clients(id) on delete cascade,

  -- Business Info
  legal_name text,
  ein text,
  address jsonb default '{}',
  phone text,
  website text,
  industry text,
  founded_date date,
  employee_count text,
  revenue_range text,

  -- Social Media
  social_media jsonb default '{}',

  -- Hosting Info
  hosting jsonb default '{}',

  -- Brand Assets
  brand jsonb default '{}',

  -- Google Accounts
  google_accounts jsonb default '{}',

  -- Marketing Info
  marketing jsonb default '{}',

  -- Contacts
  contacts jsonb default '[]',

  -- Meta
  onboarding_completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Onboarding tokens for shareable public links
create table if not exists onboarding_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  expires_at timestamptz default (now() + interval '30 days'),
  used_at timestamptz,
  created_by text,
  created_at timestamptz default now()
);

create index if not exists idx_client_profiles_client on client_profiles(client_id);
create index if not exists idx_onboarding_tokens_token on onboarding_tokens(token);
create index if not exists idx_onboarding_tokens_client on onboarding_tokens(client_id);

-- Account access checklist
ALTER TABLE clients ADD COLUMN IF NOT EXISTS access_checklist jsonb DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS access_form_token text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS agency_email_override text;

-- Change history for access events
CREATE TABLE IF NOT EXISTS client_change_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  changed_by text NOT NULL,
  changed_by_email text,
  change_type text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  description text,
  staff_note text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_change_history_client_id ON client_change_history(client_id);
CREATE INDEX IF NOT EXISTS idx_client_change_history_type ON client_change_history(client_id, change_type);

-- ── Expand client_profiles with all onboarding fields ────────────────────────
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS business_type text;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS year_founded text;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS num_employees text;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS annual_revenue text;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS contact jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS products_services jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS customers jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS competitors jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS geography jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS cms jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS tracking jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS goals jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS ai_persona jsonb;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS persona_approved boolean DEFAULT false;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS persona_notes text;
