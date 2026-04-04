// ══════════════════════════════════════════════════════════════════════════════
// Google Places API v1 (New) Integration
// Real business data: name, address, phone, rating, reviews, website, hours
// ══════════════════════════════════════════════════════════════════════════════

const PLACES_BASE = 'https://places.googleapis.com/v1'

// Fields we want back - controls billing cost
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.internationalPhoneNumber',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.businessStatus',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.regularOpeningHours',
  'places.googleMapsUri',
  'places.photos',
].join(',')

function getKey() {
  // Check all possible env var names for the Google API key
  return process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY
    || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
    || process.env.NEXT_PUBLIC_GOOGLE_API_KEY
    || ''
}

// Export for use in components to check if key is available
export function hasGoogleKey() {
  return !!(process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY
    || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
    || process.env.NEXT_PUBLIC_GOOGLE_API_KEY)
}

// ── Text search — finds businesses matching a query ───────────────────────────
export async function placesTextSearch(query, options = {}) {
  const key = getKey()
  if (!key) return { places: [], error: 'No Google Places API key configured' }

  try {
    const body = {
      textQuery: query,
      maxResultCount: options.maxResults || 20,
      ...(options.locationBias ? { locationBias: options.locationBias } : {}),
      ...(options.openNow ? { openNow: true } : {}),
    }

    const res = await fetch(`${PLACES_BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error?.message || `HTTP ${res.status}`)
    }

    const data = await res.json()
    console.log(`[Google Places] Query: "${query||body.textQuery}" → ${(data.places||[]).length} results`)
    if (data.places?.[0]) {
      const p = data.places[0]
      console.log(`[Google Places] Top result: ${p.displayName?.text} | ${p.rating}★ | ${p.userRatingCount} reviews`)
    }
    return { places: data.places || [], error: null }
  } catch(e) {
    console.error('Places API error:', e.message)
    return { places: [], error: e.message }
  }
}

// ── Get place details by ID ───────────────────────────────────────────────────
export async function getPlaceDetails(placeId) {
  const key = getKey()
  if (!key) return null

  try {
    const res = await fetch(`${PLACES_BASE}/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK + ',reviews',
      },
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

// ── Map a Google Places result to Moose Scout lead format ─────────────────────
export function placeToLead(place, index) {
  const name    = place.displayName?.text || 'Unknown Business'
  const address = place.formattedAddress || ''
  const phone   = place.nationalPhoneNumber || place.internationalPhoneNumber || ''
  const website = place.websiteUri || ''
  const rating  = place.rating || 0
  const reviews = place.userRatingCount || 0
  const mapsUrl = place.googleMapsUri || ''
  const open    = place.businessStatus === 'OPERATIONAL'

  // Derive marketing gaps from real data signals
  const gaps = []
  if (reviews < 10)   gaps.push('Very few Google reviews — critical gap under 10')
  else if (reviews < 25)  gaps.push('Low review count — under 25 reviews')
  else if (reviews < 75)  gaps.push('Below average review volume for this industry')
  if (rating < 3.5 && rating > 0) gaps.push(`Poor rating (${rating}★) — reputation crisis`)
  else if (rating < 4.0 && rating > 0) gaps.push(`Below-average rating (${rating}★) — needs improvement`)
  else if (rating < 4.4 && rating > 0) gaps.push(`Rating (${rating}★) below top competitors`)
  if (!website)      gaps.push('No website detected — losing leads daily')
  if (!phone)        gaps.push('Phone number not listed on Google')
  if (reviews >= 75 && rating >= 4.4 && website && phone) gaps.push('Strong presence — target for growth services')
  else if (gaps.length === 0) gaps.push('Good foundation — ready for advanced marketing')

  // Scout score: higher = more opportunity/need for marketing help
  let score = 45
  // Review volume signals (low reviews = high opportunity)
  if (reviews < 10)        score += 30
  else if (reviews < 25)   score += 20
  else if (reviews < 75)   score += 10
  else if (reviews < 200)  score += 5
  else                     score -= 5   // established biz, still needs services
  // Rating signals
  if (rating < 3.5 && rating > 0)  score += 25
  else if (rating < 4.0 && rating > 0) score += 15
  else if (rating < 4.4 && rating > 0) score += 8
  else if (rating >= 4.7) score -= 5   // very strong
  // Missing digital assets
  if (!website) score += 20
  if (!phone)   score += 10
  score = Math.min(95, Math.max(20, score))

  const temperature = score >= 75 ? 'hot' : score >= 50 ? 'warm' : score >= 30 ? 'lukewarm' : 'cold'

  return {
    id:              place.id || `gp_${index}`,
    name,
    address,
    phone,
    website,
    email:           '', // Places API doesn't expose email
    rating,
    review_count:    reviews,
    score,
    temperature,
    years_in_business: null,
    estimated_revenue: null,
    employee_count:  null,
    gaps,
    ai_summary:      null, // filled by AI enrichment pass
    gbp_claimed:     true, // it's in Google Places = claimed
    has_website:     !!website,
    social_active:   null,
    running_ads:     null,
    maps_url:        mapsUrl,
    place_id:        place.id,
    // Source provenance
    _source:         'google_places',
    _real_data:      true,
  }
}

// ── Full Scout search using real Google Places data ────────────────────────────
export async function scoutWithPlaces(businessType, location, options = {}) {
  const query = `${businessType} in ${location}`
  const { places, error } = await placesTextSearch(query, {
    maxResults: options.maxResults || 20,
  })

  if (error) return { leads: [], error, source: 'google_places' }

  const leads = places.map((p, i) => placeToLead(p, i))
  return { leads, error: null, source: 'google_places', total: places.length }
}
