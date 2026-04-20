-- Voice Brain — make the tenancy + direction dimensions explicit.
--
-- GOAL: the most intelligent AI calling agent in the world.
-- The brain has two orthogonal scopes:
--
--   1. DOMAIN SCOPE — WHO does this knowledge apply to?
--        global_pattern  = universal (all industries, all calls)
--        industry        = scope_value = 'HVAC', 'Legal', 'Dentistry', ...
--        sic             = scope_value = SIC code
--        naics           = scope_value = NAICS code
--        gap             = scope_value = 'no_ga4', 'no_fb', 'slow_site', ...
--        company         = scope_value = opportunity_id or company name
--        objection       = scope_value = objection type
--
--   2. DIRECTION — WHICH type of call can read/write this?
--        outbound_only  = Scout cold calls learn and apply here
--        inbound_only   = Answering Service applies here
--        both           = shared brain (default for global_pattern + industry)
--
-- Industry-specific knowledge stays siloed to that industry. Global patterns
-- bubble up across all calls. Scout and Answering Service read from the SAME
-- brain; they only differ in which direction they write into.

ALTER TABLE scout_voice_knowledge ADD COLUMN IF NOT EXISTS direction text DEFAULT 'both';
ALTER TABLE scout_voice_knowledge ADD COLUMN IF NOT EXISTS source_system text DEFAULT 'scout';
  -- source_system: 'scout' (outbound prospecting), 'answering' (inbound),
  -- 'manual' (human curator), 'cron' (nightly synthesis)

-- Question library gets the same direction dimension so we don't apply an
-- inbound-only question ("how did you find us?") on an outbound cold call.
ALTER TABLE scout_questions ADD COLUMN IF NOT EXISTS direction text DEFAULT 'outbound_only';
ALTER TABLE scout_questions ADD COLUMN IF NOT EXISTS source_system text DEFAULT 'scout';

-- Recommended values — advisory, not CHECK-enforced so future values don't break migration:
--   direction: outbound_only | inbound_only | both
--   source_system: scout | answering | vob | manual | cron

CREATE INDEX IF NOT EXISTS idx_scout_voice_knowledge_direction ON scout_voice_knowledge(direction);
CREATE INDEX IF NOT EXISTS idx_scout_voice_knowledge_scope_dir ON scout_voice_knowledge(scope, scope_value, direction);
CREATE INDEX IF NOT EXISTS idx_scout_questions_direction ON scout_questions(direction);

-- View that gives both Scout and Answering a single read interface to the brain.
-- agency_id scoping is preserved (NULL rows = platform-wide, visible to everyone).
CREATE OR REPLACE VIEW voice_brain AS
  SELECT
    id, agency_id, scope, scope_value, direction, source_system,
    fact, fact_category, times_confirmed, times_contradicted,
    confidence_score, first_confirmed_at, last_confirmed_at,
    sample_call_ids, created_at, updated_at
  FROM scout_voice_knowledge;

COMMENT ON VIEW voice_brain IS
  'Unified read interface over the voice knowledge brain. Both Scout (outbound) and Answering Service (inbound) query this view, filtering by direction IN (their_direction, ''both'') and by scope/scope_value.';

-- Helper function: fetch the top N facts for a call, composing global_pattern
-- + industry-scoped + sic-scoped + gap-scoped + company-scoped knowledge into
-- one ranked list. Used by buildScoutPrompt at call time.
CREATE OR REPLACE FUNCTION voice_brain_for_call(
  p_agency_id uuid,
  p_direction text,          -- 'outbound_only' or 'inbound_only'
  p_industry text,
  p_sic_code text,
  p_naics_code text,
  p_gap text,
  p_opportunity_id text,
  p_limit integer DEFAULT 25
)
RETURNS TABLE (
  scope text,
  scope_value text,
  fact text,
  fact_category text,
  confidence_score numeric,
  relevance_rank integer
) AS $fn$
  SELECT scope, scope_value, fact, fact_category, confidence_score, relevance_rank
  FROM (
    SELECT
      scope, scope_value, fact, fact_category, confidence_score, times_confirmed,
      CASE scope
        WHEN 'global_pattern' THEN 1
        WHEN 'industry' THEN 2
        WHEN 'sic' THEN 3
        WHEN 'naics' THEN 3
        WHEN 'gap' THEN 4
        WHEN 'company' THEN 5
        WHEN 'objection' THEN 6
        ELSE 9
      END AS relevance_rank
    FROM scout_voice_knowledge
    WHERE (agency_id IS NULL OR agency_id = p_agency_id)
      AND (direction = p_direction OR direction = 'both')
      AND (
        scope = 'global_pattern'
        OR (scope = 'industry' AND p_industry IS NOT NULL AND scope_value = p_industry)
        OR (scope = 'sic' AND p_sic_code IS NOT NULL AND scope_value = p_sic_code)
        OR (scope = 'naics' AND p_naics_code IS NOT NULL AND scope_value = p_naics_code)
        OR (scope = 'gap' AND p_gap IS NOT NULL AND scope_value = p_gap)
        OR (scope = 'company' AND p_opportunity_id IS NOT NULL AND scope_value = p_opportunity_id)
      )
  ) ranked
  ORDER BY relevance_rank ASC, confidence_score DESC, times_confirmed DESC
  LIMIT p_limit;
$fn$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION voice_brain_for_call IS
  'Returns the most relevant brain facts for a specific call, composing global patterns + industry + SIC + gap + company knowledge into a single ranked list. Used by buildScoutPrompt and the Answering Service prompt builder.';

-- Seed a few universal global_pattern facts to prime the brain.
-- These are well-established sales research findings — not guesses.
-- agency_id=NULL makes them platform-wide; direction=both applies to
-- Scout outbound AND Answering inbound.
INSERT INTO scout_voice_knowledge (agency_id, scope, scope_value, direction, source_system, fact, fact_category, times_confirmed, confidence_score)
VALUES
  (NULL, 'global_pattern', NULL, 'both', 'manual',
   'Open-ended pain questions ("what''s frustrating about...") outperform closed qualifying questions by roughly 2x on engagement and conversion.',
   'pitch_angle', 10, 0.90),
  (NULL, 'global_pattern', NULL, 'outbound_only', 'manual',
   'On cold outbound, asking permission in the first 8 seconds ("is now a bad time?") increases continuation rate vs. leading with value prop.',
   'opener', 10, 0.85),
  (NULL, 'global_pattern', NULL, 'both', 'manual',
   'Talk-listen ratio below 45% (agent talks less) correlates strongly with deals booked. Over 60% agent talk correlates with losses.',
   'hot_button', 10, 0.92),
  (NULL, 'global_pattern', NULL, 'outbound_only', 'manual',
   'Specific framing ("we noticed X about your business") outperforms generic framing ("we help companies like yours") by a wide margin.',
   'pitch_angle', 10, 0.88),
  (NULL, 'global_pattern', NULL, 'both', 'manual',
   'When a prospect says "send me some info", that''s usually a soft no. Counter with "happy to — what specifically would make the info useful?" to re-engage.',
   'objection_response', 10, 0.82),
  (NULL, 'global_pattern', NULL, 'outbound_only', 'manual',
   'Best window for outbound B2B calls is Tue-Thu 10-11am local time. Mondays and Fridays after 3pm show meaningfully lower connect rates.',
   'timing', 10, 0.86),
  (NULL, 'global_pattern', NULL, 'outbound_only', 'manual',
   'If the first 3 attempts have failed to connect, the next attempt is 4x more likely to land if you try a different time-of-day bucket rather than the same one.',
   'timing', 10, 0.80),
  (NULL, 'global_pattern', NULL, 'inbound_only', 'manual',
   'On inbound calls, the first 12 seconds determine whether the caller perceives the agent as human or machine. Avoid "how may I direct your call" patterns.',
   'opener', 10, 0.85)
ON CONFLICT DO NOTHING;
