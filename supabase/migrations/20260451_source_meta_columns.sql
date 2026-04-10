-- ============================================================
-- Test data tagging — add source_meta jsonb to every table the
-- Test Data Generator writes to. Idempotent and safe on tables
-- that may not exist (each ALTER is independent).
-- ============================================================

-- Discovery — column exists via earlier phase 2 migration in some
-- environments but not others. Re-add as a no-op safety.
ALTER TABLE koto_discovery_engagements ADD COLUMN IF NOT EXISTS source_meta jsonb DEFAULT '{}'::jsonb;

-- Voice
ALTER TABLE koto_voice_leads ADD COLUMN IF NOT EXISTS source_meta jsonb DEFAULT '{}'::jsonb;
ALTER TABLE koto_voice_calls ADD COLUMN IF NOT EXISTS source_meta jsonb DEFAULT '{}'::jsonb;

-- Scout
ALTER TABLE koto_scout_leads ADD COLUMN IF NOT EXISTS source_meta jsonb DEFAULT '{}'::jsonb;

-- Opportunities
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS source_meta jsonb DEFAULT '{}'::jsonb;

-- Clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS source_meta jsonb DEFAULT '{}'::jsonb;

-- Partial indexes so the counts/clear queries are fast.
CREATE INDEX IF NOT EXISTS idx_disc_eng_test ON koto_discovery_engagements((source_meta->>'is_test')) WHERE source_meta->>'is_test' = 'true';
CREATE INDEX IF NOT EXISTS idx_voice_leads_test ON koto_voice_leads((source_meta->>'is_test')) WHERE source_meta->>'is_test' = 'true';
CREATE INDEX IF NOT EXISTS idx_voice_calls_test ON koto_voice_calls((source_meta->>'is_test')) WHERE source_meta->>'is_test' = 'true';
CREATE INDEX IF NOT EXISTS idx_scout_leads_test ON koto_scout_leads((source_meta->>'is_test')) WHERE source_meta->>'is_test' = 'true';
CREATE INDEX IF NOT EXISTS idx_opps_test ON koto_opportunities((source_meta->>'is_test')) WHERE source_meta->>'is_test' = 'true';
CREATE INDEX IF NOT EXISTS idx_clients_test ON clients((source_meta->>'is_test')) WHERE source_meta->>'is_test' = 'true';
