ALTER TABLE seo_keyword_tracking ADD COLUMN IF NOT EXISTS added_at timestamptz DEFAULT now();
