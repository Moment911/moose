-- ============================================================
-- Help Center
-- Articles + feedback for the AI help assistant
-- Idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS koto_help_articles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  module text NOT NULL,
  section text,
  title text NOT NULL,
  content text NOT NULL,
  summary text,
  keywords text[] DEFAULT '{}',
  order_in_module int DEFAULT 0,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS koto_help_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid,
  article_slug text,
  question text,
  answer text,
  was_helpful boolean,
  context_page text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_help_module ON koto_help_articles(module, order_in_module);
CREATE INDEX IF NOT EXISTS idx_help_slug   ON koto_help_articles(slug);
CREATE INDEX IF NOT EXISTS idx_help_published ON koto_help_articles(module) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_help_feedback_time ON koto_help_feedback(created_at DESC);

ALTER TABLE koto_help_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_help_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "help_read_all"    ON koto_help_articles;
CREATE POLICY "help_read_all"    ON koto_help_articles FOR SELECT USING (true);

DROP POLICY IF EXISTS "help_write_admin" ON koto_help_articles;
CREATE POLICY "help_write_admin" ON koto_help_articles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "feedback_all"     ON koto_help_feedback;
CREATE POLICY "feedback_all"     ON koto_help_feedback FOR ALL USING (true) WITH CHECK (true);
