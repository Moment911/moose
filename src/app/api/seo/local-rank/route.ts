import { NextRequest, NextResponse } from 'next/server'
import { trackPlatformCost, PLATFORM_RATES } from '@/lib/tokenTracker'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
const GOOGLE_KEY    = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || ''

const PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.regularOpeningHours',
  'places.currentOpeningHours',
  'places.businessStatus',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.types',
  'places.googleMapsUri',
  'places.googleMapsLinks',
  'places.photos',
  'places.priceLevel',
  'places.timeZone',
  'places.utcOffsetMinutes',
].join(',')

const DETAILS_FIELD_MASK = [
  'id', 'displayName', 'formattedAddress', 'location',
  'rating', 'userRatingCount', 'websiteUri',
  'nationalPhoneNumber', 'internationalPhoneNumber',
  'regularOpeningHours', 'currentOpeningHours',
  'businessStatus', 'primaryType', 'primaryTypeDisplayName',
  'types', 'googleMapsUri', 'photos',
  'priceLevel', 'priceRange',
  'editorialSummary', 'accessibilityOptions',
  'parkingOptions', 'paymentOptions',
  'restroom', 'goodForChildren', 'liveMusic',
].join(',')

// ── Geocode location string → lat/lng ─────────────────────────────────────────
async function geocode(location: string) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GOOGLE_KEY}`
  const r = await fetch(url)
  if (!r.ok) return null
  const d = await r.json()
  const loc = d.results?.[0]?.geometry?.location
  if (!loc) return null
  return { lat: loc.lat, lng: loc.lng, formatted: d.results[0].formatted_address }
}

// ── Text Search (New) — best for "keyword + location" queries ─────────────────
async function textSearch(keyword: string, location: string, maxResults = 20) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': PLACES_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery:      `${keyword} ${location}`,
      maxResultCount: maxResults,
      languageCode:   'en',
    }),
  })
  if (!r.ok) { console.error('textSearch error:', await r.text()); return null }
  return r.json()
}

// ── Nearby Search (New) — uses lat/lng for precision ─────────────────────────
async function nearbySearch(keyword: string, lat: number, lng: number, radiusM = 16000, maxResults = 20) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': PLACES_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery:      keyword,  // filter by keyword
      maxResultCount: maxResults,
      rankPreference: 'POPULARITY',
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: Math.min(radiusM, 50000),
        },
      },
      languageCode: 'en',
    }),
  })
  if (!r.ok) { console.error('nearbySearch error:', await r.text()); return null }
  return r.json()
}

// ── Place Details (New) — full details for a specific place ──────────────────
async function placeDetails(placeId: string) {
  const r = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': DETAILS_FIELD_MASK,
      'Content-Type': 'application/json',
    },
  })
  if (!r.ok) return null
  return r.json()
}

// ── Place Photo URL ───────────────────────────────────────────────────────────
function photoUrl(photoName: string, maxWidth = 400) {
  if (!photoName) return null
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_KEY}`
}

// ── Normalize a place from either search type ────────────────────────────────
function normPlace(p: any, rank: number) {
  const isOpen = p.currentOpeningHours?.openNow
  const photos = (p.photos || []).slice(0, 3).map((ph: any) => photoUrl(ph.name))
  return {
    rank,
    name:           p.displayName?.text || '',
    address:        p.formattedAddress || p.shortFormattedAddress || '',
    rating:         p.rating || null,
    review_count:   p.userRatingCount || 0,
    website:        p.websiteUri || null,
    phone:          p.nationalPhoneNumber || p.internationalPhoneNumber || null,
    primary_type:   p.primaryType || null,
    type_label:     p.primaryTypeDisplayName?.text || null,
    types:          p.types || [],
    maps_url:       p.googleMapsUri || null,
    maps_links:     p.googleMapsLinks || null,
    place_id:       p.id || null,
    location:       p.location || null,
    business_status: p.businessStatus || 'OPERATIONAL',
    is_open_now:    isOpen ?? null,
    hours:          p.regularOpeningHours?.weekdayDescriptions || null,
    price_level:    p.priceLevel || null,
    photos:         photos.filter(Boolean),
    timezone:       p.timeZone?.id || null,
    source:         'google_places_new',
  }
}

// ── Claude AI analysis ────────────────────────────────────────────────────────
async function analyzeWithClaude(results: any[], keyword: string, location: string, targetBusiness: string, details: any) {
  if (!ANTHROPIC_KEY || !results.length) return null

  const top10 = results.slice(0, 10).map(r => {
    const hrs = r.hours ? `Hours: ${r.hours[0]}` : ''
    const open = r.is_open_now !== null ? (r.is_open_now ? ' [OPEN NOW]' : ' [CLOSED NOW]') : ''
    const price = r.price_level ? ` Price: ${r.price_level}` : ''
    return `${r.rank}. ${r.name}${open} — ★${r.rating||'?'} (${r.review_count} reviews)${price} — ${r.address}`
  }).join('\n')

  const targetResult = results.find(r => r.name?.toLowerCase().includes(targetBusiness.toLowerCase()))
  const targetRank   = targetResult ? targetResult.rank : null
  const targetDetail = details?.[targetResult?.place_id]

  const competitorDetail = results.slice(0, 3).map(r => {
    const d = details?.[r.place_id]
    return `${r.rank}. ${r.name}: ${r.review_count} reviews, ${r.rating}★${d?.editorialSummary?.text ? ', "' + d.editorialSummary.text + '"' : ''}`
  }).join('\n')

  const prompt = `You are a local SEO expert analyzing Google Maps rankings for "${keyword}" in ${location}.

TOP 10 LOCAL PACK RESULTS:
${top10}

TOP 3 DETAILS:
${competitorDetail}

TARGET BUSINESS: "${targetBusiness}"
CURRENT RANK: ${targetRank ? '#' + targetRank : 'NOT FOUND in top 20'}
TARGET REVIEWS: ${targetResult ? targetResult.review_count : 'N/A'}
TARGET RATING: ${targetResult ? targetResult.rating : 'N/A'}
TARGET OPEN NOW: ${targetResult?.is_open_now !== null ? (targetResult?.is_open_now ? 'Yes' : 'No') : 'Unknown'}

Return ONLY valid JSON with no markdown:
{
  "overall_assessment": "2-3 sentences on competitive landscape and what it takes to rank here",
  "target_rank": ${targetRank || 'null'},
  "rank_difficulty": "easy|medium|hard|very_hard",
  "competitive_gap": {
    "review_gap": number (reviews needed to match #1),
    "rating_gap": number (rating difference from #1),
    "summary": "one line on the gap"
  },
  "top_3_analysis": [
    { "rank": 1, "name": "...", "why_ranking": "specific reason", "weaknesses": "exploitable weakness" }
  ],
  "recommendations": [
    { "priority": "high|medium|low", "action": "specific action", "impact": "expected result", "effort": "low|medium|high", "timeframe": "e.g. 1 week" }
  ],
  "quick_wins": ["specific action this week"],
  "estimated_time_to_rank": "e.g. 3-6 months with consistent effort",
  "review_strategy": "specific advice on getting more reviews",
  "hours_insight": "any insight about business hours vs competitors",
  "ranking_signals": ["key local ranking signals this business needs to optimize"]
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) return null
  const d = await res.json()
  const text = d.content?.[0]?.text || ''
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1))
  } catch { return { overall_assessment: text } }
}

export async function POST(req: NextRequest) {
  try {
    const {
      keyword, location, target_business, target_domain,
      radius_km = 16,
      include_ai       = true,
      include_details  = true,   // fetch Place Details for top 5
      search_mode      = 'auto', // auto | text | nearby
      max_results      = 20,
    } = await req.json()

    if (!keyword || !location) {
      return NextResponse.json({ error: 'keyword and location are required' }, { status: 400 })
    }
    if (!GOOGLE_KEY) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_GOOGLE_PLACES_KEY not configured' }, { status: 500 })
    }

    const startTime = Date.now()

    // Step 1: Geocode for Nearby Search
    const geo = await geocode(location)

    // Step 2: Search — prefer Nearby if we have coords, else Text Search
    let rawPlaces: any[] = []
    let searchType = search_mode

    if (search_mode === 'auto' || search_mode === 'nearby') {
      if (geo) {
        const res = await nearbySearch(keyword, geo.lat, geo.lng, radius_km * 1000, max_results)
        rawPlaces = res?.places || []
        searchType = 'nearby'
      }
    }

    // Fallback or explicit text search
    if (!rawPlaces.length || search_mode === 'text') {
      const res = await textSearch(keyword, location, max_results)
      rawPlaces = res?.places || []
      searchType = 'text'
    }

    // Step 3: Normalize results
    const places = rawPlaces
      .filter(p => p.businessStatus !== 'CLOSED_PERMANENTLY')
      .map((p, i) => normPlace(p, i + 1))

    // Step 4: Fetch Place Details for top 5 (opening hours, price, photos etc)
    const details: Record<string, any> = {}
    if (include_details && places.length > 0) {
      const top5 = places.slice(0, 5)
      await Promise.all(top5.map(async p => {
        if (p.place_id) {
          const d = await placeDetails(p.place_id)
          if (d) details[p.place_id] = d
        }
      }))
    }

    // Step 5: Merge detail data into places
    const enriched = places.map(p => {
      const d = details[p.place_id]
      if (!d) return p
      return {
        ...p,
        hours:         d.regularOpeningHours?.weekdayDescriptions || p.hours,
        is_open_now:   d.currentOpeningHours?.openNow ?? p.is_open_now,
        price_level:   d.priceLevel || p.price_level,
        price_range:   d.priceRange || null,
        editorial:     d.editorialSummary?.text || null,
        accessibility: d.accessibilityOptions || null,
        parking:       d.parkingOptions || null,
        payment:       d.paymentOptions || null,
        photos:        (d.photos || []).slice(0, 4).map((ph: any) => photoUrl(ph.name, 400)).filter(Boolean),
      }
    })

    // Step 6: Find target rank
    const targetResult = target_business
      ? enriched.find(r => r.name?.toLowerCase().includes(target_business.toLowerCase()))
      : null
    const targetRank = targetResult?.rank || null

    // Step 7: Competitive stats
    const ranked = enriched.filter(r => r.rating)
    const avgRating     = ranked.length ? (ranked.reduce((s, r) => s + (r.rating || 0), 0) / ranked.length).toFixed(1) : null
    const avgReviews    = ranked.length ? Math.round(ranked.reduce((s, r) => s + (r.review_count || 0), 0) / ranked.length) : null
    const top3Reviews   = enriched.slice(0, 3).reduce((s, r) => s + (r.review_count || 0), 0) / 3
    const openNowCount  = enriched.filter(r => r.is_open_now === true).length

    // Step 8: AI analysis
    let aiAnalysis = null
    if (include_ai && target_business) {
      aiAnalysis = await analyzeWithClaude(enriched, keyword, location, target_business, details)
    }

    return NextResponse.json({
      keyword, location, target_business,
      radius_km, search_mode: searchType,
      geocoded_location: geo ? { lat: geo.lat, lng: geo.lng, formatted: geo.formatted } : null,
      searched_at:  new Date().toISOString(),
      duration_ms:  Date.now() - startTime,
      google_local: enriched,
      target_rank:  targetRank,
      total_results: enriched.length,
      competitive_stats: {
        avg_rating:      avgRating,
        avg_reviews:     avgReviews,
        top3_avg_reviews: Math.round(top3Reviews),
        open_now_count:  openNowCount,
        has_photos:      enriched.filter(r => r.photos?.length > 0).length,
      },
      ai_analysis: aiAnalysis,
    })
  } catch (e: any) {
    console.error('local-rank error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
