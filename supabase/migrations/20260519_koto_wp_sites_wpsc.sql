-- 20260519_koto_wp_sites_wpsc.sql
-- Track WPSimpleCode plugin presence + per-site API key on each koto_wp_sites row.
-- Apply manually via Supabase SQL Editor.

alter table koto_wp_sites
  add column if not exists wpsc_api_key text,
  add column if not exists wpsc_detected boolean not null default false,
  add column if not exists wpsc_version text,
  add column if not exists wpsc_last_seen_at timestamptz;
