
-- ══════════════════════════════════════════════════════════════════════
-- AGENCY MARKETPLACE / ADD-ONS
-- ══════════════════════════════════════════════════════════════════════

-- Master add-on catalog (managed by Koto)
CREATE TABLE IF NOT EXISTS marketplace_addons (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text UNIQUE NOT NULL,       -- 'review_campaigns', 'scout_pipeline', etc.
  name          text NOT NULL,
  description   text,
  category      text DEFAULT 'feature',     -- feature|integration|ai|reporting
  icon          text DEFAULT 'Sparkles',    -- lucide icon name
  price_monthly numeric DEFAULT 0,          -- 0 = included with plan
  price_onetime numeric DEFAULT 0,
  min_plan      text DEFAULT 'starter',     -- minimum plan required: starter|growth|agency
  is_active     boolean DEFAULT true,
  sort_order    int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- Which agencies have which add-ons enabled
CREATE TABLE IF NOT EXISTS agency_addons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   uuid REFERENCES agencies(id) ON DELETE CASCADE,
  addon_key   text NOT NULL,
  enabled     boolean DEFAULT true,
  enabled_by  text DEFAULT 'koto',   -- koto|agency|stripe
  enabled_at  timestamptz DEFAULT now(),
  notes       text,
  UNIQUE(agency_id, addon_key)
);
CREATE INDEX IF NOT EXISTS idx_agency_addons_agency ON agency_addons(agency_id, enabled);

-- Agency add-on requests (agency asks Koto to enable something)
CREATE TABLE IF NOT EXISTS addon_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   uuid REFERENCES agencies(id) ON DELETE CASCADE,
  addon_key   text NOT NULL,
  status      text DEFAULT 'pending',  -- pending|approved|denied
  message     text,
  reviewed_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- Seed core add-ons catalog
INSERT INTO marketplace_addons (key, name, description, category, icon, price_monthly, min_plan, sort_order) VALUES
  ('review_campaigns',    'Review Request Campaigns',    'Send branded review requests via email & SMS. Track opens, clicks, conversions.',     'feature',     'Star',          0,   'starter', 1),
  ('scout_pipeline',      'Scout Pipeline CRM',          'Kanban pipeline to track leads from Scout to signed client.',                          'feature',     'Target',        0,   'starter', 2),
  ('proposal_library',    'Proposal Library & AI',       'Upload past proposals, extract modules, generate new docs in your voice.',             'ai',          'FileText',      0,   'starter', 3),
  ('client_portal',       'White-Label Client Portal',   'Branded client-facing portal with reports, reviews, projects, and support.',           'feature',     'Globe',         0,   'growth',  4),
  ('autonomous_agent',    'Autonomous CMO Agent',        'Claude + GPT-4 + Gemini running 24/7. Insights, action plans, real-time chat.',        'ai',          'Brain',         0,   'starter', 5),
  ('weekly_digest',       'Weekly Email Digest',         'Automated Monday digest to your inbox: insights, alerts, SLA breaches, client stats.', 'reporting',   'Mail',          0,   'starter', 6),
  ('gsc_ga4',             'GSC & GA4 Integration',       'Connect Google Search Console and Analytics for real keyword and traffic data.',        'integration', 'BarChart2',     0,   'growth',  7),
  ('onboarding_auto',     'Client Onboarding Automation','Branded onboarding emails + auto-create agent config when client submits.',            'feature',     'CheckCircle',   0,   'starter', 8),
  ('gbp_audit',           'GBP Audit Tool',              'Score and optimize Google Business Profiles for all clients.',                          'feature',     'MapPin',        0,   'starter', 9),
  ('rank_tracker',        'Local Rank Tracker',          'Grid-based heatmap showing local rankings across service areas.',                      'feature',     'TrendingUp',    0,   'growth',  10),
  ('competitor_intel',    'Competitor Intelligence',     'Track and compare competitor rankings, traffic, and content gaps.',                     'feature',     'Shield',        0,   'growth',  11),
  ('white_label_reports', 'White-Label PDF Reports',     'Branded PDF-ready monthly reports to send directly to clients.',                       'reporting',   'FileText',      0,   'growth',  12),
  ('api_access',          'API Access',                  'Full API access to all Koto data and automations via REST.',                            'integration', 'Code2',         0,   'agency',  13),
  ('custom_domain',       'Custom Domain Portal',        'Host the client portal on your own domain (e.g. portal.youragency.com).',              'feature',     'Globe',         0,   'agency',  14),
  ('twilio_sms',          'Twilio SMS Integration',      'Send review requests and alerts via SMS through your Twilio account.',                  'integration', 'MessageSquare', 0,   'starter', 15),
  ('performance_ai',      'Performance Marketing AI',    'AI analysis of Google Ads campaigns with automated optimization recommendations.',      'ai',          'Zap',           97,  'growth',  16),
  ('ai_content',          'AI Content Engine',           'Generate SEO blog posts, GBP posts, and social content at scale.',                     'ai',          'Sparkles',      147, 'growth',  17)
ON CONFLICT (key) DO NOTHING;

SELECT 'Marketplace tables created ✓' as result;
