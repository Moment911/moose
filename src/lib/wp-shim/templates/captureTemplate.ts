// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 09 Task 1 — captureTemplate.
//
// Reads an Elementor page on a paired sandbox site, extracts variables from
// its _elementor_data tree (variableExtractor), composes a seo_meta_template
// by substituting known matching strings, and persists a koto_wp_templates
// row scoped to the caller's agency_id.
//
// Agency isolation: every read on koto_wp_sites filters by .eq('agency_id',
// agencyId) — defense-in-depth atop the RLS policy on the table. The pushTemplate
// flow re-checks the same way (Plan 09 Task 2).
//
// Inputs come from the UI:
//   sourceSiteId — the koto_wp_sites uuid (must belong to the caller's agency)
//   sourcePostId — the wp/v2/pages id on that site (Elementor-edited)
//   name         — user-supplied template name
//
// Per CLAUDE.md kotoiq_models: opts.useLLM toggles Claude-assisted variable
// naming downstream in extractVariables; otherwise heuristic naming.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'

import { loadSiteCredentials } from '../credentialsVault'
import { wpFetchJson } from '../wpFetch'
import { postGetMetaBulk } from '../verbs'
import type { TemplateRow } from '../types'
import { extractVariables, type Variable } from './variableExtractor'

// ── KotoIQ-native SEO meta keys we read alongside _elementor_data ────────────
// Matches the canonical 7 in ports/seoPort.ts. Companion (Yoast/RankMath) keys
// are NOT read here — they're tracked at the SEO port level, not the template
// level. Templates carry the KotoIQ-native SEO config as their seed.
const KOTOIQ_SEO_KEYS_FOR_TEMPLATE = [
    '_kotoiq_title',
    '_kotoiq_description',
    '_kotoiq_focus_keyword',
    '_kotoiq_canonical',
    '_kotoiq_robots',
    '_kotoiq_schema_type',
    '_kotoiq_schema_custom',
] as const

export interface CaptureTemplateOpts {
    /** Enable Claude-assisted variable name suggestions. Default false. */
    useLLM?: boolean
    /** Free-form description stored on the template row. */
    description?: string
    /** Supabase auth.users.id of the operator (for audit). */
    capturedBy?: string
    /** Pre-supplied name hints keyed by original value (caller may override). */
    variableHints?: Record<string, string>
}

export interface CaptureTemplateError {
    code:
        | 'site_not_found'
        | 'missing_credentials'
        | 'post_fetch_failed'
        | 'meta_fetch_failed'
        | 'not_elementor'
        | 'parse_failed'
        | 'insert_failed'
    message: string
}

export interface TemplateCaptureResult {
    ok: boolean
    templateId?: string
    row?: TemplateRow
    error?: CaptureTemplateError
}

interface SiteRow {
    id: string
    site_url: string
    agency_id: string
}

interface WpPostShape {
    id: number
    title: { rendered: string } | string
    content: { rendered: string } | string
    slug: string
    modified: string
}

function unwrapRendered(v: { rendered: string } | string | undefined): string {
    if (!v) return ''
    if (typeof v === 'string') return v
    return v.rendered ?? ''
}

/**
 * Substitute concrete SEO meta values with `{variable}` placeholders if their
 * value matches a captured variable's original value. The dashboard composer
 * substitutes back at push time using the same map. Returns null if no SEO
 * data was found (don't persist an empty record).
 */
function composeSeoMetaTemplate(
    rawSeoValues: Record<string, unknown>,
    variables: Variable[],
): Record<string, string> | null {
    const out: Record<string, string> = {}
    let hadAny = false
    const valueToName = new Map<string, string>()
    for (const v of variables) {
        if (typeof v.value === 'string') valueToName.set(v.value, v.name)
    }
    for (const key of KOTOIQ_SEO_KEYS_FOR_TEMPLATE) {
        const raw = rawSeoValues[key]
        if (raw == null || raw === '') {
            out[key] = ''
            continue
        }
        const s = typeof raw === 'string' ? raw : String(raw)
        hadAny = true
        // If the entire string maps to a variable, use the placeholder.
        const name = valueToName.get(s)
        if (name) {
            out[key] = `{${name}}`
            continue
        }
        // Otherwise check if any variable value is contained in this string.
        let replaced = s
        for (const [val, n] of valueToName.entries()) {
            if (val.length >= 4 && replaced.includes(val)) {
                replaced = replaced.split(val).join(`{${n}}`)
            }
        }
        out[key] = replaced
    }
    return hadAny ? out : null
}

/**
 * Capture an Elementor page as a reusable template.
 *
 * 1. Validate the source site belongs to the caller's agency.
 * 2. Load WP App-Password credentials via the agency-scoped credentialsVault.
 * 3. Fetch the source page via core REST (/wp/v2/pages/{id}).
 * 4. Read _elementor_data + 7 KotoIQ SEO meta keys via post.get_meta_bulk.
 * 5. Parse the Elementor tree (string-or-array tolerant).
 * 6. extractVariables → placeholder tree + variable schema.
 * 7. Compose seo_meta_template by substituting matching strings.
 * 8. Insert into koto_wp_templates with agency_id stamped.
 */
export async function captureTemplate(
    supabase: SupabaseClient,
    agencyId: string,
    sourceSiteId: string,
    sourcePostId: number,
    name: string,
    opts: CaptureTemplateOpts = {},
): Promise<TemplateCaptureResult> {
    if (!agencyId) {
        return { ok: false, error: { code: 'site_not_found', message: 'agencyId required' } }
    }
    if (!sourceSiteId) {
        return { ok: false, error: { code: 'site_not_found', message: 'sourceSiteId required' } }
    }
    if (!sourcePostId || sourcePostId < 1) {
        return {
            ok: false,
            error: { code: 'post_fetch_failed', message: 'sourcePostId must be a positive integer' },
        }
    }
    if (!name || name.trim() === '') {
        return {
            ok: false,
            error: { code: 'insert_failed', message: 'template name required' },
        }
    }

    // 1. Site lookup — agency-scoped (defense-in-depth atop RLS).
    const siteRes = await supabase
        .from('koto_wp_sites')
        .select('id, site_url, agency_id')
        .eq('id', sourceSiteId)
        .eq('agency_id', agencyId)
        .maybeSingle()
    if (siteRes.error) {
        return {
            ok: false,
            error: { code: 'site_not_found', message: `site lookup failed: ${siteRes.error.message}` },
        }
    }
    const site = (siteRes.data as SiteRow | null) ?? null
    if (!site) {
        return {
            ok: false,
            error: {
                code: 'site_not_found',
                message: `site ${sourceSiteId} not found under agency ${agencyId}`,
            },
        }
    }

    // 2. Credentials.
    const creds = await loadSiteCredentials(supabase, agencyId, sourceSiteId)
    if (!creds) {
        return {
            ok: false,
            error: {
                code: 'missing_credentials',
                message: `no App Password vault entry for site ${sourceSiteId}`,
            },
        }
    }

    // 3. Source post via core REST.
    const postRes = await wpFetchJson<WpPostShape>(
        site.site_url,
        `/wp/v2/pages/${sourcePostId}?_fields=id,title,content,slug,modified`,
        { username: creds.username, appPassword: creds.appPassword },
    )
    if (!postRes.ok || !postRes.data) {
        return {
            ok: false,
            error: {
                code: 'post_fetch_failed',
                message: `wp/v2/pages/${sourcePostId} failed: ${
                    !postRes.ok ? postRes.error : 'empty body'
                }`,
            },
        }
    }
    const post = postRes.data

    // 4. Meta read via shim.
    const metaRes = await postGetMetaBulk(site.site_url, {
        posts: [
            {
                post_id: sourcePostId,
                keys: ['_elementor_data', ...KOTOIQ_SEO_KEYS_FOR_TEMPLATE],
            },
        ],
    })
    if (!metaRes.ok) {
        return {
            ok: false,
            error: {
                code: 'meta_fetch_failed',
                message: `post.get_meta_bulk failed: ${metaRes.error.message}`,
            },
        }
    }
    const metaRow = metaRes.data?.results?.[String(sourcePostId)] ?? {}
    const rawElementorData = (metaRow as Record<string, unknown>)._elementor_data
    if (rawElementorData == null || rawElementorData === '' || rawElementorData === '[]') {
        return {
            ok: false,
            error: {
                code: 'not_elementor',
                message: `post ${sourcePostId} has no _elementor_data — is it edited with Elementor?`,
            },
        }
    }

    // 5. Parse the Elementor tree (string OR array tolerant).
    let parsedTree: unknown
    try {
        parsedTree =
            typeof rawElementorData === 'string'
                ? JSON.parse(rawElementorData)
                : rawElementorData
    } catch (e) {
        return {
            ok: false,
            error: {
                code: 'parse_failed',
                message: `_elementor_data is not valid JSON: ${(e as Error).message}`,
            },
        }
    }
    if (!Array.isArray(parsedTree)) {
        return {
            ok: false,
            error: {
                code: 'parse_failed',
                message: `_elementor_data parsed to non-array (${typeof parsedTree})`,
            },
        }
    }

    // 6. Variable extraction.
    const { tree, variables } = await extractVariables(parsedTree, {
        useLLM: opts.useLLM,
        existingVarHints: opts.variableHints,
    })

    // 7. SEO meta composition.
    const seoMetaTemplate = composeSeoMetaTemplate(metaRow as Record<string, unknown>, variables)

    // 8. Persist row.
    const insertPayload = {
        agency_id: agencyId,
        source_site_id: sourceSiteId,
        source_post_id: sourcePostId,
        name: name.trim(),
        description: opts.description ?? null,
        elementor_data: tree,
        variable_schema: variables,
        seo_meta_template: seoMetaTemplate,
        taxonomy_template: null,
        captured_by: opts.capturedBy ?? null,
    }
    const ins = await supabase.from('koto_wp_templates').insert(insertPayload).select().single()
    if (ins.error || !ins.data) {
        return {
            ok: false,
            error: {
                code: 'insert_failed',
                message: `koto_wp_templates insert failed: ${
                    ins.error?.message ?? 'no row returned'
                }`,
            },
        }
    }
    const row = ins.data as TemplateRow
    // Touch unwrapped post-title for downstream callers that want the source name.
    void unwrapRendered(post.title)
    return { ok: true, templateId: row.id, row }
}
