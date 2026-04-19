-- Scout voice — clone of VOB architecture scoped to outbound sales prospecting.
-- Mirrors vob_calls / vob_queue / vob_knowledge patterns but with sales-
-- specific columns (opportunity_id, pitch_angle, deal_value_forecast) in
-- place of VOB's healthcare columns (patient_id, carrier_name, level_of_care).
--
-- VOB stays untouched; Scout operates on its own scout_voice_* namespace.
-- Intelligence libraries (conversationIntelligence, preCallIntelligence,
-- liveConversationEngine) are shared between the two — stateless.

-- ============================================================================
-- scout_voice_agents — one row per Retell agent configured for Scout dialing
-- ============================================================================
CREATE TABLE IF NOT EXISTS scout_voice_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  name text NOT NULL,
  retell_agent_id text,
  retell_llm_id text,
  from_number text,

  industry_slug text,
  sic_codes text[] DEFAULT '{}',

  personality_profile jsonb DEFAULT '{}'::jsonb,
  default_pitch_angle text,
  opening_script text,
  system_prompt_template text,

  voice_id text,
  language text DEFAULT 'en-US',

  transfer_enabled boolean DEFAULT false,
  transfer_phone text,
  warm_transfer_script text,

  amd_enabled boolean DEFAULT true,
  local_presence_enabled boolean DEFAULT false,

  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scout_voice_agents_agency ON scout_voice_agents(agency_id);
CREATE INDEX IF NOT EXISTS idx_scout_voice_agents_retell ON scout_voice_agents(retell_agent_id) WHERE retell_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_voice_agents_industry ON scout_voice_agents(industry_slug) WHERE industry_slug IS NOT NULL;

ALTER TABLE scout_voice_agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scout_voice_agents_agency" ON scout_voice_agents;
CREATE POLICY "scout_voice_agents_agency" ON scout_voice_agents FOR ALL
  USING (agency_id = auth.uid());

-- ============================================================================
-- scout_voice_calls — main call record (VOB's vob_calls equivalent)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scout_voice_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,

  -- Prospect identity
  opportunity_id uuid REFERENCES koto_opportunities(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES scout_voice_agents(id) ON DELETE SET NULL,
  company_name text,
  contact_name text,
  industry text,
  sic_code text,

  -- Sales context
  pitch_angle text,
  biggest_gap text,
  intended_outcome text,

  -- Call state
  status text NOT NULL DEFAULT 'queued',
    -- queued | dialing | ringing | voicemail | ivr | hold | speaking
    -- | completed | failed | cancelled | escalated | no_answer
  trigger_mode text DEFAULT 'manual',
  priority integer DEFAULT 3,

  -- Discovery / Q&A data
  discovery_data jsonb DEFAULT '{}'::jsonb,
  questions_total integer DEFAULT 0,
  questions_answered integer DEFAULT 0,

  -- Retell integration
  retell_call_id text,
  from_number text,
  to_number text,
  recording_url text,
  public_log_url text,

  -- Timing
  queued_at timestamptz DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  hold_time_seconds integer DEFAULT 0,

  -- Intelligence
  transcript text,
  sentiment text,
  conversation_intelligence jsonb,
  post_call_analysis jsonb,
  coaching_report jsonb,
  deal_value_forecast jsonb,

  -- Outcome
  outcome text,
    -- appointment_set | qualified | not_interested | callback | voicemail
    -- | dnc_requested | no_answer | gatekeeper | wrong_contact
  appointment_set boolean DEFAULT false,
  follow_up_at timestamptz,

  -- Diagnostics
  error_message text,
  disconnection_reason text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scout_voice_calls_agency ON scout_voice_calls(agency_id);
CREATE INDEX IF NOT EXISTS idx_scout_voice_calls_status ON scout_voice_calls(status);
CREATE INDEX IF NOT EXISTS idx_scout_voice_calls_opp ON scout_voice_calls(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_voice_calls_retell ON scout_voice_calls(retell_call_id) WHERE retell_call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_voice_calls_created ON scout_voice_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scout_voice_calls_ended ON scout_voice_calls(ended_at DESC) WHERE ended_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_voice_calls_outcome ON scout_voice_calls(outcome) WHERE outcome IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_voice_calls_agency_status ON scout_voice_calls(agency_id, status, created_at DESC);

ALTER TABLE scout_voice_calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scout_voice_calls_agency" ON scout_voice_calls;
CREATE POLICY "scout_voice_calls_agency" ON scout_voice_calls FOR ALL
  USING (agency_id = auth.uid());

-- ============================================================================
-- scout_voice_queue — prospects waiting to be dialed (vob_queue equivalent)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scout_voice_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  scout_call_id uuid REFERENCES scout_voice_calls(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES koto_opportunities(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES scout_voice_agents(id) ON DELETE SET NULL,

  company_name text,
  contact_name text,
  contact_phone text,
  industry text,
  sic_code text,
  pitch_angle text,
  biggest_gap text,

  priority integer DEFAULT 3,
  trigger_mode text DEFAULT 'manual',
  status text DEFAULT 'pending',
    -- pending | in_progress | completed | cancelled | failed

  scheduled_at timestamptz,
  last_attempt_at timestamptz,
  attempt_count integer DEFAULT 0,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scout_voice_queue_agency ON scout_voice_queue(agency_id);
CREATE INDEX IF NOT EXISTS idx_scout_voice_queue_status ON scout_voice_queue(agency_id, status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_scout_voice_queue_scheduled ON scout_voice_queue(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_voice_queue_call ON scout_voice_queue(scout_call_id) WHERE scout_call_id IS NOT NULL;

ALTER TABLE scout_voice_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scout_voice_queue_agency" ON scout_voice_queue;
CREATE POLICY "scout_voice_queue_agency" ON scout_voice_queue FOR ALL
  USING (agency_id = auth.uid());

-- ============================================================================
-- scout_voice_campaigns — named batches of queued calls
-- ============================================================================
CREATE TABLE IF NOT EXISTS scout_voice_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  name text NOT NULL,
  description text,

  agent_id uuid REFERENCES scout_voice_agents(id) ON DELETE SET NULL,
  default_pitch_angle text,
  target_industry text,
  target_sic_codes text[] DEFAULT '{}',
  target_gaps text[] DEFAULT '{}',

  call_window_start time DEFAULT '09:00',
  call_window_end time DEFAULT '17:00',
  call_window_tz text DEFAULT 'America/New_York',
  daily_call_cap integer DEFAULT 100,

  status text DEFAULT 'draft',
    -- draft | active | paused | completed | archived

  stats jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_scout_voice_campaigns_agency ON scout_voice_campaigns(agency_id, status);

ALTER TABLE scout_voice_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scout_voice_campaigns_agency" ON scout_voice_campaigns;
CREATE POLICY "scout_voice_campaigns_agency" ON scout_voice_campaigns FOR ALL
  USING (agency_id = auth.uid());

-- Link calls to campaigns
ALTER TABLE scout_voice_calls ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES scout_voice_campaigns(id) ON DELETE SET NULL;
ALTER TABLE scout_voice_queue ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES scout_voice_campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_scout_voice_calls_campaign ON scout_voice_calls(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_voice_queue_campaign ON scout_voice_queue(campaign_id) WHERE campaign_id IS NOT NULL;

-- ============================================================================
-- scout_questions — discovery question library (learning loop)
-- Equivalent to koto_qa_intelligence but scoped to Scout. Every post-call
-- Q&A parse updates these running metrics so the best questions bubble up.
-- ============================================================================
CREATE TABLE IF NOT EXISTS scout_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid,
    -- NULL = global / platform-wide learning; non-null = agency-specific

  industry_slug text,
  sic_code text,

  question_text text NOT NULL,
  question_text_norm text GENERATED ALWAYS AS (lower(regexp_replace(question_text, '[^a-z0-9 ]', '', 'gi'))) STORED,
  question_type text,
    -- opener | discovery | qualifying | pain | budget | timeline | objection_handle | closer

  category text,
  priority integer DEFAULT 3,

  times_asked integer DEFAULT 0,
  times_answered integer DEFAULT 0,
  appointment_rate numeric(5,2) DEFAULT 0,
  avg_engagement_score numeric(5,2),
  avg_talk_time_seconds numeric(8,2),

  last_asked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scout_questions_agency ON scout_questions(agency_id, industry_slug);
CREATE INDEX IF NOT EXISTS idx_scout_questions_norm ON scout_questions(question_text_norm);
CREATE INDEX IF NOT EXISTS idx_scout_questions_type ON scout_questions(question_type);
CREATE INDEX IF NOT EXISTS idx_scout_questions_performance ON scout_questions(appointment_rate DESC, times_asked DESC);

ALTER TABLE scout_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scout_questions_agency" ON scout_questions;
CREATE POLICY "scout_questions_agency" ON scout_questions FOR ALL
  USING (agency_id IS NULL OR agency_id = auth.uid());

-- ============================================================================
-- scout_call_questions — per-call instance of a question being asked
-- Links a call to the questions from scout_questions that were asked,
-- with the answer + outcome. Feeds the learning loop.
-- ============================================================================
CREATE TABLE IF NOT EXISTS scout_call_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_call_id uuid NOT NULL REFERENCES scout_voice_calls(id) ON DELETE CASCADE,
  question_id uuid REFERENCES scout_questions(id) ON DELETE SET NULL,
  agency_id uuid,

  question_text text NOT NULL,
  answer_text text,
  answer_sentiment text,
  answered boolean DEFAULT false,

  sequence integer,
  timestamp_seconds integer,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scout_call_questions_call ON scout_call_questions(scout_call_id);
CREATE INDEX IF NOT EXISTS idx_scout_call_questions_q ON scout_call_questions(question_id) WHERE question_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_call_questions_agency ON scout_call_questions(agency_id);

ALTER TABLE scout_call_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scout_call_questions_agency" ON scout_call_questions;
CREATE POLICY "scout_call_questions_agency" ON scout_call_questions FOR ALL
  USING (agency_id = auth.uid());

-- ============================================================================
-- scout_voice_knowledge — persistent facts learned across calls.
-- Example: "HVAC contractors in Florida respond well to ROI framing"
-- Example: "Businesses without GA4 react strongly to 'flying blind' framing"
-- ============================================================================
CREATE TABLE IF NOT EXISTS scout_voice_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid,
    -- NULL = platform-wide; non-null = agency-specific

  scope text NOT NULL,
    -- industry | sic | company | gap | objection | global
  scope_value text,

  fact text NOT NULL,
  fact_category text,
    -- pitch_angle | pain_point | objection_response | timing | decision_maker | hot_button

  times_confirmed integer DEFAULT 1,
  times_contradicted integer DEFAULT 0,
  confidence_score numeric(3,2) DEFAULT 0.5,

  first_confirmed_at timestamptz DEFAULT now(),
  last_confirmed_at timestamptz DEFAULT now(),

  sample_call_ids uuid[] DEFAULT '{}',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scout_voice_knowledge_agency ON scout_voice_knowledge(agency_id);
CREATE INDEX IF NOT EXISTS idx_scout_voice_knowledge_scope ON scout_voice_knowledge(scope, scope_value);
CREATE INDEX IF NOT EXISTS idx_scout_voice_knowledge_category ON scout_voice_knowledge(fact_category);
CREATE INDEX IF NOT EXISTS idx_scout_voice_knowledge_confidence ON scout_voice_knowledge(confidence_score DESC);

ALTER TABLE scout_voice_knowledge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scout_voice_knowledge_agency" ON scout_voice_knowledge;
CREATE POLICY "scout_voice_knowledge_agency" ON scout_voice_knowledge FOR ALL
  USING (agency_id IS NULL OR agency_id = auth.uid());

-- ============================================================================
-- Agency columns for Scout voice provisioning (mirrors VOB pattern)
-- ============================================================================
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS scout_voice_agent_id text;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS scout_voice_llm_id text;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS scout_voice_from_number text;

-- ============================================================================
-- updated_at triggers (named dollar-quoted to avoid SQL-editor unicode issues)
-- ============================================================================
CREATE OR REPLACE FUNCTION scout_voice_touch_updated_at()
RETURNS TRIGGER AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scout_voice_agents_updated ON scout_voice_agents;
CREATE TRIGGER trg_scout_voice_agents_updated BEFORE UPDATE ON scout_voice_agents
  FOR EACH ROW EXECUTE FUNCTION scout_voice_touch_updated_at();

DROP TRIGGER IF EXISTS trg_scout_voice_calls_updated ON scout_voice_calls;
CREATE TRIGGER trg_scout_voice_calls_updated BEFORE UPDATE ON scout_voice_calls
  FOR EACH ROW EXECUTE FUNCTION scout_voice_touch_updated_at();

DROP TRIGGER IF EXISTS trg_scout_voice_queue_updated ON scout_voice_queue;
CREATE TRIGGER trg_scout_voice_queue_updated BEFORE UPDATE ON scout_voice_queue
  FOR EACH ROW EXECUTE FUNCTION scout_voice_touch_updated_at();

DROP TRIGGER IF EXISTS trg_scout_voice_campaigns_updated ON scout_voice_campaigns;
CREATE TRIGGER trg_scout_voice_campaigns_updated BEFORE UPDATE ON scout_voice_campaigns
  FOR EACH ROW EXECUTE FUNCTION scout_voice_touch_updated_at();

DROP TRIGGER IF EXISTS trg_scout_questions_updated ON scout_questions;
CREATE TRIGGER trg_scout_questions_updated BEFORE UPDATE ON scout_questions
  FOR EACH ROW EXECUTE FUNCTION scout_voice_touch_updated_at();

DROP TRIGGER IF EXISTS trg_scout_voice_knowledge_updated ON scout_voice_knowledge;
CREATE TRIGGER trg_scout_voice_knowledge_updated BEFORE UPDATE ON scout_voice_knowledge
  FOR EACH ROW EXECUTE FUNCTION scout_voice_touch_updated_at();

-- ============================================================================
-- When a call ends, auto-emit a Scout opportunity activity so the unified
-- Scout timeline (built on koto_opportunity_activities) picks it up with
-- zero wiring from the webhook handler.
-- ============================================================================
CREATE OR REPLACE FUNCTION scout_voice_emit_on_completion()
RETURNS TRIGGER AS $fn$
BEGIN
  IF (TG_OP = 'UPDATE'
      AND NEW.opportunity_id IS NOT NULL
      AND NEW.status IS DISTINCT FROM OLD.status
      AND NEW.status IN ('completed','failed','no_answer','voicemail','cancelled')) THEN
    INSERT INTO koto_opportunity_activities (opportunity_id, activity_type, description, metadata)
    VALUES (
      NEW.opportunity_id,
      CASE NEW.status
        WHEN 'completed' THEN 'call_outbound'
        WHEN 'voicemail' THEN 'call_voicemail'
        WHEN 'no_answer' THEN 'call_missed'
        ELSE 'call_outbound'
      END,
      LEFT(COALESCE(NEW.post_call_analysis->>'call_summary', NEW.pitch_angle, ''), 280),
      jsonb_build_object(
        'source', 'scout_voice',
        'scout_call_id', NEW.id,
        'retell_call_id', NEW.retell_call_id,
        'duration_seconds', NEW.duration_seconds,
        'outcome', NEW.outcome,
        'appointment_set', NEW.appointment_set,
        'sentiment', NEW.sentiment,
        'transcript', NEW.transcript
      )
    );
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scout_voice_calls_emit ON scout_voice_calls;
CREATE TRIGGER trg_scout_voice_calls_emit
  AFTER UPDATE OF status ON scout_voice_calls
  FOR EACH ROW EXECUTE FUNCTION scout_voice_emit_on_completion();
