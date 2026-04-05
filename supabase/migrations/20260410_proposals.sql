-- ══════════════════════════════════════════════════════════════════════════════
-- PROPOSALS, AGREEMENTS & E-SIGNATURES
-- Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- Service module library (agency's reusable service templates)
CREATE TABLE IF NOT EXISTS service_modules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid REFERENCES agencies(id) ON DELETE CASCADE,
  name          text NOT NULL,
  category      text NOT NULL DEFAULT 'general',
  description   text,
  deliverables  jsonb DEFAULT '[]',
  timeline      text,
  price         numeric,
  price_type    text DEFAULT 'monthly', -- monthly|one_time|hourly|custom
  sort_order    int DEFAULT 0,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Proposals
CREATE TABLE IF NOT EXISTS proposals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  title           text NOT NULL,
  status          text DEFAULT 'draft', -- draft|sent|viewed|accepted|declined|agreement
  type            text DEFAULT 'proposal', -- proposal|agreement|sow
  intro           text,
  executive_summary text,
  terms           text,
  total_value     numeric DEFAULT 0,
  currency        text DEFAULT 'USD',
  valid_until     date,
  sent_at         timestamptz,
  viewed_at       timestamptz,
  accepted_at     timestamptz,
  declined_at     timestamptz,
  public_token    text UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Sections within a proposal (ordered service modules + custom blocks)
CREATE TABLE IF NOT EXISTS proposal_sections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     uuid REFERENCES proposals(id) ON DELETE CASCADE,
  module_id       uuid REFERENCES service_modules(id) ON DELETE SET NULL,
  type            text DEFAULT 'service', -- service|text|pricing|timeline|custom
  title           text NOT NULL,
  content         text,
  deliverables    jsonb DEFAULT '[]',
  price           numeric,
  price_type      text DEFAULT 'monthly',
  timeline        text,
  sort_order      int DEFAULT 0,
  is_optional     boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- E-signatures on proposals
CREATE TABLE IF NOT EXISTS proposal_signatures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     uuid REFERENCES proposals(id) ON DELETE CASCADE,
  signer_name     text NOT NULL,
  signer_email    text,
  signer_title    text,
  signature_data  text, -- base64 PNG of drawn signature
  ip_address      text,
  signed_at       timestamptz DEFAULT now(),
  party           text DEFAULT 'client' -- client|agency
);

-- Ensure columns exist (tables may have been created without them)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE service_modules ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE proposal_sections ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_proposals_agency    ON proposals(agency_id);
CREATE INDEX IF NOT EXISTS idx_proposals_client    ON proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_token     ON proposals(public_token);
CREATE INDEX IF NOT EXISTS idx_proposal_sections   ON proposal_sections(proposal_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_service_modules_agency ON service_modules(agency_id);

-- ── Seed sample service modules for bypass agency ─────────────────────────────
INSERT INTO service_modules (agency_id, name, category, description, deliverables, timeline, price, price_type, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000099', 'Review Management & Response', 'reputation',
   'Monitor and respond to all Google, Yelp, and Facebook reviews using AI in your brand voice.',
   '["AI-powered review responses within 24hrs","Monthly review performance report","Review widget on website","Platform: Google, Yelp, Facebook"]',
   '30 days setup', 297, 'monthly', 1),

  ('00000000-0000-0000-0000-000000000099', 'Google Business Profile Optimization', 'local_seo',
   'Full audit and optimization of your Google Business Profile to maximize local search visibility.',
   '["Complete GBP audit and optimization","Weekly posting schedule (4 posts/mo)","Q&A management","Photo optimization","Competitor benchmarking report"]',
   '2 weeks', 497, 'one_time', 2),

  ('00000000-0000-0000-0000-000000000099', 'Local SEO Package', 'local_seo',
   'Ongoing local SEO management to rank your business in the local map pack and organic results.',
   '["Monthly keyword ranking report","Citation building and cleanup","On-page SEO optimization","Google Search Console monitoring","Monthly SEO report"]',
   'Ongoing', 697, 'monthly', 3),

  ('00000000-0000-0000-0000-000000000099', 'Website Redesign', 'web',
   'Professional conversion-focused website designed to turn visitors into leads.',
   '["Custom design (up to 8 pages)","Mobile responsive","SEO-optimized structure","Contact forms and CTAs","1 round of revisions","2-week launch timeline"]',
   '4-6 weeks', 3500, 'one_time', 4),

  ('00000000-0000-0000-0000-000000000099', 'Social Media Management', 'social',
   'Done-for-you social media content creation and posting across your key platforms.',
   '["12 posts/month (3x/week)","Custom branded graphics","Caption copywriting","Platform: Instagram, Facebook","Monthly analytics report"]',
   'Ongoing', 597, 'monthly', 5),

  ('00000000-0000-0000-0000-000000000099', 'Google Ads Management', 'paid_ads',
   'Full management of your Google Ads campaigns to drive qualified leads at the lowest cost.',
   '["Campaign strategy and setup","Keyword research and targeting","Ad copy creation and testing","Weekly bid optimization","Monthly performance report"]',
   'Ongoing', 797, 'monthly', 6),

  ('00000000-0000-0000-0000-000000000099', 'Full-Service Marketing Retainer', 'retainer',
   'Comprehensive monthly marketing management covering all channels — reviews, SEO, social, and ads.',
   '["All services in Review Management","All services in Local SEO","All services in Social Media","Monthly strategy call","Priority support"]',
   'Ongoing', 1997, 'monthly', 7)

ON CONFLICT DO NOTHING;
