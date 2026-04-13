-- Add retell_llm_id to front desk configs for the new Retell API flow
-- (agents now require a separate LLM resource)
ALTER TABLE koto_front_desk_configs ADD COLUMN IF NOT EXISTS retell_llm_id text;
