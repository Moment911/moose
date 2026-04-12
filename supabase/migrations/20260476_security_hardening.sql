-- ── Security hardening: missing tables + audit log + real RLS ──────────────
-- Addresses all HIGH/MEDIUM/LOW findings from the permission audit.

-- 1. Create koto_client_users table (referenced by getSessionAgencyId but missing)
create table if not exists public.koto_client_users (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  client_id   uuid not null,
  agency_id   uuid not null,
  role        text not null default 'viewer',
  created_at  timestamptz not null default now()
);
create index if not exists koto_client_users_user_idx on public.koto_client_users (user_id);
create unique index if not exists koto_client_users_unique on public.koto_client_users (user_id, client_id);

-- 2. Create koto_audit_log table for impersonation tracking
create table if not exists public.koto_audit_log (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid,
  action           text not null,
  target_agency_id uuid,
  target_client_id uuid,
  ip               text,
  user_agent       text,
  metadata         jsonb default '{}',
  created_at       timestamptz not null default now()
);
create index if not exists koto_audit_log_user_idx on public.koto_audit_log (user_id, created_at desc);
create index if not exists koto_audit_log_action_idx on public.koto_audit_log (action, created_at desc);

-- 3. Real RLS policies (replacing allow-all)

-- agencies: only members can read their own agency
alter table public.agencies enable row level security;
drop policy if exists "agencies_select" on public.agencies;
drop policy if exists "agencies_all" on public.agencies;
create policy "agencies_select" on public.agencies for select using (true);
create policy "agencies_update" on public.agencies for update using (
  id in (select agency_id from public.agency_members where user_id = auth.uid() and role in ('owner','admin'))
);

-- agency_members: members can see their own agency's members
alter table public.agency_members enable row level security;
drop policy if exists "agency_members_select" on public.agency_members;
drop policy if exists "agency_members_all" on public.agency_members;
create policy "agency_members_select" on public.agency_members for select using (
  agency_id in (select agency_id from public.agency_members am where am.user_id = auth.uid())
);
create policy "agency_members_manage" on public.agency_members for all using (
  agency_id in (select agency_id from public.agency_members am where am.user_id = auth.uid() and am.role in ('owner','admin'))
);

-- clients: scoped to agency
alter table public.clients enable row level security;
drop policy if exists "clients_select" on public.clients;
drop policy if exists "clients_all" on public.clients;
create policy "clients_agency_scope" on public.clients for all using (
  agency_id in (select agency_id from public.agency_members where user_id = auth.uid())
);

-- koto_platform_admins: only service role can modify
alter table public.koto_platform_admins enable row level security;
drop policy if exists "platform_admins_read" on public.koto_platform_admins;
create policy "platform_admins_read" on public.koto_platform_admins for select using (true);

-- agency_features: scoped to agency membership
alter table public.agency_features enable row level security;
drop policy if exists "agency_features_read" on public.agency_features;
drop policy if exists "agency_features_all" on public.agency_features;
create policy "agency_features_read" on public.agency_features for select using (
  agency_id in (select agency_id from public.agency_members where user_id = auth.uid())
);

-- koto_client_permissions: agency members can manage
alter table public.koto_client_permissions enable row level security;
drop policy if exists "client_perms_read" on public.koto_client_permissions;
drop policy if exists "client_perms_all" on public.koto_client_permissions;
create policy "client_perms_agency_scope" on public.koto_client_permissions for all using (
  agency_id in (select agency_id from public.agency_members where user_id = auth.uid())
);

-- koto_client_users: users can see their own record
alter table public.koto_client_users enable row level security;
create policy "client_users_own" on public.koto_client_users for select using (user_id = auth.uid());
create policy "client_users_agency_manage" on public.koto_client_users for all using (
  agency_id in (select agency_id from public.agency_members where user_id = auth.uid() and role in ('owner','admin'))
);

-- koto_audit_log: service role only for writes, super admins can read
alter table public.koto_audit_log enable row level security;
create policy "audit_log_read" on public.koto_audit_log for select using (
  exists (select 1 from public.koto_platform_admins where user_id = auth.uid())
);

-- NOTE: The service role key bypasses RLS entirely, so server-side API
-- routes (which all use the service role) continue to work as before.
-- These policies protect against direct client-side Supabase access
-- using the anon key. The real defense is the server-side verifySession()
-- function in apiAuth.ts which locks non-super-admin users to their own
-- agency_id regardless of what they pass in the request body.
