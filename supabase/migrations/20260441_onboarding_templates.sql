-- Onboarding Templates System

CREATE TABLE IF NOT EXISTS koto_onboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Default Onboarding',
  description text,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS koto_onboarding_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES koto_onboarding_templates(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  question_text text NOT NULL,
  question_type text DEFAULT 'text',
  options jsonb DEFAULT '[]',
  placeholder text,
  help_text text,
  required boolean DEFAULT false,
  order_index integer DEFAULT 0,
  section text DEFAULT 'general',
  section_label text,
  industry_specific boolean DEFAULT false,
  applicable_industries text[] DEFAULT '{}',
  maps_to_column text,
  ai_generated boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO koto_onboarding_templates (name, description, is_active, is_default)
VALUES ('Standard Onboarding', 'Default client onboarding questionnaire', true, true)
ON CONFLICT DO NOTHING;

-- Client columns for onboarding + social data
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_token text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_answers jsonb DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_template_id uuid;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_name text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_title text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_phone text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_email text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_hours text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS year_founded text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS num_employees text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS service_area text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS primary_service text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS secondary_services text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS target_customer text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS avg_deal_size text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS marketing_channels text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS marketing_budget text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_business_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS facebook_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS instagram_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tiktok_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS youtube_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS competitor_1 text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS competitor_2 text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS competitor_3 text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS unique_selling_prop text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_colors text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_voice text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS review_platforms text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS review_count text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS review_rating text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hosting_provider text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS crm_used text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS referral_sources text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS website_data jsonb DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_business_data jsonb DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS facebook_data jsonb DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS instagram_data jsonb DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS linkedin_data jsonb DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tiktok_data jsonb DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS youtube_data jsonb DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS social_last_scanned_at timestamptz;

UPDATE clients SET onboarding_token = gen_random_uuid()::text WHERE onboarding_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_onboarding_q_template ON koto_onboarding_questions(template_id, order_index);
CREATE INDEX IF NOT EXISTS idx_clients_onboarding_token ON clients(onboarding_token);

ALTER TABLE koto_onboarding_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_onboarding_templates ON koto_onboarding_templates;
CREATE POLICY allow_all_onboarding_templates ON koto_onboarding_templates FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE koto_onboarding_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_onboarding_questions ON koto_onboarding_questions;
CREATE POLICY allow_all_onboarding_questions ON koto_onboarding_questions FOR ALL USING (true) WITH CHECK (true);
