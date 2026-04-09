import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '@/lib/apiAuth'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_AGENCY = '00000000-0000-0000-0000-000000000099'

// ─────────────────────────────────────────────────────────────
// Default 10 discovery sections (stored on engagement.sections)
// ─────────────────────────────────────────────────────────────
function getDefaultSections() {
  const f = (id: string, question: string, hint = '', extras: Record<string, any> = {}) => ({
    id,
    question,
    hint,
    answer: '',
    source: 'preset',
    question_is_edited: false,
    ai_questions: [],
    ...extras,
  })

  return [
    {
      id: 'section_01',
      title: '01 — Pre-Call Research',
      subtitle: 'Intelligence Summary',
      visible: true,
      fields: [
        f('01a', 'Background / authority summary', 'Populated from AI research', { is_ai_populated: true }),
        f('01b', 'Business entities identified', 'Populated from AI research', { is_ai_populated: true }),
        f('01c', 'Revenue streams identified', 'Populated from AI research', { is_ai_populated: true }),
        f('01d', 'Key observations and risk flags', 'Populated from AI research', { is_ai_populated: true }),
        f('01e', 'Corrections based on initial conversation', 'Corrections/clarifications from the live call', { is_ai_populated: true }),
      ],
    },
    {
      id: 'section_02',
      title: '02 — Technology Intelligence',
      subtitle: 'Multi-Domain Tech Stack Scanner',
      visible: true,
      has_tech_stack: true,
      fields: [
        f('02a', 'Are there any domains not captured by the scan?'),
        f('02b', 'Who has admin access to each major platform?'),
      ],
    },
    {
      id: 'section_03',
      title: '03 — Digital Footprint',
      subtitle: 'Social Media',
      visible: true,
      fields: [
        f('03a', 'Who owns/manages social media today?'),
        f('03b', 'Which platforms are active right now?'),
        f('03c', 'Which platforms are dormant or abandoned?'),
        f('03d', 'Are you running paid social advertising? On which platforms?'),
        f('03e', 'What organic lead gen channels are performing?'),
        f('03f', 'What is your review generation system today?'),
      ],
    },
    {
      id: 'section_04',
      title: '04 — Foundation',
      subtitle: 'Business Model',
      visible: true,
      fields: [
        f('04a', 'Revenue sources ranked by contribution'),
        f('04b', 'How do your brands / domains relate to each other?'),
        f('04c', 'Team structure (roles, reporting, outsourced vs in-house)'),
        f('04d', 'Service delivery volume per week'),
        f('04e', 'Who managed digital before Koto?'),
        f('04f', 'Any additional revenue streams worth noting?'),
      ],
    },
    {
      id: 'section_05',
      title: '05 — Audience and Pipeline',
      subtitle: 'Leads, Conversion, Reactivation',
      visible: true,
      fields: [
        f('05a', 'Describe your ideal client in detail'),
        f('05b', 'Where do leads come from today?'),
        f('05c', 'What happens immediately after a form submit?'),
        f('05d', 'Lead-to-call conversion rate (%)'),
        f('05e', 'Call-to-client conversion rate (%)'),
        f('05f', 'What happens to leads that never convert?'),
        f('05g', 'Do you run reactivation outreach on old leads?'),
        f('05h', 'Any product-to-service upsell path?'),
      ],
    },
    {
      id: 'section_06',
      title: '06 — Platform Audit',
      subtitle: 'CRM / Automation',
      visible: true,
      risk_area: true,
      fields: [
        f('06a', 'How long have you been on your current CRM?'),
        f('06b', 'What is the platform used for today?'),
        f('06c', 'Active workflows count'),
        f('06d', 'Any incidents, losses, or data integrity issues?'),
        f('06e', 'Contact database structure (tags, custom fields, segments)'),
        f('06f', 'Third-party integrations currently connected'),
        f('06g', 'Confidence rating in current platform (1-10)'),
      ],
    },
    {
      id: 'section_07',
      title: '07 — Strategic Vision',
      subtitle: 'GHL Opportunities',
      visible: true,
      fields: [
        f('07a', 'Lead Pipeline — automated intake, routing, notifications', '', { is_opportunity: true }),
        f('07b', 'Pre-Call Nurture — warm leads before the first call', '', { is_opportunity: true }),
        f('07c', 'E-Commerce Pipeline — cart recovery, post-purchase flows', '', { is_opportunity: true }),
        f('07d', 'Missed Call Text-Back — instant SMS on missed calls', '', { is_opportunity: true }),
        f('07e', 'Review Generation — automated review requests', '', { is_opportunity: true }),
        f('07f', 'Long-Term Nurture — 6/12-month drip to stay top-of-mind', '', { is_opportunity: true }),
        f('07g', 'AI Conversation Bot — 24/7 qualification on site + SMS', '', { is_opportunity: true }),
        f('07h', 'Unified Reporting Dashboard — source-of-truth metrics', '', { is_opportunity: true }),
      ],
    },
    {
      id: 'section_08',
      title: '08 — Email Marketing',
      subtitle: 'List, Send, Results',
      visible: true,
      fields: [
        f('08a', 'Where does your email list live today?'),
        f('08b', 'Open rate (%)'),
        f('08c', 'Click-through rate (%)'),
        f('08d', 'Send frequency'),
        f('08e', 'Segmentation strategy'),
        f('08f', 'Welcome sequence in place?'),
        f('08g', 'Recent campaign results'),
        f('08h', 'Is the email platform connected to your CRM?'),
        f('08i', 'List cleaning / suppression practice'),
        f('08j', 'Any behavioral triggers wired up?'),
      ],
    },
    {
      id: 'section_09',
      title: '09 — SMS Marketing',
      subtitle: 'Compliance + Usage',
      visible: true,
      info_note: 'SMS sees ~95% open rates and is the highest-leverage channel for most trades and local businesses.',
      fields: [
        f('09a', 'Are you using SMS for marketing / service today?'),
        f('09b', 'What platform sends your SMS?'),
        f('09c', 'A2P 10DLC registration status'),
        f('09d', 'TCPA consent capture process'),
        f('09e', 'Appointment reminders running?'),
        f('09f', 'Missed-call text-back wired up?'),
        f('09g', '5-minute follow-up on new leads?'),
        f('09h', 'Any international contacts in the list?'),
        f('09i', 'Which ideal SMS moments are you missing?'),
      ],
    },
    {
      id: 'section_10',
      title: '10 — Direction and Scope',
      subtitle: 'Goals, Budget, Decision',
      visible: true,
      fields: [
        f('10a', 'Top 3 business goals for the next 12 months'),
        f('10b', 'Biggest immediate fix you need right now'),
        f('10c', 'What does success look like in 90 days?'),
        f('10d', 'What has not worked before and why?'),
        f('10e', 'Engagement type (retainer, project, hybrid)'),
        f('10f', 'Budget range'),
        f('10g', 'Communication preferences (Slack, email, weekly calls)'),
        f('10h', 'Other decision makers involved'),
        f('10i', 'Anything I did not ask that I should know?'),
        f('10j', 'Post-call assessment (internal notes, never shared with client)', '', { never_share: true }),
      ],
    },
  ]
}

// ─────────────────────────────────────────────────────────────
// Claude helper
// ─────────────────────────────────────────────────────────────
async function callClaude(opts: {
  system?: string
  user: string
  maxTokens?: number
  tools?: any[]
  temperature?: number
  timeoutMs?: number
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY || ''
  if (!apiKey) return ''
  try {
    const body: any = {
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens ?? 2000,
      messages: [{ role: 'user', content: opts.user }],
    }
    if (opts.system) body.system = opts.system
    if (opts.tools) body.tools = opts.tools
    if (typeof opts.temperature === 'number') body.temperature = opts.temperature
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // Fail fast: most calls get a short timeout; long-running research/scan callers pass their own.
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    })
    if (!res.ok) return ''
    const d = await res.json()
    const parts: string[] = []
    for (const c of d.content || []) if (c.type === 'text' && c.text) parts.push(c.text)
    return parts.join('\n').trim()
  } catch {
    return ''
  }
}

function parseJson(text: string): any {
  if (!text) return null
  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    const match = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/)
    if (match) { try { return JSON.parse(match[0]) } catch {} }
    return null
  }
}

function randomToken(len = 24) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

// ─────────────────────────────────────────────────────────────
// Shared workers — used both by the live POST actions AND by the
// background fire-and-forget calls from `create`.
// ─────────────────────────────────────────────────────────────

/**
 * Run pre-call research against Claude + web search.
 * On success: persists intel_cards, pre-fills section 01 fields, sets status=research_complete.
 * On failure: still flips status back to research_complete so the UI doesn't spin forever.
 */
async function runResearchForEngagement(engagementId: string): Promise<void> {
  const s = sb()
  const { data: eng } = await s.from('koto_discovery_engagements').select('*').eq('id', engagementId).maybeSingle()
  if (!eng) return

  const { data: domainRows } = await s.from('koto_discovery_domains').select('url').eq('engagement_id', engagementId)
  const domainList = (domainRows || []).map((d: any) => d.url).join(', ') || 'none provided'

  const system = 'Be concise. Return only the JSON, no explanation, no preamble, no prose.'
  const prompt = `Research ${eng.client_name} (industry: ${eng.client_industry || 'unknown'}; domains: ${domainList}) and return JSON only — no prose. Schema:
{
  "background": "string (2-3 sentences max)",
  "entities": ["string"],
  "revenue_streams": ["string"],
  "social": [{"platform":"string","handle":"string","known_data":"string"}],
  "observations": ["string (max 5 items)"]
}
Be brief.`

  const raw = await callClaude({
    system,
    user: prompt,
    maxTokens: 2000,
    // Enable web_search so Claude can actually look up the business.
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    // Research + search is slow. Give it more time than the fail-fast default.
    timeoutMs: 45000,
  })
  const parsed = parseJson(raw) || {}

  // Transform the compact schema into intel_cards + section 01 prefills.
  const intel_cards: any[] = []
  if (parsed.background) intel_cards.push({ title: 'Background', body: parsed.background, category: 'authority' })
  if (Array.isArray(parsed.entities) && parsed.entities.length) {
    intel_cards.push({ title: 'Business Entities', body: parsed.entities.join(', '), category: 'authority' })
  }
  if (Array.isArray(parsed.revenue_streams) && parsed.revenue_streams.length) {
    intel_cards.push({ title: 'Revenue Streams', body: parsed.revenue_streams.join(' · '), category: 'revenue' })
  }
  if (Array.isArray(parsed.social) && parsed.social.length) {
    for (const soc of parsed.social.slice(0, 4)) {
      if (!soc?.platform) continue
      intel_cards.push({
        title: `${soc.platform}${soc.handle ? ` — ${soc.handle}` : ''}`,
        body: soc.known_data || '',
        category: 'digital',
      })
    }
  }
  if (Array.isArray(parsed.observations) && parsed.observations.length) {
    for (const obs of parsed.observations.slice(0, 5)) {
      intel_cards.push({ title: 'Observation', body: obs, category: 'risk' })
    }
  }

  // Prefill section 01 fields from the same data.
  const sections = Array.isArray(eng.sections) ? eng.sections : getDefaultSections()
  const s01 = sections.find((sec: any) => sec.id === 'section_01')
  if (s01) {
    const fillMap: Record<string, string> = {
      '01a': parsed.background || '',
      '01b': Array.isArray(parsed.entities) ? parsed.entities.join(', ') : '',
      '01c': Array.isArray(parsed.revenue_streams) ? parsed.revenue_streams.join(' • ') : '',
      '01d': Array.isArray(parsed.observations) ? parsed.observations.join(' | ') : '',
    }
    for (const [fid, val] of Object.entries(fillMap)) {
      if (!val) continue
      const field = s01.fields.find((f: any) => f.id === fid)
      if (field) {
        field.answer = val
        field.source = 'ai_generated'
      }
    }
  }

  await s.from('koto_discovery_engagements').update({
    intel_cards,
    sections,
    status: 'research_complete',
  }).eq('id', engagementId)
}

/**
 * Scan a single domain: fetches HTML + headers, asks Claude to identify the tech stack,
 * persists the result and flips scan_status to 'complete' or 'failed'.
 */
async function scanDomainById(domainId: string): Promise<void> {
  const s = sb()
  const { data: domain } = await s.from('koto_discovery_domains').select('*').eq('id', domainId).maybeSingle()
  if (!domain) return

  await s.from('koto_discovery_domains').update({ scan_status: 'scanning' }).eq('id', domainId)

  let html = ''
  const headers: Record<string, string> = {}
  try {
    const url = domain.url.startsWith('http') ? domain.url : `https://${domain.url}`
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoDiscovery/1.0)' },
    })
    html = (await res.text()).slice(0, 180_000)
    res.headers.forEach((v, k) => { headers[k] = v })
  } catch (e: any) {
    await s.from('koto_discovery_domains').update({
      scan_status: 'failed',
      tech_stack: { error: e?.message || 'fetch failed' },
      last_scanned_at: new Date().toISOString(),
    }).eq('id', domainId)
    return
  }

  const system = 'Return only JSON, be concise. No explanation, no preamble.'
  const prompt = `Identify the tech stack for ${domain.url}. HTTP headers: ${JSON.stringify(headers).slice(0, 1500)}

HTML (truncated): ${html.slice(0, 50_000)}

Return JSON:
{"categories":[{"name":"CMS|Analytics|Ads|Email|Chat|CRM|Hosting|CDN|Framework|Ecommerce|Forms|Payments|Video|Reviews|SMS|Scheduling|Tag Management|Fonts|Icons|Other","tools":[{"name":"string","confidence":"confirmed|suspected|confirm|not_detected","detection_method":"script_tag|meta_tag|dns_record|cookie|http_header|cdn_reference|inferred","notes":"short evidence"}]}]}

Only include tech you actually detect. Mark uncertain as suspected.`

  const raw = await callClaude({
    system,
    user: prompt,
    maxTokens: 1500,
    timeoutMs: 20000,
  })
  const parsed = parseJson(raw) || { categories: [] }

  await s.from('koto_discovery_domains').update({
    scan_status: 'complete',
    tech_stack: parsed,
    last_scanned_at: new Date().toISOString(),
  }).eq('id', domainId)
}

// ─────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'list'
    const s = sb()

    // Public share view — no auth, lookup by token
    if (action === 'shared') {
      const token = searchParams.get('token') || ''
      if (!token) return Response.json({ error: 'Missing token' }, { status: 400 })

      const { data: share } = await s.from('koto_discovery_share_tokens').select('*').eq('token', token).maybeSingle()
      if (!share) return Response.json({ error: 'Not found' }, { status: 404 })
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        return Response.json({ error: 'Link expired' }, { status: 410 })
      }

      const { data: eng } = await s.from('koto_discovery_engagements').select('*').eq('id', share.engagement_id).maybeSingle()
      if (!eng) return Response.json({ error: 'Not found' }, { status: 404 })

      // Filter sections to only visible_section_ids (if specified)
      let sections = eng.sections || []
      if (Array.isArray(share.visible_section_ids) && share.visible_section_ids.length > 0) {
        sections = sections.filter((sec: any) => share.visible_section_ids.includes(sec.id))
      }
      // Strip never_share fields regardless
      sections = sections.map((sec: any) => ({
        ...sec,
        fields: (sec.fields || []).filter((f: any) => !f.never_share),
      }))

      // Bump view count
      const viewEvents = Array.isArray(share.view_events) ? share.view_events : []
      viewEvents.push({ ts: new Date().toISOString(), ua: req.headers.get('user-agent') || '' })
      await s.from('koto_discovery_share_tokens').update({
        view_count: (share.view_count || 0) + 1,
        last_viewed_at: new Date().toISOString(),
        view_events: viewEvents.slice(-50),
      }).eq('id', share.id)

      return Response.json({
        data: {
          client_name: eng.client_name,
          client_industry: eng.client_industry,
          executive_summary: eng.executive_summary,
          intel_cards: eng.intel_cards,
          sections,
          recipient_name: share.recipient_name,
        },
      })
    }

    const agencyId = resolveAgencyId(req, searchParams) || DEFAULT_AGENCY

    if (action === 'list') {
      const { data } = await s
        .from('koto_discovery_engagements')
        .select('id, client_name, client_industry, status, created_at, updated_at, compiled_at, client_form_submitted_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(200)
      return Response.json({ data: data || [] })
    }

    if (action === 'get') {
      const id = searchParams.get('id') || ''
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

      const [{ data: eng }, { data: domains }, { data: comments }, { data: shares }] = await Promise.all([
        s.from('koto_discovery_engagements').select('*').eq('id', id).maybeSingle(),
        s.from('koto_discovery_domains').select('*').eq('engagement_id', id).order('created_at'),
        s.from('koto_discovery_comments').select('*').eq('engagement_id', id).order('created_at'),
        s.from('koto_discovery_share_tokens').select('id, token, recipient_email, recipient_name, view_count, last_viewed_at, created_at, expires_at').eq('engagement_id', id).order('created_at', { ascending: false }),
      ])

      if (!eng) return Response.json({ error: 'Not found' }, { status: 404 })
      return Response.json({
        data: eng,
        domains: domains || [],
        comments: comments || [],
        shares: shares || [],
      })
    }

    if (action === 'stats') {
      const { data: all } = await s
        .from('koto_discovery_engagements')
        .select('status')
        .eq('agency_id', agencyId)
      const counts: Record<string, number> = {}
      for (const r of all || []) counts[r.status] = (counts[r.status] || 0) + 1
      return Response.json({
        data: {
          total: (all || []).length,
          draft: counts.draft || 0,
          research_running: counts.research_running || 0,
          research_complete: counts.research_complete || 0,
          compiled: counts.compiled || 0,
          shared: counts.shared || 0,
          archived: counts.archived || 0,
        },
      })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('discovery GET error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { searchParams } = new URL(req.url)
    const action = body.action || searchParams.get('action') || ''
    const s = sb()

    // Public submit path — no auth, token-based
    if (action === 'submit_client_form') {
      const token = body.token || ''
      const answers = body.answers || {}
      if (!token) return Response.json({ error: 'Missing token' }, { status: 400 })

      const { data: eng } = await s
        .from('koto_discovery_engagements')
        .select('*')
        .eq('client_form_token', token)
        .maybeSingle()
      if (!eng) return Response.json({ error: 'Invalid token' }, { status: 404 })
      if (eng.client_form_expires_at && new Date(eng.client_form_expires_at) < new Date()) {
        return Response.json({ error: 'Form expired' }, { status: 410 })
      }

      // Merge client answers into the sections as CLIENT_PROVIDED
      const sections = Array.isArray(eng.sections) ? eng.sections : []
      for (const sec of sections) {
        for (const field of sec.fields || []) {
          if (answers[field.id]) {
            field.answer = answers[field.id]
            field.source = 'client_provided'
          }
        }
      }

      await s.from('koto_discovery_engagements').update({
        client_answers: answers,
        client_form_submitted_at: new Date().toISOString(),
        sections,
        status: eng.status === 'draft' ? 'research_complete' : eng.status,
      }).eq('id', eng.id)

      return Response.json({ ok: true })
    }

    const agencyId = resolveAgencyId(req, searchParams, body) || DEFAULT_AGENCY

    // ─── create ──────────────────────────────────────────
    if (action === 'create') {
      const { client_name, client_id, client_industry, domains } = body
      if (!client_name) return Response.json({ error: 'Missing client_name' }, { status: 400 })

      const sections = getDefaultSections()

      const { data: eng, error } = await s
        .from('koto_discovery_engagements')
        .insert({
          agency_id: agencyId,
          client_id: client_id || null,
          client_name,
          client_industry: client_industry || null,
          status: 'research_running', // kick off research immediately
          sections,
        })
        .select('*')
        .maybeSingle()

      if (error || !eng) return Response.json({ error: error?.message || 'Insert failed' }, { status: 500 })

      // Insert domains and fetch them back so we have the new ids for scanning
      let insertedDomains: any[] = []
      if (Array.isArray(domains) && domains.length) {
        const domainRows = domains.map((d: any) => ({
          engagement_id: eng.id,
          agency_id: agencyId,
          url: typeof d === 'string' ? d : d.url,
          domain_type: typeof d === 'string' ? 'primary' : (d.domain_type || 'primary'),
        }))
        const { data: inserted } = await s.from('koto_discovery_domains').insert(domainRows).select('id')
        insertedDomains = inserted || []
      }

      // Fire-and-forget: pre-research + all domain scans in parallel.
      // Do NOT await — the client polls /api/discovery?action=list for status transitions.
      runResearchForEngagement(eng.id).catch((e) => {
        console.error('background research failed:', e?.message)
        // Even on failure, release the spinner so the UI doesn't hang forever.
        sb().from('koto_discovery_engagements').update({ status: 'research_complete' }).eq('id', eng.id).then(() => {})
      })
      if (insertedDomains.length) {
        Promise.all(insertedDomains.map((d) => scanDomainById(d.id)))
          .catch((e) => console.error('background domain scans failed:', e?.message))
      }

      return Response.json({ data: eng })
    }

    // ─── run_research ───────────────────────────────────
    if (action === 'run_research') {
      const { id } = body
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

      const { data: eng } = await s.from('koto_discovery_engagements').select('id').eq('id', id).maybeSingle()
      if (!eng) return Response.json({ error: 'Not found' }, { status: 404 })

      await s.from('koto_discovery_engagements').update({ status: 'research_running' }).eq('id', id)

      // Delegate to the shared worker so create + run_research share the same code path.
      await runResearchForEngagement(id)

      // Re-read the row so the caller gets the populated intel_cards/sections immediately.
      const { data: updated } = await s.from('koto_discovery_engagements').select('intel_cards, sections').eq('id', id).maybeSingle()
      return Response.json({ data: updated })
    }

    // ─── scan_domain ────────────────────────────────────
    if (action === 'scan_domain') {
      const { domain_id } = body
      if (!domain_id) return Response.json({ error: 'Missing domain_id' }, { status: 400 })

      // Delegate to shared worker (same code path as background scans from create).
      await scanDomainById(domain_id)

      const { data: updated } = await s.from('koto_discovery_domains').select('tech_stack, scan_status').eq('id', domain_id).maybeSingle()
      return Response.json({ data: updated })
    }

    // ─── save_field ──────────────────────────────────────
    if (action === 'save_field') {
      const { id, section_id, field_id, answer, source } = body
      if (!id || !section_id || !field_id) return Response.json({ error: 'Missing params' }, { status: 400 })

      const { data: eng } = await s.from('koto_discovery_engagements').select('sections').eq('id', id).maybeSingle()
      if (!eng) return Response.json({ error: 'Not found' }, { status: 404 })

      const sections = Array.isArray(eng.sections) ? eng.sections : []
      const sec = sections.find((x: any) => x.id === section_id)
      if (!sec) return Response.json({ error: 'Section not found' }, { status: 404 })
      const field = sec.fields.find((x: any) => x.id === field_id)
      if (!field) return Response.json({ error: 'Field not found' }, { status: 404 })

      field.answer = answer ?? ''
      if (source) field.source = source

      await s.from('koto_discovery_engagements').update({ sections }).eq('id', id)
      return Response.json({ ok: true })
    }

    // ─── edit_question ───────────────────────────────────
    if (action === 'edit_question') {
      const { id, section_id, field_id, question } = body
      const { data: eng } = await s.from('koto_discovery_engagements').select('sections').eq('id', id).maybeSingle()
      if (!eng) return Response.json({ error: 'Not found' }, { status: 404 })

      const sections = eng.sections || []
      const sec = sections.find((x: any) => x.id === section_id)
      const field = sec?.fields.find((x: any) => x.id === field_id)
      if (!field) return Response.json({ error: 'Field not found' }, { status: 404 })

      field.question = question
      field.question_is_edited = true

      await s.from('koto_discovery_engagements').update({ sections }).eq('id', id)
      return Response.json({ ok: true })
    }

    // ─── ai_questions (generate follow-ups) ──────────────
    if (action === 'ai_questions') {
      // Accept both the new spec field names and the legacy ones.
      const question = body.field_question || body.question || ''
      const answer = body.answer || ''
      const section_name = body.section_name || ''
      const doc_summary = body.doc_summary || ''
      const client_name = body.client_name || ''
      const client_industry = body.client_industry || ''

      if (!answer || answer.length < 20) {
        return Response.json({ data: { questions: [] } })
      }

      const system = 'You generate discovery follow-up questions. Return only JSON, be concise. No explanation, no preamble.'
      const prompt = `SECTION: ${section_name || 'unknown'}
QUESTION: ${question}
ANSWER: ${answer}
CLIENT: ${client_name || 'unknown'} (${client_industry || 'unknown industry'})
CONTEXT: ${doc_summary ? doc_summary.slice(0, 400) : '(no context yet)'}

Generate 1-3 short follow-ups (< 120 chars each) that uncover missing context, surface risk, or sharpen scope. JSON only: { "questions": ["...","..."] }`

      const raw = await callClaude({
        system,
        user: prompt,
        maxTokens: 300,
        temperature: 0,
        timeoutMs: 8000,
      })
      const parsed = parseJson(raw) || { questions: [] }
      const questions = Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3) : []
      return Response.json({ data: { questions } })
    }

    // ─── save_ai_question (persist generated AI questions) ──
    if (action === 'save_ai_question') {
      const { id, section_id, field_id, questions } = body
      const { data: eng } = await s.from('koto_discovery_engagements').select('sections').eq('id', id).maybeSingle()
      if (!eng) return Response.json({ error: 'Not found' }, { status: 404 })
      const sections = eng.sections || []
      const field = sections.find((x: any) => x.id === section_id)?.fields.find((x: any) => x.id === field_id)
      if (!field) return Response.json({ error: 'Field not found' }, { status: 404 })

      field.ai_questions = (questions || []).map((q: string) => ({
        id: `aiq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        question: q,
        status: 'pending',
        answer: '',
      }))

      await s.from('koto_discovery_engagements').update({ sections }).eq('id', id)
      return Response.json({ ok: true })
    }

    // ─── action_ai_question (answer/dismiss/promoted) ──
    if (action === 'action_ai_question') {
      const { id, section_id, field_id, ai_question_id, verb, answer } = body
      const { data: eng } = await s.from('koto_discovery_engagements').select('sections').eq('id', id).maybeSingle()
      if (!eng) return Response.json({ error: 'Not found' }, { status: 404 })
      const sections = eng.sections || []
      const sec = sections.find((x: any) => x.id === section_id)
      const field = sec?.fields.find((x: any) => x.id === field_id)
      if (!field) return Response.json({ error: 'Field not found' }, { status: 404 })

      const aiq = (field.ai_questions || []).find((x: any) => x.id === ai_question_id)
      if (!aiq) return Response.json({ error: 'AI question not found' }, { status: 404 })

      if (verb === 'answer') {
        aiq.status = 'answered'
        aiq.answer = answer || ''
      } else if (verb === 'dismiss') {
        aiq.status = 'dismissed'
      } else if (verb === 'promoted') {
        aiq.status = 'promoted'
        // Promote to a permanent field in the same section
        const newField = {
          id: `${field_id}_p${Date.now().toString(36).slice(-4)}`,
          question: aiq.question,
          hint: '',
          answer: answer || aiq.answer || '',
          source: 'manually_promoted',
          question_is_edited: false,
          ai_questions: [],
        }
        sec.fields.push(newField)
      }

      await s.from('koto_discovery_engagements').update({ sections }).eq('id', id)
      return Response.json({ ok: true })
    }

    // ─── toggle_visibility ──────────────────────────────
    if (action === 'toggle_visibility') {
      const { id, section_id, visible } = body
      const { data: eng } = await s.from('koto_discovery_engagements').select('sections').eq('id', id).maybeSingle()
      if (!eng) return Response.json({ error: 'Not found' }, { status: 404 })
      const sections = eng.sections || []
      const sec = sections.find((x: any) => x.id === section_id)
      if (!sec) return Response.json({ error: 'Section not found' }, { status: 404 })
      sec.visible = visible !== undefined ? !!visible : !sec.visible
      await s.from('koto_discovery_engagements').update({ sections }).eq('id', id)
      return Response.json({ ok: true, visible: sec.visible })
    }

    // ─── update_tech ────────────────────────────────────
    if (action === 'update_tech') {
      const { domain_id, category_name, tool_name, updates } = body
      const { data: domain } = await s.from('koto_discovery_domains').select('tech_stack').eq('id', domain_id).maybeSingle()
      if (!domain) return Response.json({ error: 'Not found' }, { status: 404 })
      const stack = domain.tech_stack || { categories: [] }
      const cat = (stack.categories || []).find((c: any) => c.name === category_name)
      const tool = cat?.tools?.find((t: any) => t.name === tool_name)
      if (!tool) return Response.json({ error: 'Tool not found' }, { status: 404 })
      Object.assign(tool, updates || {})
      await s.from('koto_discovery_domains').update({ tech_stack: stack }).eq('id', domain_id)
      return Response.json({ ok: true })
    }

    // ─── add_tech ───────────────────────────────────────
    if (action === 'add_tech') {
      const { domain_id, category_name, tool } = body
      const { data: domain } = await s.from('koto_discovery_domains').select('tech_stack').eq('id', domain_id).maybeSingle()
      if (!domain) return Response.json({ error: 'Not found' }, { status: 404 })
      const stack = domain.tech_stack || { categories: [] }
      let cat = (stack.categories || []).find((c: any) => c.name === category_name)
      if (!cat) {
        cat = { name: category_name, tools: [] }
        stack.categories = [...(stack.categories || []), cat]
      }
      cat.tools.push({
        name: tool.name,
        confidence: tool.confidence || 'confirmed',
        detection_method: tool.detection_method || 'inferred',
        notes: tool.notes || 'Added manually',
      })
      await s.from('koto_discovery_domains').update({ tech_stack: stack }).eq('id', domain_id)
      return Response.json({ ok: true })
    }

    // ─── add_domain ─────────────────────────────────────
    if (action === 'add_domain') {
      const { engagement_id, url, domain_type } = body
      if (!engagement_id || !url) return Response.json({ error: 'Missing params' }, { status: 400 })
      const { data } = await s.from('koto_discovery_domains').insert({
        engagement_id,
        agency_id: agencyId,
        url,
        domain_type: domain_type || 'secondary',
      }).select('*').maybeSingle()
      return Response.json({ data })
    }

    // ─── create_share ────────────────────────────────────
    if (action === 'create_share') {
      const { engagement_id, recipient_email, recipient_name, visible_section_ids, expires_in_days } = body
      if (!engagement_id) return Response.json({ error: 'Missing engagement_id' }, { status: 400 })
      const token = randomToken(28)
      const expires = expires_in_days
        ? new Date(Date.now() + expires_in_days * 86400000).toISOString()
        : null
      const { data } = await s.from('koto_discovery_share_tokens').insert({
        engagement_id,
        agency_id: agencyId,
        token,
        recipient_email: recipient_email || null,
        recipient_name: recipient_name || null,
        visible_section_ids: Array.isArray(visible_section_ids) ? visible_section_ids : [],
        expires_at: expires,
      }).select('*').maybeSingle()

      // Mark engagement as shared
      await s.from('koto_discovery_engagements').update({ status: 'shared' }).eq('id', engagement_id)

      return Response.json({ data, share_url: `/discovery/shared/${token}` })
    }

    // ─── add_comment ────────────────────────────────────
    if (action === 'add_comment') {
      const { engagement_id, section_id, content, author_display_name, parent_comment_id } = body
      if (!engagement_id || !section_id || !content) return Response.json({ error: 'Missing params' }, { status: 400 })
      const { data } = await s.from('koto_discovery_comments').insert({
        engagement_id,
        agency_id: agencyId,
        section_id,
        content,
        author_display_name: author_display_name || 'Agent',
        parent_comment_id: parent_comment_id || null,
      }).select('*').maybeSingle()
      return Response.json({ data })
    }

    // ─── resolve_comment ────────────────────────────────
    if (action === 'resolve_comment') {
      const { comment_id } = body
      await s.from('koto_discovery_comments').update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
      }).eq('id', comment_id)
      return Response.json({ ok: true })
    }

    // ─── compile (executive summary) ─────────────────────
    if (action === 'compile') {
      const { id } = body
      const { data: eng } = await s.from('koto_discovery_engagements').select('*').eq('id', id).maybeSingle()
      if (!eng) return Response.json({ error: 'Not found' }, { status: 404 })

      // Flatten answers into a digest
      const digest: string[] = []
      for (const sec of eng.sections || []) {
        if (sec.visible === false) continue
        digest.push(`## ${sec.title}`)
        for (const f of sec.fields || []) {
          if (f.never_share) continue
          if (f.answer) digest.push(`- ${f.question}: ${f.answer}`)
        }
      }

      const system = 'You are a senior strategist. Be direct, concise, and specific. Write plain prose.'
      const prompt = `Compile a discovery engagement into an executive summary.

Client: ${eng.client_name}
Industry: ${eng.client_industry || 'unknown'}

Data:
${digest.join('\n').slice(0, 40_000)}

Produce 3-4 tight paragraphs covering: (1) who they are and where they stand, (2) top risks, (3) top 3 opportunities, (4) recommended scope + first-90-day plan. No bullets.`

      const summary = await callClaude({
        system,
        user: prompt,
        maxTokens: 1500,
        timeoutMs: 25000,
      })

      await s.from('koto_discovery_engagements').update({
        executive_summary: summary,
        compiled_at: new Date().toISOString(),
        status: 'compiled',
      }).eq('id', id)

      return Response.json({ data: { executive_summary: summary } })
    }

    // ─── send_client_form ───────────────────────────────
    if (action === 'send_client_form') {
      const { id, expires_in_days } = body
      const token = randomToken(24)
      const expires = new Date(Date.now() + (expires_in_days || 14) * 86400000).toISOString()

      await s.from('koto_discovery_engagements').update({
        client_form_token: token,
        client_form_sent_at: new Date().toISOString(),
        client_form_expires_at: expires,
      }).eq('id', id)

      return Response.json({ data: { token, form_url: `/discovery/client/${token}`, expires_at: expires } })
    }

    // ─── update_status ──────────────────────────────────
    if (action === 'update_status') {
      const { id, status } = body
      await s.from('koto_discovery_engagements').update({ status }).eq('id', id)
      return Response.json({ ok: true })
    }

    // ─── delete ─────────────────────────────────────────
    if (action === 'delete') {
      const { id } = body
      await s.from('koto_discovery_engagements').delete().eq('id', id)
      return Response.json({ ok: true })
    }

    // ─── interview_message (Adam Segall conversational mode) ──
    if (action === 'interview_message') {
      const { engagement_id, message, conversation_history, current_section_id } = body
      if (!engagement_id) return Response.json({ error: 'Missing engagement_id' }, { status: 400 })

      const { data: eng } = await s.from('koto_discovery_engagements').select('*').eq('id', engagement_id).maybeSingle()
      if (!eng) return Response.json({ error: 'Not found' }, { status: 404 })

      const sections = Array.isArray(eng.sections) ? eng.sections : []
      const currentSection = sections.find((sec: any) => sec.id === current_section_id) || sections[0]
      if (!currentSection) return Response.json({ error: 'No sections' }, { status: 400 })

      // Build the remaining questions list for the current section
      const remainingQuestions = (currentSection.fields || [])
        .filter((f: any) => !(f.answer || '').trim())
        .map((f: any) => `- ${f.id}: ${f.question}`)
        .join('\n') || '(all covered in this section)'

      // Captured answers across all sections (for context)
      const capturedLines: string[] = []
      for (const sec of sections) {
        for (const f of sec.fields || []) {
          if ((f.answer || '').trim()) capturedLines.push(`[${sec.id}] ${f.question}: ${f.answer}`)
        }
      }
      const capturedAnswers = capturedLines.length ? capturedLines.join('\n') : '(none yet)'

      // Engagement summary
      const intelLines: string[] = []
      for (const card of (eng.intel_cards || [])) {
        intelLines.push(`- ${card.title}: ${card.body}`)
      }
      const engagementSummary =
        `Client: ${eng.client_name}\n` +
        `Industry: ${eng.client_industry || 'unknown'}\n` +
        (intelLines.length ? `Pre-call intel:\n${intelLines.join('\n')}` : 'No pre-call intel yet.')

      const system = `You are Adam Segall, a 25-year veteran in marketing, sales, and business operations. You are CEO of Momenta Marketing and have worked with hundreds of businesses across every industry. You are conducting a discovery call to deeply understand this client's business before building a marketing and operations strategy for them.

Your personality: Direct but warm. Genuinely curious. You ask one question at a time and actually listen to the answer before moving to the next. You probe naturally when something interesting comes up — you don't robotically follow a script. You use plain language. You occasionally use humor when appropriate. You have pattern recognition from hundreds of businesses and you're not afraid to name what you're seeing.

Your job in this conversation:
1. Work through the discovery sections in order, but do it conversationally — not as a form
2. Extract answers naturally from what the person says
3. When you have enough on a topic, transition naturally to the next area
4. Flag anything that sounds like a risk, gap, or major opportunity — say it directly
5. At the end of each section, do a quick verbal summary of what you heard before moving on

Current engagement context:
${engagementSummary}

Current section being covered: ${currentSection.title}${currentSection.subtitle ? ` — ${currentSection.subtitle}` : ''}

Questions still to cover in this section:
${remainingQuestions}

What has been captured so far across all sections:
${capturedAnswers}

Return ONLY a JSON object in this exact shape (no prose, no markdown fence):
{
  "message": "your next message to the client — one question at a time, conversational",
  "extracted_answers": [{"field_id": "01a", "answer": "extracted answer text"}],
  "section_complete": false,
  "suggested_next_section": null,
  "flags": [{"type": "risk|opportunity|gap", "note": "short direct observation"}]
}

Only include extracted_answers for field_ids that appear in the current section's remaining questions above. Set section_complete=true only when you genuinely have enough on every remaining question. Set suggested_next_section to the next section id when you're ready to transition. Return an empty array for flags if nothing notable.`

      const apiKey = process.env.ANTHROPIC_API_KEY || ''
      if (!apiKey) {
        return Response.json({
          data: {
            message: "I'm not hooked up to the AI backend right now — check that ANTHROPIC_API_KEY is set in the environment.",
            extracted_answers: [],
            section_complete: false,
            suggested_next_section: null,
            flags: [],
          },
        })
      }

      // Build the Claude messages array from conversation_history + the new user message
      const history = Array.isArray(conversation_history) ? conversation_history : []
      const claudeMessages: any[] = history
        .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m: any) => ({ role: m.role, content: m.content }))
      if (message) claudeMessages.push({ role: 'user', content: message })
      // If the very first call has no user message at all, prime with a kickoff instruction
      if (claudeMessages.length === 0) {
        claudeMessages.push({
          role: 'user',
          content: `[Open the conversation. Introduce yourself as Adam naturally and ask your first question based on ${eng.client_name} (${eng.client_industry || 'unknown industry'}). Keep it human.]`,
        })
      }

      let parsed: any = {
        message: '',
        extracted_answers: [],
        section_complete: false,
        suggested_next_section: null,
        flags: [],
      }

      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: 800,
            system,
            messages: claudeMessages,
          }),
          signal: AbortSignal.timeout(12000),
        })
        if (res.ok) {
          const d = await res.json()
          const txt = (d.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim()
          const j = parseJson(txt)
          if (j && typeof j === 'object') parsed = { ...parsed, ...j }
          // If the model returned a string instead of object (still valid JSON), salvage it
          if (!parsed.message && typeof txt === 'string' && txt.length > 0 && !j) {
            parsed.message = txt
          }
        } else {
          const errBody = await res.text().catch(() => '')
          parsed.message = `(AI error ${res.status}) ${errBody.slice(0, 200)}`
        }
      } catch (e: any) {
        parsed.message = `(AI request failed: ${e.message})`
      }

      // Persist any extracted answers into the engagement sections
      if (Array.isArray(parsed.extracted_answers) && parsed.extracted_answers.length > 0) {
        const updatedSections = sections.map((sec: any) => ({ ...sec, fields: [...(sec.fields || [])] }))
        for (const ext of parsed.extracted_answers) {
          if (!ext?.field_id || !ext?.answer) continue
          for (const sec of updatedSections) {
            const field = (sec.fields || []).find((f: any) => f.id === ext.field_id)
            if (field) {
              field.answer = ext.answer
              field.source = 'ai_generated'
              break
            }
          }
        }
        await s.from('koto_discovery_engagements').update({ sections: updatedSections }).eq('id', engagement_id)
      }

      // Persist any new flags by appending to interview_flags
      if (Array.isArray(parsed.flags) && parsed.flags.length > 0) {
        try {
          const existingFlags = Array.isArray(eng.interview_flags) ? eng.interview_flags : []
          const ts = new Date().toISOString()
          const newFlags = parsed.flags
            .filter((f: any) => f && f.type && f.note)
            .map((f: any) => ({
              type: f.type,
              note: f.note,
              section_id: current_section_id || null,
              section_title: currentSection.title || null,
              captured_at: ts,
            }))
          if (newFlags.length > 0) {
            await s.from('koto_discovery_engagements').update({
              interview_flags: [...existingFlags, ...newFlags],
            }).eq('id', engagement_id)
          }
        } catch { /* non-fatal */ }
      }

      return Response.json({ data: parsed })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('discovery POST error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
