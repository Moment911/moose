-- Feature permission control system

-- Expand agency_features with all platform features (add missing columns)
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS page_builder boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS wordpress_plugin boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS seo_hub boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS reviews boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS review_campaigns boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS proposals boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS proposal_library boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS automations boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS tasks boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS koto_desk boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS help_center boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS scout boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS pipeline_crm boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS performance_dashboard boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS cmo_agent boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS voice_agent boolean DEFAULT false;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS answering_service boolean DEFAULT false;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS ai_page_research boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS ai_script_generation boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS client_billing boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS credit_system boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS phone_numbers boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS team_management boolean DEFAULT true;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS api_access boolean DEFAULT false;
ALTER TABLE agency_features ADD COLUMN IF NOT EXISTS custom_domain boolean DEFAULT false;

-- Client permissions (agency controls what each client sees)
CREATE TABLE IF NOT EXISTS koto_client_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  client_id uuid NOT NULL UNIQUE,
  -- Visibility
  can_view_pages boolean DEFAULT true,
  can_view_rankings boolean DEFAULT true,
  can_view_reviews boolean DEFAULT true,
  can_view_reports boolean DEFAULT true,
  can_view_tasks boolean DEFAULT true,
  can_view_invoices boolean DEFAULT true,
  can_view_proposals boolean DEFAULT true,
  -- Actions
  can_edit_tasks boolean DEFAULT false,
  can_submit_tickets boolean DEFAULT true,
  can_download_reports boolean DEFAULT true,
  can_request_page_changes boolean DEFAULT false,
  -- Tool access
  can_use_page_builder boolean DEFAULT false,
  can_view_seo_hub boolean DEFAULT false,
  can_view_voice_results boolean DEFAULT false,
  can_view_answering_calls boolean DEFAULT false,
  -- Portal settings
  show_agency_branding boolean DEFAULT true,
  custom_welcome_message text,
  show_powered_by_koto boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_perms ON koto_client_permissions(client_id);

ALTER TABLE koto_client_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_client_perms ON koto_client_permissions;
CREATE POLICY allow_all_client_perms ON koto_client_permissions FOR ALL USING (true) WITH CHECK (true);
