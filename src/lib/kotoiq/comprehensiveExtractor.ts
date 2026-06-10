import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import {
    servicesFromHeuristic,
    normalizeServiceName,
    pageSignalsForClaude,
    type BaselinePageInput,
    type StoredServiceRecord,
} from '@/lib/kotoiq/serviceInference'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 12 Plan 12-01 (WS1) — unified comprehensive four-category extraction.
//
// Generalizes serviceInference's heuristic-first → single-Haiku-pass pattern from
// ONE category (services) to FOUR: keywords / phrases / services / offerings.
// The categories are derived from the client's OWN already-captured baseline
// pages — never an arbitrary fetch. Every produced item is AI-inferred → the UI
// badges it `ai_inferred` and the user must confirm before it drives any build
// (data-integrity standard: AI output is flagged, never trusted as ground truth).
//
// Cost/availability contract (CRITICAL — mirrors serviceInference.ts:216):
//   - When ANTHROPIC_API_KEY is absent/unfunded → return { ok:false,
//     reason:'ai_unavailable', ...all-four-heuristic-categories }. NEVER the
//     `process.env.ANTHROPIC_API_KEY!` non-null assertion. NEVER a bare
//     `catch {}` that swallows the $0-credit error — always degrade to the
//     per-category heuristics and surface an `ai_available` flag for the UI.
//   - When the key is present: ONE Haiku pass returning strict JSON of the four
//     lists. On parse-fail / empty, fill each category from its heuristic. The
//     single Claude call ALWAYS logs via logTokenUsage (T-12-05 repudiation).
//
// Persistence shape is the existing StoredServiceRecord ({value, source_type,
// confidence, source_url, captured_at}) so the same saveConfirmedField path and
// score_grid reader work unchanged across all four categories.
// ─────────────────────────────────────────────────────────────────────────────

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const CLAUDE_TIMEOUT_MS = 20_000
const CLAUDE_MAX_OUTPUT = 1500
const PER_CATEGORY_CAP = 40

export type CategoryKey = 'keywords' | 'phrases' | 'services' | 'offerings'

/**
 * Richer per-page signal the four-category extractor reads. Extends the baseline
 * row shape with the fields a keyword/phrase/offering extraction needs (h2/hero/
 * meta_description/cta). All optional so a thin baseline row still works.
 */
export interface ExtractorPageInput extends BaselinePageInput {
    meta_description?: string | null
    h2_list?: string[] | null
    hero_copy?: string | null
    cta_list?: string[] | null
}

export interface ExtractComprehensiveInput {
    agencyId: string
    clientId: string
    pages: ExtractorPageInput[]
}

export interface ComprehensiveResult {
    ok: boolean
    /** false when reason==='ai_unavailable' — drives the UI "AI unavailable" banner. */
    ai_available: boolean
    reason?: 'ai_unavailable'
    keywords: StoredServiceRecord[]
    phrases: StoredServiceRecord[]
    services: StoredServiceRecord[]
    offerings: StoredServiceRecord[]
    source: 'claude' | 'heuristic' | 'none'
    detail?: string
}

// ── Pure helpers (no DB / no network — unit-tested directly) ─────────────────

// A compact stopword set for keyword/n-gram extraction. UI/presentation strings,
// not data (acceptable to hardcode per data-integrity-standard).
const STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'you', 'your', 'our', 'are', 'was', 'were', 'this',
    'that', 'from', 'have', 'has', 'had', 'will', 'can', 'all', 'any', 'get', 'got',
    'a', 'an', 'of', 'to', 'in', 'on', 'at', 'is', 'it', 'we', 'us', 'or', 'be', 'as',
    'by', 'if', 'so', 'do', 'no', 'up', 'out', 'now', 'new', 'more', 'most', 'best',
    'free', 'home', 'page', 'services', 'service', 'about', 'contact', 'welcome',
])

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
}

/** Sort a freq map's keys by descending frequency, then alpha for stability. */
function freqSorted(freq: Map<string, number>): string[] {
    return Array.from(freq.entries())
        .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
        .map(([k]) => k)
}

/**
 * keywordsFromHeuristic — single-token keywords from h1 / meta_title / h2 / meta
 * description, lowercased, stopword-stripped, deduped, frequency-sorted. Pure.
 */
export function keywordsFromHeuristic(pages: ExtractorPageInput[]): string[] {
    const freq = new Map<string, number>()
    for (const p of pages) {
        const sources: string[] = []
        if (p.h1) sources.push(p.h1)
        if (p.meta_title) sources.push(p.meta_title)
        if (p.meta_description) sources.push(p.meta_description)
        for (const h2 of p.h2_list || []) if (h2) sources.push(h2)
        for (const tok of tokenize(sources.join(' '))) {
            if (tok.length < 3) continue
            if (STOPWORDS.has(tok)) continue
            if (/^\d+$/.test(tok)) continue
            freq.set(tok, (freq.get(tok) || 0) + 1)
        }
    }
    return freqSorted(freq).slice(0, PER_CATEGORY_CAP)
}

/** Build 2-4 word n-grams from a text, skipping grams that start/end on a stopword. */
function ngramsFrom(text: string, freq: Map<string, number>): void {
    const toks = tokenize(text).filter(t => t.length >= 2 && !/^\d+$/.test(t))
    for (let n = 2; n <= 4; n++) {
        for (let i = 0; i + n <= toks.length; i++) {
            const gram = toks.slice(i, i + n)
            if (STOPWORDS.has(gram[0]) || STOPWORDS.has(gram[n - 1])) continue
            // Skip grams that are entirely stopwords/filler.
            if (gram.every(g => STOPWORDS.has(g))) continue
            const key = gram.join(' ')
            freq.set(key, (freq.get(key) || 0) + 1)
        }
    }
}

/**
 * phrasesFromHeuristic — 2-4 word n-grams from h2_list + hero_copy, deduped,
 * frequency-sorted. Pure.
 */
export function phrasesFromHeuristic(pages: ExtractorPageInput[]): string[] {
    const freq = new Map<string, number>()
    for (const p of pages) {
        for (const h2 of p.h2_list || []) if (h2) ngramsFrom(h2, freq)
        if (p.hero_copy) ngramsFrom(p.hero_copy, freq)
    }
    return freqSorted(freq).slice(0, PER_CATEGORY_CAP)
}

/**
 * offeringsFromHeuristic — offering/product candidates from cta_list + h2_list
 * (title-cased noun phrases), deduped. Pure. CTAs are stripped of imperative
 * verbs ("Get a", "Book", "Schedule", "Request") so "Get a Free Estimate" →
 * "Free Estimate".
 */
const CTA_VERB_PREFIX =
    /^(get|book|schedule|request|claim|start|try|buy|order|call|contact|find|explore|discover|learn|see|view|shop|download)\s+(a |an |your |the |my )?/i

export function offeringsFromHeuristic(pages: ExtractorPageInput[]): string[] {
    const set = new Map<string, string>() // lowercase key → display
    const add = (raw: string) => {
        const stripped = raw.replace(CTA_VERB_PREFIX, '').trim()
        const name = normalizeServiceName(stripped)
        if (!name || name.split(' ').length === 0) return
        const key = name.toLowerCase()
        if (!set.has(key)) set.set(key, name)
    }
    for (const p of pages) {
        for (const cta of p.cta_list || []) if (cta) add(cta)
        for (const h2 of p.h2_list || []) if (h2) add(h2)
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b)).slice(0, PER_CATEGORY_CAP)
}

/**
 * Wrap a clean string into the StoredServiceRecord (ai_inferred) shape. Pure.
 * Heuristic items are still machine-inferred → flagged ai_inferred (the UI badge),
 * never presented as user-confirmed truth.
 */
function toRecord(value: string, confidence: number, sourceUrl: string | undefined, now: string): StoredServiceRecord {
    return { value, source_type: 'ai_inferred', confidence, source_url: sourceUrl, captured_at: now }
}

// ── Strict-JSON parse (fence-strip, four-array shape) ─────────────────────────

export interface ParsedComprehensive {
    keywords: string[]
    phrases: string[]
    services: string[]
    offerings: string[]
}

function stringArray(v: unknown): string[] | null {
    if (!Array.isArray(v)) return null
    return v.filter((x): x is string => typeof x === 'string')
}

/**
 * safeParseComprehensive — extract the {keywords,phrases,services,offerings}
 * object from a Claude response that may be fenced (```json) or bare. Returns
 * null on garbage / wrong shape so the caller falls back to heuristics. Pure.
 */
export function safeParseComprehensive(raw: string): ParsedComprehensive | null {
    try {
        const start = raw.indexOf('{')
        const end = raw.lastIndexOf('}')
        if (start < 0 || end < 0 || end <= start) return null
        const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
        const keywords = stringArray(parsed.keywords)
        const phrases = stringArray(parsed.phrases)
        const services = stringArray(parsed.services)
        const offerings = stringArray(parsed.offerings)
        // Require every key to be an array (a single wrong-typed field = garbage).
        if (keywords === null || phrases === null || services === null || offerings === null) return null
        return { keywords, phrases, services, offerings }
    } catch {
        return null
    }
}

// ── Claude (Haiku) unified four-category pass ─────────────────────────────────

const CLAUDE_SYSTEM = `You analyze a business's OWN website pages and extract FOUR distinct categories.

You are given page signals (URL path, H1, H2 headings, page title, meta description, hero copy, CTAs) from the client's own site. From them, extract:
- "keywords": short search keywords a customer might type (1-2 words each), lowercased.
- "phrases": longer search phrases / search intents (2-5 words each), lowercased.
- "services": the distinct services the business performs (what a customer hires them to do), title-cased noun phrases.
- "offerings": the distinct products/packages/offers the business sells, title-cased noun phrases.

Rules:
- Only items evidenced by the pages. Do NOT invent.
- Deduplicate near-identical items within each category.
- No marketing fluff, no company name, no "services"/"solutions" suffix words.

Return STRICT JSON only: {"keywords":["..."],"phrases":["..."],"services":["..."],"offerings":["..."]}  No markdown, no prose.`

/** Build the richer four-category signal block (reuses the 60-page/8000-char slice). */
function comprehensiveSignals(pages: ExtractorPageInput[]): string {
    // Reuse pageSignalsForClaude's path|h1|title core, then append the richer
    // h2/hero/meta-description/cta signals (still bounded by the same 8000-char cap).
    const base = pageSignalsForClaude(pages)
    const rich = pages
        .slice(0, 60)
        .map(p => {
            const parts: string[] = []
            if (p.meta_description) parts.push(`desc=${p.meta_description.slice(0, 160)}`)
            const h2 = (p.h2_list || []).filter(Boolean).slice(0, 8).join(' ; ')
            if (h2) parts.push(`h2=${h2.slice(0, 240)}`)
            if (p.hero_copy) parts.push(`hero=${p.hero_copy.slice(0, 200)}`)
            const cta = (p.cta_list || []).filter(Boolean).slice(0, 6).join(' ; ')
            if (cta) parts.push(`cta=${cta.slice(0, 160)}`)
            return parts.join(' | ')
        })
        .filter(Boolean)
        .join('\n')
        .slice(0, 8000)
    return rich ? `${base}\n--- richer signals ---\n${rich}` : base
}

async function extractViaClaude(
    pages: ExtractorPageInput[],
    agencyId: string,
    clientId: string,
): Promise<{ parsed: ParsedComprehensive | null; ok: boolean }> {
    // Graceful-degrade guard — COPY of serviceInference.ts:216. Never `!`, never throw.
    if (!process.env.ANTHROPIC_API_KEY) return { parsed: null, ok: false }
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
                messages: [{ role: 'user', content: `Page signals:\n${comprehensiveSignals(pages)}` }],
            })
        } finally {
            clearTimeout(timer)
        }

        // ALWAYS log the single Haiku invocation (T-12-05 untracked-spend mitigation).
        void logTokenUsage({
            feature: 'kotoiq_comprehensive_extraction',
            model: HAIKU_MODEL,
            inputTokens: msg.usage?.input_tokens || 0,
            outputTokens: msg.usage?.output_tokens || 0,
            agencyId,
            metadata: { client_id: clientId, pages: pages.length },
        })

        const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : ''
        return { parsed: safeParseComprehensive(text), ok: true }
    } catch (e) {
        // Surface, don't swallow: log the reason then degrade to heuristics.
        console.error('[comprehensiveExtractor] Claude error', e instanceof Error ? e.message : e)
        return { parsed: null, ok: false }
    }
}

// ── extractComprehensive — the entry the extract_comprehensive action calls ───

/**
 * Produce the four flagged categories from the client's baseline pages. ONE Haiku
 * pass when a key is present; per-category heuristic fallback otherwise (or on
 * parse-fail / empty). Returns ai_available:false + reason:'ai_unavailable' when
 * the key is absent so the UI can show the banner. Never throws.
 */
export async function extractComprehensive(input: ExtractComprehensiveInput): Promise<ComprehensiveResult> {
    const { agencyId, clientId, pages } = input
    const now = new Date().toISOString()

    // Pure per-category heuristics computed up-front (the always-available floor).
    const heuristic: Record<CategoryKey, string[]> = {
        keywords: keywordsFromHeuristic(pages),
        phrases: phrasesFromHeuristic(pages),
        services: servicesFromHeuristic(pages),
        offerings: offeringsFromHeuristic(pages),
    }

    const wrap = (vals: string[], confidence: number): StoredServiceRecord[] => {
        const seen = new Set<string>()
        const out: StoredServiceRecord[] = []
        for (const v of vals) {
            const value = (v || '').trim()
            if (!value) continue
            const key = value.toLowerCase()
            if (seen.has(key)) continue
            seen.add(key)
            out.push(toRecord(value, confidence, undefined, now))
        }
        return out.slice(0, PER_CATEGORY_CAP)
    }

    // ── No key → graceful degrade. All four heuristic categories + ai_unavailable.
    if (!process.env.ANTHROPIC_API_KEY) {
        return {
            ok: false,
            ai_available: false,
            reason: 'ai_unavailable',
            keywords: wrap(heuristic.keywords, 0.5),
            phrases: wrap(heuristic.phrases, 0.5),
            services: wrap(heuristic.services, 0.6),
            offerings: wrap(heuristic.offerings, 0.5),
            source: heuristic.keywords.length || heuristic.services.length ? 'heuristic' : 'none',
            detail: 'ANTHROPIC_API_KEY unset — heuristic fallback',
        }
    }

    // ── Key present → one Haiku pass; fill each category from heuristic if empty.
    const { parsed, ok } = await extractViaClaude(pages, agencyId, clientId)

    const pick = (cat: CategoryKey, aiConf: number, heurConf: number): StoredServiceRecord[] => {
        const fromAi = parsed?.[cat]?.filter(s => typeof s === 'string' && s.trim()) || []
        if (fromAi.length > 0) return wrap(fromAi, aiConf)
        return wrap(heuristic[cat], heurConf)
    }

    if (ok && parsed) {
        return {
            ok: true,
            ai_available: true,
            keywords: pick('keywords', 0.6, 0.5),
            phrases: pick('phrases', 0.6, 0.5),
            services: pick('services', 0.6, 0.6),
            offerings: pick('offerings', 0.6, 0.5),
            source: 'claude',
        }
    }

    // Claude reachable but unparseable → ok:true (call happened) with heuristic fill.
    // Claude unreachable (transport error) → ok:false but still return heuristics.
    return {
        ok,
        ai_available: ok,
        reason: ok ? undefined : 'ai_unavailable',
        keywords: wrap(heuristic.keywords, 0.5),
        phrases: wrap(heuristic.phrases, 0.5),
        services: wrap(heuristic.services, 0.6),
        offerings: wrap(heuristic.offerings, 0.5),
        source: heuristic.keywords.length || heuristic.services.length ? 'heuristic' : 'none',
        detail: ok ? 'claude parse-fail; heuristic fallback' : 'claude unavailable; heuristic fallback',
    }
}
