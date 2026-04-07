CREATE TABLE IF NOT EXISTS koto_inbound_callers (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid,
  phone text not null,
  name text,
  email text,
  total_calls integer default 1,
  first_call_at timestamptz default now(),
  last_call_at timestamptz default now(),
  notes text,
  tags text[] default '{}',
  last_reason_for_call text,
  last_agent_id uuid,
  unique(agency_id, phone)
);

ALTER TABLE koto_voice_leads
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS dnc_status text default 'unchecked',
  ADD COLUMN IF NOT EXISTS dnc_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempted_outside_hours boolean default false,
  ADD COLUMN IF NOT EXISTS transfer_requested boolean default false,
  ADD COLUMN IF NOT EXISTS transfer_completed boolean default false,
  ADD COLUMN IF NOT EXISTS pre_call_research jsonb default '{}',
  ADD COLUMN IF NOT EXISTS conversation_intelligence jsonb default '{}';

ALTER TABLE koto_voice_calls
  ADD COLUMN IF NOT EXISTS coaching_report jsonb default '{}',
  ADD COLUMN IF NOT EXISTS conversation_intelligence jsonb default '{}',
  ADD COLUMN IF NOT EXISTS transfer_requested boolean default false,
  ADD COLUMN IF NOT EXISTS transfer_completed boolean default false;

ALTER TABLE koto_voice_agents
  ADD COLUMN IF NOT EXISTS personality_profile jsonb default '{}',
  ADD COLUMN IF NOT EXISTS transfer_phone text,
  ADD COLUMN IF NOT EXISTS transfer_enabled boolean default false,
  ADD COLUMN IF NOT EXISTS local_presence_enabled boolean default false,
  ADD COLUMN IF NOT EXISTS amd_enabled boolean default true;

ALTER TABLE koto_inbound_agents
  ADD COLUMN IF NOT EXISTS ivr_enabled boolean default false,
  ADD COLUMN IF NOT EXISTS ivr_config jsonb default '{}',
  ADD COLUMN IF NOT EXISTS auto_callback_enabled boolean default false,
  ADD COLUMN IF NOT EXISTS auto_callback_delay_minutes integer default 5,
  ADD COLUMN IF NOT EXISTS auto_callback_max_attempts integer default 2;

ALTER TABLE koto_voice_appointments
  ADD COLUMN IF NOT EXISTS deal_closed boolean default false,
  ADD COLUMN IF NOT EXISTS deal_value numeric,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closure_notes text,
  ADD COLUMN IF NOT EXISTS close_probability integer;
