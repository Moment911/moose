-- ─────────────────────────────────────────────────────────────
-- Category budgets for the Expense Intelligence dashboard
--
-- One row per (agency_id, category). category values map to
-- the 6 buckets in CATEGORY_FOR_COST_TYPE (ai_llms, voice_phone,
-- infrastructure, data_search, business_tools, other). The
-- dashboard normalizes window spend to a 30-day burn rate so
-- the monthly_budget comparison works regardless of the window.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS koto_category_budgets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid,
  category text NOT NULL,
  monthly_budget numeric(12,2) NOT NULL,
  alert_threshold_pct int DEFAULT 80,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique per (agency, category). COALESCE lets NULL agency_id
-- (global/platform-wide budget) be deduped too.
CREATE UNIQUE INDEX IF NOT EXISTS idx_category_budgets_unique
  ON koto_category_budgets (
    COALESCE(agency_id, '00000000-0000-0000-0000-000000000000'::uuid),
    category
  );

ALTER TABLE koto_category_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS category_budgets_all ON koto_category_budgets;
CREATE POLICY category_budgets_all
  ON koto_category_budgets
  FOR ALL USING (true) WITH CHECK (true);
