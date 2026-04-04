-- ══════════════════════════════════════════════════════════════════════════════
-- FK FIX + CONSOLIDATED SEED
-- Run this in Supabase SQL Editor if you get FK constraint errors
-- Safe to run multiple times (ON CONFLICT DO NOTHING / DO UPDATE)
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Ensure bypass agency exists (required before any clients with this agency_id)
INSERT INTO agencies (
  id, name, slug, plan, plan_seats, status,
  brand_name, brand_color, max_clients, billing_email
) VALUES (
  '00000000-0000-0000-0000-000000000099',
  'Unified Marketing Group', 'unified-mktg', 'growth', 10, 'active',
  'Unified Marketing Group', '#E8551A', 100, 'adam@unifiedmktg.com'
) ON CONFLICT (id) DO UPDATE SET
  name   = EXCLUDED.name,
  status = 'active';

-- 2. Sample clients (safe to re-run)
INSERT INTO clients (id, name, email, phone, website, industry, agency_id, status) VALUES
  ('00000000-0000-0000-0000-000000000101', 'Miami 24/7 Plumbing',     'info@miami247plumbing.com',   '(305) 440-0878', 'https://miami247plumbing.com',   'Plumbing',      '00000000-0000-0000-0000-000000000099', 'active'),
  ('00000000-0000-0000-0000-000000000102', 'Sunrise HVAC Solutions',  'hello@sunrisehvac.com',       '(786) 555-0201', 'https://sunrisehvac.com',        'HVAC',          '00000000-0000-0000-0000-000000000099', 'active'),
  ('00000000-0000-0000-0000-000000000103', 'Boca Dental Studio',      'scheduling@bocadental.com',   '(561) 555-0134', 'https://bocadentalstudio.com',   'Dental',        '00000000-0000-0000-0000-000000000099', 'active'),
  ('00000000-0000-0000-0000-000000000104', 'South Florida Law Group', 'contact@sflalaw.com',         '(305) 555-0198', 'https://sflalaw.com',            'Law Firm',      '00000000-0000-0000-0000-000000000099', 'active'),
  ('00000000-0000-0000-0000-000000000105', 'FitLife Gym & Wellness',  'info@fitlifegym.com',         '(954) 555-0167', 'https://fitlifegym.com',         'Gym / Fitness', '00000000-0000-0000-0000-000000000099', 'active'),
  ('00000000-0000-0000-0000-000000000106', 'Palm Beach Roofing Co',   'estimates@pbroofing.com',     '(561) 555-0223', 'https://palmbeachroofing.com',   'Roofing',       '00000000-0000-0000-0000-000000000099', 'active'),
  ('00000000-0000-0000-0000-000000000107', 'Coastal Auto Group',      'sales@coastalauto.com',       '(786) 555-0345', 'https://coastalautogroup.com',   'Auto Dealer',   '00000000-0000-0000-0000-000000000099', 'active'),
  ('00000000-0000-0000-0000-000000000108', 'Verde Landscaping',       'info@verdelandscaping.com',   '(305) 555-0189', 'https://verdelandscaping.com',   'Landscaping',   '00000000-0000-0000-0000-000000000099', 'active')
ON CONFLICT (id) DO NOTHING;

-- 3. Sample reviews for Miami 24/7 Plumbing
INSERT INTO moose_review_queue
  (client_id, agency_id, platform, reviewer_name, star_rating, review_text, status, reviewed_at, is_featured)
VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000099',
   'google', 'Michael T.', 5,
   'Called at 10pm with a burst pipe — they were here within the hour. Professional, clean, fixed it fast. Saved us from a disaster. These guys are the real deal.',
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
   'pending', now() - interval '6 hours', false),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000099',
   'yelp', 'Lisa M.', 5,
   'Third time using them and they never disappoint. Consistent, reliable, always professional. My go-to for everyone.',
   'approved', now() - interval '14 days', false)
ON CONFLICT DO NOTHING;

-- 4. Review widget settings for first client
INSERT INTO review_widget_settings
  (client_id, agency_id, widget_enabled, min_stars, display_mode, platforms, primary_color, avg_rating, total_reviews)
VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000099',
   true, 4, 'carousel', ARRAY['google','yelp','facebook'], '#E8551A', 4.3, 6)
ON CONFLICT DO NOTHING;

-- 5. Service modules for proposals (bypass agency)
INSERT INTO service_modules (agency_id, name, category, description, deliverables, timeline, price, price_type, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000099', 'Review Management', 'reputation',
   'Monitor and respond to all Google, Yelp, and Facebook reviews using AI in your brand voice.',
   '["AI review responses within 24hrs","Monthly review performance report","Review widget embed code","Platforms: Google, Yelp, Facebook"]',
   '30-day setup', 297, 'monthly', 1),
  ('00000000-0000-0000-0000-000000000099', 'Google Business Profile Optimization', 'local_seo',
   'Full audit and optimization of your Google Business Profile to maximize local visibility.',
   '["Complete GBP audit","Weekly posts (4/mo)","Q&A management","Photo optimization","Competitor report"]',
   '2 weeks', 497, 'one_time', 2),
  ('00000000-0000-0000-0000-000000000099', 'Local SEO Package', 'local_seo',
   'Ongoing local SEO to rank in the map pack and organic results.',
   '["Monthly ranking report","Citation building","On-page optimization","GSC monitoring"]',
   'Ongoing', 697, 'monthly', 3),
  ('00000000-0000-0000-0000-000000000099', 'Website Redesign', 'web',
   'Conversion-focused website built to turn visitors into leads.',
   '["Custom design up to 8 pages","Mobile responsive","SEO structure","Contact forms","1 revision round"]',
   '4-6 weeks', 3500, 'one_time', 4),
  ('00000000-0000-0000-0000-000000000099', 'Social Media Management', 'social',
   'Done-for-you social content and posting across your key platforms.',
   '["12 posts/month","Branded graphics","Caption copywriting","Instagram + Facebook","Monthly analytics"]',
   'Ongoing', 597, 'monthly', 5),
  ('00000000-0000-0000-0000-000000000099', 'Google Ads Management', 'paid_ads',
   'Full management of Google Ads to drive qualified leads at lowest cost.',
   '["Campaign strategy","Keyword research","Ad copy + testing","Weekly bid optimization","Monthly report"]',
   'Ongoing', 797, 'monthly', 6),
  ('00000000-0000-0000-0000-000000000099', 'Full-Service Retainer', 'retainer',
   'All-in-one monthly marketing management across all channels.',
   '["Review Management","Local SEO","Social Media","Monthly strategy call","Priority support"]',
   'Ongoing', 1997, 'monthly', 7)
ON CONFLICT DO NOTHING;
