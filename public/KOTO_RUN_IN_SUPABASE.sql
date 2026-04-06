-- ══════════════════════════════════════════════════════════════════════════════
-- KOTO PLATFORM — ALL PENDING SQL
-- Run this entire file in Supabase SQL Editor
-- Project: hwxfxcpfzxamtcwrgdkm
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. CORE TABLES (tasks, automations, calendar) ─────────────────────────────

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

-- ── 2. WORDPRESS PLUGIN TABLES ──────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════
-- KOTO SEO PLUGIN — WORDPRESS INTEGRATION
-- Single source of truth: koto_wp_sites
-- ══════════════════════════════════════════════════════════════════════

-- Drop old duplicate tables if they exist
DROP TABLE IF EXISTS lucy_wp_sites;
DROP TABLE IF EXISTS moose_wp_sites;

-- Single consolidated table
CREATE TABLE IF NOT EXISTS koto_wp_sites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  site_name       text NOT NULL,
  site_url        text NOT NULL,
  api_key         text NOT NULL,          -- plugin-generated key
  license_key     text UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  connected       boolean DEFAULT false,
  wp_version      text,
  plugin_version  text,
  last_ping       timestamptz,
  last_sync       timestamptz,
  -- Cached data from last sync
  pages_generated int DEFAULT 0,
  keywords_tracked int DEFAULT 0,
  gsc_connected   boolean DEFAULT false,
  ga4_connected   boolean DEFAULT false,
  site_settings   jsonb,                  -- cached plugin settings
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(agency_id, site_url)
);
CREATE INDEX IF NOT EXISTS idx_koto_wp_sites_agency  ON koto_wp_sites(agency_id);
CREATE INDEX IF NOT EXISTS idx_koto_wp_sites_client  ON koto_wp_sites(client_id);
CREATE INDEX IF NOT EXISTS idx_koto_wp_sites_license ON koto_wp_sites(license_key);

-- Log every command sent from Koto → plugin
CREATE TABLE IF NOT EXISTS koto_wp_commands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid REFERENCES koto_wp_sites(id) ON DELETE CASCADE,
  agency_id   uuid,
  command     text NOT NULL,      -- generate_batch, sync_gsc, etc.
  payload     jsonb,
  status      text DEFAULT 'pending',  -- pending|success|error
  response    jsonb,
  error       text,
  duration_ms int,
  created_at  timestamptz DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_wp_commands_site ON koto_wp_commands(site_id, created_at DESC);

-- Cache generated pages from plugin
CREATE TABLE IF NOT EXISTS koto_wp_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid REFERENCES koto_wp_sites(id) ON DELETE CASCADE,
  client_id       uuid,
  wp_post_id      int,
  title           text,
  slug            text,
  url             text,
  keyword         text,
  location        text,
  page_type       text,
  status          text DEFAULT 'published',
  word_count      int,
  seo_score       int,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wp_pages_site ON koto_wp_pages(site_id);

-- Cache rankings synced from plugin
CREATE TABLE IF NOT EXISTS koto_wp_rankings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid REFERENCES koto_wp_sites(id) ON DELETE CASCADE,
  keyword     text,
  position    numeric,
  clicks      int,
  impressions int,
  ctr         numeric,
  url         text,
  synced_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wp_rankings_site ON koto_wp_rankings(site_id, synced_at DESC);

SELECT 'Koto WordPress tables created ✓' as result;

-- ── 3. ONBOARDING PROFILE ENHANCEMENTS ──────────────────────────────────────
-- ══════════════════════════════════════════════════════════════════════
-- ONBOARDING PROFILE — full form storage + document export
-- ══════════════════════════════════════════════════════════════════════

-- Store the full form submission as JSONB
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS onboarding_form    jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS onboarding_data    jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS onboarding_docx_url text;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS onboarding_pdf_url  text;

-- Lock flag — agency can lock the form so client can't edit further
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_locked boolean DEFAULT false;

-- Support multiple onboarding tokens (additional sends)
ALTER TABLE onboarding_tokens ADD COLUMN IF NOT EXISTS label           text;
ALTER TABLE onboarding_tokens ADD COLUMN IF NOT EXISTS allow_resubmit boolean DEFAULT true;
ALTER TABLE onboarding_tokens ADD COLUMN IF NOT EXISTS submitted_at   timestamptz;
ALTER TABLE onboarding_tokens ADD COLUMN IF NOT EXISTS expires_at     timestamptz;

-- Full-text search on client profile data
CREATE INDEX IF NOT EXISTS idx_client_profile_search
  ON client_profiles USING gin(
    to_tsvector('english',
      coalesce(onboarding_form::text, '') || ' ' ||
      coalesce(onboarding_data::text, '')
    )
  );

SELECT 'Onboarding profile v2 ✓' as result;

-- ── 4. REVIEW CAMPAIGNS ─────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════
-- REVIEW REQUEST CAMPAIGNS
-- ══════════════════════════════════════════════════════════════════════

-- Campaign definitions (reusable templates per client)
CREATE TABLE IF NOT EXISTS review_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  name            text NOT NULL,
  status          text DEFAULT 'draft',   -- draft|active|paused|archived
  channel         text DEFAULT 'email',   -- email|sms|both
  subject         text,                   -- email subject
  message_email   text,                   -- email body (HTML allowed)
  message_sms     text,                   -- SMS body (max 160 chars)
  review_url      text,                   -- direct Google review link
  send_delay_days int DEFAULT 1,          -- days after job completion to send
  auto_send       boolean DEFAULT false,  -- send automatically vs manually
  total_sent      int DEFAULT 0,
  total_opened    int DEFAULT 0,
  total_clicked   int DEFAULT 0,
  total_reviews   int DEFAULT 0,          -- estimated from clicks
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Individual contacts to send review requests to
CREATE TABLE IF NOT EXISTS review_request_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid REFERENCES review_campaigns(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid,
  name            text NOT NULL,
  email           text,
  phone           text,
  status          text DEFAULT 'pending', -- pending|sent|opened|clicked|bounced|unsubscribed
  channel_used    text,                   -- email|sms
  sent_at         timestamptz,
  opened_at       timestamptz,
  clicked_at      timestamptz,
  token           text UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_req_campaign ON review_request_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_review_req_token    ON review_request_contacts(token);
CREATE INDEX IF NOT EXISTS idx_review_req_client   ON review_request_contacts(client_id, status);

SELECT 'Review campaign tables created ✓' as result;

-- ── 5. SCOUT PIPELINE ───────────────────────────────────────────────────────

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

-- ── 6. MARKETPLACE ─────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════
-- AGENCY MARKETPLACE / ADD-ONS
-- ══════════════════════════════════════════════════════════════════════

-- Master add-on catalog (managed by Koto)
CREATE TABLE IF NOT EXISTS marketplace_addons (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text UNIQUE NOT NULL,       -- 'review_campaigns', 'scout_pipeline', etc.
  name          text NOT NULL,
  description   text,
  category      text DEFAULT 'feature',     -- feature|integration|ai|reporting
  icon          text DEFAULT 'Sparkles',    -- lucide icon name
  price_monthly numeric DEFAULT 0,          -- 0 = included with plan
  price_onetime numeric DEFAULT 0,
  min_plan      text DEFAULT 'starter',     -- minimum plan required: starter|growth|agency
  is_active     boolean DEFAULT true,
  sort_order    int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- Which agencies have which add-ons enabled
CREATE TABLE IF NOT EXISTS agency_addons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   uuid REFERENCES agencies(id) ON DELETE CASCADE,
  addon_key   text NOT NULL,
  enabled     boolean DEFAULT true,
  enabled_by  text DEFAULT 'koto',   -- koto|agency|stripe
  enabled_at  timestamptz DEFAULT now(),
  notes       text,
  UNIQUE(agency_id, addon_key)
);
CREATE INDEX IF NOT EXISTS idx_agency_addons_agency ON agency_addons(agency_id, enabled);

-- Agency add-on requests (agency asks Koto to enable something)
CREATE TABLE IF NOT EXISTS addon_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   uuid REFERENCES agencies(id) ON DELETE CASCADE,
  addon_key   text NOT NULL,
  status      text DEFAULT 'pending',  -- pending|approved|denied
  message     text,
  reviewed_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- Seed core add-ons catalog
INSERT INTO marketplace_addons (key, name, description, category, icon, price_monthly, min_plan, sort_order) VALUES
  ('review_campaigns',    'Review Request Campaigns',    'Send branded review requests via email & SMS. Track opens, clicks, conversions.',     'feature',     'Star',          0,   'starter', 1),
  ('scout_pipeline',      'Scout Pipeline CRM',          'Kanban pipeline to track leads from Scout to signed client.',                          'feature',     'Target',        0,   'starter', 2),
  ('proposal_library',    'Proposal Library & AI',       'Upload past proposals, extract modules, generate new docs in your voice.',             'ai',          'FileText',      0,   'starter', 3),
  ('client_portal',       'White-Label Client Portal',   'Branded client-facing portal with reports, reviews, projects, and support.',           'feature',     'Globe',         0,   'growth',  4),
  ('autonomous_agent',    'Autonomous CMO Agent',        'Claude + GPT-4 + Gemini running 24/7. Insights, action plans, real-time chat.',        'ai',          'Brain',         0,   'starter', 5),
  ('weekly_digest',       'Weekly Email Digest',         'Automated Monday digest to your inbox: insights, alerts, SLA breaches, client stats.', 'reporting',   'Mail',          0,   'starter', 6),
  ('gsc_ga4',             'GSC & GA4 Integration',       'Connect Google Search Console and Analytics for real keyword and traffic data.',        'integration', 'BarChart2',     0,   'growth',  7),
  ('onboarding_auto',     'Client Onboarding Automation','Branded onboarding emails + auto-create agent config when client submits.',            'feature',     'CheckCircle',   0,   'starter', 8),
  ('gbp_audit',           'GBP Audit Tool',              'Score and optimize Google Business Profiles for all clients.',                          'feature',     'MapPin',        0,   'starter', 9),
  ('rank_tracker',        'Local Rank Tracker',          'Grid-based heatmap showing local rankings across service areas.',                      'feature',     'TrendingUp',    0,   'growth',  10),
  ('competitor_intel',    'Competitor Intelligence',     'Track and compare competitor rankings, traffic, and content gaps.',                     'feature',     'Shield',        0,   'growth',  11),
  ('white_label_reports', 'White-Label PDF Reports',     'Branded PDF-ready monthly reports to send directly to clients.',                       'reporting',   'FileText',      0,   'growth',  12),
  ('api_access',          'API Access',                  'Full API access to all Koto data and automations via REST.',                            'integration', 'Code2',         0,   'agency',  13),
  ('custom_domain',       'Custom Domain Portal',        'Host the client portal on your own domain (e.g. portal.youragency.com).',              'feature',     'Globe',         0,   'agency',  14),
  ('twilio_sms',          'Twilio SMS Integration',      'Send review requests and alerts via SMS through your Twilio account.',                  'integration', 'MessageSquare', 0,   'starter', 15),
  ('performance_ai',      'Performance Marketing AI',    'AI analysis of Google Ads campaigns with automated optimization recommendations.',      'ai',          'Zap',           97,  'growth',  16),
  ('ai_content',          'AI Content Engine',           'Generate SEO blog posts, GBP posts, and social content at scale.',                     'ai',          'Sparkles',      147, 'growth',  17)
ON CONFLICT (key) DO NOTHING;

SELECT 'Marketplace tables created ✓' as result;
SELECT 'All Koto tables created/updated ✓' as result;
