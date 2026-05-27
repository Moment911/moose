// Token resolver for topic-campaign master documents.
//
// At publish time, the master document (full of [koto_city], [koto_phone],
// [koto_rotate]...[/koto_rotate] tokens) is run through this resolver
// once per target city. The output is final HTML with literal city text
// baked in — best SEO, zero render-time PHP cost.
//
// Resolution is deterministic per (city, section_index) so the same city
// always gets the same variant for the same section. This means re-deploys
// produce identical content (idempotent), and each city has a unique page
// without random per-visit drift.

import { createHash } from 'node:crypto'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LocationContext {
    city: string
    state: string
    stateAbbr: string
    zip?: string
    county?: string
    population?: number | string | null
    latitude?: number | null
    longitude?: number | null
}

export interface ResolveContext {
    location: LocationContext
    phone?: string // already formatted, e.g. "(512) 555-1234"
    companyName?: string
    /** Optional hero image URL — injected at top of hero HTML. */
    heroImageUrl?: string
    /** Optional hero video URL — injected at top of hero HTML (mp4/webm). Takes precedence over image. */
    heroVideoUrl?: string
    /** Alt text for hero image. Defaults to title. */
    heroImageAlt?: string
    /** Sibling cities to link from this page (internal linking).
     *  Each entry: { city, state_abbr, url } */
    siblingLinks?: Array<{ city: string; state_abbr?: string; url: string }>
    /** Optional seed for variant determinism. Defaults to `city|state`. */
    seed?: string
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolve all [koto_*] tokens in a string against the given context.
 *
 * Order matters:
 *   1. Resolve [koto_rotate]...[/koto_rotate] blocks first (variant picker)
 *   2. Then resolve scalar tokens ([koto_city], [koto_phone], etc.)
 * Doing 1 before 2 lets a rotation variant itself contain scalar tokens.
 */
export function resolveTokens(input: string, ctx: ResolveContext): string {
    if (!input) return ''
    const seed = ctx.seed ?? `${ctx.location.city}|${ctx.location.state}`
    let out = resolveRotateBlocks(input, seed)
    out = resolveScalarTokens(out, ctx)
    return out
}

/**
 * Render the title template with tokens resolved. Strips HTML.
 */
export function resolveTitle(template: string, ctx: ResolveContext): string {
    return stripHtml(resolveTokens(template, ctx)).trim()
}

/**
 * Build a URL-safe slug from a resolved title.
 */
export function buildSlug(title: string, ctx: ResolveContext): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || `page-${slugCity(ctx.location.city)}`
}

// ─── Internals ──────────────────────────────────────────────────────────────

/**
 * Replace every [koto_rotate ...]variants[/koto_rotate] block with one
 * variant chosen deterministically from the seed + the block's position.
 *
 * Variants are split on |||KOTO_VARIANT||| (matches the existing shim
 * shortcode convention from wp-plugin-kotoiq-shim/shortcodes/koto-rotate.php).
 *
 * Attrs on the opening tag (cache, section, pin) are accepted for backward
 * compat but ignored — the resolver doesn't cache (already at publish time)
 * and doesn't honor pin (the operator is targeting deterministic-per-city
 * variant selection, not QA pinning).
 */
function resolveRotateBlocks(input: string, seed: string): string {
    const RE = /\[koto_rotate(?:\s[^\]]*)?\]([\s\S]*?)\[\/koto_rotate\]/g
    let blockIndex = 0
    return input.replace(RE, (_match, inner: string) => {
        const variants = inner.split('|||KOTO_VARIANT|||').map(s => s.trim()).filter(s => s.length > 0)
        if (variants.length === 0) return ''
        if (variants.length === 1) return variants[0]
        const idx = pickIndex(seed, blockIndex++, variants.length)
        return variants[idx]
    })
}

/**
 * Deterministic variant picker: sha256(seed||index) mod N.
 * Cheap, stable, distributes well across small N.
 */
function pickIndex(seed: string, blockIndex: number, n: number): number {
    const h = createHash('sha256').update(`${seed}|${blockIndex}`).digest()
    // Use the first 4 bytes as an unsigned int
    const u32 = h.readUInt32BE(0)
    return u32 % n
}

/**
 * Replace [koto_city], [koto_phone], etc. with literal values.
 *
 * Each token is replaced globally. Unknown tokens are left alone so the
 * operator can spot them in preview.
 */
function resolveScalarTokens(input: string, ctx: ResolveContext): string {
    const { location: loc, phone, companyName } = ctx
    const map: Record<string, string> = {
        '[koto_city]': loc.city,
        '[koto_state]': loc.state,
        '[koto_state_abbr]': loc.stateAbbr,
        '[koto_zip]': loc.zip || '',
        '[koto_county]': loc.county || '',
        '[koto_population]': loc.population != null ? String(loc.population) : '',
        '[koto_phone]': phone || '',
        '[koto_phone_link]': phone ? `<a href="tel:${digits(phone)}">${escapeHtml(phone)}</a>` : '',
        '[koto_company_name]': companyName || '',
        '[koto_city_state]': loc.city && loc.state ? `${loc.city}, ${loc.state}` : loc.city,
        '[koto_city_state_abbr]': loc.city && loc.stateAbbr ? `${loc.city}, ${loc.stateAbbr}` : loc.city,
        '[koto_city_state_zip]': [loc.city, loc.state, loc.zip].filter(Boolean).join(', '),
    }
    let out = input
    for (const [token, value] of Object.entries(map)) {
        if (out.indexOf(token) === -1) continue
        out = out.split(token).join(value)
    }
    return out
}

function digits(s: string): string {
    return String(s || '').replace(/\D+/g, '')
}

function escapeHtml(s: string): string {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[c]!))
}

function stripHtml(s: string): string {
    return String(s || '').replace(/<[^>]+>/g, '')
}

function slugCity(city: string): string {
    return city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'city'
}

// ─── Master document → HTML ─────────────────────────────────────────────────

/**
 * Master document shape produced by topicCampaignGenerator.
 * Kept narrow so the schema is stable across edits.
 */
export interface TopicCampaignMaster {
    topic: string
    hero: {
        headline_variants: string[]
        subheadline_variants: string[]
    }
    sections: Array<{
        heading_template: string
        body_variants: string[]
    }>
    faqs: Array<{
        question_template: string
        answer_variants: string[]
    }>
    cta: {
        headline: string
        body: string
    }
    meta: {
        title_template: string
        description_template: string
    }
    schema_jsonld_template?: string
}

/**
 * Compose master + location into final HTML body + meta + schema.
 *
 * The HTML is semantic and self-contained — h1, h2, p, ul, etc. No inline
 * styles. Operators wrap with their own CSS if they paste a custom wrapper.
 */
export interface ResolvedPage {
    title: string
    slug: string
    metaTitle: string
    metaDescription: string
    bodyHtml: string
    jsonLd: string | null
}

export function resolveMaster(
    master: TopicCampaignMaster,
    ctx: ResolveContext,
    customWrapper?: string,
): ResolvedPage {
    const heroHeadline = resolveOne(master.hero.headline_variants, ctx, 'hero-headline')
    const heroSub = resolveOne(master.hero.subheadline_variants, ctx, 'hero-sub')

    const sectionHtml = master.sections
        .map((s, i) => {
            const heading = resolveTokens(s.heading_template, ctx)
            const body = resolveOne(s.body_variants, ctx, `section-${i}`)
            return `<section>\n  <h2>${escapeHtml(stripHtml(heading))}</h2>\n  <div>${ensureParagraphs(body)}</div>\n</section>`
        })
        .join('\n')

    const faqsHtml = master.faqs.length
        ? `<section class="koto-faq">\n  <h2>Frequently Asked Questions</h2>\n  <div class="koto-faq-list">\n${master.faqs
            .map((f, i) => {
                const q = resolveTokens(f.question_template, ctx)
                const a = resolveOne(f.answer_variants, ctx, `faq-${i}`)
                return `    <details class="koto-faq-item">\n      <summary>${escapeHtml(stripHtml(q))}</summary>\n      <div>${ensureParagraphs(a)}</div>\n    </details>`
            })
            .join('\n')}\n  </div>\n</section>`
        : ''

    const cta = resolveTokens(master.cta.body, ctx)
    const ctaHeadline = resolveTokens(master.cta.headline, ctx)
    const ctaHtml = `<section class="koto-cta">\n  <h2>${escapeHtml(stripHtml(ctaHeadline))}</h2>\n  <div>${ensureParagraphs(cta)}</div>\n</section>`

    const title = stripHtml(heroHeadline).trim()

    // Hero media block — video takes precedence over image. Stays empty if
    // neither is provided.
    const heroMediaHtml = ctx.heroVideoUrl
        ? `<div class="koto-hero-media"><video controls preload="metadata" playsinline src="${escapeHtml(ctx.heroVideoUrl)}"></video></div>`
        : ctx.heroImageUrl
        ? `<div class="koto-hero-media"><img src="${escapeHtml(ctx.heroImageUrl)}" alt="${escapeHtml(ctx.heroImageAlt || title)}" loading="eager"/></div>`
        : ''

    // Internal linking — render a "Service areas" block listing the OTHER
    // cities in the same campaign. Each city links to its slug.
    const siblings = (ctx.siblingLinks || []).filter(s => s.city !== ctx.location.city)
    const serviceAreasHtml = siblings.length
        ? `<section class="koto-service-areas">\n  <h2>Service Areas</h2>\n  <p>We also serve nearby cities:</p>\n  <ul>\n${siblings.map(s => `    <li><a href="${escapeHtml(s.url)}">${escapeHtml(s.city)}${s.state_abbr ? `, ${escapeHtml(s.state_abbr)}` : ''}</a></li>`).join('\n')}\n  </ul>\n</section>`
        : ''

    // Compose body
    const bodyHtml = customWrapper
        ? customWrapper
            .replace(/\{\{HERO_HEADLINE\}\}/g, escapeHtml(stripHtml(heroHeadline)))
            .replace(/\{\{HERO_SUB\}\}/g, ensureParagraphs(heroSub))
            .replace(/\{\{HERO_MEDIA\}\}/g, heroMediaHtml)
            .replace(/\{\{SECTIONS\}\}/g, sectionHtml)
            .replace(/\{\{FAQS\}\}/g, faqsHtml)
            .replace(/\{\{CTA\}\}/g, ctaHtml)
            .replace(/\{\{SERVICE_AREAS\}\}/g, serviceAreasHtml)
        : [
            `<header class="koto-hero">${heroMediaHtml ? '\n  ' + heroMediaHtml : ''}\n  <h1>${escapeHtml(stripHtml(heroHeadline))}</h1>\n  <div class="koto-hero-sub">${ensureParagraphs(heroSub)}</div>\n</header>`,
            sectionHtml,
            faqsHtml,
            ctaHtml,
            serviceAreasHtml,
        ].filter(Boolean).join('\n')

    const metaTitle = resolveTitle(master.meta.title_template, ctx)
    const metaDescription = resolveTokens(master.meta.description_template, ctx)

    // JSON-LD — caller passes the master template; we substitute tokens then
    // attempt to keep it as compact JSON. If invalid JSON, return as-is so
    // the operator can debug.
    let jsonLd: string | null = null
    if (master.schema_jsonld_template) {
        const resolved = resolveTokens(master.schema_jsonld_template, ctx)
        try {
            jsonLd = JSON.stringify(JSON.parse(resolved))
        } catch {
            jsonLd = resolved
        }
    }

    return {
        title,
        slug: buildSlug(title, ctx),
        metaTitle,
        metaDescription: stripHtml(metaDescription).trim(),
        bodyHtml,
        jsonLd,
    }
}

function resolveOne(variants: string[], ctx: ResolveContext, sectionKey: string): string {
    if (!variants || variants.length === 0) return ''
    const seed = ctx.seed ?? `${ctx.location.city}|${ctx.location.state}`
    const idx = pickIndex(`${seed}|${sectionKey}`, 0, variants.length)
    return resolveTokens(variants[idx], ctx)
}

function ensureParagraphs(html: string): string {
    // If the content already contains block tags, return as-is. Otherwise
    // wrap each non-empty line in <p>.
    if (/<(?:p|h[1-6]|ul|ol|div|section|article|table|blockquote|details)\b/i.test(html)) {
        return html
    }
    return html
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => `<p>${p}</p>`)
        .join('\n')
}
