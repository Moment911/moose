// ── Dynamic Voice Prompt Builder ─────────────────────────────────────────────
// Builds system prompts and dynamic variables for Retell AI voice agents
// using pre-call intelligence + agency/agent configuration.

import type { PreCallIntel } from './preCallIntelligence'
import { createClient } from '@supabase/supabase-js'

// ── Discovery brief lookup ───────────────────────────────────────────────────
// Server-side helper that fetches a discovery intelligence brief for a
// matching engagement so it can be injected into Retell prompts/dynamic vars
// at call start time. Returns null silently on any error so it never blocks
// a call.
export async function fetchDiscoveryBrief(
  agencyId: string,
  businessName: string,
): Promise<{ brief: string; engagement_id: string } | null> {
  if (!agencyId || !businessName?.trim()) return null
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )

    const { data: matches } = await sb
      .from('koto_discovery_engagements')
      .select('id, client_id, client_name, client_industry, intel_cards, sections, readiness_score, readiness_label')
      .eq('agency_id', agencyId)
      .ilike('client_name', `%${businessName.trim()}%`)
      .in('status', ['research_complete', 'call_scheduled', 'call_complete', 'compiled', 'shared'])
      .order('updated_at', { ascending: false })
      .limit(1)

    const eng: any = Array.isArray(matches) && matches.length > 0 ? matches[0] : null
    if (!eng) return null

    // Pull the linked client's welcome_statement so the voice agent opens
    // every call already knowing how the client describes themselves.
    let welcomeStatement = ''
    if (eng.client_id) {
      try {
        const { data: clientRecord } = await sb
          .from('clients')
          .select('welcome_statement')
          .eq('id', eng.client_id)
          .maybeSingle()
        if (clientRecord?.welcome_statement) {
          welcomeStatement = String(clientRecord.welcome_statement).trim()
        }
      } catch { /* best-effort */ }
    }

    // Confirmed tech stack
    let techStack = 'unknown'
    try {
      const { data: domains } = await sb
        .from('koto_discovery_domains')
        .select('tech_stack')
        .eq('engagement_id', eng.id)
      const confirmed: string[] = []
      for (const d of domains || []) {
        for (const cat of d.tech_stack?.categories || []) {
          for (const t of cat.tools || []) {
            if (t.confidence === 'confirmed') confirmed.push(t.name)
          }
        }
      }
      const uniq = [...new Set(confirmed)].slice(0, 12)
      if (uniq.length) techStack = uniq.join(', ')
    } catch { /* non-fatal */ }

    function findField(sectionId: string, fieldId: string): string {
      const sec = (eng.sections || []).find((s: any) => s.id === sectionId)
      return sec?.fields?.find((f: any) => f.id === fieldId)?.answer || ''
    }

    const intel = Array.isArray(eng.intel_cards) ? eng.intel_cards : []
    const bgCard = intel.find((c: any) => /background/i.test(c.title))?.body || ''
    const revCard = intel.find((c: any) => /revenue/i.test(c.title))?.body || ''
    const observations = intel
      .filter((c: any) => /observ/i.test(c.title))
      .map((c: any) => `- ${c.body}`)
      .join('\n')

    const goals = findField('section_10', '10a')
    const budget = findField('section_10', '10f')
    const pain = findField('section_10', '10b')

    const readinessLine = eng.readiness_score != null
      ? `${eng.readiness_label || 'Unknown'} (${eng.readiness_score}/100)`
      : 'not calculated'

    const brief = [
      '=== DISCOVERY INTELLIGENCE FOR THIS PROSPECT ===',
      `Business: ${eng.client_name} | Industry: ${eng.client_industry || 'unknown'} | Readiness: ${readinessLine}`,
      '',
      welcomeStatement ? `CLIENT BACKGROUND (their own words): "${welcomeStatement}"` : '',
      bgCard ? `BACKGROUND: ${bgCard}` : 'BACKGROUND: (not available)',
      revCard ? `REVENUE: ${revCard}` : 'REVENUE: (not captured)',
      `KNOWN TECH STACK: ${techStack}`,
      goals ? `THEIR GOALS: ${goals}` : 'THEIR GOALS: (not captured)',
      budget ? `THEIR BUDGET: ${budget}` : 'THEIR BUDGET: (not captured)',
      pain ? `THEIR PAIN: ${pain}` : 'THEIR PAIN: (not captured)',
      observations ? `KEY OBSERVATIONS:\n${observations}` : '',
      '==============================================',
    ].filter(Boolean).join('\n')

    return { brief, engagement_id: eng.id }
  } catch {
    return null
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentConfig {
  name: string
  personality?: string
  goal?: string
  business_context?: string | { business_name?: string; description?: string }
  value_proposition?: string
  script_intro?: string
  script_questions?: (string | { question: string })[]
  script_objections?: (string | { objection: string; response: string })[]
  script_closing?: string
  tcpa_script?: string
}

interface CloserConfig {
  closer_name?: string
  closer_title?: string
  closer_company_name?: string
  closer_years_experience?: string
  closer_expertise_tags?: string[]
  closer_results_proof?: string
  closer_bio?: string
  closer_calendar_url?: string
}

// ── Outbound system prompt ───────────────────────────────────────────────────

export function buildOutboundSystemPrompt(
  agent: AgentConfig,
  closer: CloserConfig,
  intel: PreCallIntel | null,
): string {
  const c = closer || {} as CloserConfig
  const closerName = c.closer_name || 'our senior strategist'
  const companyName = c.closer_company_name || (typeof agent.business_context === 'object' ? agent.business_context?.business_name : '') || 'a marketing agency'

  let prompt = `You are ${agent.name}, an AI voice agent for ${companyName}.

PERSONALITY: ${agent.personality || 'Professional, confident, consultative'}
GOAL: ${agent.goal || 'Qualify the prospect and book a 15-minute consultation with the closer'}

YOUR CLOSER:
Name: ${closerName}
Title: ${c.closer_title || 'Senior Marketing Strategist'}
Experience: ${c.closer_years_experience || '10+'} years
Expertise: ${(c.closer_expertise_tags || ['marketing', 'lead generation', 'SEO']).join(', ')}
Results: ${c.closer_results_proof || 'helped hundreds of local businesses grow'}
`

  // Inject pre-call intelligence
  if (intel) {
    prompt += '\n── PRE-CALL INTELLIGENCE ──\n'

    if (intel.lead) {
      const l = intel.lead
      prompt += `PROSPECT: ${l.prospect_name || 'Unknown'}`
      if (l.prospect_company) prompt += ` at ${l.prospect_company}`
      if (l.industry) prompt += ` (${l.industry})`
      prompt += '\n'
      if (l.prospect_pain_point) prompt += `KNOWN PAIN POINT: ${l.prospect_pain_point}\n`
      if (l.prospect_objection) prompt += `EXPECTED OBJECTION: ${l.prospect_objection}\n`
      if (l.lead_score) prompt += `LEAD SCORE: ${l.lead_score}/100\n`
    }

    if (intel.callerHistory.totalCalls > 0) {
      prompt += `CALL HISTORY: ${intel.callerHistory.totalCalls} previous calls. Last outcome: ${intel.callerHistory.lastOutcome || 'unknown'}.\n`
      if (intel.callerHistory.lastOutcome === 'no_answer') {
        prompt += `NOTE: Last call was unanswered — acknowledge you tried reaching them before.\n`
      }
      if (intel.callerHistory.totalCalls >= 3) {
        prompt += `NOTE: This is call #${intel.callerHistory.totalCalls + 1}. Be mindful of call fatigue — get to value quickly.\n`
      }
    }

    if (intel.businessInfo) {
      const b = intel.businessInfo
      prompt += `BUSINESS RESEARCH: ${b.name}`
      if (b.rating) prompt += ` — ${b.rating}/5 stars (${b.reviewCount || 0} reviews)`
      if (b.website) prompt += ` — ${b.website}`
      prompt += '\n'
      if (b.rating && b.rating < 4.0) {
        prompt += `ANGLE: Their online rating is ${b.rating}/5 — reviews & reputation management could be a strong entry point.\n`
      }
      if (b.reviewCount && b.reviewCount < 20) {
        prompt += `ANGLE: Only ${b.reviewCount} reviews — building review volume is a quick win you can offer.\n`
      }
    }

    if (intel.aiBriefing) {
      prompt += `\nAI BRIEFING:\n${intel.aiBriefing}\n`
    }
  }

  // Script
  prompt += `
── CALL SCRIPT ──
Opening: ${agent.script_intro || 'Hi, this is ' + agent.name + ". I'm reaching out because..."}

Discovery Questions:
${(agent.script_questions || []).map((q, i) => `${i + 1}. ${typeof q === 'string' ? q : q.question}`).join('\n')}

Value Proposition:
${agent.value_proposition || 'We help businesses like yours get more customers through proven marketing strategies.'}

OBJECTION HANDLING:
${(agent.script_objections || []).map(o => {
    if (typeof o === 'string') return `"${o}": [handle naturally]`
    return `"${o.objection}": ${o.response}`
  }).join('\n\n')}

CLOSING: ${agent.script_closing || "I'd love to get you on the calendar with " + closerName + ". What day works better this week — Tuesday or Thursday?"}

VOICEMAIL (if no answer — under 25 seconds):
"Hey {contact_name}, this is ${agent.name} — I was reaching out because we've been working with a few businesses in your area and getting some really strong results. Give me a call back or I'll try you again soon."

TCPA CONSENT:
${agent.tcpa_script || '"Before I wrap up — do you consent to us contacting you by phone for follow-up? Just say yes or no."'}

RULES:
- Be natural and conversational, not robotic
- Listen more than you talk
- If not interested after 2 attempts, thank them and end politely
- Keep under 4 minutes unless deeply engaged
- Use their name 2-3 times naturally
- Match their energy level
- Never badmouth competitors
- Always end on a positive note`

  return prompt
}

// ── Inbound system prompt ────────────────────────────────────────────────────

export function buildInboundSystemPrompt(
  agent: AgentConfig,
  closer: CloserConfig,
  intel: PreCallIntel | null,
): string {
  const c = closer || {} as CloserConfig
  const closerName = c.closer_name || 'our team'
  const companyName = c.closer_company_name || (typeof agent.business_context === 'object' ? agent.business_context?.business_name : '') || 'our company'

  let prompt = `You are ${agent.name}, the AI receptionist for ${companyName}.

PERSONALITY: ${agent.personality || 'Warm, professional, helpful'}
GOAL: Answer the caller's question, qualify them, and book a meeting with ${closerName} if appropriate.
`

  if (intel) {
    prompt += '\n── CALLER INTELLIGENCE ──\n'

    if (intel.client) {
      const cl = intel.client
      prompt += `EXISTING CLIENT: ${cl.business_name || cl.name || 'Known client'}`
      if (cl.status) prompt += ` (Status: ${cl.status})`
      prompt += '\n'
      prompt += `PRIORITY: This is an existing client — greet them by name and prioritize their needs.\n`
    } else if (intel.lead) {
      const l = intel.lead
      prompt += `KNOWN LEAD: ${l.prospect_name || 'Known prospect'}`
      if (l.prospect_company) prompt += ` from ${l.prospect_company}`
      prompt += '\n'
    }

    if (intel.callerHistory.totalCalls > 0) {
      prompt += `PREVIOUS CONTACT: ${intel.callerHistory.totalCalls} prior calls. Last: ${intel.callerHistory.lastCallDate || 'unknown'}.\n`
    }

    if (intel.businessInfo) {
      const b = intel.businessInfo
      prompt += `CALLER'S BUSINESS: ${b.name}`
      if (b.rating) prompt += ` (${b.rating}★, ${b.reviewCount || 0} reviews)`
      prompt += '\n'
    }

    if (intel.aiBriefing) {
      prompt += `\nBRIEFING:\n${intel.aiBriefing}\n`
    }
  }

  prompt += `
── INBOUND CALL FLOW ──

1. GREETING: "Thank you for calling ${companyName}, this is ${agent.name}. How can I help you today?"

2. IDENTIFY: Get their name and what they're calling about.

3. QUALIFY: Based on their inquiry:
   - Existing client with issue → empathize, gather details, route to support or schedule callback
   - New prospect → discover their needs, build interest, offer a meeting with ${closerName}
   - General inquiry → answer helpfully, capture contact info

4. BOOK: If qualified, offer to schedule a call with ${closerName}.
   "I'd love to get you connected with ${closerName} who specializes in exactly what you're describing. Do you have 15 minutes this week?"

5. CAPTURE: Always get name, phone, email, and company before ending.

RULES:
- Never leave the caller on hold or transfer to a dead end
- If you can't answer something, say "Let me have ${closerName} follow up on that specifically"
- Be warm and unhurried — inbound callers chose to call, treat them as warm leads
- If they mention urgency, prioritize accordingly
- Capture consent: "Is it okay if we follow up with you by phone or email?"
- Thank them for calling before ending`

  return prompt
}

// ── Retell dynamic variables ─────────────────────────────────────────────────
// These get injected into Retell's {{variable}} template system during the call.

export function buildRetellDynamicVars(
  intel: PreCallIntel | null,
  lead?: Record<string, any> | null,
): Record<string, string> {
  const vars: Record<string, string> = {}

  const src = intel?.lead || lead || {}

  vars.contact_name = src.prospect_name || src.name || 'there'
  vars.company_name = src.prospect_company || src.business_name || ''
  vars.industry = src.industry || ''
  vars.city = src.city || ''
  vars.pain_point = src.prospect_pain_point || ''
  vars.lead_score = String(src.lead_score || 0)

  if (intel?.callerHistory) {
    vars.previous_calls = String(intel.callerHistory.totalCalls)
    vars.last_outcome = intel.callerHistory.lastOutcome || 'none'
  }

  if (intel?.businessInfo) {
    vars.business_rating = String(intel.businessInfo.rating || '')
    vars.business_reviews = String(intel.businessInfo.reviewCount || '')
    vars.business_website = intel.businessInfo.website || ''
  }

  if (intel?.aiBriefing) {
    // Truncate briefing for Retell variable limits
    vars.ai_briefing = intel.aiBriefing.substring(0, 500)
  }

  return vars
}
