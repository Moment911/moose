-- 20260527_koto_topic_campaigns_media.sql
-- Add hero image + video URL columns to koto_topic_campaigns so the
-- operator can attach media to a campaign and have it baked into every
-- deployed page's hero section.
--
-- Also add rank_math_score column to deploys for the score read-back
-- shipped alongside this migration.
--
-- Apply manually via Supabase SQL Editor.

alter table koto_topic_campaigns
  add column if not exists hero_image_url text,
  add column if not exists hero_video_url text,
  add column if not exists hero_image_alt text;

alter table koto_topic_campaign_deploys
  add column if not exists rank_math_score int,
  add column if not exists yoast_score int;
