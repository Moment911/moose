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
