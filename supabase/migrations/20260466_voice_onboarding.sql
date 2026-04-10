-- Voice onboarding — Retell conducts the onboarding interview by phone.
--
-- agencies.onboarding_phone_number / onboarding_agent_id let each agency
-- designate a Retell-backed number as the onboarding line. Inbound calls to
-- that number route to the dedicated onboarding Retell agent instead of the
-- regular answering service.
--
-- koto_onboarding_recipients tracks every caller (or web visitor) that
-- contributed to a client's onboarding doc. A single client can have many
-- recipients (owner + ops manager + marketing coordinator all calling back
-- at different times). Each row stores who they were, which fields they
-- answered, and whether they completed their section.

alter table if exists agencies
  add column if not exists onboarding_phone_number text,
  add column if not exists onboarding_agent_id text;

create table if not exists koto_onboarding_recipients (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null,
  client_id       uuid not null,
  name            text,
  email           text,
  phone           text,
  title           text,
  role_label      text,
  -- 'web' | 'voice' | 'email' | 'agency_override'
  source          text not null default 'web',
  -- 'in_progress' | 'complete' | 'abandoned'
  status          text not null default 'in_progress',
  -- Retell call id when source = 'voice'
  call_id         text,
  -- Token used by the web flow when source = 'web'
  token           text,
  -- Full answers with metadata: { [field]: { answer, confidence, call_id, answered_at } }
  answers         jsonb not null default '{}'::jsonb,
  -- Simple set of field ids captured by this recipient (for fast counts)
  fields_captured jsonb not null default '{}'::jsonb,
  last_active_at  timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists koto_onboarding_recipients_client_idx
  on koto_onboarding_recipients (client_id, last_active_at desc);

create index if not exists koto_onboarding_recipients_agency_idx
  on koto_onboarding_recipients (agency_id, created_at desc);

create index if not exists koto_onboarding_recipients_call_idx
  on koto_onboarding_recipients (call_id);

-- Permissive RLS: this table is written by the server-side webhook and read
-- by the agency's own ClientDetailPage. Service role bypasses RLS on both.
alter table koto_onboarding_recipients enable row level security;

drop policy if exists koto_onboarding_recipients_read on koto_onboarding_recipients;
create policy koto_onboarding_recipients_read
  on koto_onboarding_recipients for select
  using (true);

drop policy if exists koto_onboarding_recipients_write on koto_onboarding_recipients;
create policy koto_onboarding_recipients_write
  on koto_onboarding_recipients for all
  using (true)
  with check (true);
