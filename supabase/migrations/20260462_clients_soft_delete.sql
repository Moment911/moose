-- ============================================================
-- Clients soft delete
--
-- Adds deleted_at + deleted_by columns on the clients table so
-- delete paths can flip a flag instead of removing rows. Every
-- existing delete path in the codebase was either writing to a
-- non-existent `deleted_at` column (silent no-op) or doing a
-- literal DELETE FROM clients (data loss). This migration
-- unblocks soft delete; the code follow-up routes every delete
-- through the soft path.
--
-- Also adds a partial index filtering live rows so the
-- ClientsPage list query (`WHERE deleted_at IS NULL`) stays fast.
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Hot query path — "live clients for this agency"
CREATE INDEX IF NOT EXISTS idx_clients_live
  ON clients(agency_id)
  WHERE deleted_at IS NULL;
