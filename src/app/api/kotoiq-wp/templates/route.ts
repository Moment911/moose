import { NextRequest, NextResponse } from 'next/server'

import { verifySession } from '../../../../lib/apiAuth'
import { getKotoIQDb } from '../../../../lib/kotoiqDb'
import {
    captureTemplate,
    pushTemplate,
    pushTemplateBatch,
    diffPushes,
} from '../../../../lib/wp-shim/templates'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 09 Task 2 — /api/kotoiq-wp/templates
//
// JSON dispatcher for the Option B page-design model (capture + push). Mirrors
// the Phase 7 Plan 6 canonical shape:
//   - verifySession FIRST → 401 on !verified || !agencyId
//   - body.action must be in ALLOWED_ACTIONS → 400 unknown_action otherwise
//   - agencyId is read from session, NEVER from body
//   - Every Supabase write inside the handlers filters by .eq('agency_id', ...)
//
// Actions:
//   list           — list non-archived templates for the agency
//   get            — load a single template row
//   capture        — capture a new template from a sandbox site's Elementor page
//   push           — push one template to one target site with one variable set
//   push_batch     — push one template to one target site with N variable sets
//   diff           — preview the last two pushes for a (template, site) pair
//   archive        — soft-delete a template (sets archived_at)
//   list_history   — list push_history rows for a template (audit + replay)
//
// Auth fail mode: returns 401 with { error: 'unauthorized' }. Mismatched
// agency on a known-id read is silently returned as a NOT-FOUND-equivalent
// (per Phase 7 Plan 6 T-07 link-enumeration mitigation — never 403).
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 60

const ALLOWED_ACTIONS = [
    'list',
    'get',
    'capture',
    'push',
    'push_batch',
    'diff',
    'archive',
    'list_history',
] as const

function err(status: number, error: string, extra?: Record<string, unknown>): NextResponse {
    return NextResponse.json({ error, ...(extra || {}) }, { status })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    // 1. Auth gate.
    const session = await verifySession(req)
    if (!session.verified || !session.agencyId) {
        return err(401, 'unauthorized')
    }
    const agencyId = session.agencyId
    const userId = session.userId || null

    // 2. Body parse.
    let body: Record<string, unknown>
    try {
        body = (await req.json()) as Record<string, unknown>
    } catch {
        return err(400, 'invalid_json')
    }

    const action = String(body?.action || '')
    if (!(ALLOWED_ACTIONS as readonly string[]).includes(action)) {
        return err(400, 'unknown_action', { allowed_actions: ALLOWED_ACTIONS })
    }

    // 3. Supabase client (service-role; queries below MUST filter on agency_id).
    const db = getKotoIQDb(agencyId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = db.client

    try {
        switch (action) {
            case 'list': {
                const res = await sb
                    .from('koto_wp_templates')
                    .select(
                        'id, source_site_id, source_post_id, name, description, variable_schema, captured_at, archived_at, updated_at',
                    )
                    .eq('agency_id', agencyId)
                    .is('archived_at', null)
                    .order('captured_at', { ascending: false })
                if (res.error) return err(500, 'list_failed', { detail: res.error.message })
                return NextResponse.json({ templates: res.data ?? [] })
            }

            case 'get': {
                const templateId = String(body.template_id || '')
                if (!templateId) return err(400, 'template_id required')
                const res = await sb
                    .from('koto_wp_templates')
                    .select('*')
                    .eq('id', templateId)
                    .eq('agency_id', agencyId)
                    .maybeSingle()
                if (res.error) return err(500, 'get_failed', { detail: res.error.message })
                if (!res.data) return err(404, 'template_not_found')
                return NextResponse.json({ template: res.data })
            }

            case 'capture': {
                const sourceSiteId = String(body.source_site_id || '')
                const sourcePostId = Number(body.source_post_id)
                const name = String(body.name || '').trim()
                if (!sourceSiteId) return err(400, 'source_site_id required')
                if (!Number.isInteger(sourcePostId) || sourcePostId < 1) {
                    return err(400, 'source_post_id must be a positive integer')
                }
                if (!name) return err(400, 'name required')
                const opts = (body.opts || {}) as {
                    useLLM?: boolean
                    description?: string
                    variableHints?: Record<string, string>
                }
                const result = await captureTemplate(
                    sb,
                    agencyId,
                    sourceSiteId,
                    sourcePostId,
                    name,
                    {
                        ...opts,
                        capturedBy: userId || undefined,
                    },
                )
                if (!result.ok) {
                    const code = result.error?.code || 'capture_failed'
                    return NextResponse.json({ ok: false, error: result.error }, {
                        status: code === 'site_not_found' ? 404 : 400,
                    })
                }
                return NextResponse.json({ ok: true, template: result.row })
            }

            case 'push': {
                const templateId = String(body.template_id || '')
                const targetSiteId = String(body.target_site_id || '')
                const variableValues = (body.variable_values || {}) as Record<
                    string,
                    string | string[]
                >
                if (!templateId) return err(400, 'template_id required')
                if (!targetSiteId) return err(400, 'target_site_id required')
                const opts = (body.opts || {}) as {
                    status?: 'draft' | 'publish' | 'private'
                    titleField?: string
                    rotationCacheDuration?: string
                }
                const result = await pushTemplate(
                    sb,
                    agencyId,
                    templateId,
                    targetSiteId,
                    variableValues,
                    { ...opts, pushedBy: userId || undefined },
                )
                return NextResponse.json(result, { status: result.ok ? 200 : 400 })
            }

            case 'push_batch': {
                const templateId = String(body.template_id || '')
                const targetSiteId = String(body.target_site_id || '')
                const rows = body.rows
                if (!templateId) return err(400, 'template_id required')
                if (!targetSiteId) return err(400, 'target_site_id required')
                if (!Array.isArray(rows)) return err(400, 'rows must be an array')
                const opts = (body.opts || {}) as {
                    status?: 'draft' | 'publish' | 'private'
                    rotationCacheDuration?: string
                }
                try {
                    const result = await pushTemplateBatch(
                        sb,
                        agencyId,
                        templateId,
                        targetSiteId,
                        rows as Array<Record<string, string | string[]>>,
                        { ...opts, pushedBy: userId || undefined },
                    )
                    return NextResponse.json(result)
                } catch (e) {
                    return err(400, 'push_batch_invalid', { detail: (e as Error).message })
                }
            }

            case 'diff': {
                const templateId = String(body.template_id || '')
                const targetSiteId = String(body.target_site_id || '')
                if (!templateId) return err(400, 'template_id required')
                if (!targetSiteId) return err(400, 'target_site_id required')
                const result = await diffPushes(sb, agencyId, templateId, targetSiteId)
                return NextResponse.json({ diff: result })
            }

            case 'archive': {
                const templateId = String(body.template_id || '')
                if (!templateId) return err(400, 'template_id required')
                const upd = await sb
                    .from('koto_wp_templates')
                    .update({ archived_at: new Date().toISOString() })
                    .eq('id', templateId)
                    .eq('agency_id', agencyId)
                if (upd.error) return err(500, 'archive_failed', { detail: upd.error.message })
                return NextResponse.json({ ok: true })
            }

            case 'list_history': {
                const templateId = String(body.template_id || '')
                if (!templateId) return err(400, 'template_id required')
                const limit = Math.min(Number(body.limit) || 50, 200)
                const res = await sb
                    .from('koto_wp_push_history')
                    .select(
                        'id, target_site_id, pushed_post_id, pushed_post_url, status, error_code, error_message, idempotency_key, pushed_at, created_at',
                    )
                    .eq('agency_id', agencyId)
                    .eq('template_id', templateId)
                    .order('created_at', { ascending: false })
                    .limit(limit)
                if (res.error)
                    return err(500, 'list_history_failed', { detail: res.error.message })
                return NextResponse.json({ history: res.data ?? [] })
            }
        }
        return err(400, 'unknown_action')
    } catch (e) {
        return err(500, 'server_error', { detail: (e as Error).message })
    }
}
