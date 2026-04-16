// ─────────────────────────────────────────────────────────────
// Upwork Checklist Engine
// Pre-flight checklist for freelance SEO consultants pitching on Upwork.
// Validates the proposal against what the job poster wants, generates a
// customized cover letter, flags red/green signals and win probability.
// ─────────────────────────────────────────────────────────────

import { logTokenUsage } from '@/lib/tokenTracker'

type AI = any

function stripJsonFences(text: string): string {
  let t = (text || '').trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  }
  // Grab the outermost JSON object if there's leading/trailing prose
  const firstBrace = t.indexOf('{')
  const lastBrace = t.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return t.slice(firstBrace, lastBrace + 1)
  }
  return t
}

function safeJsonParse<T = any>(text: string, fallback: T): T {
  try {
    return JSON.parse(stripJsonFences(text)) as T
  } catch {
    return fallback
  }
}

// ── analyzeUpworkJob ────────────────────────────────────────────────────────
export async function analyzeUpworkJob(
  ai: AI,
  body: {
    job_description: string
    client_name?: string
    job_budget?: string | number
    job_type?: 'fixed' | 'hourly'
    agency_id?: string
  }
) {
  const { job_description, client_name, job_budget, job_type, agency_id } = body
  if (!job_description || !job_description.trim()) {
    throw new Error('job_description required')
  }

  const jt = job_type || 'fixed'
  const budgetText = job_budget ? String(job_budget) : 'not specified'

  const prompt = `You are an elite freelance SEO consultant evaluating an Upwork job posting before deciding whether to bid. Analyze this posting with the eye of someone who has seen thousands of Upwork jobs — you can smell a bad client from the first sentence.

JOB POSTING
-----------
${client_name ? `CLIENT: ${client_name}` : ''}
JOB TYPE: ${jt}
BUDGET: ${budgetText}

DESCRIPTION:
${job_description}

Return ONLY valid JSON (no prose, no code fences) with this exact shape:

{
  "analysis": {
    "must_haves": ["required skill/deliverable", ...],           // skills/deliverables EXPLICITLY required
    "nice_to_haves": ["preferred skill", ...],                    // preferred but not required
    "red_flags": [{ "flag": "short label", "why": "1-sentence explanation" }, ...],
    "green_flags": [{ "flag": "short label", "why": "1-sentence explanation" }, ...],
    "hidden_requirements": ["skill implied but not stated", ...], // things the client will expect even though they didn't ask
    "actual_need": "1-2 sentences — what the client really wants vs what they literally asked for",
    "difficulty_score": 0-100,                                    // 0 = cakewalk, 100 = nightmare
    "win_probability": 0-100                                      // realistic probability of winning the bid if pitched well
  },
  "cover_letter": "a ready-to-send cover letter, 150-250 words, that directly addresses every must-have, opens with a hook tailored to the posting, and ends with a clear next step. Do NOT use generic filler. Write in first person.",
  "clarifying_questions": [
    "Specific clarifying question #1",
    "... 3-5 total, all specific to this posting (not generic)"
  ],
  "project_estimate": {
    "hours": <realistic total hours as a number>,
    "fixed_price": <realistic fixed quote in USD as a number>
  },
  "pricing_strategy": "1-2 sentences — how to price this and why, given the signals in the posting"
}

RULES
- Red flags: too-low budget, unrealistic scope, vague requirements, suspicious urgency, revision abuse, "simple task" that actually isn't, "rockstar / ninja / guru" language, contradicting requirements, bait-and-switch scope, unpaid test work, refusal to pay for tools, scope creep language ("and other small tasks").
- Green flags: specific KPIs, named tools, clear deliverables, realistic budget for scope, professional tone, portfolio/brand disclosed, reasonable timeline.
- hidden_requirements examples: "they say SEO audit but will expect on-page implementation", "they didn't mention reporting but will demand a dashboard".
- actual_need: the real business outcome, not the task as described.
- win_probability: be realistic. If the job is overcrowded, poorly written, or underpaid, lower it.
- clarifying_questions must be specific. No "what is your timeline" generic questions — reference details from the posting.
- For ${jt} jobs: ${jt === 'hourly' ? 'suggest an hourly-equivalent in pricing_strategy' : 'give a fixed quote'} and scope hours realistically.`

  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  void logTokenUsage({
    feature: 'kotoiq_upwork_analyze',
    model: 'claude-sonnet-4-20250514',
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
    agencyId: agency_id,
  })

  const raw = msg.content?.[0]?.type === 'text' ? msg.content[0].text : ''

  const parsed = safeJsonParse<any>(raw, {
    analysis: {
      must_haves: [],
      nice_to_haves: [],
      red_flags: [],
      green_flags: [],
      hidden_requirements: [],
      actual_need: '',
      difficulty_score: 50,
      win_probability: 50,
    },
    cover_letter: '',
    clarifying_questions: [],
    project_estimate: { hours: 0, fixed_price: 0 },
    pricing_strategy: '',
  })

  // Ensure shape is complete even if the model skipped fields
  parsed.analysis = parsed.analysis || {}
  parsed.analysis.must_haves = Array.isArray(parsed.analysis.must_haves) ? parsed.analysis.must_haves : []
  parsed.analysis.nice_to_haves = Array.isArray(parsed.analysis.nice_to_haves) ? parsed.analysis.nice_to_haves : []
  parsed.analysis.red_flags = Array.isArray(parsed.analysis.red_flags) ? parsed.analysis.red_flags : []
  parsed.analysis.green_flags = Array.isArray(parsed.analysis.green_flags) ? parsed.analysis.green_flags : []
  parsed.analysis.hidden_requirements = Array.isArray(parsed.analysis.hidden_requirements) ? parsed.analysis.hidden_requirements : []
  parsed.analysis.actual_need = parsed.analysis.actual_need || ''
  parsed.analysis.difficulty_score = Number(parsed.analysis.difficulty_score ?? 50)
  parsed.analysis.win_probability = Number(parsed.analysis.win_probability ?? 50)
  parsed.cover_letter = parsed.cover_letter || ''
  parsed.clarifying_questions = Array.isArray(parsed.clarifying_questions) ? parsed.clarifying_questions : []
  parsed.project_estimate = parsed.project_estimate || { hours: 0, fixed_price: 0 }
  parsed.project_estimate.hours = Number(parsed.project_estimate.hours ?? 0)
  parsed.project_estimate.fixed_price = Number(parsed.project_estimate.fixed_price ?? 0)
  parsed.pricing_strategy = parsed.pricing_strategy || ''
  parsed.job_type = jt
  parsed.job_budget = budgetText

  return parsed
}

// ── generateProposalPackage ─────────────────────────────────────────────────
export async function generateProposalPackage(
  ai: AI,
  body: {
    job_description: string
    our_portfolio_highlights?: string[]
    our_hourly_rate?: number
    agency_id?: string
  }
) {
  const { job_description, our_portfolio_highlights, our_hourly_rate, agency_id } = body
  if (!job_description || !job_description.trim()) {
    throw new Error('job_description required')
  }

  const highlights = (our_portfolio_highlights || []).filter(Boolean).slice(0, 6)
  const rateText = our_hourly_rate ? `$${our_hourly_rate}/hr` : 'not specified — suggest a range'

  const prompt = `You are a senior SEO consultant writing a proposal package for an Upwork client. Produce a complete, polished deliverable that a client would actually pay for the pitch alone.

JOB DESCRIPTION
---------------
${job_description}

CONSULTANT CONTEXT
------------------
HOURLY RATE: ${rateText}
PORTFOLIO HIGHLIGHTS:
${highlights.length ? highlights.map(h => `- ${h}`).join('\n') : '(none provided — write highlights as generic but credible)'}

Return ONLY valid JSON (no prose, no code fences) with this exact shape:

{
  "cover_letter": "ready-to-send cover letter, 180-300 words, hook → relevance → proof → next step",
  "scope_document": {
    "project_title": "...",
    "executive_summary": "1 paragraph",
    "phases": [
      { "name": "Phase 1: ...", "duration": "X days/weeks", "deliverables": ["...", "..."] },
      ...
    ],
    "timeline_weeks": <number>,
    "total_hours": <number>,
    "investment": { "type": "fixed|hourly", "amount": <number>, "currency": "USD" },
    "what_is_included": ["...", "..."],
    "what_is_not_included": ["...", "..."],
    "success_metrics": ["specific KPI #1", "specific KPI #2", "..."]
  },
  "faq": [
    { "q": "How long will it take?", "a": "..." },
    { "q": "What do you need from me?", "a": "..." },
    { "q": "What tools do you use?", "a": "..." },
    { "q": "What happens if results aren't hitting?", "a": "..." },
    { "q": "How do revisions work?", "a": "..." },
    { "q": "Do you do ongoing retainer after this project?", "a": "..." }
  ],
  "followup_email": "short follow-up email to send if no response in 72 hours, <120 words"
}

RULES
- Scope must be realistic. No 40-hour quotes for 400-hour projects.
- Phases are concrete — "Phase 1: Technical audit" not "Phase 1: Research".
- Success metrics are measurable.
- Cover letter references specifics from the job description.
- FAQ answers each ≤3 sentences.`

  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  void logTokenUsage({
    feature: 'kotoiq_upwork_package',
    model: 'claude-sonnet-4-20250514',
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
    agencyId: agency_id,
  })

  const raw = msg.content?.[0]?.type === 'text' ? msg.content[0].text : ''

  const parsed = safeJsonParse<any>(raw, {
    cover_letter: '',
    scope_document: {
      project_title: '',
      executive_summary: '',
      phases: [],
      timeline_weeks: 0,
      total_hours: 0,
      investment: { type: 'fixed', amount: 0, currency: 'USD' },
      what_is_included: [],
      what_is_not_included: [],
      success_metrics: [],
    },
    faq: [],
    followup_email: '',
  })

  parsed.cover_letter = parsed.cover_letter || ''
  parsed.scope_document = parsed.scope_document || {}
  parsed.scope_document.phases = Array.isArray(parsed.scope_document.phases) ? parsed.scope_document.phases : []
  parsed.scope_document.what_is_included = Array.isArray(parsed.scope_document.what_is_included) ? parsed.scope_document.what_is_included : []
  parsed.scope_document.what_is_not_included = Array.isArray(parsed.scope_document.what_is_not_included) ? parsed.scope_document.what_is_not_included : []
  parsed.scope_document.success_metrics = Array.isArray(parsed.scope_document.success_metrics) ? parsed.scope_document.success_metrics : []
  parsed.scope_document.investment = parsed.scope_document.investment || { type: 'fixed', amount: 0, currency: 'USD' }
  parsed.faq = Array.isArray(parsed.faq) ? parsed.faq : []
  parsed.followup_email = parsed.followup_email || ''

  return parsed
}
