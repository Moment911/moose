import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function getGSCKeywords(clientId: string) {
  const sb = getSupabase()
  const { data: conn } = await sb.from('seo_connections')
    .select('*').eq('client_id', clientId).eq('provider','google').maybeSingle()
  if (!conn?.gsc_site) return []
  // Try to get valid token
  let token = conn.access_token
  if (conn.refresh_token && conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      // env-leak-check: legacy-fallback
      body: new URLSearchParams({ client_id: (process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)?.trim()||'', client_secret: (process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET)?.trim()||'', refresh_token: conn.refresh_token, grant_type:'refresh_token' })
    })
    const d = await r.json()
    if (d.access_token) token = d.access_token
  }
  if (!token) return []
  const end   = new Date().toISOString().split('T')[0]
  const start = new Date(Date.now() - 90*86400000).toISOString().split('T')[0]
  const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(conn.gsc_site)}/searchAnalytics/query`, {
    method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body: JSON.stringify({ startDate:start, endDate:end, dimensions:['query','page'], rowLimit:500 })
  })
  if (!res.ok) return []
  const d = await res.json()
  return (d.rows||[]).map((r:any) => ({ keyword: r.keys[0], page: r.keys[1], clicks: r.clicks, impressions: r.impressions, position: Math.round(r.position*10)/10 }))
}

async function generateContentStrategy(keywords: any[], client: any) {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not set')

  const topKws = keywords.sort((a:any,b:any) => b.impressions-a.impressions).slice(0,60)
  const pages = [...new Set(keywords.map((k:any) => k.page))].slice(0,20)

  const prompt = `You are a content strategist for a local business. Analyze their current content and identify gaps.

Business: ${client.name}
Industry: ${client.industry || 'Local Business'}
Location: ${client.city ? client.city + (client.state?', '+client.state:'') : 'Unknown'}
Website: ${client.website || 'N/A'}

Current top keywords from Google Search Console (impressions):
${topKws.map((k:any) => `${k.keyword} (${k.impressions} impr, pos ${k.position})`).join('\n')}

Pages currently getting traffic:
${pages.join('\n')}

Analyze this content landscape and return ONLY valid JSON:
{
  "content_health": "2 sentence assessment of their current content",
  "topic_clusters": [
    {
      "cluster_name": "Main topic area",
      "pillar_page": {"title": "Main pillar page title", "type": "service|location|educational", "keywords": ["kw1","kw2"], "priority": "high|medium"},
      "supporting_pages": [
        {"title": "Supporting page title", "type": "blog|faq|location|case-study", "target_keyword": "keyword", "word_count": 800}
      ],
      "gap_severity": "critical|moderate|low",
      "rationale": "Why this cluster matters for their business"
    }
  ],
  "quick_content_wins": [
    {"title": "Page title to create", "type": "blog|faq|service|location", "target_keyword": "keyword", "why": "reason this will drive traffic fast", "estimated_time": "1 hour|half day|full day"}
  ],
  "content_to_update": [
    {"page": "existing page URL or title", "issue": "what's wrong", "fix": "specific fix"}
  ],
  "content_calendar": [
    {"week": 1, "title": "Content piece title", "type": "blog|page|faq|video", "keyword": "target keyword", "notes": "brief tip"}
  ],
  "missing_page_types": ["type of page they should have but don't"]
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':ANTHROPIC_KEY,'anthropic-version':'2023-06-01'},
    body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:2000, messages:[{role:'user',content:prompt}] })
  })
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`)
  const d = await res.json()
  let text = d.content?.[0]?.text?.trim()||'{}'
  text = text.replace(/^```json\n?/,'').replace(/^```\n?/,'').replace(/\n?```$/,'').trim()
  const s=text.indexOf('{'),e=text.lastIndexOf('}')
  if(s>=0&&e>s) text=text.slice(s,e+1)
  return JSON.parse(text)
}

export async function POST(req: NextRequest) {
  try {
    const { client_id, agency_id } = await req.json()
    if (!client_id) return NextResponse.json({error:'client_id required'},{status:400})

    const { data: client } = await getSupabase().from('clients').select('*').eq('id',client_id).single()
    const keywords = await getGSCKeywords(client_id)
    const strategy = await generateContentStrategy(keywords, client||{name:'Business'})

    const result = { client_id, client_name: client?.name, gsc_keywords: keywords.length, strategy, generated_at: new Date().toISOString() }

    // Save to seo_monthly_reports with type=content_gap
    await getSupabase().from('seo_monthly_reports').insert({
      client_id, agency_id, month: new Date().toISOString().slice(0,7),
      report_data: result, ai_narrative: strategy
    })

    return NextResponse.json(result)
  } catch(e:any) { return NextResponse.json({error:e.message},{status:500}) }
}
