-- ============================================================
-- Welcome Statement
--
-- Adds a single text column on clients that holds the client's
-- own-words description of their business, captured as the very
-- first question on the onboarding form. This field is the
-- richest context we ever get from a client and is injected into
-- every Koto AI system as primary context:
--   - CMO agent system prompt
--   - Discovery pre-research + interview mode + audit
--   - Help assistant when a client is named
--   - Voice pre-call brief
--   - Client report insights
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS welcome_statement text;

-- Partial index — only index rows that actually have a welcome statement
-- so the "clients with self-description" lookups used by the CMO agent
-- morning briefing stay fast.
CREATE INDEX IF NOT EXISTS idx_clients_welcome
  ON clients(agency_id)
  WHERE welcome_statement IS NOT NULL;
