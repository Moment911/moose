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
