-- 20260519_koto_access_management.sql
-- KotoIQ WP Access Management — per-site role/capability policies.
-- Apply manually via Supabase SQL Editor (prod has migration-tracking drift).

create table if not exists koto_access_policies (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references koto_wp_sites(id) on delete cascade,
  agency_id uuid not null,

  -- Role → feature → grant state. Features are abstract koto-level concepts;
  -- the plugin maps them to concrete WP capabilities at apply time.
  -- Example:
  --   { "administrator": { "php_snippets":"full", "file_editor":"granted", ... },
  --     "editor":        { "php_snippets":"none", "file_editor":"denied",  ... } }
  policy jsonb not null default '{}'::jsonb,

  -- Per-snippet overrides (used by Customized Snippet Access)
  -- { "snippet-id": { "read_roles": ["administrator","editor"], "execute_roles": ["administrator"] } }
  snippet_overrides jsonb not null default '{}'::jsonb,

  -- Bulk toggles (also encoded inside `policy`, but mirrored here for fast lookups)
  file_editor_disabled_globally boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_applied_at timestamptz,
  last_applied_by uuid,

  unique (site_id)
);

create index if not exists idx_koto_access_policies_agency on koto_access_policies(agency_id);

-- Snapshot history — taken just before each apply so we can revert.
create table if not exists koto_access_snapshots (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references koto_wp_sites(id) on delete cascade,
  agency_id uuid not null,
  policy_id uuid references koto_access_policies(id) on delete set null,

  -- Full role+caps capture from the live site at snapshot time.
  -- { "administrator": { "caps": { "edit_themes": true, ... } }, ... }
  snapshot jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  created_by uuid,
  note text
);

create index if not exists idx_koto_access_snapshots_site on koto_access_snapshots(site_id, created_at desc);

-- updated_at trigger
create or replace function koto_access_policies_set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_koto_access_policies_updated_at on koto_access_policies;
create trigger trg_koto_access_policies_updated_at
  before update on koto_access_policies
  for each row execute function koto_access_policies_set_updated_at();

-- RLS — service role bypasses, all access flows through /api/wp
alter table koto_access_policies enable row level security;
alter table koto_access_snapshots enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='koto_access_policies' and policyname='ap_deny_anon') then
    create policy ap_deny_anon on koto_access_policies for all to anon using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where tablename='koto_access_snapshots' and policyname='as_deny_anon') then
    create policy as_deny_anon on koto_access_snapshots for all to anon using (false) with check (false);
  end if;
end $$;
