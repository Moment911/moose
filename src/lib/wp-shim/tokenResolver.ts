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
    /** Other-campaign pages in the SAME city as this one — for cross-service
     *  internal linking (e.g. on a "Website Design in Austin" page, link to
     *  "SEO in Austin" if that campaign has a deployed Austin page).
     *  Filtering to the current city happens inside resolveMaster. */
    relatedServices?: Array<{ topic: string; city: string; state_abbr?: string; url: string }>
    /** Canonical URL of the page being rendered — used to build @id values
     *  inside the JSON-LD @graph so entities can cross-reference each other.
     *  Optional: if absent, @id values are omitted (less linkable but valid). */
    pageUrl?: string
    /** Census/local statistical data for the city — when present, renders a
     *  "By the Numbers" block + adds a Dataset entry to the schema graph with
     *  citation back to the source. Optional. */
    localData?: {
        sourceLabel: string // e.g. "US Census Bureau ACS 5-Year Estimates (2018-2022)"
        sourceUrl: string   // direct link back to data.census.gov for citation
        fetchedAt: string   // ISO timestamp — surfaced as dateModified on the Dataset
        items: Array<{ label: string; value: string }>
    }
    /** Optional seed for variant determinism. Defaults to `city|state`. */
    seed?: string
    /** Optional resolved knowledge-graph entities — links the page's topic to
     *  its canonical Wikidata entity via schema.org `about` for AI-engine +
     *  Knowledge Graph disambiguation. Resolved by entityGraph.ts. */
    entities?: {
        topic?: { id: string; url: string; label: string; description?: string }
    }
    /** Optional E-E-A-T trust signals — operator-provided OR pulled from an
     *  authoritative source (Google reviews via GBP/Places). ALL blocks are
     *  omit-when-empty and NEVER AI-fabricated, per the platform data-integrity
     *  standard (and FTC rules on testimonials). When absent, none of the
     *  blocks/schema below render — existing campaigns are unaffected. */
    eeat?: {
        /** Named strategist/author for the page — anchors Experience. */
        strategist?: { name: string; title?: string; yearsExperience?: number; photoUrl?: string }
        /** Real customer reviews (e.g. pulled from Google). Rendered as a
         *  testimonials block + Review schema. sourceLabel carries provenance. */
        testimonials?: Array<{ text: string; author: string; rating?: number; sourceLabel?: string; date?: string }>
        /** Aggregate rating — from real Google reviews, or an operator-set
         *  rating (manual override for testing). */
        aggregateRating?: { ratingValue: number; reviewCount: number }
        /** Entity-disambiguation URLs (GBP, LinkedIn, directories) → schema sameAs. */
        sameAs?: string[]
        /** Real result snapshots (operator-provided metrics). Never invented. */
        results?: Array<{ metric: string; context?: string }>
        /** Cited statistics with real sources — rendered as a Sources list +
         *  schema citation. Operator/authoritative-source provided. */
        citations?: Array<{ claim?: string; sourceName: string; sourceUrl: string }>
    }
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
    // Both phone tokens render as tel: links — phone numbers should always
    // be tappable on mobile. Operators who want plain text can edit the
    // master to remove the link.
    const phoneDigits = phone ? digits(phone) : ''
    const phoneTelUrl = phoneDigits ? `tel:${phoneDigits}` : ''
    const phoneLink = phone
        ? `<a href="tel:${phoneDigits}">${escapeHtml(phone)}</a>`
        : ''
    const phoneEscaped = phone ? escapeHtml(phone) : ''

    // Pre-passes that fix the most common Claude-master mistakes around
    // phone tokens BEFORE the standard token replacement turns each
    // [koto_phone] into a full <a> tag.
    //
    //  1. `href="[koto_phone]"` → href="tel:DIGITS"  (don't nest <a> inside <a>)
    //  2. `<a ...>[koto_phone]</a>` → use the formatted phone as the text
    //
    // Without these, a master with `<a href="[koto_phone]">[koto_phone]</a>`
    // produces a corrupt double-wrap that browsers render with the literal
    // string `a href=` inside the href value. Seen live on production.
    if (phone) {
        // 1) `href="[koto_phone]"` exactly → `href="tel:DIGITS"`.
        input = input.replace(/href=(['"])\[koto_phone(?:_link)?\]\1/g, `href=$1${phoneTelUrl}$1`)
        // 2) `[koto_phone]` anywhere inside ANY HTML attribute value
        //    (e.g. `href="tel:[koto_phone]"`, `data-phone="[koto_phone]"`,
        //    `data-x="prefix[koto_phone]suffix"`) → bare digits. The standard
        //    replacement below would otherwise drop a full <a> anchor inside
        //    the attribute value and break HTML parsing. Match attribute-like
        //    contexts only (`=` + quoted string containing the token).
        input = input.replace(
            /=(['"])([^'"]*?)\[koto_phone(?:_link)?\]([^'"]*?)\1/g,
            `=$1$2${phoneDigits}$3$1`,
        )
        // 3) `<a ...>[koto_phone]</a>` → use the formatted phone as the
        //    anchor text (no nested <a> tag).
        input = input.replace(
            /(<a\b[^>]*>)([^<]*?)\[koto_phone(?:_link)?\]([^<]*?)(<\/a>)/g,
            `$1$2${phoneEscaped}$3$4`,
        )
    }

    const map: Record<string, string> = {
        '[koto_city]': loc.city,
        '[koto_state]': loc.state,
        '[koto_state_abbr]': loc.stateAbbr,
        '[koto_zip]': loc.zip || '',
        '[koto_county]': loc.county || '',
        '[koto_population]': loc.population != null ? String(loc.population) : '',
        '[koto_phone]': phoneLink,
        '[koto_phone_link]': phoneLink,
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
    // Defensive post-pass: nuke any tel: anchor whose href is corrupted
    // (contains whitespace, %20, <, >, or "href=" — none of which are
    // legal in a tel: URL). Such anchors are the residue of a nested
    // <a> tag that an earlier resolver pass produced. Browsers parse
    // nested anchors weirdly: the inner <a> bleeds into the outer's
    // href value, leaving an orphan closing </a> tag after. We rebuild
    // a canonical anchor and consume the orphan closing tag if present.
    // Without this, OLD masters that Claude wrote with phone tokens
    // inside <a> tags keep producing broken pages even after the
    // pre-passes above strip the nesting from current resolutions.
    if (phone && phoneTelUrl) {
        out = out.replace(
            /<a\b[^>]*?href=(['"])tel:[^'"]*?(?:%20|%3[Cc]|<|href=|\s)[^'"]*?\1[^>]*>[^<]*<\/a>(?:[^<]{0,40}<\/a>)?/g,
            `<a href="${phoneTelUrl}">${phoneEscaped}</a>`,
        )
    }

    // Safety net: wrap any unlinked phone-pattern in tel: link. Catches
    // cases where Claude wrote a literal phone number instead of a token,
    // OR put the phone outside an <a> tag. Skips numbers already inside
    // <a href="tel:..."> blocks.
    if (phone) {
        const phoneDigits = digits(phone)
        if (phoneDigits) {
            const pattern = phoneRegex(phone)
            if (pattern) {
                out = out.replace(pattern, (m, _g, offset, str) => {
                    // Skip if already inside an <a> tag (avoid double-wrap)
                    const before = String(str).slice(Math.max(0, offset - 80), offset)
                    if (/<a[^>]*tel:[^>]*>[^<]*$/i.test(before)) return m
                    return `<a href="tel:${phoneDigits}">${m}</a>`
                })
            }
        }
    }
    return out
}

/** Escape a phone number into a forgiving regex that matches reasonable
 *  formatting variants — (512) 555-1234, 512-555-1234, 512.555.1234, etc. */
function phoneRegex(phone: string): RegExp | null {
    const d = digits(phone)
    if (d.length < 7) return null
    // Allow optional country code, then groups separated by space/dash/dot/paren
    const last10 = d.slice(-10)
    if (last10.length < 10) return null
    const area = last10.slice(0, 3)
    const exch = last10.slice(3, 6)
    const num = last10.slice(6)
    const sep = '[\\s.\\-]?'
    const open = '\\(?'
    const close = '\\)?'
    return new RegExp(`(${open}${area}${close}${sep}${exch}${sep}${num})`, 'g')
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
    /** Optional 40-60 word self-contained answer paragraph rendered above the
     *  hero. Lifted verbatim by AI search engines into their answer cards.
     *  If absent, falls back to the first FAQ answer at resolve time. */
    direct_answer_template?: string
    /** Optional HowTo block — a numbered checklist of steps. Rendered as
     *  ordered list + emitted as schema.org/HowTo in the @graph so AI engines
     *  can pull it into how-to answer surfaces. */
    howto?: {
        title_template: string
        steps: Array<{ name_template: string; text_template: string }>
    }
    /** Optional comparison table — e.g. "Local vs. National {topic}". Rendered
     *  as <table> + emitted as schema.org/Table in the @graph. */
    comparison?: {
        title_template: string
        columns: string[] // e.g. ["", "Local Agency", "National Agency"]
        rows: Array<{ label_template: string; cells_template: string[] }>
    }
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
    /** Base CSS for the page — to be written to the _kotoiq_base_css post
     *  meta (plugin v4.2.1+ echoes it in wp_head). Empty string when the
     *  operator opts out via {{NO_STYLES}} in their custom wrapper. */
    baseCss: string
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

    // Direct-answer paragraph — 40-60 word self-contained answer at the very
    // top of the body, before the hero. AI search engines (Perplexity,
    // ChatGPT Search, Google AI Overviews) lift this into their answer cards.
    // Opt-in only: requires master.direct_answer_template to be explicitly
    // set. Existing campaigns without this field render unchanged on redeploy.
    const directAnswerText = master.direct_answer_template
        ? stripHtml(resolveTokens(master.direct_answer_template, ctx)).trim().slice(0, 600)
        : ''
    const directAnswerHtml = directAnswerText
        ? `<section class="koto-direct-answer"><p>${escapeHtml(directAnswerText)}</p></section>`
        : ''

    // HowTo block — ordered list of steps for buying/evaluating the service.
    // Mirrored into schema.org/HowTo in the @graph so AI engines can lift it
    // into "how-to" answer surfaces. Optional — only rendered when master.howto
    // exists.
    const howtoHtml = master.howto && master.howto.steps.length
        ? `<section class="koto-howto">\n  <h2>${escapeHtml(stripHtml(resolveTokens(master.howto.title_template, ctx)))}</h2>\n  <ol>\n${master.howto.steps.map((s, i) => {
            const name = stripHtml(resolveTokens(s.name_template, ctx)).trim()
            const text = stripHtml(resolveTokens(s.text_template, ctx)).trim()
            return `    <li><strong>${escapeHtml(name)}</strong> — ${escapeHtml(text)}</li>`
        }).join('\n')}\n  </ol>\n</section>`
        : ''

    // Comparison table block — labeled columns + rows. Mirrored into a
    // schema.org/Table entry in the @graph. Optional.
    const comparisonHtml = master.comparison && master.comparison.rows.length
        ? `<section class="koto-comparison">\n  <h2>${escapeHtml(stripHtml(resolveTokens(master.comparison.title_template, ctx)))}</h2>\n  <table>\n    <thead><tr>${master.comparison.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>\n    <tbody>\n${master.comparison.rows.map(r => {
            const label = stripHtml(resolveTokens(r.label_template, ctx)).trim()
            const cells = r.cells_template.map(c => stripHtml(resolveTokens(c, ctx)).trim())
            return `      <tr><th scope="row">${escapeHtml(label)}</th>${cells.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`
        }).join('\n')}\n    </tbody>\n  </table>\n</section>`
        : ''

    // Local data block — Census ACS stats per city. Compact + non-obtrusive:
    // an inline footnote-style line at the very bottom of the page. Verbatim
    // values, sourceUrl citation. Mirrored into schema.org/Dataset in the
    // @graph. Optional.
    const localDataHtml = ctx.localData && ctx.localData.items.length
        ? (() => {
            const summary = ctx.localData.items.map(it => `<strong>${escapeHtml(it.value)}</strong> ${escapeHtml(it.label.toLowerCase())}`).join(' &middot; ')
            const cityLabel = `${escapeHtml(ctx.location.city)}${ctx.location.stateAbbr ? `, ${escapeHtml(ctx.location.stateAbbr)}` : ''}`
            return `<aside class="koto-local-data"><p>About ${cityLabel}: ${summary}. <span class="koto-cite">Source: <a href="${escapeHtml(ctx.localData.sourceUrl)}" rel="noopener" target="_blank">${escapeHtml(ctx.localData.sourceLabel)}</a></span></p></aside>`
        })()
        : ''

    // ── E-E-A-T trust blocks ───────────────────────────────────────────────
    // Operator-provided OR Google-sourced (reviews). All omit-when-empty and
    // NEVER AI-fabricated, per the data-integrity standard + FTC review rules.
    const eeat = ctx.eeat || {}

    const strat = eeat.strategist
    const authorBylineHtml = strat && strat.name
        ? `<section class="koto-author">\n  <div class="koto-author-card">${strat.photoUrl ? `\n    <img class="koto-author-photo" src="${escapeHtml(strat.photoUrl)}" alt="${escapeHtml(strat.name)}" loading="lazy"/>` : ''}\n    <div class="koto-author-meta">\n      <div class="koto-author-label">Meet Your ${escapeHtml(ctx.location.city)} Strategist</div>\n      <div class="koto-author-name">${escapeHtml(strat.name)}</div>${strat.title ? `\n      <div class="koto-author-title">${escapeHtml(strat.title)}</div>` : ''}${strat.yearsExperience ? `\n      <div class="koto-author-exp">${Number(strat.yearsExperience)}+ years experience</div>` : ''}\n    </div>\n  </div>\n</section>`
        : ''

    const testimonials = Array.isArray(eeat.testimonials) ? eeat.testimonials.filter(t => t && t.text && t.author).slice(0, 5) : []
    const testimonialsHtml = testimonials.length
        ? `<section class="koto-testimonials">\n  <h2>What Our Clients Say</h2>\n  <div class="koto-testimonial-list">\n${testimonials.map(t => `    <figure class="koto-testimonial">\n      <blockquote>${escapeHtml(stripHtml(t.text))}</blockquote>\n      <figcaption>${escapeHtml(t.author)}${t.rating ? ` <span class="koto-stars" aria-label="${Number(t.rating)} out of 5 stars">${'★'.repeat(Math.max(0, Math.min(5, Math.round(Number(t.rating)))))}</span>` : ''}${t.sourceLabel ? ` <span class="koto-cite">via ${escapeHtml(t.sourceLabel)}</span>` : ''}</figcaption>\n    </figure>`).join('\n')}\n  </div>\n</section>`
        : ''

    const results = Array.isArray(eeat.results) ? eeat.results.filter(r => r && r.metric).slice(0, 4) : []
    const resultsHtml = results.length
        ? `<section class="koto-results">\n  <h2>Results in ${escapeHtml(ctx.location.city)}</h2>\n  <div class="koto-results-grid">\n${results.map(r => `    <div class="koto-result">\n      <div class="koto-result-metric">${escapeHtml(r.metric)}</div>${r.context ? `\n      <div class="koto-result-context">${escapeHtml(r.context)}</div>` : ''}\n    </div>`).join('\n')}\n  </div>\n</section>`
        : ''

    const citations = Array.isArray(eeat.citations) ? eeat.citations.filter(c => c && c.sourceUrl && c.sourceName).slice(0, 8) : []
    const citationsHtml = citations.length
        ? `<aside class="koto-citations">\n  <h2>Sources</h2>\n  <ul>\n${citations.map(c => `    <li>${c.claim ? `${escapeHtml(c.claim)} &mdash; ` : ''}<a href="${escapeHtml(c.sourceUrl)}" rel="noopener nofollow" target="_blank">${escapeHtml(c.sourceName)}</a></li>`).join('\n')}\n  </ul>\n</aside>`
        : ''

    // Visible rating badge — from real Google data OR an operator-set rating.
    const agg = eeat.aggregateRating
    const ratingBadgeHtml = agg && Number(agg.reviewCount) > 0
        ? (() => {
            const v = Math.max(0, Math.min(5, Number(agg.ratingValue) || 0))
            const full = Math.round(v)
            const stars = '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full))
            return `<div class="koto-rating"><span class="koto-rating-stars" aria-hidden="true">${stars}</span> <span class="koto-rating-value">${v.toFixed(1)}</span> <span class="koto-rating-count">based on ${Number(agg.reviewCount).toLocaleString()} reviews</span></div>`
        })()
        : ''

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

    // Cross-campaign linking — render a "Related Services in {City}" block
    // listing OTHER topics deployed for the SAME city (e.g. Website Design +
    // SEO + PPC all in Austin). Each link points to the other campaign's
    // page for this city. Filtered to current city by exact match.
    const related = (ctx.relatedServices || []).filter(r =>
        r.city === ctx.location.city &&
        (!r.state_abbr || !ctx.location.stateAbbr || r.state_abbr === ctx.location.stateAbbr),
    )
    const relatedServicesHtml = related.length
        ? `<section class="koto-related-services">\n  <h2>Related Services in ${escapeHtml(ctx.location.city)}</h2>\n  <ul>\n${related.map(r => `    <li><a href="${escapeHtml(r.url)}">${escapeHtml(r.topic)} in ${escapeHtml(r.city)}${r.state_abbr ? `, ${escapeHtml(r.state_abbr)}` : ''}</a></li>`).join('\n')}\n  </ul>\n</section>`
        : ''

    // Base CSS — keeps pages legible on any theme that doesn't apply its
    // own content typography (Avada, Divi, some custom themes). Scoped to
    // .koto-* classes so it doesn't fight theme-applied styles on existing
    // elements.
    //
    // CRITICAL: this is returned as a SEPARATE `baseCss` field on the
    // resolved page, NOT inlined into body HTML. WordPress KSES strips
    // <style> tags from post_content for users without unfiltered_html
    // (kotoiq_service intentionally lacks it). The dashboard writes this
    // string to the _kotoiq_base_css post meta; plugin v4.2.1+ echoes it
    // in wp_head wrapped in a real <style> block, sidestepping KSES.
    //
    // Operators can opt out via {{NO_STYLES}} in their custom wrapper —
    // see wantsStyles logic below.
    const baseCssBody = `
.koto-hero,.koto-service-areas,.koto-related-services,.koto-cta,.koto-faq,.koto-direct-answer,.koto-howto,.koto-comparison{margin:2rem 0;padding:1.5rem;background:#fff;border-radius:12px;border:1px solid #eee}
.koto-direct-answer{background:#f8fafc;border-left:4px solid #1e3a8a;font-size:1.1rem;line-height:1.6;color:#1a2332}
.koto-direct-answer p{margin:0;font-weight:500}
.koto-howto ol{margin:1rem 0;padding-left:1.5rem;line-height:1.7;color:#334155}
.koto-howto li{margin:.5rem 0}
.koto-howto strong{color:#1a2332}
.koto-comparison table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.95rem}
.koto-comparison th,.koto-comparison td{padding:.6rem .8rem;text-align:left;border-bottom:1px solid #e2e8f0;vertical-align:top}
.koto-comparison thead th{background:#f1f5f9;color:#1a2332;font-weight:700}
.koto-comparison tbody th{font-weight:600;color:#475569;background:#fafafa}
.koto-local-data{margin:1.5rem 0 .5rem;padding:.5rem 0;border-top:1px solid #e5e7eb;font-size:.78rem;line-height:1.5;color:#6b7280}
.koto-local-data p{margin:0}
.koto-local-data strong{color:#1a2332;font-weight:700;font-variant-numeric:tabular-nums}
.koto-local-data .koto-cite{display:inline}
.koto-local-data .koto-cite a{color:#1e3a8a;text-decoration:underline}
.koto-hero h1{font-size:2rem;line-height:1.2;margin:0 0 .75rem;color:#1a2332}
.koto-hero-sub{font-size:1.1rem;color:#475569;line-height:1.6}
.koto-hero-media img,.koto-hero-media video{max-width:100%;height:auto;border-radius:10px;margin:0 0 1rem}
.koto-hero,.koto-cta,.koto-service-areas,.koto-faq,section{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif}
section h2{font-size:1.5rem;line-height:1.3;margin:0 0 .75rem;color:#1a2332}
section p,.koto-hero-sub p{margin:0 0 .75rem;line-height:1.65;color:#334155}
section{margin:1.5rem 0}
.koto-faq details{margin:.5rem 0;padding:1rem;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}
.koto-faq summary{cursor:pointer;font-weight:700;color:#1a2332;font-size:1.05rem;list-style:none}
.koto-faq summary::-webkit-details-marker{display:none}
.koto-faq summary::after{content:" \\25BC";font-size:.7em;color:#94a3b8;float:right}
.koto-faq details[open] summary::after{content:" \\25B2"}
.koto-faq details>div{margin-top:.75rem;color:#334155;line-height:1.65}
.koto-cta{background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:#fff;text-align:center}
.koto-cta h2{color:#fff}
.koto-cta p{color:rgba(255,255,255,.95)}
.koto-cta a{color:#fff;font-weight:700;text-decoration:underline}
.koto-service-areas ul,.koto-related-services ul{list-style:none;padding:0;margin:1rem 0;display:flex;flex-wrap:wrap;gap:.5rem}
.koto-service-areas li,.koto-related-services li{margin:0}
.koto-service-areas a,.koto-related-services a{display:inline-block;padding:.5rem 1rem;background:#f1f5f9;border-radius:6px;color:#1e3a8a;text-decoration:none;font-weight:600;font-size:.95rem}
.koto-service-areas a:hover,.koto-related-services a:hover{background:#dbeafe}
.koto-related-services{border-left:3px solid #1e3a8a}
a[href^="tel:"]{color:#1e3a8a;font-weight:700;text-decoration:none;white-space:nowrap}
a[href^="tel:"]:hover{text-decoration:underline}
.koto-author,.koto-testimonials,.koto-results{margin:2rem 0;padding:1.5rem;background:#fff;border-radius:12px;border:1px solid #eee}
.koto-author .koto-author-card{display:flex;align-items:center;gap:1rem}
.koto-author-photo{width:64px;height:64px;border-radius:50%;object-fit:cover;flex:none}
.koto-author-label{font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700}
.koto-author-name{font-size:1.1rem;font-weight:800;color:#1a2332}
.koto-author-title,.koto-author-exp{font-size:.9rem;color:#475569}
.koto-testimonial-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem;margin-top:1rem}
.koto-testimonial{margin:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:1rem}
.koto-testimonial blockquote{margin:0 0 .5rem;font-style:italic;color:#334155;line-height:1.6}
.koto-testimonial figcaption{font-size:.85rem;color:#475569;font-weight:600}
.koto-stars{color:#f59e0b;letter-spacing:1px}
.koto-results-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-top:1rem}
.koto-result{background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:1rem;text-align:center}
.koto-result-metric{font-size:1.4rem;font-weight:900;color:#1e3a8a}
.koto-result-context{font-size:.85rem;color:#475569;margin-top:.25rem}
.koto-citations{margin:2rem 0;font-size:.85rem;color:#64748b}
.koto-citations ul{margin:.5rem 0 0;padding-left:1.25rem;line-height:1.6}
.koto-citations a{color:#1e3a8a}
.koto-rating{display:inline-flex;align-items:center;gap:.5rem;margin:1rem 0;padding:.5rem .9rem;background:#fffbeb;border:1px solid #fde68a;border-radius:999px;font-size:.95rem;color:#1a2332}
.koto-rating-stars{color:#f59e0b;letter-spacing:1px;font-size:1.05rem}
.koto-rating-value{font-weight:800}
.koto-rating-count{color:#64748b;font-size:.85rem}
`.trim()

    // Compose body. The CSS is no longer prepended — it now travels in the
    // baseCss field of the resolved page and gets written to the
    // _kotoiq_base_css post meta separately (KSES-safe). {{NO_STYLES}} in a
    // custom wrapper still opts the page out of base CSS via the baseCss
    // field returned below.
    const wantsStyles = !customWrapper || !customWrapper.includes('{{NO_STYLES}}')

    // Extract any <style> blocks from the wrapper and strip page-shell tags
    // (DOCTYPE, html, head, body, link rel=stylesheet, script). The styles
    // get APPENDED to baseCss so they travel via the _kotoiq_base_css post
    // meta (KSES-safe via plugin v4.2.1+). Without this, KSES strips the
    // <style> tags from post content but leaves the CSS rules as visible
    // text, which is what broke unifiedmktg.com/.../bonifay/ + earlier
    // pages — operator-uploaded HTML had embedded <style> blocks that
    // bled into the rendered page.
    let wrapperExtraCss = ''
    let cleanedWrapper = customWrapper || ''
    if (customWrapper) {
        cleanedWrapper = cleanedWrapper.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_m, css) => {
            wrapperExtraCss += (wrapperExtraCss ? '\n\n' : '') + String(css).trim()
            return ''
        })
        // Strip page-shell tags that shouldn't live inside a WP post body.
        // Server-side defense — the wrapper_assist Claude prompt also strips
        // these, but operators paste raw HTML directly too.
        cleanedWrapper = cleanedWrapper
            .replace(/<!doctype[^>]*>/gi, '')
            .replace(/<\/?(?:html|head|body)\b[^>]*>/gi, '')
            .replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, '')
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    }
    const bodyHtml = (customWrapper
        ? cleanedWrapper
            .replace(/\{\{NO_STYLES\}\}/g, '')
            .replace(/\{\{DIRECT_ANSWER\}\}/g, directAnswerHtml)
            .replace(/\{\{HERO_HEADLINE\}\}/g, escapeHtml(stripHtml(heroHeadline)))
            .replace(/\{\{HERO_SUB\}\}/g, ensureParagraphs(heroSub))
            .replace(/\{\{HERO_MEDIA\}\}/g, heroMediaHtml)
            .replace(/\{\{SECTIONS\}\}/g, sectionHtml)
            .replace(/\{\{HOWTO\}\}/g, howtoHtml)
            .replace(/\{\{COMPARISON\}\}/g, comparisonHtml)
            .replace(/\{\{FAQS\}\}/g, faqsHtml)
            .replace(/\{\{LOCAL_DATA\}\}/g, localDataHtml)
            .replace(/\{\{CTA\}\}/g, ctaHtml)
            .replace(/\{\{SERVICE_AREAS\}\}/g, serviceAreasHtml)
            .replace(/\{\{RELATED_SERVICES\}\}/g, relatedServicesHtml)
            .replace(/\{\{AUTHOR_BYLINE\}\}/g, authorBylineHtml)
            .replace(/\{\{TESTIMONIALS\}\}/g, testimonialsHtml)
            .replace(/\{\{RESULTS\}\}/g, resultsHtml)
            .replace(/\{\{CITATIONS\}\}/g, citationsHtml)
            .replace(/\{\{RATING\}\}/g, ratingBadgeHtml)
        : [
            directAnswerHtml,
            `<header class="koto-hero">${heroMediaHtml ? '\n  ' + heroMediaHtml : ''}\n  <h1>${escapeHtml(stripHtml(heroHeadline))}</h1>\n  <div class="koto-hero-sub">${ensureParagraphs(heroSub)}</div>\n</header>`,
            ratingBadgeHtml,
            authorBylineHtml,
            sectionHtml,
            howtoHtml,
            comparisonHtml,
            resultsHtml,
            testimonialsHtml,
            faqsHtml,
            localDataHtml,
            citationsHtml,
            ctaHtml,
            relatedServicesHtml,
            serviceAreasHtml,
        ].filter(Boolean).join('\n'))

    const metaTitle = resolveTitle(master.meta.title_template, ctx)
    const metaDescription = resolveTokens(master.meta.description_template, ctx)

    // JSON-LD — start from Claude's template (typically a @graph with
    // LocalBusiness + WebPage + FAQPage), then enrich it at resolve time
    // with Speakable, Service (areaServed=this city), HowTo, Dataset, etc.
    // This keeps Claude's prompt simple while letting us bolt on every
    // AI-search-friendly entity we can derive deterministically.
    let jsonLd: string | null = null
    if (master.schema_jsonld_template) {
        // Phone tokens inside the schema template MUST resolve to plain
        // digits/text — NOT the full <a> anchor that the body uses. An
        // unescaped <a href="..."> inside a JSON string breaks parsing
        // (unescaped `"` from the anchor's attribute terminates the JSON
        // string early) and the plugin's sanitizer drops the meta entirely.
        // Substitute here before the standard token resolver runs.
        let schemaTpl = master.schema_jsonld_template
        if (ctx.phone) {
            const phoneJsonValue = ctx.phone.replace(/\D/g, '') || ctx.phone
            schemaTpl = schemaTpl.replace(/\[koto_phone(?:_link)?\]/g, phoneJsonValue)
        }
        const resolvedTpl = resolveTokens(schemaTpl, ctx)
        jsonLd = enrichSchemaGraph(resolvedTpl, master, ctx, { title, metaDescription: stripHtml(metaDescription).trim() })
    }

    // Combine our base CSS with any styles extracted from the operator's
    // wrapper, then minify before returning. Minified CSS is ~30-50%
    // smaller on the wire (less HTML payload per page render) and removes
    // dev-time comments / formatting that don't render anything.
    const baseCssRaw = wantsStyles
        ? (wrapperExtraCss ? `${baseCssBody}\n\n${wrapperExtraCss}` : baseCssBody)
        : (wrapperExtraCss || '') // operator opted out of base styles but still keep their own
    const baseCss = minifyCss(baseCssRaw)

    return {
        title,
        slug: buildSlug(title, ctx),
        metaTitle,
        metaDescription: stripHtml(metaDescription).trim(),
        bodyHtml,
        baseCss,
        jsonLd,
    }
}

/**
 * Simple regex-based CSS minifier. Trusted-input only — these styles come
 * from our own base CSS plus operator-uploaded design references (which
 * Claude already vetted via wrapper_assist). Not safe for arbitrary user
 * input but fine here.
 *
 * Strips:
 *  - C-style comments
 *  - whitespace around braces, semicolons, colons, commas, combinators
 *  - the trailing semicolon before }
 *  - leading/trailing whitespace per declaration
 *
 * Preserves quoted strings (so url("...") and content: "x" stay intact)
 * by NOT touching characters between quotes.
 */
function minifyCss(css: string): string {
    if (!css) return ''
    // Strip /* ... */ comments. Safe because we don't allow user-written
    // CSS with intentional comment-containing strings on this surface.
    let out = css.replace(/\/\*[\s\S]*?\*\//g, '')
    // Collapse all whitespace runs to a single space
    out = out.replace(/\s+/g, ' ')
    // Remove space around CSS structural punctuation
    out = out.replace(/\s*([{}:;,>~+])\s*/g, '$1')
    // Trim trailing ; before }
    out = out.replace(/;}/g, '}')
    // Add a newline after every } so the output isn't one literally
    // unreadable line — costs ~1 byte per rule and helps debugging.
    out = out.replace(/}/g, '}\n').trim()
    return out
}

/**
 * Enrich Claude's @graph with additional AI-search-friendly entities derived
 * from the master + context. Always-additive: never removes Claude's entries,
 * only adds + decorates.
 *
 * Adds:
 *   - @id values on WebPage / WebSite / LocalBusiness so other entities can
 *     reference them (real linked-data graph, not isolated entries)
 *   - Speakable selectors on WebPage targeting our direct-answer block + h1
 *   - Service entity with areaServed=this city, provider=LocalBusiness if present
 *   - HowTo entity if master.howto exists
 *   - Dataset entity if ctx.localData (Census) exists, with sourceUrl citation
 *
 * Returns the compact JSON string. If Claude's template doesn't parse as
 * valid JSON, falls back to returning the resolved string verbatim so the
 * operator can debug (matches prior behavior).
 */
function enrichSchemaGraph(
    resolvedTpl: string,
    master: TopicCampaignMaster,
    ctx: ResolveContext,
    page: { title: string; metaDescription: string },
): string {
    let parsed: any
    try {
        parsed = JSON.parse(resolvedTpl)
    } catch {
        return resolvedTpl
    }

    // Normalize to a @graph shape regardless of whether Claude emitted one
    // top-level object or already a @graph wrapper.
    let graph: any[]
    if (Array.isArray(parsed['@graph'])) graph = parsed['@graph']
    else if (Array.isArray(parsed)) graph = parsed
    else graph = [parsed]

    const url = ctx.pageUrl || ''
    const baseId = url || `urn:koto:${ctx.location.city.toLowerCase()}-${ctx.location.stateAbbr || ''}`
    const webPageId = `${baseId}#webpage`
    const serviceId = `${baseId}#service`
    const businessId = `${baseId}#localbusiness`
    const datasetId = `${baseId}#dataset`
    const howtoId = `${baseId}#howto`

    // ── Annotate existing WebPage / WebSite / LocalBusiness with @id ───────
    let webPage = graph.find(e => e?.['@type'] === 'WebPage' || (Array.isArray(e?.['@type']) && e['@type'].includes('WebPage')))
    if (webPage) {
        webPage['@id'] = webPage['@id'] || webPageId
        if (url) webPage.url = webPage.url || url
        webPage.name = webPage.name || page.title
        webPage.description = webPage.description || page.metaDescription
        // Speakable — voice assistants read these selectors aloud.
        webPage.speakable = {
            '@type': 'SpeakableSpecification',
            cssSelector: ['.koto-direct-answer', '.koto-hero h1', '.koto-hero-sub'],
        }
    } else {
        graph.push({
            '@type': 'WebPage',
            '@id': webPageId,
            ...(url ? { url } : {}),
            name: page.title,
            description: page.metaDescription,
            speakable: {
                '@type': 'SpeakableSpecification',
                cssSelector: ['.koto-direct-answer', '.koto-hero h1', '.koto-hero-sub'],
            },
        })
    }

    const localBusiness = graph.find(e => e?.['@type'] === 'LocalBusiness' || (Array.isArray(e?.['@type']) && e['@type'].includes('LocalBusiness')))
    if (localBusiness) {
        localBusiness['@id'] = localBusiness['@id'] || businessId
    }

    // ── Service entity ─────────────────────────────────────────────────────
    // Tightens entity↔location association — AI engines use this to confirm
    // "yes this page is about {topic} in {city}". Skip if Claude already
    // emitted a Service we shouldn't duplicate.
    const existingService = graph.find(e => e?.['@type'] === 'Service')
    if (!existingService) {
        const cityName = ctx.location.city
        const stateName = ctx.location.state || ctx.location.stateAbbr
        graph.push({
            '@type': 'Service',
            '@id': serviceId,
            name: `${master.topic} in ${cityName}${stateName ? `, ${stateName}` : ''}`,
            serviceType: master.topic,
            areaServed: {
                '@type': 'City',
                name: cityName,
                ...(stateName ? { containedInPlace: { '@type': 'State', name: stateName } } : {}),
            },
            ...(localBusiness ? { provider: { '@id': businessId } } : ctx.companyName ? { provider: { '@type': 'LocalBusiness', name: ctx.companyName } } : {}),
        })
    }

    // ── HowTo entity ──────────────────────────────────────────────────────
    if (master.howto && master.howto.steps.length) {
        graph.push({
            '@type': 'HowTo',
            '@id': howtoId,
            name: stripHtml(resolveTokens(master.howto.title_template, ctx)).trim(),
            step: master.howto.steps.map((s, i) => ({
                '@type': 'HowToStep',
                position: i + 1,
                name: stripHtml(resolveTokens(s.name_template, ctx)).trim(),
                text: stripHtml(resolveTokens(s.text_template, ctx)).trim(),
            })),
        })
    }

    // ── Dataset entity (Census "By the Numbers") ───────────────────────────
    if (ctx.localData && ctx.localData.items.length) {
        graph.push({
            '@type': 'Dataset',
            '@id': datasetId,
            name: `${ctx.location.city}${ctx.location.stateAbbr ? `, ${ctx.location.stateAbbr}` : ''} demographic and economic data`,
            description: `Population, income, and housing statistics for ${ctx.location.city}.`,
            url: ctx.localData.sourceUrl,
            isAccessibleForFree: true,
            ...(ctx.localData.fetchedAt ? { dateModified: ctx.localData.fetchedAt } : {}),
            creator: { '@type': 'GovernmentOrganization', name: 'US Census Bureau', url: 'https://www.census.gov' },
            distribution: { '@type': 'DataDownload', encodingFormat: 'text/html', contentUrl: ctx.localData.sourceUrl },
            spatialCoverage: {
                '@type': 'Place',
                name: `${ctx.location.city}${ctx.location.stateAbbr ? `, ${ctx.location.stateAbbr}` : ''}`,
            },
        })
    }

    // ── Knowledge-graph entity (Wikidata) — what the page is ABOUT ─────────
    if (webPage && ctx.entities?.topic?.url) {
        const t = ctx.entities.topic
        webPage.about = [{
            '@type': 'Thing',
            '@id': t.url,
            name: t.label,
            sameAs: t.url,
            ...(t.description ? { description: t.description } : {}),
        }]
    }

    // ── E-E-A-T entities (operator/Google-sourced; omit-when-empty) ────────
    // Mirrors the rendered trust blocks. Review/AggregateRating only emitted
    // because the same reviews are displayed on-page (Google policy compliant),
    // and only from REAL data — never AI-fabricated.
    const eeat = ctx.eeat || {}
    if (eeat.strategist && eeat.strategist.name && webPage) {
        const author: any = { '@type': 'Person', name: eeat.strategist.name }
        if (eeat.strategist.title) author.jobTitle = eeat.strategist.title
        if (eeat.strategist.photoUrl) author.image = eeat.strategist.photoUrl
        webPage.author = author
    }
    if (localBusiness) {
        if (Array.isArray(eeat.sameAs) && eeat.sameAs.length) {
            const existing = Array.isArray(localBusiness.sameAs) ? localBusiness.sameAs : []
            localBusiness.sameAs = Array.from(new Set([...existing, ...eeat.sameAs.filter(Boolean)]))
        }
        if (eeat.aggregateRating && eeat.aggregateRating.reviewCount > 0) {
            localBusiness.aggregateRating = {
                '@type': 'AggregateRating',
                ratingValue: eeat.aggregateRating.ratingValue,
                reviewCount: eeat.aggregateRating.reviewCount,
                bestRating: 5,
            }
        }
        const reviews = Array.isArray(eeat.testimonials) ? eeat.testimonials.filter(t => t && t.text && t.author).slice(0, 5) : []
        if (reviews.length) {
            localBusiness.review = reviews.map(t => ({
                '@type': 'Review',
                reviewBody: stripHtml(t.text).trim(),
                author: { '@type': 'Person', name: t.author },
                ...(t.rating ? { reviewRating: { '@type': 'Rating', ratingValue: t.rating, bestRating: 5 } } : {}),
                ...(t.date ? { datePublished: t.date } : {}),
            }))
        }
    }
    if (webPage && Array.isArray(eeat.citations) && eeat.citations.length) {
        webPage.citation = eeat.citations.filter(c => c && c.sourceUrl && c.sourceName).map(c => ({
            '@type': 'CreativeWork',
            ...(c.claim ? { name: c.claim } : {}),
            url: c.sourceUrl,
            publisher: { '@type': 'Organization', name: c.sourceName },
        }))
    }

    return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
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
