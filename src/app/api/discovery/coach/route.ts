import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logTokenUsage } from '@/lib/tokenTracker'

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
    // Fire-and-forget token accounting
    void logTokenUsage({
      feature: 'discovery_coach',
      model: opts.model,
      inputTokens: d.usage?.input_tokens || 0,
      outputTokens: d.usage?.output_tokens || 0,
    })
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

You also decide whether the current section is actually applicable to this client. Only suggest marking a section N/A when you're highly confident based on the evidence in the answers — do NOT suggest N/A for a section just because fields are empty.

N/A suggestion rules:
- section_09 (SMS Marketing) → may be N/A if the business is B2B software/SaaS with no consumer customers and no transactional SMS use case.
- section_07 with focus on 07c (E-commerce pipeline) → may be N/A if business has no products, pure professional services only.
- section_11 (Paid Advertising) → may be N/A only if answers clearly show zero current ad spend AND explicit "not interested in ads" language.
- section_08 (Email Marketing) → may be N/A if B2B enterprise with under 50 contacts and no email list exists.
- Never suggest N/A for sections 01, 04, 05, 10, or 12 — these are always relevant.
- Only include a suggestion when confidence is above 70.

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

Return JSON with this exact shape (all fields required, arrays can be empty, not_applicable_suggestion can be null):
{
  "smart_questions": ["Specific question 1 they should ask right now", "Question 2", "Question 3"],
  "red_flags": [{ "flag": "Short description of the risk", "severity": "high" }],
  "opportunities": [
    {
      "opportunity": "Short description of the win",
      "type": "ghl",
      "section_id": "section_06",
      "field_id": "06f",
      "can_autofill": true
    }
  ],
  "coaching_note": "1-2 sentence tactical tip for this moment",
  "chat_response": ${question ? '"Conversational answer to their question — be specific and tactical"' : 'null'},
  "not_applicable_suggestion": { "suggested": true, "reason": "one sentence", "confidence": 85 }
}

Rules:
- smart_questions: 3-5 questions, each one specific to THIS client's situation (reference actual answers, platforms, numbers you see above). No generic questions.
- red_flags: only include actual detected risks from the answers. severity is one of: high | medium | low. Empty array if none.
- opportunities: only include real opportunities you can spot.
  - type is one of: ghl | email | sms | ads | seo | crm | autofill | general.
  - section_id and field_id may be included when the opportunity is about filling a specific empty field that can be inferred from other answers. Set can_autofill: true in that case. When the opportunity is general strategy, use null for both ids and set can_autofill: false.
  - Empty array if none.
- coaching_note: the single most important thing to do right now in this section.
- chat_response: only populated if the user asked a question, otherwise null.
- not_applicable_suggestion: follow the N/A rules in the system prompt above. Return null when the section IS applicable. Only include an object when suggested is true AND confidence > 70.`

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
          not_applicable_suggestion: null,
          error: 'AI unavailable',
        })
      }

      // Compute section completion for the panel header
      const totalFields = (section.fields || []).length
      const answeredFields = (section.fields || []).filter((f: any) => typeof f.answer === 'string' && f.answer.trim()).length

      // Normalize N/A suggestion — never allow it for always-relevant sections
      // regardless of what the model returns.
      const neverNaSections = new Set(['section_01', 'section_04', 'section_05', 'section_10', 'section_12'])
      let naSug: any = null
      if (
        result.not_applicable_suggestion &&
        typeof result.not_applicable_suggestion === 'object' &&
        result.not_applicable_suggestion.suggested === true &&
        typeof result.not_applicable_suggestion.confidence === 'number' &&
        result.not_applicable_suggestion.confidence > 70 &&
        !neverNaSections.has(section_id)
      ) {
        naSug = {
          suggested: true,
          reason: String(result.not_applicable_suggestion.reason || '').slice(0, 280),
          confidence: Math.min(100, Math.round(result.not_applicable_suggestion.confidence)),
        }
      }

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
        not_applicable_suggestion: naSug,
      })
    }

    // ─────────────────────────────────────────────────────────────
    // Action 3: autofill_field
    //
    // Given an engagement + section + field, infer a realistic answer for
    // that field from all the other answers already captured in the doc
    // plus the client's welcome statement. Returns the suggested text —
    // the caller is responsible for writing it via save_field so the
    // normal vault/audit pipeline runs on the write.
    // ─────────────────────────────────────────────────────────────
    if (action === 'autofill_field') {
      const { section_id, field_id } = body
      if (!section_id || !field_id) {
        return NextResponse.json({ error: 'Missing section_id or field_id' }, { status: 400 })
      }

      const section = sections.find((s) => s.id === section_id)
      const field = section?.fields?.find((f: any) => f.id === field_id)
      if (!section || !field) {
        return NextResponse.json({ error: 'Field not found' }, { status: 404 })
      }

      // Collect up to 20 of the most substantial other answers as context.
      const contextAnswers: string[] = []
      for (const sec of sections) {
        for (const f of (sec.fields || [])) {
          if (f.id === field_id) continue
          const ans = typeof f.answer === 'string' ? f.answer.trim() : ''
          if (ans.length > 3) {
            contextAnswers.push(`[${sec.id}] ${f.question}: ${ans}`)
          }
          if (contextAnswers.length >= 20) break
        }
        if (contextAnswers.length >= 20) break
      }

      const userPrompt = `Client: ${eng.client_name || 'Unknown'}
Industry: ${eng.client_industry || 'Unknown'}
Location: ${[clientCity, clientState].filter(Boolean).join(', ') || 'Unknown'}
Classification: ${classLine}

Business description (client's own words):
"${clientWelcome || 'Not provided'}"

Other answers already captured across the discovery doc:
${contextAnswers.length ? contextAnswers.join('\n') : '(none)'}

Field to fill (section ${section_id}):
"${field.question}"
${field.hint ? `Hint: ${field.hint}` : ''}

Write the best concrete answer for this field based on the context above. Return ONLY the field value — no quotes, no preamble, no explanation. If you cannot confidently infer an answer, return an empty string.`

      const apiKey = process.env.ANTHROPIC_API_KEY || ''
      if (!apiKey) {
        return NextResponse.json({
          field_id,
          section_id,
          suggested_answer: '',
          field_question: field.question,
          error: 'AI not configured',
        })
      }

      let suggestedAnswer = ''
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: FAST_MODEL,
            max_tokens: 300,
            temperature: 0.2,
            system: 'You are filling in a discovery document field based on all available context. Return only the field value — no explanation, no preamble, no quotes. Be specific and realistic. If you cannot infer a good answer, return an empty string.',
            messages: [{ role: 'user', content: userPrompt }],
          }),
          signal: AbortSignal.timeout(12000),
        })
        if (res.ok) {
          const d = await res.json()
          void logTokenUsage({
            feature: 'discovery_coach_autofill',
            model: FAST_MODEL,
            inputTokens: d.usage?.input_tokens || 0,
            outputTokens: d.usage?.output_tokens || 0,
          })
          const text = (d.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('').trim()
          // Strip wrapping quotes if the model ignored instructions
          suggestedAnswer = text.replace(/^["'`]+|["'`]+$/g, '').trim()
        }
      } catch { /* fall through with empty answer */ }

      return NextResponse.json({
        field_id,
        section_id,
        suggested_answer: suggestedAnswer,
        field_question: field.question,
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
