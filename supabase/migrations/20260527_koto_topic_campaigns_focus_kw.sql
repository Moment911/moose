-- 20260527_koto_topic_campaigns_focus_kw.sql
-- Operator-defined focus-keyword template. Resolved with [koto_city],
-- [koto_state], [koto_state_abbr] tokens at deploy time and written to
-- _kotoiq_focus_keyword + _yoast_wpseo_focuskw + rank_math_focus_keyword
-- via writeSeoMeta.
--
-- Default (when null) reproduces the prior behavior: "<topic> <city>" lowercase.
-- Apply manually via Supabase SQL Editor.

alter table koto_topic_campaigns
  add column if not exists focus_keyword_template text;
