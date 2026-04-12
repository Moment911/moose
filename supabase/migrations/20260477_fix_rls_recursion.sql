-- Fix infinite recursion in RLS policies.
--
-- The original policies referenced agency_members from within
-- agency_members policies, causing PostgreSQL to recurse infinitely.
-- Fix: SECURITY DEFINER functions that bypass RLS to look up the
-- current user's agency memberships and admin status.

-- Helper functions (bypass RLS)
CREATE OR REPLACE FUNCTION public.get_my_agency_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.koto_platform_admins WHERE user_id = auth.uid()) $$;

-- Drop ALL old self-referencing policies
DROP POLICY IF EXISTS "members_see_agency_members" ON public.agency_members;
DROP POLICY IF EXISTS "agency_members_own" ON public.agency_members;
DROP POLICY IF EXISTS "agency_members_same_agency" ON public.agency_members;
DROP POLICY IF EXISTS "agency_members_select" ON public.agency_members;
DROP POLICY IF EXISTS "admins_update_agency" ON public.agencies;
DROP POLICY IF EXISTS "members_see_own_agency" ON public.agencies;
DROP POLICY IF EXISTS "agencies_select" ON public.agencies;
DROP POLICY IF EXISTS "Admins manage their clients" ON public.clients;
DROP POLICY IF EXISTS "clients_public_onboard_read" ON public.clients;
DROP POLICY IF EXISTS "clients_scoped_to_agency" ON public.clients;
DROP POLICY IF EXISTS "clients_agency_scope" ON public.clients;
DROP POLICY IF EXISTS "agency_features_read" ON public.agency_features;
DROP POLICY IF EXISTS "client_perms_agency_scope" ON public.koto_client_permissions;

-- Clean policies using helper functions (no recursion)
-- agency_members: see your own record + platform admins see all
DROP POLICY IF EXISTS "agency_members_read" ON public.agency_members;
DROP POLICY IF EXISTS "agency_members_manage" ON public.agency_members;
CREATE POLICY "agency_members_read" ON public.agency_members FOR SELECT
  USING (user_id = auth.uid() OR is_platform_admin());
CREATE POLICY "agency_members_manage" ON public.agency_members FOR ALL
  USING (user_id = auth.uid() OR is_platform_admin());

-- agencies: all can read, members + admins can manage
DROP POLICY IF EXISTS "agencies_read" ON public.agencies;
DROP POLICY IF EXISTS "agencies_manage" ON public.agencies;
CREATE POLICY "agencies_read" ON public.agencies FOR SELECT USING (true);
CREATE POLICY "agencies_manage" ON public.agencies FOR ALL
  USING (id IN (SELECT get_my_agency_ids()) OR is_platform_admin());

-- clients: scoped to agency via helper function
DROP POLICY IF EXISTS "clients_scope" ON public.clients;
CREATE POLICY "clients_scope" ON public.clients FOR ALL
  USING (agency_id IN (SELECT get_my_agency_ids()) OR is_platform_admin());

-- agency_features: read scoped to agency
DROP POLICY IF EXISTS "agency_features_scope" ON public.agency_features;
CREATE POLICY "agency_features_scope" ON public.agency_features FOR SELECT
  USING (agency_id IN (SELECT get_my_agency_ids()) OR is_platform_admin());

-- koto_client_permissions: scoped to agency
DROP POLICY IF EXISTS "client_perms_scope" ON public.koto_client_permissions;
CREATE POLICY "client_perms_scope" ON public.koto_client_permissions FOR ALL
  USING (agency_id IN (SELECT get_my_agency_ids()) OR is_platform_admin());
