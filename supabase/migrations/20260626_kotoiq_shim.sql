-- ============================================================================
-- KotoIQ WP plugin thin-shim pivot — Phase 10 foundation
--
-- Adds 4 new tables (templates, push history, dual-run log, pairing audit)
-- and extends koto_wp_sites with 9 shim-pivot columns.
--
-- All tables enforce agency-only RLS mirroring koto_wp_sites.
-- ============================================================================

-- ─── A. Extend koto_wp_sites with shim-pivot columns ──────────────────────
alter table public.koto_wp_sites
    add column if not exists shim_version text,
    add column if not exists dashboard_pubkey_fingerprint text,
    add column if not exists paired_at_v4 timestamptz,
    add column if not exists app_password_username text,
    add column if not exists app_password_encrypted text,
    add column if not exists app_password_payload_version int default 1,
    add column if not exists dual_run_state text default 'inactive',
    add column if not exists dual_run_started_at timestamptz,
    add column if not exists v4_promoted_at timestamptz;

comment on column public.koto_wp_sites.shim_version is 'null=pre-pair, v3=legacy plugin, v4=thin-shim';
comment on column public.koto_wp_sites.dashboard_pubkey_fingerprint is 'sha256 hex of dashboard pubkey we paired with — rotation detection';
comment on column public.koto_wp_sites.dual_run_state is 'inactive|active|promoted|rolled_back';

-- ─── B. koto_wp_templates — Option B capture-and-push templates ───────────
create table if not exists public.koto_wp_templates (
    id uuid primary key default gen_random_uuid(),
    agency_id uuid not null,
    source_site_id uuid not null references public.koto_wp_sites(id) on delete cascade,
    source_post_id bigint not null,
    name text not null,
    description text,
    elementor_data jsonb not null,
    variable_schema jsonb not null,
    seo_meta_template jsonb,
    taxonomy_template jsonb,
    captured_at timestamptz not null default now(),
    captured_by uuid,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_koto_wp_templates_agency_archived
    on public.koto_wp_templates (agency_id, archived_at);
create index if not exists idx_koto_wp_templates_source_site
    on public.koto_wp_templates (source_site_id);

alter table public.koto_wp_templates enable row level security;
drop policy if exists "agency_only_templates" on public.koto_wp_templates;
create policy "agency_only_templates" on public.koto_wp_templates
    for all using (agency_id = (auth.jwt() ->> 'agency_id')::uuid)
    with check (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

-- Per-table updated_at trigger (Phase 7 canonical pattern)
create or replace function public.set_koto_wp_templates_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_koto_wp_templates_updated_at on public.koto_wp_templates;
create trigger trg_koto_wp_templates_updated_at
    before update on public.koto_wp_templates
    for each row execute function public.set_koto_wp_templates_updated_at();

-- ─── C. koto_wp_push_history — every template push ────────────────────────
create table if not exists public.koto_wp_push_history (
    id uuid primary key default gen_random_uuid(),
    agency_id uuid not null,
    template_id uuid not null references public.koto_wp_templates(id) on delete cascade,
    target_site_id uuid not null references public.koto_wp_sites(id) on delete cascade,
    pushed_post_id bigint,
    pushed_post_url text,
    variable_values jsonb not null,
    rendered_elementor_data jsonb,
    rendered_seo_meta jsonb,
    idempotency_key text not null,
    status text not null default 'pending',
    error_code text,
    error_message text,
    pushed_at timestamptz,
    pushed_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint koto_wp_push_history_target_idempotency_unique
        unique (target_site_id, idempotency_key)
);

create index if not exists idx_koto_wp_push_history_agency_status
    on public.koto_wp_push_history (agency_id, status);
create index if not exists idx_koto_wp_push_history_template_target
    on public.koto_wp_push_history (template_id, target_site_id);
create index if not exists idx_koto_wp_push_history_target_pushed_at
    on public.koto_wp_push_history (target_site_id, pushed_at desc);

alter table public.koto_wp_push_history enable row level security;
drop policy if exists "agency_only_push_history" on public.koto_wp_push_history;
create policy "agency_only_push_history" on public.koto_wp_push_history
    for all using (agency_id = (auth.jwt() ->> 'agency_id')::uuid)
    with check (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

create or replace function public.set_koto_wp_push_history_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_koto_wp_push_history_updated_at on public.koto_wp_push_history;
create trigger trg_koto_wp_push_history_updated_at
    before update on public.koto_wp_push_history
    for each row execute function public.set_koto_wp_push_history_updated_at();

-- ─── D. koto_wp_dual_run_log — shadow-mode diff log (append-only) ─────────
create table if not exists public.koto_wp_dual_run_log (
    id uuid primary key default gen_random_uuid(),
    agency_id uuid not null,
    site_id uuid not null references public.koto_wp_sites(id) on delete cascade,
    verb text not null,
    legacy_endpoint text,
    args_hash text not null,
    v3_response_hash text,
    v4_response_hash text,
    diff_status text not null,
    diff_summary jsonb,
    latency_v3_ms int,
    latency_v4_ms int,
    called_at timestamptz not null default now()
);

create index if not exists idx_koto_wp_dual_run_log_site_called
    on public.koto_wp_dual_run_log (site_id, called_at desc);
create index if not exists idx_koto_wp_dual_run_log_agency_status
    on public.koto_wp_dual_run_log (agency_id, diff_status, called_at desc);

alter table public.koto_wp_dual_run_log enable row level security;
drop policy if exists "agency_only_dual_run_log" on public.koto_wp_dual_run_log;
create policy "agency_only_dual_run_log" on public.koto_wp_dual_run_log
    for all using (agency_id = (auth.jwt() ->> 'agency_id')::uuid)
    with check (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

comment on column public.koto_wp_dual_run_log.args_hash is 'sha256 of args JSON — never store full args (may contain post content)';
comment on table public.koto_wp_dual_run_log is 'Append-only diff log. NO updated_at trigger. Partition deferred to M2 when fleet >100 sites.';

-- ─── E. koto_wp_shim_pairings — per-site pairing audit (append-only) ──────
create table if not exists public.koto_wp_shim_pairings (
    id uuid primary key default gen_random_uuid(),
    agency_id uuid not null,
    site_id uuid not null references public.koto_wp_sites(id) on delete cascade,
    event text not null,
    dashboard_pubkey_fingerprint text,
    notes jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_koto_wp_shim_pairings_site_created
    on public.koto_wp_shim_pairings (site_id, created_at desc);

alter table public.koto_wp_shim_pairings enable row level security;
drop policy if exists "agency_only_shim_pairings" on public.koto_wp_shim_pairings;
create policy "agency_only_shim_pairings" on public.koto_wp_shim_pairings
    for all using (agency_id = (auth.jwt() ->> 'agency_id')::uuid)
    with check (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

comment on column public.koto_wp_shim_pairings.event is 'pair_started|pair_completed|pair_failed|app_password_issued|promoted_to_v4|rolled_back|unpaired';
comment on table public.koto_wp_shim_pairings is 'Append-only pairing audit log. NO updated_at trigger.';

-- ============================================================================
-- MANUAL APPLICATION REQUIRED (per CLAUDE.md memory: kotoiq_supabase_migrations)
--
-- DO NOT run `supabase db push`. Prod has tracking drift.
--
-- TO APPLY:
--   1. Open Supabase SQL Editor for the prod project
--   2. Paste this entire file
--   3. Run
--   4. Verify with the queries below
--
-- Verification queries:
--   select column_name from information_schema.columns
--     where table_name = 'koto_wp_sites' and column_name = 'shim_version';
--   -- expected: 1 row
--
--   select table_name from information_schema.tables
--     where table_name in ('koto_wp_templates', 'koto_wp_push_history',
--                          'koto_wp_dual_run_log', 'koto_wp_shim_pairings');
--   -- expected: 4 rows
-- ============================================================================
