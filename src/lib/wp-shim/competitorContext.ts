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
