import 'server-only'

// ── Competitor-aware content generation context builder ────────────────────
//
// Before Claude writes a topic-campaign master, this module fetches the top
// SERP results for "<topic> in <sample city>" and extracts each page's
// signal: H1, H2s, meta description, approximate word count. The output is
// a compact context string that gets injected into Claude's user prompt so
// the generated master takes deliberate angles competitors miss.
//
// Trade-off: adds ~3-8 seconds + ~3-5 DataForSEO credits + 3 page-fetch
// HTTP calls per master generation. Worth it for the ranking lift — the
// alternative is Claude generating in a vacuum with no signal about what
// already ranks.

import { getSERPResults } from '@/lib/dataforseo'

export interface CompetitorBrief {
    rank: number
    url: string
    domain: string
    title: string
    metaDescription: string
    h1: string
    h2s: string[]
    wordCount: number
    fetchOk: boolean
}

export interface CompetitorContext {
    sampleQuery: string
    sampleLocation: string
    briefs: CompetitorBrief[]
    aiOverviewSeen: boolean
    peopleAlsoAsk: string[]
    /** Pre-rendered text suitable for inclusion in a Claude user prompt. */
    promptText: string
}

/**
 * Build a competitor context block for a given topic + sample location.
 * Returns null on failure (caller should proceed without competitor info
 * rather than failing master generation).
 */
export async function buildCompetitorContext(
    topic: string,
    sampleCity: string,
    sampleStateAbbr?: string,
): Promise<CompetitorContext | null> {
    if (!topic.trim() || !sampleCity.trim()) return null

    // Compose a realistic search query — same shape an end-user would type
    const keyword = `${topic.trim()} in ${sampleCity.trim()}${sampleStateAbbr ? `, ${sampleStateAbbr.toUpperCase()}` : ''}`
    const location = sampleStateAbbr ? `${sampleCity}, ${sampleStateAbbr}, United States` : `${sampleCity}, United States`

    let serp
    try {
        serp = await getSERPResults(keyword, location)
    } catch {
        return null
    }
    if (!serp || !Array.isArray(serp.items)) return null

    // Take the top 3 organic results (skip ads, knowledge panels, etc.)
    const organicItems = serp.items
        .filter((it: any) => it.type === 'organic' && it.url && /^https?:\/\//i.test(it.url))
        .slice(0, 3)
    if (organicItems.length === 0) return null

    const briefs: CompetitorBrief[] = []
    for (let i = 0; i < organicItems.length; i++) {
        const it: any = organicItems[i]
        const brief = await fetchCompetitorBrief(it.url, i + 1).catch(() => null)
        if (brief) briefs.push(brief)
    }
    if (briefs.length === 0) return null

    // Compose a tight prompt block — Claude reads this BEFORE the master spec
    const lines: string[] = []
    lines.push(`COMPETITOR CONTEXT — top organic results for "${keyword}":`)
    if (serp.ai_overview) {
        lines.push(`(Google AI Overview WAS shown for this query — design for AI-engine citation, not just SERP rank.)`)
    }
    if (Array.isArray(serp.people_also_ask) && serp.people_also_ask.length) {
        lines.push(`People also ask: ${serp.people_also_ask.slice(0, 6).join(' / ')}`)
    }
    lines.push('')
    for (const b of briefs) {
        lines.push(`#${b.rank}  ${b.domain}  (${b.wordCount} words)`)
        if (b.h1) lines.push(`  H1: ${b.h1.slice(0, 140)}`)
        if (b.metaDescription) lines.push(`  meta: ${b.metaDescription.slice(0, 200)}`)
        if (b.h2s.length) lines.push(`  H2s: ${b.h2s.slice(0, 6).map(h => h.slice(0, 80)).join(' | ')}`)
        lines.push('')
    }
    lines.push('STRATEGIC GUIDANCE FOR CLAUDE:')
    lines.push('- Do NOT mirror the competitors\' angles. Read what they cover, then take a deliberately differentiated angle.')
    lines.push('- Find topics + sections the top 3 ALL MISS (a "gap"). Build a section around it.')
    lines.push('- If competitors all skew short (<600 words combined H2 surface), write longer + more thorough.')
    lines.push('- If competitors all skew long + dense, write tighter + more declarative for AEO extraction.')
    lines.push('- Quote concrete numbers / specifics that competitors lack (pricing ranges, timelines, deliverable counts).')

    return {
        sampleQuery: keyword,
        sampleLocation: location,
        briefs,
        aiOverviewSeen: !!serp.ai_overview,
        peopleAlsoAsk: serp.people_also_ask || [],
        promptText: lines.join('\n'),
    }
}

export interface AggregatedCompetitorContext {
    /** Human labels of the cities that actually returned data, e.g. ["Austin, TX", "Dallas, TX"]. */
    citiesSampled: string[]
    cityCount: number
    aiOverviewSeen: boolean
    peopleAlsoAsk: string[]
    /** Competitor domains ranked across the sampled cities, strongest signal first. */
    domains: {
        domain: string
        /** How many of the sampled cities this domain ranked top-3 in. Higher = more entrenched. */
        appearances: number
        bestRank: number
        h1: string
        avgWordCount: number
    }[]
    /** Pre-rendered text suitable for inclusion in a Claude user prompt. */
    promptText: string
    // Backward-compatible single-sample fields (kept so existing competitor_meta
    // consumers — toast strings, edit-modal prefill — keep working).
    sampleQuery: string
    sampleLocation: string
}

/**
 * Build an AGGREGATED competitor context across multiple sample cities. Runs
 * buildCompetitorContext per city in parallel, then merges: domains that rank
 * in multiple cities float to the top (entrenched players worth differentiating
 * against hardest), People-also-ask is unioned, AI-overview is ORed.
 *
 * One sample city is a snapshot; 3-5 cities reveal which competitors actually
 * dominate the topic regionally vs. which only rank in one local market.
 *
 * Returns null if no city yields usable data (caller proceeds without intel).
 */
export async function buildMultiCityCompetitorContext(
    topic: string,
    locations: Array<{ city: string; stateAbbr?: string }>,
    maxCities = 5,
): Promise<AggregatedCompetitorContext | null> {
    if (!topic.trim()) return null

    // Dedupe by city+state (case-insensitive), drop empties, cap the count so
    // a fat-fingered list can't fan out into dozens of SERP calls.
    const seen = new Set<string>()
    const picked: Array<{ city: string; stateAbbr?: string }> = []
    for (const loc of locations) {
        const city = String(loc.city || '').trim()
        if (!city) continue
        const key = `${city.toLowerCase()}|${(loc.stateAbbr || '').toLowerCase()}`
        if (seen.has(key)) continue
        seen.add(key)
        picked.push({ city, stateAbbr: loc.stateAbbr })
        if (picked.length >= maxCities) break
    }
    if (picked.length === 0) return null

    const settled = await Promise.allSettled(
        picked.map(loc => buildCompetitorContext(topic, loc.city, loc.stateAbbr || undefined)),
    )
    const contexts = settled
        .map(s => (s.status === 'fulfilled' ? s.value : null))
        .filter((c): c is CompetitorContext => !!c)
    if (contexts.length === 0) return null

    // Aggregate domains across cities.
    const domainMap = new Map<string, { appearances: number; bestRank: number; h1: string; wordCounts: number[] }>()
    for (const ctx of contexts) {
        // One domain can appear multiple times within a single city's top-3
        // (rare, but possible) — count it once per city.
        const seenThisCity = new Set<string>()
        for (const b of ctx.briefs) {
            const existing = domainMap.get(b.domain) || { appearances: 0, bestRank: b.rank, h1: b.h1, wordCounts: [] }
            if (!seenThisCity.has(b.domain)) {
                existing.appearances += 1
                seenThisCity.add(b.domain)
            }
            if (b.rank < existing.bestRank) { existing.bestRank = b.rank; if (b.h1) existing.h1 = b.h1 }
            if (!existing.h1 && b.h1) existing.h1 = b.h1
            if (b.wordCount) existing.wordCounts.push(b.wordCount)
            domainMap.set(b.domain, existing)
        }
    }
    const domains = [...domainMap.entries()]
        .map(([domain, v]) => ({
            domain,
            appearances: v.appearances,
            bestRank: v.bestRank,
            h1: v.h1,
            avgWordCount: v.wordCounts.length ? Math.round(v.wordCounts.reduce((a, b) => a + b, 0) / v.wordCounts.length) : 0,
        }))
        .sort((a, b) => b.appearances - a.appearances || a.bestRank - b.bestRank)

    // Merge People-also-ask (dedupe case-insensitive).
    const paaSeen = new Set<string>()
    const peopleAlsoAsk: string[] = []
    for (const ctx of contexts) {
        for (const q of ctx.peopleAlsoAsk) {
            const k = q.trim().toLowerCase()
            if (!k || paaSeen.has(k)) continue
            paaSeen.add(k)
            peopleAlsoAsk.push(q.trim())
            if (peopleAlsoAsk.length >= 8) break
        }
        if (peopleAlsoAsk.length >= 8) break
    }

    const citiesSampled = contexts.map(c => c.sampleLocation.replace(/, United States$/i, ''))
    const aiOverviewCount = contexts.filter(c => c.aiOverviewSeen).length
    const cityCount = contexts.length

    // Render the aggregated prompt block.
    const lines: string[] = []
    lines.push(`COMPETITOR CONTEXT — aggregated from ${cityCount} sample ${cityCount === 1 ? 'city' : 'cities'} for "${topic.trim()}": ${citiesSampled.join(', ')}`)
    if (aiOverviewCount > 0) {
        lines.push(`(Google AI Overview shown in ${aiOverviewCount}/${cityCount} sampled ${aiOverviewCount === 1 ? 'city' : 'cities'} — design for AI-engine citation, not just SERP rank.)`)
    }
    if (peopleAlsoAsk.length) {
        lines.push(`People also ask (merged): ${peopleAlsoAsk.slice(0, 6).join(' / ')}`)
    }
    lines.push('')

    const dominant = domains.filter(d => d.appearances >= 2)
    const others = domains.filter(d => d.appearances < 2)
    if (dominant.length) {
        lines.push(`DOMINANT COMPETITORS (rank across multiple sampled cities — the real targets):`)
        for (const d of dominant.slice(0, 6)) {
            lines.push(`  ${d.domain} — ranks in ${d.appearances}/${cityCount} cities, best #${d.bestRank}, ~${d.avgWordCount} words`)
            if (d.h1) lines.push(`     H1: ${d.h1.slice(0, 140)}`)
        }
        lines.push('')
    }
    if (others.length) {
        lines.push(`OTHER RANKING PAGES (single-city):`)
        for (const d of others.slice(0, 8)) {
            lines.push(`  ${d.domain} — #${d.bestRank}, ~${d.avgWordCount} words${d.h1 ? ` — H1: ${d.h1.slice(0, 100)}` : ''}`)
        }
        lines.push('')
    }

    lines.push('STRATEGIC GUIDANCE FOR CLAUDE:')
    lines.push('- Domains that recur across cities are the entrenched regional players — differentiate HARDEST against their angles.')
    lines.push('- Find topics + sections the dominant competitors ALL MISS (a "gap"). Build a section around it.')
    lines.push('- If competitors all skew short, write longer + more thorough. If all skew long + dense, write tighter + more declarative for AEO extraction.')
    lines.push('- Quote concrete numbers / specifics competitors lack (pricing ranges, timelines, deliverable counts).')

    return {
        citiesSampled,
        cityCount,
        aiOverviewSeen: aiOverviewCount > 0,
        peopleAlsoAsk,
        domains,
        promptText: lines.join('\n'),
        sampleQuery: contexts[0].sampleQuery,
        sampleLocation: cityCount === 1 ? citiesSampled[0] : `${cityCount} cities: ${citiesSampled.join(', ')}`,
    }
}

/**
 * Fetch a single competitor page and extract its on-page signal. Best-effort,
 * returns null on any error. 10s timeout per fetch.
 */
async function fetchCompetitorBrief(url: string, rank: number): Promise<CompetitorBrief | null> {
    let html = ''
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoIQ-Bot/1.0; +https://hellokoto.com)' },
            signal: AbortSignal.timeout(10_000),
            redirect: 'follow',
        })
        if (!res.ok) return null
        const ct = res.headers.get('content-type') || ''
        if (!ct.includes('text/html')) return null
        html = await res.text()
    } catch {
        return null
    }
    if (!html) return null

    const domain = (() => {
        try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
    })()

    // Lightweight regex-based extraction — JSDOM is overkill for this. We
    // only need string content, not a real DOM.
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch ? stripTags(titleMatch[1]).trim() : ''

    const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)
    const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : ''

    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    const h1 = h1Match ? stripTags(h1Match[1]).trim() : ''

    const h2s: string[] = []
    const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi
    let m
    while ((m = h2Regex.exec(html)) !== null) {
        const h2 = stripTags(m[1]).trim()
        if (h2 && h2.length < 200) h2s.push(h2)
        if (h2s.length >= 12) break
    }

    // Strip scripts/styles + tags, count words on the remaining text
    const bodyText = html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    const wordCount = bodyText ? bodyText.split(/\s+/).length : 0

    return { rank, url, domain, title, metaDescription, h1, h2s, wordCount, fetchOk: true }
}

function stripTags(s: string): string {
    return String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
}
