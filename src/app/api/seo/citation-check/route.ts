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

// Top 20 local business directories
const DIRECTORIES = [
  { name:'Google Business Profile', domain:'business.google.com',   url:'https://business.google.com',  weight:10, category:'primary' },
  { name:'Yelp',                    domain:'yelp.com',              url:'https://yelp.com',              weight:9,  category:'primary' },
  { name:'Facebook',                domain:'facebook.com',          url:'https://facebook.com/business', weight:8,  category:'primary' },
  { name:'Bing Places',             domain:'bingplaces.com',        url:'https://bingplaces.com',        weight:7,  category:'primary' },
  { name:'Apple Maps',              domain:'maps.apple.com',        url:'https://maps.apple.com',        weight:7,  category:'primary' },
  { name:'BBB',                     domain:'bbb.org',               url:'https://bbb.org',               weight:7,  category:'trust' },
  { name:'Yellow Pages',            domain:'yellowpages.com',       url:'https://yellowpages.com',       weight:6,  category:'secondary' },
  { name:'Angi',                    domain:'angi.com',              url:'https://angi.com',              weight:6,  category:'secondary' },
  { name:'Houzz',                   domain:'houzz.com',             url:'https://houzz.com',             weight:5,  category:'secondary' },
  { name:'HomeAdvisor',             domain:'homeadvisor.com',       url:'https://homeadvisor.com',       weight:5,  category:'secondary' },
  { name:'Thumbtack',               domain:'thumbtack.com',         url:'https://thumbtack.com',         weight:5,  category:'secondary' },
  { name:'Nextdoor',                domain:'nextdoor.com',          url:'https://nextdoor.com',          weight:5,  category:'secondary' },
  { name:'Foursquare',              domain:'foursquare.com',        url:'https://foursquare.com',        weight:4,  category:'secondary' },
  { name:'Manta',                   domain:'manta.com',             url:'https://manta.com',             weight:4,  category:'secondary' },
  { name:'Citysearch',              domain:'citysearch.com',        url:'https://citysearch.com',        weight:4,  category:'secondary' },
  { name:'MapQuest',                domain:'mapquest.com',          url:'https://mapquest.com',          weight:4,  category:'secondary' },
  { name:'Superpages',              domain:'superpages.com',        url:'https://superpages.com',        weight:3,  category:'secondary' },
  { name:'MerchantCircle',          domain:'merchantcircle.com',    url:'https://merchantcircle.com',   weight:3,  category:'secondary' },
  { name:'ChamberOfCommerce.com',   domain:'chamberofcommerce.com', url:'https://chamberofcommerce.com', weight:3,  category:'secondary' },
  { name:'EZlocal',                 domain:'ezlocal.com',           url:'https://ezlocal.com',           weight:2,  category:'secondary' },
]

// Search Google for a business listing on a specific directory
async function searchDirectory(dir: typeof DIRECTORIES[0], businessName: string, city: string, state: string) {
  if (!GOOGLE_KEY) return null
  try {
    // Use Places Text Search to find the business
    const query = `${businessName} ${dir.domain}`
    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_KEY}&cx=017576662512468239146:omuauf_ufkc&q=${encodeURIComponent(`site:${dir.domain} "${businessName}" "${city}"`)}&num=3`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return { found: false, listing_url: null, snippet: null }
    const data = await res.json()
    const items = data.items || []
    if (items.length === 0) return { found: false, listing_url: null, snippet: null }
    return {
      found:       true,
      listing_url: items[0].link,
      snippet:     items[0].snippet,
    }
  } catch { return { found: false, listing_url: null, snippet: null } }
}

// Check NAP consistency from snippet
function checkNAPConsistency(snippet: string | null, nap: { name: string; phone: string; address: string; city: string }) {
  if (!snippet) return { name_match: false, phone_match: false, address_match: false }
  const s = snippet.toLowerCase()
  const nameWords = nap.name.toLowerCase().split(' ').filter(w => w.length > 3)
  const nameMatch = nameWords.length > 0 && nameWords.filter(w => s.includes(w)).length >= Math.ceil(nameWords.length * 0.6)
  // Normalize phone: remove non-digits
  const phoneDigits = nap.phone?.replace(/\D/g,'') || ''
  const phoneMatch = phoneDigits.length >= 10 && s.includes(phoneDigits.slice(-10).replace(/(\d{3})(\d{3})(\d{4})/, '$1'))
    || (phoneDigits.length >= 7 && s.replace(/\D/g,'').includes(phoneDigits.slice(-7)))
  const addressMatch = nap.city ? s.includes(nap.city.toLowerCase()) : false
  return { name_match: nameMatch, phone_match: phoneMatch, address_match: addressMatch }
}

// Claude citation analysis
async function claudeAnalysis(client: any, results: any[]) {
  if (!ANTHROPIC_KEY) return null
  const found    = results.filter(r => r.found)
  const missing  = results.filter(r => !r.found)
  const score    = Math.round((found.length / results.length) * 100)

  const prompt = `You are a local SEO expert reviewing citation health for a local business.

Business: ${client.name}
Location: ${client.city || 'Unknown'}, ${client.state || ''}
Phone: ${client.phone || 'Not set'}
Website: ${client.website || 'Not set'}

Citation Score: ${score}/100

Found on (${found.length} directories):
${found.map(r => `- ${r.directory}${r.name_match===false?' (NAME MISMATCH)':''}${r.phone_match===false?' (PHONE MISMATCH)':''}`).join('\n') || 'None found'}

Missing from (${missing.length} directories):
${missing.map(r => `- ${r.directory} (importance: ${r.weight}/10)`).join('\n') || 'None missing'}

Return ONLY valid JSON:
{
  "summary": "2-3 sentence honest assessment of citation health",
  "score_context": "What this score means for local rankings",
  "top_priorities": ["directory 1 to fix first", "directory 2", "directory 3"],
  "consistency_issues": "Any NAP consistency problems found",
  "estimated_ranking_impact": "How fixing citations could improve local map pack rankings",
  "quick_win": "Single easiest action to take right now"
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, messages: [{ role:'user', content: prompt }] })
  })
  if (!res.ok) return null
  const d = await res.json()
  try {
    let text = d.content?.[0]?.text?.trim() || '{}'
    text = text.replace(/^```json\n?/,'').replace(/^```\n?/,'').replace(/\n?```$/,'').trim()
    const s = text.indexOf('{'), e = text.lastIndexOf('}')
    if (s >= 0 && e > s) text = text.slice(s, e+1)
    return JSON.parse(text)
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const { client_id, agency_id } = await req.json()
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    // Load client NAP data
    const { data: client } = await getSupabase().from('clients')
      .select('id,name,phone,address,city,state,zip,website')
      .eq('id', client_id).single()

    if (!client?.name) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const nap = {
      name:    client.name,
      phone:   client.phone || '',
      address: client.address || '',
      city:    client.city || '',
      state:   client.state || '',
    }

    // Check all directories in parallel (batches of 5)
    const results: any[] = []
    const batchSize = 5

    for (let i = 0; i < DIRECTORIES.length; i += batchSize) {
      const batch = DIRECTORIES.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(async dir => {
          const found = await searchDirectory(dir, nap.name, nap.city, nap.state)
          const nap_check = checkNAPConsistency(found?.snippet || null, nap)
          return {
            directory:     dir.name,
            directory_url: dir.url,
            domain:        dir.domain,
            category:      dir.category,
            weight:        dir.weight,
            found:         found?.found || false,
            listing_url:   found?.listing_url || null,
            snippet:       found?.snippet || null,
            ...nap_check,
          }
        })
      )
      results.push(...batchResults)
    }

    // Score
    const found       = results.filter(r => r.found)
    const score       = Math.round((found.length / results.length) * 100)
    const primaryFound = results.filter(r => r.category === 'primary' && r.found).length
    const primaryTotal = results.filter(r => r.category === 'primary').length
    const napIssues   = found.filter(r => r.found && (r.name_match === false || r.phone_match === false || r.address_match === false))

    // AI analysis
    const ai = await claudeAnalysis(client, results)

    const result = {
      client_id,
      client_name: client.name,
      nap,
      score,
      total_checked: results.length,
      found_count:   found.length,
      missing_count: results.filter(r => !r.found).length,
      primary_score: `${primaryFound}/${primaryTotal}`,
      nap_issues_count: napIssues.length,
      directories:   results,
      ai,
      checked_at:    new Date().toISOString(),
    }

    // Save to DB
    const sb = getSupabase()
    await sb.from('citation_checks').delete().eq('client_id', client_id)
    await sb.from('citation_checks').insert(
      results.map(r => ({
        client_id, agency_id,
        directory:     r.directory,
        directory_url: r.listing_url || r.directory_url,
        found:         r.found,
        name_match:    r.name_match,
        phone_match:   r.phone_match,
        address_match: r.address_match,
        listing_url:   r.listing_url,
      }))
    )

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
