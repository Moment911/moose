-- ============================================================
-- Notifications + Review Responses
-- Idempotent — safe to re-run.
-- ============================================================

-- ── Notifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS koto_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  user_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  icon text,
  is_read boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Backfill columns in case an older shape exists
ALTER TABLE koto_notifications ADD COLUMN IF NOT EXISTS agency_id uuid;
ALTER TABLE koto_notifications ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE koto_notifications ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE koto_notifications ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE koto_notifications ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE koto_notifications ADD COLUMN IF NOT EXISTS link text;
ALTER TABLE koto_notifications ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE koto_notifications ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE koto_notifications ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE koto_notifications ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notif_agency ON koto_notifications(agency_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user ON koto_notifications(user_id, is_read, created_at DESC) WHERE user_id IS NOT NULL;

ALTER TABLE koto_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_all" ON koto_notifications;
CREATE POLICY "notif_all" ON koto_notifications FOR ALL USING (true) WITH CHECK (true);

-- ── Review Responses ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS koto_review_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid,
  client_id uuid,
  review_id text,
  review_text text,
  reviewer_name text,
  rating int,
  response_text text,
  tone text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE koto_review_responses ADD COLUMN IF NOT EXISTS agency_id uuid;
ALTER TABLE koto_review_responses ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE koto_review_responses ADD COLUMN IF NOT EXISTS review_id text;
ALTER TABLE koto_review_responses ADD COLUMN IF NOT EXISTS review_text text;
ALTER TABLE koto_review_responses ADD COLUMN IF NOT EXISTS reviewer_name text;
ALTER TABLE koto_review_responses ADD COLUMN IF NOT EXISTS rating int;
ALTER TABLE koto_review_responses ADD COLUMN IF NOT EXISTS response_text text;
ALTER TABLE koto_review_responses ADD COLUMN IF NOT EXISTS tone text;
ALTER TABLE koto_review_responses ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_review_resp_agency ON koto_review_responses(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_resp_client ON koto_review_responses(client_id, created_at DESC) WHERE client_id IS NOT NULL;

ALTER TABLE koto_review_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "review_resp_all" ON koto_review_responses;
CREATE POLICY "review_resp_all" ON koto_review_responses FOR ALL USING (true) WITH CHECK (true);
