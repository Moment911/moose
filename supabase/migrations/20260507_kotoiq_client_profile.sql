-- ============================================================
-- Phase 7: Client Profile Seeder v1 — Stage 0 entity graph seed
--
-- Creates the new authoritative profile table that pipelineOrchestrator.ts
-- Stage 0 produces and that every downstream stage (entity graph, hyperlocal
-- briefs, strategy engine, E-E-A-T, knowledge-graph exporter) consumes.
--
-- Companion table: kotoiq_clarifications (D-16) — the non-blocking
-- gap-finder queue surfaced in three coordinated views (chat widget,
-- "Needs Clarity" dashboard, in-context hotspots).
--
-- Decisions referenced (see .planning/phases/07-client-profile-seeder-v1-internal-ingest-gap-finder/07-CONTEXT.md):
--   D-01  new superset table — additive on top of clients / onboarding_answers / discovery
--   D-02  hybrid storage — hot columns + jsonb spillover with provenance
--   D-04  every field carries the full provenance quintet (VerifiedDataSource compliant)
--   D-05  operator may add / edit / delete fields freely; canonical schema is a baseline
--   D-10  margin notes — Claude proactive observations
--   D-11  discrepancy catcher — multiple ProvenanceRecord per field for cross-source conflict
--   D-16  three-views clarification queue
--   D-22  entity graph seed contract for downstream consumers
--   D-23  live pipeline ribbon backed by realtime subscription
--
-- RLS pattern mirrors supabase/migrations/20260505_kotoiq_builder.sql —
-- service-role only (USING (true) WITH CHECK (true)); app-layer scoping
-- via getKotoIQDb(agencyId) helper. Anon / authenticated clients cannot
-- hit the tables directly because Koto never uses the anon key for writes.
-- ============================================================

-- ── kotoiq_client_profile ───────────────────────────────────────────────────
-- Hot columns (D-02) match the dual-storage pattern of the clients table.
-- fields jsonb shape (D-04 provenance quintet, D-11 multi-source per field):
--   { [field_name]: ProvenanceRecord[] }
-- ProvenanceRecord:
--   {
--     value:              string | number | string[] | null,
--     source_type:        'onboarding_form' | 'voice_call' | 'discovery_doc'
--                       | 'operator_edit'   | 'claude_inference'
--                       | 'uploaded_doc'    | 'deferred_v2',
--     source_url?:        string,            -- canonical URL when applicable
--     source_ref?:        string,            -- non-URL ref (e.g. retell_call:abc)
--     source_snippet?:    string,            -- exact text the value was pulled from
--     char_offset_start?: int,               -- citation-on-hover anchor
--     char_offset_end?:   int,
--     captured_at:        timestamptz,       -- ISO 8601
--     confidence:         numeric (0.0-1.0),
--     edit_history?:      [{ at, by, prev_value }]
--   }

CREATE TABLE IF NOT EXISTS kotoiq_client_profile (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id                uuid NOT NULL,
  client_id                uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Hot columns (D-02)
  business_name            text,
  website                  text,
  primary_service          text,
  target_customer          text,
  service_area             text,
  phone                    text,
  founding_year            int,
  unique_selling_prop      text,
  industry                 text,
  city                     text,
  state                    text,

  -- Spillover with provenance (D-04, D-11) — see jsonb shape comment above.
  fields                   jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Serialized entity graph seed (D-22 contract). Regenerated on every update.
  -- Shape (consumed by hyperlocalContentEngine, semanticAgents, eeatEngine, ...):
  --   {
  --     client_node:           EntityGraphNode & { url?: string },
  --     service_nodes:         EntityGraphNode[],
  --     audience_nodes:        EntityGraphNode[],
  --     competitor_nodes:      EntityGraphNode[],
  --     service_area_nodes:    EntityGraphNode[],
  --     differentiator_edges:  EntityGraphEdge[],
  --     trust_anchor_nodes:    EntityGraphNode[],
  --     confidence_by_node:    { [node_id]: number }
  --   }
  entity_graph_seed        jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Gate state (D-13/14) — Claude-judged completeness.
  completeness_score       numeric(4,3),                       -- 0.000 to 1.000
  completeness_reasoning   text,
  soft_gaps                jsonb DEFAULT '[]'::jsonb,          -- [{ field, reason }]

  -- D-10 margin notes — Claude proactive observations.
  -- Shape per margin note:
  --   {
  --     id:               string,
  --     field_path:       string,
  --     question:         string,
  --     suggested_value?: string | null,
  --     source_ref:       string,
  --     created_at:       timestamptz,
  --     status:           'pending' | 'accepted' | 'rejected' | 'edited'
  --   }
  margin_notes             jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Source registry (D-09 page-wide drop zone + D-25 paste extraction).
  --   [{ source_type, source_url?, source_ref?, added_at, added_by, metadata? }]
  sources                  jsonb DEFAULT '[]'::jsonb,

  -- Lifecycle
  last_seeded_at           timestamptz,
  last_edited_at           timestamptz,
  launched_at              timestamptz,
  last_pipeline_run_id     text,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_profile_per_client_agency UNIQUE (agency_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_kotoiq_profile_agency_client
  ON kotoiq_client_profile (agency_id, client_id);
CREATE INDEX IF NOT EXISTS idx_kotoiq_profile_agency_launched
  ON kotoiq_client_profile (agency_id, launched_at DESC);
CREATE INDEX IF NOT EXISTS idx_kotoiq_profile_business_name
  ON kotoiq_client_profile (agency_id, business_name);

ALTER TABLE kotoiq_client_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kotoiq_client_profile_all" ON kotoiq_client_profile;
CREATE POLICY "kotoiq_client_profile_all" ON kotoiq_client_profile
  FOR ALL USING (true) WITH CHECK (true);   -- service-role only; scoped in app layer

-- ── kotoiq_clarifications ───────────────────────────────────────────────────
-- D-16 — three views (chat widget, dashboard tab, hotspot dots) read this
-- single table.

CREATE TABLE IF NOT EXISTS kotoiq_clarifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id           uuid NOT NULL,
  client_id           uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  profile_id          uuid REFERENCES kotoiq_client_profile(id) ON DELETE CASCADE,

  question            text NOT NULL,
  reason              text,                                     -- "answering this unlocks N hyperlocal page drafts"
  target_field_path   text,                                     -- nullable for general questions
  severity            text NOT NULL CHECK (severity IN ('low','medium','high')),

  -- Lifecycle: open → asked_client → answered → skipped (D-17)
  status              text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','asked_client','answered','skipped')),
  asked_channel       text CHECK (asked_channel IN ('sms','email','portal','operator')),
  asked_at            timestamptz,
  answered_at         timestamptz,
  answer_text         text,
  answered_by         text,                                     -- 'operator' | 'client' | 'claude_inferred'

  -- Downstream impact (D-14)
  impact_hint         text,
  impact_unlocks      jsonb DEFAULT '[]'::jsonb,                -- [{ stage, unit }]

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kotoiq_clarifications_agency_client_status
  ON kotoiq_clarifications (agency_id, client_id, status);
CREATE INDEX IF NOT EXISTS idx_kotoiq_clarifications_severity
  ON kotoiq_clarifications (agency_id, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kotoiq_clarifications_profile
  ON kotoiq_clarifications (profile_id);

ALTER TABLE kotoiq_clarifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kotoiq_clarifications_all" ON kotoiq_clarifications;
CREATE POLICY "kotoiq_clarifications_all" ON kotoiq_clarifications
  FOR ALL USING (true) WITH CHECK (true);   -- service-role only; scoped in app layer

-- ── Realtime publication (D-23 ribbon + D-20 chat orb badge pulse) ──────────
-- Wrapped in a DO block so re-runs don't error if already added — same idiom
-- used in 20260472_events_and_realtime.sql.

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE kotoiq_clarifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE kotoiq_pipeline_runs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ── updated_at triggers ─────────────────────────────────────────────────────
-- Reuses the existing per-table updated_at idiom from 20260461_clients_updated_at_trigger.sql.
-- The repo never created a generic shared set_updated_at() function — each
-- table that wants the behavior gets its own narrow function. We follow that
-- precedent here so every kotoiq_* table is self-contained and
-- DROP TABLE removes its trigger function with it.

CREATE OR REPLACE FUNCTION set_updated_at_on_kotoiq_client_profile()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kotoiq_client_profile_set_updated_at ON kotoiq_client_profile;
CREATE TRIGGER kotoiq_client_profile_set_updated_at
  BEFORE UPDATE ON kotoiq_client_profile
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_on_kotoiq_client_profile();

CREATE OR REPLACE FUNCTION set_updated_at_on_kotoiq_clarifications()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kotoiq_clarifications_set_updated_at ON kotoiq_clarifications;
CREATE TRIGGER kotoiq_clarifications_set_updated_at
  BEFORE UPDATE ON kotoiq_clarifications
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_on_kotoiq_clarifications();
