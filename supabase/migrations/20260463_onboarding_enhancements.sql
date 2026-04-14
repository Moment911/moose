ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_call_summary text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_confidence_scores jsonb DEFAULT '{}'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_sentiment_score int;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_hot_lead boolean DEFAULT false;
