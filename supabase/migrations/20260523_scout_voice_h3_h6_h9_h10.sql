-- Scout Voice — schema additions for H3, H6, H9, H10
--
-- H3:  Voicemail Mode B — agent-level voicemail config
-- H6:  Cadence state machine — cadence tracking table
-- H9:  Recording retention — retention_expires_at on calls
-- H10: Audit gap detection — structured gaps table

-- ============================================================================
-- H3: Voicemail columns on scout_voice_agents
-- ============================================================================
ALTER TABLE scout_voice_agents ADD COLUMN IF NOT EXISTS voicemail_mode text DEFAULT 'dynamic';
  -- 'dynamic' (TTS from template) | 'uploaded' (pre-recorded audio) | 'off'
ALTER TABLE scout_voice_agents ADD COLUMN IF NOT EXISTS voicemail_pattern text DEFAULT 'pattern_1';
  -- 'pattern_1' (authority hook) | 'pattern_2' (specific pain) | 'pattern_3' (breakup)
ALTER TABLE scout_voice_agents ADD COLUMN IF NOT EXISTS voicemail_script_template text;
  -- Custom template with {{placeholders}}; null = use default for the pattern
ALTER TABLE scout_voice_agents ADD COLUMN IF NOT EXISTS voicemail_tone text DEFAULT 'conversational';
  -- 'conversational' | 'professional' | 'urgent'
ALTER TABLE scout_voice_agents ADD COLUMN IF NOT EXISTS voicemail_max_seconds integer DEFAULT 30;
ALTER TABLE scout_voice_agents ADD COLUMN IF NOT EXISTS voicemail_uploaded_url text;
  -- For Mode A (uploaded audio); null when mode = dynamic

-- ============================================================================
-- H6: Cadence state machine
-- ============================================================================
CREATE TABLE IF NOT EXISTS scout_voice_cadence_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  persona_id uuid NOT NULL REFERENCES scout_voice_personas(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES scout_voice_campaigns(id) ON DELETE SET NULL,

  -- Current state
  status text NOT NULL DEFAULT 'active',
    -- active | paused | completed | opted_out | exhausted
  current_step integer DEFAULT 1,
  total_touches integer DEFAULT 0,
  last_touch_type text,  -- 'voice' | 'voicemail' | 'email'
  last_touch_at timestamptz,

  -- DM targeting
  current_dm_persona_id uuid REFERENCES scout_voice_personas(id) ON DELETE SET NULL,
  dm_switches integer DEFAULT 0,  -- times switched to backup DM

  -- Scheduling
  next_action_type text,  -- 'voice' | 'voicemail' | 'email' | 'wait'
  next_action_at timestamptz,
  next_action_reason text,

  -- Pause/resume
  paused_at timestamptz,
  pause_reason text,  -- 'human_response' | 'prospect_callback' | 'manual'
  resumed_at timestamptz,

  -- Prospect-requested callback (overrides auto-cadence)
  callback_requested boolean DEFAULT false,
  callback_requested_at timestamptz,
  callback_requested_for timestamptz,

  -- Cadence config (snapshot from preset at creation time)
  cadence_config jsonb DEFAULT '{}'::jsonb,
    -- { preset, max_touches, touch_interval_hours, voicemail_after_no_answer,
    --   email_after_voicemail, backup_dm_after_touches, backup_dm_after_emails }

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cadence_state_agency ON scout_voice_cadence_state(agency_id);
CREATE INDEX IF NOT EXISTS idx_cadence_state_persona ON scout_voice_cadence_state(persona_id);
CREATE INDEX IF NOT EXISTS idx_cadence_state_next ON scout_voice_cadence_state(next_action_at)
  WHERE status = 'active' AND next_action_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cadence_state_status ON scout_voice_cadence_state(agency_id, status);

ALTER TABLE scout_voice_cadence_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scout_voice_cadence_state_open" ON scout_voice_cadence_state;
CREATE POLICY "scout_voice_cadence_state_open" ON scout_voice_cadence_state FOR ALL
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_scout_cadence_state_updated ON scout_voice_cadence_state;
CREATE TRIGGER trg_scout_cadence_state_updated BEFORE UPDATE ON scout_voice_cadence_state
  FOR EACH ROW EXECUTE FUNCTION scout_voice_touch_updated_at();

-- ============================================================================
-- H9: Recording retention
-- ============================================================================
ALTER TABLE scout_voice_calls ADD COLUMN IF NOT EXISTS retention_expires_at timestamptz;
ALTER TABLE scout_voice_calls ADD COLUMN IF NOT EXISTS retention_warning_sent boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_scout_calls_retention ON scout_voice_calls(retention_expires_at)
  WHERE retention_expires_at IS NOT NULL AND recording_url IS NOT NULL;

-- ============================================================================
-- H10: Audit gap detection
-- ============================================================================
CREATE TABLE IF NOT EXISTS scout_voice_audit_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  company_id uuid REFERENCES scout_voice_companies(id) ON DELETE CASCADE,

  gap_type text NOT NULL,
    -- 'seo' | 'ppc' | 'social' | 'reviews' | 'website' | 'email' | 'listings' | 'content'
  gap_specific text NOT NULL,
    -- e.g. 'No Google Ads running', 'GMB profile incomplete'
  estimated_impact text,
    -- e.g. 'Losing ~20 leads/month to competitors'
  revenue_weight integer DEFAULT 50,  -- 1-100
  visual_proof_url text,
    -- Screenshot or report URL showing the gap

  -- Source tracking
  source text DEFAULT 'manual',  -- 'manual' | 'kotoiq_scan' | 'ai_research'
  source_data jsonb,

  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_gaps_company ON scout_voice_audit_gaps(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_gaps_agency ON scout_voice_audit_gaps(agency_id);
CREATE INDEX IF NOT EXISTS idx_audit_gaps_weight ON scout_voice_audit_gaps(company_id, revenue_weight DESC)
  WHERE active = true;

ALTER TABLE scout_voice_audit_gaps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scout_voice_audit_gaps_open" ON scout_voice_audit_gaps;
CREATE POLICY "scout_voice_audit_gaps_open" ON scout_voice_audit_gaps FOR ALL
  USING (true) WITH CHECK (true);

-- Link calls to structured gaps
ALTER TABLE scout_voice_calls ADD COLUMN IF NOT EXISTS audit_gap_id uuid REFERENCES scout_voice_audit_gaps(id) ON DELETE SET NULL;

-- ============================================================================
-- H12: Onboarding tracking on agents
-- ============================================================================
ALTER TABLE scout_voice_agents ADD COLUMN IF NOT EXISTS onboarding_step text DEFAULT 'industry_select';
  -- 'industry_select' | 'agent_setup' | 'voicemail_config' | 'test_call' | 'first_campaign' | 'complete'
ALTER TABLE scout_voice_agents ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
