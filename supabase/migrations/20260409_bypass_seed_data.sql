-- ══════════════════════════════════════════════════════════════════════════════
-- BYPASS MODE SEED DATA
-- Inserts the bypass agency and sample clients so the app works without real auth
-- Run this in Supabase SQL Editor after running 20260408_run_this_in_supabase.sql
-- ══════════════════════════════════════════════════════════════════════════════

-- Insert the bypass agency (matches BYPASS_AGENCY_ID in useAuth.jsx)
INSERT INTO agencies (
  id, name, slug, plan, plan_seats, status,
  brand_name, brand_color, max_clients, billing_email
) VALUES (
  '00000000-0000-0000-0000-000000000099',
  'Unified Marketing Group', 'unified-mktg', 'growth', 10, 'active',
  'Unified Marketing Group', '#E8551A', 100, 'adam@unifiedmktg.com'
) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'active';

-- Insert sample clients linked to the bypass agency
INSERT INTO clients (id, name, email, phone, website, industry, agency_id, status) VALUES
  ('00000000-0000-0000-0000-000000000101', 'Miami 24/7 Plumbing',     'info@miami247plumbing.com',   '(305) 440-0878', 'https://miami247plumbing.com',   'Plumbing',         '00000000-0000-0000-0000-000000000099', 'active'),
  ('00000000-0000-0000-0000-000000000102', 'Sunrise HVAC Solutions',  'hello@sunrisehvac.com',       '(786) 555-0201', 'https://sunrisehvac.com',        'HVAC',             '00000000-0000-0000-0000-000000000099', 'active'),
  ('00000000-0000-0000-0000-000000000103', 'Boca Dental Studio',      'scheduling@bocadental.com',   '(561) 555-0134', 'https://bocadentalstudio.com',   'Dental',           '00000000-0000-0000-0000-000000000099', 'active'),
  ('00000000-0000-0000-0000-000000000104', 'South Florida Law Group', 'contact@sflalaw.com',         '(305) 555-0198', 'https://sflalaw.com',            'Law Firm',         '00000000-0000-0000-0000-000000000099', 'active'),
  ('00000000-0000-0000-0000-000000000105', 'FitLife Gym & Wellness',  'info@fitlifegym.com',         '(954) 555-0167', 'https://fitlifegym.com',         'Gym / Fitness',    '00000000-0000-0000-0000-000000000099', 'active'),
  ('00000000-0000-0000-0000-000000000106', 'Palm Beach Roofing Co',   'estimates@pbroofing.com',     '(561) 555-0223', 'https://palmbeachroofing.com',   'Roofing',          '00000000-0000-0000-0000-000000000099', 'active'),
  ('00000000-0000-0000-0000-000000000107', 'Coastal Auto Group',      'sales@coastalauto.com',       '(786) 555-0345', 'https://coastalautogroup.com',   'Auto Dealer',      '00000000-0000-0000-0000-000000000099', 'active'),
  ('00000000-0000-0000-0000-000000000108', 'Verde Landscaping',       'info@verdelandscaping.com',   '(305) 555-0189', 'https://verdelandscaping.com',   'Landscaping',      '00000000-0000-0000-0000-000000000099', 'active')
ON CONFLICT (id) DO NOTHING;

-- Insert sample reviews for Miami 24/7 Plumbing
INSERT INTO moose_review_queue 
  (client_id, agency_id, platform, reviewer_name, star_rating, review_text, status, reviewed_at, is_featured)
VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000099',
   'google', 'Michael T.', 5,
   'Called at 10pm with a burst pipe — they were here within the hour. Professional, clean, and fixed it fast. Saved us from a disaster. These guys are the real deal.',
   'approved', now() - interval '2 days', true),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000099',
   'google', 'Sarah K.', 5,
   'Best plumber in Miami, hands down. Fair pricing, no surprise charges, and the work was flawless. Will recommend to everyone.',
   'approved', now() - interval '5 days', false),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000099',
   'yelp', 'James R.', 4,
   'Good service overall. On time and did good work. Communication could be a bit better but overall solid.',
   'pending', now() - interval '1 day', false),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000099',
   'facebook', 'Maria L.', 5,
   'Amazing! Emergency at midnight and they showed up. Cannot recommend enough.',
   'approved', now() - interval '10 days', false),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000099',
   'google', 'David H.', 2,
   'Came out for a quote then never showed up for the scheduled job. Had to chase them down. Very disappointed.',
   'pending', now() - interval '6 hours', false)
ON CONFLICT DO NOTHING;

-- Insert review widget settings for Miami 24/7 Plumbing
INSERT INTO review_widget_settings 
  (client_id, agency_id, widget_enabled, min_stars, display_mode, platforms, primary_color, avg_rating, total_reviews)
VALUES 
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000099',
   true, 4, 'carousel', ARRAY['google','yelp','facebook'], '#E8551A', 4.6, 5)
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- DONE — you should now see 8 clients in the sidebar and Reviews module
-- ══════════════════════════════════════════════════════════════════════════════
