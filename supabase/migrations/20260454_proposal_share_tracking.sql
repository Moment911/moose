-- ============================================================
-- Proposal share tokens + view tracking
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS share_token text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS share_sent_at timestamptz;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS view_events jsonb DEFAULT '[]'::jsonb;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS view_count int DEFAULT 0;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz;

-- Backfill share_token from the existing public_token so every proposal
-- already has a tokenized URL on the new /proposals/view/:token page.
UPDATE proposals
   SET share_token = public_token
 WHERE share_token IS NULL AND public_token IS NOT NULL;

-- For rows that have neither, generate a fresh random token
UPDATE proposals
   SET share_token = replace(gen_random_uuid()::text, '-', '')
 WHERE share_token IS NULL;

-- Unique index (not a UNIQUE constraint to tolerate null during backfill)
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_share_token ON proposals(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_last_viewed ON proposals(last_viewed_at DESC) WHERE last_viewed_at IS NOT NULL;
