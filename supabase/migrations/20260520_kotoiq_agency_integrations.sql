-- ============================================================
-- Phase 8: Client Profile Seeder v2 — per-agency API key / OAuth storage
--
-- Stores encrypted credentials for external source parsers:
--   - Typeform / Jotform / Google Forms personal tokens + API keys
--   - GBP agency-wide OAuth refresh tokens
--   - GBP per-client OAuth refresh tokens (scope_client_id set)
--   - Google Places API key (no OAuth)
--
-- Decisions referenced (see 08-CONTEXT.md):
--   D-02  per-agency Form Integrations — encrypted at rest in this jsonb
--   D-11  GBP three modes — distinct integration_kind per mode
--   D-32  Agency settings Integrations tab reads/writes this table
--
-- Encryption: this migration defines only the SCHEMA for encrypted payloads.
-- Application-layer encryption (AES-256-GCM or Supabase Vault) lands in
-- Plan 03 via src/lib/kotoiq/profileIntegrationsVault.ts.  Never write a
-- plaintext secret into encrypted_payload.
--
-- RLS pattern mirrors 20260507_kotoiq_client_profile.sql — service-role
-- only (USING (true) WITH CHECK (true)); app-layer scoping via
-- getKotoIQDb(agencyId) after DIRECT_AGENCY_TABLES adds the table name
-- (Task 2 Step 2).
--
-- updated_at trigger: follows the per-table precedent established by
-- 20260507_kotoiq_client_profile.sql (this repo has never had a shared
-- set_updated_at() helper; each table ships its own narrow function).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.koto_agency_integrations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id         uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,

  integration_kind  text NOT NULL
    CHECK (integration_kind IN (
      'typeform', 'jotform', 'google_forms',
      'gbp_agency_oauth', 'gbp_client_oauth', 'gbp_places_api'
    )),
  scope_client_id   uuid NULL REFERENCES public.clients(id) ON DELETE CASCADE,  -- NULL for agency-wide
  scope_location    text NULL,  -- GBP location name (e.g. "accounts/123/locations/456") when scoped

  -- Encrypted payload — jsonb shape is application-defined.
  -- Two flavours supported by profileIntegrationsVault.ts (Plan 03):
  --   1. Supabase Vault: { vault_secret_id: 'uuid' }
  --   2. Node-side AES-256-GCM: { iv, auth_tag, ciphertext } all base64
  encrypted_payload jsonb NOT NULL,
  payload_version   int  NOT NULL DEFAULT 1,  -- for rotation

  -- Non-secret metadata (safe to log, query)
  label             text,          -- operator-friendly label ("Main Typeform account")
  last_tested_at    timestamptz,
  last_tested_ok    boolean,
  last_test_error   text,

  -- Lifecycle
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,          -- user_id who added this
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_agency_integration UNIQUE (agency_id, integration_kind, scope_client_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_integrations_agency
  ON public.koto_agency_integrations(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_integrations_kind
  ON public.koto_agency_integrations(agency_id, integration_kind);

ALTER TABLE public.koto_agency_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agency_integrations_all" ON public.koto_agency_integrations;
CREATE POLICY "agency_integrations_all" ON public.koto_agency_integrations
  FOR ALL USING (true) WITH CHECK (true);   -- service-role only; scoped in app layer

-- Per-table updated_at trigger (mirrors 20260507 precedent — per Phase 7
-- Plan 1 STATE log: "Per-table updated_at trigger function pattern (one
-- CREATE FUNCTION per table) — repo never had a shared set_updated_at
-- helper").
CREATE OR REPLACE FUNCTION public.koto_agency_integrations_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agency_integrations_updated
  ON public.koto_agency_integrations;
CREATE TRIGGER trg_agency_integrations_updated
  BEFORE UPDATE ON public.koto_agency_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.koto_agency_integrations_set_updated_at();

COMMENT ON TABLE public.koto_agency_integrations IS
  'Phase 8: encrypted per-agency API keys + OAuth tokens for Typeform/Jotform/Google Forms/GBP. encrypted_payload uses Supabase Vault OR Node-side AES-256-GCM envelope (see src/lib/kotoiq/profileIntegrationsVault.ts in Plan 03).';
