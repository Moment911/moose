import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
const GOOGLE_KEY    = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || ''

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function getValidToken(conn: any) {
  if (conn.token_expires_at && new Date(conn.token_expires_at) > new Date(Date.now() + 60000)) {
    return conn.access_token
  }
  if (!conn.refresh_token) return conn.access_token
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || '',
        client_secret: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET?.trim() || '',
        refresh_token: conn.refresh_token,
        grant_type:    'refresh_token',
      }),
    })
    const d = await res.json()
    if (!d.access_token) return conn.access_token
    await getSupabase().from('seo_connections').update({
      access_token: d.access_token,
      token_expires_at: new Date(Date.now() + (d.expires_in || 3600) * 1000).toISOString(),
    }).eq('id', conn.id)
    return d.access_token
  } catch { return conn.access_token }
}

// Pull GSC keywords for this client
async function getGSCKeywords(clientId: string) {
  const sb = getSupabase()
  const { data: conn } = await sb.from('seo_connections')
    .select('*').eq('client_id', clientId).eq('provider', 'google').maybeSingle()
  if (!conn?.gsc_site) return []

  const token = await getValidToken(conn)
  if (!token) return []

  const end   = new Date().toISOString().split('T')[0]
  const start = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]

  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(conn.gsc_site)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: start, endDate: end,
        dimensions: ['query'],
        rowLimit: 500,
        aggregationType: 'auto',
      }),
    }
  )
  if (!res.ok) return []
  const d = await res.json()
  return (d.rows || []).map((r: any) => ({
    keyword:     r.keys[0],
    clicks:      r.clicks,
    impressions: r.impressions,
    ctr:         r.ctr,
    position:    Math.round(r.position * 10) / 10,
    source:      'gsc',
  }))
}

// Use Claude to generate keyword gap analysis
async function analyzeKeywordGap(
  clientKeywords: any[],
  businessName: string,
  industry: string,
  location: string,
  website: string,
  sicCode?: string
) {
  if (!ANTHROPIC_KEY) throw new Error('No Anthropic API key found. Add ANTHROPIC_API_KEY to Vercel environment variables (Settings → Environment Variables). Same value as NEXT_PUBLIC_ANTHROPIC_API_KEY but without the prefix.')

  const topKeywords = clientKeywords
    .sort((a: any, b: any) => b.impressions - a.impressions)
    .slice(0, 50)
    .map((k: any) => `${k.keyword} (pos: ${k.position}, impr: ${k.impressions})`)
    .join('\n')

  const prompt = `You are a local SEO strategist analyzing keyword opportunities for a local business.

Business: ${businessName}
Industry: ${industry}${sicCode ? ` (SIC Code: ${sicCode})` : ''}
Location: ${location}
Website: ${website}

Their current top keywords from Google Search Console (last 90 days):
${topKeywords || 'No GSC data available — generate based on industry/location'}

Analyze these keywords and generate a comprehensive keyword gap analysis. Return ONLY valid JSON:
{
  "summary": "2-3 sentence overview of their current keyword performance and biggest opportunity",
  "current_strengths": [
    {"keyword": "keyword they rank well for", "insight": "why this is good"}
  ],
  "gap_opportunities": [
    {
      "keyword": "keyword they should target",
      "intent": "informational|navigational|commercial|transactional",
      "difficulty": "easy|medium|hard",
      "priority": "high|medium|low",
      "monthly_volume_estimate": "estimated monthly searches",
      "current_rank": "Not ranking | position number if ranking poorly",
      "action": "specific action to rank for this keyword",
      "content_type": "blog post|service page|landing page|FAQ|location page"
    }
  ],
  "quick_wins": [
    {
      "keyword": "easy win keyword",
      "why": "why this is achievable quickly",
      "action": "exact action to take"
    }
  ],
  "location_keywords": [
    "city + service keyword opportunity 1",
    "city + service keyword opportunity 2",
    "near me keyword opportunity"
  ],
  "long_tail_opportunities": [
    "specific long-tail keyword 1",
    "specific long-tail keyword 2",
    "specific long-tail keyword 3"
  ],
  "competitor_keywords": [
    {
      "keyword": "keyword competitors likely rank for",
      "why_important": "business reason to target this"
    }
  ],
  "content_calendar": [
    {"month": 1, "topic": "title", "keyword": "target keyword", "type": "blog|page|faq", "priority": "high|medium"}
  ]
}

Important: Return ONLY the JSON object. No markdown, no backticks, no explanation.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const errBody = await res.text()
    console.error('[keyword-gap] Anthropic API error:', res.status, errBody.slice(0, 200))
    throw new Error(`Anthropic API ${res.status}: ${errBody.slice(0, 100)}`)
  }
  const d = await res.json()
  try {
    let text = d.content?.[0]?.text?.trim() || '{}'
    // Strip markdown code blocks if present
    text = text.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim()
    // Find first { and last } to extract JSON
    const start = text.indexOf('{')
    const end   = text.lastIndexOf('}')
    if (start >= 0 && end > start) text = text.slice(start, end + 1)
    return JSON.parse(text)
  } catch (e: any) {
    const rawText = d.content?.[0]?.text?.slice(0, 200) || 'empty'
    throw new Error(`JSON parse failed. Claude returned: ${rawText}`)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { client_id, agency_id, business_name, industry, location, website } = await req.json()
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    // Get client info if not provided
    let biz = business_name, ind = industry, loc = location, web = website, sic = ''
    if (!biz) {
      const { data: client } = await getSupabase().from('clients')
        .select('name,industry,sic_code,city,state,website').eq('id', client_id).maybeSingle()
      if (client) {
        biz = client.name
        ind = client.industry || ''
        loc = [client.city, client.state].filter(Boolean).join(', ')
        web = client.website || ''
        sic = client.sic_code || ''
      }
    }

    // Pull GSC keywords
    const gscKeywords = await getGSCKeywords(client_id)

    // Run AI analysis
    const analysis = await analyzeKeywordGap(gscKeywords, biz || '', ind || '', loc || '', web || '', sic || '')
    if (!analysis) {
      return NextResponse.json({ 
        error: 'AI analysis returned empty — check Vercel function logs',
        key_status: { has_key: !!ANTHROPIC_KEY, preview: ANTHROPIC_KEY.slice(0,12) }
      }, { status: 500 })
    }

    const result = {
      client_id,
      business_name:   biz,
      industry:        ind,
      location:        loc,
      gsc_keyword_count: gscKeywords.length,
      gsc_keywords:    gscKeywords.slice(0, 100),
      analysis,
      generated_at:    new Date().toISOString(),
    }

    // Save to DB
    await getSupabase().from('seo_tracked_keywords').delete().eq('client_id', client_id)
    if (analysis.gap_opportunities?.length) {
      await getSupabase().from('seo_tracked_keywords').insert(
        analysis.gap_opportunities.slice(0, 30).map((k: any) => ({
          client_id, agency_id,
          keyword:     k.keyword,
          location:    loc,
          opportunity: k.priority,
          source:      'ai_gap',
        }))
      )
    }

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ 
      error: e.message,
      hint: e.message.includes('401') ? 'Invalid API key — check ANTHROPIC_API_KEY in Vercel' :
            e.message.includes('403') ? 'API key lacks permissions' :
            e.message.includes('529') ? 'Anthropic API overloaded — try again in a moment' :
            'Check Vercel function logs for details'
    }, { status: 500 })
  }
}
