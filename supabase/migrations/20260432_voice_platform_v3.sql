CREATE TABLE IF NOT EXISTS koto_inbound_callers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid, client_id uuid, phone text NOT NULL,
  name text, email text, total_calls int DEFAULT 1,
  first_call_at timestamptz DEFAULT now(),
  last_call_at timestamptz DEFAULT now(),
  notes text, tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inbound_callers_phone ON koto_inbound_callers(phone);
CREATE INDEX IF NOT EXISTS idx_inbound_callers_agency ON koto_inbound_callers(agency_id);
ALTER TABLE koto_inbound_callers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inbound_callers_all" ON koto_inbound_callers;
CREATE POLICY "inbound_callers_all" ON koto_inbound_callers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS dnc_status text DEFAULT 'unchecked';
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS dnc_checked_at timestamptz;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS attempted_outside_hours boolean DEFAULT false;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS transfer_requested boolean DEFAULT false;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS transfer_completed boolean DEFAULT false;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS transfer_to_number text;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS transfer_timestamp timestamptz;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS pre_call_research jsonb;
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS conversation_intelligence jsonb;
ALTER TABLE koto_voice_calls ADD COLUMN IF NOT EXISTS coaching_report jsonb;
ALTER TABLE koto_voice_calls ADD COLUMN IF NOT EXISTS conversation_intelligence jsonb;
ALTER TABLE koto_voice_calls ADD COLUMN IF NOT EXISTS transfer_requested boolean DEFAULT false;
ALTER TABLE koto_voice_calls ADD COLUMN IF NOT EXISTS transfer_completed boolean DEFAULT false;
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS personality_profile jsonb;
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS transfer_phone text;
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS transfer_enabled boolean DEFAULT false;
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS transfer_triggers text[] DEFAULT ARRAY['speak to someone','talk to a person','real person','human','representative','manager'];
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS local_presence_enabled boolean DEFAULT false;
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS amd_enabled boolean DEFAULT true;
ALTER TABLE koto_voice_agents ADD COLUMN IF NOT EXISTS warm_transfer_script text;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS ivr_enabled boolean DEFAULT false;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS ivr_config jsonb DEFAULT '[]';
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS ivr_greeting text;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS auto_callback_enabled boolean DEFAULT false;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS auto_callback_delay_minutes int DEFAULT 5;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS auto_callback_max_attempts int DEFAULT 2;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS transfer_phone text;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS transfer_enabled boolean DEFAULT false;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS is_callback boolean DEFAULT false;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS callback_attempt int DEFAULT 0;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS scheduled_callback_at timestamptz;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS transfer_requested boolean DEFAULT false;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS transfer_completed boolean DEFAULT false;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS caller_history_count int DEFAULT 0;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS coaching_report jsonb;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS conversation_intelligence jsonb;
