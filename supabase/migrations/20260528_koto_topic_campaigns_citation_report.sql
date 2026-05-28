-- 20260528_koto_topic_campaigns_citation_report.sql
-- Stores the latest AI-citation tracking result for a campaign: per-city checks
-- of whether the site's pages are cited in Google AI Overviews + ranking in
-- classic organic results (see src/lib/wp-shim/citationTracker.ts).
--
--   citation_report     jsonb        — { domain, citiesChecked, aiOverviewCount,
--                                       citedCount, organicTop10, checks[], checkedAt }
--   citation_checked_at timestamptz  — when the check last ran
--
-- Code is schema-drift tolerant (the save is best-effort). Apply manually.

alter table koto_topic_campaigns
  add column if not exists citation_report     jsonb,
  add column if not exists citation_checked_at timestamptz;
