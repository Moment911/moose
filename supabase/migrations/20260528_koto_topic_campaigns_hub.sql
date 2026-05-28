-- 20260528_koto_topic_campaigns_hub.sql
-- Pillar/hub page tracking for topic campaigns.
--
-- A campaign can have ONE hub (pillar) page that links to every deployed city
-- page (the spokes) + sibling clusters, with CollectionPage + BreadcrumbList +
-- ItemList schema. Spoke pages link back up via a BreadcrumbList in their own
-- schema (tokenResolver ctx.hub). Built/updated via action=deploy_hub.
--
-- hub_post_id  = the WP page ID of the hub (so re-builds PATCH in place)
-- hub_url      = canonical URL of the hub page
-- hub_slug     = resolved slug (deterministic from topic)
--
-- Run after 20260527_koto_topic_campaigns.sql. Safe to re-run.
-- Apply manually via Supabase SQL Editor.

alter table koto_topic_campaigns
  add column if not exists hub_post_id int,
  add column if not exists hub_url text,
  add column if not exists hub_slug text;
