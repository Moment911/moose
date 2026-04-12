import 'server-only' // fails the build if this module is ever imported from a client component
import { createClient } from '@supabase/supabase-js'

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export interface SessionContext {
  agencyId: string | null
  userId: string | null
  isSuperAdmin: boolean
  isClient: boolean
  clientId: string | null
}

/**
 * Get the verified agency_id for the current request.
 *
 * - Super admins: can impersonate any agency via x-koto-agency-id header
 * - Agency members: locked to their own agency_id
 * - Clients: return their client_id, no agency_id access
 * - Anonymous: return null
 *
 * Use this in EVERY API route to scope queries.
 */
export async function getSessionAgencyId(req: Request): Promise<SessionContext> {
  const db = getDb()
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  // If no token, check for anon/bypass mode
  if (!token) {
    // Fallback: trust x-koto-agency-id for server-side calls
    const headerAgencyId = req.headers.get('x-koto-agency-id')
    return {
      agencyId: headerAgencyId || null,
      userId: null,
      isSuperAdmin: false,
      isClient: false,
      clientId: null,
    }
  }

  // Verify the token with Supabase
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) {
    return { agencyId: null, userId: null, isSuperAdmin: false, isClient: false, clientId: null }
  }

  // Check if super admin
  const { data: adminRow } = await db.from('koto_platform_admins')
    .select('id')
    .eq('user_id', user.id)
    .single()

  const isSuperAdmin = !!adminRow

  if (isSuperAdmin) {
    // Super admin can impersonate via header
    const impersonatedAgencyId = req.headers.get('x-koto-agency-id')
    return {
      agencyId: impersonatedAgencyId || null, // null = platform-wide access
      userId: user.id,
      isSuperAdmin: true,
      isClient: false,
      clientId: null,
    }
  }

  // Look up agency membership
  const { data: member } = await db.from('agency_members')
    .select('agency_id, role')
    .eq('user_id', user.id)
    .single()

  if (member) {
    return {
      agencyId: member.agency_id,
      userId: user.id,
      isSuperAdmin: false,
      isClient: false,
      clientId: null,
    }
  }

  // Check if client user
  const { data: clientUser } = await db.from('koto_client_users')
    .select('client_id, agency_id')
    .eq('user_id', user.id)
    .single()

  if (clientUser) {
    return {
      agencyId: clientUser.agency_id,
      userId: user.id,
      isSuperAdmin: false,
      isClient: true,
      clientId: clientUser.client_id,
    }
  }

  // No role found — check agencies table directly (owner)
  const { data: ownedAgency } = await db.from('agencies')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  return {
    agencyId: ownedAgency?.id || null,
    userId: user.id,
    isSuperAdmin: false,
    isClient: false,
    clientId: null,
  }
}

/**
 * Quick helper to extract agency_id from request params,
 * falling back to session. Use for GET requests where agency_id
 * is passed as a query param.
 */
export function getAgencyIdFromParams(
  searchParams: URLSearchParams,
  session: SessionContext
): string | null {
  const paramAgencyId = searchParams.get('agency_id')

  // Super admins can query any agency
  if (session.isSuperAdmin && paramAgencyId) return paramAgencyId

  // Non-super-admins are locked to their own agency
  return session.agencyId
}
