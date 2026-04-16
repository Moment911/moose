-- ─────────────────────────────────────────────────────────────
-- KotoIQ Features #14 & #15: Review Intelligence + Content Calendar
-- ─────────────────────────────────────────────────────────────

-- Review Intelligence
CREATE TABLE IF NOT EXISTS kotoiq_review_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Aggregated metrics
  total_reviews integer DEFAULT 0,
  avg_rating numeric(3,2),
  rating_distribution jsonb DEFAULT '{}',
  review_velocity numeric(5,2),
  velocity_trend text,

  -- Sentiment analysis
  sentiment_by_topic jsonb DEFAULT '[]',
  top_praise_topics jsonb DEFAULT '[]',
  top_complaint_topics jsonb DEFAULT '[]',

  -- Competitor comparison
  competitor_reviews jsonb DEFAULT '[]',

  -- Response metrics
  response_rate numeric(5,2),
  avg_response_time_hours numeric(8,2),
  unresponded_reviews jsonb DEFAULT '[]',

  overall_score numeric(5,2),
  scanned_at timestamptz DEFAULT now()
);

-- Review Campaigns
CREATE TABLE IF NOT EXISTS kotoiq_review_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  name text NOT NULL,
  status text DEFAULT 'draft',

  target_count integer DEFAULT 10,
  collected_count integer DEFAULT 0,

  request_template text,
  follow_up_template text,

  sent_count integer DEFAULT 0,
  opened_count integer DEFAULT 0,
  completed_count integer DEFAULT 0,

  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Content Calendar
CREATE TABLE IF NOT EXISTS kotoiq_content_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  title text NOT NULL,
  target_keyword text,
  content_type text,
  status text DEFAULT 'planned',

  planned_date date,
  published_date date,
  refresh_date date,

  topical_node_id uuid,
  brief_id uuid,
  keyword_fingerprint text,

  word_count integer,
  published_url text,

  assigned_to text,
  notes text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Publishing Momentum
CREATE TABLE IF NOT EXISTS kotoiq_publishing_momentum (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  vastness_score numeric(5,2),
  depth_score numeric(5,2),
  momentum_score numeric(5,2),
  overall_vdm_score numeric(5,2),

  pages_this_month integer DEFAULT 0,
  pages_last_month integer DEFAULT 0,
  pages_3mo_avg numeric(5,1),

  competitor_velocity jsonb DEFAULT '[]',

  pages_due_refresh integer DEFAULT 0,
  pages_overdue_refresh integer DEFAULT 0,

  recommended_pace text,
  priority_topics jsonb DEFAULT '[]',

  calculated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_review_intel_client ON kotoiq_review_intelligence(client_id);
CREATE INDEX IF NOT EXISTS idx_review_campaigns_client ON kotoiq_review_campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_content_calendar_client ON kotoiq_content_calendar(client_id);
CREATE INDEX IF NOT EXISTS idx_publishing_momentum_client ON kotoiq_publishing_momentum(client_id);
