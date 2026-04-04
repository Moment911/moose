-- ══════════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE SQL EDITOR → https://app.supabase.com
-- Project: suqpieuasfudgdtylotn
-- Go to: SQL Editor → New Query → paste this → Run
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. AGENCIES TABLE
CREATE TABLE IF NOT EXISTS agencies (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  owner_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  plan            text NOT NULL DEFAULT 'starter',
  plan_seats      int  NOT NULL DEFAULT 3,
  status          text NOT NULL DEFAULT 'trial',
  trial_ends_at   timestamptz DEFAULT (now() + interval '14 days'),
  brand_name      text,
  brand_logo_url  text,
  brand_color     text DEFAULT '#E8551A',
  brand_domain    text,
  stripe_customer_id    text,
  stripe_subscription_id text,
  monthly_price   numeric(10,2) DEFAULT 297,
  billing_email   text,
  max_clients     int DEFAULT 25,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 2. AGENCY MEMBERS
CREATE TABLE IF NOT EXISTS agency_members (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id   uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member',
  invited_by  uuid REFERENCES auth.users(id),
  invited_at  timestamptz DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(agency_id, user_id)
);

-- 3. AGENCY INVITATIONS
CREATE TABLE IF NOT EXISTS agency_invitations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id   uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'member',
  token       text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  invited_by  uuid REFERENCES auth.users(id),
  expires_at  timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- 4. AGENCY FEATURES
CREATE TABLE IF NOT EXISTS agency_features (
  agency_id   uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE PRIMARY KEY,
  ai_personas         boolean DEFAULT true,
  ai_social_posts     boolean DEFAULT false,
  ai_review_responses boolean DEFAULT false,
  ai_lead_qualifier   boolean DEFAULT false,
  white_label         boolean DEFAULT false,
  custom_domain       boolean DEFAULT false,
  api_access          boolean DEFAULT false,
  max_ai_calls_month  int DEFAULT 500
);

-- 5. AGENCY USAGE
CREATE TABLE IF NOT EXISTS agency_usage (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id   uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  client_id   uuid,
  tokens_used int DEFAULT 0,
  cost_cents  int DEFAULT 0,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

-- 6. CRM INTEGRATIONS
CREATE TABLE IF NOT EXISTS crm_integrations (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id       uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  provider        text NOT NULL,
  name            text NOT NULL,
  status          text NOT NULL DEFAULT 'disconnected',
  access_token    text,
  refresh_token   text,
  token_expires_at timestamptz,
  location_id     text,
  company_id      text,
  webhook_secret  text,
  config          jsonb DEFAULT '{}',
  sync_settings   jsonb DEFAULT '{}',
  last_sync_at    timestamptz,
  last_error      text,
  total_synced    int DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 7. CRM SYNC LOG
CREATE TABLE IF NOT EXISTS crm_sync_log (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id uuid NOT NULL REFERENCES crm_integrations(id) ON DELETE CASCADE,
  agency_id     uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id     uuid,
  direction     text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     text,
  moose_id      uuid,
  action        text NOT NULL,
  status        text NOT NULL DEFAULT 'success',
  payload       jsonb DEFAULT '{}',
  error_msg     text,
  created_at    timestamptz DEFAULT now()
);

-- 8. ADD agency_id TO EXISTING TABLES
ALTER TABLE clients ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ghl_contact_id text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ghl_location_id text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS crm_external_ids jsonb DEFAULT '{}';

ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS business_type text;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS year_founded text;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS num_employees text;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS annual_revenue text;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS contact jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS products_services jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS customers jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS competitors jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS geography jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS cms jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS tracking jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS goals jsonb DEFAULT '{}';
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS ai_persona jsonb;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS persona_approved boolean DEFAULT false;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS persona_notes text;

-- 9. REVIEW WIDGET SETTINGS
CREATE TABLE IF NOT EXISTS review_widget_settings (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  site_id         uuid,
  widget_enabled  boolean DEFAULT true,
  badge_enabled   boolean DEFAULT true,
  min_stars       int DEFAULT 4,
  max_reviews     int DEFAULT 20,
  platforms       text[] DEFAULT ARRAY['google','yelp','facebook'],
  display_mode    text DEFAULT 'carousel',
  badge_position  text DEFAULT 'bottom-left',
  theme           text DEFAULT 'light',
  primary_color   text DEFAULT '#E8551A',
  show_platform_icons boolean DEFAULT true,
  show_reviewer_photo boolean DEFAULT true,
  show_date       boolean DEFAULT true,
  show_response   boolean DEFAULT false,
  embed_key       text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  avg_rating      numeric(3,2) DEFAULT 0,
  total_reviews   int DEFAULT 0,
  last_fetched_at timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 10. EXPAND moose_review_queue
ALTER TABLE moose_review_queue ADD COLUMN IF NOT EXISTS platform text DEFAULT 'google';
ALTER TABLE moose_review_queue ADD COLUMN IF NOT EXISTS reviewer_avatar text;
ALTER TABLE moose_review_queue ADD COLUMN IF NOT EXISTS review_url text;
ALTER TABLE moose_review_queue ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE moose_review_queue ADD COLUMN IF NOT EXISTS response_posted_at timestamptz;
ALTER TABLE moose_review_queue ADD COLUMN IF NOT EXISTS agency_id uuid;
ALTER TABLE moose_review_queue ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- 11. ACCESS + HISTORY TABLES
ALTER TABLE clients ADD COLUMN IF NOT EXISTS access_checklist jsonb DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS access_form_token text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS agency_email_override text;

CREATE TABLE IF NOT EXISTS client_change_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  changed_by text NOT NULL,
  changed_by_email text,
  change_type text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  description text,
  staff_note text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 12. INDEXES
CREATE INDEX IF NOT EXISTS idx_agency_members_user    ON agency_members(user_id);
CREATE INDEX IF NOT EXISTS idx_agency_members_agency  ON agency_members(agency_id);
CREATE INDEX IF NOT EXISTS idx_clients_agency          ON clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_crm_integrations_agency ON crm_integrations(agency_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_log_integration ON crm_sync_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_review_widget_embed_key  ON review_widget_settings(embed_key);
CREATE INDEX IF NOT EXISTS idx_client_change_history_client ON client_change_history(client_id);

-- 13. HELPER FUNCTION
CREATE OR REPLACE FUNCTION get_user_agency_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT agency_id FROM agency_members
  WHERE user_id = auth.uid()
  ORDER BY invited_at ASC LIMIT 1;
$$;

-- DONE! All tables created.
