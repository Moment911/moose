import { NextRequest, NextResponse } from 'next/server'
import { trackPlatformCost, PLATFORM_RATES } from '@/lib/tokenTracker'

const GOOGLE_KEY    = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || ''
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const FIELDS = 'id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,rating,userRatingCount,businessStatus,regularOpeningHours,primaryType,types,photos,editorialSummary,location,googleMapsUri,reviews'

async function fetchPlace(placeId: string) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': FIELDS }
  })
  if (!res.ok) return null
  void trackPlatformCost({
    cost_type: 'google_places', amount: PLATFORM_RATES.google_places, unit_count: 1,
    description: 'GBP audit — place details', metadata: { feature: 'gbp_audit', place_id: placeId },
  })
  return res.json()
}

async function fetchNearbyCompetitors(placeId: string, type: string, lat: number, lng: number) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.photos,places.regularOpeningHours,places.websiteUri',
    },
    body: JSON.stringify({
      includedTypes: [type || 'establishment'],
      maxResultCount: 5,
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radiusInMeters: 5000 } },
    })
  })
  if (!res.ok) return []
  const d = await res.json()
  void trackPlatformCost({
    cost_type: 'google_places', amount: PLATFORM_RATES.google_places, unit_count: 1,
    description: 'GBP audit — nearby competitors', metadata: { feature: 'gbp_audit', type },
  })
  return (d.places || []).filter((p: any) => p.id !== placeId).slice(0, 4)
}

function scoreGBP(place: any) {
  const checks = [
    { key: 'name',        pass: !!place.displayName?.text,                     weight: 10, label: 'Business name set',      fix: 'Add your business name in GBP' },
    { key: 'address',     pass: !!place.formattedAddress,                       weight: 10, label: 'Address verified',        fix: 'Verify your address in Google Business Profile' },
    { key: 'phone',       pass: !!place.nationalPhoneNumber,                    weight: 8,  label: 'Phone number added',      fix: 'Add a local phone number to your GBP listing' },
    { key: 'website',     pass: !!place.websiteUri,                             weight: 8,  label: 'Website linked',          fix: 'Link your website URL in GBP' },
    { key: 'hours',       pass: !!(place.regularOpeningHours?.periods?.length), weight: 9,  label: 'Business hours complete', fix: 'Add complete business hours for every open day' },
    { key: 'category',    pass: !!place.primaryType,                            weight: 10, label: 'Primary category set',    fix: 'Set the most specific primary business category possible' },
    { key: 'photos5',     pass: (place.photos?.length || 0) >= 5,              weight: 10, label: '5+ photos uploaded',      fix: 'Upload at least 5 photos: exterior, interior, team, product/work' },
    { key: 'reviews10',   pass: (place.userRatingCount || 0) >= 10,            weight: 8,  label: '10+ reviews',             fix: 'Text recent customers a direct review link from GBP dashboard' },
    { key: 'rating4',     pass: (place.rating || 0) >= 4.0,                    weight: 7,  label: 'Rating 4.0 or higher',    fix: 'Respond to all reviews promptly, especially negative ones' },
    { key: 'description', pass: !!place.editorialSummary?.text,                 weight: 8,  label: 'Business description',    fix: 'Write a 250-word keyword-rich description in GBP Info tab' },
    { key: 'active',      pass: place.businessStatus === 'OPERATIONAL',         weight: 10, label: 'Listing is active',       fix: 'Check GBP for suspension notices or pending verification' },
    { key: 'photos10',    pass: (place.photos?.length || 0) >= 10,             weight: 2,  label: '10+ photos (bonus)',       fix: 'Upload 10+ photos for maximum profile completeness' },
  ]
  let earned = 0, total = 0
  const passes: string[] = [], fails: {label:string;fix:string;weight:number}[] = []
  for (const c of checks) {
    total += c.weight
    if (c.pass) { earned += c.weight; passes.push(c.label) }
    else fails.push({ label: c.label, fix: c.fix, weight: c.weight })
  }
  fails.sort((a, b) => b.weight - a.weight)
  return { score: Math.round((earned / total) * 100), passes, fails }
}

async function generateAIInsights(place: any, competitors: any[], scoreData: any) {
  if (!ANTHROPIC_KEY) throw new Error('Add ANTHROPIC_API_KEY to Vercel env vars')
  const name = place.displayName?.text || 'Business'
  const compSummary = competitors.map(c =>
    `- ${c.displayName?.text}: ${c.rating || 'N/A'}★ (${c.userRatingCount || 0} reviews), ${c.photos?.length || 0} photos, hours: ${c.regularOpeningHours ? 'yes' : 'no'}`
  ).join('\n') || 'No nearby competitors found'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514', max_tokens: 900,
      messages: [{ role: 'user', content:
        `You are a local SEO expert auditing a Google Business Profile.

Business: ${name}
GBP Score: ${scoreData.score}/100
Passing checks: ${scoreData.passes.join(', ')}
Missing: ${scoreData.fails.map((f: any) => f.label).join(', ')}
Reviews: ${place.userRatingCount || 0} at ${place.rating || 'N/A'}★
Photos: ${place.photos?.length || 0}

Nearest Competitors:
${compSummary}

Return ONLY valid JSON, no markdown:
{"overall_assessment":"2-3 sentence honest evaluation","biggest_opportunity":"single most impactful action","vs_competitors":"2 sentence competitive comparison","review_strategy":"specific actionable steps to get more reviews fast","photo_strategy":"what specific photos to shoot and upload","quick_wins":["win 1","win 2","win 3"],"estimated_rank_impact":"what improving this score could do for local map pack rankings"}`
      }]
    })
  })
  if (!res.ok) return null
  const d = await res.json()
  try {
    let text = d.content?.[0]?.text?.trim() || '{}'
    text = text.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim()
    const s = text.indexOf('{'), e = text.lastIndexOf('}')
    if (s >= 0 && e > s) text = text.slice(s, e+1)
    return JSON.parse(text)
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const { place_id, client_id, agency_id } = await req.json()
    if (!place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 })
    if (!GOOGLE_KEY) return NextResponse.json({ error: 'NEXT_PUBLIC_GOOGLE_PLACES_KEY not configured' }, { status: 500 })

    const place = await fetchPlace(place_id)
    if (!place) return NextResponse.json({ error: 'Could not fetch GBP — verify Place ID is correct' }, { status: 400 })

    const lat = place.location?.latitude || 0
    const lng = place.location?.longitude || 0
    const scoreData = scoreGBP(place)
    const competitors = lat ? await fetchNearbyCompetitors(place_id, place.primaryType || 'establishment', lat, lng) : []
    const ai = await generateAIInsights(place, competitors, scoreData)

    const result = {
      place_id,
      business_name: place.displayName?.text || '',
      address:       place.formattedAddress || '',
      phone:         place.nationalPhoneNumber || '',
      website:       place.websiteUri || '',
      rating:        place.rating || null,
      review_count:  place.userRatingCount || 0,
      photo_count:   place.photos?.length || 0,
      has_hours:     !!(place.regularOpeningHours?.periods?.length),
      category:      place.primaryType || '',
      maps_url:      place.googleMapsUri || '',
      business_status: place.businessStatus || '',
      score:         scoreData.score,
      passes:        scoreData.passes,
      fails:         scoreData.fails,
      competitors:   competitors.map((c: any) => ({
        name:         c.displayName?.text || '',
        rating:       c.rating || null,
        review_count: c.userRatingCount || 0,
        has_website:  !!c.websiteUri,
        has_hours:    !!(c.regularOpeningHours?.periods?.length),
        photo_count:  c.photos?.length || 0,
      })),
      ai,
      audited_at: new Date().toISOString(),
    }

    if (client_id && SUPABASE_URL) {
      await fetch(`${SUPABASE_URL}/rest/v1/gbp_audits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ client_id, agency_id, place_id, business_name: result.business_name, score: scoreData.score, audit_data: result, recommendations: scoreData.fails }),
      })
    }

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
