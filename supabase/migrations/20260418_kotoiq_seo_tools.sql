-- ─────────────────────────────────────────────────────────────
-- KotoIQ SEO Tools: Plagiarism Checker, On-Page Analyzer,
-- Rank Grid Pro, ChatGPT Watermark Remover
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kotoiq_plagiarism_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  url text,
  content_preview text,
  originality_score numeric(5,2),
  ai_generation_likelihood numeric(5,2),
  plagiarized_chunks jsonb DEFAULT '[]',
  ai_patterns jsonb DEFAULT '[]',
  recommendations jsonb DEFAULT '[]',
  checked_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kotoiq_on_page_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  url text NOT NULL,
  target_keyword text,
  overall_score numeric(5,2),
  grade text,
  checks jsonb DEFAULT '[]',
  keyword_placement jsonb DEFAULT '{}',
  critical_fixes jsonb DEFAULT '[]',
  quick_wins jsonb DEFAULT '[]',
  scanned_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kotoiq_grid_scans_pro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  business_name text,
  center_lat numeric(10,7),
  center_lng numeric(10,7),
  grid_size integer,
  radius_miles numeric(5,2),
  grid_data jsonb DEFAULT '[]',
  avg_rank numeric(5,2),
  solv_pct numeric(5,2),
  top3_coverage_pct numeric(5,2),
  dead_zones jsonb DEFAULT '[]',
  top_competitors jsonb DEFAULT '[]',
  drift_vs_last jsonb DEFAULT '{}',
  scanned_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kotoiq_watermark_cleans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  original_preview text,
  cleaned_preview text,
  watermarks_removed jsonb DEFAULT '[]',
  patterns_detected jsonb DEFAULT '[]',
  human_score_before numeric(5,2),
  human_score_after numeric(5,2),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plagiarism_client ON kotoiq_plagiarism_checks(client_id);
CREATE INDEX IF NOT EXISTS idx_on_page_client ON kotoiq_on_page_audits(client_id);
CREATE INDEX IF NOT EXISTS idx_grid_pro_client ON kotoiq_grid_scans_pro(client_id);
CREATE INDEX IF NOT EXISTS idx_watermark_client ON kotoiq_watermark_cleans(client_id);
