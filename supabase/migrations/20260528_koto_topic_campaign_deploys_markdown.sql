-- 20260528_koto_topic_campaign_deploys_markdown.sql
-- Store each deployed page's Markdown twin so the site-wide /llms-full.txt can
-- be composed from all published deploys (across every campaign on the site)
-- without re-resolving each page.
--
-- The Markdown twin is also pushed per-page to uploads/kotoiq/md/{slug}.md and
-- served by the shim's md-server.php (v4.2.5+) at {origin}/{slug}.md.
--
-- Run after 20260527_koto_topic_campaigns.sql. Safe to re-run.
-- Apply manually via Supabase SQL Editor.

alter table koto_topic_campaign_deploys
  add column if not exists resolved_markdown text;
