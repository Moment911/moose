-- ─────────────────────────────────────────────────────────────
-- Platform costs expansion + historical seed
--
-- Adds the unit_count and agency_id columns to koto_platform_costs
-- and backfills 45 rows of historical cost data (Feb-Apr 2026) for
-- Vercel, Supabase, GoHighLevel, Claude.ai (Max Plan + extras),
-- Retell numbers, HeyGen, and Twilio placeholders.
--
-- Was run via the Supabase Management API from seed-all-platform.mjs —
-- this file is the canonical record so fresh clones can re-run it.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE koto_platform_costs ADD COLUMN IF NOT EXISTS agency_id uuid;
ALTER TABLE koto_platform_costs ADD COLUMN IF NOT EXISTS unit_count int DEFAULT 1;

-- Idempotent wipe of previous seed tags before re-inserting
DELETE FROM koto_platform_costs
  WHERE metadata->>'source' IN ('claude.ai','seed_historical_2026');

INSERT INTO koto_platform_costs (cost_type, amount, unit_count, description, date, metadata) VALUES
-- Vercel Pro
('vercel', 20.00, 1, 'Vercel Pro plan', '2026-02-01', '{"plan":"pro","recurring":true,"source":"seed_historical_2026"}'::jsonb),
('vercel', 20.00, 1, 'Vercel Pro plan', '2026-03-01', '{"plan":"pro","recurring":true,"source":"seed_historical_2026"}'::jsonb),
('vercel', 20.00, 1, 'Vercel Pro plan', '2026-04-01', '{"plan":"pro","recurring":true,"source":"seed_historical_2026"}'::jsonb),
-- Supabase Pro
('supabase', 25.00, 1, 'Supabase Pro plan', '2026-02-01', '{"plan":"pro","recurring":true,"source":"seed_historical_2026"}'::jsonb),
('supabase', 25.00, 1, 'Supabase Pro plan', '2026-03-01', '{"plan":"pro","recurring":true,"source":"seed_historical_2026"}'::jsonb),
('supabase', 25.00, 1, 'Supabase Pro plan', '2026-04-01', '{"plan":"pro","recurring":true,"source":"seed_historical_2026"}'::jsonb),
-- GoHighLevel
('ghl', 297.00, 1, 'GoHighLevel agency plan', '2026-02-01', '{"plan":"agency","recurring":true,"source":"seed_historical_2026"}'::jsonb),
('ghl', 297.00, 1, 'GoHighLevel agency plan', '2026-03-01', '{"plan":"agency","recurring":true,"source":"seed_historical_2026"}'::jsonb),
('ghl', 297.00, 1, 'GoHighLevel agency plan', '2026-04-01', '{"plan":"agency","recurring":true,"source":"seed_historical_2026"}'::jsonb),
-- Claude.ai Max Plan (three monthly subscriptions)
('claude_ai_max', 200.00, 1, 'Claude.ai Max Plan', '2026-02-12', '{"source":"claude.ai","type":"subscription","recurring":true}'::jsonb),
('claude_ai_max', 200.00, 1, 'Claude.ai Max Plan', '2026-03-13', '{"source":"claude.ai","type":"subscription","recurring":true}'::jsonb),
('claude_ai_max', 200.00, 1, 'Claude.ai Max Plan', '2026-04-13', '{"source":"claude.ai","type":"subscription","recurring":true}'::jsonb),
-- Claude.ai Extra Usage (29 entries from billing screenshot)
('claude_ai_extra', 5.00,   1, 'Claude.ai extra usage', '2026-02-19', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 5.00,   1, 'Claude.ai extra usage', '2026-02-19', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 10.62,  1, 'Claude.ai extra usage', '2026-03-02', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 5.00,   1, 'Claude.ai extra usage', '2026-03-05', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 5.00,   1, 'Claude.ai extra usage', '2026-03-06', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 5.00,   1, 'Claude.ai extra usage', '2026-03-08', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 5.00,   1, 'Claude.ai extra usage', '2026-03-10', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 5.00,   1, 'Claude.ai extra usage', '2026-03-10', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 5.00,   1, 'Claude.ai extra usage', '2026-03-10', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 5.00,   1, 'Claude.ai extra usage', '2026-03-10', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', -84.07, 1, 'Claude.ai credit/refund', '2026-03-13', '{"source":"claude.ai","type":"refund"}'::jsonb),
('claude_ai_extra', 5.00,   1, 'Claude.ai extra usage', '2026-03-13', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 5.00,   1, 'Claude.ai extra usage', '2026-03-13', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 10.00,  1, 'Claude.ai extra usage', '2026-03-13', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 10.45,  1, 'Claude.ai extra usage', '2026-03-13', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 11.96,  1, 'Claude.ai extra usage', '2026-03-13', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 10.49,  1, 'Claude.ai extra usage', '2026-04-01', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 12.23,  1, 'Claude.ai extra usage', '2026-04-01', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 11.49,  1, 'Claude.ai extra usage', '2026-04-01', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 12.64,  1, 'Claude.ai extra usage', '2026-04-01', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 13.65,  1, 'Claude.ai extra usage', '2026-04-01', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 10.01,  1, 'Claude.ai extra usage', '2026-04-02', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 10.60,  1, 'Claude.ai extra usage', '2026-04-02', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 200.00, 1, 'Claude.ai extra usage', '2026-04-05', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 200.00, 1, 'Claude.ai extra usage', '2026-04-07', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 45.00,  1, 'Claude.ai extra usage', '2026-04-07', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 200.00, 1, 'Claude.ai extra usage', '2026-04-10', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 200.00, 1, 'Claude.ai extra usage', '2026-04-10', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
('claude_ai_extra', 200.00, 1, 'Claude.ai extra usage', '2026-04-11', '{"source":"claude.ai","type":"extra_usage"}'::jsonb),
-- Retell phone numbers
('retell_numbers', 16.00, 8, '8 Retell onboarding numbers',         '2026-04-01', '{"unit_cost":2.00,"numbers":8,"source":"seed_historical_2026"}'::jsonb),
('retell_numbers', 6.00,  3, '3 Retell numbers (Mar partial)',      '2026-03-15', '{"unit_cost":2.00,"numbers":3,"source":"seed_historical_2026"}'::jsonb),
-- Placeholders (verify usage before real charges land)
('heygen_api',   0.00, 0, 'HeyGen free plan — no usage yet',         '2026-04-01', '{"plan":"free","pay_per_use":true,"source":"seed_historical_2026"}'::jsonb),
('twilio_voice', 0.00, 0, 'Twilio — configured, verify usage',        '2026-04-01', '{"status":"verify_needed","source":"seed_historical_2026"}'::jsonb);
