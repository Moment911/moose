-- 20260528_koto_topic_campaigns_auto_refresh.sql
-- Opt-in auto-freshness for topic-campaign pages.
--
-- When auto_refresh = true, the nightly freshness cron
-- (/api/kotoiq-shim-cron/freshness-refresh) re-deploys this campaign's pages
-- whenever last_deploy_at is older than the staleness threshold named by
-- refresh_threshold_key (a key in src/lib/dataIntegrity.ts STALE_THRESHOLDS_MS).
--
-- The cron uses the EXISTING redeploy path: it re-pulls live Census data +
-- live Google reviews and re-resolves the master (no Claude tokens spent).
-- Competitor-angle refresh still requires a manual "Regenerate" (Claude) and is
-- deliberately NOT done by the cron — keeps the nightly job token-free.
--
-- refresh_threshold_key default 'business-listing' = 30 days. Other useful
-- keys: 'reviews' (7d, most aggressive), 'gbp-categories' (90d),
-- 'geo-municipality' (180d).
--
-- Apply manually via Supabase SQL Editor. Safe to re-run.

alter table koto_topic_campaigns
  add column if not exists auto_refresh boolean not null default false,
  add column if not exists refresh_threshold_key text not null default 'business-listing',
  add column if not exists last_auto_refresh_at timestamptz;

create index if not exists idx_koto_topic_campaigns_auto_refresh
  on koto_topic_campaigns(auto_refresh) where auto_refresh = true;
