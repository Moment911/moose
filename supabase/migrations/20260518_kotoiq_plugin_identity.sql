-- KotoIQ Phase 4: track which plugin variant each WP site is running.
--
-- /meta on a WPSimpleCode 1.x site has no `plugin` field; the new KotoIQ 2.0.0
-- plugin returns `plugin: 'kotoiq'`. The Control Center uses this column to
-- pick the right /api/*-manifest when computing isOutdated() and the push-
-- update payload, so sites running KotoIQ don't get prompted to "update" back
-- to the WPSimpleCode 1.2.0 zip.
--
-- Default 'wpsimplecode' preserves existing fleet behavior — sites only flip
-- to 'kotoiq' after the next wpsc_detect call against an upgraded plugin.
--
-- Apply manually via Supabase SQL Editor (project has tracking drift, no
-- supabase db push).

alter table koto_wp_sites
  add column if not exists wpsc_plugin text default 'wpsimplecode';

comment on column koto_wp_sites.wpsc_plugin is
  'Plugin identity reported by /meta. ''wpsimplecode'' (legacy 1.x) or ''kotoiq'' (2.x+). Controls which update manifest the Control Center fetches.';
