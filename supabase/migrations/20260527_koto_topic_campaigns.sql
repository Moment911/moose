-- 20260527_koto_topic_campaigns.sql
-- Stores AI-generated "master documents" for topic-based bulk page campaigns.
-- Operator types a topic ("Website Design"), Claude produces a structured
-- master with rotation variants + [koto_*] location tokens inserted. The
-- master is stored once, then deployed across N cities via token resolution
-- at publish time (literal city baked into each page's HTML).
--
-- Apply manually via Supabase SQL Editor.

create table if not exists koto_topic_campaigns (
    id uuid primary key default gen_random_uuid(),
    agency_id uuid not null references agencies(id) on delete cascade,
    client_id uuid references clients(id) on delete set null,
    site_id uuid references koto_wp_sites(id) on delete set null,

    -- Operator inputs
    topic text not null,
    phone text,
    company_name text,
    notes text,
    post_type text not null default 'page' check (post_type in ('page', 'post')),
    custom_html_wrapper text,

    -- Claude output — full master document
    -- See src/lib/wp-shim/topicCampaignGenerator.ts for the shape
    master jsonb not null default '{}'::jsonb,

    -- Status
    status text not null default 'draft' check (status in ('draft', 'ready', 'deploying', 'deployed', 'archived')),
    last_deploy_at timestamptz,
    last_deploy_count int not null default 0,

    -- Token usage attribution
    tokens_used int default 0,
    model_used text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by text
);

create index if not exists idx_koto_topic_campaigns_agency on koto_topic_campaigns(agency_id);
create index if not exists idx_koto_topic_campaigns_client on koto_topic_campaigns(client_id);
create index if not exists idx_koto_topic_campaigns_site on koto_topic_campaigns(site_id);
create index if not exists idx_koto_topic_campaigns_status on koto_topic_campaigns(status);

-- Per-deploy audit so the operator can see which cities got which content.
create table if not exists koto_topic_campaign_deploys (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references koto_topic_campaigns(id) on delete cascade,
    agency_id uuid not null,
    site_id uuid references koto_wp_sites(id) on delete set null,

    -- Resolved location for this deploy
    city text not null,
    state text,
    state_abbr text,
    zip text,
    county text,

    -- WP-side outcome
    wp_post_id int,
    wp_post_url text,
    wp_post_type text not null default 'page',

    -- Resolved content (for re-deploy / debugging / dashboard visibility)
    resolved_title text,
    resolved_slug text,
    resolved_meta_title text,
    resolved_meta_description text,
    resolved_jsonld text,
    rendered_html_bytes int,

    -- Status
    status text not null default 'pending' check (status in ('pending', 'published', 'failed')),
    error text,

    created_at timestamptz not null default now()
);

create index if not exists idx_koto_topic_campaign_deploys_campaign on koto_topic_campaign_deploys(campaign_id);
create index if not exists idx_koto_topic_campaign_deploys_site on koto_topic_campaign_deploys(site_id);
create index if not exists idx_koto_topic_campaign_deploys_status on koto_topic_campaign_deploys(status);
