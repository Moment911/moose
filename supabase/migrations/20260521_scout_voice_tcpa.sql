-- TCPA compliance records for Scout Voice outbound dialing.
--
-- Every phone number Scout dials must have a corresponding row here before
-- the call is placed. The API (src/app/api/scout/voice/route.ts) already
-- references checkDNC() and koto_voice_tcpa_records — this migration
-- materializes the table and indexes those checks depend on.
--
-- Key constraints enforced by this table:
--   1. Consent status tracking (express written/oral, implied, none, revoked)
--   2. Call-window guardrails (08:00–21:00 local time per TCPA)
--   3. Cell phone detection (ATDS rules require express written consent)
--   4. Opt-out persistence (DNC registry + prospect request + admin)
--   5. AI disclosure requirement flag (state-specific disclosure language)

-- ============================================================================
-- koto_voice_tcpa_records — per-phone TCPA compliance state
-- ============================================================================
CREATE TABLE IF NOT EXISTS koto_voice_tcpa_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  phone text NOT NULL,  -- E.164 format

  -- Consent
  consent_status text NOT NULL CHECK (consent_status IN ('express_written', 'express_oral', 'implied', 'none', 'revoked')),
  consent_source text,  -- 'web_form', 'verbal', 'written', 'api_import'
  consent_timestamp timestamptz,
  consent_evidence_url text,

  -- AI disclosure (required in many jurisdictions for AI-initiated calls)
  ai_disclosure_required boolean NOT NULL DEFAULT true,
  ai_disclosure_language text,

  -- Opt-out / DNC
  opt_out boolean NOT NULL DEFAULT false,
  opt_out_at timestamptz,
  opt_out_source text,  -- 'prospect_request', 'admin', 'dnc_registry'

  -- Jurisdiction & call window
  jurisdictions_active text[] DEFAULT '{}',
  call_window_start time DEFAULT '08:00',
  call_window_end time DEFAULT '21:00',
  timezone text,  -- e.g. 'America/New_York'

  -- Cell phone detection (ATDS restrictions)
  is_cell_phone boolean,
  cell_detection_method text,  -- 'carrier_lookup', 'manual', 'imported'
  cell_detected_at timestamptz,

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,

  -- One record per agency+phone combination
  CONSTRAINT uq_tcpa_agency_phone UNIQUE (agency_id, phone)
);

COMMENT ON TABLE koto_voice_tcpa_records IS
  'TCPA compliance state for every phone number Scout Voice may dial. '
  'Checked before every outbound call to enforce consent, call windows, '
  'opt-out status, and AI disclosure requirements.';

-- Primary lookup path: agency + phone
CREATE INDEX IF NOT EXISTS idx_tcpa_agency_phone ON koto_voice_tcpa_records(agency_id, phone);

-- Fast filter for opt-out numbers (DNC suppression list)
CREATE INDEX IF NOT EXISTS idx_tcpa_agency_optout ON koto_voice_tcpa_records(agency_id, opt_out) WHERE opt_out = true;

-- ============================================================================
-- RLS — service-role access pattern (matches other Scout Voice tables)
-- ============================================================================
ALTER TABLE koto_voice_tcpa_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "koto_voice_tcpa_records_open" ON koto_voice_tcpa_records;
CREATE POLICY "koto_voice_tcpa_records_open" ON koto_voice_tcpa_records FOR ALL
  USING (true) WITH CHECK (true);

-- ============================================================================
-- updated_at trigger (reuses existing scout_voice_touch_updated_at function)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_koto_voice_tcpa_records_updated ON koto_voice_tcpa_records;
CREATE TRIGGER trg_koto_voice_tcpa_records_updated BEFORE UPDATE ON koto_voice_tcpa_records
  FOR EACH ROW EXECUTE FUNCTION scout_voice_touch_updated_at();

-- ============================================================================
-- Extend scout_voice_agents with jurisdictions column (if not already present)
-- ============================================================================
ALTER TABLE scout_voice_agents ADD COLUMN IF NOT EXISTS jurisdictions_active text[] DEFAULT '{}';
