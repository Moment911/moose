import 'server-only'

// ── E-E-A-T context builder ─────────────────────────────────────────────────
//
// Assembles the ctx.eeat object consumed by tokenResolver.resolveMaster. Two
// sources, both REAL data only (never AI-fabricated), per the platform
// data-integrity standard + FTC rules on testimonials:
//
//   1. Operator-provided inputs  → campaign.eeat_inputs jsonb
//      (strategist byline, results snapshots, cited sources, sameAs URLs)
//   2. Live Google reviews       → Places API (New) by the client's stored
//      google_place_id (testimonials + true aggregate rating/count)
//
// Reviews are pulled live at deploy time and NOT stored, so they always reflect
// current, real data. Best-effort: any failure degrades to no reviews rather
// than blocking a deploy.

import type { ResolveContext } from './tokenResolver'

type Eeat = NonNullable<ResolveContext['eeat']>

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

    if (opts.withReviews) {
        try {
            // Prefer the place connected directly to the campaign; fall back to
            // the campaign's client's place_id (set via intel/scout).
            let placeId: string | undefined = campaign?.google_place_id || undefined
            if (!placeId && campaign?.client_id) {
                const { data: client } = await supabase
                    .from('clients')
                    .select('google_place_id')
                    .eq('id', campaign.client_id)
                    .single()
                placeId = client?.google_place_id || undefined
            }
            if (placeId) {
                const r = await fetchPlaceReviews(String(placeId))
                if (r) {
                    if (r.testimonials.length) eeat.testimonials = r.testimonials
                    if (r.aggregateRating) eeat.aggregateRating = r.aggregateRating
                }
            }
        } catch {
            // google_place_id column may not exist on older schemas, or the
            // client row is missing — degrade to operator inputs only.
        }
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
        eeat.strategist || eeat.sameAs || eeat.results || eeat.citations || eeat.testimonials || eeat.aggregateRating
    return hasAny ? eeat : undefined
}
