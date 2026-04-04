-- ══════════════════════════════════════════════════════════════════════════════
-- Q&A KNOWLEDGE BASE — expanded from desk_knowledge
-- Comprehensive answer system that learns from tickets + web + manual entries
-- ══════════════════════════════════════════════════════════════════════════════

-- Expand desk_knowledge with full Q&A fields
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS question        text;
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS answer          text;
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS answer_short    text;      -- 1-sentence summary
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS source          text DEFAULT 'manual';  -- manual|ticket|web_search|ai_generated
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS web_sources     jsonb DEFAULT '[]';     -- [{url, title, snippet}]
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS is_verified     boolean DEFAULT false;  -- human-approved
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS is_public       boolean DEFAULT true;   -- show to clients
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS view_count      int DEFAULT 0;
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS helpful_count   int DEFAULT 0;
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS not_helpful_count int DEFAULT 0;
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS related_ids     uuid[] DEFAULT '{}';    -- related Q&As
ALTER TABLE desk_knowledge ADD COLUMN IF NOT EXISTS updated_at      timestamptz DEFAULT now();

-- Index for fast text search
CREATE INDEX IF NOT EXISTS idx_desk_knowledge_question ON desk_knowledge USING gin(to_tsvector('english', coalesce(question,'') || ' ' || coalesce(answer,'')));
CREATE INDEX IF NOT EXISTS idx_desk_knowledge_source   ON desk_knowledge(source);
CREATE INDEX IF NOT EXISTS idx_desk_knowledge_verified ON desk_knowledge(is_verified);
CREATE INDEX IF NOT EXISTS idx_desk_knowledge_public   ON desk_knowledge(is_public);
