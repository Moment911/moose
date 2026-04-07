-- ══════════════════════════════════════════════════════════════════════════════
-- KOTO VOICE AGENT SYSTEM
-- Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Voice Agents
CREATE TABLE IF NOT EXISTS koto_voice_agents (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id         uuid REFERENCES agencies(id) ON DELETE CASCADE,
  client_id         uuid REFERENCES clients(id) ON DELETE SET NULL,
  name              text NOT NULL,
  retell_agent_id   text,
  voice_id          text,
  voice_name        text,
  gender            text DEFAULT 'female',
  language          text DEFAULT 'en-US',
  personality       text,
  goal              text,
  script_intro      text,
  script_questions  jsonb DEFAULT '[]',
  script_objections jsonb DEFAULT '[]',
  script_closing    text,
  business_context  text,
  status            text DEFAULT 'active',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- 2. Voice Campaigns
CREATE TABLE IF NOT EXISTS koto_voice_campaigns (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id         uuid REFERENCES agencies(id) ON DELETE CASCADE,
  client_id         uuid REFERENCES clients(id) ON DELETE SET NULL,
  agent_id          uuid REFERENCES koto_voice_agents(id) ON DELETE SET NULL,
  name              text NOT NULL,
  status            text DEFAULT 'draft',
  total_leads       int DEFAULT 0,
  called            int DEFAULT 0,
  answered          int DEFAULT 0,
  appointments_set  int DEFAULT 0,
  callbacks         int DEFAULT 0,
  no_answer         int DEFAULT 0,
  failed            int DEFAULT 0,
  scheduled_start   timestamptz,
  scheduled_end     timestamptz,
  created_at        timestamptz DEFAULT now()
);

-- 3. Voice Leads
CREATE TABLE IF NOT EXISTS koto_voice_leads (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id       uuid REFERENCES koto_voice_campaigns(id) ON DELETE CASCADE,
  agency_id         uuid REFERENCES agencies(id) ON DELETE CASCADE,
  first_name        text,
  last_name         text,
  phone             text NOT NULL,
  business_name     text,
  business_type     text,
  city              text,
  state             text,
  website           text,
  source            text DEFAULT 'csv',
  status            text DEFAULT 'pending',
  call_duration_seconds int,
  recording_url     text,
  transcript        text,
  retell_call_id    text,
  called_at         timestamptz,
  callback_time     timestamptz,
  notes             text,
  created_at        timestamptz DEFAULT now()
);

-- 4. Voice Calls
CREATE TABLE IF NOT EXISTS koto_voice_calls (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id             uuid REFERENCES koto_voice_leads(id) ON DELETE CASCADE,
  campaign_id         uuid REFERENCES koto_voice_campaigns(id) ON DELETE CASCADE,
  agency_id           uuid REFERENCES agencies(id) ON DELETE CASCADE,
  retell_call_id      text,
  direction           text DEFAULT 'outbound',
  status              text DEFAULT 'pending',
  duration_seconds    int,
  recording_url       text,
  transcript          text,
  sentiment           text,
  appointment_set     boolean DEFAULT false,
  callback_requested  boolean DEFAULT false,
  ai_summary          text,
  created_at          timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voice_agents_agency ON koto_voice_agents(agency_id);
CREATE INDEX IF NOT EXISTS idx_voice_campaigns_agency ON koto_voice_campaigns(agency_id);
CREATE INDEX IF NOT EXISTS idx_voice_campaigns_agent ON koto_voice_campaigns(agent_id);
CREATE INDEX IF NOT EXISTS idx_voice_leads_campaign ON koto_voice_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_voice_leads_status ON koto_voice_leads(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_voice_leads_phone ON koto_voice_leads(phone);
CREATE INDEX IF NOT EXISTS idx_voice_calls_lead ON koto_voice_calls(lead_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_campaign ON koto_voice_calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_retell ON koto_voice_calls(retell_call_id);

-- RLS
ALTER TABLE koto_voice_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_voice_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_voice_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_voice_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voice_agents_all" ON koto_voice_agents;
CREATE POLICY "voice_agents_all" ON koto_voice_agents FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "voice_campaigns_all" ON koto_voice_campaigns;
CREATE POLICY "voice_campaigns_all" ON koto_voice_campaigns FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "voice_leads_all" ON koto_voice_leads;
CREATE POLICY "voice_leads_all" ON koto_voice_leads FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "voice_calls_all" ON koto_voice_calls;
CREATE POLICY "voice_calls_all" ON koto_voice_calls FOR ALL USING (true) WITH CHECK (true);
