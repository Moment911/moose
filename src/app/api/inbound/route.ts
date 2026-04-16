import { NextRequest, NextResponse } from 'next/server'
import { resolveAgencyId } from '../../../lib/apiAuth'
import { createClient } from '@supabase/supabase-js'
import { buildFrontDeskPromptForClient } from '@/lib/frontDeskPromptBuilder'

const RETELL_API_KEY = process.env.RETELL_API_KEY || ''
const RETELL_BASE = 'https://api.retellai.com'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function retellFetch(endpoint: string, method = 'GET', body?: any) {
  const res = await fetch(`${RETELL_BASE}${endpoint}`, {
    method,
    headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `Retell error ${res.status}`)
  return data
}

async function anthropicChat(systemPrompt: string, userMessage: string, maxTokens = 1024) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Anthropic API error')
  return data.content?.[0]?.text || ''
}

// ---------------------------------------------------------------------------
// Intake Templates
// ---------------------------------------------------------------------------

const INTAKE_TEMPLATES: Record<string, { id: string; label: string; icon_emoji: string; questions: { text: string; type: string }[] }> = {
  general: {
    id: 'general',
    label: 'General Business',
    icon_emoji: '\u{1F3E2}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is the best phone number to reach you?', type: 'phone' },
      { text: 'What is your email address?', type: 'email' },
      { text: 'How did you hear about us?', type: 'text' },
      { text: 'What is the reason for your call today?', type: 'text' },
      { text: 'Is this matter urgent?', type: 'boolean' },
    ],
  },
  medical: {
    id: 'medical',
    label: 'Medical Office',
    icon_emoji: '\u{1FA7A}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is your date of birth?', type: 'date' },
      { text: 'What insurance provider do you have?', type: 'text' },
      { text: 'What is your insurance member ID?', type: 'text' },
      { text: 'What symptoms are you experiencing?', type: 'text' },
      { text: 'When did your symptoms begin?', type: 'date' },
      { text: 'Are you currently taking any medications?', type: 'text' },
      { text: 'Would you like to schedule an appointment?', type: 'boolean' },
    ],
  },
  dental: {
    id: 'dental',
    label: 'Dental Office',
    icon_emoji: '\u{1F9B7}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is your date of birth?', type: 'date' },
      { text: 'Do you have dental insurance?', type: 'boolean' },
      { text: 'Who is your dental insurance provider?', type: 'text' },
      { text: 'Are you experiencing any dental pain or discomfort?', type: 'boolean' },
      { text: 'Which area of your mouth is affected?', type: 'text' },
      { text: 'When was your last dental visit?', type: 'date' },
      { text: 'Are you a new or existing patient?', type: 'text' },
    ],
  },
  legal: {
    id: 'legal',
    label: 'Law Firm',
    icon_emoji: '\u{2696}\u{FE0F}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is your phone number?', type: 'phone' },
      { text: 'What type of legal matter is this regarding?', type: 'text' },
      { text: 'Have you been involved in a recent incident or accident?', type: 'boolean' },
      { text: 'When did this incident occur?', type: 'date' },
      { text: 'Do you currently have legal representation?', type: 'boolean' },
      { text: 'Are there any upcoming court dates or deadlines?', type: 'text' },
    ],
  },
  hvac: {
    id: 'hvac',
    label: 'HVAC Services',
    icon_emoji: '\u{2744}\u{FE0F}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is the service address?', type: 'text' },
      { text: 'Is your system heating, cooling, or both?', type: 'text' },
      { text: 'What brand and model is your unit?', type: 'text' },
      { text: 'What issue are you experiencing?', type: 'text' },
      { text: 'Is this an emergency or can it be scheduled?', type: 'text' },
      { text: 'Are you a homeowner or tenant?', type: 'text' },
    ],
  },
  plumbing: {
    id: 'plumbing',
    label: 'Plumbing Services',
    icon_emoji: '\u{1F6BF}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is the service address?', type: 'text' },
      { text: 'What plumbing issue are you experiencing?', type: 'text' },
      { text: 'Is there any active flooding or water damage?', type: 'boolean' },
      { text: 'Where in the property is the issue located?', type: 'text' },
      { text: 'How long has this been going on?', type: 'text' },
      { text: 'Are you a homeowner or tenant?', type: 'text' },
    ],
  },
  roofing: {
    id: 'roofing',
    label: 'Roofing Services',
    icon_emoji: '\u{1F3E0}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is the property address?', type: 'text' },
      { text: 'Is there an active leak?', type: 'boolean' },
      { text: 'What type of roof do you have (shingle, tile, metal, flat)?', type: 'text' },
      { text: 'Is this for repair, replacement, or inspection?', type: 'text' },
      { text: 'Was the damage caused by a recent storm?', type: 'boolean' },
      { text: 'Do you plan to file an insurance claim?', type: 'boolean' },
    ],
  },
  real_estate: {
    id: 'real_estate',
    label: 'Real Estate',
    icon_emoji: '\u{1F3E1}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'Are you looking to buy, sell, or rent?', type: 'text' },
      { text: 'What area or neighborhood are you interested in?', type: 'text' },
      { text: 'What is your budget range?', type: 'text' },
      { text: 'How many bedrooms and bathrooms do you need?', type: 'text' },
      { text: 'What is your timeline for moving?', type: 'text' },
      { text: 'Are you pre-approved for a mortgage?', type: 'boolean' },
    ],
  },
  restaurant: {
    id: 'restaurant',
    label: 'Restaurant',
    icon_emoji: '\u{1F37D}\u{FE0F}',
    questions: [
      { text: 'What is your name for the reservation?', type: 'text' },
      { text: 'How many guests will be dining?', type: 'number' },
      { text: 'What date and time would you prefer?', type: 'text' },
      { text: 'Does anyone in your party have food allergies?', type: 'text' },
      { text: 'Is this for a special occasion?', type: 'text' },
      { text: 'Do you have any seating preferences (indoor, outdoor, private)?', type: 'text' },
    ],
  },
  salon: {
    id: 'salon',
    label: 'Hair Salon / Spa',
    icon_emoji: '\u{1F487}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What service are you looking to book?', type: 'text' },
      { text: 'Do you have a preferred stylist or technician?', type: 'text' },
      { text: 'What date and time works best for you?', type: 'text' },
      { text: 'Are you a new or returning client?', type: 'text' },
      { text: 'Do you have any allergies or sensitivities we should know about?', type: 'text' },
    ],
  },
  chiropractic: {
    id: 'chiropractic',
    label: 'Chiropractic Office',
    icon_emoji: '\u{1F9D1}\u{200D}\u{2695}\u{FE0F}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is your date of birth?', type: 'date' },
      { text: 'What area of pain or discomfort are you experiencing?', type: 'text' },
      { text: 'How long have you been experiencing this issue?', type: 'text' },
      { text: 'Was this caused by an accident or injury?', type: 'boolean' },
      { text: 'Have you seen a chiropractor before?', type: 'boolean' },
      { text: 'Do you have insurance that covers chiropractic care?', type: 'boolean' },
    ],
  },
  auto_repair: {
    id: 'auto_repair',
    label: 'Auto Repair Shop',
    icon_emoji: '\u{1F697}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is the year, make, and model of your vehicle?', type: 'text' },
      { text: 'What issue are you experiencing with your vehicle?', type: 'text' },
      { text: 'Is the vehicle drivable?', type: 'boolean' },
      { text: 'Are there any warning lights on your dashboard?', type: 'text' },
      { text: 'When would you like to bring the vehicle in?', type: 'text' },
      { text: 'Do you need a loaner or shuttle service?', type: 'boolean' },
    ],
  },
  veterinary: {
    id: 'veterinary',
    label: 'Veterinary Clinic',
    icon_emoji: '\u{1F43E}',
    questions: [
      { text: "What is your name (pet owner)?", type: 'text' },
      { text: "What is your pet's name and species?", type: 'text' },
      { text: "What breed is your pet and how old are they?", type: 'text' },
      { text: "What symptoms or concerns do you have?", type: 'text' },
      { text: 'Is this an emergency situation?', type: 'boolean' },
      { text: 'When did you first notice these symptoms?', type: 'text' },
      { text: 'Is your pet up to date on vaccinations?', type: 'boolean' },
      { text: 'Are you a new or existing client?', type: 'text' },
    ],
  },
  contractor: {
    id: 'contractor',
    label: 'General Contractor',
    icon_emoji: '\u{1F477}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is the project address?', type: 'text' },
      { text: 'What type of project are you planning (renovation, new build, addition)?', type: 'text' },
      { text: 'Can you describe the scope of work?', type: 'text' },
      { text: 'Do you have a budget range in mind?', type: 'text' },
      { text: 'What is your desired timeline?', type: 'text' },
      { text: 'Do you already have permits or architectural plans?', type: 'boolean' },
    ],
  },
  mental_health: {
    id: 'mental_health',
    label: 'Mental Health Practice',
    icon_emoji: '\u{1F9E0}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is your date of birth?', type: 'date' },
      { text: 'Are you seeking individual, couples, or family therapy?', type: 'text' },
      { text: 'Have you had therapy or counseling before?', type: 'boolean' },
      { text: 'What concerns or goals bring you to therapy?', type: 'text' },
      { text: 'Do you have insurance that covers mental health services?', type: 'boolean' },
      { text: 'Do you have a preference for in-person or telehealth sessions?', type: 'text' },
    ],
  },
  accounting: {
    id: 'accounting',
    label: 'Accounting Firm',
    icon_emoji: '\u{1F4CA}',
    questions: [
      { text: 'What is your full name or business name?', type: 'text' },
      { text: 'What accounting service do you need (tax prep, bookkeeping, audit, consulting)?', type: 'text' },
      { text: 'Is this for personal or business finances?', type: 'text' },
      { text: 'What is your filing status or business entity type?', type: 'text' },
      { text: 'Are there any upcoming tax deadlines you are concerned about?', type: 'text' },
      { text: 'Are you a new or existing client?', type: 'text' },
    ],
  },
  insurance: {
    id: 'insurance',
    label: 'Insurance Agency',
    icon_emoji: '\u{1F6E1}\u{FE0F}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What type of insurance are you inquiring about (auto, home, life, business)?', type: 'text' },
      { text: 'Are you looking for a new policy or calling about an existing one?', type: 'text' },
      { text: 'If existing, what is your policy number?', type: 'text' },
      { text: 'Are you filing a claim?', type: 'boolean' },
      { text: 'Can you describe the incident or what you need covered?', type: 'text' },
      { text: 'What is your preferred contact method?', type: 'text' },
    ],
  },
  landscaping: {
    id: 'landscaping',
    label: 'Landscaping Company',
    icon_emoji: '\u{1F333}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is the property address?', type: 'text' },
      { text: 'What landscaping services are you interested in (mowing, design, irrigation, tree removal)?', type: 'text' },
      { text: 'Is this a one-time service or recurring maintenance?', type: 'text' },
      { text: 'What is the approximate size of your property?', type: 'text' },
      { text: 'Do you have a budget in mind?', type: 'text' },
      { text: 'When would you like the work to begin?', type: 'text' },
    ],
  },
  cleaning: {
    id: 'cleaning',
    label: 'Cleaning Service',
    icon_emoji: '\u{1F9F9}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is the address to be cleaned?', type: 'text' },
      { text: 'Is this a residential or commercial property?', type: 'text' },
      { text: 'How many rooms or square footage?', type: 'text' },
      { text: 'Are you looking for a one-time or recurring cleaning?', type: 'text' },
      { text: 'Do you have any specific cleaning needs (deep clean, move-out, post-construction)?', type: 'text' },
      { text: 'Do you have pets?', type: 'boolean' },
    ],
  },
  mortgage: {
    id: 'mortgage',
    label: 'Mortgage / Lending',
    icon_emoji: '\u{1F3E6}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'Are you looking to purchase, refinance, or get pre-approved?', type: 'text' },
      { text: 'What is the estimated property value or purchase price?', type: 'text' },
      { text: 'What is your estimated down payment amount?', type: 'text' },
      { text: 'What is your estimated credit score range?', type: 'text' },
      { text: 'Are you self-employed or W-2 employed?', type: 'text' },
      { text: 'What is your desired loan term (15-year, 30-year)?', type: 'text' },
      { text: 'Have you been pre-approved by another lender?', type: 'boolean' },
    ],
  },
}

// ---------------------------------------------------------------------------
// Emergency keyword detection
// ---------------------------------------------------------------------------

const EMERGENCY_KEYWORDS = [
  'emergency', 'urgent', 'critical', 'life-threatening', 'chest pain',
  'bleeding', 'unconscious', 'not breathing', 'heart attack', 'stroke',
  'seizure', 'overdose', 'suicide', 'severe pain', 'accident',
  'fire', 'flood', 'gas leak', 'carbon monoxide',
]

function detectUrgency(transcript: string): 'low' | 'medium' | 'high' | 'emergency' {
  const lower = transcript.toLowerCase()
  const emergencyHits = EMERGENCY_KEYWORDS.filter(kw => lower.includes(kw))
  if (emergencyHits.length >= 2) return 'emergency'
  if (emergencyHits.length === 1) return 'high'
  if (lower.includes('asap') || lower.includes('as soon as possible') || lower.includes('right away')) return 'medium'
  return 'low'
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const agency_id = resolveAgencyId(request, searchParams)
    const agent_id = searchParams.get('agent_id')
    const call_id = searchParams.get('call_id')

    const supabase = getSupabase()

    switch (action) {
      case 'get_agents': {
        if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
        const { data, error } = await supabase
          .from('koto_inbound_agents')
          .select('*')
          .eq('agency_id', agency_id)
          .order('created_at', { ascending: false })
        if (error) throw error
        return NextResponse.json({ agents: data })
      }

      case 'get_calls': {
        if (!agent_id && !agency_id) return NextResponse.json({ error: 'agent_id or agency_id required' }, { status: 400 })
        let query = supabase.from('koto_inbound_calls').select('*')
        if (agent_id) query = query.eq('agent_id', agent_id)
        else if (agency_id) query = query.eq('agency_id', agency_id)

        const urgency = searchParams.get('urgency')
        const outcome = searchParams.get('outcome')
        const sentiment = searchParams.get('sentiment')
        const date_from = searchParams.get('date_from')
        const date_to = searchParams.get('date_to')

        if (urgency) query = query.eq('urgency', urgency)
        if (outcome) query = query.eq('outcome', outcome)
        if (sentiment) query = query.eq('sentiment', sentiment)
        if (date_from) query = query.gte('created_at', date_from)
        if (date_to) query = query.lte('created_at', date_to)

        query = query.order('created_at', { ascending: false }).limit(100)

        const { data, error } = await query
        if (error) throw error
        return NextResponse.json({ calls: data })
      }

      case 'get_call_detail': {
        if (!call_id) return NextResponse.json({ error: 'call_id required' }, { status: 400 })
        const [callRes, intakesRes] = await Promise.all([
          supabase.from('koto_inbound_calls').select('*').eq('id', call_id).single(),
          supabase.from('koto_inbound_intakes').select('*').eq('call_id', call_id),
        ])
        if (callRes.error) throw callRes.error
        return NextResponse.json({ call: callRes.data, intakes: intakesRes.data || [] })
      }

      case 'get_analytics': {
        if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
        const { data: calls, error } = await supabase
          .from('koto_inbound_calls')
          .select('*')
          .eq('agency_id', agency_id)
        if (error) throw error

        const allCalls = calls || []
        const totalCalls = allCalls.length
        const avgDuration = totalCalls > 0
          ? Math.round(allCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / totalCalls)
          : 0

        const outcomeCounts: Record<string, number> = {}
        const hourlyCounts: Record<number, number> = {}
        const dailyCounts: Record<string, number> = {}

        for (const call of allCalls) {
          // Outcome counts
          const outcome = call.outcome || 'unknown'
          outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1

          // Hourly breakdown
          if (call.created_at) {
            const date = new Date(call.created_at)
            const hour = date.getUTCHours()
            hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1

            const dayKey = date.toISOString().split('T')[0]
            dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1
          }
        }

        const hourlyBreakdown = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourlyCounts[h] || 0 }))
        const dailyBreakdown = Object.entries(dailyCounts)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date))

        return NextResponse.json({
          analytics: {
            total_calls: totalCalls,
            avg_duration_seconds: avgDuration,
            outcome_counts: outcomeCounts,
            hourly_breakdown: hourlyBreakdown,
            daily_breakdown: dailyBreakdown,
          },
        })
      }

      case 'get_intake_templates': {
        // UI expects an array; INTAKE_TEMPLATES is keyed by slug internally.
        return NextResponse.json({ templates: Object.values(INTAKE_TEMPLATES) })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[inbound GET]', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body
    const supabase = getSupabase()

    switch (action) {
      // -------------------------------------------------------------------
      // Create Agent
      // -------------------------------------------------------------------
      case 'create_agent': {
        const {
          agency_id, client_id, business_name, department, sic_code,
          voice_id, greeting_script, closed_script, emergency_script,
          intake_questions, timezone, phone_number, forward_number,
        } = body

        const agentName = (body.agent_name || business_name || '').trim()
        if (!agency_id || !agentName) {
          return NextResponse.json({ error: 'agency_id and business_name required' }, { status: 400 })
        }

        const displayName = business_name || agentName
        const beginMessage = greeting_script
          || `Hello, thank you for calling ${displayName}. How can I help you today?`
        let generalPrompt = `You are the AI receptionist for ${displayName}${department ? ` (${department} department)` : ''}.

Greet callers warmly, answer basic questions about the business, and collect their name, callback number, and reason for calling. Be concise, polite, and mirror the caller's energy. If the matter is urgent, mark it so and offer to escalate.

End the call once you have collected the caller's information and confirmed next steps.`

        if (client_id) {
          try {
            const frontDeskPrompt = await buildFrontDeskPromptForClient(client_id)
            if (frontDeskPrompt) generalPrompt = frontDeskPrompt
          } catch (e: any) {
            console.error('[inbound create_agent] Front desk prompt lookup failed (non-fatal):', e?.message)
          }
        }

        // Step 1: Create Retell LLM (prompt lives here, not on the agent)
        let llmId: string
        try {
          const llmRes = await retellFetch('/create-retell-llm', 'POST', {
            general_prompt: generalPrompt,
            begin_message: beginMessage,
          })
          llmId = llmRes.llm_id
          if (!llmId) throw new Error('Retell did not return llm_id')
        } catch (e: any) {
          return NextResponse.json({ error: e?.message || 'Retell create-retell-llm failed' }, { status: 500 })
        }

        // Step 2: Create Retell agent referencing the LLM
        const resolvedVoiceId = voice_id || '11labs-Marissa'
        let retellAgent: any
        try {
          retellAgent = await retellFetch('/create-agent', 'POST', {
            agent_name: agentName,
            voice_id: resolvedVoiceId,
            response_engine: { type: 'retell-llm', llm_id: llmId },
            language: 'en-US',
            enable_backchannel: true,
            backchannel_frequency: 0.7,
            interruption_sensitivity: 0.8,
          })
        } catch (e: any) {
          return NextResponse.json({ error: e?.message || 'Retell create-agent failed' }, { status: 500 })
        }

        // Step 3: Insert agent record (schema uses `name`, `closed_hours_script`, `status`, `industry`)
        const agentRecord: any = {
          agency_id,
          client_id: client_id || null,
          name: agentName,
          department: department || 'main',
          retell_agent_id: retellAgent.agent_id,
          voice_id: resolvedVoiceId,
          sic_code: sic_code || null,
          greeting_script: greeting_script || '',
          closed_hours_script: closed_script || '',
          emergency_script: emergency_script || '',
          intake_questions: intake_questions || [],
          timezone: timezone || 'America/New_York',
          status: 'active',
          phone_number: phone_number || forward_number || null,
          phone_source: phone_number ? 'koto' : (forward_number ? 'forward' : 'koto'),
        }

        const { data: agentData, error: agentError } = await supabase
          .from('koto_inbound_agents')
          .insert(agentRecord)
          .select()
          .single()
        if (agentError) {
          // Best effort: clean up orphaned Retell resources so the user can retry
          try { await retellFetch(`/delete-agent/${retellAgent.agent_id}`, 'DELETE') } catch {}
          try { await retellFetch(`/delete-retell-llm/${llmId}`, 'DELETE') } catch {}
          return NextResponse.json({ error: agentError.message }, { status: 500 })
        }

        // Step 4: If the wizard already provisioned a Koto number, link it to the new agent
        if (phone_number) {
          try {
            await retellFetch(`/update-phone-number/${phone_number}`, 'PATCH', {
              inbound_agent_id: retellAgent.agent_id,
            })
            await supabase
              .from('koto_inbound_phone_numbers')
              .update({ agent_id: agentData.id })
              .eq('phone_number', phone_number)
              .eq('agency_id', agency_id)
          } catch (e: any) {
            console.error('[inbound create_agent] Phone link failed (non-fatal):', e?.message)
          }
        }

        return NextResponse.json({ agent: agentData })
      }

      // -------------------------------------------------------------------
      // Update Agent
      // -------------------------------------------------------------------
      case 'update_agent': {
        const { agent_id, updates, update_retell } = body
        if (!agent_id) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })

        const { data: existing, error: fetchErr } = await supabase
          .from('koto_inbound_agents')
          .select('*')
          .eq('id', agent_id)
          .single()
        if (fetchErr) throw fetchErr

        // Update local DB
        const { data: updated, error: updateErr } = await supabase
          .from('koto_inbound_agents')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', agent_id)
          .select()
          .single()
        if (updateErr) throw updateErr

        // Optionally sync to Retell
        if (update_retell && existing.retell_agent_id) {
          const retellUpdates: any = {}
          if (updates.agent_name) retellUpdates.agent_name = updates.agent_name
          if (updates.voice_id) retellUpdates.voice_id = updates.voice_id
          if (updates.greeting_script) retellUpdates.general_prompt = updates.greeting_script

          if (Object.keys(retellUpdates).length > 0) {
            await retellFetch(`/update-agent/${existing.retell_agent_id}`, 'PATCH', retellUpdates)
          }
        }

        return NextResponse.json({ agent: updated })
      }

      // -------------------------------------------------------------------
      // Delete Agent
      // -------------------------------------------------------------------
      case 'delete_agent': {
        const { agent_id: deleteAgentId } = body
        if (!deleteAgentId) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })

        const { data: agent, error: getErr } = await supabase
          .from('koto_inbound_agents')
          .select('*')
          .eq('id', deleteAgentId)
          .single()
        if (getErr) throw getErr

        // Delete Retell agent
        if (agent.retell_agent_id) {
          try { await retellFetch(`/delete-agent/${agent.retell_agent_id}`, 'DELETE') } catch {}
        }

        // Release phone numbers
        const { data: phones } = await supabase
          .from('koto_inbound_phone_numbers')
          .select('*')
          .eq('agent_id', deleteAgentId)
        if (phones) {
          for (const phone of phones) {
            if (phone.retell_phone_number_id) {
              try { await retellFetch(`/delete-phone-number/${phone.retell_phone_number_id}`, 'DELETE') } catch {}
            }
          }
          await supabase.from('koto_inbound_phone_numbers').delete().eq('agent_id', deleteAgentId)
        }

        // Delete agent record
        const { error: delErr } = await supabase
          .from('koto_inbound_agents')
          .delete()
          .eq('id', deleteAgentId)
        if (delErr) throw delErr

        return NextResponse.json({ success: true })
      }

      // -------------------------------------------------------------------
      // Provision Phone (used by the New Agent wizard before agent exists,
      // and by the dashboard to attach a number to an existing agent)
      // -------------------------------------------------------------------
      case 'provision_number':
      case 'provision_phone': {
        const { agency_id: phoneAgencyId, agent_id: phoneAgentId, area_code: phoneAreaCode } = body

        const parsedAreaCode = parseInt(String(phoneAreaCode || '415'), 10)
        const phoneResult = await retellFetch('/create-phone-number', 'POST', {
          area_code: isNaN(parsedAreaCode) ? 415 : parsedAreaCode,
        })

        // Only persist when we have an owner to scope it to (agency or agent).
        let phoneRecord: any = null
        if (phoneAgencyId || phoneAgentId) {
          const { data, error: phoneErr } = await supabase
            .from('koto_inbound_phone_numbers')
            .insert({
              agency_id: phoneAgencyId || null,
              agent_id: phoneAgentId || null,
              phone_number: phoneResult.phone_number,
              retell_number_id: phoneResult.phone_number_id,
              area_code: String(phoneAreaCode || '415'),
            })
            .select()
            .single()
          if (phoneErr) throw phoneErr
          phoneRecord = data
        }

        return NextResponse.json({
          phone_number: phoneResult.phone_number,
          phone_number_id: phoneResult.phone_number_id,
          phone: phoneRecord,
        })
      }

      // -------------------------------------------------------------------
      // Webhook (Retell events)
      // -------------------------------------------------------------------
      case 'webhook': {
        const { event, call } = body

        if (event === 'call_ended' && call) {
          const transcript = call.transcript || ''
          const urgency = detectUrgency(transcript)

          // Fetch the agent info
          const { data: agentInfo } = await supabase
            .from('koto_inbound_agents')
            .select('*')
            .eq('retell_agent_id', call.agent_id)
            .single()

          const agency_id = agentInfo?.agency_id || null
          const db_agent_id = agentInfo?.id || null

          // Generate AI summary
          let summary = ''
          try {
            summary = await anthropicChat(
              'You are a call summarizer for an answering service. Summarize the following call transcript in 2-3 sentences. Include the caller\'s name if mentioned, their reason for calling, and any action items.',
              `Transcript:\n${transcript}`
            )
          } catch (err) {
            console.error('[inbound webhook] Summary generation failed:', err)
            summary = 'Summary unavailable.'
          }

          // Determine outcome and sentiment from transcript
          let outcome = 'completed'
          let sentiment = 'neutral'
          try {
            const analysis = await anthropicChat(
              'Analyze this call transcript. Return ONLY a JSON object with two fields: "outcome" (one of: completed, voicemail, missed, transferred, abandoned) and "sentiment" (one of: positive, neutral, negative, frustrated). No other text.',
              `Transcript:\n${transcript}`,
              256
            )
            const parsed = JSON.parse(analysis)
            outcome = parsed.outcome || 'completed'
            sentiment = parsed.sentiment || 'neutral'
          } catch {
            // Use defaults
          }

          // Insert call record
          const { data: callRecord, error: callErr } = await supabase
            .from('koto_inbound_calls')
            .insert({
              agency_id,
              agent_id: db_agent_id,
              retell_call_id: call.call_id,
              caller_number: call.from_number || '',
              transcript,
              summary,
              duration_seconds: call.duration_ms ? Math.round(call.duration_ms / 1000) : 0,
              recording_url: call.recording_url || '',
              urgency,
              outcome,
              sentiment,
            })
            .select()
            .single()
          if (callErr) throw callErr

          // Bill for the call (inbound voice)
          const callDuration = call.duration_ms ? Math.round(call.duration_ms / 1000) : 0
          if (callDuration > 0 && agency_id) {
            const minutes = Math.ceil(callDuration / 60)
            try {
              await fetch(new URL('/api/billing', request.url).toString(), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'record_usage', agency_id,
                  feature: 'voice_inbound', quantity: minutes, unit: 'minutes',
                  unit_cost: 0.02,
                }),
              })
            } catch {}
          }

          // Extract and insert intake answers
          if (agentInfo?.intake_questions?.length) {
            try {
              const intakePrompt = `Based on this call transcript, extract answers to the following intake questions. Return a JSON array where each element has "question" (string) and "answer" (string or null if not answered).\n\nQuestions:\n${agentInfo.intake_questions.map((q: any, i: number) => `${i + 1}. ${q.text}`).join('\n')}\n\nTranscript:\n${transcript}`
              const intakeRaw = await anthropicChat(
                'Extract intake form answers from a call transcript. Return ONLY valid JSON.',
                intakePrompt,
                1024
              )
              const intakeAnswers = JSON.parse(intakeRaw)
              if (Array.isArray(intakeAnswers)) {
                const intakeRecords = intakeAnswers.map((item: any) => ({
                  call_id: callRecord.id,
                  agent_id: db_agent_id,
                  agency_id,
                  question: item.question,
                  answer: item.answer || null,
                }))
                await supabase.from('koto_inbound_intakes').insert(intakeRecords)
              }
            } catch (err) {
              console.error('[inbound webhook] Intake extraction failed:', err)
            }
          }

          // Notifications
          if (agentInfo?.notification_phone) {
            // SMS notification handled via smsService when Twilio credentials are configured
          }

          if (agentInfo?.notification_email && process.env.RESEND_API_KEY) {
            try {
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: 'Answering Service <notifications@koto.ai>',
                  to: [agentInfo.notification_email],
                  subject: `New Call - ${urgency.toUpperCase()} urgency - ${call.from_number || 'Unknown Caller'}`,
                  html: `
                    <h2>New Inbound Call</h2>
                    <p><strong>From:</strong> ${call.from_number || 'Unknown'}</p>
                    <p><strong>Urgency:</strong> ${urgency}</p>
                    <p><strong>Duration:</strong> ${call.duration_ms ? Math.round(call.duration_ms / 1000) : 0}s</p>
                    <p><strong>Summary:</strong> ${summary}</p>
                    <p><strong>Outcome:</strong> ${outcome}</p>
                    <p><strong>Sentiment:</strong> ${sentiment}</p>
                    ${call.recording_url ? `<p><a href="${call.recording_url}">Listen to Recording</a></p>` : ''}
                  `.trim(),
                }),
              })
            } catch (emailErr) {
              console.error('[inbound webhook] Email notification failed:', emailErr)
            }
          }

          return NextResponse.json({ success: true, call: callRecord })
        }

        return NextResponse.json({ success: true, message: 'Event received' })
      }

      // -------------------------------------------------------------------
      // Generate Script
      // -------------------------------------------------------------------
      case 'generate_script': {
        const { business_name: scriptBiz, business_type: scriptType, script_type, custom_instructions, naics_code, naics_title } = body
        if (!scriptType) return NextResponse.json({ error: 'script_type required (greeting, closed, emergency)' }, { status: 400 })

        const naicsContext = naics_code ? ` NAICS code: ${naics_code} (${naics_title}). Use this industry classification to tailor terminology, compliance requirements, and caller expectations.` : ''
        const systemPrompt = `You are an expert at writing professional answering service scripts. Generate a ${script_type} script for a ${scriptType || 'general'} business called "${scriptBiz || 'the business'}".${naicsContext} The script should be conversational, warm, and professional. Keep it under 200 words.`
        const userMsg = custom_instructions
          ? `Additional instructions: ${custom_instructions}`
          : `Generate a ${script_type} script.`

        const script = await anthropicChat(systemPrompt, userMsg, 512)
        return NextResponse.json({ script })
      }

      // -------------------------------------------------------------------
      // Generate Questions
      // -------------------------------------------------------------------
      case 'generate_questions': {
        const { industry, business_description, num_questions, naics_code: qNaics, naics_title: qNaicsTitle } = body

        const naicsInfo = qNaics ? ` The business is classified under NAICS ${qNaics} (${qNaicsTitle}). Tailor questions to this specific industry — use correct terminology, ask about industry-specific needs, and consider regulatory requirements.` : ''
        const systemPrompt = `You are an expert at creating intake questionnaires for answering services. Generate intake questions that a virtual receptionist should ask callers. Return ONLY a JSON array of objects with "text" (string) and "type" (one of: text, phone, email, date, number, boolean).${naicsInfo}`
        const userMsg = `Generate ${num_questions || 6} intake questions for a ${industry || 'general'} business. ${business_description ? `Business description: ${business_description}` : ''}`

        const raw = await anthropicChat(systemPrompt, userMsg, 1024)
        let questions = []
        try {
          questions = JSON.parse(raw)
        } catch {
          // Try to extract JSON from response
          const match = raw.match(/\[[\s\S]*\]/)
          if (match) questions = JSON.parse(match[0])
        }

        return NextResponse.json({ questions })
      }

      // -------------------------------------------------------------------
      // Send Notifications (manual resend)
      // -------------------------------------------------------------------
      case 'send_notifications': {
        const { call_id: notifyCallId } = body
        if (!notifyCallId) return NextResponse.json({ error: 'call_id required' }, { status: 400 })

        const { data: callData, error: callFetchErr } = await supabase
          .from('koto_inbound_calls')
          .select('*')
          .eq('id', notifyCallId)
          .single()
        if (callFetchErr) throw callFetchErr

        const { data: agentData } = await supabase
          .from('koto_inbound_agents')
          .select('*')
          .eq('id', callData.agent_id)
          .single()

        const notifications: string[] = []

        // SMS
        if (agentData?.notification_phone) {
          notifications.push(`SMS logged for ${agentData.notification_phone}`)
          // TODO: Actual SMS via Twilio
        }

        // Email
        if (agentData?.notification_email && process.env.RESEND_API_KEY) {
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Answering Service <notifications@koto.ai>',
                to: [agentData.notification_email],
                subject: `[Resend] Call Notification - ${callData.caller_number || 'Unknown'}`,
                html: `
                  <h2>Call Notification (Resent)</h2>
                  <p><strong>From:</strong> ${callData.caller_number || 'Unknown'}</p>
                  <p><strong>Urgency:</strong> ${callData.urgency}</p>
                  <p><strong>Summary:</strong> ${callData.summary}</p>
                  ${callData.recording_url ? `<p><a href="${callData.recording_url}">Listen to Recording</a></p>` : ''}
                `.trim(),
              }),
            })
            notifications.push(`Email sent to ${agentData.notification_email}`)
          } catch (emailErr) {
            console.error('[inbound] Resend email failed:', emailErr)
            notifications.push('Email send failed')
          }
        }

        return NextResponse.json({ success: true, notifications })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[inbound POST]', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
