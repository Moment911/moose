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
async function callClaude(opts: { system?: string; user: string; maxTokens?: number; tools?: any[] }): Promise<string> {
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
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
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
          status: 'draft',
          sections,
        })
        .select('*')
        .maybeSingle()

      if (error || !eng) return Response.json({ error: error?.message || 'Insert failed' }, { status: 500 })

      // Insert domains
      if (Array.isArray(domains) && domains.length) {
        const domainRows = domains.map((d: any) => ({
          engagement_id: eng.id,
          agency_id: agencyId,
          url: typeof d === 'string' ? d : d.url,
          domain_type: typeof d === 'string' ? 'primary' : (d.domain_type || 'primary'),
        }))
        await s.from('koto_discovery_domains').insert(domainRows)
      }

      return Response.json({ data: eng })
    }

    // ─── run_research ───────────────────────────────────
    if (action === 'run_research') {
      const { id } = body
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

      const { data: eng } = await s.from('koto_discovery_engagements').select('*').eq('id', id).maybeSingle()
      if (!eng) return Response.json({ error: 'Not found' }, { status: 404 })

      await s.from('koto_discovery_engagements').update({ status: 'research_running' }).eq('id', id)

      const { data: domains } = await s.from('koto_discovery_domains').select('*').eq('engagement_id', id)
      const domainList = (domains || []).map((d: any) => d.url).join(', ')

      const prompt = `You are doing pre-call research on a prospective client for a marketing agency engagement.

Client: ${eng.client_name}
Industry: ${eng.client_industry || 'unknown'}
Domains: ${domainList || 'none provided'}

Produce a JSON object with:
{
  "intel_cards": [
    { "title": "string", "body": "string", "category": "authority|revenue|risk|opportunity|team|digital" }
  ],
  "section_01": {
    "01a": "background/authority summary (2-4 sentences)",
    "01b": "business entities identified (comma list or short paragraph)",
    "01c": "revenue streams identified (bullet list as one string with • separators)",
    "01d": "key observations and risk flags (2-4 sentences)"
  }
}

Aim for 4-8 intel cards. Be concrete and specific. Return ONLY valid JSON.`

      const raw = await callClaude({ user: prompt, maxTokens: 3000 })
      const parsed = parseJson(raw) || {}

      const intel_cards = Array.isArray(parsed.intel_cards) ? parsed.intel_cards : []
      const section01 = parsed.section_01 || {}

      // Merge section_01 results into sections
      const sections = Array.isArray(eng.sections) ? eng.sections : getDefaultSections()
      const s01 = sections.find((sec: any) => sec.id === 'section_01')
      if (s01) {
        for (const fieldId of ['01a', '01b', '01c', '01d']) {
          const field = s01.fields.find((f: any) => f.id === fieldId)
          if (field && section01[fieldId]) {
            field.answer = section01[fieldId]
            field.source = 'ai_generated'
          }
        }
      }

      await s.from('koto_discovery_engagements').update({
        intel_cards,
        sections,
        status: 'research_complete',
      }).eq('id', id)

      return Response.json({ data: { intel_cards, section_01: section01 } })
    }

    // ─── scan_domain ────────────────────────────────────
    if (action === 'scan_domain') {
      const { domain_id } = body
      if (!domain_id) return Response.json({ error: 'Missing domain_id' }, { status: 400 })

      const { data: domain } = await s.from('koto_discovery_domains').select('*').eq('id', domain_id).maybeSingle()
      if (!domain) return Response.json({ error: 'Not found' }, { status: 404 })

      await s.from('koto_discovery_domains').update({ scan_status: 'scanning' }).eq('id', domain_id)

      // Fetch page HTML
      let html = ''
      let headers: Record<string, string> = {}
      try {
        const url = domain.url.startsWith('http') ? domain.url : `https://${domain.url}`
        const res = await fetch(url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoDiscovery/1.0)' },
        })
        html = (await res.text()).slice(0, 180_000) // cap
        res.headers.forEach((v, k) => { headers[k] = v })
      } catch (e: any) {
        await s.from('koto_discovery_domains').update({
          scan_status: 'failed',
          tech_stack: { error: e.message },
          last_scanned_at: new Date().toISOString(),
        }).eq('id', domain_id)
        return Response.json({ error: 'Fetch failed', detail: e.message }, { status: 200 })
      }

      // Ask Claude to identify tech stack
      const prompt = `Analyze this website's HTML and HTTP headers and identify the technology stack.

URL: ${domain.url}
HTTP Headers: ${JSON.stringify(headers).slice(0, 2000)}
HTML (truncated): ${html.slice(0, 60_000)}

Return JSON in this exact shape:
{
  "categories": [
    {
      "name": "CMS|Analytics|Ads|Email|Chat|CRM|Hosting|CDN|Framework|Ecommerce|Forms|Payments|Video|Reviews|SMS|Scheduling|Tag Management|Fonts|Icons|Other",
      "tools": [
        {
          "name": "tool name",
          "confidence": "confirmed|suspected|confirm|not_detected",
          "detection_method": "script_tag|meta_tag|dns_record|cookie|http_header|cdn_reference|inferred",
          "notes": "short evidence"
        }
      ]
    }
  ]
}

Include only technologies you actually detect. If unsure, mark as suspected. Return ONLY valid JSON.`

      const raw = await callClaude({ user: prompt, maxTokens: 3000 })
      const parsed = parseJson(raw) || { categories: [] }

      await s.from('koto_discovery_domains').update({
        scan_status: 'complete',
        tech_stack: parsed,
        last_scanned_at: new Date().toISOString(),
      }).eq('id', domain_id)

      return Response.json({ data: { tech_stack: parsed } })
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
      const { question, answer, client_name, client_industry } = body
      if (!answer || answer.length < 30) {
        return Response.json({ data: { questions: [] } })
      }

      const prompt = `You are a senior discovery strategist. A client is answering this question:

QUESTION: ${question}
CURRENT ANSWER: ${answer}
Client: ${client_name || 'unknown'}
Industry: ${client_industry || 'unknown'}

Generate 1-3 follow-up questions that would uncover critical missing context, surface risk, or sharpen the scope. Return JSON:
{ "questions": ["question 1", "question 2", "question 3"] }

Return ONLY valid JSON. Keep each question short (< 120 chars).`

      const raw = await callClaude({ user: prompt, maxTokens: 500 })
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

      const prompt = `You are a senior strategist compiling a discovery engagement into an executive summary.

Client: ${eng.client_name}
Industry: ${eng.client_industry || 'unknown'}

Discovery data:
${digest.join('\n').slice(0, 60_000)}

Produce a 4-6 paragraph executive summary covering:
1. Who the client is and where they stand today
2. The critical problems and risks worth naming
3. The top 3 opportunities with highest leverage
4. Recommended engagement scope and first-90-day plan

Write in plain prose, no bullet lists. Be direct and specific.`

      const summary = await callClaude({ user: prompt, maxTokens: 2500 })

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

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('discovery POST error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
