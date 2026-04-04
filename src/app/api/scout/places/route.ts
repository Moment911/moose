import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const PLACES_BASE = 'https://places.googleapis.com/v1'
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.businessStatus',
  'places.primaryType',
  'places.types',
  'places.regularOpeningHours',
  'places.googleMapsUri',
].join(',')

const DETAIL_MASK = [
  'displayName',
  'formattedAddress',
  'nationalPhoneNumber',
  'rating',
  'userRatingCount',
  'websiteUri',
  'regularOpeningHours',
  'businessStatus',
  'types',
  'primaryType',
  'editorialSummary',
  'reviews',
  'googleMapsUri',
].join(',')

function getKey() {
  // Server-side only — never exposed to browser
  return process.env.GOOGLE_PLACES_KEY
    || process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY
    || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
    || process.env.NEXT_PUBLIC_GOOGLE_API_KEY
    || ''
}

export async function POST(req: NextRequest) {
  const key = getKey()
  if (!key) {
    return NextResponse.json({ error: 'Google Places API key not configured', places: [] })
  }

  try {
    const body = await req.json()
    const { action, query, placeId, maxResults = 20 } = body

    // ── Text search ───────────────────────────────────────────────────────────
    if (action === 'search') {
      const res = await fetch(`${PLACES_BASE}/places:searchText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: Math.min(maxResults, 20),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        return NextResponse.json({
          error: err.error?.message || `Places API error ${res.status}`,
          places: []
        }, { status: res.status })
      }

      const data = await res.json()
      return NextResponse.json({ places: data.places || [], error: null })
    }

    // ── Place details ─────────────────────────────────────────────────────────
    if (action === 'details' && placeId) {
      const res = await fetch(`${PLACES_BASE}/places/${placeId}`, {
        headers: {
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': DETAIL_MASK,
        },
      })

      if (!res.ok) return NextResponse.json({ error: 'Details fetch failed', place: null })
      const place = await res.json()
      return NextResponse.json({ place, error: null })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (e: any) {
    return NextResponse.json({ error: e.message, places: [] }, { status: 500 })
  }
}
