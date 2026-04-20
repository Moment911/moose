-- Add caller_name + auto-learning columns to scout_voice_agents.
-- caller_name: the persona name the AI uses on calls (e.g. "Alex")
-- learned_rules: auto-synthesized prompt rules from post-call coaching feedback
-- coaching_history: rolling log of coaching notes from recent calls

ALTER TABLE public.scout_voice_agents ADD COLUMN IF NOT EXISTS caller_name text;
ALTER TABLE public.scout_voice_agents ADD COLUMN IF NOT EXISTS learned_rules jsonb DEFAULT '[]';
ALTER TABLE public.scout_voice_agents ADD COLUMN IF NOT EXISTS learned_rules_updated_at timestamptz;
ALTER TABLE public.scout_voice_agents ADD COLUMN IF NOT EXISTS coaching_history jsonb DEFAULT '[]';

COMMENT ON COLUMN public.scout_voice_agents.caller_name IS 'The persona name the agent uses when introducing itself on calls (e.g. "Alex"). Falls back to agent.name if null.';
COMMENT ON COLUMN public.scout_voice_agents.learned_rules IS 'Auto-synthesized prompt rules from post-call coaching analysis. Injected into buildScoutPrompt as LEARNED FROM PAST CALLS section.';
COMMENT ON COLUMN public.scout_voice_agents.coaching_history IS 'Rolling log (last 20) of coaching notes from post-call analysis. Consumed by the prompt-evolution engine.';
