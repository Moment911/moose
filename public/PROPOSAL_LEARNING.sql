
-- ══════════════════════════════════════════════════════════════════════════════
-- PROPOSAL DOCUMENT LEARNING SYSTEM
-- Upload past proposals/SOWs → extract modules → build new docs in your voice
-- ══════════════════════════════════════════════════════════════════════════════

-- Uploaded source documents (past proposals, SOWs, agreements)
CREATE TABLE IF NOT EXISTS proposal_source_docs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  file_name       text NOT NULL,
  file_type       text,                    -- pdf, docx, txt
  doc_type        text DEFAULT 'proposal', -- proposal|sow|agreement|contract
  raw_text        text,                    -- extracted full text
  parsed_at       timestamptz,
  modules_extracted int DEFAULT 0,
  status          text DEFAULT 'pending',  -- pending|parsing|done|error
  error           text,
  created_at      timestamptz DEFAULT now()
);

-- Extracted writing style profile (learned from uploaded docs)
CREATE TABLE IF NOT EXISTS proposal_voice_profile (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid UNIQUE,
  tone            text,           -- professional, conversational, authoritative
  avg_section_length text,
  common_phrases  text[],         -- phrases you use often
  pricing_style   text,           -- how you present pricing
  signature_elements text[],      -- things you always include
  writing_sample  text,           -- representative paragraph from your docs
  doc_count       int DEFAULT 0,  -- how many docs trained on
  last_updated    timestamptz DEFAULT now()
);

-- Module library extracted from uploaded docs
-- Each row is a reusable block: scope, deliverable set, pricing, terms, etc.
CREATE TABLE IF NOT EXISTS proposal_modules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  source_doc_id   uuid REFERENCES proposal_source_docs(id) ON DELETE SET NULL,
  module_type     text NOT NULL, -- 'service','scope','deliverables','pricing','timeline','payment_terms','guarantee','intro','closing','legal'
  title           text NOT NULL,
  content         text NOT NULL, -- the actual extracted text
  refined_content text,          -- AI-polished version
  tags            text[],        -- ['seo','local','monthly','setup']
  price_hint      numeric,       -- if pricing was found in this module
  price_type      text,          -- monthly|one_time|custom
  usage_count     int DEFAULT 0, -- how many times used in proposals
  is_favorite     boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposal_modules_agency ON proposal_modules(agency_id, module_type);
CREATE INDEX IF NOT EXISTS idx_proposal_modules_type   ON proposal_modules(agency_id, module_type, usage_count DESC);

-- Template presets built from modules (full doc templates)
CREATE TABLE IF NOT EXISTS proposal_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  name            text NOT NULL,
  doc_type        text DEFAULT 'proposal',  -- proposal|sow|agreement
  description     text,
  module_ids      text[],   -- ordered list of module IDs
  structure       jsonb,    -- full template structure with placeholders
  is_default      boolean DEFAULT false,
  usage_count     int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

SELECT 'Proposal learning system tables created ✓' as result;
