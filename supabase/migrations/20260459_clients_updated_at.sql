-- ============================================================
-- Add `updated_at` to the clients table
--
-- Every other Koto table (proposals, voice_calls, koto_data_vault,
-- agencies, etc.) has updated_at and the codebase already writes to
-- it from at least 5 places: the onboarding autosave handler, the
-- inline saveField on the client detail page, the GHL contact sync
-- webhook, the access checklist save, and the public client access
-- form. Without this column, every one of those UPDATEs is silently
-- rejected and the row never changes.
--
-- This migration adds the column with a sensible default and
-- backfills existing rows so they aren't NULL.
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill any existing rows that landed before the column existed.
-- Prefer created_at when available so the timestamp at least reflects
-- when the row first appeared rather than the migration timestamp.
UPDATE clients
   SET updated_at = COALESCE(created_at, now())
 WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_updated_at ON clients(updated_at DESC);
