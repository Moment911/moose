-- 20260528_koto_topic_campaign_rank_history.sql
-- SERP rank tracking over time for topic-campaign city pages.
--
-- Every time the operator runs "check citations" (action=check_citations), the
-- citationTracker queries "{topic} in {city}" per deployed city and computes the
-- classic organic rank + AI-Overview citation state. This table stores ONE row
-- per city per check so the dashboard can trend organic rank (and AI-citation
-- state) over time in the performance view — proof the pages are climbing, not
-- just a single point-in-time snapshot.
--
-- Real-data-only (see _knowledge/data-integrity-standard.md): every row is a
-- fetched DataForSEO SERP result with its checked_at timestamp. Nothing here is
-- recalled or AI-generated.
--
-- Apply manually via Supabase SQL Editor. Safe to re-run.

create table if not exists koto_topic_campaign_rank_history (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references koto_topic_campaigns(id) on delete cascade,
    agency_id uuid not null,

    -- Location + query the rank was measured for
    city text not null,
    state_abbr text,
    query text not null,

    -- Measured SERP signal (organic_rank null = our domain not found in organic)
    organic_rank int,
    cited_in_ai boolean not null default false,
    ai_overview_present boolean not null default false,

    checked_at timestamptz not null default now()
);

create index if not exists idx_koto_tc_rank_history_campaign on koto_topic_campaign_rank_history(campaign_id);
create index if not exists idx_koto_tc_rank_history_campaign_city on koto_topic_campaign_rank_history(campaign_id, city);
create index if not exists idx_koto_tc_rank_history_checked on koto_topic_campaign_rank_history(campaign_id, checked_at);
