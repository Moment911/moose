-- ─────────────────────────────────────────────────────────────
-- Multi-provider AI cost tracking
--
-- Adds the provider column to koto_token_usage (anthropic, openai,
-- google, retell, other) and creates koto_platform_costs for flat
-- subscription/top-up fees that don't fit the per-token model
-- (Claude.ai Max Plan, Extra Usage credits, refunds).
--
-- Historical seed data is in seed-costs.mjs (run once via the
-- Supabase Management API). CSV imports use the import_csv action
-- on /api/token-usage which also writes to koto_token_usage with
-- feature='historical' and metadata.source='csv_import'.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE koto_token_usage
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'anthropic';

CREATE INDEX IF NOT EXISTS idx_token_usage_provider
  ON koto_token_usage(provider);

-- Partial unique index so CSV re-imports on the same (date, model, api_key)
-- triplet are idempotent without forcing session_id NOT NULL on live logs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_usage_session
  ON koto_token_usage(session_id)
  WHERE session_id IS NOT NULL;

-- Flat-fee platform costs — subscriptions, top-ups, refunds.
CREATE TABLE IF NOT EXISTS koto_platform_costs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cost_type text NOT NULL,
  amount numeric(12,4) NOT NULL,
  description text,
  date date NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_costs_type
  ON koto_platform_costs(cost_type);
CREATE INDEX IF NOT EXISTS idx_platform_costs_date
  ON koto_platform_costs(date);

ALTER TABLE koto_platform_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_costs_all ON koto_platform_costs;
CREATE POLICY platform_costs_all
  ON koto_platform_costs
  FOR ALL USING (true) WITH CHECK (true);
