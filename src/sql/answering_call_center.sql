-- ══════════════════════════════════════════════════════════════════════════════
-- KOTO ANSWERING — CALL CENTER UPGRADE (rev 2)
-- Additive. Safe to run multiple times. Run in Supabase SQL Editor.
--
-- Rev 2 fixes: prod koto_inbound_calls was missing baseline columns like
-- urgency / outcome / caller_number, so the original index creates failed.
-- Every column each index references is now ALTER TABLE ADD COLUMN IF NOT
-- EXISTS before the indexes run.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── koto_inbound_agents — agent-level configuration ────────────────────────
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS prompt_sections        jsonb DEFAULT '{}';
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS retell_llm_id          text;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS business_name          text;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS notification_emails    jsonb DEFAULT '[]';
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS slack_webhook_url      text;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS teams_webhook_url      text;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS crm_webhook_url        text;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS crm_webhook_secret     text;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS digest_schedule        text;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS hipaa_mode             boolean DEFAULT false;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS retention_days         int;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS intake_templates_saved jsonb DEFAULT '[]';
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS calendar_webhook_url   text;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS scheduling_link        text;

-- Voice / Retell speech settings
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS voice_speed                numeric;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS voice_temperature          numeric;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS interruption_sensitivity   numeric;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS backchannel_frequency      numeric;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS enable_backchannel         boolean DEFAULT false;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS ambient_sound              text;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS responsiveness             numeric;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS end_call_after_silence_ms  int;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS reminder_trigger_ms        int;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS reminder_max_count         int;
ALTER TABLE koto_inbound_agents ADD COLUMN IF NOT EXISTS max_call_duration_ms       int;

-- ── koto_inbound_calls — every column the webhook + indexes touch ──────────
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS agency_id              uuid;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS agent_id               uuid;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS retell_call_id         text;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS caller_number          text;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS caller_phone           text;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS caller_name            text;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS caller_details         jsonb DEFAULT '{}';
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS transcript             text;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS summary                text;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS ai_summary             text;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS summary_audio_url      text;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS recording_url          text;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS recording_archive_url  text;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS duration_seconds       int DEFAULT 0;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS urgency                text DEFAULT 'low';
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS outcome                text DEFAULT 'completed';
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS sentiment              text DEFAULT 'neutral';
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS intent                 text;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS quality_score          int;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS quality_notes          text;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS intake_data            jsonb DEFAULT '{}';
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS follow_up_required     boolean DEFAULT false;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS follow_up_at           timestamptz;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS follow_up_notes        text;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS resolved_at            timestamptz;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS resolved_by            text;
ALTER TABLE koto_inbound_calls ADD COLUMN IF NOT EXISTS created_at             timestamptz DEFAULT now();

-- ── Routing targets (intent + urgency driven fan-out) ──────────────────────
CREATE TABLE IF NOT EXISTS koto_inbound_routing_targets (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id      uuid REFERENCES koto_inbound_agents(id) ON DELETE CASCADE,
  label         text NOT NULL,
  phone_number  text,
  email         text,
  priority      int DEFAULT 10,
  conditions    jsonb DEFAULT '{"intent":"any"}',
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_routing_targets_agent ON koto_inbound_routing_targets(agent_id);
ALTER TABLE koto_inbound_routing_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "routing_targets_all" ON koto_inbound_routing_targets;
CREATE POLICY "routing_targets_all" ON koto_inbound_routing_targets FOR ALL USING (true) WITH CHECK (true);

-- ── Calendar bookings (book_appointment Retell tool) ──────────────────────
CREATE TABLE IF NOT EXISTS koto_inbound_bookings (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id         uuid,
  agent_id          uuid REFERENCES koto_inbound_agents(id) ON DELETE SET NULL,
  retell_call_id    text,
  caller_name       text,
  callback_number   text,
  callback_email    text,
  appointment_at    timestamptz,
  duration_minutes  int DEFAULT 30,
  reason            text,
  status            text DEFAULT 'pending',
  external_id       text,
  notes             text,
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bookings_agent ON koto_inbound_bookings(agent_id);
CREATE INDEX IF NOT EXISTS idx_bookings_when  ON koto_inbound_bookings(appointment_at);
ALTER TABLE koto_inbound_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bookings_all" ON koto_inbound_bookings;
CREATE POLICY "bookings_all" ON koto_inbound_bookings FOR ALL USING (true) WITH CHECK (true);

-- ── Spam / blocklist ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS koto_inbound_spam_blocklist (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id     uuid,
  phone_number  text NOT NULL,
  reason        text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (agency_id, phone_number)
);
CREATE INDEX IF NOT EXISTS idx_spam_agency ON koto_inbound_spam_blocklist(agency_id);
ALTER TABLE koto_inbound_spam_blocklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "spam_all" ON koto_inbound_spam_blocklist;
CREATE POLICY "spam_all" ON koto_inbound_spam_blocklist FOR ALL USING (true) WITH CHECK (true);

-- ── Indexes for analytics + follow-up queries ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_calls_created     ON koto_inbound_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_urgency     ON koto_inbound_calls(urgency);
CREATE INDEX IF NOT EXISTS idx_calls_outcome     ON koto_inbound_calls(outcome);
CREATE INDEX IF NOT EXISTS idx_calls_intent      ON koto_inbound_calls(intent);
CREATE INDEX IF NOT EXISTS idx_calls_followup    ON koto_inbound_calls(follow_up_required, follow_up_at) WHERE follow_up_required;
CREATE INDEX IF NOT EXISTS idx_calls_caller_num  ON koto_inbound_calls(agency_id, caller_number, created_at DESC);
