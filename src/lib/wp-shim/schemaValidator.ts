import 'server-only'

// ── JSON-LD validator ───────────────────────────────────────────────────────
//
// Pre-publish sanity check for the @graph that tokenResolver emits. Catches the
// failure modes that actually happen with token-resolved schema: invalid JSON
// (a stray unescaped quote from a token), nodes missing @type, and required
// properties that came out empty after token substitution. Returns hard errors
// (block writing the schema) + soft warnings (surface, don't block).
//
// Deliberately local + rule-based — no external API. Mirrors the subset of
// schema.org Google actually rewards for local + AEO.

export interface SchemaReport {
    ok: boolean
    errors: string[]
    warnings: string[]
    types: string[]
}

function typeOf(node: any): string[] {
    const t = node?.['@type']
    if (!t) return []
    return Array.isArray(t) ? t.map(String) : [String(t)]
}

const isNonEmpty = (v: any) => typeof v === 'string' ? v.trim().length > 0 : v != null && !(Array.isArray(v) && v.length === 0)

export function validateJsonLd(jsonLd: string | null | undefined): SchemaReport {
    const errors: string[] = []
    const warnings: string[] = []
    if (!jsonLd || !jsonLd.trim()) {
        return { ok: false, errors: ['no JSON-LD emitted'], warnings: [], types: [] }
    }

    let parsed: any
    try {
        parsed = JSON.parse(jsonLd)
    } catch (e: any) {
        return { ok: false, errors: [`invalid JSON: ${String(e?.message || e)}`], warnings: [], types: [] }
    }

    if (!parsed['@context']) warnings.push('missing @context (should be https://schema.org)')
    let graph: any[]
    if (Array.isArray(parsed['@graph'])) graph = parsed['@graph']
    else if (Array.isArray(parsed)) graph = parsed
    else graph = [parsed]

    const types = new Set<string>()
    graph.forEach((node, i) => {
        const tlist = typeOf(node)
        if (tlist.length === 0) { errors.push(`@graph[${i}] has no @type`); return }
        tlist.forEach(t => types.add(t))
        const has = (k: string) => isNonEmpty(node?.[k])

        for (const t of tlist) {
            switch (t) {
                case 'LocalBusiness':
                    if (!has('name')) errors.push('LocalBusiness missing name')
                    if (!has('telephone')) warnings.push('LocalBusiness has no telephone')
                    if (!has('address') && !has('areaServed')) warnings.push('LocalBusiness has no address or areaServed')
                    break
                case 'WebPage':
                    if (!has('name')) warnings.push('WebPage missing name')
                    if (!has('url')) warnings.push('WebPage has no url (no canonical for @id linking)')
                    break
                case 'FAQPage': {
                    const me = node.mainEntity
                    if (!Array.isArray(me) || me.length === 0) errors.push('FAQPage has no mainEntity questions')
                    else {
                        const bad = me.filter((q: any) => !isNonEmpty(q?.name) || !isNonEmpty(q?.acceptedAnswer?.text))
                        if (bad.length) warnings.push(`FAQPage has ${bad.length} question(s) missing text/answer`)
                    }
                    break
                }
                case 'Review':
                    if (!has('reviewBody')) warnings.push('Review missing reviewBody')
                    if (!isNonEmpty(node?.author?.name)) warnings.push('Review missing author')
                    break
                case 'AggregateRating':
                    if (node?.ratingValue == null || node?.reviewCount == null) errors.push('AggregateRating missing ratingValue/reviewCount')
                    break
                case 'HowTo':
                    if (!Array.isArray(node?.step) || node.step.length === 0) warnings.push('HowTo has no steps')
                    break
                case 'Service':
                    if (!has('name')) warnings.push('Service missing name')
                    break
                case 'Person':
                    if (!has('name')) warnings.push('Person (author) missing name')
                    break
                case 'Dataset':
                    if (!has('name')) warnings.push('Dataset missing name')
                    break
            }
        }
    })

    return { ok: errors.length === 0, errors, warnings, types: [...types] }
}
