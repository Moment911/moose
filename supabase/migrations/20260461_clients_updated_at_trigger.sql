-- ============================================================
-- Clients updated_at trigger
--
-- 20260459_clients_updated_at.sql added the `updated_at` column with
-- DEFAULT now(), but defaults only apply on INSERT. Without a
-- BEFORE UPDATE trigger, `updated_at` never advances on UPDATE unless
-- every caller remembers to set it explicitly — which is exactly the
-- kind of bug we had with the silent autosave failures.
--
-- This migration adds the trigger so every UPDATE automatically bumps
-- `updated_at` to `now()`, and callers can stop setting it by hand.
-- Idempotent — safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at_on_clients()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clients_set_updated_at ON clients;
CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_on_clients();
