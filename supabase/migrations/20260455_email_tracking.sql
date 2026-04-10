-- ============================================================
-- Email Tracking System
-- Pixel-based open tracking, forward detection, Gmail OAuth
-- Idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS koto_tracked_emails (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  user_id uuid,
  -- Email metadata
  subject text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  sent_from text,
  -- Recipients (array of objects with email, name, pixel_token, open stats)
  recipients jsonb DEFAULT '[]'::jsonb,
  -- Aggregate stats
  total_recipients int DEFAULT 0,
  total_opens int DEFAULT 0,
  unique_openers int DEFAULT 0,
  likely_forwards int DEFAULT 0,
  -- Status: sent | opened | forwarded | bounced | deleted
  status text DEFAULT 'sent',
  -- Gmail integration
  gmail_message_id text,
  gmail_thread_id text,
  -- Metadata
  tags text[] DEFAULT '{}',
  notes text,
  source_meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS koto_email_opens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_email_id uuid REFERENCES koto_tracked_emails(id) ON DELETE CASCADE,
  agency_id uuid,
  pixel_token text NOT NULL,
  recipient_email text,
  opened_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text,
  device_type text,      -- desktop | mobile | tablet
  email_client text,     -- Gmail | Outlook | Apple Mail | Unknown
  location_city text,
  location_country text,
  is_likely_forward boolean DEFAULT false,
  forward_confidence int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS koto_email_tracking_pixels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid,
  tracked_email_id uuid REFERENCES koto_tracked_emails(id) ON DELETE CASCADE,
  pixel_token text UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  recipient_email text NOT NULL,
  recipient_name text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS koto_gmail_connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  user_id uuid,
  gmail_email text NOT NULL,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for hot query paths
CREATE INDEX IF NOT EXISTS idx_tracked_emails_agency       ON koto_tracked_emails(agency_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracked_emails_gmail        ON koto_tracked_emails(gmail_message_id) WHERE gmail_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracked_emails_status       ON koto_tracked_emails(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_email_opens_token           ON koto_email_opens(pixel_token);
CREATE INDEX IF NOT EXISTS idx_email_opens_tracked_email   ON koto_email_opens(tracked_email_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_opens_agency          ON koto_email_opens(agency_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_pixels_token                ON koto_email_tracking_pixels(pixel_token);
CREATE INDEX IF NOT EXISTS idx_pixels_tracked_email        ON koto_email_tracking_pixels(tracked_email_id);
CREATE INDEX IF NOT EXISTS idx_gmail_conn_agency           ON koto_gmail_connections(agency_id) WHERE is_active = true;

-- RLS (permissive — matches the existing table policy convention in this repo)
ALTER TABLE koto_tracked_emails         ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_email_opens            ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_email_tracking_pixels  ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_gmail_connections      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tracked_emails_all" ON koto_tracked_emails;
CREATE POLICY "tracked_emails_all" ON koto_tracked_emails FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "email_opens_all" ON koto_email_opens;
CREATE POLICY "email_opens_all" ON koto_email_opens FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pixels_all" ON koto_email_tracking_pixels;
CREATE POLICY "pixels_all" ON koto_email_tracking_pixels FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "gmail_conn_all" ON koto_gmail_connections;
CREATE POLICY "gmail_conn_all" ON koto_gmail_connections FOR ALL USING (true) WITH CHECK (true);
