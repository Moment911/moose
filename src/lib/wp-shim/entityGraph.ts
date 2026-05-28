import 'server-only'

// ── Wikidata entity resolution ──────────────────────────────────────────────
//
// Links a page's topic to its canonical Wikidata entity so AI engines + Google's
// Knowledge Graph can disambiguate WHAT the page is about (schema.org `about`
// with a Wikidata @id). Authoritative source, fetched live — this is a
// machine-readable entity hint, not a user-facing factual claim.
//
// Best-effort: returns null on any failure. Process-memory cached so repeated
// deploys of the same topic don't re-hit the API.

export interface WikidataEntity {
    id: string        // e.g. "Q189210"
    url: string       // e.g. "http://www.wikidata.org/entity/Q189210"
    label: string
    description?: string
}

const cache = new Map<string, WikidataEntity | null>()

export async function resolveWikidataEntity(query: string): Promise<WikidataEntity | null> {
    const q = String(query || '').trim()
    if (!q) return null
    const key = q.toLowerCase()
    if (cache.has(key)) return cache.get(key) ?? null

    try {
        const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&format=json&limit=1&origin=*`
        const res = await fetch(url, {
            signal: AbortSignal.timeout(4000),
            headers: { 'User-Agent': 'KotoIQ/1.0 (+https://hellokoto.com)' },
        })
        if (!res.ok) { cache.set(key, null); return null }
        const data: any = await res.json()
        const hit = Array.isArray(data?.search) ? data.search[0] : null
        if (!hit?.id) { cache.set(key, null); return null }
        const ent: WikidataEntity = {
            id: hit.id,
            url: `http://www.wikidata.org/entity/${hit.id}`,
            label: hit.label || q,
            ...(hit.description ? { description: hit.description } : {}),
        }
        cache.set(key, ent)
        return ent
    } catch {
        cache.set(key, null)
        return null
    }
}
