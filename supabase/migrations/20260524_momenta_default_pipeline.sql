-- ══════════════════════════════════════════════════════════════════════════════
-- MOMENTA MARKETING — seed default pipeline with user-requested stages.
-- Runs after 20260524_koto_pipelines.sql. Idempotent — safe to re-run.
--
-- Target stages (in order):
--   1. New Lead
--   2. Appt Scheduled
--   3. Call Back
--   4. No Show
--   5. Send Proposal
--   6. Closed Won
--   7. Closed Lost
--
-- Strategy: find Momenta's agency row, create (or fetch) a pipeline named
-- "Sales Pipeline" marked as default, add the 7 stages in order, then
-- re-map any existing legacy stages so Momenta's data lands in the right
-- new stage. Any OTHER default pipeline gets un-defaulted.
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_agency_id     uuid;
  v_pipeline_id   uuid;
  v_stage_new         uuid;
  v_stage_appt        uuid;
  v_stage_callback    uuid;
  v_stage_noshow      uuid;
  v_stage_proposal    uuid;
  v_stage_won         uuid;
  v_stage_lost        uuid;
BEGIN
  -- 1. locate Momenta (fuzzy match on name or slug)
  SELECT id INTO v_agency_id
    FROM agencies
   WHERE name ILIKE 'Momenta%' OR slug ILIKE 'momenta%'
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_agency_id IS NULL THEN
    RAISE NOTICE 'Momenta Marketing agency row not found — skipping seed. Create an agency with name ILIKE Momenta%% and re-run.';
    RETURN;
  END IF;

  RAISE NOTICE 'Seeding Momenta pipeline for agency_id = %', v_agency_id;

  -- 2. find or create Momenta's default pipeline
  SELECT id INTO v_pipeline_id
    FROM koto_pipelines
   WHERE agency_id = v_agency_id AND name = 'Sales Pipeline' AND archived = false
   LIMIT 1;

  IF v_pipeline_id IS NULL THEN
    INSERT INTO koto_pipelines (agency_id, name, is_default, source_system)
    VALUES (v_agency_id, 'Sales Pipeline', true, 'koto')
    RETURNING id INTO v_pipeline_id;
  ELSE
    UPDATE koto_pipelines SET is_default = true WHERE id = v_pipeline_id;
  END IF;

  -- Ensure exactly one default per agency
  UPDATE koto_pipelines
     SET is_default = false
   WHERE agency_id = v_agency_id AND id <> v_pipeline_id;

  -- 3. upsert the 7 target stages (by name), capture ids
  INSERT INTO koto_pipeline_stages (pipeline_id, name, sort_order, color, is_won, is_lost)
  SELECT v_pipeline_id, 'New Lead', 1, '#6B7280', false, false
   WHERE NOT EXISTS (SELECT 1 FROM koto_pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'New Lead');

  INSERT INTO koto_pipeline_stages (pipeline_id, name, sort_order, color, is_won, is_lost)
  SELECT v_pipeline_id, 'Appt Scheduled', 2, '#3B82F6', false, false
   WHERE NOT EXISTS (SELECT 1 FROM koto_pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Appt Scheduled');

  INSERT INTO koto_pipeline_stages (pipeline_id, name, sort_order, color, is_won, is_lost)
  SELECT v_pipeline_id, 'Call Back', 3, '#8B5CF6', false, false
   WHERE NOT EXISTS (SELECT 1 FROM koto_pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Call Back');

  INSERT INTO koto_pipeline_stages (pipeline_id, name, sort_order, color, is_won, is_lost)
  SELECT v_pipeline_id, 'No Show', 4, '#F97316', false, false
   WHERE NOT EXISTS (SELECT 1 FROM koto_pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'No Show');

  INSERT INTO koto_pipeline_stages (pipeline_id, name, sort_order, color, is_won, is_lost)
  SELECT v_pipeline_id, 'Send Proposal', 5, '#F59E0B', false, false
   WHERE NOT EXISTS (SELECT 1 FROM koto_pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Send Proposal');

  INSERT INTO koto_pipeline_stages (pipeline_id, name, sort_order, color, is_won, is_lost)
  SELECT v_pipeline_id, 'Closed Won', 6, '#10B981', true, false
   WHERE NOT EXISTS (SELECT 1 FROM koto_pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Closed Won');

  INSERT INTO koto_pipeline_stages (pipeline_id, name, sort_order, color, is_won, is_lost)
  SELECT v_pipeline_id, 'Closed Lost', 7, '#EF4444', false, true
   WHERE NOT EXISTS (SELECT 1 FROM koto_pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Closed Lost');

  -- Ensure sort_order is correct even if stages already existed with wrong order
  UPDATE koto_pipeline_stages SET sort_order = 1 WHERE pipeline_id = v_pipeline_id AND name = 'New Lead';
  UPDATE koto_pipeline_stages SET sort_order = 2 WHERE pipeline_id = v_pipeline_id AND name = 'Appt Scheduled';
  UPDATE koto_pipeline_stages SET sort_order = 3 WHERE pipeline_id = v_pipeline_id AND name = 'Call Back';
  UPDATE koto_pipeline_stages SET sort_order = 4 WHERE pipeline_id = v_pipeline_id AND name = 'No Show';
  UPDATE koto_pipeline_stages SET sort_order = 5 WHERE pipeline_id = v_pipeline_id AND name = 'Send Proposal';
  UPDATE koto_pipeline_stages SET sort_order = 6 WHERE pipeline_id = v_pipeline_id AND name = 'Closed Won';
  UPDATE koto_pipeline_stages SET sort_order = 7 WHERE pipeline_id = v_pipeline_id AND name = 'Closed Lost';

  -- 4. load stage ids for remap
  SELECT id INTO v_stage_new      FROM koto_pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'New Lead';
  SELECT id INTO v_stage_appt     FROM koto_pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Appt Scheduled';
  SELECT id INTO v_stage_callback FROM koto_pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Call Back';
  SELECT id INTO v_stage_noshow   FROM koto_pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'No Show';
  SELECT id INTO v_stage_proposal FROM koto_pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Send Proposal';
  SELECT id INTO v_stage_won      FROM koto_pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Closed Won';
  SELECT id INTO v_stage_lost     FROM koto_pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Closed Lost';

  -- 5. re-map any Momenta opportunities whose stage_id points at the legacy
  --    Sales Pipeline stages (from the generic backfill) — collapse into new stages.
  UPDATE koto_opportunities o
     SET pipeline_id = v_pipeline_id,
         stage_id    = CASE
           WHEN o.stage IN ('new','engaged')       THEN v_stage_new
           WHEN o.stage = 'qualified'              THEN v_stage_appt
           WHEN o.stage = 'proposal'               THEN v_stage_proposal
           WHEN o.stage = 'won'                    THEN v_stage_won
           WHEN o.stage IN ('lost','archived')     THEN v_stage_lost
           ELSE v_stage_new
         END
   WHERE o.agency_id = v_agency_id;

  RAISE NOTICE 'Momenta pipeline seeded. pipeline_id = %', v_pipeline_id;
END $$;
