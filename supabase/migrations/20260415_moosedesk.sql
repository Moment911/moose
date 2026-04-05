-- ══════════════════════════════════════════════════════════════════════════════
-- MOOSEDESK — AI-Powered Task Routing & Support Desk
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Team members (agency staff with hourly rates) ─────────────────────────────
CREATE TABLE IF NOT EXISTS desk_agents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid REFERENCES agencies(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name          text NOT NULL,
  email         text NOT NULL,
  role          text DEFAULT 'agent',        -- agent | senior | lead | manager
  avatar_color  text DEFAULT '#ea2729',
  hourly_rate   numeric DEFAULT 0,           -- for cost tracking
  is_active     boolean DEFAULT true,
  skills        text[] DEFAULT '{}',         -- tags for routing rules
  max_tickets   int DEFAULT 20,              -- capacity
  created_at    timestamptz DEFAULT now()
);

-- ── Routing rules (how tickets get assigned) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS desk_routing_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid REFERENCES agencies(id) ON DELETE CASCADE,
  name          text NOT NULL,
  is_active     boolean DEFAULT true,
  priority      int DEFAULT 0,               -- lower = runs first
  -- conditions (ALL must match)
  match_category text[],                     -- matches any of these categories
  match_keywords text[],                     -- matches any of these words in subject
  match_priority text[],                     -- matches any of these priority levels
  match_client_id uuid,                      -- specific client only
  -- actions
  assign_agent_id  uuid REFERENCES desk_agents(id) ON DELETE SET NULL,
  assign_team      text[],                   -- team labels to assign
  set_priority     text,
  set_category     text,
  auto_reply       text,                     -- optional auto-response message
  notify_emails    text[],
  created_at    timestamptz DEFAULT now()
);

-- ── Tickets (the core) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS desk_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  ticket_number   text UNIQUE,               -- DESK-0001 etc
  -- submitter
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  submitter_name  text NOT NULL,
  submitter_email text NOT NULL,
  submitter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- content
  subject         text NOT NULL,
  description     text NOT NULL,
  category        text DEFAULT 'general',    -- general|bug|feature|billing|content|design|seo|ads|social|urgent
  priority        text DEFAULT 'normal',     -- low|normal|high|urgent|critical
  status          text DEFAULT 'new',        -- new|open|pending|in_progress|waiting|resolved|closed
  -- AI analysis
  ai_category     text,
  ai_priority     text,
  ai_summary      text,
  ai_suggested_response text,
  ai_tags         text[],
  ai_sentiment    text,                      -- positive|neutral|negative|frustrated
  ai_processed_at timestamptz,
  -- assignment
  assigned_agent_id uuid REFERENCES desk_agents(id) ON DELETE SET NULL,
  assigned_teams  text[],
  routing_rule_id uuid REFERENCES desk_routing_rules(id) ON DELETE SET NULL,
  -- SLA
  first_response_at  timestamptz,
  resolved_at        timestamptz,
  closed_at          timestamptz,
  due_at             timestamptz,
  -- tracking
  views              int DEFAULT 0,
  reply_count        int DEFAULT 0,
  total_time_minutes int DEFAULT 0,          -- sum of all time logs
  total_cost         numeric DEFAULT 0,      -- sum of (minutes/60 * hourly_rate)
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- Auto-generate ticket number
CREATE SEQUENCE IF NOT EXISTS desk_ticket_seq START 1;
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := 'DESK-' || LPAD(nextval('desk_ticket_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_number ON desk_tickets;
CREATE TRIGGER trg_ticket_number
  BEFORE INSERT ON desk_tickets
  FOR EACH ROW EXECUTE FUNCTION set_ticket_number();

-- ── Ticket replies/activity ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS desk_replies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     uuid REFERENCES desk_tickets(id) ON DELETE CASCADE,
  author_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name   text NOT NULL,
  author_email  text,
  author_type   text DEFAULT 'agent',        -- client | agent | system | ai
  body          text NOT NULL,
  is_internal   boolean DEFAULT false,       -- internal note vs client reply
  attachments   jsonb DEFAULT '[]',
  created_at    timestamptz DEFAULT now()
);

-- ── Time logs (per agent, per ticket) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS desk_time_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     uuid REFERENCES desk_tickets(id) ON DELETE CASCADE,
  agent_id      uuid REFERENCES desk_agents(id) ON DELETE SET NULL,
  agent_name    text NOT NULL,
  hourly_rate   numeric DEFAULT 0,
  started_at    timestamptz NOT NULL,
  stopped_at    timestamptz,
  minutes       int,                         -- computed on stop
  cost          numeric,                     -- minutes/60 * hourly_rate
  note          text,
  is_running    boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- ── Activity log (everything that touches a ticket) ──────────────────────────
CREATE TABLE IF NOT EXISTS desk_activity (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     uuid REFERENCES desk_tickets(id) ON DELETE CASCADE,
  actor_name    text NOT NULL,
  actor_type    text DEFAULT 'agent',        -- agent | client | system | ai
  action        text NOT NULL,               -- created|replied|assigned|status_changed|priority_changed|time_started|time_stopped|routed
  detail        text,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);

-- ── Knowledge base (LLM training — what the system learns) ───────────────────
CREATE TABLE IF NOT EXISTS desk_knowledge (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid REFERENCES agencies(id) ON DELETE CASCADE,
  ticket_id     uuid REFERENCES desk_tickets(id) ON DELETE SET NULL,
  category      text NOT NULL,
  subject_pattern text,                      -- normalized subject
  resolution    text,                        -- what worked
  tags          text[],
  confidence    numeric DEFAULT 1.0,
  use_count     int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_desk_tickets_agency   ON desk_tickets(agency_id);
CREATE INDEX IF NOT EXISTS idx_desk_tickets_status   ON desk_tickets(status);
CREATE INDEX IF NOT EXISTS idx_desk_tickets_agent    ON desk_tickets(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_desk_tickets_client   ON desk_tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_desk_replies_ticket   ON desk_replies(ticket_id);
CREATE INDEX IF NOT EXISTS idx_desk_time_logs_ticket ON desk_time_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_desk_activity_ticket  ON desk_activity(ticket_id);
CREATE INDEX IF NOT EXISTS idx_desk_knowledge_agency ON desk_knowledge(agency_id, category);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE desk_agents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE desk_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE desk_tickets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE desk_replies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE desk_time_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE desk_activity     ENABLE ROW LEVEL SECURITY;
ALTER TABLE desk_knowledge    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_desk_agents" ON desk_agents;
CREATE POLICY "allow_all_desk_agents"    ON desk_agents         FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow_all_desk_rules" ON desk_routing_rules;
CREATE POLICY "allow_all_desk_rules"     ON desk_routing_rules  FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow_all_desk_tickets" ON desk_tickets;
CREATE POLICY "allow_all_desk_tickets"   ON desk_tickets        FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow_all_desk_replies" ON desk_replies;
CREATE POLICY "allow_all_desk_replies"   ON desk_replies        FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow_all_desk_time" ON desk_time_logs;
CREATE POLICY "allow_all_desk_time"      ON desk_time_logs      FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX  IF NOT EXISTS idx_desk_activity_created ON desk_activity(created_at DESC);
DROP POLICY IF EXISTS "allow_all_desk_activity" ON desk_activity;
CREATE POLICY "allow_all_desk_activity"  ON desk_activity       FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow_all_desk_knowledge" ON desk_knowledge;
CREATE POLICY "allow_all_desk_knowledge" ON desk_knowledge      FOR ALL USING (true) WITH CHECK (true);
