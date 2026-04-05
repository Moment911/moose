import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()
    if (!query?.trim()) return NextResponse.json({ error: 'query required' }, { status: 400 })

    if (!GOOGLE_KEY) {
      return NextResponse.json({
        error: 'Google Places API key not configured',
        hint: 'Add NEXT_PUBLIC_GOOGLE_PLACES_KEY to Vercel environment variables',
        results: []
      }, { status: 200 }) // 200 so UI can show the message
    }

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri,places.photos',
      },
      body: JSON.stringify({ textQuery: query.trim(), maxResultCount: 5 }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({
        error: data.error?.message || 'Google API error',
        status: res.status,
        results: []
      }, { status: 200 })
    }

    const results = (data.places || []).map((p: any) => ({
      place_id:     p.id,
      name:         p.displayName?.text || '',
      address:      p.formattedAddress || '',
      phone:        p.nationalPhoneNumber || '',
      website:      p.websiteUri || '',
      rating:       p.rating,
      review_count: p.userRatingCount,
      photo: p.photos?.[0]?.name
        ? `https://places.googleapis.com/v1/${p.photos[0].name}/media?maxWidthPx=120&key=${GOOGLE_KEY}`.trim()
        : null,
    }))

    return NextResponse.json({ results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, results: [] }, { status: 200 })
  }
}
