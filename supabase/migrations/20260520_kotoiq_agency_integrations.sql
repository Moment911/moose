-- Phase 8: Client Profile Seeder v2 — per-agency API key / OAuth storage (D-02, D-32)
create table if not exists public.koto_agency_integrations (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references public.agencies(id) on delete cascade,

  integration_kind  text not null
    check (integration_kind in (
      'typeform', 'jotform', 'google_forms',
      'gbp_agency_oauth', 'gbp_client_oauth', 'gbp_places_api'
    )),
  scope_client_id   uuid null references public.clients(id) on delete cascade,
  scope_location    text null,

  encrypted_payload jsonb not null,
  payload_version   int  not null default 1,

  label             text,
  last_tested_at    timestamptz,
  last_tested_ok    boolean,
  last_test_error   text,

  created_at        timestamptz not null default now(),
  created_by        uuid,
  updated_at        timestamptz not null default now(),

  constraint uq_agency_integration unique (agency_id, integration_kind, scope_client_id)
);

create index if not exists idx_agency_integrations_agency on public.koto_agency_integrations(agency_id);
create index if not exists idx_agency_integrations_kind on public.koto_agency_integrations(agency_id, integration_kind);

alter table public.koto_agency_integrations enable row level security;
drop policy if exists "agency_integrations_all" on public.koto_agency_integrations;
create policy "agency_integrations_all" on public.koto_agency_integrations
  for all using (true) with check (true);

-- Per-table updated_at trigger (mirrors 20260507 precedent — per Phase 7 Plan 1 STATE log: "Per-table updated_at trigger function pattern")
create or replace function public.koto_agency_integrations_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists trg_agency_integrations_updated on public.koto_agency_integrations;
create trigger trg_agency_integrations_updated before update on public.koto_agency_integrations
  for each row execute function public.koto_agency_integrations_set_updated_at();

comment on table public.koto_agency_integrations is
  'Phase 8: encrypted per-agency API keys + OAuth tokens for Typeform/Jotform/Google Forms/GBP. encrypted_payload uses Supabase Vault OR Node-side AES-256-GCM envelope (see src/lib/kotoiq/profileIntegrationsVault.ts in Plan 03).';
