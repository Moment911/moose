import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || '' })

export async function POST(req: NextRequest) {
  const { clientId, agencyId } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'No clientId' }, { status: 400 })

  const [
    { data: campaigns },
    { data: keywords },
    { data: searchTerms },
    { data: pages },
    { data: snapshots },
  ] = await Promise.all([
    supabase.from('perf_campaigns').select('*').eq('client_id', clientId),
    supabase.from('perf_keywords').select('*').eq('client_id', clientId).order('cost', { ascending: false }).limit(100),
    supabase.from('perf_search_terms').select('*').eq('client_id', clientId).order('cost', { ascending: false }).limit(200),
    supabase.from('perf_pages').select('*').eq('client_id', clientId).order('ai_score', { ascending: false }).limit(20),
    supabase.from('perf_snapshots').select('*').eq('client_id', clientId).order('snapshot_date', { ascending: false }).limit(30),
  ])

  if (!campaigns?.length && !keywords?.length) {
    return NextResponse.json({ error: 'No data to analyze — run sync first', recs: [] })
  }

  const topCamps = (campaigns||[]).slice(0,5).map((c: any) =>
    `${c.name}: $${c.cost?.toFixed(0)||0} spend, ${c.roas?.toFixed(2)||0}x ROAS, $${c.cpa?.toFixed(0)||0} CPA, ${c.impression_share?.toFixed(0)||0}% IS, ${c.lost_is_budget?.toFixed(0)||0}% lost-budget, ${c.lost_is_rank?.toFixed(0)||0}% lost-rank`
  ).join('\n')

  const noConvKws = (keywords||[]).filter((k: any) => k.cost > 30 && (k.conversions||0) < 0.5)
    .slice(0,10).map((k: any) => `"${k.keyword}" $${k.cost?.toFixed(0)} spend, 0 conv, QS=${k.quality_score||'?'}`)

  const wastedTerms = (searchTerms||[]).filter((s: any) => s.cost > 10 && (s.conversions||0) < 0.5)
    .slice(0,15).map((s: any) => `"${s.search_term}" $${s.cost?.toFixed(0)} 0conv`)

  const topPages = (pages||[]).slice(0,5).map((p: any) =>
    `${p.url} score=${p.ai_score||0} "${p.h1||p.page_title||''}"`)

  const prompt = `You are a senior Google Ads specialist. Analyze this account data and generate specific, high-impact recommendations.

CAMPAIGNS (last 30 days):
${topCamps || 'No campaign data'}

HIGH SPEND / ZERO CONVERSION KEYWORDS:
${noConvKws.join('\n') || 'None'}

WASTED SPEND SEARCH TERMS (candidates for negative keywords):
${wastedTerms.join('\n') || 'None'}

TOP LANDING PAGES BY AI SCORE:
${topPages.join('\n') || 'None scanned'}

Generate 8-12 specific, actionable recommendations ordered by estimated dollar impact.
Each recommendation MUST reference actual data from above (specific campaign names, keyword text, search terms, page URLs).

Return a JSON array:
[{
  "type": "bid|budget|negative_keyword|ad_copy|landing_page|keyword_pause|audience",
  "priority": "high|medium|low",
  "title": "concise title under 8 words",
  "description": "specific action with exact data reference (campaign name, keyword, etc.)",
  "current_state": {"metric": "value"},
  "recommended": {"change": "specific change"},
  "est_impact": "e.g. Save $340/mo or +15% ROAS",
  "est_impact_val": 340,
  "confidence": 0.85,
  "data_sources": ["ads"]
}]`

  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }],
    system: 'You are a Google Ads optimization expert. Return only a raw JSON array, no markdown.',
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const clean = raw.replace(/```json|```/g,'').trim()
  const s = clean.indexOf('['), e = clean.lastIndexOf(']')
  let recs: any[] = []
  try { recs = JSON.parse(clean.slice(s, e+1)) } catch {}

  // Save to DB
  if (recs.length) {
    await supabase.from('perf_recommendations').upsert(
      recs.map((r: any) => ({
        client_id: clientId, agency_id: agencyId,
        type: r.type, priority: r.priority, title: r.title,
        description: r.description, current_state: r.current_state||{},
        recommended: r.recommended||{}, est_impact: r.est_impact,
        est_impact_val: r.est_impact_val||0, confidence: r.confidence||0.8,
        data_sources: r.data_sources||['ads'], status: 'pending',
        updated_at: new Date().toISOString(),
      }))
    )
  }

  return NextResponse.json({ recs: recs.length, generated_at: new Date().toISOString() })
}