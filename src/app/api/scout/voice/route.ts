// Scout voice — the intelligent outbound AI calling agent scoped to Scout.
// Ported from /api/vob/route.ts with sales-specific semantics:
//   patient_id       → opportunity_id + company_name
//   carrier_name     → industry + sic_code
//   level_of_care    → pitch_angle + biggest_gap
//   VOB_QUESTIONS    → SCOUT_DISCOVERY (opener, discovery, pain, budget, timeline, closer)
//   vob_data (jsonb) → discovery_data (jsonb)
//   revenue_forecast → deal_value_forecast (jsonb)
//
// 20 actions (mirroring VOB):
//   GET:  get_questions, get_calls, get_call, get_queue, get_agents, get_stats,
//         get_knowledge, get_active_calls, get_analytics
//   POST: queue_call, start_call, cancel_call, update_discovery_field,
//         save_agent, create_agent, provision_number, setup_scout_voice,
//         get_test_prospects, test_call
//
// Shares intelligence libraries with VOB: preCallIntelligence, conversationIntelligence,
// qaIntelligence. Those libs are stateless and agency-scoped, so no collisions.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { metaFromPhone } from '@/lib/scout/areaCodeMeta'
import { SCOUT_VOICE_ROSTER, CADENCE_PRESETS, getCadencePreset } from '@/lib/scout/voiceRoster'
import { tcpaGate } from '@/lib/scout/cellPhoneGate'
import { callWindowGate } from '@/lib/scout/callWindowGate'

const RETELL_API_KEY = process.env.RETELL_API_KEY || ''
const RETELL_BASE = 'https://api.retellai.com'
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// Normalize a phone number to E.164. Retell's parser treats bare 10-digit
// numbers as international and may guess the wrong country (e.g. 954… → MM).
// Always send +1XXXXXXXXXX for US or +<already prefixed>.
function toE164(raw?: string | null): string {
  if (!raw) return ''
  const s = String(raw).trim()
  if (s.startsWith('+')) return '+' + s.slice(1).replace(/\D/g, '')
  const digits = s.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits
  if (digits.length === 10) return '+1' + digits
  return digits ? '+' + digits : ''
}

// DM score from title (spec §7). Higher = more likely to be the decision maker.
function computeDmScore(title?: string | null): number {
  if (!title) return 50
  const t = title.toLowerCase()
  if (/\b(cmo|chief marketing)\b/.test(t)) return 98
  if (/\b(ceo|founder|owner|president)\b/.test(t)) return 95
  if (/\b(coo|cfo|chief)\b/.test(t)) return 90
  if (/\b(vp|vice president)\b/.test(t)) return 85
  if (/\b(director)\b/.test(t)) return 80
  if (/\b(head of|lead)\b/.test(t)) return 78
  if (/\b(manager|supervisor)\b/.test(t)) return 70
  if (/\b(coordinator|specialist|analyst)\b/.test(t)) return 55
  if (/\b(assistant|intern|associate)\b/.test(t)) return 40
  return 50
}

// Resolve the platform-default question bank for an industry slug.
// Returns null if the slug is missing or the industry has no seeded bank yet
// (e.g. web_dev / saas — only marketing_agency is seeded as of 2026-04-19).
async function resolveIndustryBankId(s: ReturnType<typeof sb>, slug?: string | null): Promise<string | null> {
  if (!slug) return null
  const { data } = await s.from('scout_question_banks')
    .select('id')
    .is('agency_id', null)
    .eq('seller_industry_slug', slug)
    .eq('source', `industry:${slug}`)
    .maybeSingle()
  return data?.id || null
}

async function retellFetch(path: string, method = 'GET', body?: any) {
  if (!RETELL_API_KEY) throw new Error('RETELL_API_KEY not configured')
  const res = await fetch(`${RETELL_BASE}${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Retell ${path} ${res.status}: ${text}`)
  }
  return res.json()
}

// ─────────────────────────────────────────────────────────────
// Retell tool definitions for Scout voice agent
// ─────────────────────────────────────────────────────────────
function buildScoutTools(webhookUrl: string) {
  return [
    {
      type: 'custom',
      name: 'save_discovery_answer',
      description: 'Save a discovery answer you learned from the prospect. Call this WHILE speaking your acknowledgment — do not wait for the response.',
      url: webhookUrl,
      speak_during_execution: true,
      parameters: { type: 'object', properties: {
        field: { type: 'string', description: 'Field name (e.g. pain_point, budget_range, timeline, decision_maker, current_solution)' },
        value: { type: 'string', description: 'The answer the prospect gave' },
        confidence: { type: 'number', description: '0-100' },
      }, required: ['field', 'value'] },
    },
    {
      type: 'custom',
      name: 'detect_buying_signal',
      description: 'Flag a strong buying signal (asking about price, timing, demo, pilot, or competitors unprompted).',
      url: webhookUrl,
      speak_during_execution: true,
      parameters: { type: 'object', properties: {
        signal_type: { type: 'string', description: 'price_inquiry | urgency | competitor_mention | demo_request | budget_confirm' },
        quote: { type: 'string', description: 'What they actually said' },
      }, required: ['signal_type'] },
    },
    {
      type: 'custom',
      name: 'set_appointment',
      description: 'Lock in a follow-up call or demo appointment when the prospect agrees to a specific time.',
      url: webhookUrl,
      speak_during_execution: true,
      parameters: { type: 'object', properties: {
        when_iso: { type: 'string', description: 'ISO timestamp of the scheduled meeting' },
        meeting_type: { type: 'string', description: 'demo | discovery | proposal_review' },
        notes: { type: 'string' },
      }, required: ['when_iso'] },
    },
    {
      type: 'custom',
      name: 'dnc_request',
      description: 'Mark this prospect as Do-Not-Contact if they explicitly request removal. Do this immediately, then wrap up politely.',
      url: webhookUrl,
      parameters: { type: 'object', properties: {
        reason: { type: 'string' },
      } },
    },
    {
      type: 'custom',
      name: 'transfer_to_human',
      description: 'Request a warm transfer when the prospect asks to speak to a real person or the situation exceeds your scope.',
      url: webhookUrl,
      parameters: { type: 'object', properties: {
        reason: { type: 'string' },
      }, required: ['reason'] },
    },
    {
      type: 'custom',
      name: 'classify_pickup',
      description: 'Report who answered the phone as soon as you can tell. Call this within the first 10 seconds. This drives conversation routing — do NOT skip it.',
      url: webhookUrl,
      speak_during_execution: true,
      parameters: { type: 'object', properties: {
        classification: { type: 'string', description: 'ivr | gatekeeper | dm_direct | wrong_person | voicemail | unknown' },
        confidence: { type: 'number', description: '0-100' },
        person_name: { type: 'string', description: 'Name if they gave one' },
        person_title: { type: 'string', description: 'Title if mentioned' },
        notes: { type: 'string', description: 'Any useful context (e.g. "receptionist, friendly", "IVR 2 layers deep")' },
      }, required: ['classification'] },
    },
    {
      type: 'end_call',
      name: 'end_call',
      description: 'Gracefully end the call once you have what you need or the prospect asks to end.',
    },
  ]
}

// ─────────────────────────────────────────────────────────────
// Scout Discovery Question Bank — industry-agnostic defaults.
// Per-industry questions live in scout_questions (learned over time).
// These are the opener / universal discovery / closer shape.
// ─────────────────────────────────────────────────────────────
const SCOUT_DISCOVERY = [
  // ── Opener ──
  { category: 'Opener', field: 'call_permission', question: 'Hi, this is {{agent_name}} from {{agency_name}} — do you have a minute?', type: 'permission', priority: 1, order: 1 },
  { category: 'Opener', field: 'pitch_hook', question: 'I noticed {{biggest_gap_framing}} — is that something you have seen yourself?', type: 'text', priority: 1, order: 2 },

  // ── Current state ──
  { category: 'Current State', field: 'current_solution', question: 'What are you using today for {{topic_from_pitch}}?', type: 'text', priority: 1, order: 10 },
  { category: 'Current State', field: 'team_size', question: 'How big is the team handling this right now?', type: 'text', priority: 2, order: 11 },
  { category: 'Current State', field: 'years_in_business', question: 'How long has the business been running?', type: 'text', priority: 3, order: 12 },

  // ── Pain ──
  { category: 'Pain', field: 'biggest_frustration', question: 'What is the biggest frustration with how that is working today?', type: 'text', priority: 1, order: 20 },
  { category: 'Pain', field: 'impact_cost', question: 'What is that costing you — in hours, dollars, or missed opportunity?', type: 'text', priority: 1, order: 21 },
  { category: 'Pain', field: 'tried_before', question: 'Have you tried to fix this before? What happened?', type: 'text', priority: 2, order: 22 },

  // ── Decision ──
  { category: 'Decision', field: 'decision_maker', question: 'Who else would be involved in a decision like this?', type: 'text', priority: 1, order: 30 },
  { category: 'Decision', field: 'decision_process', question: 'What does your decision process usually look like?', type: 'text', priority: 2, order: 31 },

  // ── Budget ──
  { category: 'Budget', field: 'budget_allocated', question: 'Do you have budget allocated for solving this, or would we need to make a case for it?', type: 'text', priority: 1, order: 40 },
  { category: 'Budget', field: 'budget_range', question: 'Ballpark, what are you thinking for something like this?', type: 'currency', priority: 2, order: 41 },

  // ── Timeline ──
  { category: 'Timeline', field: 'urgency', question: 'How urgent is this for you?', type: 'text', priority: 1, order: 50 },
  { category: 'Timeline', field: 'target_start', question: 'When would you want to have something in place?', type: 'text', priority: 1, order: 51 },

  // ── Competition ──
  { category: 'Competition', field: 'other_vendors_evaluated', question: 'Are you looking at anyone else right now?', type: 'text', priority: 2, order: 60 },
  { category: 'Competition', field: 'last_vendor_why', question: 'What would make you pick us over someone else?', type: 'text', priority: 3, order: 61 },

  // ── Closer ──
  { category: 'Closer', field: 'demo_interest', question: 'Would it make sense to set up a 15-minute demo where I show you exactly how this would work for {{company_name}}?', type: 'boolean', priority: 1, order: 70 },
  { category: 'Closer', field: 'follow_up_time', question: 'When is a good time this week or next?', type: 'text', priority: 1, order: 71 },
  { category: 'Closer', field: 'email_confirmation', question: 'Best email to send the calendar invite to?', type: 'text', priority: 1, order: 72 },
]

// ─────────────────────────────────────────────────────────────
// Build the Retell system prompt for a Scout call
// ─────────────────────────────────────────────────────────────
function buildScoutPrompt(opts: {
  agencyName: string
  agentName: string
  companyName: string
  contactName?: string
  industry?: string
  pitchAngle?: string
  biggestGap?: string
  priorContext?: string
  industryKnowledge?: string[]
  personality?: string
  geo?: { state?: string; state_code?: string; region?: string; major_city?: string; style_notes?: string } | null
  bankQuestions?: Array<{ stage: string; question_text: string; services_qualified?: string[] }>
  aiDisclosure?: { required: boolean; language?: string | null } | null
  nameVerified?: boolean
  voicemail?: { pattern: string; customScript?: string | null; tone?: string; maxSeconds?: number } | null
}): string {
  const {
    agencyName, agentName, companyName, contactName, industry,
    pitchAngle, biggestGap, priorContext, industryKnowledge, personality, geo, bankQuestions,
    aiDisclosure, nameVerified, voicemail,
  } = opts

  // Render the discovery question bank by stage
  let bankBlock = ''
  if (bankQuestions && bankQuestions.length > 0) {
    const byStage: Record<string, string[]> = {}
    for (const q of bankQuestions) {
      const k = String(q.stage || 'other').toLowerCase()
      if (!byStage[k]) byStage[k] = []
      byStage[k].push(q.question_text)
    }
    const STAGE_ORDER = ['opener', 'current_state', 'pain', 'decision', 'budget', 'timeline', 'competition', 'proof', 'closer']
    const sections: string[] = []
    for (const stage of STAGE_ORDER) {
      const qs = byStage[stage]
      if (!qs || qs.length === 0) continue
      const label = stage.replace(/_/g, ' ').toUpperCase()
      sections.push(`### ${label}\n` + qs.map(q => `- ${q}`).join('\n'))
    }
    if (sections.length > 0) {
      bankBlock = `\n## DISCOVERY QUESTION BANK\nPick the best-fit question for each stage based on what the prospect has said. Questions are ranked — prefer the first in each stage unless it doesn't fit the conversation.\n\n` + sections.join('\n\n')
    }
  }

  const gapFraming = biggestGap
    ? `Our research surfaced that ${companyName} has a gap around: ${biggestGap}. Lead with this as your hook — it is your single most valuable opening.`
    : pitchAngle
      ? `Lead with this pitch angle: ${pitchAngle}`
      : `You are doing a cold discovery call. Focus on uncovering pain before pitching.`

  const knowledgeBlock = industryKnowledge && industryKnowledge.length
    ? `\n## WHAT WE KNOW ABOUT ${industry?.toUpperCase() || 'THIS INDUSTRY'}\n` +
      industryKnowledge.map(k => `- ${k}`).join('\n')
    : ''

  const geoBlock = geo?.state
    ? `\n## WHERE YOU ARE CALLING\nYou are calling a ${geo.state}${geo.major_city ? ` (${geo.major_city})` : ''} number — a ${geo.region || 'US'} prospect.${geo.style_notes ? `\nRegional note: ${geo.style_notes}` : ''}`
    : ''

  const priorBlock = priorContext ? `\n## PRIOR CONVERSATION CONTEXT\n${priorContext}` : ''

  return `# ROLE
You are ${agentName}, an outbound SDR calling on behalf of ${agencyName}.

# CALL TARGET
- Company: ${companyName}
${contactName ? `- Contact: ${contactName}` : '- Contact: speak to whoever answers and ask for a decision maker'}
${industry ? `- Industry: ${industry}` : ''}

# OBJECTIVE
Book a 15-minute follow-up demo. Secondary: qualify them and learn enough to write a tailored proposal.

# PITCH ANGLE
${gapFraming}
${knowledgeBlock}
${geoBlock}
${priorBlock}
${bankBlock}

# STYLE — MIRROR THE PROSPECT
${personality || `Conversational, warm, curious. Short sentences. Never sound like a script.`}

Actively mirror the prospect within your voice's natural range:
- If they speak fast, tighten your pace. If they speak slowly, slow down.
- If they use casual language, drop the formality. If they are formal, stay formal.
- Match their energy register — enthusiastic back to enthusiastic, measured back to measured.
- Pick up one or two of their specific words or phrases and reflect them back later (lightweight linguistic mirroring, not parroting).
- If they use industry jargon, use it correctly. If they avoid jargon, plain English only.
- Match sentence length — if they give you one-word answers, ask shorter questions.

Never over-mirror. Mirroring is a tilt, not an impression.

# HARD RULES
${aiDisclosure?.required ? `- **AI DISCLOSURE (LEGALLY REQUIRED):** ${aiDisclosure.language || `Within the first 15 seconds of the call, you MUST disclose that you are an AI assistant calling on behalf of ${agencyName}. Say something natural like: "Just so you know, I'm an AI assistant calling on behalf of ${agencyName}."`} You must not skip or delay this disclosure. If the prospect asks whether you are a real person or AI at any point, always confirm truthfully that you are an AI.` : `- If the prospect asks whether you are a real person or AI, always answer truthfully: you are an AI assistant calling on behalf of ${agencyName}.`}
- If they ask to be removed from the list, call the dnc_request tool immediately then politely wrap.
- If they ask to be transferred to a human, call transfer_to_human.
- Never make up facts about ${companyName} — stick to what is in the pitch angle.
- Never lie about meetings, referrals, or prior conversations. Period.
- Talk-listen ratio target: 40% you, 60% them. Ask more than you tell.
- Discovery mode (questions, pitch, demo close) can ONLY activate once you confirm you are speaking to a decision maker. Until then, navigate.

# STEP 1 — PICKUP CLASSIFICATION (do this FIRST)
As soon as someone answers, classify who you are talking to using these signals:

| Signal | Classification |
|---|---|
| Synthesized voice, "press 1 for...", "thank you for calling" | ivr |
| "{{Company}}, how can I help you?" | gatekeeper |
| "Hello?" / "This is {{name}}" | dm_direct or wrong_person — probe |
| Shop floor noise + "yeah?" | dm_direct (owner-operator) |
| "You've reached the voicemail of..." | voicemail |
| Silence | Assume human — greet warmly |

Call classify_pickup immediately with your best guess. If confidence < 60% between gatekeeper and DM, probe: "Quick one — are you the person who handles the marketing over there, or is that someone else?"

# STEP 2 — ROUTE BY CLASSIFICATION

## If IVR:
Navigate the menu using this priority:
1. Department match (e.g. "For marketing, press 3")
2. Sales / new customer
3. Operator / receptionist / press 0
4. Dial-by-name directory (only if you know ${contactName || 'the DM name'})
5. "Speak with someone"
AVOID: billing, support/existing customer, hours/location (dead ends).
If two menu layers pass without reaching a human, end_call — brute-forcing IVRs trains spam filters.
When a human picks up after IVR: "Hey, thanks — I got routed through the menu. I'm trying to reach whoever handles the marketing at ${companyName}. Am I in the right place?"

## If GATEKEEPER:
${contactName && nameVerified ? `Try: "Hey, is ${contactName} around?" — no explanation, no pitch. If asked who's calling, give your name and ${agencyName}, not the reason.` : `Try: "Hey — my team was looking at ${companyName}'s online presence and found something worth flagging. Who handles the marketing over there?"${contactName && !nameVerified ? ` (You have a name "${contactName}" but it is NOT verified — do not name-drop unverified names with gatekeepers.)` : ''}`}
If blocked:
- "What's this regarding?" → "It's about their marketing — we found something worth a 30-second look. Is the right person free, or should I try back?"
- "Send an email" → "Happy to — but this is time-sensitive. Any way to get them for 60 seconds?"
- "Not available" → "No worries — best time to try back? And is there a direct line or extension?"
- "Not interested" → "Totally get it — I haven't even said what it is yet. Worth 60 seconds with the right person?" (ONE soft push, then back off)
Before hanging up, ALWAYS try to learn: DM name, title, direct line/extension, best callback time. Gatekeepers usually answer logistics questions.

## If WRONG PERSON:
"Totally fine — appreciate you. Who should I be asking for? I'm looking for whoever handles the marketing."
Get: name → are they in? → best time? → direct line? → last name?
Do NOT pitch the wrong person. Exit cleanly.

## If VOICEMAIL:
${voicemail?.customScript ? `Use this voicemail script:\n${voicemail.customScript}` : `Use ${(voicemail?.pattern || 'pattern_1') === 'pattern_1' ? 'PATTERN 1 — Authority Hook' : (voicemail?.pattern || 'pattern_1') === 'pattern_2' ? 'PATTERN 2 — Specific Pain' : 'PATTERN 3 — Breakup / Closing the Loop'}:

**Pattern 1 — Authority Hook:** "Hi, this is ${agentName} from ${agencyName}. My team was looking at ${companyName} and found something about your online presence that's probably costing you leads. I'd love to flag it for whoever handles the marketing — can you have them give me a ring at {{callback_number}}?"

**Pattern 2 — Specific Pain:** "Hi, this is ${agentName} from ${agencyName}. ${biggestGap ? `We noticed ${biggestGap} — ` : 'We spotted something specific about your marketing — '}and I think it's worth a quick look. Give me a call back at {{callback_number}} and I'll walk you through what we found."

**Pattern 3 — Breakup:** "Hi, this is ${agentName} from ${agencyName} — I've tried to reach you a couple of times. I found something about ${companyName}'s marketing worth seeing, but I don't want to keep calling if the timing's wrong. If you're curious, my number is {{callback_number}}. If not, no hard feelings — wishing you the best."`}

Tone: ${voicemail?.tone || 'conversational'}. Max ${voicemail?.maxSeconds || 30} seconds. End with callback number.
${nameVerified && contactName ? `You may address ${contactName} by name — their identity has been verified.` : `**NAME-SAFETY RULE:** Do NOT use the prospect's name in the voicemail. Their name has not been manually verified. Use generic addressing only. This is a legal requirement.`}

## If DM REACHED:
Proceed to discovery (Step 3). Call classify_pickup with dm_direct.

# STEP 3 — DISCOVERY (only after DM confirmed)
${aiDisclosure?.required ? `1. Deliver AI disclosure immediately (see HARD RULES).` : ``}
1. Open with call_permission — gauge tolerance in one sentence.
2. Deliver your pitch_hook — frame as observation, not sales claim.
3. Current State questions — what they use today, team size.
4. Pain questions — biggest frustration, cost of problem.
5. Qualify: decision maker, process, budget, timeline.
6. detect_buying_signal whenever they ask price/timing/demo unprompted.
7. Close: demo_interest → follow_up_time → email_confirmation.
8. If they book, call set_appointment with ISO timestamp.
9. end_call gracefully.

# TOOL USE
- Call classify_pickup within the first 10 seconds. Do not skip this.
- Save answers as you hear them via save_discovery_answer — keep talking, do not pause.
- Flag buying signals the moment you hear them.
- Only end_call when you have a clear outcome: booked, not interested, DNC, or gatekeeper blocked.`
}

// ═══════════════════════════════════════════════════════════════════
// GET
// ═══════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const agencyId = searchParams.get('agency_id') || ''
  const s = sb()

  if (action === 'get_voice_roster') {
    // Try the live Retell catalog first, fall back to the static curated
    // roster if the API is unreachable or the token is missing. The live
    // list is authoritative — our static list can go stale when Retell
    // adds/removes voices from the 11labs integration.
    try {
      if (RETELL_API_KEY) {
        const resp = await fetch(`${RETELL_BASE}/list-voices`, {
          headers: { 'Authorization': `Bearer ${RETELL_API_KEY}` },
        })
        if (resp.ok) {
          const live: any[] = await resp.json()
          if (Array.isArray(live) && live.length > 0) {
            const enriched = live.map((v: any) => {
              const id = v.voice_id || v.id
              const fromStatic = SCOUT_VOICE_ROSTER.find(sv => sv.id === id)
              return {
                id,
                name: v.voice_name || v.name || fromStatic?.name || id,
                gender: (v.gender || fromStatic?.gender || 'unknown').toLowerCase(),
                accent: v.accent || fromStatic?.accent || 'Unknown',
                style: fromStatic?.style || (v.age ? `${v.age}` : 'Professional'),
                provider: v.provider || v.voice_type || null,
                preview_audio_url: v.preview_audio_url || null,
                sample_note: fromStatic?.sample_note || null,
              }
            })
            return NextResponse.json({ data: enriched, source: 'retell_live' })
          }
        }
      }
    } catch {
      // fall through to static
    }
    return NextResponse.json({ data: SCOUT_VOICE_ROSTER, source: 'static_fallback' })
  }

  if (action === 'get_cadence_presets') {
    return NextResponse.json({ data: CADENCE_PRESETS })
  }

  if (action === 'get_area_code_meta') {
    const phone = searchParams.get('phone') || ''
    const meta = metaFromPhone(phone)
    return NextResponse.json({ data: meta })
  }

  if (action === 'list_seller_industries') {
    const { data } = await s.from('scout_seller_industries').select('*').order('sort_order', { ascending: true })
    return NextResponse.json({ data: data || [] })
  }

  if (action === 'list_question_banks') {
    const forAgent = searchParams.get('agent_id')
    const industry = searchParams.get('seller_industry_slug')
    let q = s.from('scout_question_banks').select('*').order('created_at', { ascending: false })
    const ors: string[] = ['agency_id.is.null']
    if (agencyId) ors.push(`agency_id.eq.${agencyId}`)
    q = q.or(ors.join(','))
    if (forAgent) q = q.or(`agent_id.eq.${forAgent},agent_id.is.null`)
    if (industry) q = q.eq('seller_industry_slug', industry)
    const { data } = await q
    return NextResponse.json({ data: data || [] })
  }

  if (action === 'get_question_bank') {
    const bankId = searchParams.get('id') || ''
    if (!bankId) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const [bankRes, qsRes] = await Promise.all([
      s.from('scout_question_banks').select('*, scout_seller_profiles(*)').eq('id', bankId).maybeSingle(),
      s.from('scout_questions').select('*').eq('bank_id', bankId).order('stage').order('priority').order('appointment_rate', { ascending: false }),
    ])
    return NextResponse.json({ bank: bankRes.data, questions: qsRes.data || [] })
  }

  if (action === 'get_questions') {
    // Built-in defaults PLUS learned agency-specific questions
    const { data: learned } = await s.from('scout_questions')
      .select('*')
      .or(`agency_id.is.null,agency_id.eq.${agencyId || '00000000-0000-0000-0000-000000000000'}`)
      .order('appointment_rate', { ascending: false })
      .order('times_asked', { ascending: false })
      .limit(200)
    return NextResponse.json({ defaults: SCOUT_DISCOVERY, learned: learned || [] })
  }

  if (action === 'get_calls') {
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    let q = s.from('scout_voice_calls').select('*').eq('agency_id', agencyId)
      .order('created_at', { ascending: false }).limit(limit)
    if (status) q = q.eq('status', status)
    const { data } = await q
    return NextResponse.json({ data: data || [] })
  }

  if (action === 'get_call') {
    const callId = searchParams.get('id') || ''
    const { data } = await s.from('scout_voice_calls').select('*').eq('id', callId).single()
    const { data: questions } = await s.from('scout_call_questions').select('*')
      .eq('scout_call_id', callId).order('sequence', { ascending: true })
    return NextResponse.json({ data, questions: questions || [] })
  }

  if (action === 'get_queue') {
    const { data } = await s.from('scout_voice_queue').select('*')
      .eq('agency_id', agencyId).in('status', ['pending', 'in_progress'])
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
    return NextResponse.json({ data: data || [] })
  }

  if (action === 'get_agents') {
    const { data } = await s.from('scout_voice_agents').select('*')
      .eq('agency_id', agencyId).order('created_at', { ascending: false })
    return NextResponse.json({ data: data || [] })
  }

  if (action === 'get_stats') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const [total, completedToday, queuedDepth, activeNow, lastWeekAppts] = await Promise.all([
      s.from('scout_voice_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId),
      s.from('scout_voice_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('status', 'completed').gte('ended_at', today.toISOString()),
      s.from('scout_voice_queue').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('status', 'pending'),
      s.from('scout_voice_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).in('status', ['dialing', 'ringing', 'ivr', 'hold', 'speaking', 'voicemail']),
      s.from('scout_voice_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('appointment_set', true).gte('ended_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    ])
    const { data: completedDur } = await s.from('scout_voice_calls').select('duration_seconds').eq('agency_id', agencyId).eq('status', 'completed').not('duration_seconds', 'is', null).limit(200)
    const avgDuration = completedDur && completedDur.length
      ? Math.round(completedDur.reduce((a, c) => a + (c.duration_seconds || 0), 0) / completedDur.length)
      : 0
    const { count: dialedLastWeek } = await s.from('scout_voice_calls').select('*', { count: 'exact', head: true })
      .eq('agency_id', agencyId).gte('ended_at', new Date(Date.now() - 7 * 86400000).toISOString()).not('ended_at', 'is', null)
    const connectRate = dialedLastWeek && total.count ? Math.round(((lastWeekAppts.count || 0) / dialedLastWeek) * 1000) / 10 : 0
    return NextResponse.json({
      total_calls: total.count || 0,
      completed_today: completedToday.count || 0,
      queue_depth: queuedDepth.count || 0,
      active_now: activeNow.count || 0,
      appointments_last_7d: lastWeekAppts.count || 0,
      avg_duration_seconds: avgDuration,
      appointment_rate_last_7d: connectRate,
    })
  }

  if (action === 'get_knowledge') {
    const scope = searchParams.get('scope')
    const scopeValue = searchParams.get('scope_value')
    let q = s.from('scout_voice_knowledge').select('*')
      .or(`agency_id.is.null,agency_id.eq.${agencyId || '00000000-0000-0000-0000-000000000000'}`)
      .order('confidence_score', { ascending: false })
      .order('times_confirmed', { ascending: false })
      .limit(500)
    if (scope) q = q.eq('scope', scope)
    if (scopeValue) q = q.eq('scope_value', scopeValue)
    const { data } = await q
    return NextResponse.json({ data: data || [] })
  }

  if (action === 'get_active_calls') {
    const { data } = await s.from('scout_voice_calls').select('*')
      .eq('agency_id', agencyId)
      .in('status', ['dialing', 'ringing', 'ivr', 'hold', 'speaking', 'voicemail'])
      .order('started_at', { ascending: false })
    return NextResponse.json({ data: data || [] })
  }

  if (action === 'get_analytics') {
    const { data: calls } = await s.from('scout_voice_calls').select(
      'id, industry, sic_code, status, outcome, appointment_set, duration_seconds, questions_answered, questions_total, pitch_angle, biggest_gap, ended_at, created_at, deal_value_forecast, sentiment'
    ).eq('agency_id', agencyId).not('ended_at', 'is', null).order('ended_at', { ascending: false }).limit(1000)

    const rows = calls || []

    const byIndustry: Record<string, { total: number; completed: number; appointments: number; avg_duration: number }> = {}
    for (const c of rows) {
      const k = c.industry || 'unknown'
      const bucket = (byIndustry[k] ||= { total: 0, completed: 0, appointments: 0, avg_duration: 0 })
      bucket.total += 1
      if (c.status === 'completed') bucket.completed += 1
      if (c.appointment_set) bucket.appointments += 1
      if (c.duration_seconds) bucket.avg_duration += c.duration_seconds
    }
    for (const k of Object.keys(byIndustry)) {
      if (byIndustry[k].total) byIndustry[k].avg_duration = Math.round(byIndustry[k].avg_duration / byIndustry[k].total)
    }

    const byGap: Record<string, { total: number; appointments: number }> = {}
    for (const c of rows) {
      const k = c.biggest_gap || 'none'
      const bucket = (byGap[k] ||= { total: 0, appointments: 0 })
      bucket.total += 1
      if (c.appointment_set) bucket.appointments += 1
    }

    const dailyVolume: Record<string, number> = {}
    for (const c of rows) {
      if (!c.ended_at) continue
      const d = c.ended_at.slice(0, 10)
      dailyVolume[d] = (dailyVolume[d] || 0) + 1
    }

    const pipelineValue = rows.reduce((acc, c) => {
      const val = Number((c.deal_value_forecast as any)?.expected || 0)
      return acc + (Number.isNaN(val) ? 0 : val)
    }, 0)

    return NextResponse.json({
      total: rows.length,
      by_industry: byIndustry,
      by_gap: byGap,
      daily_volume: dailyVolume,
      pipeline_value: pipelineValue,
      appointment_rate: rows.length ? Math.round((rows.filter(c => c.appointment_set).length / rows.length) * 1000) / 10 : 0,
    })
  }

  // ── get_company ──
  if (action === 'get_company') {
    const companyId = searchParams.get('id') || ''
    if (!companyId) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data } = await s.from('scout_voice_companies').select('*').eq('id', companyId).single()
    const { data: personas } = await s.from('scout_voice_personas').select('*')
      .eq('company_id', companyId).order('dm_score', { ascending: false, nullsFirst: false })
    return NextResponse.json({ data, personas: personas || [] })
  }

  // ── list_companies ──
  if (action === 'list_companies') {
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const { data } = await s.from('scout_voice_companies').select('*, scout_voice_personas(id, name, title, dm_score, designation)')
      .eq('agency_id', agencyId).order('updated_at', { ascending: false }).limit(limit)
    return NextResponse.json({ data: data || [] })
  }

  // ── get_persona ──
  if (action === 'get_persona') {
    const personaId = searchParams.get('id') || ''
    if (!personaId) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data } = await s.from('scout_voice_personas').select('*, scout_voice_companies(id, name, website, industry)')
      .eq('id', personaId).single()
    // Include call history
    const { data: calls } = await s.from('scout_voice_calls')
      .select('id, status, outcome, started_at, duration_seconds, appointment_set')
      .eq('persona_id', personaId).order('started_at', { ascending: false }).limit(20)
    return NextResponse.json({ data, calls: calls || [] })
  }

  // ── list_personas ──
  if (action === 'list_personas') {
    const companyId = searchParams.get('company_id')
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    let q = s.from('scout_voice_personas').select('*, scout_voice_companies(id, name)')
      .eq('agency_id', agencyId).order('dm_score', { ascending: false, nullsFirst: false }).limit(limit)
    if (companyId) q = q.eq('company_id', companyId)
    const { data } = await q
    return NextResponse.json({ data: data || [] })
  }

  // ── get_cadences — list cadence states for an agency ──
  if (action === 'get_cadences') {
    const status = searchParams.get('status')
    let q = s.from('scout_voice_cadence_state').select('*, scout_voice_personas!scout_voice_cadence_state_persona_id_fkey(id, name, direct_phone)')
      .eq('agency_id', agencyId).order('next_action_at', { ascending: true, nullsFirst: false }).limit(100)
    if (status) q = q.eq('status', status)
    const { data } = await q
    return NextResponse.json({ data: data || [] })
  }

  // ── get_audit_gaps — gaps for a company or agency ──
  if (action === 'get_audit_gaps') {
    const companyId = searchParams.get('company_id')
    let q = s.from('scout_voice_audit_gaps').select('*').eq('active', true)
      .order('revenue_weight', { ascending: false })
    if (companyId) q = q.eq('company_id', companyId)
    else q = q.eq('agency_id', agencyId)
    const { data } = await q.limit(50)
    return NextResponse.json({ data: data || [] })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ═══════════════════════════════════════════════════════════════════
// POST
// ═══════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json()
  const { action } = body
  const s = sb()

  // ── queue_call — add a prospect to the call queue ──
  if (action === 'queue_call') {
    const { agency_id, opportunity_id, company_name, contact_name, contact_phone,
            industry, sic_code, pitch_angle, biggest_gap, priority, trigger_mode,
            campaign_id, agent_id, scheduled_at, company_id, persona_id } = body
    if (!agency_id || !company_name) return NextResponse.json({ error: 'agency_id and company_name required' }, { status: 400 })

    // ── TCPA compliance gate — block cell phones without consent ──
    if (contact_phone) {
      const phoneE164 = toE164(contact_phone)
      if (phoneE164) {
        const tcpa = await tcpaGate(phoneE164, agency_id)
        if (!tcpa.allowed) {
          return NextResponse.json({ error: 'tcpa_blocked', reason: tcpa.reason }, { status: 403 })
        }
        if (tcpa.warn) {
          console.warn(`[scout-voice] TCPA warning for ${phoneE164}: ${tcpa.warn}`)
        }

        // ── Time-window enforcement — no calls outside allowed hours ──
        // Resolve agent jurisdictions (if agent_id provided) to pass through
        let agentJurisdictions: string[] | null = null
        if (agent_id) {
          const { data: agentRow } = await s.from('scout_voice_agents')
            .select('jurisdictions_active')
            .eq('id', agent_id).maybeSingle()
          agentJurisdictions = agentRow?.jurisdictions_active || null
        }
        const window = await callWindowGate(phoneE164, agency_id, agentJurisdictions)
        if (!window.allowed) {
          return NextResponse.json({
            error: 'call_window_blocked',
            reason: window.reason,
            timezone: window.timezone,
            localTime: window.localTime,
            window: window.window,
            nextWindowIso: window.nextWindowIso,
          }, { status: 403 })
        }
      }
    }

    const { data: call, error: ce } = await s.from('scout_voice_calls').insert({
      agency_id, opportunity_id, agent_id, company_name, contact_name, industry, sic_code,
      pitch_angle, biggest_gap, priority: priority || 3, trigger_mode: trigger_mode || 'manual',
      status: 'queued', campaign_id,
      to_number: contact_phone,
      company_id: company_id || null,
      persona_id: persona_id || null,
    }).select('*').single()
    if (ce) return NextResponse.json({ error: ce.message }, { status: 500 })

    const { error: qe } = await s.from('scout_voice_queue').insert({
      agency_id, scout_call_id: call.id, opportunity_id, agent_id,
      company_name, contact_name, contact_phone, industry, sic_code, pitch_angle, biggest_gap,
      priority: priority || 3, trigger_mode: trigger_mode || 'manual',
      campaign_id, scheduled_at,
    })
    if (qe) return NextResponse.json({ error: qe.message }, { status: 500 })

    return NextResponse.json({ success: true, call_id: call.id })
  }

  // ── start_call — actually dial the prospect via Retell ──
  if (action === 'start_call') {
    const { call_id } = body
    if (!call_id) return NextResponse.json({ error: 'call_id required' }, { status: 400 })

    const { data: call } = await s.from('scout_voice_calls').select('*').eq('id', call_id).single()
    if (!call) return NextResponse.json({ error: 'Call not found' }, { status: 404 })

    // Resolve agent (specified on call, else agency default)
    let agent: any = null
    if (call.agent_id) {
      const r = await s.from('scout_voice_agents').select('*').eq('id', call.agent_id).single()
      agent = r.data
    }
    if (!agent) {
      const { data: def } = await s.from('scout_voice_agents').select('*')
        .eq('agency_id', call.agency_id).eq('active', true)
        .order('created_at', { ascending: true }).limit(1).maybeSingle()
      agent = def
    }
    if (!agent?.retell_agent_id) {
      await s.from('scout_voice_calls').update({
        status: 'failed',
        error_message: 'No active Scout voice agent configured. Run setup_scout_voice first.',
      }).eq('id', call_id)
      return NextResponse.json({ error: 'No Scout voice agent configured' }, { status: 400 })
    }

    // Resolve agency info for prompt
    const { data: agency } = await s.from('agencies').select('name, brand_name, scout_voice_from_number').eq('id', call.agency_id).single()
    const agencyName = agency?.brand_name || agency?.name || 'our company'

    // ── BRAIN FETCH ───────────────────────────────────────────────────────
    // Compose the call's system prompt from the unified voice brain:
    //   1. global_pattern facts (platform-wide, universal)
    //   2. industry-scoped facts (this industry only)
    //   3. sic-scoped facts (narrower silo)
    //   4. gap-scoped facts (e.g., "prospects without GA4 react to X")
    //   5. company-scoped facts (specific prior notes on this prospect)
    // direction=outbound_only OR both — never inbound_only on a Scout call.
    // Uses the voice_brain_for_call() Postgres function for ranking.
    let brainFacts: Array<{ scope: string; fact: string }> = []
    try {
      const { data: brain } = await s.rpc('voice_brain_for_call', {
        p_agency_id: call.agency_id,
        p_direction: 'outbound_only',
        p_industry: call.industry || null,
        p_sic_code: call.sic_code || null,
        p_naics_code: null,
        p_gap: call.biggest_gap || null,
        p_opportunity_id: call.opportunity_id || null,
        p_limit: 15,
      })
      brainFacts = (brain as any[])?.map(b => ({ scope: b.scope, fact: b.fact })) || []
    } catch {
      // RPC may not be deployed yet — fall back to direct query with OR filter
      const { data: fallback } = await s.from('scout_voice_knowledge').select('scope, fact')
        .or(`agency_id.is.null,agency_id.eq.${call.agency_id}`)
        .in('direction', ['outbound_only', 'both'])
        .or([
          `scope.eq.global_pattern`,
          call.industry ? `and(scope.eq.industry,scope_value.eq.${call.industry})` : null,
          call.sic_code ? `and(scope.eq.sic,scope_value.eq.${call.sic_code})` : null,
          call.biggest_gap ? `and(scope.eq.gap,scope_value.eq.${call.biggest_gap})` : null,
        ].filter(Boolean).join(','))
        .order('confidence_score', { ascending: false })
        .limit(15)
      brainFacts = fallback || []
    }

    // Keep the old shape for buildScoutPrompt — it expects a simple array of facts.
    // Ordering from brain is already global_pattern first, then industry, etc.
    const knowledge = brainFacts.map(b => ({ fact: b.fact }))

    // Geo awareness — tag the call with where the prospect lives so the
    // prompt can adjust regional expectations (pace, tone, norms).
    const geo = metaFromPhone(call.to_number)

    // ── BANK FETCH ──────────────────────────────────────────────────────
    // Pull the active question bank's top-performing question per stage.
    // Exploration-priority: questions with exploration_status='exploration'
    // and low calls_used get force-included so new questions build history.
    let bankQuestions: Array<{ stage: string; question_text: string; services_qualified?: string[] }> = []
    try {
      if (agent.active_bank_id) {
        const { data: qs } = await s.from('scout_questions')
          .select('stage, question_text, services_qualified, appointment_rate, calls_used, exploration_status, priority')
          .eq('bank_id', agent.active_bank_id)
          .order('stage')
          .order('priority', { ascending: true })
          .order('appointment_rate', { ascending: false })
        // Pick the top 2 per stage with exploration-priority boost for
        // questions that haven't been called yet (< 20 calls)
        const byStage: Record<string, any[]> = {}
        for (const q of qs || []) {
          const k = String(q.stage || 'other').toLowerCase()
          if (!byStage[k]) byStage[k] = []
          // Exploration boost: questions with <20 calls get a rank nudge
          const explorationBoost = (q.exploration_status === 'exploration' && (q.calls_used || 0) < 20) ? -0.5 : 0
          byStage[k].push({ ...q, rank_score: (q.priority || 3) + explorationBoost })
        }
        const orderedStages = ['opener', 'current_state', 'pain', 'decision', 'budget', 'timeline', 'competition', 'proof', 'closer']
        for (const stage of orderedStages) {
          const group = (byStage[stage] || []).sort((a, b) => a.rank_score - b.rank_score)
          for (const q of group.slice(0, 2)) {
            bankQuestions.push({ stage, question_text: q.question_text, services_qualified: q.services_qualified })
          }
        }
      }
    } catch { /* fall back to default prompt if bank fetch fails */ }

    // ── AI Disclosure lookup ──────────────────────────────────────
    // Check TCPA record for per-phone disclosure requirement, else
    // fall back to state-level default (required in most states).
    let aiDisclosure: { required: boolean; language?: string | null } = { required: true }
    try {
      const prospectPhone = toE164(call.to_number)
      if (prospectPhone) {
        const { data: tcpaRec } = await s.from('koto_voice_tcpa_records')
          .select('ai_disclosure_required, ai_disclosure_language')
          .eq('phone', prospectPhone)
          .eq('agency_id', call.agency_id)
          .maybeSingle()
        if (tcpaRec) {
          aiDisclosure = {
            required: tcpaRec.ai_disclosure_required !== false,
            language: tcpaRec.ai_disclosure_language || null,
          }
        }
        // No TCPA record → default to required (safe default)
      }
    } catch { /* default to required */ }

    // ── Persona context — enrich prompt with prior call intelligence ──
    let priorContext = ''
    let nameVerified = false
    try {
      if (call.persona_id) {
        const { data: persona } = await s.from('scout_voice_personas')
          .select('name, preferred_name, title, dm_score, designation, preferred_channel, preferred_time, do_not_call_after, pain_points, objections, buying_signals, budget_signals, timeline_signals, competitors_mentioned, personal_notes, call_count, last_contact_at')
          .eq('id', call.persona_id).single()

        if (persona) {
          nameVerified = persona.name?.manually_verified === true
          const lines: string[] = []
          const pName = persona.preferred_name?.value || persona.name?.value
          if (pName) lines.push(`Contact name: ${pName}`)
          if (persona.title?.value) lines.push(`Title: ${persona.title.value} (DM score: ${persona.dm_score || '?'}/100)`)
          if (persona.preferred_channel) lines.push(`Preferred contact method: ${persona.preferred_channel}`)
          if (persona.preferred_time) lines.push(`Preferred time: ${persona.preferred_time}`)
          if (persona.call_count > 0) lines.push(`Previous calls: ${persona.call_count} (last: ${persona.last_contact_at ? new Date(persona.last_contact_at).toLocaleDateString() : 'unknown'})`)

          const painArr = Array.isArray(persona.pain_points) ? persona.pain_points : []
          if (painArr.length > 0) {
            lines.push(`Pain points disclosed previously:`)
            for (const p of painArr.slice(-3)) lines.push(`  - ${p.text}`)
          }

          const objArr = Array.isArray(persona.objections) ? persona.objections : []
          if (objArr.length > 0) {
            lines.push(`Objections raised previously:`)
            for (const o of objArr.slice(-3)) lines.push(`  - ${o.text}${o.resolution_status ? ` (${o.resolution_status})` : ''}`)
          }

          const buyArr = Array.isArray(persona.buying_signals) ? persona.buying_signals : []
          if (buyArr.length > 0) {
            lines.push(`Buying signals detected:`)
            for (const b of buyArr.slice(-3)) lines.push(`  - ${b.type}: ${b.quote || ''}`)
          }

          const budgetArr = Array.isArray(persona.budget_signals) ? persona.budget_signals : []
          if (budgetArr.length > 0) lines.push(`Budget signals: ${budgetArr.map((b: any) => b.amount_or_range || b.context).join(', ')}`)

          const compArr = Array.isArray(persona.competitors_mentioned) ? persona.competitors_mentioned : []
          if (compArr.length > 0) lines.push(`Competitors mentioned: ${compArr.map((c: any) => c.vendor).join(', ')}`)

          const notesArr = Array.isArray(persona.personal_notes) ? persona.personal_notes : []
          if (notesArr.length > 0) {
            lines.push(`Notes:`)
            for (const n of notesArr.slice(-3)) lines.push(`  - ${n.note}`)
          }

          if (lines.length > 0) priorContext = lines.join('\n')
        }
      }
    } catch { /* persona fetch is non-blocking */ }

    const systemPrompt = buildScoutPrompt({
      agencyName,
      agentName: agent.name || 'your Scout AI',
      companyName: call.company_name || 'them',
      contactName: call.contact_name || undefined,
      industry: call.industry || undefined,
      pitchAngle: call.pitch_angle || undefined,
      biggestGap: call.biggest_gap || undefined,
      priorContext: priorContext || undefined,
      industryKnowledge: (knowledge || []).map((k: any) => k.fact),
      personality: agent.personality_profile?.style || undefined,
      geo,
      bankQuestions: bankQuestions.length > 0 ? bankQuestions : undefined,
      aiDisclosure,
      nameVerified,
      voicemail: agent.voicemail_mode !== 'off' ? {
        pattern: agent.voicemail_pattern || 'pattern_1',
        customScript: agent.voicemail_script_template || null,
        tone: agent.voicemail_tone || 'conversational',
        maxSeconds: agent.voicemail_max_seconds || 30,
      } : null,
    })

    const fromNumber = agent.from_number || agency?.scout_voice_from_number
    if (!fromNumber) {
      await s.from('scout_voice_calls').update({ status: 'failed', error_message: 'No from_number configured' }).eq('id', call_id)
      return NextResponse.json({ error: 'No from_number configured' }, { status: 400 })
    }

    const fromE164 = toE164(fromNumber)
    const toE164_ = toE164(call.to_number)
    if (!fromE164 || !toE164_) {
      await s.from('scout_voice_calls').update({ status: 'failed', error_message: 'Invalid from_number or to_number (could not normalize to E.164)' }).eq('id', call_id)
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    // ── Time-window re-check at dial time ──
    // A call may sit queued for hours; re-verify the window before actually dialing.
    const windowCheck = await callWindowGate(toE164_, call.agency_id, agent.jurisdictions_active || null)
    if (!windowCheck.allowed) {
      await s.from('scout_voice_calls').update({
        status: 'failed',
        error_message: `Call blocked: ${windowCheck.reason}`,
      }).eq('id', call_id)
      return NextResponse.json({
        error: 'call_window_blocked',
        reason: windowCheck.reason,
        timezone: windowCheck.timezone,
        localTime: windowCheck.localTime,
        nextWindowIso: windowCheck.nextWindowIso,
      }, { status: 403 })
    }

    try {
      // Build the opener begin_message from the prompt's opener question or a sensible default.
      // This prevents Retell's LLM from ad-libbing a greeting like "hey there thanks for picking up".
      const agentName_ = agent.name || 'Scout'
      const agencyName_ = call.agency_name || 'our team'
      const contactName_ = call.contact_name
      const beginMessage = contactName_
        ? `Hi, is this ${contactName_}? This is ${agentName_} from ${agencyName_} — do you have a quick minute?`
        : `Hi there, this is ${agentName_} from ${agencyName_} — do you have a quick minute?`

      const res = await retellFetch('/v2/create-phone-call', 'POST', {
        from_number: fromE164,
        to_number: toE164_,
        override_agent_id: agent.retell_agent_id,
        begin_message: beginMessage,
        retell_llm_dynamic_variables: {
          system_prompt: systemPrompt,
          company_name: call.company_name,
          contact_name: call.contact_name || '',
          industry: call.industry || '',
          pitch_angle: call.pitch_angle || '',
          biggest_gap: call.biggest_gap || '',
        },
        metadata: {
          agency_id: call.agency_id,
          scout_call_id: call.id,
          opportunity_id: call.opportunity_id,
          system: 'scout_voice',
        },
      })

      await s.from('scout_voice_calls').update({
        status: 'dialing',
        retell_call_id: res.call_id,
        from_number: fromE164,
        started_at: new Date().toISOString(),
      }).eq('id', call_id)

      await s.from('scout_voice_queue').update({
        status: 'in_progress',
        last_attempt_at: new Date().toISOString(),
        attempt_count: (((await s.from('scout_voice_queue').select('attempt_count').eq('scout_call_id', call_id).single()).data?.attempt_count || 0) + 1),
      }).eq('scout_call_id', call_id)

      return NextResponse.json({ success: true, retell_call_id: res.call_id })
    } catch (e: any) {
      await s.from('scout_voice_calls').update({ status: 'failed', error_message: e.message }).eq('id', call_id)
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── cancel_call ──
  if (action === 'cancel_call') {
    const { call_id } = body
    if (!call_id) return NextResponse.json({ error: 'call_id required' }, { status: 400 })
    await s.from('scout_voice_calls').update({ status: 'cancelled' }).eq('id', call_id)
    await s.from('scout_voice_queue').update({ status: 'cancelled' }).eq('scout_call_id', call_id)
    return NextResponse.json({ success: true })
  }

  // ── update_discovery_field — upsert one field into discovery_data ──
  if (action === 'update_discovery_field') {
    const { call_id, field, value } = body
    if (!call_id || !field) return NextResponse.json({ error: 'call_id and field required' }, { status: 400 })
    const { data: call } = await s.from('scout_voice_calls').select('discovery_data, questions_answered').eq('id', call_id).single()
    const nextData = { ...(call?.discovery_data || {}), [field]: value }
    const answeredCount = Object.keys(nextData).length
    await s.from('scout_voice_calls').update({
      discovery_data: nextData,
      questions_answered: answeredCount,
    }).eq('id', call_id)
    return NextResponse.json({ success: true, discovery_data: nextData })
  }

  // ── save_agent — upsert a Scout voice agent config ──
  if (action === 'save_agent') {
    const { id, ...data } = body.agent || body
    // If industry_slug is being set/changed and no explicit active_bank_id was
    // passed, auto-resolve the industry's default bank so the call-time
    // BANK FETCH (see line ~622) picks up the seeded question set.
    if (data.industry_slug && !data.active_bank_id) {
      const bankId = await resolveIndustryBankId(s, data.industry_slug)
      if (bankId) data.active_bank_id = bankId
    }
    if (id) {
      await s.from('scout_voice_agents').update(data).eq('id', id)
      return NextResponse.json({ success: true, id })
    }
    const { data: ins } = await s.from('scout_voice_agents').insert(data).select('id').single()
    return NextResponse.json({ success: true, id: ins?.id })
  }

  // ── backfill_agent_banks — one-time: set active_bank_id on any agent that
  // has an industry_slug but no bank assigned. Safe to re-run.
  if (action === 'backfill_agent_banks') {
    const { agency_id } = body
    let q = s.from('scout_voice_agents')
      .select('id, industry_slug')
      .not('industry_slug', 'is', null)
      .is('active_bank_id', null)
    if (agency_id) q = q.eq('agency_id', agency_id)
    const { data: agents } = await q
    const updated: Array<{ id: string; industry_slug: string; active_bank_id: string }> = []
    const skipped: Array<{ id: string; industry_slug: string; reason: string }> = []
    for (const a of agents || []) {
      const bankId = await resolveIndustryBankId(s, a.industry_slug)
      if (!bankId) {
        skipped.push({ id: a.id, industry_slug: a.industry_slug, reason: 'no_default_bank_for_industry' })
        continue
      }
      await s.from('scout_voice_agents').update({ active_bank_id: bankId }).eq('id', a.id)
      updated.push({ id: a.id, industry_slug: a.industry_slug, active_bank_id: bankId })
    }
    return NextResponse.json({ success: true, updated_count: updated.length, skipped_count: skipped.length, updated, skipped })
  }

  // ── create_agent — create Retell LLM + agent, store IDs ──
  if (action === 'create_agent') {
    const { agency_id, name, voice_id, industry_slug, from_number } = body
    if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'}/api/scout/voice/webhook`

    try {
      const llm = await retellFetch('/create-retell-llm', 'POST', {
        model: 'claude-4.5-haiku',
        general_prompt: 'You are a Scout SDR. The system prompt will be provided at call time via dynamic variables. Use the tools liberally.',
        general_tools: buildScoutTools(webhookUrl),
      })
      const agent = await retellFetch('/create-agent', 'POST', {
        agent_name: name || 'Scout SDR',
        response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
        voice_id: voice_id || '11labs-Adrian',
        language: 'en-US',
        webhook_url: webhookUrl,
        responsiveness: 0.9,
        interruption_sensitivity: 0.6,
        enable_backchannel: true,
        ambient_sound: 'coffee-shop',
        reminder_trigger_ms: 10000,
        reminder_max_count: 2,
      })

      const active_bank_id = await resolveIndustryBankId(s, industry_slug)

      const { data: ins } = await s.from('scout_voice_agents').insert({
        agency_id, name: name || 'Scout SDR',
        retell_agent_id: agent.agent_id, retell_llm_id: llm.llm_id,
        voice_id: voice_id || '11labs-Adrian',
        industry_slug,
        active_bank_id,
        from_number,
        active: true,
      }).select('id').single()

      return NextResponse.json({ success: true, agent_id: agent.agent_id, llm_id: llm.llm_id, id: ins?.id, active_bank_id })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── provision_number — buy a Retell phone number for Scout ──
  if (action === 'provision_number') {
    const { agency_id, area_code } = body
    if (!agency_id || !area_code) return NextResponse.json({ error: 'agency_id and area_code required' }, { status: 400 })
    try {
      const num = await retellFetch('/create-phone-number', 'POST', {
        area_code: parseInt(String(area_code), 10),
        nickname: `Scout SDR ${area_code}`,
      })
      await s.from('agencies').update({ scout_voice_from_number: num.phone_number }).eq('id', agency_id)
      return NextResponse.json({ success: true, phone_number: num.phone_number, phone_number_id: num.phone_number_id })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── setup_scout_voice — one-click: agent + LLM + number provisioning ──
  if (action === 'setup_scout_voice') {
    const { agency_id, area_code, agent_name, voice_id, cadence_preset, industry_slug } = body
    if (!agency_id || !area_code) return NextResponse.json({ error: 'agency_id and area_code required' }, { status: 400 })

    const steps: any[] = []
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'}/api/scout/voice/webhook`

    const cadence = getCadencePreset(cadence_preset)
    const chosenVoice = voice_id || '11labs-Adrian'

    try {
      const llm = await retellFetch('/create-retell-llm', 'POST', {
        model: 'claude-4.5-haiku',
        general_prompt: 'You are a Scout SDR. System prompt arrives via dynamic vars.',
        general_tools: buildScoutTools(webhookUrl),
      })
      steps.push({ step: 'retell_llm', ok: true, llm_id: llm.llm_id })

      const agent = await retellFetch('/create-agent', 'POST', {
        agent_name: agent_name || 'Scout SDR',
        response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
        voice_id: chosenVoice,
        language: 'en-US',
        webhook_url: webhookUrl,
        responsiveness: cadence.responsiveness,
        interruption_sensitivity: cadence.interruption_sensitivity,
        enable_backchannel: cadence.enable_backchannel,
        voice_speed: cadence.voice_speed,
        voice_temperature: cadence.voice_temperature,
      })
      steps.push({ step: 'retell_agent', ok: true, agent_id: agent.agent_id, voice_id: chosenVoice, cadence: cadence_preset || 'natural' })

      const num = await retellFetch('/create-phone-number', 'POST', {
        area_code: parseInt(String(area_code), 10),
        nickname: `Scout SDR ${area_code}`,
      })
      steps.push({ step: 'phone_number', ok: true, phone_number: num.phone_number })

      await s.from('agencies').update({
        scout_voice_agent_id: agent.agent_id,
        scout_voice_llm_id: llm.llm_id,
        scout_voice_from_number: num.phone_number,
      }).eq('id', agency_id)

      const active_bank_id = await resolveIndustryBankId(s, industry_slug)

      const { data: ins } = await s.from('scout_voice_agents').insert({
        agency_id, name: agent_name || 'Scout SDR',
        retell_agent_id: agent.agent_id, retell_llm_id: llm.llm_id,
        voice_id: chosenVoice,
        industry_slug,
        active_bank_id,
        from_number: num.phone_number,
        active: true,
      }).select('id').single()
      steps.push({ step: 'scout_agent_record', ok: true, id: ins?.id, industry_slug, active_bank_id })

      return NextResponse.json({ success: true, ready: true, steps, agent_id: agent.agent_id, phone_number: num.phone_number, active_bank_id })
    } catch (e: any) {
      steps.push({ step: 'error', ok: false, error: e.message })
      return NextResponse.json({ success: false, ready: false, steps, error: e.message }, { status: 500 })
    }
  }

  // ── ingest_knowledge — take a blob of reference text (pasted from a PDF,
  //    playbook, or coaching doc) and extract discrete facts into the brain.
  //    Claude Haiku handles the extraction + categorization in one shot.
  if (action === 'ingest_knowledge') {
    const { agency_id, text, scope, scope_value, direction, source_label } = body
    if (!agency_id || !text) return NextResponse.json({ error: 'agency_id and text required' }, { status: 400 })
    if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

    const systemPrompt = `You extract high-leverage cold-calling knowledge from reference material into structured facts.

Read the material the user pastes and return a JSON array of fact objects:
[
  {
    "fact": "one concrete actionable statement — specific, testable, useful on a live call",
    "category": "pitch_angle | pain_point | objection_response | timing | decision_maker | hot_button | opener | closer",
    "confidence": 0.5 to 0.95
  },
  ...
]

Rules:
- Each fact is self-contained, no context needed to apply it mid-call.
- Skip generic platitudes ("build rapport", "be a good listener"). Only specifics.
- Skip facts the source contradicts or marks uncertain.
- Max 25 facts per pass. Pick the most useful.
- Return ONLY the JSON array, no prose.`

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3500,
          temperature: 0.2,
          system: systemPrompt,
          messages: [{ role: 'user', content: String(text).slice(0, 60000) }],
        }),
      })
      if (!resp.ok) {
        const t = await resp.text().catch(() => '')
        return NextResponse.json({ error: `Claude error: ${resp.status} ${t.slice(0, 200)}` }, { status: 500 })
      }
      const data: any = await resp.json()
      const rawText: string = data?.content?.[0]?.text || '[]'
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      let facts: any[] = []
      try { facts = JSON.parse(cleaned) } catch { return NextResponse.json({ error: 'Claude returned invalid JSON' }, { status: 500 }) }
      if (!Array.isArray(facts)) return NextResponse.json({ error: 'Claude did not return an array' }, { status: 500 })

      const resolvedScope = scope || 'global_pattern'
      const resolvedScopeValue = scope_value || null
      const resolvedDirection = direction || 'both'

      const rows = facts.slice(0, 25).map((f: any) => ({
        agency_id,
        scope: resolvedScope,
        scope_value: resolvedScopeValue,
        direction: resolvedDirection,
        source_system: 'manual',
        fact: String(f.fact || '').slice(0, 1000),
        fact_category: String(f.category || 'hot_button').slice(0, 60),
        confidence_score: Math.min(1, Math.max(0, Number(f.confidence) || 0.6)),
        times_confirmed: 1,
      })).filter((r: any) => r.fact.length > 10)

      if (rows.length === 0) return NextResponse.json({ inserted: 0, note: 'No useful facts extracted' })

      const { error } = await s.from('scout_voice_knowledge').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({ inserted: rows.length, source_label: source_label || null })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'ingest failed' }, { status: 500 })
    }
  }

  // ── get_test_prospects — sample dummy rows for test dialing ──
  if (action === 'get_test_prospects') {
    return NextResponse.json({
      data: [
        { company_name: 'Acme HVAC', industry: 'HVAC', sic_code: '1711', biggest_gap: 'No Google Ads running', pitch_angle: 'Competitors are outbidding you on Maps' },
        { company_name: 'Lakeside Dental', industry: 'Dentistry', sic_code: '8021', biggest_gap: 'Google Business profile incomplete', pitch_angle: 'Missing hours + photos' },
        { company_name: 'Bright Legal', industry: 'Legal', sic_code: '8111', biggest_gap: 'No review management', pitch_angle: '3 unanswered negative reviews' },
        { company_name: 'Steel City Plumbing', industry: 'Plumbing', sic_code: '1711', biggest_gap: 'No email marketing', pitch_angle: 'Lost repeat customer revenue' },
      ],
    })
  }

  // ── test_call — dial a test number with a dummy prospect context ──
  if (action === 'test_call') {
    const { agency_id, to_number, company_name, pitch_angle, biggest_gap, industry } = body
    if (!agency_id || !to_number) return NextResponse.json({ error: 'agency_id and to_number required' }, { status: 400 })
    // Reuse queue_call + start_call machinery with the test prospect
    const { data: call, error: ce } = await s.from('scout_voice_calls').insert({
      agency_id,
      company_name: company_name || 'Test Prospect',
      industry: industry || 'Test',
      pitch_angle: pitch_angle || 'This is a test call.',
      biggest_gap: biggest_gap || undefined,
      priority: 1,
      trigger_mode: 'test',
      status: 'queued',
      to_number,
    }).select('*').single()
    if (ce) return NextResponse.json({ error: ce.message }, { status: 500 })

    // Directly call start_call logic inline by re-dispatching
    const startReq = new Request(req.url, {
      method: 'POST', headers: req.headers,
      body: JSON.stringify({ action: 'start_call', call_id: call.id }),
    })
    const startRes = await POST(startReq as any)
    const startData = await startRes.json().catch(() => ({}))
    if (!startData.success) {
      return NextResponse.json({ success: false, call_id: call.id, error: startData.error || 'start failed' }, { status: 500 })
    }
    return NextResponse.json({ success: true, call_id: call.id, retell_call_id: startData.retell_call_id })
  }

  // ── create_company — upsert a prospect company ──
  if (action === 'create_company') {
    const { agency_id, name, website, phone, address, industry, sic_code,
            naics_code, estimated_size, research_data } = body
    if (!agency_id || !name) return NextResponse.json({ error: 'agency_id and name required' }, { status: 400 })

    const { data, error: err } = await s.from('scout_voice_companies').upsert({
      agency_id, name, website, phone, address, industry, sic_code,
      naics_code, estimated_size, research_data: research_data || {},
    }, { onConflict: 'agency_id,name' }).select('*').single()
    if (err) return NextResponse.json({ error: err.message }, { status: 500 })
    return NextResponse.json({ success: true, data })
  }

  // ── update_company ──
  if (action === 'update_company') {
    const { id, ...fields } = body.company || body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    delete fields.action
    const { error: err } = await s.from('scout_voice_companies').update(fields).eq('id', id)
    if (err) return NextResponse.json({ error: err.message }, { status: 500 })
    return NextResponse.json({ success: true, id })
  }

  // ── create_persona — create a new person record ──
  if (action === 'create_persona') {
    const { agency_id, company_id, name, title, direct_phone, email,
            linkedin_url, dm_score, designation, preferred_channel,
            preferred_time } = body
    if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })

    // Build provenance-tracked name field
    const nameField = typeof name === 'object' ? name : {
      value: name || null,
      source: body.name_source || 'manual',
      confidence: body.name_confidence || 0.9,
      confirmed_at: new Date().toISOString(),
      manually_verified: body.manually_verified || false,
    }
    const titleField = typeof title === 'object' ? title : {
      value: title || null,
      source: body.title_source || 'manual',
      confidence: body.title_confidence || 0.8,
    }

    const { data, error: err } = await s.from('scout_voice_personas').insert({
      agency_id, company_id: company_id || null,
      name: nameField, title: titleField,
      direct_phone, email, linkedin_url,
      dm_score: dm_score ?? computeDmScore(titleField.value),
      designation: designation || 'unknown',
      preferred_channel, preferred_time,
    }).select('*').single()
    if (err) return NextResponse.json({ error: err.message }, { status: 500 })

    // If designated as a DM, update the company pointer
    if (company_id && (designation === 'primary_dm' || designation === 'backup_dm_1' || designation === 'backup_dm_2')) {
      const col = designation === 'primary_dm' ? 'primary_dm_id'
        : designation === 'backup_dm_1' ? 'backup_dm_1_id' : 'backup_dm_2_id'
      await s.from('scout_voice_companies').update({ [col]: data.id }).eq('id', company_id)
    }

    return NextResponse.json({ success: true, data })
  }

  // ── update_persona ──
  if (action === 'update_persona') {
    const { id, ...fields } = body.persona || body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    delete fields.action
    const { error: err } = await s.from('scout_voice_personas').update(fields).eq('id', id)
    if (err) return NextResponse.json({ error: err.message }, { status: 500 })
    return NextResponse.json({ success: true, id })
  }

  // ── verify_persona_name — mark a persona's name as manually verified ──
  // Name-safety rule (spec §25): voicemail MUST NOT include prospect name
  // unless manually_verified == true. This action is the only way to flip it.
  if (action === 'verify_persona_name') {
    const { persona_id, verified } = body
    if (!persona_id) return NextResponse.json({ error: 'persona_id required' }, { status: 400 })

    const { data: persona } = await s.from('scout_voice_personas').select('name').eq('id', persona_id).single()
    if (!persona) return NextResponse.json({ error: 'Persona not found' }, { status: 404 })

    const nameField = persona.name || {}
    nameField.manually_verified = verified !== false  // default to true
    nameField.verified_at = new Date().toISOString()

    const { error: err } = await s.from('scout_voice_personas').update({ name: nameField }).eq('id', persona_id)
    if (err) return NextResponse.json({ error: err.message }, { status: 500 })
    return NextResponse.json({ success: true, manually_verified: nameField.manually_verified })
  }

  // ── append_persona_insight — add an insight entry to a persona's jsonb array ──
  if (action === 'append_persona_insight') {
    const { persona_id, field, entry } = body
    if (!persona_id || !field || !entry) return NextResponse.json({ error: 'persona_id, field, and entry required' }, { status: 400 })
    const validFields = ['pain_points', 'objections', 'buying_signals', 'budget_signals', 'timeline_signals', 'competitors_mentioned', 'personal_notes']
    if (!validFields.includes(field)) return NextResponse.json({ error: `field must be one of: ${validFields.join(', ')}` }, { status: 400 })

    const { data: persona } = await s.from('scout_voice_personas').select(field).eq('id', persona_id).single()
    if (!persona) return NextResponse.json({ error: 'Persona not found' }, { status: 404 })

    const arr = Array.isArray((persona as any)[field]) ? (persona as any)[field] : []
    arr.push({ ...entry, captured_at: new Date().toISOString() })

    const { error: err } = await s.from('scout_voice_personas').update({ [field]: arr }).eq('id', persona_id)
    if (err) return NextResponse.json({ error: err.message }, { status: 500 })
    return NextResponse.json({ success: true, count: arr.length })
  }

  // ═══════════════════════════════════════════════════════════════
  // H9: Recording retention cleanup (call from cron)
  // ═══════════════════════════════════════════════════════════════

  if (action === 'retention_cleanup') {
    const now = new Date()
    const warningThreshold = new Date(now)
    warningThreshold.setDate(warningThreshold.getDate() + 3)  // day-27 = 3 days before expiry

    // Send day-27 warnings
    const { data: expiring } = await s.from('scout_voice_calls')
      .select('id, agency_id, company_name, recording_url, retention_expires_at')
      .lte('retention_expires_at', warningThreshold.toISOString())
      .gt('retention_expires_at', now.toISOString())
      .eq('retention_warning_sent', false)
      .not('recording_url', 'is', null)
      .limit(100)

    let warned = 0
    for (const call of expiring || []) {
      await s.from('scout_voice_calls').update({ retention_warning_sent: true }).eq('id', call.id)
      // TODO: send notification email — for now just flag
      warned++
    }

    // Delete expired recordings
    const { data: expired } = await s.from('scout_voice_calls')
      .select('id')
      .lte('retention_expires_at', now.toISOString())
      .not('recording_url', 'is', null)
      .limit(200)

    let deleted = 0
    for (const call of expired || []) {
      await s.from('scout_voice_calls').update({
        recording_url: null,
        updated_at: now.toISOString(),
      }).eq('id', call.id)
      deleted++
    }

    return NextResponse.json({ success: true, warned, deleted })
  }

  // ═══════════════════════════════════════════════════════════════
  // H10: Audit gap CRUD
  // ═══════════════════════════════════════════════════════════════

  if (action === 'create_audit_gap') {
    const { agency_id, company_id, gap_type, gap_specific, estimated_impact,
            revenue_weight, visual_proof_url, source, source_data } = body
    if (!agency_id || !gap_type || !gap_specific) {
      return NextResponse.json({ error: 'agency_id, gap_type, and gap_specific required' }, { status: 400 })
    }

    const { data, error: err } = await s.from('scout_voice_audit_gaps').insert({
      agency_id, company_id: company_id || null,
      gap_type, gap_specific, estimated_impact,
      revenue_weight: revenue_weight || 50,
      visual_proof_url, source: source || 'manual', source_data,
    }).select('*').single()
    if (err) return NextResponse.json({ error: err.message }, { status: 500 })
    return NextResponse.json({ success: true, data })
  }

  if (action === 'get_top_gaps') {
    const { company_id, agency_id, limit: lim } = body
    if (!company_id && !agency_id) return NextResponse.json({ error: 'company_id or agency_id required' }, { status: 400 })

    let q = s.from('scout_voice_audit_gaps').select('*').eq('active', true)
      .order('revenue_weight', { ascending: false }).limit(lim || 10)
    if (company_id) q = q.eq('company_id', company_id)
    else if (agency_id) q = q.eq('agency_id', agency_id)

    const { data } = await q
    return NextResponse.json({ data: data || [] })
  }

  // ═══════════════════════════════════════════════════════════════
  // H6: Cadence state machine
  // ═══════════════════════════════════════════════════════════════

  if (action === 'create_cadence') {
    const { agency_id, persona_id, campaign_id, cadence_preset, cadence_config } = body
    if (!agency_id || !persona_id) return NextResponse.json({ error: 'agency_id and persona_id required' }, { status: 400 })

    const config = cadence_config || getCadencePreset(cadence_preset) || getCadencePreset('natural')
    const firstActionAt = new Date()
    firstActionAt.setMinutes(firstActionAt.getMinutes() + 5) // first touch in 5 min

    const { data, error: err } = await s.from('scout_voice_cadence_state').insert({
      agency_id, persona_id, campaign_id: campaign_id || null,
      status: 'active',
      current_step: 1,
      current_dm_persona_id: persona_id,
      next_action_type: 'voice',
      next_action_at: firstActionAt.toISOString(),
      cadence_config: config,
    }).select('*').single()
    if (err) return NextResponse.json({ error: err.message }, { status: 500 })
    return NextResponse.json({ success: true, data })
  }

  if (action === 'advance_cadence') {
    const { cadence_id, touch_outcome } = body
    if (!cadence_id) return NextResponse.json({ error: 'cadence_id required' }, { status: 400 })

    const { data: cad } = await s.from('scout_voice_cadence_state').select('*').eq('id', cadence_id).single()
    if (!cad) return NextResponse.json({ error: 'Cadence not found' }, { status: 404 })

    const config = cad.cadence_config || {}
    const maxTouches = config.max_touches || 8
    const intervalHours = config.touch_interval_hours || 48
    const backupDmAfter = config.backup_dm_after_touches || 3
    const now = new Date()

    const updates: Record<string, any> = {
      total_touches: (cad.total_touches || 0) + 1,
      current_step: (cad.current_step || 1) + 1,
      last_touch_type: touch_outcome?.type || 'voice',
      last_touch_at: now.toISOString(),
    }

    // Check termination conditions
    if (touch_outcome?.outcome === 'appointment_set' || touch_outcome?.outcome === 'qualified_no_appointment') {
      updates.status = 'completed'
      updates.next_action_type = null
      updates.next_action_at = null
    } else if (touch_outcome?.outcome === 'dnc_requested' || touch_outcome?.outcome === 'opt_out_requested') {
      updates.status = 'opted_out'
      updates.next_action_type = null
      updates.next_action_at = null
    } else if (updates.total_touches >= maxTouches) {
      updates.status = 'exhausted'
      updates.next_action_type = null
      updates.next_action_at = null
    } else {
      // Schedule next touch
      const nextAt = new Date(now)
      nextAt.setHours(nextAt.getHours() + intervalHours)
      updates.next_action_at = nextAt.toISOString()

      // Determine next action type (voice → voicemail → email cycling)
      if (touch_outcome?.outcome === 'no_answer' || touch_outcome?.outcome === 'voicemail_left') {
        updates.next_action_type = 'voice'  // try again
      } else {
        updates.next_action_type = 'voice'
      }

      // Backup DM switch check
      if (updates.total_touches >= backupDmAfter && cad.dm_switches === 0) {
        // Look for backup DM on the company
        const { data: persona } = await s.from('scout_voice_personas')
          .select('company_id').eq('id', cad.persona_id).single()
        if (persona?.company_id) {
          const { data: company } = await s.from('scout_voice_companies')
            .select('backup_dm_1_id').eq('id', persona.company_id).single()
          if (company?.backup_dm_1_id) {
            updates.current_dm_persona_id = company.backup_dm_1_id
            updates.dm_switches = 1
            updates.next_action_reason = 'switched_to_backup_dm'
          }
        }
      }
    }

    const { error: err } = await s.from('scout_voice_cadence_state').update(updates).eq('id', cadence_id)
    if (err) return NextResponse.json({ error: err.message }, { status: 500 })
    return NextResponse.json({ success: true, status: updates.status || cad.status, next: updates.next_action_at })
  }

  if (action === 'pause_cadence') {
    const { cadence_id, reason } = body
    if (!cadence_id) return NextResponse.json({ error: 'cadence_id required' }, { status: 400 })
    await s.from('scout_voice_cadence_state').update({
      status: 'paused',
      paused_at: new Date().toISOString(),
      pause_reason: reason || 'manual',
      next_action_at: null,
    }).eq('id', cadence_id)
    return NextResponse.json({ success: true })
  }

  if (action === 'resume_cadence') {
    const { cadence_id } = body
    if (!cadence_id) return NextResponse.json({ error: 'cadence_id required' }, { status: 400 })
    const nextAt = new Date()
    nextAt.setHours(nextAt.getHours() + 2)
    await s.from('scout_voice_cadence_state').update({
      status: 'active',
      resumed_at: new Date().toISOString(),
      next_action_type: 'voice',
      next_action_at: nextAt.toISOString(),
    }).eq('id', cadence_id)
    return NextResponse.json({ success: true })
  }

  if (action === 'process_cadence_queue') {
    // Cron action: find all cadences where next_action_at <= now and queue calls
    const now = new Date()
    const { data: due } = await s.from('scout_voice_cadence_state')
      .select('*, scout_voice_personas!scout_voice_cadence_state_current_dm_persona_id_fkey(id, name, direct_phone, company_id, scout_voice_companies(id, name, industry, sic_code))')
      .eq('status', 'active')
      .lte('next_action_at', now.toISOString())
      .limit(50)

    const queued: string[] = []
    for (const cad of due || []) {
      const persona = (cad as any).scout_voice_personas
      if (!persona?.direct_phone) continue

      const company = persona.scout_voice_companies
      // Queue the call via the existing queue_call flow
      const { data: call } = await s.from('scout_voice_calls').insert({
        agency_id: cad.agency_id,
        company_name: company?.name || 'Unknown',
        contact_name: persona.name?.value || null,
        industry: company?.industry || null,
        sic_code: company?.sic_code || null,
        company_id: company?.id || null,
        persona_id: persona.id,
        campaign_id: cad.campaign_id || null,
        to_number: persona.direct_phone,
        priority: 2,
        trigger_mode: 'cadence',
        status: 'queued',
      }).select('id').single()

      if (call) queued.push(call.id)
    }

    return NextResponse.json({ success: true, queued_count: queued.length, call_ids: queued })
  }

  if (action === 'set_prospect_callback') {
    const { cadence_id, callback_for } = body
    if (!cadence_id) return NextResponse.json({ error: 'cadence_id required' }, { status: 400 })
    await s.from('scout_voice_cadence_state').update({
      callback_requested: true,
      callback_requested_at: new Date().toISOString(),
      callback_requested_for: callback_for || null,
      status: 'paused',
      pause_reason: 'prospect_callback',
      next_action_type: 'voice',
      next_action_at: callback_for || new Date().toISOString(),
    }).eq('id', cadence_id)
    return NextResponse.json({ success: true })
  }

  // ═══════════════════════════════════════════════════════════════
  // H12: Onboarding wizard
  // ═══════════════════════════════════════════════════════════════

  if (action === 'get_onboarding_status') {
    const { agent_id } = body
    if (!agent_id) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })
    const { data: agent } = await s.from('scout_voice_agents')
      .select('id, name, onboarding_step, onboarding_completed_at, industry_slug, voicemail_mode, voicemail_pattern, retell_agent_id, from_number, active')
      .eq('id', agent_id).single()
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    const STEPS = ['industry_select', 'agent_setup', 'voicemail_config', 'test_call', 'first_campaign', 'complete']
    const currentIdx = STEPS.indexOf(agent.onboarding_step || 'industry_select')

    // Auto-detect completion of steps based on agent state
    const stepStatus: Record<string, boolean> = {
      industry_select: !!agent.industry_slug,
      agent_setup: !!agent.retell_agent_id && !!agent.from_number,
      voicemail_config: agent.voicemail_mode === 'off' || !!agent.voicemail_pattern,
      test_call: false,  // must be explicitly completed
      first_campaign: false,  // must be explicitly completed
      complete: !!agent.onboarding_completed_at,
    }

    // Check if test call exists
    const { count: testCalls } = await s.from('scout_voice_calls')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent_id)
      .eq('trigger_mode', 'test')
      .eq('status', 'completed')
    stepStatus.test_call = (testCalls || 0) > 0

    // Check if any campaign exists
    const { count: campaigns } = await s.from('scout_voice_campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', body.agency_id || agent.id)
    stepStatus.first_campaign = (campaigns || 0) > 0

    return NextResponse.json({
      data: agent,
      steps: STEPS,
      current_step: agent.onboarding_step || 'industry_select',
      current_step_index: currentIdx,
      step_status: stepStatus,
      is_complete: !!agent.onboarding_completed_at,
    })
  }

  if (action === 'complete_onboarding_step') {
    const { agent_id, step } = body
    if (!agent_id || !step) return NextResponse.json({ error: 'agent_id and step required' }, { status: 400 })

    const STEPS = ['industry_select', 'agent_setup', 'voicemail_config', 'test_call', 'first_campaign', 'complete']
    const stepIdx = STEPS.indexOf(step)
    if (stepIdx === -1) return NextResponse.json({ error: 'Invalid step' }, { status: 400 })

    const nextStep = STEPS[stepIdx + 1] || 'complete'
    const updates: Record<string, any> = { onboarding_step: nextStep }
    if (nextStep === 'complete') {
      updates.onboarding_completed_at = new Date().toISOString()
    }

    await s.from('scout_voice_agents').update(updates).eq('id', agent_id)
    return NextResponse.json({ success: true, next_step: nextStep, complete: nextStep === 'complete' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
