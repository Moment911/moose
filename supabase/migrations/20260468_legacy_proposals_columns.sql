-- ─────────────────────────────────────────────────────────────
-- Legacy proposals table schema alignment
--
-- The original proposals table was created with text fields named
-- intro_text, terms_text, total_amount, but the legacy builder
-- code in src/views/ProposalBuilderPage.jsx + ProposalsPage.jsx
-- writes/reads intro, terms, total_value, plus type, executive_summary,
-- sent_at, viewed_at, accepted_at, and orders by updated_at. None
-- of those columns existed, which caused /proposals to throw a 400:
--
--   column proposals.updated_at does not exist
--   (reproduced via GET /rest/v1/proposals?order=updated_at.desc)
--
-- The table was empty (0 rows) at the time of this migration, so
-- we just add the missing columns with IF NOT EXISTS and wire a
-- BEFORE UPDATE trigger to keep updated_at current.
--
-- NOTE: this is the LEGACY module-driven proposals system (sections
-- in a separate proposal_sections table). The newer AI-generated
-- builder lives in koto_proposals and is unaffected.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS type text DEFAULT 'proposal';
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS intro text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS executive_summary text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS terms text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS total_value numeric;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS viewed_at timestamptz;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- Auto-bump updated_at on every UPDATE so the ProposalsPage
-- .order('updated_at', { ascending: false }) query surfaces the
-- most recently edited proposal first.
CREATE OR REPLACE FUNCTION proposals_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proposals_set_updated_at ON proposals;
CREATE TRIGGER proposals_set_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION proposals_touch_updated_at();

-- Backfill existing rows (no-op at the time this was written —
-- the table had 0 rows — but harmless for future re-runs).
UPDATE proposals SET updated_at = created_at WHERE updated_at IS NULL;
