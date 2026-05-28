import 'server-only'

// ── AI-citation tracking ────────────────────────────────────────────────────
//
// For a campaign's deployed cities, query "{topic} in {city}" and check whether
// the site's pages are (a) cited in Google's AI Overview and (b) ranking in the
// classic organic results. This is the AEO equivalent of rank tracking — proof
// that the pages are winning AI-answer citations, not just blue links.
//
// Uses the existing DataForSEO SERP wrapper (ai_overview.sources). Best-effort
// per city; one SERP call each, capped by sampleSize.

import { getSERPResults } from '@/lib/dataforseo'

export interface CitationCheck {
    city: string
    state?: string
    query: string
    aiOverviewPresent: boolean
    citedInAi: boolean
    citedUrl?: string
    organicRank: number | null
}

export interface CitationReport {
    domain: string
    citiesChecked: number
    aiOverviewCount: number   // cities where an AI Overview showed at all
    citedCount: number        // cities where our domain is cited IN the AI Overview
    organicTop10: number      // cities where we rank in classic organic top 10
    checks: CitationCheck[]
    checkedAt: string
}

const norm = (d: string) => String(d || '').toLowerCase().replace(/^www\./, '').trim()

export async function checkCitations(opts: {
    topic: string
    domain: string
    locations: { city: string; state?: string }[]
    sampleSize?: number
}): Promise<CitationReport> {
    const domain = norm(opts.domain)
    const sample = opts.locations.slice(0, opts.sampleSize ?? 8)
    const checks: CitationCheck[] = []

    for (const loc of sample) {
        const query = `${opts.topic} in ${loc.city}${loc.state ? `, ${loc.state}` : ''}`
        const location = `${loc.city}${loc.state ? `, ${loc.state}` : ''}, United States`
        try {
            const serp = await getSERPResults(query, location)
            const ai = serp.ai_overview
            const aiOverviewPresent = !!ai?.present

            let citedInAi = false
            let citedUrl: string | undefined
            if (ai?.sources?.length) {
                const hit = ai.sources.find(s => {
                    const sd = norm(s.domain)
                    return sd === domain || sd.endsWith('.' + domain)
                })
                if (hit) { citedInAi = true; citedUrl = hit.url }
            }

            const organic = (serp.items || []).find(it =>
                it.type === 'organic' && (norm(it.domain) === domain || norm(it.domain).endsWith('.' + domain)),
            )
            const organicRank = organic ? (organic.rank_absolute || null) : null

            checks.push({ city: loc.city, state: loc.state, query, aiOverviewPresent, citedInAi, citedUrl, organicRank })
        } catch {
            checks.push({ city: loc.city, state: loc.state, query, aiOverviewPresent: false, citedInAi: false, organicRank: null })
        }
    }

    return {
        domain,
        citiesChecked: checks.length,
        aiOverviewCount: checks.filter(c => c.aiOverviewPresent).length,
        citedCount: checks.filter(c => c.citedInAi).length,
        organicTop10: checks.filter(c => c.organicRank != null && (c.organicRank as number) <= 10).length,
        checks,
        checkedAt: new Date().toISOString(),
    }
}
