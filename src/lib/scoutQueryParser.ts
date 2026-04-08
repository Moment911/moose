// ── Scout Natural Language Query Parser ──────────────────────────────────────
// Uses Claude to parse natural language business search queries into structured criteria.

export interface ParsedScoutQuery {
  industry_keywords: string[]
  industry_sic_code: string | null
  city: string | null
  state: string | null
  zip: string | null
  radius_miles: number
  min_rating: number | null
  max_rating: number | null
  min_reviews: number | null
  max_reviews: number | null
  has_website: boolean | null
  filters: string[]
  search_intent: string
}

const SIC_HINT = `SIC codes: plumber=1711, HVAC=1711, electrician=1731, roofing=1761, dentist=8021, doctor=8011, chiropractor=8049, restaurant=5812, auto repair=7532, lawyer=8111, accountant=8721, realtor=6531, insurance=6411, mortgage=6159, gym=7991, cleaning=7349, landscaping=0781, salon=7231, marketing=7389, contractor=1521, vet=0742, medspa=8099, solar=1731, senior care=8082, wedding=7221`

export async function parseNaturalLanguageQuery(query: string): Promise<ParsedScoutQuery> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY
  if (!apiKey) return fallbackParse(query)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Parse this business search query into structured JSON. Query: "${query}"\n\nReturn ONLY valid JSON:\n{"industry_keywords":["plumber"],"industry_sic_code":"1711","city":"Miami","state":"FL","zip":null,"radius_miles":25,"min_rating":null,"max_rating":null,"min_reviews":null,"max_reviews":50,"has_website":null,"filters":["under 50 reviews"],"search_intent":"Find plumbers in Miami with few reviews"}\n\n${SIC_HINT}`,
        }],
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return fallbackParse(query)
    const data = await res.json()
    const text = data.content?.[0]?.text || '{}'
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return fallbackParse(query)
  }
}

function fallbackParse(query: string): ParsedScoutQuery {
  const q = query.toLowerCase()
  const words = q.split(/\s+/)

  // Simple pattern matching
  let city: string | null = null
  let state: string | null = null
  const stateMatch = q.match(/\b([a-z]+),?\s+(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy)\b/i)
  if (stateMatch) { city = stateMatch[1]; state = stateMatch[2].toUpperCase() }

  const inMatch = q.match(/in\s+([a-z\s]+?)(?:\s+with|\s+under|\s+over|\s+that|\s*$)/i)
  if (inMatch && !city) city = inMatch[1].trim()

  let maxReviews: number | null = null
  const underMatch = q.match(/under\s+(\d+)\s+review/i)
  if (underMatch) maxReviews = parseInt(underMatch[1])

  let minRating: number | null = null
  let maxRating: number | null = null
  const ratingMatch = q.match(/(\d\.?\d?)\s*-\s*(\d\.?\d?)\s*star/i)
  if (ratingMatch) { minRating = parseFloat(ratingMatch[1]); maxRating = parseFloat(ratingMatch[2]) }

  const hasWebsite = q.includes('without a website') ? false : q.includes('with a website') ? true : null

  const sicMap: Record<string, string> = {
    plumb: '1711', hvac: '1711', heat: '1711', cool: '1711', electric: '1731',
    roof: '1761', dent: '8021', doctor: '8011', medical: '8011', chiro: '8049',
    restaurant: '5812', auto: '7532', mechanic: '7532', lawyer: '8111', attorney: '8111',
    account: '8721', cpa: '8721', real: '6531', realtor: '6531', insurance: '6411',
    mortgage: '6159', gym: '7991', fitness: '7991', clean: '7349', landscap: '0781',
    lawn: '0781', salon: '7231', hair: '7231', market: '7389',
  }

  let sicCode: string | null = null
  const industryKeywords: string[] = []
  for (const word of words) {
    for (const [key, code] of Object.entries(sicMap)) {
      if (word.startsWith(key)) { sicCode = code; industryKeywords.push(word); break }
    }
  }

  return {
    industry_keywords: industryKeywords.length > 0 ? industryKeywords : words.slice(0, 3),
    industry_sic_code: sicCode,
    city, state, zip: null,
    radius_miles: 25,
    min_rating: minRating, max_rating: maxRating,
    min_reviews: null, max_reviews: maxReviews,
    has_website: hasWebsite,
    filters: [],
    search_intent: query,
  }
}
