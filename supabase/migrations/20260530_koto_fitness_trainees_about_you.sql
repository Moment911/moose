-- ============================================================
-- Trainer — add free-text `about_you` context to trainees
--
-- Sport-specific context, goals, lifestyle, anything the trainee writes
-- to help the AI tailor the whole program.  Complements the structured
-- intake fields; does NOT replace them.  Every Sonnet prompt
-- (baseline / roadmap / workout / meals / playbook / adjust) reads this
-- field and adapts.
--
-- Distinct from trainer_notes (agency-internal) — about_you is
-- trainee-facing and drives the AI output.
-- ============================================================

ALTER TABLE public.koto_fitness_trainees
  ADD COLUMN IF NOT EXISTS about_you text;
