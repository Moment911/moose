-- ── KotoProof — per-project feature toggles ─────────────────────────────
-- The public review surface has a few features that agencies want to turn
-- on/off per project:
--   * screen_recording_enabled — can reviewers record their screen while
--     annotating? Default ON for continuity with existing projects, which
--     have been recording since day one.
-- Extend this table (boolean or jsonb) as more per-project toggles show up.

alter table projects
  add column if not exists screen_recording_enabled boolean default true;

-- Backfill: existing projects default to true so nothing changes for them.
update projects
   set screen_recording_enabled = true
 where screen_recording_enabled is null;
