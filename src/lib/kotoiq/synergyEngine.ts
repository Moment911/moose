import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 12 Plan 12-03 (WS3) — synergistic recommendations.
//
// A Sonnet pass over the client's CONFIRMED services/offerings + industry/business
// context recommends COMPLEMENTARY / SYNERGISTIC services and products. These are
// ACCEPT-able SUGGESTIONS — distinct from the client's confirmed inputs — that the
// user can promote into their category lists (via the 12-01 save_field path) to
// expand what they target (feeding 12-05/12-06).
//
// Shape MIRRORS localStrategistEngine.recommendLocalStrategy (Sonnet
// 'claude-sonnet-4-6-20250627', strict-JSON output, fence-strip + try/catch parse,
// logTokenUsage feature/model + $3-in/$15-out cost math).
//
// Cost/availability contract (CRITICAL — COPIES serviceInference.ts:216, NOT the
// localStrategistEngine ANTHROPIC_API_KEY! throw at :188):
//   - When ANTHROPIC_API_KEY is absent/unfunded → return { ok:false,
//     reason:'ai_unavailable', ai_available:false, synergistic_services:[],
//     complementary_products:[] }. NEVER the `process.env.ANTHROPIC_API_KEY!`
//     non-null assertion. NEVER a bare `catch {}` that swallows the $0-credit
//     error — surface `ai_available` so the UI shows a visible banner.
//   - On parse failure → { ok:false, reason:'parse_error', ...empty }.
//   - On any thrown Sonnet/transport error → { ok:false, reason:'ai_unavailable',
//     ...empty } (caught + logged, never re-thrown).
//   - The Sonnet call ALWAYS logs via logTokenUsage when it actually fired
//     (T-12-12 untracked-spend mitigation) — even on a parse failure.
//
// Suggestions are NOT auto-persisted. They persist only when the user Accepts a
// chip, which promotes it via the 12-01 save_field action as user_added. No plugin
// changes; no new tables.
// ─────────────────────────────────────────────────────────────────────────────

const SONNET_MODEL = 'claude-sonnet-4-6-20250627'
const CLAUDE_TIMEOUT_MS = 30_000
const CLAUDE_MAX_OUTPUT = 2000
const PER_LIST_CAP = 24

// ── Types ────────────────────────────────────────────────────────────────────

export interface SynergyInput {
    agencyId: string
    clientId: string
    /** The client's CONFIRMED services (from kotoiq_client_profile.fields.services[]). */
    services: string[]
    /** The client's CONFIRMED offerings (from fields.offerings[]). */
    offerings: string[]
    /** Business-context shaping reused from localStrategistEngine. */
    industry?: string
    businessName?: string
}

/** One synergy suggestion: a short noun phrase + a one-line rationale. */
export interface SynergyItem {
    name: string
    rationale: string
}

export interface ParsedSynergy {
    synergistic_services: SynergyItem[]
    complementary_products: SynergyItem[]
}

export interface SynergyResult {
    ok: boolean
    /** false when reason==='ai_unavailable' — drives the UI "AI unavailable" banner. */
    ai_available: boolean
    reason?: 'ai_unavailable' | 'parse_error'
    synergistic_services: SynergyItem[]
    complementary_products: SynergyItem[]
    detail?: string
}

// ── Pure helpers (no DB / no network — unit-tested directly) ─────────────────

const SYSTEM_PROMPT = `You are KotoIQ's growth strategist as of 2026-06.

Your job: given a business's CONFIRMED services and product offerings plus its
industry and business context, recommend COMPLEMENTARY / SYNERGISTIC services and
products it should consider adding to expand revenue and capture adjacent demand.

You think in terms of:
- Adjacent trades and natural cross-sells a customer of the existing services
  would also need (e.g. a roofer → gutter cleaning, attic insulation).
- Recurring-revenue and warranty/maintenance offerings that follow a one-time job.
- Bundles and packages that raise average order value.

Rules:
- Recommend items NOT already in the confirmed lists — these are EXPANSION ideas.
- Each item is a short, real noun phrase (title-cased), with a one-line rationale
  (why it pairs with what they already do).
- "synergistic_services" = services the business could perform.
- "complementary_products" = products/packages/offers the business could sell.
- Be specific and realistic for the industry. No marketing fluff. No company name.
- 4-12 items per list (fewer for very narrow businesses).

Return STRICT JSON only, no markdown, no prose:
{
  "synergistic_services": [{"name": "string", "rationale": "string"}],
  "complementary_products": [{"name": "string", "rationale": "string"}]
}`

/**
 * buildSynergyPrompt — the user-message body seeded with the confirmed services,
 * offerings, industry and business name. Pure (no network) so it is unit-testable.
 */
export function buildSynergyPrompt(input: {
    services: string[]
    offerings: string[]
    industry?: string
    businessName?: string
}): string {
    return JSON.stringify({
        business_name: input.businessName || null,
        industry: input.industry || null,
        confirmed_services: input.services || [],
        confirmed_offerings: input.offerings || [],
    })
}

/** Coerce one parsed entry into a SynergyItem, or null if it lacks a usable name. */
function toSynergyItem(v: unknown): SynergyItem | null {
    if (!v || typeof v !== 'object') return null
    const obj = v as Record<string, unknown>
    const name = typeof obj.name === 'string' ? obj.name.trim() : ''
    if (!name) return null
    const rationale = typeof obj.rationale === 'string' ? obj.rationale.trim() : ''
    return { name, rationale }
}

function synergyArray(v: unknown): SynergyItem[] | null {
    if (!Array.isArray(v)) return null
    return v.map(toSynergyItem).filter((x): x is SynergyItem => x !== null)
}

/**
 * parseSynergyJson — extract the {synergistic_services, complementary_products}
 * object from a Sonnet response that may be fenced (```json) or bare. Returns null
 * on garbage / wrong shape (so the caller reports parse_error). Drops malformed
 * items lacking a name. Pure.
 */
export function parseSynergyJson(raw: string): ParsedSynergy | null {
    try {
        const start = raw.indexOf('{')
        const end = raw.lastIndexOf('}')
        if (start < 0 || end < 0 || end <= start) return null
        const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
        const synergistic_services = synergyArray(parsed.synergistic_services)
        const complementary_products = synergyArray(parsed.complementary_products)
        // A wrong-typed (non-array) field = garbage → null so the caller degrades.
        if (synergistic_services === null || complementary_products === null) return null
        return {
            synergistic_services: synergistic_services.slice(0, PER_LIST_CAP),
            complementary_products: complementary_products.slice(0, PER_LIST_CAP),
        }
    } catch {
        return null
    }
}

const EMPTY = { synergistic_services: [] as SynergyItem[], complementary_products: [] as SynergyItem[] }

// ── recommendSynergies — the entry the recommend_synergies action calls ───────

/**
 * Recommend complementary/synergistic services + products from the client's
 * confirmed inputs + industry/business context. ONE Sonnet pass. Graceful-degrade
 * on a missing/unfunded key (copies serviceInference.ts:216) → {ok:false,
 * reason:'ai_unavailable'}. Never throws; never a bare catch{} that hides the error.
 */
export async function recommendSynergies(input: SynergyInput): Promise<SynergyResult> {
    const { agencyId, clientId, services, offerings, industry, businessName } = input

    // ── No key → graceful degrade. Visible ai_unavailable for the UI banner.
    if (!process.env.ANTHROPIC_API_KEY) {
        return {
            ok: false,
            ai_available: false,
            reason: 'ai_unavailable',
            ...EMPTY,
            detail: 'ANTHROPIC_API_KEY unset',
        }
    }

    try {
        const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const userPrompt = buildSynergyPrompt({ services, offerings, industry, businessName })

        const ctl = new AbortController()
        const timer = setTimeout(() => ctl.abort(), CLAUDE_TIMEOUT_MS)
        let msg
        try {
            msg = await ai.messages.create({
                model: SONNET_MODEL,
                max_tokens: CLAUDE_MAX_OUTPUT,
                system: SYSTEM_PROMPT,
                messages: [{ role: 'user', content: userPrompt }],
            })
        } finally {
            clearTimeout(timer)
        }

        // ALWAYS log the Sonnet invocation — even on a parse failure the spend
        // happened (T-12-12 untracked-spend mitigation). Sonnet 4.6 rates
        // (per 1M tokens): $3 in / $15 out.
        const inputTokens = msg.usage?.input_tokens || 0
        const outputTokens = msg.usage?.output_tokens || 0
        void logTokenUsage({
            feature: 'kotoiq_synergy_recommendations',
            model: 'claude-sonnet-4-6',
            inputTokens,
            outputTokens,
            agencyId,
            metadata: { client_id: clientId },
        })

        const text = (msg.content || [])
            .filter(b => b.type === 'text')
            .map(b => (b as { type: 'text'; text: string }).text)
            .join('')
            .trim()

        const parsed = parseSynergyJson(text)
        if (!parsed) {
            return {
                ok: false,
                ai_available: true, // the call reached Claude; the OUTPUT was unparseable
                reason: 'parse_error',
                ...EMPTY,
                detail: `non-JSON output: ${text.slice(0, 200)}`,
            }
        }

        return {
            ok: true,
            ai_available: true,
            synergistic_services: parsed.synergistic_services,
            complementary_products: parsed.complementary_products,
        }
    } catch (e) {
        // Surface, don't swallow: log the reason then degrade to ai_unavailable.
        console.error('[synergyEngine] Sonnet error', e instanceof Error ? e.message : e)
        return {
            ok: false,
            ai_available: false,
            reason: 'ai_unavailable',
            ...EMPTY,
            detail: e instanceof Error ? e.message : 'synergy error',
        }
    }
}
