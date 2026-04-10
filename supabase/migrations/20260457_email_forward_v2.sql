-- ============================================================
-- Email Tracking — Forward Detection v2
-- Adds IP-to-company enrichment columns + forward recipient
-- classification storage on tracked emails.
-- Idempotent — safe to re-run.
-- ============================================================

-- ── koto_email_opens: enrichment columns ─────────────────────
ALTER TABLE koto_email_opens ADD COLUMN IF NOT EXISTS company_name    text;
ALTER TABLE koto_email_opens ADD COLUMN IF NOT EXISTS company_domain  text;
ALTER TABLE koto_email_opens ADD COLUMN IF NOT EXISTS is_corporate_ip boolean DEFAULT false;
ALTER TABLE koto_email_opens ADD COLUMN IF NOT EXISTS org_name        text;
ALTER TABLE koto_email_opens ADD COLUMN IF NOT EXISTS proxy_type      text;
ALTER TABLE koto_email_opens ADD COLUMN IF NOT EXISTS open_type       text DEFAULT 'pixel';

-- ── koto_tracked_emails: forward recipient aggregation ───────
-- forward_recipients holds an array of rich forward records with company
-- enrichment, device, location, and Claude recipient-type scoring.
ALTER TABLE koto_tracked_emails ADD COLUMN IF NOT EXISTS forward_recipients jsonb DEFAULT '[]'::jsonb;
ALTER TABLE koto_tracked_emails ADD COLUMN IF NOT EXISTS confirmed_forwards int DEFAULT 0;

-- Hot query path — list opens grouped by company
CREATE INDEX IF NOT EXISTS idx_email_opens_company
  ON koto_email_opens(agency_id, company_name)
  WHERE company_name IS NOT NULL;
