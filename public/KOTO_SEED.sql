-- ═══════════════════════════════════════════════════════════
-- KOTO PLATFORM SEED — Run in Supabase SQL Editor
-- Sets up Adam's agency and links bypass user to it
-- ═══════════════════════════════════════════════════════════

-- 1. Ensure your agency exists (safe to re-run)
INSERT INTO agencies (
  id, name, slug, owner_id, plan, plan_seats, max_clients,
  status, brand_name, brand_color, billing_email
) VALUES (
  '00000000-0000-0000-0000-000000000099',
  'Koto Agency',
  'koto',
  '00000000-0000-0000-0000-000000000001',
  'agency',
  999,
  999,
  'active',
  'Koto',
  '#ea2729',
  'adam@hellokoto.com'
) ON CONFLICT (id) DO UPDATE SET
  status = 'active',
  plan = 'agency',
  updated_at = now();

-- 2. Link agency features
INSERT INTO agency_features (agency_id, feature_key, enabled)
VALUES
  ('00000000-0000-0000-0000-000000000099', 'ai_reports', true),
  ('00000000-0000-0000-0000-000000000099', 'scout', true),
  ('00000000-0000-0000-0000-000000000099', 'white_label', true),
  ('00000000-0000-0000-0000-000000000099', 'api_access', true)
ON CONFLICT DO NOTHING;

-- 3. Update all existing clients to belong to this agency
UPDATE clients SET agency_id = '00000000-0000-0000-0000-000000000099'
WHERE agency_id IS NULL;

-- Done. Your agency is set up.
SELECT 'Koto agency seed complete ✓' as result;
