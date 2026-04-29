-- LLM Rules — admin-editable prompt overrides.
-- Each row overrides one section of the LLM system prompts.
-- If no row exists for a section_key, the code default is used.

CREATE TABLE IF NOT EXISTS koto_llm_rules (
  section_key TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

-- RLS: service role only (admin API route uses service role key)
ALTER TABLE koto_llm_rules ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (no user-level RLS needed — admin only)
CREATE POLICY "service_role_full" ON koto_llm_rules
  FOR ALL
  USING (true)
  WITH CHECK (true);
