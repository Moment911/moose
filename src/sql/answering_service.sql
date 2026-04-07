-- ══════════════════════════════════════════════════════════════════════════════
-- KOTO ANSWERING SERVICE
-- Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS koto_inbound_agents (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id         uuid,
  client_id         uuid,
  name              text NOT NULL,
  department        text DEFAULT 'main',
  retell_agent_id   text,
  voice_id          text,
  voice_name        text,
  phone_number      text,
  phone_number_id   text,
  phone_source      text DEFAULT 'koto',
  sic_code          text,
  industry          text,
  greeting_script   text,
  open_hours_script text,
  closed_hours_script text,
  emergency_script  text,
  voicemail_script  text,
  intake_template   text DEFAULT 'general',
  intake_questions  jsonb DEFAULT '[]',
  business_hours    jsonb DEFAULT '{}',
  timezone          text DEFAULT 'America/New_York',
  emergency_keywords text[] DEFAULT ARRAY['emergency','urgent','fire','flood','leak','accident'],
  hipaa_mode        boolean DEFAULT false,
  recording_enabled boolean DEFAULT true,
  sms_notifications boolean DEFAULT true,
  email_notifications boolean DEFAULT true,
  notification_email text,
  notification_phone text,
  status            text DEFAULT 'active',
  total_calls       int DEFAULT 0,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS koto_inbound_calls (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id          uuid REFERENCES koto_inbound_agents(id) ON DELETE CASCADE,
  agency_id         uuid,
  client_id         uuid,
  retell_call_id    text,
  caller_phone      text,
  caller_name       text,
  duration_seconds  int,
  urgency           text DEFAULT 'normal',
  outcome           text DEFAULT 'message',
  sentiment         text DEFAULT 'neutral',
  recording_url     text,
  transcript        text,
  ai_summary        text,
  intake_data       jsonb DEFAULT '{}',
  sms_sent          boolean DEFAULT false,
  email_sent        boolean DEFAULT false,
  follow_up_notes   text,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS koto_inbound_intakes (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id           uuid REFERENCES koto_inbound_calls(id) ON DELETE CASCADE,
  agent_id          uuid,
  question          text NOT NULL,
  answer            text,
  question_type     text DEFAULT 'text',
  sort_order        int DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS koto_inbound_phone_numbers (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id         uuid,
  agent_id          uuid,
  phone_number      text NOT NULL,
  retell_number_id  text,
  area_code         text,
  status            text DEFAULT 'active',
  created_at        timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inbound_agents_agency ON koto_inbound_agents(agency_id);
CREATE INDEX IF NOT EXISTS idx_inbound_agents_client ON koto_inbound_agents(client_id);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_agent ON koto_inbound_calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_agency ON koto_inbound_calls(agency_id);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_created ON koto_inbound_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_intakes_call ON koto_inbound_intakes(call_id);
CREATE INDEX IF NOT EXISTS idx_inbound_phones_agency ON koto_inbound_phone_numbers(agency_id);

-- RLS
ALTER TABLE koto_inbound_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_inbound_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_inbound_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_inbound_phone_numbers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inbound_agents_all" ON koto_inbound_agents;
CREATE POLICY "inbound_agents_all" ON koto_inbound_agents FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "inbound_calls_all" ON koto_inbound_calls;
CREATE POLICY "inbound_calls_all" ON koto_inbound_calls FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "inbound_intakes_all" ON koto_inbound_intakes;
CREATE POLICY "inbound_intakes_all" ON koto_inbound_intakes FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "inbound_phones_all" ON koto_inbound_phone_numbers;
CREATE POLICY "inbound_phones_all" ON koto_inbound_phone_numbers FOR ALL USING (true) WITH CHECK (true);
