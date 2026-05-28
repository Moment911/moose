import 'server-only'

// ── E-E-A-T context builder ─────────────────────────────────────────────────
//
// Assembles the ctx.eeat object consumed by tokenResolver.resolveMaster. Three
// sources, all REAL data only (never AI-fabricated), per the platform
// data-integrity standard + FTC rules on testimonials:
//
//   1. Operator-provided inputs  → campaign.eeat_inputs jsonb
//      (strategist byline, results snapshots, cited sources, sameAs URLs)
//   2. Live Google reviews       → Places API (New) by the client's stored
//      google_place_id (testimonials + true aggregate rating/count)
//   3. Client trust-signal cols  → clients table (price_range, payment_methods,
//      team_size, languages_spoken, specialties, certifications/awards,
//      license_number, booking_url, author_*, yelp/bbb URLs, key_result).
//      Operator-entered on the client detail page → LocalBusiness schema attrs.
//
// Reviews are pulled live at deploy time and NOT stored, so they always reflect
// current, real data. Best-effort: any failure degrades to no reviews rather
// than blocking a deploy.

import type { ResolveContext } from './tokenResolver'

type Eeat = NonNullable<ResolveContext['eeat']>

/** Split an operator free-text field ("Spanish, French" / "ABC\nDEF") into a
 *  clean, de-duped string list. Returns [] for empty/falsy input. */
function splitList(v: any): string[] {
    if (!v || typeof v !== 'string') return []
    return Array.from(
        new Set(
            v
                .split(/[,\n;]+/)
                .map(s => s.trim())
                .filter(Boolean),
        ),
    )
}

/** Parse the first integer out of a free-text team-size field ("10-20",
 *  "~50 employees"). Returns undefined when there's no usable number. */
function firstInt(v: any): number | undefined {
    if (typeof v === 'number' && Number.isFinite(v)) return v > 0 ? Math.round(v) : undefined
    if (typeof v !== 'string') return undefined
    const m = v.match(/\d+/)
    if (!m) return undefined
    const n = parseInt(m[0], 10)
    return Number.isFinite(n) && n > 0 ? n : undefined
}

/** Map a client record's operator-provided trust-signal columns into the
 *  partial eeat fields they populate. All real business facts (NOT AI), so
 *  they may be emitted verbatim into schema + on-page trust blocks. Every
 *  field is omit-when-empty. */
function trustSignalsFromClient(client: any): {
    business: NonNullable<Eeat['business']>
    sameAs: string[]
    strategist?: Eeat['strategist']
    keyResult?: { metric: string }
} {
    const business: NonNullable<Eeat['business']> = {}
    if (client.price_range) business.priceRange = String(client.price_range).trim()
    if (client.payment_methods) business.paymentAccepted = String(client.payment_methods).trim()
    const employees = firstInt(client.team_size)
    if (employees) business.numberOfEmployees = employees
    const langs = splitList(client.languages_spoken)
    if (langs.length) business.knowsLanguage = langs
    const specialties = splitList(client.specialties)
    if (specialties.length) business.knowsAbout = specialties
    const awards = [...splitList(client.certifications), ...splitList(client.awards)]
    if (awards.length) business.award = Array.from(new Set(awards))
    if (client.booking_url) business.bookingUrl = String(client.booking_url).trim()
    if (client.license_number) business.licenseNumber = String(client.license_number).trim()

    // yelp/bbb are the same business entity on other directories → schema sameAs.
    const sameAs = [client.yelp_url, client.bbb_url].map(u => (u ? String(u).trim() : '')).filter(Boolean)

    // Author byline anchors page Experience/Expertise.
    let strategist: Eeat['strategist'] | undefined
    if (client.author_name) {
        strategist = { name: String(client.author_name).trim() }
        if (client.author_credentials) strategist.title = String(client.author_credentials).trim()
        if (client.author_photo_url) strategist.photoUrl = String(client.author_photo_url).trim()
    }

    const keyResult = client.key_result ? { metric: String(client.key_result).trim() } : undefined

    return { business, sameAs, strategist, keyResult }
}

/**
 * Fetch a place's reviews + true aggregate rating from the Google Places API
 * (New). Returns null on any failure or when there's nothing usable.
 */
async function fetchPlaceReviews(
    placeId: string,
): Promise<{ testimonials: NonNullable<Eeat['testimonials']>; aggregateRating?: Eeat['aggregateRating'] } | null> {
    const key = process.env.GOOGLE_PLACES_API_KEY || ''
    if (!key || !placeId) return null
    try {
        const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
            headers: {
                'X-Goog-Api-Key': key,
                'X-Goog-FieldMask': 'id,rating,userRatingCount,reviews',
            },
            signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) return null
        const p: any = await res.json()

        const reviews = Array.isArray(p.reviews) ? p.reviews : []
        const testimonials = reviews
            .map((r: any) => ({
                text: String(r.text?.text || r.originalText?.text || '').trim(),
                author: String(r.authorAttribution?.displayName || '').trim(),
                rating: typeof r.rating === 'number' ? r.rating : undefined,
                sourceLabel: 'Google',
                date: typeof r.publishTime === 'string' ? r.publishTime : undefined,
            }))
            // Only show genuinely positive, attributable reviews as testimonials.
            .filter((t: any) => t.text && t.author && (t.rating == null || t.rating >= 4))
            .slice(0, 5)

        // True totals from Google — not derived from the (capped) sample.
        const aggregateRating =
            typeof p.rating === 'number' && typeof p.userRatingCount === 'number' && p.userRatingCount > 0
                ? { ratingValue: Math.round(p.rating * 10) / 10, reviewCount: p.userRatingCount }
                : undefined

        if (!testimonials.length && !aggregateRating) return null
        return { testimonials, aggregateRating }
    } catch {
        return null
    }
}

/**
 * Build ctx.eeat for a campaign. Merges operator-provided inputs with live
 * Google reviews (when withReviews + the client has a google_place_id).
 * Returns undefined when there's no E-E-A-T data at all, so callers can spread
 * `...(eeat ? { eeat } : {})` and leave existing behavior untouched.
 */
export async function buildEeatContext(
    supabase: any,
    campaign: any,
    opts: { withReviews?: boolean } = {},
): Promise<Eeat | undefined> {
    const inputs = campaign?.eeat_inputs && typeof campaign.eeat_inputs === 'object' ? campaign.eeat_inputs : {}
    const eeat: Eeat = {}

    if (inputs.strategist?.name) eeat.strategist = inputs.strategist
    if (Array.isArray(inputs.sameAs) && inputs.sameAs.length) eeat.sameAs = inputs.sameAs.filter(Boolean)
    if (Array.isArray(inputs.results)) {
        const r = inputs.results.filter((x: any) => x && x.metric)
        if (r.length) eeat.results = r
    }
    if (Array.isArray(inputs.citations)) {
        const c = inputs.citations.filter((x: any) => x && x.sourceUrl && x.sourceName)
        if (c.length) eeat.citations = c
    }

    // Load the campaign's client row once — source of both google_place_id and
    // the operator-provided trust-signal columns. select('*') is intentional:
    // prod schema drifts from the SQL files, so naming new columns explicitly
    // would error the whole query on environments that haven't run the
    // trust-signal migrations yet. Best-effort — any failure degrades cleanly.
    let client: any = null
    if (campaign?.client_id) {
        try {
            const { data } = await supabase.from('clients').select('*').eq('id', campaign.client_id).single()
            client = data || null
        } catch {
            client = null
        }
    }

    // Trust signals from the client record. Operator campaign inputs always
    // win; client columns only fill gaps (strategist, sameAs, results). The
    // LocalBusiness `business` attributes have no campaign-input equivalent.
    if (client) {
        const ts = trustSignalsFromClient(client)
        if (Object.keys(ts.business).length) eeat.business = ts.business
        if (!eeat.strategist && ts.strategist) eeat.strategist = ts.strategist
        if (ts.sameAs.length) {
            eeat.sameAs = Array.from(new Set([...(eeat.sameAs || []), ...ts.sameAs]))
        }
        if (ts.keyResult) {
            const existing = Array.isArray(eeat.results) ? eeat.results : []
            if (!existing.some(r => r.metric === ts.keyResult!.metric)) {
                eeat.results = [...existing, ts.keyResult]
            }
        }
    }

    if (opts.withReviews) {
        try {
            // Prefer the place connected directly to the campaign; fall back to
            // the campaign's client's place_id (set via intel/scout).
            const placeId: string | undefined = campaign?.google_place_id || client?.google_place_id || undefined
            if (placeId) {
                const r = await fetchPlaceReviews(String(placeId))
                if (r) {
                    if (r.testimonials.length) eeat.testimonials = r.testimonials
                    if (r.aggregateRating) eeat.aggregateRating = r.aggregateRating
                }
            }
        } catch {
            // Degrade to operator inputs only.
        }
    }

    // Manual/operator-entered testimonials — used only when there are no live
    // Google reviews (real reviews always win).
    if (!eeat.testimonials && Array.isArray(inputs.testimonials)) {
        const t = inputs.testimonials.filter((x: any) => x && x.text && x.author).slice(0, 5)
        if (t.length) eeat.testimonials = t
    }

    // Manual/operator-set rating — applied only when there's no live Google
    // rating, so real reviews always take precedence.
    const mr = inputs.rating
    if (!eeat.aggregateRating && mr && Number(mr.ratingValue) > 0 && Number(mr.reviewCount) > 0) {
        eeat.aggregateRating = {
            ratingValue: Math.max(0, Math.min(5, Number(mr.ratingValue))),
            reviewCount: Math.max(0, Math.round(Number(mr.reviewCount))),
        }
    }

    const hasAny =
        eeat.strategist || eeat.sameAs || eeat.results || eeat.citations || eeat.testimonials || eeat.aggregateRating || eeat.business
    return hasAny ? eeat : undefined
}
