ALTER TABLE files ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'needs_review';
ALTER TABLE files ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE files ADD COLUMN IF NOT EXISTS approved_at timestamptz;
