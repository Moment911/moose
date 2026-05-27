-- 20260527_koto_topic_campaign_deploys_seo_columns.sql
-- Add resolved meta + schema columns to koto_topic_campaign_deploys so the
-- dashboard can show what was pushed to each city without re-resolving.
--
-- Run after 20260527_koto_topic_campaigns.sql. Safe to re-run.
-- Apply manually via Supabase SQL Editor.

alter table koto_topic_campaign_deploys
  add column if not exists resolved_meta_title text,
  add column if not exists resolved_meta_description text,
  add column if not exists resolved_jsonld text;
