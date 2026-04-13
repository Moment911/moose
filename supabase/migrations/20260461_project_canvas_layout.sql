ALTER TABLE projects ADD COLUMN IF NOT EXISTS canvas_layout jsonb DEFAULT '{}'::jsonb;
