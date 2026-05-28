-- 20260527_koto_topic_campaigns_google_place_id.sql
-- The Google Place connected to a campaign for live review pulls. When set,
-- buildEeatContext() fetches real reviews + true rating/count from the Places
-- API at deploy time (testimonials + Review/AggregateRating schema). Falls back
-- to the campaign's client's clients.google_place_id when this is null.
--
-- Set via the "Connect Google reviews" picker in the AI Pages campaign editor
-- (find_places search → set_campaign_place). Apply manually via Supabase.

alter table koto_topic_campaigns
  add column if not exists google_place_id text;

-- Fallback location for clients connected via intel/scout. Harmless if present.
alter table clients
  add column if not exists google_place_id text;
