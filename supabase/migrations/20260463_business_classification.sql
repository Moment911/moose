-- ============================================================
-- Business classification
--
-- Stores the Claude-derived classification of a client business
-- (B2B vs B2C, local vs national, service vs product, etc.) so
-- every downstream AI system can read it without re-classifying.
--
-- The onboarding form runs classification automatically once the
-- welcome_statement is long enough, then saves the result here.
-- CMO agent, discovery audit, and discovery create all read from
-- this column to tailor their outputs.
--
-- Shape:
--   {
--     "business_model": "b2b" | "b2c" | "both",
--     "geographic_scope": "local" | "regional" | "national" | "international",
--     "business_type": "service" | "product" | "saas" | ...,
--     "sales_cycle": "transactional" | "consultative" | "enterprise",
--     "has_sales_team": bool,
--     "confidence": 0-100,
--     "reasoning": "one-sentence explanation"
--   }
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_classification jsonb;

-- Partial GIN index on the most-queried classification dimensions
CREATE INDEX IF NOT EXISTS idx_clients_business_model
  ON clients((business_classification->>'business_model'))
  WHERE business_classification IS NOT NULL;
