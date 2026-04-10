import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// Discovery AI Coach
//
// Real-time coaching assistant that helps the agency user fill out
// a discovery document. Two actions:
//
// 1. get_section_coaching — fast Haiku call, returns smart questions,
//    red flags, opportunities, and an optional chat response for one
//    specific section. Used by the right-side coach panel as the user
//    scrolls through the document.
//
// 2. cross_section_analysis — slower Sonnet call, looks across ALL
//    sections and returns contradictions, top opportunities, critical
//    gaps, a readiness assessment, and suggested proposal focus areas.
//    Used by the "Full Analysis" tab.
// ─────────────────────────────────────────────────────────────

const FAST_MODEL = 'claude-haiku-4-5-20251001'
const SLOW_MODEL = 'claude-sonnet-4-20250514'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function callClaudeJson(opts: {
  model: string
  system: string
  user: string
  maxTokens: number
  timeoutMs?: number
}): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY || ''
  if (!apiKey) return null
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        temperature: 0.4,
        system: opts.system,
        messages: [{ role: 'user', content: opts.user }],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15000),
    })
    if (!res.ok) return null
    const d = await res.json()
    const text = (d.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim()
    const cleaned = text.replace(/```json|```/g, '').trim()
    try { return JSON.parse(cleaned) } catch { return null }
  } catch { return null }
}

// Sections that are thematically related — used when coaching a single
// section so the model sees the context from connected sections too.
const RELATED_SECTIONS: Record<string, string[]> = {
  section_01: [],
  section_02: ['section_06'],
  section_03: ['section_05', 'section_11'],
  section_04: ['section_05', 'section_10'],
  section_05: ['section_06', 'section_07', 'section_11'],
  section_06: ['section_05', 'section_07', 'section_08'],
  section_07: ['section_05', 'section_06'],
  section_08: ['section_06', 'section_05'],
  section_09: ['section_05', 'section_06'],
  section_10: ['section_04', 'section_07'],
  section_11: ['section_05', 'section_10'],
  section_12: ['section_10'],
}

function serializeSectionAnswers(sec: any): string {
  if (!sec) return ''
  const lines: string[] = [`# ${sec.title || sec.id}${sec.subtitle ? ' — ' + sec.subtitle : ''}`]
  for (const f of (sec.fields || [])) {
    const answer = typeof f.answer === 'string' && f.answer.trim() ? f.answer.trim() : '(empty)'
    lines.push(`- [${f.id}] ${f.question}: ${answer}`)
  }
  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { action, engagement_id, agency_id } = body || {}

    if (!engagement_id || !agency_id) {
      return NextResponse.json({ error: 'Missing engagement_id or agency_id' }, { status: 400 })
    }

    const sb = getSupabase()

    // ── Load engagement + client context (shared by both actions) ──
    const { data: eng } = await sb
      .from('koto_discovery_engagements')
      .select('id, client_id, client_name, client_industry, sections, intel_cards')
      .eq('id', engagement_id)
      .eq('agency_id', agency_id)
      .maybeSingle()

    if (!eng) {
      return NextResponse.json({ error: 'Engagement not found' }, { status: 404 })
    }

    let clientWelcome = ''
    let clientClassification: any = null
    let clientCity = ''
    let clientState = ''
    if (eng.client_id) {
      const { data: client } = await sb
        .from('clients')
        .select('welcome_statement, business_classification, city, state')
        .eq('id', eng.client_id)
        .maybeSingle()
      clientWelcome = (client?.welcome_statement || '').trim()
      clientClassification = client?.business_classification || null
      clientCity = client?.city || ''
      clientState = client?.state || ''
    }

    const classLine = clientClassification
      ? `${String(clientClassification.business_model || 'unknown').toUpperCase()} · ${clientClassification.geographic_scope || 'unknown'} · ${String(clientClassification.business_type || 'unknown').replace(/_/g, ' ')} · ${clientClassification.sales_cycle || 'unknown'} sales`
      : 'Classification not set'

    const sections: any[] = Array.isArray(eng.sections) ? eng.sections : []

    // ─────────────────────────────────────────────────────────────
    // Action 1: get_section_coaching
    // ─────────────────────────────────────────────────────────────
    if (action === 'get_section_coaching') {
      const { section_id, question } = body
      if (!section_id) {
        return NextResponse.json({ error: 'Missing section_id' }, { status: 400 })
      }

      const section = sections.find((s) => s.id === section_id)
      if (!section) {
        return NextResponse.json({ error: 'Section not found' }, { status: 404 })
      }

      const relatedIds = RELATED_SECTIONS[section_id] || []
      const related = relatedIds
        .map((rid) => sections.find((s) => s.id === rid))
        .filter(Boolean)

      const currentBlock = serializeSectionAnswers(section)
      const relatedBlock = related.length
        ? related.map(serializeSectionAnswers).join('\n\n')
        : '(no related sections)'

      const systemPrompt = `You are a senior marketing strategist coaching an agency team member through a discovery call in real time. You have deep expertise in marketing technology, automation, CRM platforms (ServiceTitan, HubSpot, Salesforce, GoHighLevel, Klaviyo), and local vs national business growth.

Your job is to give specific, tactical, actionable coaching — not generic advice. Always reference the specific answers they've already captured. If a field is empty, push them to ask about it. If an answer contradicts another section, flag it.

Return valid JSON only. No preamble, no markdown fences.`

      const userPrompt = `Client: ${eng.client_name || 'Unknown'}
Industry: ${eng.client_industry || 'Unknown'} | Location: ${[clientCity, clientState].filter(Boolean).join(', ') || 'Unknown'}
Classification: ${classLine}

Welcome statement (client's own words):
${clientWelcome || '(not provided)'}

─── CURRENT SECTION BEING COACHED ───
${currentBlock}

─── RELATED SECTIONS (for cross-reference) ───
${relatedBlock}

${question ? `The agency user is asking: "${question}"\n\nAnswer conversationally in the chat_response field.` : 'Provide proactive coaching for this section. No user question — generate smart_questions, red_flags, and opportunities based on what you see.'}

Return JSON with this exact shape (all fields required, arrays can be empty):
{
  "smart_questions": ["Specific question 1 they should ask right now", "Question 2", "Question 3"],
  "red_flags": [{ "flag": "Short description of the risk", "severity": "high" }],
  "opportunities": [{ "opportunity": "Short description of the win", "type": "ghl" }],
  "coaching_note": "1-2 sentence tactical tip for this moment",
  "chat_response": ${question ? '"Conversational answer to their question — be specific and tactical"' : 'null'}
}

Rules:
- smart_questions: 3-5 questions, each one specific to THIS client's situation (reference actual answers, platforms, numbers you see above). No generic questions.
- red_flags: only include actual detected risks from the answers. severity is one of: high | medium | low. Empty array if none.
- opportunities: only include real opportunities you can spot. type is one of: ghl | email | sms | ads | seo | crm | general. Empty array if none.
- coaching_note: the single most important thing to do right now in this section.
- chat_response: only populated if the user asked a question, otherwise null.`

      const result = await callClaudeJson({
        model: FAST_MODEL,
        system: systemPrompt,
        user: userPrompt,
        maxTokens: 900,
        timeoutMs: 15000,
      })

      if (!result) {
        return NextResponse.json({
          smart_questions: [],
          red_flags: [],
          opportunities: [],
          coaching_note: 'Coach is temporarily unavailable — ask questions manually and fill in answers as you go.',
          chat_response: null,
          error: 'AI unavailable',
        })
      }

      // Compute section completion for the panel header
      const totalFields = (section.fields || []).length
      const answeredFields = (section.fields || []).filter((f: any) => typeof f.answer === 'string' && f.answer.trim()).length

      return NextResponse.json({
        section_id,
        section_title: section.title,
        section_subtitle: section.subtitle,
        completion: { answered: answeredFields, total: totalFields },
        smart_questions: Array.isArray(result.smart_questions) ? result.smart_questions : [],
        red_flags: Array.isArray(result.red_flags) ? result.red_flags : [],
        opportunities: Array.isArray(result.opportunities) ? result.opportunities : [],
        coaching_note: typeof result.coaching_note === 'string' ? result.coaching_note : '',
        chat_response: typeof result.chat_response === 'string' ? result.chat_response : null,
      })
    }

    // ─────────────────────────────────────────────────────────────
    // Action 2: cross_section_analysis
    // ─────────────────────────────────────────────────────────────
    if (action === 'cross_section_analysis') {
      const allSectionsBlock = sections.map(serializeSectionAnswers).join('\n\n')

      // Count answered fields per section for the model
      const sectionStats = sections.map((sec) => {
        const total = (sec.fields || []).length
        const answered = (sec.fields || []).filter((f: any) => typeof f.answer === 'string' && f.answer.trim()).length
        return `- ${sec.id} (${sec.title}): ${answered}/${total} answered`
      }).join('\n')

      const systemPrompt = `You are a senior marketing strategist reviewing a completed (or in-progress) discovery document before the proposal is written. Your job is to spot contradictions between sections, identify the 3 highest-leverage opportunities, flag critical gaps, assess overall client readiness, and recommend what the proposal should lead with.

Be specific. Reference actual answers. Never invent data. If a section is mostly empty, flag it as a gap rather than guessing.

Return valid JSON only. No preamble, no markdown fences.`

      const userPrompt = `Client: ${eng.client_name || 'Unknown'}
Industry: ${eng.client_industry || 'Unknown'} | Location: ${[clientCity, clientState].filter(Boolean).join(', ') || 'Unknown'}
Classification: ${classLine}

Welcome statement:
${clientWelcome || '(not provided)'}

─── SECTION COMPLETION ───
${sectionStats}

─── FULL DISCOVERY DOCUMENT ───
${allSectionsBlock}

Analyze this and return JSON with this exact shape:
{
  "contradictions": [
    { "sections": ["section_05", "section_06"], "description": "They say they have great follow-up in 05c but 06c shows 0 active workflows in the CRM" }
  ],
  "top_opportunities": [
    { "title": "Short punchy title", "why": "1-2 sentences grounded in their actual answers", "which_sections": ["section_07", "section_09"] }
  ],
  "critical_gaps": [
    "Specific missing data that must be captured before the proposal — e.g. 'Lead-to-call conversion rate in section 05d is empty'"
  ],
  "readiness_assessment": "2-3 sentence paragraph summarizing overall readiness and the biggest risk/opportunity",
  "proposal_focus": [
    "What the proposal should lead with #1 — be specific",
    "Focus area #2",
    "Focus area #3"
  ]
}

Rules:
- contradictions: only include real conflicts you can point to in the text. Empty array if none found.
- top_opportunities: exactly 3 items, ranked by impact. Each must reference the actual answers.
- critical_gaps: list the most important missing fields (max 5). Prioritize fields that matter for the proposal.
- readiness_assessment: one paragraph, 2-3 sentences.
- proposal_focus: 3 items.`

      const result = await callClaudeJson({
        model: SLOW_MODEL,
        system: systemPrompt,
        user: userPrompt,
        maxTokens: 1500,
        timeoutMs: 45000,
      })

      if (!result) {
        return NextResponse.json({
          contradictions: [],
          top_opportunities: [],
          critical_gaps: [],
          readiness_assessment: 'Cross-section analysis is temporarily unavailable.',
          proposal_focus: [],
          error: 'AI unavailable',
        })
      }

      return NextResponse.json({
        contradictions: Array.isArray(result.contradictions) ? result.contradictions : [],
        top_opportunities: Array.isArray(result.top_opportunities) ? result.top_opportunities : [],
        critical_gaps: Array.isArray(result.critical_gaps) ? result.critical_gaps : [],
        readiness_assessment: typeof result.readiness_assessment === 'string' ? result.readiness_assessment : '',
        proposal_focus: Array.isArray(result.proposal_focus) ? result.proposal_focus : [],
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
