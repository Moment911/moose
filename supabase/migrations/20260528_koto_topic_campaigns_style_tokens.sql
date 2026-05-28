-- 20260528_koto_topic_campaigns_style_tokens.sql
-- Captured site design tokens for topic-campaign pages.
--
-- style_tokens holds the real design language read from the client's own site
-- (via capture_styling on a URL, or wrapper_assist on pasted HTML): body /
-- heading font-family, color palette (primary, accent, heading, text, muted,
-- surface, border), link/button treatment, corner radius. Shape matches
-- StyleTokens in src/lib/wp-shim/styleTokens.ts.
--
-- At render time tokenResolver.resolveMaster() emits a :root{--koto-*} block
-- from these so generated pages match the site instead of the generic default
-- palette. Absent / empty → the base CSS literal fallbacks apply (no change).
--
-- This is the client's own brand styling (not a recalled real-world fact), so
-- storing it does not violate the data-integrity standard.
--
-- Apply manually via Supabase SQL Editor. Safe to re-run.

alter table koto_topic_campaigns
  add column if not exists style_tokens jsonb;
