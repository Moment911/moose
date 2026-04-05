import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_KEY    = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || ''
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Search for a business by name + location to get Place ID
async function searchBusiness(query: string) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.photos',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 5 }),
  })
  if (!res.ok) return []
  const d = await res.json()
  return (d.places || []).map((p: any) => ({
    place_id:     p.id,
    name:         p.displayName?.text,
    address:      p.formattedAddress,
    rating:       p.rating,
    review_count: p.userRatingCount,
    maps_url:     p.googleMapsUri,
    photo:        p.photos?.[0]?.name
      ? `https://places.googleapis.com/v1/${p.photos[0].name}/media?maxWidthPx=120&key=${GOOGLE_KEY}`
      : null,
  }))
}

// Fetch reviews for a confirmed Place ID
async function fetchReviews(placeId: string) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,reviews,googleMapsUri',
    },
  })
  if (!res.ok) return null
  const d = await res.json()
  return {
    name:          d.displayName?.text,
    rating:        d.rating,
    total_reviews: d.userRatingCount,
    maps_url:      d.googleMapsUri,
    reviews: (d.reviews || []).map((r: any) => ({
      reviewer_name:  r.authorAttribution?.displayName,
      reviewer_photo: r.authorAttribution?.photoUri,
      rating:         r.rating,
      review_text:    r.text?.text,
      review_date:    r.publishTime,
      review_id:      r.name,
      platform:       'google',
      sentiment:      r.rating >= 4 ? 'positive' : r.rating <= 2 ? 'negative' : 'neutral',
    }))
  }
}

// Generate AI response
async function generateResponse(reviewText: string, rating: number, businessName: string) {
  if (!ANTHROPIC_KEY) return null
  const tone = rating >= 4 ? 'warm and grateful' : rating >= 3 ? 'professional and helpful' : 'empathetic and solution-focused'
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514', max_tokens: 280,
      messages: [{ role: 'user', content:
        `Write a ${tone} response to this ${rating}-star Google review for ${businessName}.\n\nReview: "${reviewText}"\n\nWrite a natural, specific 2-3 sentence response. Don't be generic. Sign off with just the business name. Return only the response text, no quotes.`
      }]
    })
  })
  if (!res.ok) return null
  const d = await res.json()
  return d.content?.[0]?.text?.trim() || null
}

async function dbFetch(path: string, opts: any = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=representation',
      ...(opts.headers || {}),
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    // Search for business by name/location — returns list to pick from
    if (action === 'search') {
      const { query } = body
      if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })
      const results = await searchBusiness(query)
      return NextResponse.json({ results })
    }

    // Fetch reviews for a chosen Place ID and save to DB
    if (action === 'fetch') {
      const { place_id, client_id, agency_id } = body
      if (!place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 })

      const data = await fetchReviews(place_id)
      if (!data) return NextResponse.json({ error: 'Could not fetch reviews from Google' }, { status: 400 })

      // Upsert reviews into DB
      if (client_id && data.reviews.length > 0) {
        for (const r of data.reviews) {
          await dbFetch('reviews', {
            method: 'POST',
            headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
            body: JSON.stringify({ ...r, client_id, agency_id,
              // store place_id on the client for future auto-refresh
            }),
          })
        }
        // Save place_id on the client record for future auto-fetches
        await dbFetch(`clients?id=eq.${client_id}`, {
          method: 'PATCH',
          body: JSON.stringify({ google_place_id: place_id }),
        })
      }
      return NextResponse.json({ ...data, saved: data.reviews.length })
    }

    // Generate AI response for a review
    if (action === 'generate_response') {
      const { review_text, rating, business_name } = body
      if (!review_text) return NextResponse.json({ error: 'review_text required' }, { status: 400 })
      const response = await generateResponse(review_text, rating || 3, business_name || 'our business')
      return NextResponse.json({ response })
    }

    // Save a response
    if (action === 'save_response') {
      const { review_id, response_text } = body
      await dbFetch(`reviews?id=eq.${review_id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ response_text, is_responded: true, responded_at: new Date().toISOString() }),
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
