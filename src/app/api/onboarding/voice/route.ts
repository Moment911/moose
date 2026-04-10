import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications'

// ─────────────────────────────────────────────────────────────
// Voice Onboarding
//
// The agent-side of voice-powered onboarding. A client calls a
// Retell-backed number assigned to an agency → this route serves
// the agent's dynamic system prompt and receives the webhooks.
//
// Actions:
//   create_onboarding_agent — one-time setup: creates the Retell
//     agent with the save_answer tool definition, stores its id on
//     the agencies row (onboarding_agent_id).
//
//   get_agent_prompt — builds a fresh system prompt for a given
//     client right before the call connects. Includes what's
//     already answered, what's still missing, and caller identity
//     if we can match the incoming phone number to a known contact.
//
//   retell_webhook — receives Retell's call_started / call_ended /
//     function_call events. On save_answer calls, routes to the
//     normal onboarding autosave so vault/audit/notification
//     pipelines still run. Writes caller attribution into
//     koto_onboarding_recipients for multi-caller resume logic.
//
// ─────────────────────────────────────────────────────────────

const RETELL_API_KEY = process.env.RETELL_API_KEY || ''
const RETELL_BASE = 'https://api.retellai.com'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function retellFetch(path: string, method = 'GET', body?: any) {
  if (!RETELL_API_KEY) throw new Error('RETELL_API_KEY not configured')
  const res = await fetch(`${RETELL_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${RETELL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Retell ${path} ${res.status}: ${text}`)
  }
  return res.json()
}

// ─────────────────────────────────────────────────────────────
// The full set of questions the onboarding agent will try to
// cover. Priority 1 fields are must-haves for the proposal to
// be useful; priority 2/3 are nice-to-have. The web form and the
// voice flow share the same field keys so data from one path
// shows up instantly in the other.
// ─────────────────────────────────────────────────────────────
type OnboardingQuestion = {
  field: string
  question: string
  priority: 1 | 2 | 3
}

const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  { field: 'welcome_statement', question: "First, I'd love to hear about your business in your own words. What do you do, who do you serve, and what's most important for us to know?", priority: 1 },
  { field: 'owner_name', question: "What's your full name and your role at the company?", priority: 1 },
  { field: 'phone', question: "What's the best phone number to reach you directly?", priority: 1 },
  { field: 'website', question: "What's your website URL?", priority: 1 },
  { field: 'industry', question: "How would you describe your industry or type of business?", priority: 1 },
  { field: 'city', question: "What city and state are you located in?", priority: 1 },
  { field: 'num_employees', question: "How many people work for you right now?", priority: 2 },
  { field: 'year_founded', question: "What year was the business founded?", priority: 2 },
  { field: 'primary_service', question: "What's your primary service or product?", priority: 1 },
  { field: 'secondary_services', question: "What other services or products do you offer?", priority: 2 },
  { field: 'target_customer', question: "Describe your ideal customer. Who do you love working with?", priority: 1 },
  { field: 'avg_deal_size', question: "What's the average value of a typical job or transaction?", priority: 2 },
  { field: 'marketing_budget', question: "How much do you currently spend on marketing each month?", priority: 2 },
  { field: 'marketing_channels', question: "What marketing channels are you using right now?", priority: 2 },
  { field: 'crm_used', question: "What CRM or software do you use to manage leads and customers?", priority: 2 },
  { field: 'competitor_1', question: "Who's your biggest competitor?", priority: 3 },
  { field: 'unique_selling_prop', question: "Why should someone choose you over your competitors?", priority: 2 },
  { field: 'referral_sources', question: "Where do most of your best customers come from?", priority: 2 },
  { field: 'notes', question: "What are your top goals for the next 12 months?", priority: 1 },
]

function computeMissingFields(client: any): { missing: OnboardingQuestion[]; answered: { field: string; value: any }[] } {
  const answers = (client?.onboarding_answers && typeof client.onboarding_answers === 'object') ? client.onboarding_answers : {}
  const answered: { field: string; value: any }[] = []
  const missing: OnboardingQuestion[] = []
  for (const q of ONBOARDING_QUESTIONS) {
    const colVal = client?.[q.field]
    const jsonbVal = answers[q.field]
    const hasCol = colVal !== null && colVal !== undefined && colVal !== ''
    const hasJsonb = jsonbVal !== null && jsonbVal !== undefined && jsonbVal !== ''
    if (hasCol || hasJsonb) {
      answered.push({ field: q.field, value: hasCol ? colVal : jsonbVal })
    } else {
      missing.push(q)
    }
  }
  missing.sort((a, b) => a.priority - b.priority)
  return { missing, answered }
}

// ─────────────────────────────────────────────────────────────
// Caller identification — match an incoming phone number to the
// client's known contacts, or to a previous voice recipient.
// Returns { name, role, is_known } so the system prompt can greet
// them warmly vs asking who they are.
// ─────────────────────────────────────────────────────────────
async function identifyCaller(sb: any, clientId: string, callerPhone: string) {
  if (!callerPhone) return { name: null, role: null, is_known: false, recipient_id: null as string | null }

  const { data: client } = await sb
    .from('clients')
    .select('id, name, owner_name, owner_phone, phone')
    .eq('id', clientId)
    .maybeSingle()

  if (!client) return { name: null, role: null, is_known: false, recipient_id: null }

  const normalize = (s: string | null | undefined) =>
    (s || '').replace(/\D/g, '').replace(/^1/, '')
  const caller = normalize(callerPhone)

  if (normalize(client.owner_phone) === caller || normalize(client.phone) === caller) {
    return {
      name: client.owner_name || 'the owner',
      role: 'owner',
      is_known: true,
      recipient_id: null,
    }
  }

  const { data: prior } = await sb
    .from('koto_onboarding_recipients')
    .select('id, name, role_label, phone')
    .eq('client_id', clientId)
    .eq('source', 'voice')
    .order('last_active_at', { ascending: false })
    .limit(25)

  const match = (prior || []).find((r: any) => normalize(r.phone) === caller)
  if (match) {
    return {
      name: match.name || null,
      role: match.role_label || null,
      is_known: !!match.name,
      recipient_id: match.id,
    }
  }

  return { name: null, role: null, is_known: false, recipient_id: null }
}

// ─────────────────────────────────────────────────────────────
// Build the Retell system prompt for a specific client. This is
// the brains of the agent — it tells it exactly which questions
// to ask and which to skip.
// ─────────────────────────────────────────────────────────────
async function buildOnboardingSystemPrompt(args: {
  sb: any
  clientId: string
  agencyId: string
  callerName?: string | null
  callerPhone?: string | null
}): Promise<{ prompt: string; beginMessage: string; missingCount: number; answeredCount: number }> {
  const { sb, clientId, agencyId, callerName } = args

  const [{ data: client }, { data: agency }] = await Promise.all([
    sb.from('clients')
      .select('*')
      .eq('id', clientId)
      .maybeSingle(),
    sb.from('agencies')
      .select('id, name, brand_name')
      .eq('id', agencyId)
      .maybeSingle(),
  ])

  const agencyName = agency?.brand_name || agency?.name || 'Your Agency'
  const clientName = client?.name || 'the business'

  const { missing, answered } = computeMissingFields(client)

  const welcomeStatement = client?.welcome_statement
    ? `The client already told us: "${String(client.welcome_statement).slice(0, 600)}"`
    : 'No prior information on file.'
  const classificationLine = client?.business_classification && typeof client.business_classification === 'object'
    ? `Business type: ${String(client.business_classification.business_model || '').toUpperCase()} | ${client.business_classification.geographic_scope || ''} | ${client.business_classification.business_type || ''}`
    : ''

  const answeredBlock = answered.length
    ? answered.map((a) => `- ${a.field}: ${String(a.value).slice(0, 120)}`).join('\n')
    : 'Nothing answered yet — start from the beginning.'

  const topMissing = missing.slice(0, 8)
  const remainingCount = Math.max(0, missing.length - topMissing.length)
  const questionsBlock = topMissing.length
    ? topMissing.map((q, i) => `${i + 1}. ${q.question} [field: ${q.field}]`).join('\n')
    : 'All priority questions are already answered — just confirm anything that sounds outdated and wrap up.'

  const callerLine = callerName
    ? `You are speaking with ${callerName} from ${clientName}.`
    : "You don't know who is calling yet. Start by confirming their name and role at the company."

  const prompt = `You are an onboarding specialist calling on behalf of ${agencyName}. You are warm, professional, and efficient. Your goal is to collect information about ${clientName} to help the agency do their best work.

BUSINESS CONTEXT:
${welcomeStatement}
${classificationLine}

CALLER IDENTIFICATION:
${callerLine}

ALREADY ANSWERED (do NOT ask these again):
${answeredBlock}

QUESTIONS TO ASK (in order, ask only these):
${questionsBlock}
${remainingCount > 0 ? `\n…and ${remainingCount} more questions if time allows.` : ''}

INSTRUCTIONS:
- Be conversational, not robotic. Don't read questions like a survey.
- After they answer, confirm what you heard: "Got it, so your primary service is X — is that right?"
- If they say they don't know something, say "No problem, someone else from your team can provide that later."
- Save each answer immediately using the save_answer tool.
- If the caller says something like "wait, that's wrong" or "actually, let me correct that" or "I made a mistake", use the save_answer tool again with the corrected value and the same field name — the system will use the latest value.
- When you've covered all questions or they need to go, wrap up warmly.
- NEVER ask for passwords, payment info, or sensitive credentials.
- If they ask what this is for, explain: "This helps our team understand your business so we can hit the ground running on day one."

WRAP UP:
When done: "That's everything I need for now. I'll pass this along to the team. If there's anything else you'd like to add or if someone else from your team wants to call in with more details, they can reach this same number. Have a great day!"

TOOL: save_answer
Use this tool every time the caller answers a question. Call it immediately after confirming their answer.
Parameters: { field: string, answer: string, confidence: number (0-100) }`

  const beginMessage = callerName
    ? `Hi ${callerName.split(' ')[0]}! Welcome back. This is ${agencyName} calling about ${clientName}. We already have some great information on file — I just need a few more details and we'll be all set.`
    : answered.length > 0
      ? `Hi! This is ${agencyName} calling about the onboarding for ${clientName}. Someone from your team already provided some information. Could I get your name and role? I'll just cover the remaining questions.`
      : `Hi! This is ${agencyName} calling to help get your account set up. Is this a good time to answer a few questions about your business? It should only take about 10 to 15 minutes.`

  return {
    prompt,
    beginMessage,
    missingCount: missing.length,
    answeredCount: answered.length,
  }
}

// Tool definition for Retell — the agent calls this every time
// it captures an answer during the live conversation.
const SAVE_ANSWER_TOOL = {
  type: 'function',
  function: {
    name: 'save_answer',
    description: 'Save a field answer from the onboarding conversation',
    parameters: {
      type: 'object',
      properties: {
        field: { type: 'string', description: "The field name to save (e.g. 'primary_service', 'marketing_budget')" },
        answer: { type: 'string', description: "The caller's answer to save" },
        confidence: { type: 'number', description: 'Your confidence in this answer (0-100)' },
      },
      required: ['field', 'answer'],
    },
  },
}

// ─────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { action } = body || {}
    const sb = getSupabase()

    // ── Action: create_onboarding_agent ──────────────────────
    // One-time setup per agency. Creates the Retell agent with the
    // save_answer tool and stores its id on the agencies row.
    if (action === 'create_onboarding_agent') {
      const { agency_id, voice_id } = body
      if (!agency_id) {
        return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
      }

      const { data: agency } = await sb
        .from('agencies')
        .select('id, name, brand_name, onboarding_agent_id')
        .eq('id', agency_id)
        .maybeSingle()

      if (!agency) {
        return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
      }

      const agencyName = agency.brand_name || agency.name || 'Your Agency'
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'}/api/onboarding/voice`

      // The agent-level prompt is a generic fallback — the real per-call
      // prompt is built at call_started time via get_agent_prompt and
      // injected via Retell dynamic variables. Retell requires a general
      // prompt at creation time even if we override it per call.
      const fallbackPrompt = `You are an onboarding specialist for ${agencyName}. You collect information about a business to help the agency do their best work. Be warm and conversational. Use the save_answer tool to record each field answer.`

      const retellConfig: any = {
        agent_name: `${agencyName} Onboarding Assistant`,
        voice_id: voice_id || '11labs-Marissa',
        response_engine: { type: 'retell-llm', llm_id: null },
        language: 'en-US',
        general_prompt: fallbackPrompt,
        begin_message: `Hi! This is ${agencyName} calling to help get your account set up. Is this a good time to answer a few questions about your business?`,
        webhook_url: webhookUrl,
        enable_backchannel: true,
        backchannel_frequency: 0.7,
        interruption_sensitivity: 0.75,
        general_tools: [SAVE_ANSWER_TOOL],
        metadata: { agency_id, kind: 'onboarding' },
      }

      let retellAgent: any = null
      try {
        retellAgent = await retellFetch('/create-agent', 'POST', retellConfig)
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Retell create-agent failed' }, { status: 500 })
      }

      if (!retellAgent?.agent_id) {
        return NextResponse.json({ error: 'Retell did not return an agent_id' }, { status: 500 })
      }

      await sb
        .from('agencies')
        .update({ onboarding_agent_id: retellAgent.agent_id })
        .eq('id', agency_id)

      return NextResponse.json({
        ok: true,
        agent_id: retellAgent.agent_id,
        agent_name: retellConfig.agent_name,
      })
    }

    // ── Action: get_agent_prompt ─────────────────────────────
    // Called on-demand by the webhook or by a test harness to
    // render the prompt for a specific client.
    if (action === 'get_agent_prompt') {
      const { client_id, agency_id, caller_phone } = body
      if (!client_id || !agency_id) {
        return NextResponse.json({ error: 'client_id and agency_id required' }, { status: 400 })
      }

      const caller = await identifyCaller(sb, client_id, caller_phone || '')
      const built = await buildOnboardingSystemPrompt({
        sb,
        clientId: client_id,
        agencyId: agency_id,
        callerName: caller.name,
        callerPhone: caller_phone,
      })

      return NextResponse.json({
        ok: true,
        general_prompt: built.prompt,
        begin_message: built.beginMessage,
        caller,
        missing_count: built.missingCount,
        answered_count: built.answeredCount,
      })
    }

    // ── Retell webhook events ────────────────────────────────
    // Retell POSTs here with { event, call } when configured as
    // the agent's webhook_url. The call object carries metadata
    // (client_id, agency_id) injected at call-creation time.
    const event = body.event || body.type || ''
    const call = body.call || body.data || {}
    const callId: string = call.call_id || call.id || ''
    const callerPhone: string = call.from_number || ''
    const metadata = { ...(call.metadata || {}), ...(body.metadata || {}) }
    const clientId: string = metadata.client_id || call.client_id || ''
    const agencyId: string = metadata.agency_id || call.agency_id || ''

    // ── call_started / call_created ──
    if ((event === 'call_started' || event === 'call_created') && callId) {
      if (clientId && agencyId) {
        const caller = await identifyCaller(sb, clientId, callerPhone)
        const built = await buildOnboardingSystemPrompt({
          sb,
          clientId,
          agencyId,
          callerName: caller.name,
          callerPhone,
        })

        // Upsert the recipient row so ClientDetailPage can flip into
        // "live call" mode during the call.
        const { data: existing } = caller.recipient_id
          ? await sb.from('koto_onboarding_recipients').select('id').eq('id', caller.recipient_id).maybeSingle()
          : { data: null as any }

        if (existing) {
          await sb
            .from('koto_onboarding_recipients')
            .update({
              call_id: callId,
              status: 'in_progress',
              last_active_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        } else {
          await sb.from('koto_onboarding_recipients').insert({
            agency_id: agencyId,
            client_id: clientId,
            name: caller.name || null,
            phone: callerPhone || null,
            source: 'voice',
            status: 'in_progress',
            call_id: callId,
            last_active_at: new Date().toISOString(),
          })
        }

        // Dashboard notification
        await createNotification(
          sb,
          agencyId,
          'onboarding_call_started',
          '📞 Onboarding call started',
          `${caller.name ? caller.name + ' is' : 'Someone is'} calling about ${await clientDisplayName(sb, clientId)} — ${built.missingCount} questions remaining`,
          `/clients/${clientId}`,
          '📞',
          { client_id: clientId, call_id: callId, caller_phone: callerPhone },
        )

        return NextResponse.json({
          received: true,
          general_prompt: built.prompt,
          begin_message: built.beginMessage,
        })
      }
      return NextResponse.json({ received: true })
    }

    // ── function_call / tool invocation ──
    // Retell sends this when the agent calls save_answer during the
    // conversation. We immediately route it through the normal
    // autosave action so vault writes, notifications, and the live
    // field diff on ClientDetailPage all fire as a side effect.
    if ((event === 'function_call' || event === 'tool_call' || body.type === 'function_call')) {
      const fnName = body.name || body.function?.name || call.name
      const rawArgs = body.arguments || body.function?.arguments || call.arguments || {}
      const args = typeof rawArgs === 'string' ? safeJson(rawArgs) : rawArgs

      if (fnName === 'save_answer' && clientId && agencyId && args?.field) {
        const field = String(args.field).trim()
        const answer = String(args.answer ?? '').trim()
        const confidence = typeof args.confidence === 'number' ? args.confidence : 75

        // Route through the normal autosave so FIELD_MAP + jsonb
        // spillover + vault + audit all run.
        try {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'}/api/onboarding`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'autosave',
              client_id: clientId,
              agency_id: agencyId,
              form_data: { [field]: answer },
              saved_at: new Date().toISOString(),
            }),
          })
        } catch { /* silent — we'll still record in recipients */ }

        // Also track on the recipient row so multi-caller attribution
        // shows up in the client detail page.
        const { data: recipient } = await sb
          .from('koto_onboarding_recipients')
          .select('id, answers, fields_captured')
          .eq('call_id', callId)
          .eq('client_id', clientId)
          .maybeSingle()

        const nowIso = new Date().toISOString()
        const answerEntry = { answer, confidence, call_id: callId, answered_at: nowIso }

        if (recipient) {
          const nextAnswers = { ...(recipient.answers || {}), [field]: answerEntry }
          const nextCaptured = { ...(recipient.fields_captured || {}), [field]: true }
          await sb
            .from('koto_onboarding_recipients')
            .update({
              answers: nextAnswers,
              fields_captured: nextCaptured,
              last_active_at: nowIso,
            })
            .eq('id', recipient.id)
        } else {
          await sb.from('koto_onboarding_recipients').insert({
            agency_id: agencyId,
            client_id: clientId,
            source: 'voice',
            status: 'in_progress',
            call_id: callId,
            phone: callerPhone || null,
            answers: { [field]: answerEntry },
            fields_captured: { [field]: true },
            last_active_at: nowIso,
          })
        }

        return NextResponse.json({ success: true, message: `Saved ${field}` })
      }

      return NextResponse.json({ received: true, handled: false })
    }

    // ── call_ended ──
    if (event === 'call_ended' && callId && clientId && agencyId) {
      const { data: recipient } = await sb
        .from('koto_onboarding_recipients')
        .select('id, name, answers, fields_captured')
        .eq('call_id', callId)
        .eq('client_id', clientId)
        .maybeSingle()

      const fieldsCaptured = recipient?.fields_captured
        ? Object.keys(recipient.fields_captured).length
        : 0

      // Reload client state to see what's still missing after the call.
      const { data: client } = await sb
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle()

      const { missing } = computeMissingFields(client)
      const missingPriority1 = missing.filter((m) => m.priority === 1)
      const clientName = client?.name || 'the client'
      const callerName = recipient?.name || 'Someone'

      // Flip the recipient row to complete if we captured anything,
      // abandoned otherwise.
      if (recipient) {
        await sb
          .from('koto_onboarding_recipients')
          .update({
            status: fieldsCaptured > 0 ? 'complete' : 'abandoned',
            last_active_at: new Date().toISOString(),
          })
          .eq('id', recipient.id)
      }

      // Dashboard notification — user's spec explicitly wants NO SMS,
      // only bell notifications.
      if (missingPriority1.length === 0) {
        await createNotification(
          sb,
          agencyId,
          'onboarding_call_complete',
          '✅ Voice onboarding complete',
          `${callerName} completed onboarding for ${clientName} — ${fieldsCaptured} fields captured`,
          `/clients/${clientId}`,
          '📞',
          { client_id: clientId, fields_captured: fieldsCaptured, call_id: callId },
        )
      } else {
        await createNotification(
          sb,
          agencyId,
          'onboarding_call_partial',
          '📞 Onboarding call ended — action needed',
          `${callerName} covered ${fieldsCaptured} fields for ${clientName}. ${missingPriority1.length} priority field${missingPriority1.length === 1 ? '' : 's'} still missing.`,
          `/clients/${clientId}`,
          '⚠️',
          {
            client_id: clientId,
            fields_captured: fieldsCaptured,
            missing_fields: missingPriority1.map((f) => f.field),
            call_id: callId,
          },
        )
      }

      return NextResponse.json({ received: true, fields_captured: fieldsCaptured })
    }

    // Unhandled event — 200 so Retell doesn't retry
    return NextResponse.json({ received: true, handled: false })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

async function clientDisplayName(sb: any, clientId: string): Promise<string> {
  try {
    const { data } = await sb.from('clients').select('name').eq('id', clientId).maybeSingle()
    return data?.name || 'the client'
  } catch {
    return 'the client'
  }
}

function safeJson(s: string): any {
  try { return JSON.parse(s) } catch { return {} }
}
