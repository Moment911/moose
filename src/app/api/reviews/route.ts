import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_KEY      = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || ''
const ANTHROPIC_KEY   = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Fetch Google reviews for a Place ID
async function fetchGoogleReviews(placeId: string) {
  const fields = 'id,displayName,rating,userRatingCount,reviews,googleMapsUri'
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    { headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': fields } }
  )
  if (!res.ok) return null
  const d = await res.json()
  return {
    name:         d.displayName?.text,
    rating:       d.rating,
    total_reviews: d.userRatingCount,
    maps_url:     d.googleMapsUri,
    reviews: (d.reviews || []).map((r: any) => ({
      reviewer_name:  r.authorAttribution?.displayName,
      reviewer_photo: r.authorAttribution?.photoUri,
      rating:         r.rating,
      review_text:    r.text?.text,
      review_date:    r.publishTime,
      review_id:      r.name,
      platform:       'google',
    }))
  }
}

// Generate AI response suggestion
async function generateResponse(review: any, businessName: string) {
  if (!ANTHROPIC_KEY) return null
  const tone = review.rating >= 4 ? 'warm and grateful' : review.rating >= 3 ? 'professional and helpful' : 'empathetic and solution-focused'
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514', max_tokens: 300,
      messages: [{ role: 'user', content:
        `Write a ${tone} response to this ${review.rating}-star Google review for ${businessName}.\n\nReview: "${review.review_text}"\n\nWrite a natural, specific 2-3 sentence response. Don't be generic. Sign off with just the business name. No quotes around the response.`
      }]
    })
  })
  if (!res.ok) return null
  const d = await res.json()
  return d.content?.[0]?.text?.trim() || null
}

export async function POST(req: NextRequest) {
  try {
    const { action, client_id, agency_id, place_id, business_name, review_id, custom_response } = await req.json()

    if (action === 'fetch') {
      if (!place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 })
      const data = await fetchGoogleReviews(place_id)
      if (!data) return NextResponse.json({ error: 'Could not fetch reviews' }, { status: 400 })

      // Save reviews to DB
      if (client_id && data.reviews.length > 0) {
        for (const r of data.reviews) {
          await fetch(`${SUPABASE_URL}/rest/v1/reviews`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Prefer': 'resolution=ignore-duplicates',
            },
            body: JSON.stringify({ ...r, client_id, agency_id }),
          })
        }
      }
      return NextResponse.json(data)
    }

    if (action === 'generate_response') {
      const prompt = { rating: req.body, review_text: '' }
      // Get review details from DB
      const dbRes = await fetch(
        `${SUPABASE_URL}/rest/v1/reviews?id=eq.${review_id}&select=*`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const reviews = await dbRes.json()
      const review = reviews[0]
      if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
      const response = await generateResponse(review, business_name || 'our business')
      return NextResponse.json({ response })
    }

    if (action === 'save_response') {
      await fetch(`${SUPABASE_URL}/rest/v1/reviews?id=eq.${review_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ response_text: custom_response, is_responded: true, responded_at: new Date().toISOString() }),
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
