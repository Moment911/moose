-- 20260527_koto_topic_campaigns_competitor_eeat.sql
-- Persist the competitor-intel + E-E-A-T audit signals the topic-campaign
-- route already computes. The route writes these today behind schema-drift
-- guards (retries the insert/update without them when the column is missing),
-- so applying this is purely additive — it lets the data survive instead of
-- being silently dropped.
--
--   competitor_meta  jsonb   — multi-city competitor sampling result:
--                              { multi_city, cities_sampled[], city_count,
--                                sample_query, sample_location, competitor_count,
--                                ai_overview_seen, people_also_ask[], competitors[] }
--   eeat_score       int     — overall E-E-A-T score 0-100 (parsed.overall_score)
--   eeat_audit       jsonb   — full E-E-A-T audit JSON from the Claude eeat_score action
--
-- Apply manually via Supabase SQL Editor.

alter table koto_topic_campaigns
  add column if not exists competitor_meta jsonb,
  add column if not exists eeat_score      integer,
  add column if not exists eeat_audit      jsonb;
