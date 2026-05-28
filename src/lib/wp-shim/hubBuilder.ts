import 'server-only'

// ── Pillar / hub page builder ───────────────────────────────────────────────
//
// Topical-authority architecture: a single "pillar" (hub) page per campaign
// links to every deployed city page (the spokes) and to sibling clusters
// (other campaigns' hubs on the same site). Spoke pages link back up via a
// BreadcrumbList in their schema (see tokenResolver.ts ctx.hub). This is the
// hub-and-spoke internal-linking pattern Google + AI engines use to understand
// topical coverage.
//
// Real-data-only (see _knowledge/data-integrity-standard.md): every link is a
// real deployed URL. The intro copy is a deterministic template (presentation,
// not data) — it states only true, computed facts (city count, state count).
// Nothing is AI-generated.

function escapeHtml(s: string): string {
    return String(s || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function slugify(s: string): string {
    return String(s || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
}

/** Deterministic hub title for a topic. Shared by the builder + the city-page
 *  breadcrumb (tokenResolver ctx.hub.title) so both agree without a stored column. */
export function hubTitle(topic: string): string {
    return `${topic} — Service Areas`
}

/** Deterministic hub slug for a topic, e.g. "website-design-service-areas". */
export function hubSlug(topic: string): string {
    return `${slugify(topic)}-service-areas` || 'service-areas'
}

export interface HubCity {
    city: string
    state_abbr?: string
    state?: string
    url: string
}

export interface HubBuildInput {
    topic: string
    companyName?: string
    origin: string                 // site origin, no trailing slash
    hubUrl: string                 // canonical URL of the hub page itself
    cities: HubCity[]              // every deployed city page (the spokes)
    relatedHubs?: Array<{ topic: string; url: string }> // sibling clusters on same site
}

export interface HubPage {
    title: string
    slug: string
    metaTitle: string
    metaDescription: string
    bodyHtml: string
    baseCss: string
    jsonLd: string
}

/**
 * Compose the pillar/hub page. Pure function — no IO. Groups city links by
 * state, appends a sibling-cluster section, and emits a CollectionPage +
 * BreadcrumbList + ItemList @graph.
 */
export function buildHubPage(input: HubBuildInput): HubPage {
    const title = hubTitle(input.topic)
    const slug = hubSlug(input.topic)

    // Group cities by state for a scannable, SEO-friendly index.
    const byState = new Map<string, HubCity[]>()
    for (const c of input.cities) {
        if (!c.url || !c.city) continue
        const key = (c.state_abbr || c.state || '').toUpperCase() || '—'
        const bucket = byState.get(key) || []
        bucket.push(c)
        byState.set(key, bucket)
    }
    const stateKeys = Array.from(byState.keys()).sort()
    const cityCount = input.cities.filter(c => c.url && c.city).length
    const stateCount = stateKeys.filter(k => k !== '—').length

    // ── Body HTML ──────────────────────────────────────────────────────────
    const parts: string[] = []
    parts.push(`<section class="koto-hub-hero">`)
    parts.push(`  <h1>${escapeHtml(title)}</h1>`)
    const stateClause = stateCount > 0 ? ` across ${stateCount} ${stateCount === 1 ? 'state' : 'states'}` : ''
    parts.push(`  <p class="koto-hub-sub">Browse every ${escapeHtml(input.topic)} location ${escapeHtml(input.companyName ? `${input.companyName} serves` : 'we serve')} — ${cityCount} ${cityCount === 1 ? 'area' : 'areas'}${stateClause}. Choose the page closest to you.</p>`)
    parts.push(`</section>`)

    parts.push(`<section class="koto-hub-locations">`)
    for (const sk of stateKeys) {
        const cities = (byState.get(sk) || []).slice().sort((a, b) => a.city.localeCompare(b.city))
        if (sk !== '—') parts.push(`  <h2>${escapeHtml(sk)}</h2>`)
        parts.push(`  <ul class="koto-hub-city-list">`)
        for (const c of cities) {
            const label = `${input.topic} in ${c.city}${c.state_abbr ? `, ${c.state_abbr}` : ''}`
            parts.push(`    <li><a href="${escapeHtml(c.url)}">${escapeHtml(label)}</a></li>`)
        }
        parts.push(`  </ul>`)
    }
    parts.push(`</section>`)

    // Sibling clusters — other campaigns' hubs on the same site.
    const related = (input.relatedHubs || []).filter(h => h.url && h.topic)
    if (related.length) {
        parts.push(`<section class="koto-hub-related">`)
        parts.push(`  <h2>Related services</h2>`)
        parts.push(`  <ul class="koto-hub-related-list">`)
        for (const h of related) {
            parts.push(`    <li><a href="${escapeHtml(h.url)}">${escapeHtml(h.topic)}</a></li>`)
        }
        parts.push(`  </ul>`)
        parts.push(`</section>`)
    }
    const bodyHtml = parts.join('\n')

    // ── Meta ─────────────────────────────────────────────────────────────────
    const metaTitle = `${input.topic} Service Areas${input.companyName ? ` | ${input.companyName}` : ''}`.slice(0, 65)
    const metaDescription = `Find the ${input.topic} page for your city. ${cityCount} ${cityCount === 1 ? 'location' : 'locations'}${stateCount > 0 ? ` across ${stateCount} ${stateCount === 1 ? 'state' : 'states'}` : ''}.`.slice(0, 160)

    // ── Schema @graph: CollectionPage + BreadcrumbList + ItemList ──────────────
    const breadcrumbItems: any[] = [
        { '@type': 'ListItem', position: 1, name: 'Home', item: input.origin },
        { '@type': 'ListItem', position: 2, name: title, item: input.hubUrl },
    ]
    const itemListElements = input.cities
        .filter(c => c.url && c.city)
        .map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: `${input.topic} in ${c.city}${c.state_abbr ? `, ${c.state_abbr}` : ''}`,
            url: c.url,
        }))
    const graph: any[] = [
        {
            '@type': 'CollectionPage',
            '@id': `${input.hubUrl}#webpage`,
            url: input.hubUrl,
            name: title,
            description: metaDescription,
        },
        {
            '@type': 'BreadcrumbList',
            '@id': `${input.hubUrl}#breadcrumb`,
            itemListElement: breadcrumbItems,
        },
        {
            '@type': 'ItemList',
            '@id': `${input.hubUrl}#locations`,
            name: `${input.topic} locations`,
            numberOfItems: itemListElements.length,
            itemListElement: itemListElements,
        },
    ]
    const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })

    // ── Base CSS (written to _kotoiq_base_css meta; plugin echoes in wp_head) ──
    const baseCss = `
.koto-hub-hero{max-width:920px;margin:0 auto 2rem;padding:2.5rem 1rem 1rem;text-align:center}
.koto-hub-hero h1{font-size:2rem;line-height:1.15;margin:0 0 .5rem;color:#0f172a}
.koto-hub-sub{font-size:1.05rem;color:#475569;max-width:680px;margin:0 auto}
.koto-hub-locations,.koto-hub-related{max-width:920px;margin:0 auto 2rem;padding:0 1rem}
.koto-hub-locations h2,.koto-hub-related h2{font-size:1.1rem;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:.35rem;margin:1.5rem 0 .75rem}
.koto-hub-city-list,.koto-hub-related-list{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.4rem .9rem}
.koto-hub-city-list a,.koto-hub-related-list a{color:#1d4ed8;text-decoration:none;font-size:.97rem}
.koto-hub-city-list a:hover,.koto-hub-related-list a:hover{text-decoration:underline}
`.trim()

    return { title, slug, metaTitle, metaDescription, bodyHtml, baseCss, jsonLd }
}
