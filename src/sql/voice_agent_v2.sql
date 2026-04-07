-- ══════════════════════════════════════════════════════════════════════════════
-- VOICE AGENT INTELLIGENCE PLATFORM v2
-- Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Voice Appointments
CREATE TABLE IF NOT EXISTS koto_voice_appointments (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id         uuid,
  client_id         uuid,
  lead_id           uuid,
  campaign_id       uuid,
  agent_id          uuid,
  appointment_date  date NOT NULL,
  appointment_time  time NOT NULL,
  appointment_datetime timestamptz,
  timezone          text DEFAULT 'America/New_York',
  duration_minutes  int DEFAULT 30,
  status            text DEFAULT 'scheduled',
  confirmation_sent boolean DEFAULT false,
  reminder_24h_sent boolean DEFAULT false,
  reminder_1h_sent  boolean DEFAULT false,
  prospect_name     text,
  prospect_phone    text,
  prospect_email    text,
  prospect_business text,
  notes             text,
  google_event_id   text,
  created_at        timestamptz DEFAULT now()
);

-- 2. TCPA Compliance Records
CREATE TABLE IF NOT EXISTS koto_voice_tcpa_records (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id       uuid,
  lead_id         uuid,
  phone           text NOT NULL,
  consent_phone   boolean DEFAULT false,
  consent_sms     boolean DEFAULT false,
  consent_email   boolean DEFAULT false,
  consent_method  text DEFAULT 'verbal',
  consent_timestamp timestamptz,
  opt_out         boolean DEFAULT false,
  opt_out_timestamp timestamptz,
  dnc_checked     boolean DEFAULT false,
  dnc_result      text,
  dnc_checked_at  timestamptz,
  recording_url   text,
  call_id         uuid,
  compliance_score int,
  flags           jsonb DEFAULT '[]',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 3. Voice Intelligence (AI learning)
CREATE TABLE IF NOT EXISTS koto_voice_intelligence (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id       uuid,
  agent_id        uuid,
  analysis_type   text NOT NULL,
  insights        jsonb DEFAULT '{}',
  recommendations jsonb DEFAULT '[]',
  what_works      jsonb DEFAULT '[]',
  what_fails      jsonb DEFAULT '[]',
  best_times      jsonb DEFAULT '{}',
  script_scores   jsonb DEFAULT '{}',
  calls_analyzed  int DEFAULT 0,
  period_start    timestamptz,
  period_end      timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- 4. Voice Test Results
CREATE TABLE IF NOT EXISTS koto_voice_test_results (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id       uuid,
  agent_id        uuid,
  test_type       text NOT NULL,
  test_config     jsonb DEFAULT '{}',
  results         jsonb DEFAULT '{}',
  score           int,
  compliance_issues jsonb DEFAULT '[]',
  improvements    jsonb DEFAULT '[]',
  tested_by       text,
  created_at      timestamptz DEFAULT now()
);

-- 5. Calendar Settings
CREATE TABLE IF NOT EXISTS koto_voice_calendar_settings (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id       uuid NOT NULL UNIQUE,
  availability    jsonb DEFAULT '{"mon":{"enabled":true,"start":"09:00","end":"17:00"},"tue":{"enabled":true,"start":"09:00","end":"17:00"},"wed":{"enabled":true,"start":"09:00","end":"17:00"},"thu":{"enabled":true,"start":"09:00","end":"17:00"},"fri":{"enabled":true,"start":"09:00","end":"17:00"},"sat":{"enabled":false},"sun":{"enabled":false}}',
  timezone        text DEFAULT 'America/New_York',
  slot_duration   int DEFAULT 30,
  buffer_minutes  int DEFAULT 15,
  google_token    jsonb,
  google_connected boolean DEFAULT false,
  sms_confirmation boolean DEFAULT true,
  email_confirmation boolean DEFAULT true,
  reminder_24h    boolean DEFAULT true,
  reminder_1h     boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 6. ALTER koto_voice_leads — add comprehensive tracking columns
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS industry_sic_code text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS industry_name text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS company_size_estimate text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS geographic_region text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS local_time_of_call text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS day_of_week_called text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS attempt_number int DEFAULT 1;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS previous_outcome text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS lead_source text DEFAULT 'csv';
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS call_answer_delay_seconds int;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS talk_time_seconds int;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS listen_time_seconds int;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS talk_listen_ratio numeric(4,2);
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS interruptions_count int DEFAULT 0;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS sentiment_start text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS sentiment_middle text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS sentiment_end text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS sentiment_trajectory text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS objections_raised jsonb DEFAULT '[]';
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS objections_overcome jsonb DEFAULT '[]';
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS questions_asked_by_prospect int DEFAULT 0;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS appointment_offered boolean DEFAULT false;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS appointment_accepted boolean DEFAULT false;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS appointment_datetime timestamptz;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS email_captured text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS consent_phone boolean;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS consent_sms boolean;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS consent_email boolean;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS transcript_full text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS transcript_summary text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS key_moments jsonb DEFAULT '[]';
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS script_section_where_lost text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS competitor_mentioned text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS price_mentioned boolean DEFAULT false;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS price_reaction text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS buying_signals jsonb DEFAULT '[]';
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS red_flags jsonb DEFAULT '[]';
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS ai_lead_score int;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS ai_follow_up_recommendation text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS ai_coaching_note text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false;

-- 7. Add business context to agents
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS sic_code text;
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS business_description text;
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS target_customer text;
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS problem_solved text;
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS differentiator text;
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS service_area text;
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS deal_size text;
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS voicemail_script text;
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS tcpa_script text;
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS value_proposition text;
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS conversation_tree jsonb DEFAULT '{}';
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS learning_data jsonb DEFAULT '{}';

-- Add test mode to campaigns
ALTER TABLE koto_voice_campaigns ADD COLUMN IF NOT EXISTS is_test_mode boolean DEFAULT false;
ALTER TABLE koto_voice_campaigns ADD COLUMN IF NOT EXISTS test_phone text;

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_voice_appointments_agency ON koto_voice_appointments(agency_id);
CREATE INDEX IF NOT EXISTS idx_voice_appointments_date ON koto_voice_appointments(appointment_datetime);
CREATE INDEX IF NOT EXISTS idx_voice_appointments_lead ON koto_voice_appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_voice_tcpa_phone ON koto_voice_tcpa_records(phone);
CREATE INDEX IF NOT EXISTS idx_voice_tcpa_agency ON koto_voice_tcpa_records(agency_id);
CREATE INDEX IF NOT EXISTS idx_voice_intel_agency ON koto_voice_intelligence(agency_id);
CREATE INDEX IF NOT EXISTS idx_voice_intel_agent ON koto_voice_intelligence(agent_id);
CREATE INDEX IF NOT EXISTS idx_voice_test_agency ON koto_voice_test_results(agency_id);
CREATE INDEX IF NOT EXISTS idx_voice_leads_sic ON koto_voice_leads(industry_sic_code);
CREATE INDEX IF NOT EXISTS idx_voice_leads_test ON koto_voice_leads(is_test);

-- 9. RLS
ALTER TABLE koto_voice_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_voice_tcpa_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_voice_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_voice_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_voice_calendar_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voice_appt_all" ON koto_voice_appointments;
CREATE POLICY "voice_appt_all" ON koto_voice_appointments FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "voice_tcpa_all" ON koto_voice_tcpa_records;
CREATE POLICY "voice_tcpa_all" ON koto_voice_tcpa_records FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "voice_intel_all" ON koto_voice_intelligence;
CREATE POLICY "voice_intel_all" ON koto_voice_intelligence FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "voice_test_all" ON koto_voice_test_results;
CREATE POLICY "voice_test_all" ON koto_voice_test_results FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "voice_cal_all" ON koto_voice_calendar_settings;
CREATE POLICY "voice_cal_all" ON koto_voice_calendar_settings FOR ALL USING (true) WITH CHECK (true);
