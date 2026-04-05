
-- ══════════════════════════════════════════════════════════════════════
-- MISSING CORE TABLES
-- automations, tasks, calendar_events
-- ══════════════════════════════════════════════════════════════════════

-- Tasks (used by TasksPage, CalendarPage, ProjectPage)
CREATE TABLE IF NOT EXISTS tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  status          text DEFAULT 'todo',    -- todo|in_progress|review|done|blocked
  priority        text DEFAULT 'normal',  -- low|normal|high|urgent
  due_date        timestamptz,
  completed_at    timestamptz,
  assigned_to     uuid,                   -- user id
  assigned_email  text,
  labels          text[],
  sort_order      int DEFAULT 0,
  created_by      uuid,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_agency   ON tasks(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_client   ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project  ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due      ON tasks(due_date);

-- Task comments
CREATE TABLE IF NOT EXISTS task_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid REFERENCES tasks(id) ON DELETE CASCADE,
  author_id   uuid,
  author_name text,
  body        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_comments ON task_comments(task_id, created_at DESC);

-- Calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
  task_id         uuid REFERENCES tasks(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  event_type      text DEFAULT 'task',   -- task|meeting|deadline|reminder|campaign
  color           text DEFAULT '#5bc6d0',
  start_at        timestamptz NOT NULL,
  end_at          timestamptz,
  all_day         boolean DEFAULT false,
  recurrence      text,                  -- none|daily|weekly|monthly
  created_by      uuid,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_agency ON calendar_events(agency_id, start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_client ON calendar_events(client_id, start_at);

-- Automations
CREATE TABLE IF NOT EXISTS automations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  trigger_type    text NOT NULL,         -- new_contact|form_submit|project_created|schedule|review_new|ticket_new
  trigger_config  jsonb DEFAULT '{}',
  actions         jsonb DEFAULT '[]',    -- array of {type, config} objects
  status          text DEFAULT 'paused', -- active|paused|draft
  run_count       int DEFAULT 0,
  last_run_at     timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automations_agency ON automations(agency_id, status);

-- Automation run log
CREATE TABLE IF NOT EXISTS automation_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   uuid REFERENCES automations(id) ON DELETE CASCADE,
  trigger_data    jsonb,
  status          text DEFAULT 'success', -- success|error|skipped
  actions_run     int DEFAULT 0,
  error           text,
  created_at      timestamptz DEFAULT now()
);

SELECT 'Core missing tables created ✓' as result;
