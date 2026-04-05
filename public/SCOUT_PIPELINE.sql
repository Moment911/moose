
-- ══════════════════════════════════════════════════════════════════════
-- SCOUT PIPELINE CRM
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scout_pipeline (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  business_name   text NOT NULL,
  contact_name    text,
  email           text,
  phone           text,
  website         text,
  address         text,
  city            text,
  state           text,
  industry        text,
  sic_code        text,
  google_place_id text,
  lead_score      int DEFAULT 0,
  temperature     text DEFAULT 'cold',   -- hot|warm|cold|frozen
  stage           text DEFAULT 'new',    -- new|contacted|interested|proposal_sent|negotiating|won|lost
  source          text DEFAULT 'scout',  -- scout|manual|referral|inbound
  notes           text,
  next_follow_up  date,
  last_contacted  timestamptz,
  estimated_value numeric,
  lost_reason     text,
  scout_data      jsonb,   -- original scout analysis snapshot
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scout_pipeline_agency ON scout_pipeline(agency_id, stage);
CREATE INDEX IF NOT EXISTS idx_scout_pipeline_stage  ON scout_pipeline(agency_id, stage, lead_score DESC);

-- Activity log per lead
CREATE TABLE IF NOT EXISTS scout_pipeline_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid REFERENCES scout_pipeline(id) ON DELETE CASCADE,
  agency_id   uuid,
  type        text NOT NULL,  -- note|email|call|stage_change|follow_up
  content     text,
  old_stage   text,
  new_stage   text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_activity ON scout_pipeline_activity(pipeline_id, created_at DESC);

SELECT 'Scout pipeline tables created ✓' as result;
