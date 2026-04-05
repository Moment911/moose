import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const GOOGLE_KEY    = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || ''
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const PLACE_FIELDS = 'id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,rating,userRatingCount,regularOpeningHours,primaryType,photos,editorialSummary,location,googleMapsUri,reviews,priceLevel'

async function fetchPlace(placeId: string) {
  if (!GOOGLE_KEY) return null
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': PLACE_FIELDS }
  })
  if (!res.ok) return null
  return res.json()
}

async function searchNearby(lat: number, lng: number, type: string, excludeId: string) {
  if (!GOOGLE_KEY) return []
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.photos,places.regularOpeningHours,places.websiteUri,places.nationalPhoneNumber,places.formattedAddress,places.editorialSummary,places.location',
    },
    body: JSON.stringify({
      includedTypes: [type || 'establishment'],
      maxResultCount: 10,
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radiusInMeters: 8000 } },
    })
  })
  if (!res.ok) return []
  const d = await res.json()
  return (d.places || []).filter((p: any) => p.id !== excludeId)
}

async function searchByName(query: string, location: string) {
  if (!GOOGLE_KEY) return []
  const res = await fetch(`https://places.googleapis.com/v1/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.photos,places.regularOpeningHours,places.websiteUri,places.nationalPhoneNumber,places.formattedAddress,places.location',
    },
    body: JSON.stringify({ textQuery: `${query} ${location}`, maxResultCount: 5 })
  })
  if (!res.ok) return []
  const d = await res.json()
  return d.places || []
}

function scoreCompetitor(place: any) {
  let score = 0
  if (place.rating >= 4.5) score += 25
  else if (place.rating >= 4.0) score += 15
  else if (place.rating >= 3.5) score += 5
  if (place.userRatingCount >= 100) score += 25
  else if (place.userRatingCount >= 50) score += 15
  else if (place.userRatingCount >= 10) score += 8
  if (place.websiteUri) score += 15
  if (place.regularOpeningHours?.periods?.length) score += 10
  if ((place.photos?.length || 0) >= 10) score += 15
  else if ((place.photos?.length || 0) >= 5) score += 8
  if (place.editorialSummary?.text) score += 10
  return Math.min(100, score)
}

async function generateIntelligence(clientPlace: any, competitors: any[], clientName: string) {
  if (!ANTHROPIC_KEY || !competitors.length) return null

  const compData = competitors.slice(0, 6).map((c: any, i: number) => ({
    rank: i + 1,
    name: c.displayName?.text,
    rating: c.rating,
    reviews: c.userRatingCount,
    has_website: !!c.websiteUri,
    has_hours: !!c.regularOpeningHours?.periods?.length,
    photos: c.photos?.length || 0,
    description: c.editorialSummary?.text?.slice(0, 100),
  }))

  const prompt = `You are a competitive intelligence analyst for local businesses.

Client: ${clientName}
Client stats: ${clientPlace.rating}★ (${clientPlace.userRatingCount} reviews), ${clientPlace.photos?.length || 0} photos, website: ${clientPlace.websiteUri ? 'yes' : 'no'}

Top ${compData.length} competitors in the area:
${JSON.stringify(compData, null, 2)}

Return ONLY valid JSON:
{
  "market_position": "1-2 sentence summary of client's position in local market",
  "biggest_threat": {"name": "competitor name", "reason": "why they are the biggest threat"},
  "biggest_opportunity": "specific gap in the market the client can exploit",
  "strengths": ["what client does better than most competitors"],
  "weaknesses": ["where competitors beat the client"],
  "recommended_actions": [
    {"action": "specific action", "impact": "high|medium|low", "effort": "high|medium|low", "timeframe": "1 week|1 month|3 months"}
  ],
  "competitive_score": 0-100,
  "market_leader": {"name": "name of market leader", "why": "why they lead"},
  "quick_wins": ["win 1", "win 2", "win 3"]
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] })
  })
  if (!res.ok) return null
  const d = await res.json()
  try {
    let text = d.content?.[0]?.text?.trim() || '{}'
    text = text.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim()
    const s = text.indexOf('{'), e = text.lastIndexOf('}')
    if (s >= 0 && e > s) text = text.slice(s, e + 1)
    return JSON.parse(text)
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const { client_id, agency_id, place_id, competitor_names, location, business_name } = await req.json()
    if (!place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 })

    // Fetch client GBP
    const clientPlace = await fetchPlace(place_id)
    if (!clientPlace) return NextResponse.json({ error: 'Could not fetch business — check Place ID' }, { status: 400 })

    const lat = clientPlace.location?.latitude || 0
    const lng = clientPlace.location?.longitude || 0
    const type = clientPlace.primaryType || 'establishment'
    const name = business_name || clientPlace.displayName?.text || ''

    // Get nearby competitors automatically
    let competitors = lat ? await searchNearby(lat, lng, type, place_id) : []

    // Also search any manually added competitor names
    if (competitor_names?.length) {
      for (const cname of competitor_names.slice(0, 3)) {
        const found = await searchByName(cname, location || clientPlace.formattedAddress || '')
        competitors = [...competitors, ...found.filter((f: any) => f.id !== place_id && !competitors.find((c: any) => c.id === f.id))]
      }
    }

    // Score and sort competitors
    const scoredCompetitors = competitors.map((c: any) => ({
      place_id:     c.id,
      name:         c.displayName?.text || '',
      address:      c.formattedAddress || '',
      rating:       c.rating || null,
      review_count: c.userRatingCount || 0,
      photo_count:  c.photos?.length || 0,
      has_website:  !!c.websiteUri,
      website:      c.websiteUri || '',
      has_hours:    !!(c.regularOpeningHours?.periods?.length),
      description:  c.editorialSummary?.text || '',
      lat:          c.location?.latitude,
      lng:          c.location?.longitude,
      score:        scoreCompetitor(c),
    })).sort((a: any, b: any) => b.score - a.score)

    // AI analysis
    const intel = await generateIntelligence(clientPlace, competitors, name)

    const result = {
      client: {
        place_id,
        name,
        rating:       clientPlace.rating || null,
        review_count: clientPlace.userRatingCount || 0,
        photo_count:  clientPlace.photos?.length || 0,
        has_website:  !!clientPlace.websiteUri,
        website:      clientPlace.websiteUri || '',
        has_hours:    !!(clientPlace.regularOpeningHours?.periods?.length),
        score:        scoreCompetitor(clientPlace),
      },
      competitors:  scoredCompetitors,
      intel,
      snapshot_at:  new Date().toISOString(),
    }

    // Save snapshots to DB
    if (client_id) {
      const sb = getSupabase()
      // Delete old snapshots for this client
      await sb.from('competitor_snapshots').delete().eq('client_id', client_id)
      // Insert new ones
      if (scoredCompetitors.length) {
        await sb.from('competitor_snapshots').insert(
          scoredCompetitors.slice(0, 8).map((comp: any) => ({
            client_id,
            agency_id,
            competitor_name: comp.name,
            place_id:        comp.place_id,
            rating:          comp.rating,
            review_count:    comp.review_count,
            snapshot_data:   comp,
          }))
        )
      }
    }

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
