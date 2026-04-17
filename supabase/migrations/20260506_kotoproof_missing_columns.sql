-- ── KotoProof — projects columns the app has been writing but the schema
-- never defined ─────────────────────────────────────────────────────────────
-- The UI references max_rounds, the AccessModal writes webhook_url /
-- slack_webhook_url / slack_channel_url and brand_name / brand_color /
-- brand_logo, but no prior migration added those columns. Every update
-- call that mentions them was silently failing with "column does not
-- exist", which is what caused /review/:token to 500 after the server-
-- side access check started pulling the same columns.

alter table projects add column if not exists max_rounds        int     default 2;
alter table projects add column if not exists webhook_url       text;
alter table projects add column if not exists slack_webhook_url text;
alter table projects add column if not exists slack_channel_url text;
alter table projects add column if not exists brand_name        text;
alter table projects add column if not exists brand_color       text;
alter table projects add column if not exists brand_logo        text;

-- Useful index for the public-token lookup path used by
-- /api/proof/verify-token and KotoProofPage's single-link share flow.
create unique index if not exists idx_projects_public_token
  on projects(public_token)
  where public_token is not null;
