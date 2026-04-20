-- Scout Voice — Company + Persona schema (H1)
--
-- Two new tables that give Scout calls structured people-level and
-- company-level context instead of raw text fields on scout_voice_calls.
--
-- Design choices:
--   - Provenance-tracked fields use jsonb: { value, source, confidence,
--     confirmed_at, manually_verified }. This matches the spec (§31) and
--     keeps the column count sane while allowing field-level audit.
--   - Insights (pain_points, objections, budget_signals) accumulate as
--     jsonb arrays with timestamps — append-only, never overwritten.
--   - scout_voice_calls gains optional FK columns (company_id, persona_id)
--     but keeps denormalized company_name/contact_name for query speed.

-- ============================================================================
-- scout_voice_companies — one per prospect company per agency
-- ============================================================================
CREATE TABLE IF NOT EXISTS scout_voice_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,

  -- Identity
  name text NOT NULL,
  website text,
  phone text,
  address text,
  industry text,
  sic_code text,
  naics_code text,
  estimated_size text,  -- 'solo', '2-10', '11-50', '51-200', '201-1000', '1000+'

  -- Research data (spec §6 — fetched, not hardcoded)
  research_data jsonb DEFAULT '{}'::jsonb,
    -- { services_offered, recent_news[], tech_stack{}, social_presence{},
    --   competitors_ranking[], research_fetched_at }

  -- Google Business Profile snapshot
  gbp_place_id text,
  gbp_review_count integer,
  gbp_rating numeric(2,1),
  gbp_response_rate numeric(3,2),
  gbp_hours_accuracy text,  -- 'accurate', 'outdated', 'missing'
  gbp_fetched_at timestamptz,

  -- Org chart pointers (set after personas are created)
  primary_dm_id uuid,    -- FK added after personas table exists
  backup_dm_1_id uuid,
  backup_dm_2_id uuid,

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_scout_company_agency_name UNIQUE (agency_id, name)
);

CREATE INDEX IF NOT EXISTS idx_scout_companies_agency ON scout_voice_companies(agency_id);
CREATE INDEX IF NOT EXISTS idx_scout_companies_industry ON scout_voice_companies(industry) WHERE industry IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_companies_name ON scout_voice_companies(agency_id, name);

ALTER TABLE scout_voice_companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scout_voice_companies_open" ON scout_voice_companies;
CREATE POLICY "scout_voice_companies_open" ON scout_voice_companies FOR ALL
  USING (true) WITH CHECK (true);

-- ============================================================================
-- scout_voice_personas — one per person discovered, per agency
-- ============================================================================
CREATE TABLE IF NOT EXISTS scout_voice_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  company_id uuid REFERENCES scout_voice_companies(id) ON DELETE CASCADE,

  -- Identity — provenance-tracked (spec §31)
  -- Each is jsonb: { value, source, confidence, confirmed_at, manually_verified }
  name jsonb NOT NULL DEFAULT '{"value":null}'::jsonb,
  preferred_name jsonb DEFAULT '{"value":null}'::jsonb,
  title jsonb DEFAULT '{"value":null}'::jsonb,

  -- Contact methods (all with source + timestamp)
  direct_phone text,
  extension text,
  email text,
  linkedin_url text,

  -- DM scoring (spec §7)
  dm_score integer,  -- 0-100, calculated from title
  designation text DEFAULT 'unknown',
    -- primary_dm | backup_dm_1 | backup_dm_2 | unknown | not_dm
  tenure text,  -- e.g. '3 years'

  -- Contact preferences (STATED, not inferred — spec §31)
  preferred_channel text,  -- voice | email | text | linkedin
  preferred_time text,     -- morning | afternoon | evening
  do_not_call_after time,

  -- Accumulating insights (append-only jsonb arrays)
  pain_points jsonb DEFAULT '[]'::jsonb,
    -- [{ text, call_id, captured_at }]
  objections jsonb DEFAULT '[]'::jsonb,
    -- [{ text, agent_response, resolution_status, call_id, captured_at }]
  buying_signals jsonb DEFAULT '[]'::jsonb,
    -- [{ type, quote, call_id, captured_at }]
  budget_signals jsonb DEFAULT '[]'::jsonb,
    -- [{ amount_or_range, context, call_id, captured_at }]
  timeline_signals jsonb DEFAULT '[]'::jsonb,
    -- [{ signal, call_id, captured_at }]
  competitors_mentioned jsonb DEFAULT '[]'::jsonb,
    -- [{ vendor, context, call_id, captured_at }]
  personal_notes jsonb DEFAULT '[]'::jsonb,
    -- [{ note, source, captured_at }]

  -- Call history summary (denormalized for fast access)
  call_count integer DEFAULT 0,
  first_contact_at timestamptz,
  last_contact_at timestamptz,

  -- Opt-out (mirrors TCPA record, but persona-level)
  do_not_contact boolean DEFAULT false,
  do_not_contact_at timestamptz,

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scout_personas_agency ON scout_voice_personas(agency_id);
CREATE INDEX IF NOT EXISTS idx_scout_personas_company ON scout_voice_personas(company_id);
CREATE INDEX IF NOT EXISTS idx_scout_personas_dm ON scout_voice_personas(company_id, designation)
  WHERE designation IN ('primary_dm', 'backup_dm_1', 'backup_dm_2');
CREATE INDEX IF NOT EXISTS idx_scout_personas_phone ON scout_voice_personas(direct_phone)
  WHERE direct_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_personas_email ON scout_voice_personas(email)
  WHERE email IS NOT NULL;

ALTER TABLE scout_voice_personas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scout_voice_personas_open" ON scout_voice_personas;
CREATE POLICY "scout_voice_personas_open" ON scout_voice_personas FOR ALL
  USING (true) WITH CHECK (true);

-- ============================================================================
-- Add DM FK references back to companies (now that personas table exists)
-- ============================================================================
ALTER TABLE scout_voice_companies
  ADD CONSTRAINT fk_scout_company_primary_dm
    FOREIGN KEY (primary_dm_id) REFERENCES scout_voice_personas(id) ON DELETE SET NULL;
ALTER TABLE scout_voice_companies
  ADD CONSTRAINT fk_scout_company_backup_dm_1
    FOREIGN KEY (backup_dm_1_id) REFERENCES scout_voice_personas(id) ON DELETE SET NULL;
ALTER TABLE scout_voice_companies
  ADD CONSTRAINT fk_scout_company_backup_dm_2
    FOREIGN KEY (backup_dm_2_id) REFERENCES scout_voice_personas(id) ON DELETE SET NULL;

-- ============================================================================
-- Extend scout_voice_calls with optional FK columns
-- Keep denormalized company_name/contact_name for query speed
-- ============================================================================
ALTER TABLE scout_voice_calls
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES scout_voice_companies(id) ON DELETE SET NULL;
ALTER TABLE scout_voice_calls
  ADD COLUMN IF NOT EXISTS persona_id uuid REFERENCES scout_voice_personas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scout_calls_company ON scout_voice_calls(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_calls_persona ON scout_voice_calls(persona_id) WHERE persona_id IS NOT NULL;

-- ============================================================================
-- updated_at triggers
-- ============================================================================
DROP TRIGGER IF EXISTS trg_scout_voice_companies_updated ON scout_voice_companies;
CREATE TRIGGER trg_scout_voice_companies_updated BEFORE UPDATE ON scout_voice_companies
  FOR EACH ROW EXECUTE FUNCTION scout_voice_touch_updated_at();

DROP TRIGGER IF EXISTS trg_scout_voice_personas_updated ON scout_voice_personas;
CREATE TRIGGER trg_scout_voice_personas_updated BEFORE UPDATE ON scout_voice_personas
  FOR EACH ROW EXECUTE FUNCTION scout_voice_touch_updated_at();
