-- ═══════════════════════════════════════════════════════════════════════
-- koto_wp_pages — add missing columns + indexes
-- The table existed from KOTO_RUN_IN_SUPABASE.sql but was missing
-- client_id and page_type columns that the app code expects.
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE koto_wp_pages ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE koto_wp_pages ADD COLUMN IF NOT EXISTS page_type text;
CREATE INDEX IF NOT EXISTS idx_wp_pages_client ON koto_wp_pages(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wp_pages_site_post ON koto_wp_pages(site_id, wp_post_id);
