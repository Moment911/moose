import 'server-only'
import { createClient } from '@supabase/supabase-js'

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export interface ApiSessionContext {
  agencyId: string | null
  userId: string | null
  isSuperAdmin: boolean
  role: string | null  // 'super_admin' | 'owner' | 'admin' | 'member' | 'viewer' | 'client'
  clientId: string | null
  verified: boolean    // true if session was cryptographically verified
}

/**
 * Verify the current request's session and return the authorized agency_id.
 *
 * This is the ONLY correct way for API routes to determine agency_id.
 * It replaces the old pattern of trusting body.agency_id blindly.
 *
 * Rules:
 * - Super admins can access any agency via x-koto-agency-id header
 * - Agency members are locked to their own agency_id (ignores body.agency_id)
 * - Clients return their client's agency_id
 * - No session = no access (returns verified: false)
 *
 * If the request has no auth token but provides agency_id in body/params,
 * it's allowed with verified: false for backwards compatibility during
 * migration. API routes should check `ctx.verified` and eventually reject
 * unverified requests.
 */
export async function verifySession(req: Request, body?: Record<string, any>): Promise<ApiSessionContext> {
  const db = getDb()
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  // Dev-only bypass — mirrors NEXT_PUBLIC_BYPASS_AUTH in src/hooks/useAuth.jsx.
  // Without it, hooks return a fake user + agency but supabase.auth has no
  // real session, so client fetches can't attach a Bearer token and every
  // verifySession() route 401s. Hard-gated on NODE_ENV !== 'production'.
  const bypassAuth =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'
  if (bypassAuth) {
    const headerAgencyId = req.headers.get('x-koto-agency-id')
    const bodyAgencyId = body?.agency_id
    const searchParams = new URL(req.url).searchParams
    const paramAgencyId = searchParams.get('agency_id')
    return {
      agencyId: headerAgencyId || bodyAgencyId || paramAgencyId || '00000000-0000-0000-0000-000000000099',
      userId: '00000000-0000-0000-0000-000000000001',
      isSuperAdmin: true,
      role: 'owner',
      clientId: null,
      verified: true,
    }
  }

  // No token — unverified fallback for backwards compat
  if (!token) {
    const headerAgencyId = req.headers.get('x-koto-agency-id')
    const bodyAgencyId = body?.agency_id
    const searchParams = new URL(req.url).searchParams
    const paramAgencyId = searchParams.get('agency_id')
    return {
      agencyId: headerAgencyId || bodyAgencyId || paramAgencyId || null,
      userId: null,
      isSuperAdmin: false,
      role: null,
      clientId: null,
      verified: false,
    }
  }

  // Verify the token
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) {
    return { agencyId: null, userId: null, isSuperAdmin: false, role: null, clientId: null, verified: false }
  }

  // Check if super admin
  const { data: adminRow } = await db.from('koto_platform_admins')
    .select('id').eq('user_id', user.id).maybeSingle()
  const isSuperAdmin = !!adminRow

  if (isSuperAdmin) {
    const impersonatedAgencyId = req.headers.get('x-koto-agency-id') || body?.agency_id
    // Log impersonation for audit
    if (impersonatedAgencyId) {
      db.from('koto_audit_log').insert({
        user_id: user.id,
        action: 'impersonate',
        target_agency_id: impersonatedAgencyId,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
        user_agent: req.headers.get('user-agent')?.slice(0, 200) || null,
      }).then(() => {}) // fire-and-forget
    }
    return {
      agencyId: impersonatedAgencyId || null,
      userId: user.id,
      isSuperAdmin: true,
      role: 'super_admin',
      clientId: null,
      verified: true,
    }
  }

  // Look up agency membership — this is the source of truth
  const { data: member } = await db.from('agency_members')
    .select('agency_id, role').eq('user_id', user.id).maybeSingle()

  if (member) {
    // CRITICAL: always use the member's agency_id, NEVER trust body.agency_id
    // for non-super-admin users. This prevents cross-agency data access.
    return {
      agencyId: member.agency_id,
      userId: user.id,
      isSuperAdmin: false,
      role: member.role,
      clientId: null,
      verified: true,
    }
  }

  // Check if client user
  const { data: clientUser } = await db.from('koto_client_users')
    .select('client_id, agency_id').eq('user_id', user.id).maybeSingle()

  if (clientUser) {
    return {
      agencyId: clientUser.agency_id,
      userId: user.id,
      isSuperAdmin: false,
      role: 'client',
      clientId: clientUser.client_id,
      verified: true,
    }
  }

  // Fallback: check agencies.owner_id
  const { data: ownedAgency } = await db.from('agencies')
    .select('id').eq('owner_id', user.id).maybeSingle()

  return {
    agencyId: ownedAgency?.id || null,
    userId: user.id,
    isSuperAdmin: false,
    role: ownedAgency ? 'owner' : null,
    clientId: null,
    verified: true,
  }
}

// ── Legacy helpers (kept for backwards compat, delegates to verifySession) ──

export function resolveAgencyId(
  req: Request,
  searchParams?: URLSearchParams,
  body?: Record<string, any>
): string | null {
  const headerId = req.headers.get('x-koto-agency-id')
  if (headerId) return headerId
  const paramId = searchParams?.get('agency_id')
  if (paramId) return paramId
  if (body?.agency_id) return body.agency_id
  return null
}

export async function isSuperAdminRequest(req: Request): Promise<boolean> {
  const ctx = await verifySession(req)
  return ctx.isSuperAdmin
}

export function enforceAgencyScope(
  req: Request,
  searchParams?: URLSearchParams,
  body?: Record<string, any>
): string | null {
  return resolveAgencyId(req, searchParams, body)
}
