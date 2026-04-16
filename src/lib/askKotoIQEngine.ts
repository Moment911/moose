// ─────────────────────────────────────────────────────────────
// Ask KotoIQ Engine — conversational natural-language interface
// over all KotoIQ data. Classifies intent, fetches relevant
// context, and streams a Claude response back with suggested
// actions and a list of data sources used.
// ─────────────────────────────────────────────────────────────

import { logTokenUsage } from '@/lib/tokenTracker'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'

// ── Types ───────────────────────────────────────────────────────────────────
type Intent = 'strategic' | 'diagnostic' | 'reporting' | 'action_planning' | 'data_lookup'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface SuggestedAction {
  label: string
  action_name: string
  params: Record<string, any>
}

interface AskBody {
  client_id?: string
  agency_id?: string
  message: string
  conversation_id?: string
  conversation_history?: ChatMessage[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function safeSelect<T = any>(p: any): Promise<T[]> {
  return Promise.resolve(p).then((r: any) => (r?.data || []) as T[]).catch(() => [] as T[])
}

function safeFirst<T = any>(p: any): Promise<T | null> {
  return Promise.resolve(p).then((r: any) => (r?.data || null) as T | null).catch(() => null)
}

function clip<T>(arr: T[] | null | undefined, n: number): T[] {
  return (arr || []).slice(0, n)
}

function summarizeRows(label: string, rows: any[], fields: string[]): string {
  if (!rows || rows.length === 0) return `${label}: (none)`
  const head = `${label} (${rows.length}):`
  const lines = rows.slice(0, 20).map((r, i) => {
    const parts = fields.map(f => {
      const v = r?.[f]
      if (v == null) return ''
      if (typeof v === 'object') return ''
      const s = String(v)
      return `${f}=${s.length > 80 ? s.slice(0, 80) + '...' : s}`
    }).filter(Boolean).join(' | ')
    return `  ${i + 1}. ${parts}`
  })
  return [head, ...lines].join('\n')
}

// ── Intent Classification ───────────────────────────────────────────────────
async function classifyIntent(ai: Anthropic, message: string, agencyId?: string): Promise<Intent> {
  try {
    const prompt = `Classify this question into ONE intent category. Reply ONLY with the category name:

Categories:
- strategic (big-picture planning: strategy, authority, topical map, scorecards)
- diagnostic (why something happened: ranking drops, content issues, audits)
- reporting (status reports: weekly, monthly, performance summaries)
- action_planning (what to do: recommendations, next steps, this week's work)
- data_lookup (specific data retrieval: a single keyword, page, or number)

Question: "${message}"

Reply with only the category name.`

    const msg = await ai.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 20,
      messages: [{ role: 'user', content: prompt }],
    })
    void logTokenUsage({
      feature: 'kotoiq_chat_classify',
      model: 'claude-haiku-4-20250514',
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
      agencyId,
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim().toLowerCase() : ''
    const valid: Intent[] = ['strategic', 'diagnostic', 'reporting', 'action_planning', 'data_lookup']
    const found = valid.find(v => raw.includes(v))
    return found || 'action_planning'
  } catch {
    // Fallback: simple keyword match
    const lc = message.toLowerCase()
    if (/\b(should i|what do i|next step|priorit|this week|focus|do next)\b/.test(lc)) return 'action_planning'
    if (/\b(why|drop|declin|lost|fell|reason|caus)\b/.test(lc)) return 'diagnostic'
    if (/\b(report|monthly|weekly|summary|performance|recap)\b/.test(lc)) return 'reporting'
    if (/\b(strategy|authority|plan|roadmap|big picture)\b/.test(lc)) return 'strategic'
    return 'data_lookup'
  }
}

// ── Context Gathering ───────────────────────────────────────────────────────
async function gatherContext(
  s: SupabaseClient,
  intent: Intent,
  clientId: string | undefined,
  agencyId: string | undefined,
): Promise<{ contextText: string; sourcesUsed: string[] }> {
  const sourcesUsed: string[] = []
  const chunks: string[] = []

  // Always include client header
  if (clientId) {
    const client = await safeFirst<any>(
      s.from('clients').select('id, name, website, primary_service, target_customer').eq('id', clientId).single()
    )
    if (client) {
      sourcesUsed.push('Client Profile')
      chunks.push(`Client: ${client.name || '?'}\nWebsite: ${client.website || '?'}\nPrimary service: ${client.primary_service || '?'}\nTarget customer: ${client.target_customer || '?'}`)
    }
  }

  // Cross-client reporting/agency intent
  if (!clientId && agencyId) {
    const clients = await safeSelect<any>(
      s.from('clients').select('id, name, website').eq('agency_id', agencyId).is('deleted_at', null).limit(50)
    )
    sourcesUsed.push('Agency Clients')
    chunks.push(`Agency clients (${clients.length}):\n${clients.map(c => `- ${c.name} (${c.website || ''})`).join('\n')}`)

    // Pull urgent recommendations across all clients
    const recs = await safeSelect<any>(
      s.from('kotoiq_recommendations').select('client_id, title, detail, priority, status')
        .in('priority', ['urgent', 'high'])
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(40)
    )
    if (recs.length) {
      sourcesUsed.push('Recommendations')
      chunks.push(summarizeRows('Urgent Recommendations (cross-client)', recs, ['client_id', 'priority', 'title']))
    }
    return { contextText: chunks.join('\n\n'), sourcesUsed }
  }

  if (!clientId) {
    return { contextText: chunks.join('\n\n'), sourcesUsed }
  }

  // Per-client data selection by intent
  const baseFilter = { client_id: clientId }

  if (intent === 'strategic') {
    const [topMap, strategy, scorecard] = await Promise.all<any>([
      safeFirst<any>(s.from('kotoiq_topical_maps').select('*').match(baseFilter).order('created_at', { ascending: false }).limit(1).maybeSingle()),
      safeFirst<any>(s.from('kotoiq_strategic_plans').select('*').match(baseFilter).order('created_at', { ascending: false }).limit(1).maybeSingle()),
      safeFirst<any>(s.from('kotoiq_scorecards').select('*').match(baseFilter).order('created_at', { ascending: false }).limit(1).maybeSingle()),
    ])
    if (topMap) { sourcesUsed.push('Topical Map'); chunks.push(`Topical Map root: ${topMap.root_topic || '?'}\nNode count: ${topMap.node_count || '?'}\nCoverage: ${topMap.coverage_pct || '?'}%`) }
    if (strategy) { sourcesUsed.push('Strategic Plan'); chunks.push(`Strategic Plan:\n${(strategy.summary || '').slice(0, 500)}`) }
    if (scorecard) { sourcesUsed.push('Scorecard'); chunks.push(`Scorecard: authority=${scorecard.authority_score || '?'}, aeo=${scorecard.aeo_score || '?'}, technical=${scorecard.technical_score || '?'}`) }
  }

  if (intent === 'diagnostic') {
    const [snaps, inventory, tech, spam] = await Promise.all<any>([
      safeSelect<any>(s.from('kotoiq_snapshots').select('*').match(baseFilter).order('captured_at', { ascending: false }).limit(10)),
      safeSelect<any>(s.from('kotoiq_content_inventory').select('url, freshness, position_change, priority, trajectory').match(baseFilter).order('position_change', { ascending: true }).limit(25)),
      safeFirst<any>(s.from('kotoiq_technical_deep').select('*').match(baseFilter).order('created_at', { ascending: false }).limit(1).maybeSingle()),
      safeSelect<any>(s.from('kotoiq_spam_hits').select('url, issue, severity').match(baseFilter).order('created_at', { ascending: false }).limit(15)),
    ])
    if (snaps.length) { sourcesUsed.push('Snapshots'); chunks.push(summarizeRows('Recent Snapshots', snaps, ['captured_at', 'avg_position', 'total_clicks', 'total_impressions'])) }
    if (inventory.length) { sourcesUsed.push('Content Inventory'); chunks.push(summarizeRows('Declining/Critical Pages', inventory, ['url', 'freshness', 'position_change', 'priority', 'trajectory'])) }
    if (tech) { sourcesUsed.push('Technical Audit'); chunks.push(`Technical: issues=${tech.issue_count || 0}, score=${tech.score || '?'}`) }
    if (spam.length) { sourcesUsed.push('Spam Hits'); chunks.push(summarizeRows('Spam Signals', spam, ['url', 'issue', 'severity'])) }
  }

  if (intent === 'reporting') {
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const [snaps, recs, kws, backlink] = await Promise.all<any>([
      safeSelect<any>(s.from('kotoiq_snapshots').select('*').match(baseFilter).gte('captured_at', since).order('captured_at', { ascending: false })),
      safeSelect<any>(s.from('kotoiq_recommendations').select('*').match(baseFilter).order('created_at', { ascending: false }).limit(20)),
      safeSelect<any>(s.from('kotoiq_keywords').select('keyword, category, position, volume, opportunity_score').match(baseFilter).order('opportunity_score', { ascending: false }).limit(25)),
      safeFirst<any>(s.from('kotoiq_backlink_profile').select('*').match(baseFilter).order('created_at', { ascending: false }).limit(1).maybeSingle()),
    ])
    if (snaps.length) { sourcesUsed.push('Snapshots (30d)'); chunks.push(summarizeRows('Last 30d Snapshots', snaps, ['captured_at', 'avg_position', 'total_clicks'])) }
    if (recs.length) { sourcesUsed.push('Recommendations'); chunks.push(summarizeRows('Recommendations', recs, ['priority', 'status', 'title'])) }
    if (kws.length) { sourcesUsed.push('Keywords'); chunks.push(summarizeRows('Top Keywords', kws, ['keyword', 'category', 'position', 'volume'])) }
    if (backlink) { sourcesUsed.push('Backlinks'); chunks.push(`Backlinks: total=${backlink.total_backlinks || '?'}, referring_domains=${backlink.referring_domains || '?'}`) }
  }

  if (intent === 'action_planning') {
    const [recs, cal, kws] = await Promise.all<any>([
      safeSelect<any>(s.from('kotoiq_recommendations').select('*').match(baseFilter).eq('status', 'open').order('priority', { ascending: true }).limit(20)),
      safeSelect<any>(s.from('kotoiq_content_calendar').select('*').match(baseFilter).order('scheduled_for', { ascending: true }).limit(15)),
      safeSelect<any>(s.from('kotoiq_keywords').select('keyword, category, position, opportunity_score').match(baseFilter).in('category', ['striking_distance', 'quick_win']).order('opportunity_score', { ascending: false }).limit(15)),
    ])
    if (recs.length) { sourcesUsed.push('Recommendations'); chunks.push(summarizeRows('Open Recommendations', recs, ['priority', 'title', 'detail'])) }
    if (cal.length) { sourcesUsed.push('Content Calendar'); chunks.push(summarizeRows('Upcoming Calendar Items', cal, ['scheduled_for', 'title', 'status'])) }
    if (kws.length) { sourcesUsed.push('Quick-Win Keywords'); chunks.push(summarizeRows('Striking Distance / Quick Wins', kws, ['keyword', 'category', 'position', 'opportunity_score'])) }
  }

  if (intent === 'data_lookup') {
    // Grab a bit of everything, small slices
    const [kws, recs, inv] = await Promise.all<any>([
      safeSelect<any>(s.from('kotoiq_keywords').select('keyword, category, position, volume, opportunity_score').match(baseFilter).order('opportunity_score', { ascending: false }).limit(15)),
      safeSelect<any>(s.from('kotoiq_recommendations').select('priority, title, status').match(baseFilter).order('created_at', { ascending: false }).limit(10)),
      safeSelect<any>(s.from('kotoiq_content_inventory').select('url, freshness, priority').match(baseFilter).order('priority', { ascending: true }).limit(10)),
    ])
    if (kws.length) { sourcesUsed.push('Keywords'); chunks.push(summarizeRows('Keywords', kws, ['keyword', 'category', 'position', 'volume'])) }
    if (recs.length) { sourcesUsed.push('Recommendations'); chunks.push(summarizeRows('Recommendations', recs, ['priority', 'status', 'title'])) }
    if (inv.length) { sourcesUsed.push('Content Inventory'); chunks.push(summarizeRows('Content Inventory', inv, ['url', 'freshness', 'priority'])) }
  }

  return { contextText: chunks.join('\n\n'), sourcesUsed }
}

// ── Main: askKotoIQ ─────────────────────────────────────────────────────────
export async function askKotoIQ(s: SupabaseClient, ai: Anthropic, body: AskBody) {
  const { client_id, agency_id, message, conversation_id, conversation_history } = body
  if (!message || !message.trim()) throw new Error('message required')

  // 1. Classify intent
  const intent = await classifyIntent(ai, message, agency_id)

  // 2. Gather data based on intent
  const { contextText, sourcesUsed } = await gatherContext(s, intent, client_id, agency_id)

  // 3. Build messages for Claude
  const systemPrompt = `You are KotoIQ — an AI search intelligence analyst for a marketing agency. You answer questions about a client's SEO, AEO, PPC, content, rankings, technical audits, and authority.

You are grounded in real data. Use the "Context from KotoIQ database" below to answer. If the data doesn't contain the answer, say so clearly and suggest what to run next. Never invent numbers.

Voice:
- Concise, expert, practical — no fluff
- Lead with the answer, then supporting detail
- Use bullets for lists of 3+ items, paragraphs for short answers
- When recommending actions, make them specific and ordered

Detected intent: ${intent}

Output format: respond in plain markdown. At the end, if there are 1-4 concrete actions the user could click to run, append a JSON block between <ACTIONS> and </ACTIONS> tags like:
<ACTIONS>
[{"label":"Generate brief for 'emergency plumber'","action_name":"generate_brief","params":{"keyword":"emergency plumber"}}]
</ACTIONS>
Omit the ACTIONS block if no concrete follow-up actions apply.`

  const history: ChatMessage[] = (conversation_history || []).slice(-12).filter(m => m.role === 'user' || m.role === 'assistant')

  const contextBlock = contextText
    ? `Context from KotoIQ database:\n\n${contextText}`
    : `Context from KotoIQ database: (no data available for this client yet — suggest running a scan or sync)`

  const userMessageWithContext = `${contextBlock}\n\n---\n\nUser question: ${message}`

  const messages = [
    ...history,
    { role: 'user' as const, content: userMessageWithContext },
  ]

  // 4. Call Claude
  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: systemPrompt,
    messages: messages as any,
  })
  void logTokenUsage({
    feature: 'kotoiq_chat',
    model: 'claude-sonnet-4-20250514',
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
    agencyId: agency_id,
  })

  const rawText = msg.content[0]?.type === 'text' ? msg.content[0].text : ''

  // 5. Extract suggested actions
  let assistantText = rawText
  let suggestedActions: SuggestedAction[] = []
  const actionsMatch = rawText.match(/<ACTIONS>([\s\S]*?)<\/ACTIONS>/)
  if (actionsMatch) {
    try {
      const parsed = JSON.parse(actionsMatch[1].trim())
      if (Array.isArray(parsed)) {
        suggestedActions = parsed.filter(a => a && a.label && a.action_name).map(a => ({
          label: String(a.label),
          action_name: String(a.action_name),
          params: a.params || {},
        }))
      }
    } catch { /* ignore malformed */ }
    assistantText = rawText.replace(/<ACTIONS>[\s\S]*?<\/ACTIONS>/, '').trim()
  }

  // 6. Persist conversation + messages
  let convId = conversation_id
  try {
    if (!convId) {
      // Create a new conversation — title from first user message
      const title = message.length > 80 ? message.slice(0, 80) + '...' : message
      const { data: conv } = await s.from('kotoiq_chat_conversations').insert({
        client_id: client_id || null,
        agency_id: agency_id || null,
        title,
      }).select().single()
      convId = conv?.id
    } else {
      await s.from('kotoiq_chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)
    }

    if (convId) {
      await s.from('kotoiq_chat_messages').insert([
        {
          conversation_id: convId,
          role: 'user',
          content: message,
        },
        {
          conversation_id: convId,
          role: 'assistant',
          content: assistantText,
          data_used: sourcesUsed,
          suggested_actions: suggestedActions,
          tokens_input: msg.usage?.input_tokens || 0,
          tokens_output: msg.usage?.output_tokens || 0,
        },
      ])
    }
  } catch { /* non-fatal persistence */ }

  return {
    conversation_id: convId,
    message: assistantText,
    intent,
    data_used: sourcesUsed,
    suggested_actions: suggestedActions,
  }
}

// ── listConversations ──────────────────────────────────────────────────────
export async function listConversations(s: SupabaseClient, body: { client_id?: string; agency_id?: string; limit?: number }) {
  const { client_id, agency_id, limit = 40 } = body
  let q = s.from('kotoiq_chat_conversations')
    .select('id, client_id, agency_id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (client_id) q = q.eq('client_id', client_id)
  else if (agency_id) q = q.eq('agency_id', agency_id)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return { conversations: data || [] }
}

// ── getConversation ────────────────────────────────────────────────────────
export async function getConversation(s: SupabaseClient, body: { conversation_id: string }) {
  const { conversation_id } = body
  if (!conversation_id) throw new Error('conversation_id required')

  const [convRes, msgRes] = await Promise.all<any>([
    s.from('kotoiq_chat_conversations').select('*').eq('id', conversation_id).single(),
    s.from('kotoiq_chat_messages').select('*').eq('conversation_id', conversation_id).order('created_at', { ascending: true }),
  ])

  if (convRes.error) throw new Error(convRes.error.message)
  return {
    conversation: convRes.data,
    messages: msgRes.data || [],
  }
}

// ── deleteConversation ─────────────────────────────────────────────────────
export async function deleteConversation(s: SupabaseClient, body: { conversation_id: string }) {
  const { conversation_id } = body
  if (!conversation_id) throw new Error('conversation_id required')
  const { error } = await s.from('kotoiq_chat_conversations').delete().eq('id', conversation_id)
  if (error) throw new Error(error.message)
  return { ok: true }
}
