import { NextRequest, NextResponse } from 'next/server'
import { trackPlatformCost, PLATFORM_RATES } from '@/lib/tokenTracker'

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || ''

// ── Geocode location → lat/lng ────────────────────────────────────────────────
async function geocode(location: string) {
  const r = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GOOGLE_KEY}`
  )
  if (!r.ok) return null
  const d = await r.json()
  void trackPlatformCost({
    cost_type: 'google_places', amount: PLATFORM_RATES.google_places, unit_count: 1,
    description: 'grid-scan geocode', metadata: { feature: 'seo_grid_scan', op: 'geocode' },
  })
  const loc = d.results?.[0]?.geometry?.location
  return loc ? { lat: loc.lat, lng: loc.lng, formatted: d.results[0].formatted_address } : null
}

// ── Search at a specific lat/lng point ────────────────────────────────────────
async function searchAtPoint(keyword: string, lat: number, lng: number, radiusM = 2000) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.businessStatus',
    },
    body: JSON.stringify({
      textQuery: keyword,
      maxResultCount: 20,
      rankPreference: 'POPULARITY',
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: Math.min(radiusM, 50000),
        },
      },
    }),
  })
  if (!r.ok) return []
  const d = await r.json()
  void trackPlatformCost({
    cost_type: 'google_places', amount: PLATFORM_RATES.google_places, unit_count: 1,
    description: 'grid-scan point search', metadata: { feature: 'seo_grid_scan', op: 'search_at_point' },
  })
  return (d.places || []).filter((p: any) => p.businessStatus !== 'CLOSED_PERMANENTLY')
}

// ── Offset lat/lng by km ──────────────────────────────────────────────────────
function offsetLatLng(lat: number, lng: number, deltaLatKm: number, deltaLngKm: number) {
  const latOffset = deltaLatKm / 110.574
  const lngOffset = deltaLngKm / (111.320 * Math.cos(lat * Math.PI / 180))
  return { lat: lat + latOffset, lng: lng + lngOffset }
}

// ── Generate grid points ──────────────────────────────────────────────────────
function generateGrid(centerLat: number, centerLng: number, gridSize: number, spacingKm: number) {
  const points = []
  const half = Math.floor(gridSize / 2)
  for (let row = -half; row <= half; row++) {
    for (let col = -half; col <= half; col++) {
      const pt = offsetLatLng(centerLat, centerLng, -row * spacingKm, col * spacingKm)
      points.push({ lat: pt.lat, lng: pt.lng, row, col })
    }
  }
  return points
}

export async function POST(req: NextRequest) {
  try {
    const {
      keyword,
      location,
      target_business,
      grid_size     = 3,       // 3x3=9, 5x5=25, 7x7=49
      spacing_km    = 1.5,     // km between grid points
      search_radius_km = 2,    // search radius at each point
    } = await req.json()

    if (!keyword || !location || !target_business) {
      return NextResponse.json({ error: 'keyword, location, and target_business required' }, { status: 400 })
    }
    if (!GOOGLE_KEY) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_GOOGLE_PLACES_KEY not configured' }, { status: 500 })
    }
    if (grid_size > 7) {
      return NextResponse.json({ error: 'Max grid size is 7x7' }, { status: 400 })
    }

    const startTime = Date.now()

    // Geocode center
    const geo = await geocode(location)
    if (!geo) return NextResponse.json({ error: `Could not geocode: ${location}` }, { status: 400 })

    // Generate grid points
    const points = generateGrid(geo.lat, geo.lng, grid_size, spacing_km)
    const totalCells = points.length

    // Search each grid point (rate-limit: stagger requests)
    const gridResults = []
    let rankedCells = 0
    let rankSum = 0
    let bestRank = 999
    let worstRank = 0

    // Process in batches of 5 to avoid rate limiting
    const BATCH = 5
    for (let i = 0; i < points.length; i += BATCH) {
      const batch = points.slice(i, i + BATCH)
      const batchResults = await Promise.all(batch.map(async (pt) => {
        const places = await searchAtPoint(keyword, pt.lat, pt.lng, search_radius_km * 1000)
        // Find target business rank
        const rank = places.findIndex((p: any) =>
          p.displayName?.text?.toLowerCase().includes(target_business.toLowerCase())
        ) + 1  // 0 means not found

        return {
          lat:    Math.round(pt.lat * 100000) / 100000,
          lng:    Math.round(pt.lng * 100000) / 100000,
          row:    pt.row,
          col:    pt.col,
          rank:   rank || null,  // null = not found in top 20
          total:  places.length,
          top3:   places.slice(0, 3).map((p: any) => p.displayName?.text || ''),
        }
      }))

      for (const r of batchResults) {
        gridResults.push(r)
        if (r.rank) {
          rankedCells++
          rankSum += r.rank
          if (r.rank < bestRank) bestRank = r.rank
          if (r.rank > worstRank) worstRank = r.rank
        }
      }

      // Small delay between batches to avoid quota limits
      if (i + BATCH < points.length) {
        await new Promise(res => setTimeout(res, 200))
      }
    }

    const avgRank = rankedCells > 0 ? Math.round((rankSum / rankedCells) * 10) / 10 : null

    return NextResponse.json({
      keyword,
      location,
      target_business,
      grid_size,
      spacing_km,
      search_radius_km,
      geocoded: { lat: geo.lat, lng: geo.lng, formatted: geo.formatted },
      grid_results: gridResults,
      summary: {
        total_cells:  totalCells,
        ranked_cells: rankedCells,
        avg_rank:     avgRank,
        best_rank:    bestRank < 999 ? bestRank : null,
        worst_rank:   worstRank || null,
        coverage_pct: Math.round(rankedCells / totalCells * 100),
      },
      scanned_at:  new Date().toISOString(),
      duration_ms: Date.now() - startTime,
    })
  } catch (e: any) {
    console.error('grid-scan error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
