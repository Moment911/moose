-- ═══════════════════════════════════════════════════════════════════════
-- KOTO MULTI-TENANT RLS POLICIES
-- Run in Supabase SQL Editor AFTER creating agencies table
-- These ensure agency A cannot see agency B's data
-- ═══════════════════════════════════════════════════════════════════════

-- Helper function: get the current user's agency_id
CREATE OR REPLACE FUNCTION get_my_agency_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT agency_id FROM agency_members
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- Helper: is the current user a Koto super admin?
CREATE OR REPLACE FUNCTION is_koto_admin()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM agency_members am
    JOIN agencies ag ON ag.id = am.agency_id
    WHERE am.user_id = auth.uid()
    AND ag.id = '00000000-0000-0000-0000-000000000099'
  )
$$;

-- ── CLIENTS ──────────────────────────────────────────────────────────────────
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agency_clients_isolation" ON clients;
CREATE POLICY "agency_clients_isolation" ON clients
  FOR ALL USING (
    agency_id = get_my_agency_id()
    OR is_koto_admin()
  );

-- ── AGENCIES ─────────────────────────────────────────────────────────────────
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agencies_self_access" ON agencies;
CREATE POLICY "agencies_self_access" ON agencies
  FOR ALL USING (
    id = get_my_agency_id()
    OR is_koto_admin()
  );

-- ── AGENCY MEMBERS ────────────────────────────────────────────────────────────
ALTER TABLE agency_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agency_members_isolation" ON agency_members;
CREATE POLICY "agency_members_isolation" ON agency_members
  FOR ALL USING (
    agency_id = get_my_agency_id()
    OR is_koto_admin()
  );

-- ── PROJECTS ─────────────────────────────────────────────────────────────────
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projects_isolation" ON projects;
CREATE POLICY "projects_isolation" ON projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = projects.client_id
      AND (c.agency_id = get_my_agency_id() OR is_koto_admin())
    )
  );

-- ── REVIEWS ──────────────────────────────────────────────────────────────────
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reviews_isolation" ON reviews;
CREATE POLICY "reviews_isolation" ON reviews
  FOR ALL USING (
    agency_id = get_my_agency_id()
    OR is_koto_admin()
  );

-- ── DESK TICKETS ─────────────────────────────────────────────────────────────
ALTER TABLE desk_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tickets_isolation" ON desk_tickets;
CREATE POLICY "tickets_isolation" ON desk_tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = desk_tickets.client_id
      AND (c.agency_id = get_my_agency_id() OR is_koto_admin())
    )
  );

-- ── SEO CONNECTIONS ──────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'seo_connections') THEN
    ALTER TABLE seo_connections ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "seo_connections_isolation" ON seo_connections;
    CREATE POLICY "seo_connections_isolation" ON seo_connections
      FOR ALL USING (
        agency_id = get_my_agency_id() OR is_koto_admin()
      );
  END IF;
END $$;

-- ── LOCAL RANK SCANS ─────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'local_rank_scans') THEN
    ALTER TABLE local_rank_scans ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "rank_scans_isolation" ON local_rank_scans;
    CREATE POLICY "rank_scans_isolation" ON local_rank_scans
      FOR ALL USING (
        agency_id = get_my_agency_id() OR is_koto_admin()
      );
  END IF;
END $$;

-- ── SUBSCRIPTIONS ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'subscriptions') THEN
    ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "subscriptions_isolation" ON subscriptions;
    CREATE POLICY "subscriptions_isolation" ON subscriptions
      FOR ALL USING (
        agency_id = get_my_agency_id() OR is_koto_admin()
      );
  END IF;
END $$;

SELECT 'RLS policies applied successfully ✓' as result;
