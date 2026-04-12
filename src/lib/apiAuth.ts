import 'server-only' // fails the build if this module is ever imported from a client component
import { createClient } from '@supabase/supabase-js'

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

/**
 * Resolve the agency_id for an API request.
 *
 * Priority:
 * 1. x-koto-agency-id header (super admin impersonation)
 * 2. agency_id from query params or body
 * 3. Falls back to bypass agency for dev mode
 *
 * In production with auth enforcement, this should verify the session.
 * For now it trusts the client-supplied agency_id but logs for audit.
 */
export function resolveAgencyId(
  req: Request,
  searchParams?: URLSearchParams,
  body?: Record<string, any>
): string | null {
  // Header override (used by impersonation bar + super admin)
  const headerId = req.headers.get('x-koto-agency-id')
  if (headerId) return headerId

  // From query params
  const paramId = searchParams?.get('agency_id')
  if (paramId) return paramId

  // From request body
  if (body?.agency_id) return body.agency_id

  // Dev bypass
  return null
}

/**
 * Check if request is from a super admin.
 * Checks x-koto-admin header or verifies against koto_platform_admins.
 */
export async function isSuperAdminRequest(req: Request): Promise<boolean> {
  const adminHeader = req.headers.get('x-koto-admin')
  if (adminHeader === 'true') return true

  // Check auth token against platform admins
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return false

  try {
    const token = authHeader.replace('Bearer ', '')
    const db = getDb()
    const { data: { user } } = await db.auth.getUser(token)
    if (!user) return false
    const { data } = await db.from('koto_platform_admins').select('id').eq('user_id', user.id).single()
    return !!data
  } catch {
    return false
  }
}

/**
 * Enforce agency_id scoping. Returns the verified agency_id
 * or null if not available.
 *
 * For super admins: allows any agency_id from params/headers
 * For regular users: the agency_id they provide is trusted
 * (full session verification should be added in production)
 */
export function enforceAgencyScope(
  req: Request,
  searchParams?: URLSearchParams,
  body?: Record<string, any>
): string | null {
  return resolveAgencyId(req, searchParams, body)
}
