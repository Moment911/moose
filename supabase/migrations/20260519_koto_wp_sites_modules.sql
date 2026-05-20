-- 20260519_koto_wp_sites_modules.sql
-- Cache the per-site WPSimpleCode module list on koto_wp_sites so Control
-- Center can render module status without fanning out a live /meta call to
-- every site on every page load.
--
-- Apply manually via Supabase SQL Editor.

alter table koto_wp_sites
  add column if not exists wpsc_modules jsonb not null default '[]'::jsonb;
