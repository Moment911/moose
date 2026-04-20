-- Scout seller industries + question banks + website-scanner profiles.
--
-- The agent's industry = what the SELLER does (e.g., "Marketing Agency")
-- — NOT the prospect's industry. Setup picks a seller_industry to load a
-- curated starter bank, optionally scans the seller's website to generate
-- a custom bank tailored to their specific services.
--
-- Architecture:
--   scout_seller_industries   — dropdown list + default bank pointer
--   scout_seller_profiles     — one row per website scan (services,
--                               vocabulary, proof points, positioning)
--   scout_question_banks      — id, source, status, question_count
--   scout_questions (EXTEND)  — bank_id, services_qualified, stage,
--                               exploration_status, promoted_from_bank_id
--   scout_voice_agents (EXTEND) — seller_industry_slug, seller_website_url,
--                                  active_bank_id, bank_mode
--   scout_promotion_suggestions — cross-bank promotion nominations

-- ============================================================================
-- scout_seller_industries — the dropdown (platform-wide, read-only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scout_seller_industries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  default_services text[] DEFAULT '{}',
  sort_order integer DEFAULT 100,
  created_at timestamptz DEFAULT now()
);

INSERT INTO scout_seller_industries (slug, name, description, sort_order)
VALUES
  ('marketing_agency',      'Marketing Agency',       'Full-service agency selling SEO, paid media, content, creative.', 10),
  ('web_dev',               'Web Development',        'Website design, development, and conversion-rate optimization.', 20),
  ('seo_specialist',        'SEO / SEM Specialist',   'Organic search + paid search focused shop.', 30),
  ('saas',                  'Software / SaaS',        'B2B or B2C software products sold by subscription.', 40),
  ('professional_services', 'Professional Services',  'Accounting, legal, consulting, HR advisory, etc.', 50),
  ('staffing',              'Staffing / Recruiting',  'Talent placement, contract labor, executive search.', 60),
  ('financial',             'Financial Services',     'Wealth advisors, lending, financial planning, bookkeeping.', 70),
  ('real_estate',           'Real Estate',            'Residential or commercial brokerages, property management.', 80),
  ('insurance',             'Insurance',              'P&C, life, benefits, commercial lines brokers/agents.', 90),
  ('home_services',         'Home Services',          'HVAC, plumbing, electrical, roofing, landscaping, cleaning.', 100),
  ('b2b_services',          'B2B Services',           'Agencies or firms selling to business buyers (catch-all).', 110),
  ('custom',                'Custom',                 'Start from scratch or scan a URL to generate a bank.', 999)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- scout_seller_profiles — output of a website scan
-- ============================================================================
CREATE TABLE IF NOT EXISTS scout_seller_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  agent_id uuid REFERENCES scout_voice_agents(id) ON DELETE SET NULL,

  url text NOT NULL,
  host text,
  scanned_at timestamptz DEFAULT now(),

  seller_industry_slug text,

  services jsonb DEFAULT '[]'::jsonb,
    -- [{ name, slug, category, description }]
  positioning text[] DEFAULT '{}',
  proof_points text[] DEFAULT '{}',
  target_customer text,
  target_signals jsonb DEFAULT '{}'::jsonb,
  process_phases text[] DEFAULT '{}',
  lead_magnets text[] DEFAULT '{}',
  vocabulary text[] DEFAULT '{}',

  pages_crawled integer DEFAULT 0,
  crawl_duration_ms integer,
  extract_tokens_in integer DEFAULT 0,
  extract_tokens_out integer DEFAULT 0,

  raw_extract jsonb,
    -- keep the full Claude extract so we can regenerate without re-crawl

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scout_seller_profiles_agency ON scout_seller_profiles(agency_id);
CREATE INDEX IF NOT EXISTS idx_scout_seller_profiles_agent ON scout_seller_profiles(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_seller_profiles_host ON scout_seller_profiles(host);

ALTER TABLE scout_seller_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scout_seller_profiles_agency" ON scout_seller_profiles;
CREATE POLICY "scout_seller_profiles_agency" ON scout_seller_profiles FOR ALL
  USING (agency_id = auth.uid());

-- ============================================================================
-- scout_question_banks — named collection of questions
-- ============================================================================
CREATE TABLE IF NOT EXISTS scout_question_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid,
    -- NULL = platform-wide (industry default); non-null = agency-specific
  agent_id uuid REFERENCES scout_voice_agents(id) ON DELETE SET NULL,
  seller_industry_slug text,
  seller_profile_id uuid REFERENCES scout_seller_profiles(id) ON DELETE SET NULL,

  name text NOT NULL,
  source text NOT NULL,
    -- 'default' | 'industry:<slug>' | 'scan:<host>:<YYYY-MM-DD>'
  status text NOT NULL DEFAULT 'active',
    -- 'exploration' | 'active' | 'archived'

  question_count integer DEFAULT 0,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scout_question_banks_agency ON scout_question_banks(agency_id);
CREATE INDEX IF NOT EXISTS idx_scout_question_banks_agent ON scout_question_banks(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_question_banks_industry ON scout_question_banks(seller_industry_slug);
CREATE INDEX IF NOT EXISTS idx_scout_question_banks_status ON scout_question_banks(status);

ALTER TABLE scout_question_banks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scout_question_banks_agency" ON scout_question_banks;
CREATE POLICY "scout_question_banks_agency" ON scout_question_banks FOR ALL
  USING (agency_id IS NULL OR agency_id = auth.uid());

-- ============================================================================
-- scout_questions — extend with bank fields
-- ============================================================================
ALTER TABLE scout_questions ADD COLUMN IF NOT EXISTS bank_id uuid REFERENCES scout_question_banks(id) ON DELETE CASCADE;
ALTER TABLE scout_questions ADD COLUMN IF NOT EXISTS stage text;
  -- opener | current_state | pain | decision | budget | timeline | competition | proof | closer
ALTER TABLE scout_questions ADD COLUMN IF NOT EXISTS services_qualified text[] DEFAULT '{}';
ALTER TABLE scout_questions ADD COLUMN IF NOT EXISTS exploration_status text DEFAULT 'exploration';
  -- exploration | active | archived
ALTER TABLE scout_questions ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE scout_questions ADD COLUMN IF NOT EXISTS promoted_from_bank_id uuid REFERENCES scout_question_banks(id) ON DELETE SET NULL;
ALTER TABLE scout_questions ADD COLUMN IF NOT EXISTS calls_used integer DEFAULT 0;
ALTER TABLE scout_questions ADD COLUMN IF NOT EXISTS appointments_attributed integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_scout_questions_bank ON scout_questions(bank_id) WHERE bank_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_questions_stage ON scout_questions(stage);
CREATE INDEX IF NOT EXISTS idx_scout_questions_exploration ON scout_questions(exploration_status) WHERE exploration_status = 'exploration';

-- ============================================================================
-- scout_voice_agents — extend with seller industry fields
-- ============================================================================
ALTER TABLE scout_voice_agents ADD COLUMN IF NOT EXISTS seller_industry_slug text;
ALTER TABLE scout_voice_agents ADD COLUMN IF NOT EXISTS seller_website_url text;
ALTER TABLE scout_voice_agents ADD COLUMN IF NOT EXISTS active_bank_id uuid REFERENCES scout_question_banks(id) ON DELETE SET NULL;
ALTER TABLE scout_voice_agents ADD COLUMN IF NOT EXISTS bank_mode text DEFAULT 'custom';
  -- 'industry' | 'custom' | 'merged'

-- ============================================================================
-- scout_promotion_suggestions — nominations for industry-default promotion
-- ============================================================================
CREATE TABLE IF NOT EXISTS scout_promotion_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_bank_id uuid NOT NULL REFERENCES scout_question_banks(id) ON DELETE CASCADE,
  from_question_id uuid NOT NULL REFERENCES scout_questions(id) ON DELETE CASCADE,
  to_industry_slug text NOT NULL,
  to_industry_bank_id uuid REFERENCES scout_question_banks(id) ON DELETE SET NULL,
  equivalent_default_question_id uuid REFERENCES scout_questions(id) ON DELETE SET NULL,

  performance_delta numeric(6,2),
    -- e.g. 2.3 means scan question wins 2.3x over the default
  stage text,
  calls_sample_size integer,

  status text DEFAULT 'pending',
    -- 'pending' | 'accepted' | 'rejected' | 'expired'
  reviewed_by uuid,
  reviewed_at timestamptz,
  notes text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scout_promo_status ON scout_promotion_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_scout_promo_industry ON scout_promotion_suggestions(to_industry_slug);

-- ============================================================================
-- Seed: Marketing Agency industry default bank + 54 Momenta questions
-- ============================================================================
DO $fn$
DECLARE
  bank_id uuid;
BEGIN
  -- Idempotent: skip if the marketing_agency default bank already exists
  SELECT id INTO bank_id FROM scout_question_banks
    WHERE agency_id IS NULL
      AND seller_industry_slug = 'marketing_agency'
      AND source = 'industry:marketing_agency'
    LIMIT 1;

  IF bank_id IS NULL THEN
    INSERT INTO scout_question_banks (agency_id, seller_industry_slug, name, source, status, question_count)
    VALUES (NULL, 'marketing_agency', 'Marketing Agency — Industry Default', 'industry:marketing_agency', 'active', 54)
    RETURNING id INTO bank_id;

    INSERT INTO scout_questions (agency_id, bank_id, stage, question_text, services_qualified, exploration_status, source, direction, source_system, priority)
    VALUES
      -- ── Opener (6) ──
      (NULL, bank_id, 'opener', 'Hi {{prospect_name}}, this is {{agent_name}} from {{seller_name}} out of {{agency_location}}. We run marketing for small and mid-sized businesses like yours — got 60 seconds for me to tell you why I called?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'opener', 'Quick one before I pitch anything — is your phone ringing as much as it was this time last year?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'opener', 'I pulled up {{company_name}} before dialing and ran our Momentum Audit on you. I got six scores across SEO, paid, social, brand — want me to just tell you what I found?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'opener', 'What are you doing for marketing right now — and if you''re being honest, is it actually working?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'opener', 'I''ll cut to it — I help businesses like yours turn marketing from a line item that feels like a gamble into something that actually drives revenue. Is that a conversation worth having?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'opener', 'Most {{industry}} owners I talk to are doing one or two marketing things and hoping for the best. Does that sound like you, or are you running a full playbook?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),

      -- ── Current State (9) ──
      (NULL, bank_id, 'current_state', 'Walk me through everything you''re doing for marketing right now — who runs it, what channels, and how long has that been the setup?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'current_state', 'Is marketing something you handle yourself, is there someone in-house, or are you using an agency?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'current_state', 'When was the last time your website got a real rebuild — not just a tweak?', ARRAY['website_development'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),
      (NULL, bank_id, 'current_state', 'How are customers finding you today — is it mostly referrals, Google, walk-ins, or paid?', ARRAY['search_seo','paid_media','social_marketing'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'current_state', 'If I pulled up your Google Business profile right now, what would I see — how many reviews, last one left when?', ARRAY['reputation_management'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'current_state', 'Are you running any paid ads — Google, Facebook, anywhere — and if so, who''s managing that?', ARRAY['paid_media'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'current_state', 'How much content do you put out in a typical month — blog posts, social, video, email — and who''s making it?', ARRAY['content_marketing','social_marketing','video_marketing','email_retention'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),
      (NULL, bank_id, 'current_state', 'Do you have a CRM, and if you do, is anyone actually using it the way it was meant to be used?', ARRAY['ai_solutions_crm'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),
      (NULL, bank_id, 'current_state', 'When someone asks "how''s marketing going?", what''s the answer you wish you could give versus the one you actually give?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),

      -- ── Pain (11) ──
      (NULL, bank_id, 'pain', 'If you had to point at the one part of your marketing that''s just not working, what would you point at?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'pain', 'When you spend money on marketing, do you actually know what''s working and what isn''t — or is it kind of a black box?', ARRAY['analytics_reporting'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'pain', 'How many different people or companies are you paying right now to handle different pieces of your marketing, and do they ever talk to each other?', ARRAY['marketing_strategy'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'pain', 'What''s the last marketing dollar you spent that you felt actually came back to you?', ARRAY['analytics_reporting'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'pain', 'Where are your leads coming in and dying — is it the website, the follow-up, the sales process, or something else?', ARRAY['website_development','ai_solutions_crm'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'pain', 'When a lead comes in off your website, how fast does someone get back to them — and are you sure about that answer?', ARRAY['ai_solutions_crm'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'pain', 'If your top referral source dried up tomorrow, what''s your backup plan for getting customers?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'pain', 'What do you currently do when a happy customer finishes a job — just move on, or is there a system to ask for a review?', ARRAY['reputation_management'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'pain', 'Does your brand look the same on your website, your truck, your business cards, and your Instagram — or does each of those look like a different company?', ARRAY['creative_services'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),
      (NULL, bank_id, 'pain', 'What''s the piece of marketing you know you should be doing but keep putting off?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),
      (NULL, bank_id, 'pain', 'Most SMB owners tell me the same thing: they don''t have a marketing strategy, they have a list of random things they''re trying. Does that ring true, or have you got a real plan?', ARRAY['marketing_strategy'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),

      -- ── Decision & Process (5) ──
      (NULL, bank_id, 'decision', 'If we got to the point where this made sense, who else is in on that decision with you?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'decision', 'When you''ve hired a marketing person or agency before, what did you learn from that — good or bad?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),
      (NULL, bank_id, 'decision', 'What would a new marketing partner need to prove to you in the first 60 days for you to feel like it was working?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'decision', 'What''s the story you tell yourself about why you haven''t made a bigger move on marketing yet?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),
      (NULL, bank_id, 'decision', 'If we did nothing — you kept marketing exactly the way you are now — where is the business in 12 months?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),

      -- ── Budget (5) ──
      (NULL, bank_id, 'budget', 'Ballpark, what are you spending on marketing in total right now across everything — ads, tools, people, agencies?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'budget', 'Is that number one you landed on deliberately, or did it just sort of end up there?', ARRAY['marketing_strategy'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),
      (NULL, bank_id, 'budget', 'If I told you most SMBs in your spot are spending somewhere between {{benchmark_low}} and {{benchmark_high}} a month to get real growth, does that feel high, low, or about right for you?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),
      (NULL, bank_id, 'budget', 'If we could show you $3 back for every $1 you put in — and prove it — how would you think about expanding the budget?', ARRAY['analytics_reporting'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'budget', 'What''s the number where marketing stops feeling like an investment and starts feeling scary?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),

      -- ── Timeline (4) ──
      (NULL, bank_id, 'timeline', 'When would you want to see the needle actually move — 30 days, 90, next year?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'timeline', 'What''s coming up in the business — a new location, a hire, a launch, a slow season — that makes this more or less urgent right now?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'timeline', 'We usually have campaigns live within 48 hours of kickoff. Is that faster or slower than what you''d expect?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),
      (NULL, bank_id, 'timeline', 'If the right partner walked in tomorrow and the numbers made sense, could you actually start this month, or is there something in the way?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),

      -- ── Competition & Alternatives (5) ──
      (NULL, bank_id, 'competition', 'Have you worked with an agency before? What made you stop — or what made you hire them in the first place?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'competition', 'Who are the competitors in your market that you look at and think "they''re crushing it" — and what are they doing that you''re not?', ARRAY['marketing_strategy'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),
      (NULL, bank_id, 'competition', 'Have you gotten pitched by agencies before? What''s the thing they all say that you''re sick of hearing?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),
      (NULL, bank_id, 'competition', 'Some folks try to do this themselves, some hire a freelancer, some go with an agency — where are you leaning, and why?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),
      (NULL, bank_id, 'competition', 'If you picked us, what''s the conversation you''d have with the people currently doing your marketing?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),

      -- ── Proof & Credibility (4) ──
      (NULL, bank_id, 'proof', 'Would it help to see what we did for a {{similar_business_type}} in a similar spot — same size, same kind of challenges?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'proof', 'Our SMB clients average a 340% lift in qualified leads. If we hit even half of that for you, what does that do for the business?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'proof', 'What kind of proof would it take — case studies, references, a pilot — for you to feel comfortable taking a swing on this?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),
      (NULL, bank_id, 'proof', 'If I sent you a free Momentum Audit scoring your brand against your top 3 competitors — no strings, no email needed — would that be worth 60 seconds of your time?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),

      -- ── Closer (5) ──
      (NULL, bank_id, 'closer', 'Based on what you''ve told me — {{summarized_pain}} — it sounds like the gap is {{specific_gap}}. Am I reading that right?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'closer', 'Let''s do this: a 20-minute strategy call where I walk you through exactly what we''d do for {{company_name}} in the first 90 days. Worth it?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1),
      (NULL, bank_id, 'closer', 'What would need to be true on that strategy call for you to want to move forward?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),
      (NULL, bank_id, 'closer', 'Who else should be on the call so we''re not running this same conversation twice?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 2),
      (NULL, bank_id, 'closer', 'Best email for the calendar invite — and are mornings or afternoons better for you?', ARRAY['all'], 'active', 'industry:marketing_agency', 'outbound_only', 'seed', 1);
  END IF;
END;
$fn$;

-- updated_at triggers for the new tables (reuse existing function)
DROP TRIGGER IF EXISTS trg_scout_question_banks_updated ON scout_question_banks;
CREATE TRIGGER trg_scout_question_banks_updated BEFORE UPDATE ON scout_question_banks
  FOR EACH ROW EXECUTE FUNCTION scout_voice_touch_updated_at();
