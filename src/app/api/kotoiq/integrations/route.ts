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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 / Plan 3 — POST /api/kotoiq/integrations
//
// 5-action JSON dispatcher for the agency-settings Integrations tab (D-02,
// D-32). Backs the agency-owner UI that saves / tests / deletes Typeform /
// Jotform / Google Forms / Places API credentials. Plan 04-07 pullers call
// `db.agencyIntegrations.getByKind(...)` + `decryptSecret` to read the same
// rows server-side; no plaintext ever leaves Node memory via this route.
//
// Auth: verifySession FIRST. agencyId comes from the session, NEVER from
// body (T-08-22 cross-agency-spoof mitigation; Phase 7 canonical pattern).
//
// Cross-agency id → 404 (NOT 403) — link-enumeration mitigation, Phase 7
// T-07 standard. `db.agencyIntegrations.get(id)` auto-scopes to agencyId via
// DIRECT_AGENCY_TABLES, so a non-match returns null and this route responds
// 404 uniformly, revealing nothing about whether the id exists under another
// agency.
//
// Deferred-migration tolerance: Plan 01's `20260520_kotoiq_agency_integrations.sql`
// push is deferred (see deferred-items.md). Every db.agencyIntegrations.*
// call is wrapped in try/catch and downgrades to a sentinel 503 response
// (error: 'integrations_table_missing') until the operator pushes the
// migration. This matches the Phase 7 `kotoiq_pipeline_runs` precedent.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 30

const ALLOWED_ACTIONS = [
  'list_agency_integrations',
  'save_agency_integration',
  'test_agency_integration',
  'delete_agency_integration',
  'get_agency_integration',
] as const
type ActionKey = (typeof ALLOWED_ACTIONS)[number]

const ALLOWED_KINDS: readonly IntegrationKind[] = [
  'typeform',
  'jotform',
  'google_forms',
  'gbp_places_api',
  // gbp_agency_oauth + gbp_client_oauth are managed by Plan 06 oauth_gbp/*
  // routes, not this one.
]

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status })
}

// Recognise the two Supabase/Postgrest shapes that indicate "table not found".
function isTableMissingError(err: unknown): boolean {
  if (!err) return false
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message || '')
        : String(err)
  // Postgrest: "relation \"public.koto_agency_integrations\" does not exist"
  // + the generic "table not found" wording we see across env variants.
  return (
    /koto_agency_integrations/i.test(msg) &&
    /(does not exist|not found|relation)/i.test(msg)
  )
}

// Never let err.message spill plaintext into a response or log; this is the
// single choke-point for every caught error.
function handleHelperError(err: unknown, action: string, agencyId: string) {
  if (isTableMissingError(err)) {
    console.error('[integrations route] table_missing', { action, agency: agencyId })
    return json(503, { error: 'integrations_table_missing' })
  }
  console.error('[integrations route] error', {
    action,
    agency: agencyId,
    error: err instanceof Error ? err.message : 'unknown',
  })
  return json(500, { error: 'internal_error' })
}

export async function POST(req: NextRequest) {
  // 1. Parse body (verifySession also inspects body.agency_id path — we
  //    pass it but the route itself ignores body.agency_id below).
  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    // fall through — empty body is fine; action validation catches it
  }

  // 2. Auth
  const session = await verifySession(req, body)
  if (!session.verified || !session.agencyId) {
    return json(401, { error: 'unauthenticated' })
  }

  // 3. Action validation
  const actionRaw = String(body?.action ?? '')
  if (!(ALLOWED_ACTIONS as readonly string[]).includes(actionRaw)) {
    return json(400, { error: 'unknown_action', allowed_actions: ALLOWED_ACTIONS })
  }
  const action = actionRaw as ActionKey

  const agencyId = session.agencyId
  const userId = session.userId || 'operator'
  const db = getKotoIQDb(agencyId)

  try {
    switch (action) {
      case 'list_agency_integrations': {
        const res = await db.agencyIntegrations.list()
        // Helpers can return either a plain array or a PostgrestResponse —
        // unwrap both defensively.
        const rows = Array.isArray(res)
          ? res
          : ((res as { data?: unknown[] })?.data ?? [])
        const integrations = (rows as Array<Record<string, unknown>>).map((r) => ({
          id: r.id,
          integration_kind: r.integration_kind,
          scope_client_id: r.scope_client_id ?? null,
          label: r.label ?? null,
          last_tested_at: r.last_tested_at ?? null,
          last_tested_ok: r.last_tested_ok ?? null,
          last_test_error: r.last_test_error ?? null,
          created_at: r.created_at ?? null,
          updated_at: r.updated_at ?? null,
        }))
        return json(200, { integrations })
      }

      case 'save_agency_integration': {
        const kind = String(body?.kind ?? '') as IntegrationKind
        if (!ALLOWED_KINDS.includes(kind)) {
          return json(400, { error: 'unsupported_kind', kind })
        }
        const plaintext = typeof body?.plaintext === 'string' ? body.plaintext : ''
        if (!plaintext || plaintext.length > 10_000) {
          return json(400, { error: 'bad_plaintext' })
        }
        const label =
          typeof body?.label === 'string' ? body.label.slice(0, 120) : null
        const scopeClientId =
          typeof body?.scope_client_id === 'string' ? body.scope_client_id : null

        const encrypted_payload = encryptSecret(plaintext, agencyId)
        // IMPORTANT: pass ONLY the sealed payload to the helper. NEVER pass
        // plaintext anywhere downstream; NEVER console.log plaintext.
        const res = (await db.agencyIntegrations.upsert({
          integration_kind: kind,
          scope_client_id: scopeClientId,
          encrypted_payload,
          payload_version: 1,
          label,
          created_by: userId,
        })) as { data?: { id?: string } | Array<{ id?: string }> } | Array<{ id?: string }> | null

        // Helper may return array (from .select()) or single row (from .single()).
        let newId: string | null = null
        if (Array.isArray(res)) {
          newId = (res[0]?.id as string | undefined) ?? null
        } else if (res && 'data' in res) {
          const d = res.data
          if (Array.isArray(d)) newId = (d[0]?.id as string | undefined) ?? null
          else newId = (d?.id as string | undefined) ?? null
        }
        return json(200, { ok: true, id: newId })
      }

      case 'test_agency_integration': {
        const id = String(body?.id ?? '')
        if (!id) return json(400, { error: 'missing_id' })
        const rowRes = await db.agencyIntegrations.get(id)
        const row =
          rowRes && typeof rowRes === 'object' && 'data' in rowRes
            ? (rowRes as { data?: Record<string, unknown> | null }).data
            : (rowRes as Record<string, unknown> | null)
        if (!row) return json(404, { error: 'not_found' })

        let plaintext: string
        try {
          plaintext = decryptSecret(
            row.encrypted_payload as Parameters<typeof decryptSecret>[0],
            agencyId,
          )
        } catch (err) {
          const code = err instanceof VaultError ? err.code : 'decrypt_failed'
          try {
            await db.agencyIntegrations.markTested(id, false, code)
          } catch {
            /* best-effort */
          }
          return json(500, { error: 'decrypt_failed' })
        }
        const result = await testConnection(
          row.integration_kind as IntegrationKind,
          plaintext,
        )
        try {
          await db.agencyIntegrations.markTested(id, result.ok, result.error ?? null)
        } catch (err) {
          // Non-fatal — client still gets the probe result. Log for ops.
          if (!isTableMissingError(err)) {
            console.error('[integrations route] markTested failed', {
              agency: agencyId,
              error: err instanceof Error ? err.message : 'unknown',
            })
          }
        }
        return json(200, result)
      }

      case 'delete_agency_integration': {
        const id = String(body?.id ?? '')
        if (!id) return json(400, { error: 'missing_id' })
        const rowRes = await db.agencyIntegrations.get(id)
        const row =
          rowRes && typeof rowRes === 'object' && 'data' in rowRes
            ? (rowRes as { data?: Record<string, unknown> | null }).data
            : (rowRes as Record<string, unknown> | null)
        if (!row) return json(404, { error: 'not_found' })
        await db.agencyIntegrations.delete(id)
        return json(200, { ok: true })
      }

      case 'get_agency_integration': {
        const id = String(body?.id ?? '')
        if (!id) return json(400, { error: 'missing_id' })
        const rowRes = await db.agencyIntegrations.get(id)
        const row =
          rowRes && typeof rowRes === 'object' && 'data' in rowRes
            ? (rowRes as { data?: Record<string, unknown> | null }).data
            : (rowRes as Record<string, unknown> | null)
        if (!row) return json(404, { error: 'not_found' })
        // Return ONLY non-secret fields — encrypted_payload NEVER leaves
        // server memory via this endpoint (T-08-21).
        return json(200, {
          id: row.id,
          integration_kind: row.integration_kind,
          scope_client_id: row.scope_client_id ?? null,
          label: row.label ?? null,
          last_tested_at: row.last_tested_at ?? null,
          last_tested_ok: row.last_tested_ok ?? null,
          last_test_error: row.last_test_error ?? null,
        })
      }
    }
  } catch (err) {
    return handleHelperError(err, action, agencyId)
  }
  // Unreachable — switch above is exhaustive on ActionKey — belt-and-braces
  // fallback so TypeScript is satisfied.
  return json(500, { error: 'internal_error' })
}
