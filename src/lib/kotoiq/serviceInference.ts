import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { getKotoIQDb } from '@/lib/kotoiqDb'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 11 Plan 11-03 (WS3) — service auto-extraction.
//
// Infer the client's services list FROM the client's OWN baseline-scanned pages
// (kotoiq_site_baseline / 11-02 captureBaseline output) — NOT the keyword scan.
// The services are AI-inferred → user-editable: every inferred item carries an
// `ai_inferred` provenance flag so the UI can badge it and the user verifies it
// before it drives any builds (data-integrity standard).
//
// Strategy (cheapest-accurate, per CONTEXT discretion):
//   1. A pure HEURISTIC over /services/{slug} URL paths + service-page H1s. This
//      is free, deterministic, and unit-testable — and on a normal WP site with
//      a /services/ section it is all we need.
//   2. Escalate to a single Haiku pass over page text (H1 + meta_title + URL
//      path segments) ONLY when the heuristic is thin (few/no /services/ pages).
//      Any Claude call logs via logTokenUsage (Haiku, kotoiq_service_inference).
//
// Provenance note: we do NOT extend the typed Phase-7/8 `SOURCE_TYPES` enum
// (its length is asserted at 18 by the Phase-8 parity test). The data-integrity
// requirement is the *flag*, not enum membership — so this module carries its
// own self-contained `source_type:'ai_inferred'` provenance shape and persists
// it into the untyped `kotoiq_client_profile.fields` jsonb directly.
//
// Persisting confirmed services: saveConfirmedServices() writes to
// kotoiq_client_profile.fields.services[] (RESEARCH WS3 A3). agency_id is
// auto-injected by the Phase-7 clientProfile.upsert helper.
// ─────────────────────────────────────────────────────────────────────────────

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const CLAUDE_TIMEOUT_MS = 20_000
const CLAUDE_MAX_OUTPUT = 600
// Escalate to Claude when the heuristic produces fewer than this many services.
const HEURISTIC_MIN = 2
const MAX_SERVICES = 24

// ── Types ────────────────────────────────────────────────────────────────────

/** Subset of an ExtractedPage / baseline row the inference reads. */
export interface BaselinePageInput {
    url: string
    h1?: string | null
    meta_title?: string | null
    page_type?: string | null
    word_count?: number | null
}

/**
 * Self-contained provenance for an inferred service. `source_type` is the literal
 * 'ai_inferred' (the data-integrity flag the UI badges) — deliberately NOT a
 * member of the typed Phase-7/8 SourceType union (see header note).
 */
export interface ServiceProvenance {
    source_type: 'ai_inferred' | 'user_confirmed' | 'user_added'
    confidence: number
    source_url?: string
    captured_at: string
}

export interface InferredService {
    name: string
    provenance: ServiceProvenance
}

export interface InferServicesInput {
    agencyId: string
    clientId: string
    pages: BaselinePageInput[]
    /** Test/diagnostic hook: force the Claude escalation path. */
    forceClaude?: boolean
}

export interface InferServicesResult {
    ok: boolean
    services: InferredService[]
    source: 'heuristic' | 'claude' | 'none'
    detail?: string
}

// ── Pure helpers (no DB / no network — unit-tested directly) ─────────────────

const SERVICE_BOILERPLATE =
    /\b(services?|solutions?|company|inc|llc|co|home|welcome|page|our|the|and|&)\b/gi

/**
 * Normalize a raw service string into a clean, title-cased label.
 * Collapses whitespace, splits hyphens/underscores into words, strips a small
 * boilerplate stopword set, and title-cases. Pure + deterministic.
 */
export function normalizeServiceName(raw: string): string {
    if (!raw) return ''
    const cleaned = raw
        .replace(/[_-]+/g, ' ')
        .replace(SERVICE_BOILERPLATE, ' ')
        .replace(/[^a-zA-Z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    if (!cleaned) return ''
    return cleaned
        .split(' ')
        .map(w => (w.length <= 1 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
        .join(' ')
        .trim()
}

/** Pull the last meaningful path segment from a /services/{slug} URL. */
function serviceSlugFromUrl(url: string): string | null {
    try {
        const path = new URL(url).pathname.toLowerCase().replace(/\/+$/, '')
        const m = path.match(/\/(?:services?|service-areas?|what-we-do|solutions?)\/([^/]+)/)
        if (m && m[1]) return m[1]
        return null
    } catch {
        return null
    }
}

function isServicePage(p: BaselinePageInput): boolean {
    if (p.page_type === 'service') return true
    if (serviceSlugFromUrl(p.url)) return true
    return false
}

/**
 * Heuristic: from /services/{slug} paths + service-page H1s, produce a clean,
 * DEDUPED + SORTED service-name list. Pure + deterministic (network-free).
 */
export function servicesFromHeuristic(pages: BaselinePageInput[]): string[] {
    const set = new Map<string, string>() // lowercase key → display name
    for (const p of pages) {
        if (!isServicePage(p)) continue
        const candidates: string[] = []
        const slug = serviceSlugFromUrl(p.url)
        if (slug) candidates.push(slug)
        if (p.h1) candidates.push(p.h1)
        for (const c of candidates) {
            const name = normalizeServiceName(c)
            if (!name) continue
            const key = name.toLowerCase()
            if (!set.has(key)) set.set(key, name)
        }
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b))
}

/** Wrap a clean service name in an ai_inferred provenance record. Pure. */
export function toInferredService(
    name: string,
    confidence: number,
    sourceUrl: string | undefined,
): InferredService {
    return {
        name,
        provenance: {
            source_type: 'ai_inferred',
            confidence,
            source_url: sourceUrl,
            captured_at: new Date().toISOString(),
        },
    }
}

// ── Claude (Haiku) escalation ────────────────────────────────────────────────

const CLAUDE_SYSTEM = `You extract the distinct SERVICES a business offers from its own website pages.

You are given page signals (URL path, H1 heading, page title) from the client's own site. Return the clean list of services the business sells — the things a customer would hire them to do.

Rules:
- Only services this business actually offers (evidenced by the pages). Do not invent.
- Each service is a short noun phrase ("Roof Repair", "Storm Damage Restoration"), title-cased.
- No marketing fluff, no company name, no "services"/"solutions" suffix words.
- Deduplicate near-identical services.

Return STRICT JSON only: {"services":["...","..."]}  No markdown, no prose.`

export function pageSignalsForClaude(pages: BaselinePageInput[]): string {
    return pages
        .slice(0, 60)
        .map(p => {
            let path = ''
            try { path = new URL(p.url).pathname } catch { path = p.url }
            const parts = [
                `path=${path}`,
                p.h1 ? `h1=${p.h1.slice(0, 120)}` : null,
                p.meta_title ? `title=${p.meta_title.slice(0, 120)}` : null,
            ].filter(Boolean)
            return parts.join(' | ')
        })
        .join('\n')
        .slice(0, 8000)
}

function safeParseServices(raw: string): string[] {
    try {
        const start = raw.indexOf('{')
        const end = raw.lastIndexOf('}')
        if (start < 0 || end < 0) return []
        const parsed = JSON.parse(raw.slice(start, end + 1))
        if (!parsed || !Array.isArray(parsed.services)) return []
        return parsed.services.filter((s: unknown): s is string => typeof s === 'string')
    } catch {
        return []
    }
}

async function inferViaClaude(
    pages: BaselinePageInput[],
    agencyId: string,
    clientId: string,
): Promise<{ services: string[]; ok: boolean }> {
    if (!process.env.ANTHROPIC_API_KEY) return { services: [], ok: false }
    try {
        const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const ctl = new AbortController()
        const timer = setTimeout(() => ctl.abort(), CLAUDE_TIMEOUT_MS)
        let msg
        try {
            msg = await ai.messages.create({
                model: HAIKU_MODEL,
                max_tokens: CLAUDE_MAX_OUTPUT,
                system: CLAUDE_SYSTEM,
                messages: [{ role: 'user', content: `Page signals:\n${pageSignalsForClaude(pages)}` }],
            })
        } finally {
            clearTimeout(timer)
        }

        const inputTokens = msg.usage?.input_tokens || 0
        const outputTokens = msg.usage?.output_tokens || 0
        void logTokenUsage({
            feature: 'kotoiq_service_inference',
            model: HAIKU_MODEL,
            inputTokens,
            outputTokens,
            agencyId,
            metadata: { client_id: clientId, pages: pages.length },
        })

        const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : ''
        return { services: safeParseServices(text), ok: true }
    } catch {
        return { services: [], ok: false }
    }
}

// ── inferServices — the WS3 entry the infer_services route calls ──────────────

/**
 * Infer the client's services from their baseline pages. Heuristic-first; a
 * single Haiku pass only when the heuristic is thin. Returns ai_inferred,
 * provenance-flagged, deduped + sorted services. Never throws.
 */
export async function inferServices(input: InferServicesInput): Promise<InferServicesResult> {
    const { agencyId, clientId, pages, forceClaude } = input
    try {
        if (!Array.isArray(pages) || pages.length === 0) {
            return { ok: true, services: [], source: 'none', detail: 'no baseline pages' }
        }

        // Map each heuristic service back to a source page url for provenance.
        const heuristicNames = servicesFromHeuristic(pages)
        const sourceUrlFor = (name: string): string | undefined => {
            const key = name.toLowerCase()
            for (const p of pages) {
                if (!isServicePage(p)) continue
                const slug = serviceSlugFromUrl(p.url)
                const fromSlug = slug ? normalizeServiceName(slug).toLowerCase() : ''
                const fromH1 = p.h1 ? normalizeServiceName(p.h1).toLowerCase() : ''
                if (fromSlug === key || fromH1 === key) return p.url
            }
            return undefined
        }

        const heuristicThin = heuristicNames.length < HEURISTIC_MIN
        if (!forceClaude && !heuristicThin) {
            const services = heuristicNames
                .slice(0, MAX_SERVICES)
                .map(n => toInferredService(n, 0.6, sourceUrlFor(n)))
            return { ok: true, services, source: 'heuristic' }
        }

        // Escalate (or forced): single Haiku pass over the page signals.
        const claude = await inferViaClaude(pages, agencyId, clientId)
        if (claude.ok && claude.services.length > 0) {
            const seen = new Map<string, string>()
            for (const raw of claude.services) {
                const name = normalizeServiceName(raw)
                if (!name) continue
                const key = name.toLowerCase()
                if (!seen.has(key)) seen.set(key, name)
            }
            const services = Array.from(seen.values())
                .sort((a, b) => a.localeCompare(b))
                .slice(0, MAX_SERVICES)
                // Claude inference is less precise than a /services/ path match.
                .map(n => toInferredService(n, 0.5, sourceUrlFor(n)))
            return { ok: true, services, source: 'claude' }
        }

        // Claude unavailable/empty — fall back to whatever the heuristic found.
        const services = heuristicNames
            .slice(0, MAX_SERVICES)
            .map(n => toInferredService(n, 0.6, sourceUrlFor(n)))
        return {
            ok: true,
            services,
            source: services.length > 0 ? 'heuristic' : 'none',
            detail: claude.ok ? undefined : 'claude unavailable; heuristic fallback',
        }
    } catch (e) {
        return {
            ok: false,
            services: [],
            source: 'none',
            detail: e instanceof Error ? e.message : 'inferServices error',
        }
    }
}

// ── Persistence: confirmed services → kotoiq_client_profile.fields ────────────

/** One stored service record in kotoiq_client_profile.fields.services[]. */
export interface StoredServiceRecord {
    value: string
    source_type: 'ai_inferred' | 'user_confirmed' | 'user_added'
    confidence: number
    source_url?: string
    captured_at: string
}

export interface ConfirmedServiceInput {
    name: string
    /** true = the user explicitly touched/added this chip; false = left as AI-inferred. */
    user_edited?: boolean
    /** true = the user added this chip by hand (not on the AI-inferred seed list). */
    user_added?: boolean
    source_url?: string
    confidence?: number
}

/** The four confirmable categories (Phase 12 WS1 — keywords/phrases/services/offerings). */
export type FieldCategory = 'keywords' | 'phrases' | 'services' | 'offerings'

const FIELD_CATEGORIES: readonly FieldCategory[] = ['keywords', 'phrases', 'services', 'offerings'] as const

/**
 * Generalized confirmed-field persistence (Phase 12 WS1). Writes the user-curated
 * items for ONE category to kotoiq_client_profile.fields[category] in the exact
 * StoredServiceRecord shape ({value, source_type, confidence, source_url,
 * captured_at}) — byte-identical to what saveConfirmedServices wrote for
 * `services`, so score_grid's fields.services[] reader is unaffected.
 *
 * Provenance: user-added/edited chips become 'user_added'/'user_confirmed';
 * untouched chips stay 'ai_inferred'. The category is validated against the four
 * allowed values (V5 input validation / T-12-01 tampering mitigation). agency_id
 * is auto-injected by the Phase-7 clientProfile.upsert helper (cross-agency writes
 * are structurally impossible — T-12-04). Never throws.
 */
export async function saveConfirmedField(args: {
    agencyId: string
    clientId: string
    category: FieldCategory
    items: ConfirmedServiceInput[]
}): Promise<{ ok: boolean; saved: number; detail?: string }> {
    const { agencyId, clientId, category, items } = args
    try {
        if (!agencyId || !clientId) {
            return { ok: false, saved: 0, detail: 'missing agency_id or client_id' }
        }
        // V5 / T-12-01: reject any category outside the allowed enum before writing.
        if (!FIELD_CATEGORIES.includes(category)) {
            return { ok: false, saved: 0, detail: 'invalid category' }
        }
        const now = new Date().toISOString()
        const seen = new Set<string>()
        const records: StoredServiceRecord[] = []
        for (const s of items || []) {
            const name = normalizeServiceName(s.name)
            if (!name) continue
            const key = name.toLowerCase()
            if (seen.has(key)) continue
            seen.add(key)
            const source_type: StoredServiceRecord['source_type'] = s.user_added
                ? 'user_added'
                : s.user_edited
                    ? 'user_confirmed'
                    : 'ai_inferred'
            records.push({
                value: name,
                source_type,
                confidence: typeof s.confidence === 'number'
                    ? s.confidence
                    : source_type === 'ai_inferred' ? 0.6 : 1.0,
                source_url: s.source_url,
                captured_at: now,
            })
        }
        records.sort((a, b) => a.value.localeCompare(b.value))

        const db = getKotoIQDb(agencyId)
        // Read current fields jsonb (untyped column), splice in fields[category], upsert.
        const { data: profile } = await db.clientProfile.get(clientId)
        const fields = ((profile as { fields?: Record<string, unknown> } | null)?.fields || {}) as Record<string, unknown>
        fields[category] = records

        const { error } = await db.clientProfile.upsert({
            client_id: clientId,
            fields,
        })
        if (error) return { ok: false, saved: 0, detail: (error as { message?: string }).message || 'upsert failed' }
        return { ok: true, saved: records.length }
    } catch (e) {
        return { ok: false, saved: 0, detail: e instanceof Error ? e.message : 'saveConfirmedField error' }
    }
}

/**
 * Persist the user-confirmed SERVICES to kotoiq_client_profile.fields.services[].
 * Back-compat wrapper (Phase 11 WS3) — delegates to the generalized
 * saveConfirmedField with category='services' so the existing save_services
 * action and score_grid's fields.services[] reader keep working unchanged.
 * Never throws.
 */
export async function saveConfirmedServices(args: {
    agencyId: string
    clientId: string
    services: ConfirmedServiceInput[]
}): Promise<{ ok: boolean; saved: number; detail?: string }> {
    return saveConfirmedField({
        agencyId: args.agencyId,
        clientId: args.clientId,
        category: 'services',
        items: args.services,
    })
}
