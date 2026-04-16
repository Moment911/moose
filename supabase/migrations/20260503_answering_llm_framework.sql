-- =============================================================================
-- Answering Service -- LLM Framework extension
-- Adds: industry templates (HVAC, legal, medical, generic), routing targets,
-- knowledge chunks, and extends koto_inbound_agents/calls with prompt/LLM/intent
-- Source: ai-answering-service-koto-llm framework, adapted to Koto's existing
--         koto_inbound_* schema (not a rewrite -- additive layer).
-- =============================================================================

-- Industry templates (HVAC, Legal, Medical, Generic, ...)
CREATE TABLE IF NOT EXISTS koto_inbound_industries (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug                   text UNIQUE NOT NULL,
  display_name           text NOT NULL,
  default_greeting       text NOT NULL,
  system_prompt_template text NOT NULL,
  topic_boundaries       jsonb NOT NULL DEFAULT '{"allowed":[],"forbidden":[]}',
  intake_schema          jsonb NOT NULL DEFAULT '{"fields":[]}',
  default_routing_rules  jsonb NOT NULL DEFAULT '[]',
  llm_overrides          jsonb NOT NULL DEFAULT '{}',
  is_builtin             boolean DEFAULT true,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbound_industries_slug ON koto_inbound_industries(slug);

-- Extend koto_inbound_agents with LLM config + industry link
ALTER TABLE koto_inbound_agents
  ADD COLUMN IF NOT EXISTS industry_slug         text,
  ADD COLUMN IF NOT EXISTS llm_config            jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS system_prompt_rendered text,
  ADD COLUMN IF NOT EXISTS retell_llm_id         text,
  ADD COLUMN IF NOT EXISTS topic_boundaries      jsonb;

CREATE INDEX IF NOT EXISTS idx_inbound_agents_industry ON koto_inbound_agents(industry_slug);

-- Routing targets (who to transfer to, when)
CREATE TABLE IF NOT EXISTS koto_inbound_routing_targets (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id      uuid REFERENCES koto_inbound_agents(id) ON DELETE CASCADE,
  label         text NOT NULL,
  phone_number  text NOT NULL,
  email         text,
  priority      int DEFAULT 1,
  conditions    jsonb DEFAULT '{"intent":"any"}',
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routing_targets_agent ON koto_inbound_routing_targets(agent_id);

-- Knowledge base chunks (text-only for now; pgvector-ready)
CREATE TABLE IF NOT EXISTS koto_inbound_knowledge_chunks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id    uuid REFERENCES koto_inbound_agents(id) ON DELETE CASCADE,
  source      text NOT NULL,
  content     text NOT NULL,
  tokens      int DEFAULT 0,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_agent ON koto_inbound_knowledge_chunks(agent_id);

-- Extend koto_inbound_calls for intent + routing outcome
ALTER TABLE koto_inbound_calls
  ADD COLUMN IF NOT EXISTS intent              text,
  ADD COLUMN IF NOT EXISTS forwarded_to        text,
  ADD COLUMN IF NOT EXISTS sms_followup_sent   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_info           jsonb DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_inbound_calls_intent ON koto_inbound_calls(intent);

-- RLS (match existing koto_inbound_* permissive policies)
ALTER TABLE koto_inbound_industries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_inbound_routing_targets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_inbound_knowledge_chunks    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inbound_industries_all" ON koto_inbound_industries;
CREATE POLICY "inbound_industries_all" ON koto_inbound_industries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "inbound_routing_targets_all" ON koto_inbound_routing_targets;
CREATE POLICY "inbound_routing_targets_all" ON koto_inbound_routing_targets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "inbound_knowledge_chunks_all" ON koto_inbound_knowledge_chunks;
CREATE POLICY "inbound_knowledge_chunks_all" ON koto_inbound_knowledge_chunks FOR ALL USING (true) WITH CHECK (true);
