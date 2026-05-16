-- ============================================================
-- KotoIQ — AEO Visibility Tracker (Phase A)
--
-- Continuous tracking of how each client's brand (and competitors)
-- appears in AI search answers across ChatGPT, Claude, Gemini,
-- Perplexity, and Google AI Overviews.
--
-- Three tables:
--   kotoiq_aeo_prompts        — the prompts we test per client
--   kotoiq_aeo_competitors    — brands to look for in answers
--   kotoiq_aeo_runs           — one row per (prompt × engine × run)
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_aeo_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  category text,                 -- 'commercial' | 'informational' | 'comparison' | 'local' | 'problem'
  intent text,                   -- free-text intent tag
  is_active boolean DEFAULT true,
  created_by text DEFAULT 'manual',  -- 'manual' | 'ai_seed' | 'csv'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aeo_prompts_client_active
  ON kotoiq_aeo_prompts(client_id, is_active);

CREATE TABLE IF NOT EXISTS kotoiq_aeo_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  aliases text[],                -- ['Acme', 'Acme Inc', 'AcmeCo']
  domain text,
  is_self boolean DEFAULT false, -- true for the client's own brand row
  added_at timestamptz DEFAULT now(),
  UNIQUE (client_id, brand_name)
);

CREATE INDEX IF NOT EXISTS idx_aeo_competitors_client
  ON kotoiq_aeo_competitors(client_id);

CREATE TABLE IF NOT EXISTS kotoiq_aeo_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES kotoiq_aeo_prompts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  engine text NOT NULL,          -- 'chatgpt' | 'claude' | 'gemini' | 'perplexity' | 'google_aio'
  raw_response text,
  response_ms int,
  cited_urls jsonb,              -- [{url, anchor, position}]
  brand_mentions jsonb,          -- [{brand, position, sentiment, snippet}]
  mention_count int DEFAULT 0,   -- denormalized total mentions across all tracked brands
  client_mentioned boolean DEFAULT false,  -- denormalized: did client's own brand appear
  client_position int,           -- 1, 2, 3 ... if mentioned; null if not
  error text,                    -- non-null if engine call failed
  cost_usd numeric(10,6) DEFAULT 0,
  run_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aeo_runs_client_time
  ON kotoiq_aeo_runs(client_id, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_aeo_runs_prompt_engine_time
  ON kotoiq_aeo_runs(prompt_id, engine, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_aeo_runs_client_mentioned
  ON kotoiq_aeo_runs(client_id, client_mentioned, run_at DESC);

-- RLS — keep consistent with other kotoiq_* tables (service-role only for now)
ALTER TABLE kotoiq_aeo_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_aeo_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_aeo_runs ENABLE ROW LEVEL SECURITY;
