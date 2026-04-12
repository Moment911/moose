import 'server-only' // fails the build if this module is ever imported from a client component
// ── Scout Search Engine ──────────────────────────────────────────────────────
// Runs Google Places searches, enriches leads, scores opportunities.

import { createClient } from '@supabase/supabase-js'
import type { ParsedScoutQuery } from './scoutQueryParser'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export interface ScoutLead {
  business_name: string
  phone: string | null
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  google_place_id: string | null
  google_rating: number | null
  google_review_count: number | null
  google_business_status: string | null
  google_profile_url: string | null
  industry_sic_code: string | null
  industry_name: string | null
  lead_score: number
  opportunity_score: number
  opportunity_explanation: string
  source: string
}

export async function runScoutSearch(
  searchId: string,
  criteria: ParsedScoutQuery,
  agencyId: string,
  maxResults: number = 60
): Promise<{ found: number; leads: ScoutLead[] }> {
  const supabase = getSupabase()
  const placesKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY
  if (!placesKey) return { found: 0, leads: [] }

  // Build search query
  const queryParts = [...criteria.industry_keywords]
  if (criteria.city) queryParts.push(criteria.city)
  if (criteria.state) queryParts.push(criteria.state)
  const searchQuery = queryParts.join(' ')

  // Update search status
  await supabase.from('koto_scout_searches').update({ status: 'running' }).eq('id', searchId)

  const allLeads: ScoutLead[] = []
  let pageToken: string | null = null
  let pages = 0
  const maxPages = Math.ceil(maxResults / 20)

  while (pages < maxPages) {
    try {
      // Use Places Text Search (new API)
      let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${placesKey}`
      if (pageToken) url += `&pagetoken=${pageToken}`

      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) break

      const data = await res.json()
      const results = data.results || []

      for (const place of results) {
        if (allLeads.length >= maxResults) break

        // Apply filters
        if (criteria.min_rating && (place.rating || 0) < criteria.min_rating) continue
        if (criteria.max_rating && (place.rating || 5) > criteria.max_rating) continue
        if (criteria.min_reviews && (place.user_ratings_total || 0) < criteria.min_reviews) continue
        if (criteria.max_reviews && (place.user_ratings_total || 0) > criteria.max_reviews) continue

        // Extract phone via Place Details if needed
        let phone: string | null = null
        let website: string | null = null
        if (place.place_id) {
          try {
            const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website,url&key=${placesKey}`
            const detailRes = await fetch(detailUrl, { signal: AbortSignal.timeout(5000) })
            if (detailRes.ok) {
              const detailData = await detailRes.json()
              phone = detailData.result?.formatted_phone_number || null
              website = detailData.result?.website || null
            }
          } catch { /* continue without details */ }
        }

        // Apply website filter
        if (criteria.has_website === true && !website) continue
        if (criteria.has_website === false && website) continue

        // Score opportunity
        const { score, explanation } = scoreOpportunity(
          place.rating, place.user_ratings_total, website, place.business_status
        )

        const lead: ScoutLead = {
          business_name: place.name || 'Unknown',
          phone,
          website,
          address: place.formatted_address || null,
          city: criteria.city || extractCity(place.formatted_address),
          state: criteria.state || extractState(place.formatted_address),
          zip: extractZip(place.formatted_address),
          google_place_id: place.place_id || null,
          google_rating: place.rating || null,
          google_review_count: place.user_ratings_total || null,
          google_business_status: place.business_status || null,
          google_profile_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          industry_sic_code: criteria.industry_sic_code || null,
          industry_name: criteria.industry_keywords?.[0] || null,
          lead_score: Math.min(100, score + 10),
          opportunity_score: score,
          opportunity_explanation: explanation,
          source: 'scout',
        }

        allLeads.push(lead)
      }

      pageToken = data.next_page_token || null
      if (!pageToken || allLeads.length >= maxResults) break
      pages++

      // Google requires a short delay before using next_page_token
      await new Promise(r => setTimeout(r, 2000))
    } catch (e: any) {
      console.error('Scout search error:', e.message)
      break
    }
  }

  // Save leads to database
  if (allLeads.length > 0) {
    const rows = allLeads.map(lead => ({
      agency_id: agencyId,
      search_id: searchId,
      business_name: lead.business_name,
      phone: lead.phone,
      website: lead.website,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      zip: lead.zip,
      google_place_id: lead.google_place_id,
      google_rating: lead.google_rating,
      google_review_count: lead.google_review_count,
      google_business_status: lead.google_business_status,
      google_profile_url: lead.google_profile_url,
      industry_sic_code: lead.industry_sic_code,
      industry_name: lead.industry_name,
      lead_score: lead.lead_score,
      opportunity_score: lead.opportunity_score,
      lead_score_breakdown: { explanation: lead.opportunity_explanation },
      status: 'new',
      source: 'scout',
    }))

    await supabase.from('koto_scout_leads').insert(rows)
  }

  // Update search record
  await supabase.from('koto_scout_searches').update({
    status: 'completed',
    total_found: allLeads.length,
    completed_at: new Date().toISOString(),
  }).eq('id', searchId)

  return { found: allLeads.length, leads: allLeads }
}

function scoreOpportunity(
  rating: number | null,
  reviewCount: number | null,
  website: string | null,
  businessStatus: string | null
): { score: number; explanation: string } {
  let score = 50
  const reasons: string[] = []

  if (!rating || rating < 4.0) { score += 20; reasons.push('low rating') }
  if (rating && rating < 3.5) { score += 10; reasons.push('very low rating') }
  if (!reviewCount || reviewCount < 20) { score += 20; reasons.push('few reviews') }
  else if (reviewCount < 50) { score += 10; reasons.push('moderate reviews') }
  if (!website) { score += 25; reasons.push('no website') }
  if (businessStatus === 'OPERATIONAL') { score += 5 }

  score = Math.min(100, score)

  let explanation: string
  if (score >= 80) explanation = 'Hot opportunity -- ' + reasons.join(' + ') + '. Easy wins available.'
  else if (score >= 60) explanation = 'Good opportunity -- ' + reasons.join(' + ') + '.'
  else if (score >= 40) explanation = 'Average -- decent presence but room to grow.'
  else explanation = 'Established presence. Harder sell but possible.'

  return { score, explanation }
}

function extractCity(address: string | null): string | null {
  if (!address) return null
  const parts = address.split(',').map(p => p.trim())
  return parts.length >= 2 ? parts[parts.length - 3] || parts[0] : null
}

function extractState(address: string | null): string | null {
  if (!address) return null
  const match = address.match(/\b([A-Z]{2})\s+\d{5}/)
  return match ? match[1] : null
}

function extractZip(address: string | null): string | null {
  if (!address) return null
  const match = address.match(/\b(\d{5})\b/)
  return match ? match[1] : null
}

export async function generateOpeningLine(leadId: string): Promise<string | null> {
  const supabase = getSupabase()
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY
  if (!apiKey) return null

  const { data: lead } = await supabase.from('koto_scout_leads').select('*').eq('id', leadId).single()
  if (!lead) return null

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: `Generate a cold call opening line for this business. Keep it under 30 words, natural and conversational.\n\nBusiness: ${lead.business_name}\nCity: ${lead.city}, ${lead.state}\nRating: ${lead.google_rating}/5 (${lead.google_review_count} reviews)\nWebsite: ${lead.website || 'none'}\nIndustry: ${lead.industry_name || 'local business'}\n\nReturn ONLY the opening line, no quotes.` }],
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.content?.[0]?.text || null
  } catch { return null }
}
