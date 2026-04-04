-- ══════════════════════════════════════════════════════════════════════════════
-- MOOSE AI — Multi-Tenant Agency Platform Migration
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. AGENCIES (tenants) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agencies (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,          -- used in URLs / white-label subdomain
  owner_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  plan            text NOT NULL DEFAULT 'starter', -- starter|growth|pro|enterprise
  plan_seats      int  NOT NULL DEFAULT 3,
  status          text NOT NULL DEFAULT 'active', -- active|suspended|cancelled|trial
  trial_ends_at   timestamptz DEFAULT (now() + interval '14 days'),
  -- Branding (white-label)
  brand_name      text,
  brand_logo_url  text,
  brand_color     text DEFAULT '#E8551A',
  brand_domain    text,                          -- custom domain e.g. app.theiragency.com
  -- Billing
  stripe_customer_id    text,
  stripe_subscription_id text,
  monthly_price   numeric(10,2) DEFAULT 297,
  billing_email   text,
  -- Limits
  max_clients     int DEFAULT 25,
  -- Meta
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── 2. AGENCY MEMBERS (staff seats) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agency_members (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id   uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member',   -- owner|admin|member|viewer
  invited_by  uuid REFERENCES auth.users(id),
  invited_at  timestamptz DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(agency_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_members_agency ON agency_members(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_members_user   ON agency_members(user_id);

-- ── 3. ADD agency_id TO ALL EXISTING TABLES ──────────────────────────────────
ALTER TABLE clients         ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE onboarding_tokens ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE moose_wp_sites  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE moose_review_queue ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_clients_agency         ON clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_client_profiles_agency ON client_profiles(agency_id);

-- ── 4. AGENCY INVITATIONS ─────────────────────────────────────────────────────
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

-- ── 5. AGENCY USAGE / BILLING EVENTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agency_usage (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id   uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  event_type  text NOT NULL,  -- 'ai_call'|'onboarding_sent'|'report_generated'
  client_id   uuid,
  tokens_used int DEFAULT 0,
  cost_cents  int DEFAULT 0,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agency_usage_agency ON agency_usage(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_usage_date   ON agency_usage(agency_id, created_at DESC);

-- ── 6. AGENCY FEATURE FLAGS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agency_features (
  agency_id   uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE PRIMARY KEY,
  ai_personas         boolean DEFAULT true,
  ai_social_posts     boolean DEFAULT false,  -- growth+
  ai_review_responses boolean DEFAULT false,  -- growth+
  ai_lead_qualifier   boolean DEFAULT false,  -- pro+
  white_label         boolean DEFAULT false,  -- pro+
  custom_domain       boolean DEFAULT false,  -- enterprise
  api_access          boolean DEFAULT false,  -- enterprise
  max_ai_calls_month  int DEFAULT 500
);

-- ── 7. RLS POLICIES ──────────────────────────────────────────────────────────
ALTER TABLE agencies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_usage    ENABLE ROW LEVEL SECURITY;

-- Agency members can see their own agency
CREATE POLICY IF NOT EXISTS "members_see_own_agency" ON agencies
  FOR SELECT USING (
    id IN (SELECT agency_id FROM agency_members WHERE user_id = auth.uid())
  );

-- Only owners/admins can update agency
CREATE POLICY IF NOT EXISTS "admins_update_agency" ON agencies
  FOR UPDATE USING (
    id IN (SELECT agency_id FROM agency_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
  );

-- Agency members can see other members
CREATE POLICY IF NOT EXISTS "members_see_agency_members" ON agency_members
  FOR SELECT USING (
    agency_id IN (SELECT agency_id FROM agency_members WHERE user_id = auth.uid())
  );

-- Clients scoped to agency
CREATE POLICY IF NOT EXISTS "clients_scoped_to_agency" ON clients
  FOR ALL USING (
    agency_id IN (SELECT agency_id FROM agency_members WHERE user_id = auth.uid())
  );

-- ── 8. HELPER FUNCTION: get current user's agency ─────────────────────────────
CREATE OR REPLACE FUNCTION get_user_agency_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT agency_id FROM agency_members
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC LIMIT 1;
$$;
