
-- ═══════════════════════════════════════════════════════════════════
-- KOTO AUTONOMOUS AGENT SYSTEM
-- ═══════════════════════════════════════════════════════════════════

-- Agent configuration per client
CREATE TABLE IF NOT EXISTS agent_configs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id         uuid,
  enabled           boolean DEFAULT false,
  
  -- Business context (collected during onboarding)
  business_goals    text[],           -- ['increase_reviews','rank_top3','grow_traffic']
  target_keywords   text[],           -- primary keywords to track
  competitors       text[],           -- competitor domains/names
  service_area      text,             -- city, region, or national
  monthly_budget    numeric(10,2),    -- marketing budget
  ad_budget         numeric(10,2),    -- PPC budget specifically
  primary_channel   text,             -- 'local_seo','ppc','both','organic'
  business_type     text,             -- b2b, b2c, service, ecommerce
  avg_ticket_value  numeric(10,2),    -- average customer value
  onboarding_done   boolean DEFAULT false,
  
  -- Schedule configuration
  schedule_weekly   boolean DEFAULT true,   -- weekly audits
  schedule_monthly  boolean DEFAULT true,   -- monthly reports
  schedule_daily    boolean DEFAULT false,  -- daily rank checks
  
  -- Alert thresholds
  alert_rank_drop   int DEFAULT 3,          -- alert if rank drops > N positions
  alert_review_new  boolean DEFAULT true,   -- alert on new reviews
  alert_traffic_drop int DEFAULT 20,        -- alert if traffic drops > N%
  
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Agent task queue (what needs to be done, scheduled or ad-hoc)
CREATE TABLE IF NOT EXISTS agent_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid,
  task_type       text NOT NULL,  -- 'weekly_audit','monthly_report','rank_check','gbp_audit','review_response','keyword_gap','competitor_check','content_gap'
  status          text DEFAULT 'pending',  -- pending, running, done, failed
  priority        int DEFAULT 5,           -- 1=urgent, 10=low
  scheduled_for   timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  result          jsonb,
  error           text,
  triggered_by    text DEFAULT 'schedule', -- schedule, manual, alert
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_client   ON agent_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status   ON agent_tasks(status, scheduled_for);

-- Agent runs (log of each full agent cycle)
CREATE TABLE IF NOT EXISTS agent_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid,
  run_type        text,    -- 'weekly','monthly','daily','adhoc'
  status          text DEFAULT 'running',
  started_at      timestamptz DEFAULT now(),
  completed_at    timestamptz,
  tasks_run       int DEFAULT 0,
  insights_count  int DEFAULT 0,
  alerts_count    int DEFAULT 0,
  summary         text,    -- AI-written run summary
  report_data     jsonb,   -- full structured report
  created_at      timestamptz DEFAULT now()
);

-- Agent insights (AI-generated findings, recommendations, alerts)
CREATE TABLE IF NOT EXISTS agent_insights (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid,
  run_id          uuid REFERENCES agent_runs(id) ON DELETE CASCADE,
  type            text,    -- 'win','alert','opportunity','recommendation','warning'
  category        text,    -- 'seo','reviews','gbp','keywords','competitor','ppc','content'
  priority        text,    -- 'critical','high','medium','low'
  title           text,
  body            text,
  metric_before   text,
  metric_after    text,
  action_url      text,
  dismissed       boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_insights_client ON agent_insights(client_id, created_at DESC);

-- Agent chat (natural language Q&A with the CMO agent)
CREATE TABLE IF NOT EXISTS agent_chats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid,
  agency_id       uuid,
  role            text,        -- 'user','agent'
  content         text,
  scope           text,        -- 'koto','agency','client'
  models_used     text[],      -- ['Claude','GPT-4o','Gemini']
  created_at      timestamptz DEFAULT now()
);

-- Add columns if table already exists
ALTER TABLE agent_chats ADD COLUMN IF NOT EXISTS scope       text;
ALTER TABLE agent_chats ADD COLUMN IF NOT EXISTS models_used text[];

SELECT 'Agent tables created ✓' as result;

-- Add scope/models_used to existing agent_chats if already created
ALTER TABLE agent_chats ADD COLUMN IF NOT EXISTS scope       text;
ALTER TABLE agent_chats ADD COLUMN IF NOT EXISTS models_used text[];
