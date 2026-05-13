-- Add failure tracking columns to seo_connections so the UI can render a
-- truthful "Reconnect Google" CTA instead of silently swallowing token
-- refresh failures.
--
-- Without these, refreshGoogleToken in src/lib/seoService.js had no way
-- to record WHY a refresh failed — every failure looked the same to the
-- UI, and the app would keep hammering Google with a known-bad
-- refresh_token on every dashboard load.

ALTER TABLE seo_connections
  ADD COLUMN IF NOT EXISTS last_error       text,
  ADD COLUMN IF NOT EXISTS last_error_at    timestamptz,
  ADD COLUMN IF NOT EXISTS needs_reconnect  boolean DEFAULT false;

-- Quick index for "show me all connections that need a user re-consent"
CREATE INDEX IF NOT EXISTS idx_seo_connections_needs_reconnect
  ON seo_connections(needs_reconnect)
  WHERE needs_reconnect = true;
