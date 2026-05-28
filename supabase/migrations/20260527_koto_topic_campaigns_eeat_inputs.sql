-- 20260527_koto_topic_campaigns_eeat_inputs.sql
-- Operator-provided E-E-A-T trust signals for a topic campaign. Drives the
-- author byline / results / citations blocks + sameAs schema rendered by
-- tokenResolver.ts (ctx.eeat). Reviews/testimonials are NOT stored here — they
-- are pulled live from an authoritative source (Google) at deploy time so they
-- always reflect real, current data (data-integrity standard + FTC rules).
--
--   eeat_inputs jsonb shape (all keys optional):
--   {
--     "strategist":  { "name": "...", "title": "...", "yearsExperience": 8, "photoUrl": "https://..." },
--     "sameAs":      ["https://www.google.com/maps/place/...", "https://linkedin.com/company/...", "https://clutch.co/..."],
--     "results":     [ { "metric": "+42% leads", "context": "in 90 days for a [koto_city] client" } ],
--     "citations":   [ { "claim": "AI search is growing fast", "sourceName": "Search Engine Journal", "sourceUrl": "https://..." } ]
--   }
--
-- Code is schema-drift tolerant (isMissingColumnError retry), so applying this
-- is purely additive. Apply manually via Supabase SQL Editor.

alter table koto_topic_campaigns
  add column if not exists eeat_inputs jsonb;
