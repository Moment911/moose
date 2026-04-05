// ══════════════════════════════════════════════════════════════════════════════
// Google Places — calls our server-side API route at /api/scout/places
// Key never exposed to browser. Works regardless of NEXT_PUBLIC_ vars.
// ══════════════════════════════════════════════════════════════════════════════

async function callPlacesRoute(body) {
  const res = await fetch('/api/scout/places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Places route error ${res.status}`)
  return res.json()
}

// Always true now — key lives server-side, always available if configured in Vercel
export function hasGoogleKey() {
  return true  // Route handles missing key gracefully with { error, places:[] }
}

// ── Text search ────────────────────────────────────────────────────────────────
export async function placesTextSearch(query, options = {}) {
  try {
    const data = await callPlacesRoute({
      action: 'search',
      query,
      maxResults: options.maxResults || 20,
    })
    if (data.error && data.places?.length === 0) {
      console.warn('[Places] Search error:', data.error)
      return { places: [], error: data.error }
    }
    console.log(`[Places] "${query}" → ${(data.places||[]).length} results`)
    if (data.places?.[0]) {
      const p = data.places[0]
      console.log(`[Places] Top: ${p.displayName?.text} | ${p.rating}★ | ${p.userRatingCount} reviews`)
    }
    return { places: data.places || [], error: null }
  } catch (e) {
    console.error('[Places] Fetch error:', e.message)
    return { places: [], error: e.message }
  }
}

// ── Place details ──────────────────────────────────────────────────────────────
export async function getPlaceDetails(placeId) {
  if (!placeId) return null
  try {
    const data = await callPlacesRoute({ action: 'details', placeId })
    return data.place || null
  } catch { return null }
}

// ── Map a Google Places result → Koto Scout lead format ──────────────────────
export function placeToLead(place, index) {
  const name    = place.displayName?.text || 'Unknown Business'
  const address = place.formattedAddress || ''
  const phone   = place.nationalPhoneNumber || place.internationalPhoneNumber || ''
  const website = place.websiteUri || ''
  const rating  = place.rating || 0
  const reviews = place.userRatingCount || 0
  const mapsUrl = place.googleMapsUri || ''

  // Derive gaps from real signals
  const gaps = []
  if (reviews < 10)          gaps.push('Critically low reviews — only ' + reviews + ' on Google')
  else if (reviews < 25)     gaps.push('Low review count — ' + reviews + ' reviews (under 25)')
  else if (reviews < 75)     gaps.push('Below-average review volume — ' + reviews + ' reviews')
  if (rating < 3.5 && rating > 0) gaps.push('Poor rating (' + rating + '★) — reputation crisis')
  else if (rating < 4.0 && rating > 0) gaps.push('Below-average rating (' + rating + '★)')
  else if (rating < 4.4 && rating > 0) gaps.push('Rating (' + rating + '★) below top competitors')
  if (!website)              gaps.push('No website — losing leads daily')
  if (!phone)                gaps.push('Phone not listed on Google')
  if (reviews > 0 && reviews < 100 && rating < 4.5) gaps.push('Losing local pack position to competitors')
  if (gaps.length === 0)     gaps.push('Strong presence — good candidate for growth services')

  // Opportunity score
  let score = 45
  if (reviews < 10)         score += 30
  else if (reviews < 25)    score += 20
  else if (reviews < 75)    score += 10
  else if (reviews < 200)   score += 5
  else                      score -= 5
  if (rating < 3.5 && rating > 0)  score += 25
  else if (rating < 4.0 && rating > 0) score += 15
  else if (rating < 4.4 && rating > 0) score += 8
  else if (rating >= 4.7)  score -= 5
  if (!website) score += 20
  if (!phone)   score += 10
  score = Math.min(95, Math.max(20, score))

  return {
    id:              place.id || `gp_${index}`,
    name,
    address,
    phone,
    website,
    email:           '',
    rating,
    review_count:    reviews,
    score,
    temperature:     score >= 75 ? 'hot' : score >= 50 ? 'warm' : score >= 30 ? 'lukewarm' : 'cold',
    years_in_business: null,
    estimated_revenue: null,
    employee_count:  null,
    gaps,
    ai_summary:      null,
    gbp_claimed:     true,
    has_website:     !!website,
    social_active:   null,
    running_ads:     null,
    maps_url:        mapsUrl,
    place_id:        place.id,
    types:           place.types || [],
    hours:           place.regularOpeningHours?.weekdayDescriptions?.join(', ') || '',
    _source:         'google_places',
    _real_data:      true,
  }
}

// ── Full Scout search ──────────────────────────────────────────────────────────
export async function scoutWithPlaces(businessType, location, options = {}) {
  const query = businessType + (location ? ' in ' + location : '')
  const { places, error } = await placesTextSearch(query, {
    maxResults: options.maxResults || 20,
  })
  if (error && places.length === 0) return { leads: [], error, source: 'google_places' }
  const leads = places.map((p, i) => placeToLead(p, i))
  return { leads, error: null, source: 'google_places', total: places.length }
}
