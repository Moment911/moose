-- KotoFin Pro tables
-- Run this in your Supabase SQL editor

create table if not exists kotofin_transactions (
  id bigint primary key generated always as identity,
  client_id uuid references clients(id) on delete cascade,
  agency_id uuid,
  file text not null default '',
  bank text not null default '',
  account text not null default '',
  range text not null default '',
  date text not null default '',
  description text not null default '',
  amount numeric not null default 0,
  company text not null default '',
  category text not null default '',
  code text not null default '',
  type text not null default 'uncategorized',
  ai_tagged boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_kotofin_txn_client on kotofin_transactions(client_id);
create index if not exists idx_kotofin_txn_agency on kotofin_transactions(agency_id);

create table if not exists kotofin_files (
  id bigint primary key generated always as identity,
  client_id uuid references clients(id) on delete cascade,
  agency_id uuid,
  name text not null default '',
  bank text not null default '',
  account text not null default '',
  range text not null default '',
  color text not null default '#888888',
  txn_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_kotofin_files_client on kotofin_files(client_id);

create table if not exists kotofin_tax_profiles (
  id bigint primary key generated always as identity,
  client_id uuid unique references clients(id) on delete cascade,
  agency_id uuid,
  profile jsonb not null default '{}',
  company_profile jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_kotofin_profiles_client on kotofin_tax_profiles(client_id);

-- RLS policies
alter table kotofin_transactions enable row level security;
alter table kotofin_files enable row level security;

create policy "Users can manage their agency kotofin transactions"
  on kotofin_transactions for all
  using (true)
  with check (true);

create policy "Users can manage their agency kotofin files"
  on kotofin_files for all
  using (true)
  with check (true);

alter table kotofin_tax_profiles enable row level security;

create policy "Users can manage their agency kotofin tax profiles"
  on kotofin_tax_profiles for all
  using (true)
  with check (true);
