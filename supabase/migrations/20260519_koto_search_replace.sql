-- 20260519_koto_search_replace.sql
-- KotoIQ WP Search & Replace — jobs + undo journal.
-- Apply manually via Supabase SQL Editor (prod has migration-tracking drift).

create table if not exists koto_search_replace_jobs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references koto_wp_sites(id) on delete cascade,
  agency_id uuid not null,
  client_id uuid,

  search text not null,
  replace_with text not null,
  options jsonb not null default '{}'::jsonb,
  scope jsonb not null default '{}'::jsonb,

  status text not null default 'preview',
  is_dry_run boolean not null default true,

  total_rows_scanned bigint not null default 0,
  total_matches int not null default 0,
  total_replacements int not null default 0,
  total_rows_changed int not null default 0,
  total_tables int not null default 0,
  tables_completed int not null default 0,

  current_table text,
  current_table_index int not null default 0,
  current_offset bigint not null default 0,

  created_by uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  error text
);

create index if not exists idx_koto_sr_jobs_site on koto_search_replace_jobs(site_id, created_at desc);
create index if not exists idx_koto_sr_jobs_agency on koto_search_replace_jobs(agency_id, created_at desc);
create index if not exists idx_koto_sr_jobs_status on koto_search_replace_jobs(status);

create table if not exists koto_search_replace_changes (
  id bigserial primary key,
  job_id uuid not null references koto_search_replace_jobs(id) on delete cascade,
  agency_id uuid not null,

  table_name text not null,
  primary_key_column text not null,
  primary_key_value text not null,
  column_name text not null,

  before_value text not null,
  after_value text not null,

  is_restored boolean not null default false,
  replaced_at timestamptz not null default now()
);

create index if not exists idx_koto_sr_changes_job on koto_search_replace_changes(job_id);
create index if not exists idx_koto_sr_changes_agency on koto_search_replace_changes(agency_id);

-- updated_at trigger for jobs
create or replace function koto_sr_jobs_updated_at() returns trigger as $$
begin
  return new;
end;
$$ language plpgsql;

-- RLS — service role bypasses, all reads/writes flow through /api/wp
alter table koto_search_replace_jobs enable row level security;
alter table koto_search_replace_changes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='koto_search_replace_jobs' and policyname='sr_jobs_deny_anon') then
    create policy sr_jobs_deny_anon on koto_search_replace_jobs for all to anon using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where tablename='koto_search_replace_changes' and policyname='sr_changes_deny_anon') then
    create policy sr_changes_deny_anon on koto_search_replace_changes for all to anon using (false) with check (false);
  end if;
end $$;
