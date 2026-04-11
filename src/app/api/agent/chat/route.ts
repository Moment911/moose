import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logTokenUsage } from '@/lib/tokenTracker'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
const OPENAI_KEY    = process.env.OPENAI_API_KEY    || ''
const GEMINI_KEY    = process.env.GEMINI_API_KEY    || process.env.GOOGLE_GEMINI_KEY || ''
const KOTO_AGENCY_ID = '00000000-0000-0000-0000-000000000099'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Determine scope level and gather appropriate data ─────────────────────────
async function gatherScopedContext(scope: string, scopeId: string | null, agencyId: string) {
  const sb  = getSupabase()
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // ── KOTO LEVEL: full platform view ──────────────────────────────────────────
  if (scope === 'koto') {
    const [
      { data: agencies },
      { data: allClients },
      { data: recentRuns },
      { data: recentInsights },
      { data: subscriptions },
    ] = await Promise.all([
      sb.from('agencies').select('id,name,plan,status,created_at').limit(50),
      sb.from('clients').select('id,name,industry,sic_code,city,state,agency_id').limit(200),
      sb.from('agent_runs').select('*').order('created_at', { ascending: false }).limit(20),
      sb.from('agent_insights').select('*').eq('dismissed', false).order('created_at', { ascending: false }).limit(30),
      sb.from('subscriptions').select('*').limit(50),
    ])

    const activeAgencies = agencies?.filter(a => a.status !== 'canceled') || []
    const mrr = subscriptions?.reduce((sum: number, s: any) => {
      const planPrice: Record<string,number> = { starter: 297, growth: 497, agency: 997 }
      return sum + (planPrice[s.plan] || 0)
    }, 0) || 0

    return {
      scope: 'koto',
      summary: `Koto Platform: ${activeAgencies.length} active agencies, ${allClients?.length || 0} total clients, $${mrr.toLocaleString()}/mo MRR`,
      agencies: activeAgencies,
      clients: allClients,
      recent_runs: recentRuns,
      recent_insights: recentInsights,
      subscriptions,
      mrr,
    }
  }

  // ── AGENCY LEVEL: all clients for this agency ────────────────────────────────
  if (scope === 'agency') {
    const [
      { data: agency },
      { data: clients },
      { data: reviews },
      { data: tickets },
      { data: runs },
      { data: insights },
      { data: projects },
    ] = await Promise.all([
      sb.from('agencies').select('*').eq('id', agencyId).single(),
      sb.from('clients').select('*').eq('agency_id', agencyId).order('name'),
      sb.from('reviews').select('rating,is_responded,client_id,created_at').eq('agency_id', agencyId).gte('created_at', thirtyDaysAgo),
      sb.from('desk_tickets').select('*').eq('agency_id', agencyId).gte('created_at', thirtyDaysAgo),
      sb.from('agent_runs').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }).limit(10),
      sb.from('agent_insights').select('*').eq('agency_id', agencyId).eq('dismissed', false).order('created_at', { ascending: false }).limit(30),
      sb.from('projects').select('*').eq('agency_id', agencyId).eq('status', 'active'),
    ])

    const avgRating = reviews?.filter(r => r.rating).length
      ? (reviews.filter(r => r.rating).reduce((s: number, r: any) => s + r.rating, 0) / reviews.filter(r => r.rating).length).toFixed(1)
      : 'N/A'

    return {
      scope: 'agency',
      agency,
      client_count: clients?.length || 0,
      clients: clients?.map(c => ({ id: c.id, name: c.name, industry: c.industry, sic_code: c.sic_code })),
      reviews_30d: reviews?.length || 0,
      avg_rating_30d: avgRating,
      unresponded_reviews: reviews?.filter(r => !r.is_responded).length || 0,
      open_tickets: tickets?.filter(t => !['resolved','closed'].includes(t.status)).length || 0,
      active_projects: projects?.length || 0,
      recent_runs: runs,
      recent_insights: insights,
    }
  }

  // ── CLIENT LEVEL: single client deep dive ────────────────────────────────────
  if (scope === 'client' && scopeId) {
    const [
      { data: client },
      { data: config },
      { data: reviews },
      { data: gbp },
      { data: pageAudit },
      { data: keywords },
      { data: citations },
      { data: rankScans },
      { data: tickets },
      { data: runs },
      { data: insights },
      { data: projects },
    ] = await Promise.all([
      sb.from('clients').select('*').eq('id', scopeId).single(),
      sb.from('agent_configs').select('*').eq('client_id', scopeId).single(),
      sb.from('reviews').select('*').eq('client_id', scopeId).gte('created_at', thirtyDaysAgo),
      sb.from('gbp_audits').select('*').eq('client_id', scopeId).order('audited_at', { ascending: false }).limit(1),
      sb.from('seo_page_audits').select('*').eq('client_id', scopeId).order('audited_at', { ascending: false }).limit(1),
      sb.from('seo_tracked_keywords').select('*').eq('client_id', scopeId).order('tracked_at', { ascending: false }).limit(20),
      sb.from('citation_checks').select('*').eq('client_id', scopeId).order('checked_at', { ascending: false }).limit(1),
      sb.from('local_rank_scans').select('*').eq('client_id', scopeId).gte('created_at', thirtyDaysAgo),
      sb.from('desk_tickets').select('*').eq('client_id', scopeId).gte('created_at', thirtyDaysAgo),
      sb.from('agent_runs').select('*').eq('client_id', scopeId).order('created_at', { ascending: false }).limit(3),
      sb.from('agent_insights').select('*').eq('client_id', scopeId).eq('dismissed', false).order('created_at', { ascending: false }).limit(15),
      sb.from('projects').select('*').eq('client_id', scopeId).eq('status', 'active'),
    ])

    return {
      scope: 'client',
      client,
      config,
      reviews_30d: reviews?.length || 0,
      avg_rating: reviews?.filter(r => r.rating).length
        ? (reviews.filter(r => r.rating).reduce((s: number, r: any) => s + r.rating, 0) / reviews.filter(r => r.rating).length).toFixed(1)
        : 'N/A',
      unresponded: reviews?.filter(r => !r.is_responded).length || 0,
      gbp_score: gbp?.[0]?.score,
      gbp_issues: (gbp?.[0]?.recommendations || []).slice(0, 3).map((r: any) => r.label),
      seo_score: pageAudit?.[0]?.score,
      seo_url: pageAudit?.[0]?.url,
      keywords_count: keywords?.length || 0,
      high_priority_keywords: keywords?.filter((k: any) => k.opportunity === 'high').length || 0,
      top_keywords: keywords?.slice(0, 5).map((k: any) => k.keyword),
      citations_found: (citations?.[0]?.results || []).filter((r: any) => r.found).length,
      citations_total: citations?.[0]?.results?.length || 0,
      rank_scans: rankScans?.length || 0,
      open_tickets: tickets?.filter(t => !['resolved','closed'].includes(t.status)).length || 0,
      active_projects: projects?.length || 0,
      recent_runs: runs,
      recent_insights: insights,
      last_run_summary: runs?.[0]?.report_data?.summary,
    }
  }

  return { scope, error: 'Unknown scope' }
}

// ── Build system prompt based on scope ──────────────────────────────────────
function buildSystemPrompt(scope: string, ctx: any): string {
  const base = `You are the Koto autonomous CMO agent — a 25-year expert in local SEO, PPC, AEO (Answer Engine Optimization), reputation management, content strategy, and marketing automation. You think and respond like a battle-tested Chief Marketing Officer who has managed hundreds of local business accounts.

Your responses are:
- Specific to the actual data you're given — never generic
- Actionable with clear next steps and expected outcomes  
- Prioritized by business impact (revenue/leads/visibility)
- Written in confident, direct executive language
- Data-first — always reference actual numbers

You have access to real-time data pulled from every connected source.`

  if (scope === 'koto') {
    return `${base}

SCOPE: Koto Platform (Super Admin View)
You can see across ALL agencies and ALL clients on the platform.

PLATFORM SNAPSHOT:
${JSON.stringify({ agencies: ctx.agencies?.length, total_clients: ctx.clients?.length, mrr: ctx.mrr, recent_insights: ctx.recent_insights?.length }, null, 2)}

You can answer questions about:
- Platform-wide performance trends
- Cross-agency benchmarking  
- MRR, churn, growth metrics
- Which agencies/clients are performing best or worst
- Platform health and recommendations for Koto as a business
- Any specific agency or client by name`
  }

  if (scope === 'agency') {
    return `${base}

SCOPE: ${ctx.agency?.name} Agency View
You can see all clients for this agency but NOT data from other agencies.

AGENCY SNAPSHOT:
- Clients: ${ctx.client_count}
- Reviews (30d): ${ctx.reviews_30d} | Avg: ${ctx.avg_rating_30d}★ | ${ctx.unresponded_reviews} unresponded
- Open tickets: ${ctx.open_tickets}
- Active projects: ${ctx.active_projects}
- Clients: ${ctx.clients?.map((c: any) => c.name).join(', ')}

You can answer questions about:
- Performance across all clients
- Which clients need attention
- Agency-wide trends and benchmarks
- Cross-client strategies and opportunities
- Specific client performance when asked`
  }

  if (scope === 'client') {
    return `${base}

SCOPE: ${ctx.client?.name} — Single Client View
You can ONLY see data for this specific client.

CLIENT SNAPSHOT:
Business: ${ctx.client?.name} | ${ctx.client?.industry} (SIC: ${ctx.client?.sic_code})
Location: ${[ctx.client?.city, ctx.client?.state].filter(Boolean).join(', ')}
Goals: ${ctx.config?.business_goals?.join(', ') || 'Not configured'}
Target Keywords: ${ctx.config?.target_keywords?.join(', ') || 'None set'}
Competitors: ${ctx.config?.competitors?.join(', ') || 'None tracked'}
Budget: $${ctx.config?.monthly_budget || 'N/A'}/mo

LIVE METRICS:
- GBP Score: ${ctx.gbp_score || 'N/A'}/100 | Issues: ${ctx.gbp_issues?.join(', ') || 'None'}
- SEO Score: ${ctx.seo_score || 'N/A'}/100
- Reviews (30d): ${ctx.reviews_30d} new | Avg ${ctx.avg_rating}★ | ${ctx.unresponded} unresponded
- Keywords: ${ctx.keywords_count} tracked | ${ctx.high_priority_keywords} high-priority
- Top keywords: ${ctx.top_keywords?.join(', ') || 'None'}
- Citations: ${ctx.citations_found}/${ctx.citations_total} directories
- Open tickets: ${ctx.open_tickets}
- Last CMO analysis: ${ctx.last_run_summary || 'None yet'}

You can answer anything about this client's marketing performance, strategy, and opportunities.`
  }

  return base
}

// ── Call Claude ──────────────────────────────────────────────────────────────
async function askClaude(systemPrompt: string, messages: any[]): Promise<string | null> {
  if (!ANTHROPIC_KEY) return null
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: systemPrompt,
        messages,
      }),
    })
    const data = await res.json()
    return data.content?.[0]?.text || null
  } catch { return null }
}

// ── Call GPT-4 ───────────────────────────────────────────────────────────────
async function askGPT(systemPrompt: string, messages: any[]): Promise<string | null> {
  if (!OPENAI_KEY) return null
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1000,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      }),
    })
    const data = await res.json()
    void logTokenUsage({
      feature: 'agent_chat',
      model: data.model || 'gpt-4o',
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    })
    return data.choices?.[0]?.message?.content || null
  } catch { return null }
}

// ── Call Gemini ──────────────────────────────────────────────────────────────
async function askGemini(systemPrompt: string, messages: any[]): Promise<string | null> {
  if (!GEMINI_KEY) return null
  try {
    const contents = [
      { role: 'user', parts: [{ text: `${systemPrompt}\n\n${messages[messages.length - 1]?.content}` }] }
    ]
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 1000 } }),
    })
    const data = await res.json()
    void logTokenUsage({
      feature: 'agent_chat',
      model: 'gemini-2.5-flash',
      inputTokens: data.usageMetadata?.promptTokenCount || 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
    })
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null
  } catch { return null }
}

// ── Synthesize multi-LLM responses ───────────────────────────────────────────
async function synthesize(claudeResp: string | null, gptResp: string | null, geminiResp: string | null, question: string): Promise<string> {
  const available = [claudeResp, gptResp, geminiResp].filter(Boolean)
  
  // If only one responded, use it directly
  if (available.length === 1) return available[0]!
  
  // If Claude responded, use it as the base (it has the most context)
  // Add perspectives from others if they add something different
  if (!ANTHROPIC_KEY || !claudeResp) return available[0]!

  // For simple questions just use Claude's answer directly
  // Only synthesize when we have multiple LLMs contributing
  if (available.length < 2) return claudeResp!

  try {
    const synthesisPrompt = `You are synthesizing marketing analysis from multiple AI models. 
Here are their responses to: "${question}"

CLAUDE: ${claudeResp}

${gptResp ? `GPT-4: ${gptResp}` : ''}
${geminiResp ? `GEMINI: ${geminiResp}` : ''}

Synthesize the best insights from all responses into one authoritative, concise answer.
Remove redundancy. Keep the most specific, actionable, data-referenced points.
Write as one unified CMO response, not as a comparison. Do not mention the models.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{ role: 'user', content: synthesisPrompt }],
      }),
    })
    const data = await res.json()
    return data.content?.[0]?.text || claudeResp!
  } catch {
    return claudeResp!
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const {
      message,
      history = [],
      scope,        // 'koto' | 'agency' | 'client'
      scope_id,     // client_id if scope=client, null otherwise
      agency_id,
      real_agency_id,
    } = await req.json()

    if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })

    // Validate scope access
    const effectiveScope = scope || 'agency'
    const isKotoLevel    = real_agency_id === KOTO_AGENCY_ID || agency_id === KOTO_AGENCY_ID

    // Enforce scope restrictions
    if (effectiveScope === 'koto' && !isKotoLevel) {
      return NextResponse.json({ error: 'Koto-level scope requires Koto admin access' }, { status: 403 })
    }

    // Gather scoped context in real time
    const ctx = await gatherScopedContext(effectiveScope, scope_id, agency_id)

    // Build system prompt for this scope
    const systemPrompt = buildSystemPrompt(effectiveScope, ctx)

    // Build message history for LLMs
    const llmMessages = [
      ...history.slice(-8).map((h: any) => ({ role: h.role === 'agent' ? 'assistant' : h.role, content: h.content })),
      { role: 'user', content: message },
    ]

    // Run all available LLMs in parallel
    const [claudeResp, gptResp, geminiResp] = await Promise.all([
      askClaude(systemPrompt, llmMessages),
      askGPT(systemPrompt, llmMessages),
      askGemini(systemPrompt, llmMessages),
    ])

    // Synthesize the best answer
    const reply = await synthesize(claudeResp, gptResp, geminiResp, message)

    // Which models contributed
    const models = [
      claudeResp ? 'Claude' : null,
      gptResp    ? 'GPT-4o' : null,
      geminiResp ? 'Gemini' : null,
    ].filter(Boolean)

    // Save to DB
    const sb = getSupabase()
    await sb.from('agent_chats').insert([
      { client_id: scope_id, agency_id, role: 'user',  content: message, scope: effectiveScope },
      { client_id: scope_id, agency_id, role: 'agent', content: reply,   scope: effectiveScope, models_used: models },
    ])

    return NextResponse.json({ reply, models, scope: effectiveScope })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
