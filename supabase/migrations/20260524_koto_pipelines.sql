-- ══════════════════════════════════════════════════════════════════════════════
-- KOTO PIPELINES — Kanban + multi-pipeline + custom fields + two-way GHL sync
-- Phase A: schema + backfill. UI + sync engine land in later phases.
--
-- Strategy: keep the existing koto_opportunities.stage text column during
-- transition (drop only its CHECK constraint) and add a parallel stage_id FK.
-- New Kanban UI reads stage_id; legacy /api/opportunities code keeps working.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Pipelines ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS koto_pipelines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id         uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id         uuid REFERENCES clients(id) ON DELETE CASCADE, -- NULL = agency-wide
  name              text NOT NULL,
  is_default        boolean DEFAULT false,
  source_system     text NOT NULL DEFAULT 'koto' CHECK (source_system IN ('koto','ghl')),
  ghl_pipeline_id   text,
  ghl_location_id   text,
  last_synced_at    timestamptz,
  sort_order        int DEFAULT 0,
  archived          boolean DEFAULT false,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipelines_agency ON koto_pipelines(agency_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_client ON koto_pipelines(client_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_ghl ON koto_pipelines(ghl_pipeline_id) WHERE ghl_pipeline_id IS NOT NULL;

-- ── 2. Pipeline stages (Kanban columns) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS koto_pipeline_stages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id       uuid NOT NULL REFERENCES koto_pipelines(id) ON DELETE CASCADE,
  name              text NOT NULL,
  sort_order        int NOT NULL DEFAULT 0,
  color             text DEFAULT '#6B7280',
  is_won            boolean DEFAULT false,
  is_lost           boolean DEFAULT false,
  ghl_stage_id      text,
  source_system     text NOT NULL DEFAULT 'koto' CHECK (source_system IN ('koto','ghl')),
  last_synced_at    timestamptz,
  archived          boolean DEFAULT false,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stages_pipeline ON koto_pipeline_stages(pipeline_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_stages_ghl ON koto_pipeline_stages(ghl_stage_id) WHERE ghl_stage_id IS NOT NULL;

-- ── 3. Custom field definitions (bidirectional GHL mapping) ─────────────────
CREATE TABLE IF NOT EXISTS koto_custom_fields (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id         uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id         uuid REFERENCES clients(id) ON DELETE CASCADE, -- NULL = agency-wide
  name              text NOT NULL,      -- human-facing label
  field_key         text NOT NULL,      -- slug / machine name
  field_type        text NOT NULL CHECK (field_type IN ('text','number','date','boolean','email','phone','url','select','multi_select','textarea')),
  options           jsonb DEFAULT '[]'::jsonb,   -- for select / multi_select
  entity_type       text NOT NULL DEFAULT 'opportunity' CHECK (entity_type IN ('opportunity','contact')),
  source_system     text NOT NULL DEFAULT 'koto' CHECK (source_system IN ('koto','ghl')),
  ghl_field_id      text,
  ghl_location_id   text,
  sync_direction    text NOT NULL DEFAULT 'both' CHECK (sync_direction IN ('koto_to_ghl','ghl_to_koto','both','none')),
  last_synced_at    timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cf_agency ON koto_custom_fields(agency_id);
CREATE INDEX IF NOT EXISTS idx_cf_ghl ON koto_custom_fields(ghl_field_id) WHERE ghl_field_id IS NOT NULL;

-- ── 4. Contacts — includes GHL-only contacts not yet in a pipeline ──────────
CREATE TABLE IF NOT EXISTS koto_contacts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id         uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id         uuid REFERENCES clients(id) ON DELETE SET NULL,
  first_name        text,
  last_name         text,
  email             text,
  phone             text,
  company_name      text,
  source_system     text NOT NULL DEFAULT 'koto' CHECK (source_system IN ('koto','ghl')),
  ghl_contact_id    text,
  ghl_location_id   text,
  custom_fields     jsonb DEFAULT '{}'::jsonb,
  tags              text[] DEFAULT '{}',
  last_synced_at    timestamptz,
  deleted_at        timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_agency ON koto_contacts(agency_id);
CREATE INDEX IF NOT EXISTS idx_contacts_client ON koto_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_contacts_ghl ON koto_contacts(ghl_contact_id) WHERE ghl_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_email ON koto_contacts(email) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON koto_contacts(phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;

-- ── 5. Appointments ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS koto_appointments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id         uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id         uuid REFERENCES clients(id) ON DELETE SET NULL,
  opportunity_id    uuid REFERENCES koto_opportunities(id) ON DELETE SET NULL,
  contact_id        uuid REFERENCES koto_contacts(id) ON DELETE SET NULL,
  title             text,
  starts_at         timestamptz NOT NULL,
  ends_at           timestamptz,
  status            text NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','confirmed','completed','no_show','cancelled','rescheduled')),
  source_system     text NOT NULL DEFAULT 'koto' CHECK (source_system IN ('koto','ghl','gcal')),
  ghl_appointment_id text,
  ghl_calendar_id   text,
  gcal_event_id     text,
  notes             text,
  last_synced_at    timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appts_agency ON koto_appointments(agency_id);
CREATE INDEX IF NOT EXISTS idx_appts_opp ON koto_appointments(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_appts_starts ON koto_appointments(starts_at);
CREATE INDEX IF NOT EXISTS idx_appts_ghl ON koto_appointments(ghl_appointment_id) WHERE ghl_appointment_id IS NOT NULL;

-- ── 6. Opportunities — drop hardcoded CHECK, add pipeline/stage FKs ─────────
ALTER TABLE koto_opportunities DROP CONSTRAINT IF EXISTS koto_opportunities_stage_check;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS ghl_opportunity_id text;  -- may be missing due to schema drift from 20260445
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS ghl_contact_id     text;  -- same; self-heal
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS ghl_pushed_at      timestamptz;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS pipeline_id     uuid REFERENCES koto_pipelines(id) ON DELETE SET NULL;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS stage_id        uuid REFERENCES koto_pipeline_stages(id) ON DELETE SET NULL;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS client_id       uuid REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS source_system   text DEFAULT 'koto';
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS ghl_pipeline_id text;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS ghl_stage_id    text;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS ghl_location_id text;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS custom_fields   jsonb DEFAULT '{}'::jsonb;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS last_synced_at  timestamptz;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS sort_order      int DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_opps_pipeline ON koto_opportunities(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_opps_stage_id ON koto_opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_opps_client_new ON koto_opportunities(client_id);
CREATE INDEX IF NOT EXISTS idx_opps_ghl_opp ON koto_opportunities(ghl_opportunity_id) WHERE ghl_opportunity_id IS NOT NULL;

-- ── 7. Backfill: default pipeline per agency + map legacy stage text ────────
-- Idempotent — safe to re-run. Creates a "Sales Pipeline" for each agency that
-- has opportunities, seeds it with the 7 legacy stages (1:1 with old text
-- values), and assigns pipeline_id + stage_id on every opportunity row.
DO $$
DECLARE
  r_agency      RECORD;
  v_pipeline_id uuid;
  stage_map     jsonb := '[
    {"key":"new",      "name":"New",      "sort":1, "color":"#6B7280", "is_won":false, "is_lost":false},
    {"key":"engaged",  "name":"Engaged",  "sort":2, "color":"#3B82F6", "is_won":false, "is_lost":false},
    {"key":"qualified","name":"Qualified","sort":3, "color":"#8B5CF6", "is_won":false, "is_lost":false},
    {"key":"proposal", "name":"Proposal", "sort":4, "color":"#F59E0B", "is_won":false, "is_lost":false},
    {"key":"won",      "name":"Won",      "sort":5, "color":"#10B981", "is_won":true,  "is_lost":false},
    {"key":"lost",     "name":"Lost",     "sort":6, "color":"#EF4444", "is_won":false, "is_lost":true},
    {"key":"archived", "name":"Archived", "sort":7, "color":"#9CA3AF", "is_won":false, "is_lost":true}
  ]'::jsonb;
  s             jsonb;
BEGIN
  FOR r_agency IN SELECT DISTINCT agency_id FROM koto_opportunities WHERE agency_id IS NOT NULL LOOP
    -- 7a. find or create default pipeline
    SELECT id INTO v_pipeline_id
      FROM koto_pipelines
      WHERE agency_id = r_agency.agency_id AND is_default = true AND archived = false
      LIMIT 1;

    IF v_pipeline_id IS NULL THEN
      INSERT INTO koto_pipelines (agency_id, name, is_default, source_system)
      VALUES (r_agency.agency_id, 'Sales Pipeline', true, 'koto')
      RETURNING id INTO v_pipeline_id;
    END IF;

    -- 7b. seed the 7 legacy stages (skip if already exist by name)
    FOR s IN SELECT * FROM jsonb_array_elements(stage_map) LOOP
      INSERT INTO koto_pipeline_stages (pipeline_id, name, sort_order, color, is_won, is_lost)
      SELECT v_pipeline_id,
             s->>'name',
             (s->>'sort')::int,
             s->>'color',
             (s->>'is_won')::boolean,
             (s->>'is_lost')::boolean
      WHERE NOT EXISTS (
        SELECT 1 FROM koto_pipeline_stages
        WHERE pipeline_id = v_pipeline_id AND name = s->>'name'
      );
    END LOOP;

    -- 7c. backfill opportunities: set pipeline_id + map stage text → stage_id
    UPDATE koto_opportunities o
       SET pipeline_id = v_pipeline_id,
           stage_id    = ps.id
      FROM koto_pipeline_stages ps
     WHERE o.agency_id = r_agency.agency_id
       AND o.pipeline_id IS NULL
       AND ps.pipeline_id = v_pipeline_id
       AND lower(ps.name) = CASE
             WHEN o.stage IN ('new','engaged','qualified','proposal','won','lost','archived') THEN o.stage
             ELSE 'new'
           END;
  END LOOP;
END $$;

-- ── 8. updated_at triggers ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_pipeline_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pipelines_updated ON koto_pipelines;
CREATE TRIGGER trg_pipelines_updated BEFORE UPDATE ON koto_pipelines
  FOR EACH ROW EXECUTE FUNCTION update_pipeline_updated_at();

DROP TRIGGER IF EXISTS trg_stages_updated ON koto_pipeline_stages;
CREATE TRIGGER trg_stages_updated BEFORE UPDATE ON koto_pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION update_pipeline_updated_at();

DROP TRIGGER IF EXISTS trg_cf_updated ON koto_custom_fields;
CREATE TRIGGER trg_cf_updated BEFORE UPDATE ON koto_custom_fields
  FOR EACH ROW EXECUTE FUNCTION update_pipeline_updated_at();

DROP TRIGGER IF EXISTS trg_contacts_updated ON koto_contacts;
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON koto_contacts
  FOR EACH ROW EXECUTE FUNCTION update_pipeline_updated_at();

DROP TRIGGER IF EXISTS trg_appts_updated ON koto_appointments;
CREATE TRIGGER trg_appts_updated BEFORE UPDATE ON koto_appointments
  FOR EACH ROW EXECUTE FUNCTION update_pipeline_updated_at();

-- ── 9. RLS — same shape as koto_opportunities (agency_id = auth.uid()) ──────
ALTER TABLE koto_pipelines       ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_custom_fields   ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_contacts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE koto_appointments    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency_pipelines" ON koto_pipelines;
CREATE POLICY "agency_pipelines" ON koto_pipelines FOR ALL USING (agency_id = auth.uid());

DROP POLICY IF EXISTS "agency_stages" ON koto_pipeline_stages;
CREATE POLICY "agency_stages" ON koto_pipeline_stages FOR ALL
  USING (pipeline_id IN (SELECT id FROM koto_pipelines WHERE agency_id = auth.uid()));

DROP POLICY IF EXISTS "agency_cf" ON koto_custom_fields;
CREATE POLICY "agency_cf" ON koto_custom_fields FOR ALL USING (agency_id = auth.uid());

DROP POLICY IF EXISTS "agency_contacts" ON koto_contacts;
CREATE POLICY "agency_contacts" ON koto_contacts FOR ALL USING (agency_id = auth.uid());

DROP POLICY IF EXISTS "agency_appts" ON koto_appointments;
CREATE POLICY "agency_appts" ON koto_appointments FOR ALL USING (agency_id = auth.uid());
