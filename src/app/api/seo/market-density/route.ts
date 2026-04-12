import { NextRequest, NextResponse } from 'next/server'
import { trackPlatformCost, PLATFORM_RATES } from '@/lib/tokenTracker'

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY || ''

// Geocode a location string to lat/lng
async function geocode(location: string) {
  const r = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GOOGLE_KEY}`
  )
  if (!r.ok) return null
  const d = await r.json()
  void trackPlatformCost({
    cost_type: 'google_places', amount: PLATFORM_RATES.google_places, unit_count: 1,
    description: 'market-density geocode', metadata: { feature: 'seo_market_density', op: 'geocode' },
  })
  const loc = d.results?.[0]?.geometry?.location
  if (!loc) return null
  return {
    lat: loc.lat,
    lng: loc.lng,
    formatted: d.results[0].formatted_address,
    components: d.results[0].address_components,
  }
}

// Places Aggregate API — count + place IDs in a radius
async function computeInsights(lat: number, lng: number, radiusM: number, placeTypes: string[], filters: any = {}) {
  const body: any = {
    insights: ['INSIGHT_COUNT', 'INSIGHT_PLACES'],
    filter: {
      locationFilter: {
        circle: {
          latLng: { latitude: lat, longitude: lng },
          radius: Math.min(radiusM, 50000),
        },
      },
      typeFilter: {
        includedTypes: placeTypes,
      },
      operatingStatus: ['OPERATING'],
    },
  }

  if (filters.minRating) body.filter.ratingFilter = { minRating: filters.minRating }
  if (filters.priceLevels?.length) body.filter.priceFilter = { priceLevels: filters.priceLevels }

  const r = await fetch('https://areainsights.googleapis.com/v1:computeInsights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_KEY },
    body: JSON.stringify(body),
  })

  if (!r.ok) {
    const err = await r.text()
    console.error('Places Aggregate error:', err)
    return null
  }
  void trackPlatformCost({
    cost_type: 'google_places', amount: PLATFORM_RATES.google_places, unit_count: 1,
    description: 'market-density aggregate insights', metadata: { feature: 'seo_market_density', op: 'compute_insights' },
  })
  return r.json()
}

// Build a market density profile for a given business type + location
export async function POST(req: NextRequest) {
  try {
    const {
      location,
      business_type,       // e.g. 'plumber'
      place_types,         // e.g. ['plumber'] — Google place type IDs
      radius_km = 16,
      include_quality_tiers = true,  // break down by rating/price
    } = await req.json()

    if (!location || (!business_type && !place_types?.length)) {
      return NextResponse.json({ error: 'location and business_type or place_types required' }, { status: 400 })
    }
    if (!GOOGLE_KEY) {
      return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 })
    }

    const geo = await geocode(location)
    if (!geo) return NextResponse.json({ error: 'Could not geocode location' }, { status: 400 })

    const types = place_types || [business_type.toLowerCase().replace(/\s+/g, '_')]
    const radiusM = radius_km * 1000

    // Run parallel queries for different quality tiers
    const queries: Record<string, Promise<any>> = {
      all: computeInsights(geo.lat, geo.lng, radiusM, types),
    }

    if (include_quality_tiers) {
      queries.high_rated    = computeInsights(geo.lat, geo.lng, radiusM, types, { minRating: 4.0 })
      queries.top_rated     = computeInsights(geo.lat, geo.lng, radiusM, types, { minRating: 4.5 })
      queries.budget        = computeInsights(geo.lat, geo.lng, radiusM, types, { priceLevels: ['PRICE_LEVEL_INEXPENSIVE'] })
      queries.premium       = computeInsights(geo.lat, geo.lng, radiusM, types, { priceLevels: ['PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE'] })
      // Also check 5km and 25km for context
      queries.within_5km    = computeInsights(geo.lat, geo.lng, 5000,    types)
      queries.within_25km   = computeInsights(geo.lat, geo.lng, 25000,   types)
    }

    const results = await Promise.all(Object.entries(queries).map(async ([key, p]) => {
      const r = await p
      return [key, r]
    }))

    const data: Record<string, any> = {}
    for (const [key, res] of results) {
      data[key] = {
        count: res?.count ?? null,
        place_ids: res?.placeIds?.slice(0, 20) || [],  // cap at 20 for API safety
        error: res === null ? 'query_failed' : null,
      }
    }

    // Build saturation score (0-100, higher = more saturated / harder market)
    const total  = data.all?.count || 0
    const per_sq_km = total / (Math.PI * Math.pow(radius_km, 2))
    const saturation = Math.min(100, Math.round(per_sq_km * 10))

    // Opportunity score (higher = better opportunity)
    const highRated = data.high_rated?.count || 0
    const qualityGap = total > 0 ? Math.round((1 - highRated / total) * 100) : 0

    return NextResponse.json({
      location,
      geocoded: { lat: geo.lat, lng: geo.lng, formatted: geo.formatted },
      business_type,
      place_types: types,
      radius_km,
      analyzed_at: new Date().toISOString(),
      market_data: data,
      summary: {
        total_competitors:  total,
        high_rated_count:   data.high_rated?.count || 0,
        top_rated_count:    data.top_rated?.count || 0,
        nearby_5km:         data.within_5km?.count || 0,
        nearby_25km:        data.within_25km?.count || 0,
        density_per_sq_km:  Math.round(per_sq_km * 10) / 10,
        saturation_score:   saturation,
        quality_gap_pct:    qualityGap,
        market_assessment:  saturation > 70 ? 'highly_saturated' : saturation > 40 ? 'competitive' : saturation > 15 ? 'moderate' : 'low_competition',
        opportunity_level:  qualityGap > 50 ? 'high' : qualityGap > 25 ? 'medium' : 'low',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
