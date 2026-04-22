import 'server-only'
import { SOURCE_CONFIG, FEATURE_TAGS } from './profileConfig'
import type { ExtractedFieldRecord } from './profileExtractClaude'
import { summarizeReviewThemes } from './profileGBPPull'
import { logTokenUsage } from '../tokenTracker'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 / Plan 06 — GBP Places API (New) v1 Pull (Mode 3 — PROF-09)
//
// Uses the Places API (New) with server-side API key. Reads
// GOOGLE_PLACES_API_KEY first, falls back to GOOGLE_PLACES_KEY (the name
// used elsewhere in the repo — intel/kotoiq/scout routes).
// Headers: X-Goog-Api-Key + X-Goog-FieldMask (mandatory per API contract).
// Returns ProvenanceRecord[] with source_type='gbp_public', confidence <= 0.75.
//
// Endpoint: GET https://places.googleapis.com/v1/places/{place_id}
// ─────────────────────────────────────────────────────────────────────────────

const PLACES_FIELDMASK = [
  'displayName', 'formattedAddress', 'regularOpeningHours',
  'primaryType', 'types', 'nationalPhoneNumber', 'internationalPhoneNumber',
  'websiteUri', 'rating', 'userRatingCount', 'reviews',
  'editorialSummary', 'googleMapsUri',
].join(',')

export type GBPPlacesPullArgs = {
  placeId: string
  agencyId: string
  clientId: string
}

export async function pullFromGBPPlaces(args: GBPPlacesPullArgs): Promise<ExtractedFieldRecord[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACES_KEY
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY / GOOGLE_PLACES_KEY missing')

  const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(args.placeId)}`, {
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': PLACES_FIELDMASK,
    },
  })

  if (r.status === 400) {
    const text = await r.text().catch(() => '')
    throw new Error(`PLACES_BAD_FIELDMASK: ${text.slice(0, 200)}`)
  }
  if (!r.ok) throw new Error(`PLACES_HTTP_${r.status}`)

  const place = await r.json() as any

  const now = new Date().toISOString()
  const ceiling = SOURCE_CONFIG.gbp_public.confidence_ceiling

  const mk = (field_name: string, value: any, snippet: string): ExtractedFieldRecord => ({
    field_name,
    record: {
      value,
      source_type: 'gbp_public',
      source_url: `places://${args.placeId}`,
      source_snippet: snippet,
      captured_at: now,
      confidence: ceiling,
    },
  })

  const records: ExtractedFieldRecord[] = []

  if (place.displayName?.text) {
    records.push(mk('business_name', place.displayName.text, `Places displayName: ${place.displayName.text}`))
  }
  if (place.primaryType) {
    records.push(mk('primary_service', place.primaryType, `Places primaryType: ${place.primaryType}`))
  }
  if (place.nationalPhoneNumber) {
    records.push(mk('phone', place.nationalPhoneNumber, `Places phone: ${place.nationalPhoneNumber}`))
  }
  if (place.websiteUri) {
    records.push(mk('website', place.websiteUri, `Places websiteUri: ${place.websiteUri}`))
  }
  if (place.formattedAddress) {
    records.push(mk('city', place.formattedAddress, `Places formattedAddress: ${place.formattedAddress}`))
  }

  // Top-5 review themes (Mode 3 — reviews embedded in Place response)
  if (Array.isArray(place.reviews) && place.reviews.length) {
    const themes = await summarizeReviewThemes({
      accessToken: '',
      locationName: args.placeId,
      agencyId: args.agencyId,
      clientId: args.clientId,
      maxReviews: 5,
      sourceType: 'gbp_public',
      providedReviews: place.reviews.map((rv: any) => ({
        text: rv.text?.text ?? '',
        rating: rv.rating,
      })),
    })
    for (const t of themes) {
      records.push({
        field_name: 'pain_point_emphasis',
        record: {
          value: t.theme,
          source_type: 'gbp_public',
          source_url: `places://${args.placeId}#review-theme`,
          source_snippet: `Top-5 review theme: ${t.theme}`,
          captured_at: now,
          confidence: Math.min(0.6, ceiling),
        },
      })
    }
  }

  // Log token usage
  void logTokenUsage({
    feature: FEATURE_TAGS.GBP_PUBLIC_EXTRACT,
    model: 'google_places_api',
    inputTokens: 0,
    outputTokens: 0,
    agencyId: args.agencyId,
    metadata: { client_id: args.clientId, source_type: 'gbp_public', place_id: args.placeId },
  })

  return records
}
