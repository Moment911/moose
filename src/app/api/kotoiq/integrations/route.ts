import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '../../../../lib/apiAuth'
import { getKotoIQDb } from '../../../../lib/kotoiqDb'
import {
  encryptSecret,
  decryptSecret,
  testConnection,
  VaultError,
  type IntegrationKind,
} from '../../../../lib/kotoiq/profileIntegrationsVault'

// Phase 8 / Plan 03 — agency-settings Integrations tab backing API (D-02, D-32).
// Auth: verifySession FIRST. agencyId from session NEVER from body.
// Cross-agency id -> 404 (link-enumeration mitigation, Phase 7 standard).

export const runtime = 'nodejs'
export const maxDuration = 30

const ALLOWED_ACTIONS = [
  'list_agency_integrations',
  'save_agency_integration',
  'test_agency_integration',
  'delete_agency_integration',
  'get_agency_integration',
] as const
type ActionKey = typeof ALLOWED_ACTIONS[number]

const ALLOWED_KINDS: readonly IntegrationKind[] = [
  'typeform', 'jotform', 'google_forms', 'gbp_places_api',
  // gbp_agency_oauth + gbp_client_oauth are managed by Plan 06 oauth_gbp/* routes, not this one.
]

function json(status: number, body: any) {
  return NextResponse.json(body, { status })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const session = await verifySession(req, body)
  if (!session.verified || !session.agencyId) return json(401, { error: 'unauthenticated' })

  const action = String(body?.action ?? '') as ActionKey
  if (!ALLOWED_ACTIONS.includes(action)) return json(400, { error: 'unknown_action' })

  const agencyId = session.agencyId
  const userId = session.userId!
  const db = getKotoIQDb(agencyId)

  try {
    switch (action) {
      case 'list_agency_integrations': {
        const rawResult = await db.agencyIntegrations.list() as any
        const rows = rawResult?.data !== undefined ? rawResult.data : rawResult
        // Never return encrypted_payload to client — ship only non-secret metadata.
        const integrations = (rows ?? []).map((r: any) => ({
          id: r.id,
          integration_kind: r.integration_kind,
          scope_client_id: r.scope_client_id,
          label: r.label,
          last_tested_at: r.last_tested_at,
          last_tested_ok: r.last_tested_ok,
          last_test_error: r.last_test_error,
          created_at: r.created_at,
          updated_at: r.updated_at,
        }))
        return json(200, { integrations })
      }

      case 'save_agency_integration': {
        const kind = String(body?.kind ?? '') as IntegrationKind
        if (!ALLOWED_KINDS.includes(kind)) return json(400, { error: 'unsupported_kind', kind })
        const plaintext = String(body?.plaintext ?? '')
        if (!plaintext || plaintext.length > 10_000) return json(400, { error: 'bad_plaintext' })
        const label = body?.label ? String(body.label).slice(0, 120) : null
        const scopeClientId = body?.scope_client_id ? String(body.scope_client_id) : null

        const encrypted_payload = encryptSecret(plaintext, agencyId)
        // IMPORTANT: never console.log(plaintext) anywhere in this route; also redact known patterns.
        const result = await db.agencyIntegrations.upsert({
          integration_kind: kind,
          scope_client_id: scopeClientId,
          encrypted_payload,
          payload_version: 1,
          label,
          created_by: userId,
        })
        const data = (result as any)?.data
        return json(200, { ok: true, id: data?.[0]?.id ?? data?.id ?? null })
      }

      case 'test_agency_integration': {
        const id = String(body?.id ?? '')
        const result = await db.agencyIntegrations.get(id) as any
        const row = result?.data !== undefined ? result.data : result
        // Cross-agency 404 (not 403) — if the row doesn't belong to this agency,
        // db.agencyIntegrations auto-scopes to agencyId, so a non-match returns null.
        if (!row) return json(404, { error: 'not_found' })
        let plaintext: string
        try {
          plaintext = decryptSecret(row.encrypted_payload, agencyId)
        } catch (err: any) {
          await db.agencyIntegrations.markTested(id, false, 'decrypt_failed')
          return json(500, { error: 'decrypt_failed' })
        }
        const testResult = await testConnection(row.integration_kind, plaintext)
        await db.agencyIntegrations.markTested(id, testResult.ok, testResult.error ?? null)
        return json(200, testResult)
      }

      case 'delete_agency_integration': {
        const id = String(body?.id ?? '')
        const result = await db.agencyIntegrations.get(id) as any
        const row = result?.data !== undefined ? result.data : result
        if (!row) return json(404, { error: 'not_found' })
        await db.agencyIntegrations.delete(id)
        return json(200, { ok: true })
      }

      case 'get_agency_integration': {
        const id = String(body?.id ?? '')
        const result = await db.agencyIntegrations.get(id) as any
        const row = result?.data !== undefined ? result.data : result
        if (!row) return json(404, { error: 'not_found' })
        // Return ONLY the non-secret fields; plaintext never exits this function via this action.
        return json(200, {
          id: row.id,
          integration_kind: row.integration_kind,
          scope_client_id: row.scope_client_id,
          label: row.label,
          last_tested_at: row.last_tested_at,
          last_tested_ok: row.last_tested_ok,
          last_test_error: row.last_test_error,
        })
      }
    }
  } catch (err: any) {
    // Structured log — never leak plaintext
    console.error('[integrations route] error', { action, agency: agencyId, error: err?.message })
    return json(500, { error: 'internal_error' })
  }
}
