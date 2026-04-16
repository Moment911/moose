-- ── Marketing lead magnet captures ────────────────────────────────────────
-- Backs /api/lead-magnet. Stores every email opt-in from the public site
-- (CRM checklist, CPL calculator, agent playbook, etc.) so we can tally
-- conversion by magnet, page, and referrer without leaving Supabase.

create table if not exists koto_marketing_leads (
  id            uuid         primary key default gen_random_uuid(),
  email         text         not null,
  magnet        text         not null,   -- slug: 'crm-migration-checklist', etc.
  magnet_title  text,                    -- human-readable name snapshot
  page_path     text,                    -- where they captured from
  extra         jsonb        default '{}'::jsonb,  -- optional fields (company, role, phone)
  user_agent    text,
  referrer      text,
  notified_at   timestamptz,             -- set when admin email fires
  created_at    timestamptz  not null default now()
);

create index if not exists idx_marketing_leads_email      on koto_marketing_leads(email);
create index if not exists idx_marketing_leads_magnet     on koto_marketing_leads(magnet);
create index if not exists idx_marketing_leads_created_at on koto_marketing_leads(created_at desc);

-- RLS: service role only. Public writes happen via the API route using the
-- service key; nothing reads this from the client.
alter table koto_marketing_leads enable row level security;

drop policy if exists "service_role_all_marketing_leads" on koto_marketing_leads;
create policy "service_role_all_marketing_leads"
  on koto_marketing_leads
  for all
  to service_role
  using (true)
  with check (true);
