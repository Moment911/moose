-- 20260527_koto_topic_campaigns_featured_media.sql
-- Cache the WP media library attachment ID for the hero image so we only
-- upload it once per campaign-site pair instead of re-uploading on every
-- deploy. Yoast/RankMath read this attachment for og:image.
--
-- Apply manually via Supabase SQL Editor.

alter table koto_topic_campaigns
  add column if not exists wp_featured_media_id int,
  add column if not exists wp_featured_media_source_url text;
