-- ══════════════════════════════════════════════════════════════════════════════
-- KOTO 3-TIER PERMISSION SYSTEM
-- Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Platform admins table (Koto super admins)
CREATE TABLE IF NOT EXISTS koto_platform_admins (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email      text NOT NULL,
  name       text,
  created_at timestamptz DEFAULT now()
);

-- Insert adam@hellokoto.com as first platform admin
INSERT INTO koto_platform_admins (user_id, email, name)
SELECT id, email, raw_user_meta_data->>'full_name'
FROM auth.users WHERE email = 'adam@hellokoto.com'
ON CONFLICT DO NOTHING;

-- 2. Agency white-label settings
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS brand_primary_color text DEFAULT '#ea2729';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS brand_secondary_color text DEFAULT '#5bc6d0';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS custom_domain text;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS plan_client_limit integer DEFAULT 10;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS owner_email text;

-- 3. Client permissions table
CREATE TABLE IF NOT EXISTS koto_client_permissions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL,
  agency_id             uuid NOT NULL,
  can_view_pages        boolean DEFAULT true,
  can_view_reviews      boolean DEFAULT true,
  can_view_reports      boolean DEFAULT true,
  can_view_rankings     boolean DEFAULT true,
  can_view_tasks        boolean DEFAULT true,
  can_edit_tasks        boolean DEFAULT false,
  can_view_proposals    boolean DEFAULT false,
  can_view_billing      boolean DEFAULT false,
  can_use_page_builder  boolean DEFAULT false,
  can_use_seo_hub       boolean DEFAULT false,
  can_use_scout         boolean DEFAULT false,
  can_use_voice_agent   boolean DEFAULT false,
  can_use_cmo_agent     boolean DEFAULT false,
  custom_dashboard_message text,
  show_agency_branding  boolean DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  UNIQUE(client_id, agency_id)
);

-- 4. Agency staff enhancements
ALTER TABLE agency_members ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}';
ALTER TABLE agency_members ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE agency_members ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_platform_admins_user ON koto_platform_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_admins_email ON koto_platform_admins(email);
CREATE INDEX IF NOT EXISTS idx_client_permissions_client ON koto_client_permissions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_permissions_agency ON koto_client_permissions(agency_id);

-- 6. RLS
ALTER TABLE koto_platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_client_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_admins_all" ON koto_platform_admins;
CREATE POLICY "platform_admins_all" ON koto_platform_admins FOR ALL USING (true);
DROP POLICY IF EXISTS "client_permissions_all" ON koto_client_permissions;
CREATE POLICY "client_permissions_all" ON koto_client_permissions FOR ALL USING (true);
