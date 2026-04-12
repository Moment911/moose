-- Add data-provenance columns to koto_scout_searches so sweep-mode results
-- can record where the municipality list came from and how many cities were
-- searched. The scoutEngine.ts sweep backend already writes these fields but
-- wraps the update in a try/catch so existing environments without the
-- columns don't break.

alter table public.koto_scout_searches
  add column if not exists geo_source_name text,
  add column if not exists geo_source_url  text,
  add column if not exists geo_fetched_at  timestamptz,
  add column if not exists geo_total_municipalities int,
  add column if not exists geo_searched_municipalities int;

comment on column public.koto_scout_searches.geo_source_name is
  'Human-readable name of the geographic data source (e.g. "US Census Bureau — Incorporated Places")';
comment on column public.koto_scout_searches.geo_source_url is
  'Exact URL the municipality list was fetched from (api.census.gov endpoint)';
comment on column public.koto_scout_searches.geo_fetched_at is
  'When the municipality list was last fetched from the source API';
comment on column public.koto_scout_searches.geo_total_municipalities is
  'Total municipalities available in the state (before any cap)';
comment on column public.koto_scout_searches.geo_searched_municipalities is
  'How many municipalities were actually searched (may be capped by maxMunicipalities)';
