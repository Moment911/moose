import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications'

// ─────────────────────────────────────────────────────────────
// Voice onboarding (PIN model)
//
// A client is assigned a phone number + 4-digit PIN from the
// onboarding phone pool. They call the number, the Retell agent
// greets them and asks for the PIN, calls the verify_pin tool,
// and — if valid — walks through the remaining onboarding
// questions. save_answer tool writes each answer through the
// normal autosave pipeline.
//
// Resolution chain (dialed number → client):
//   1. koto_onboarding_phone_pool.phone_number (exact + normalized
//      match) gives us assigned_to_client_id.
//   2. On function_call (save_answer / save_flag) we look up the
//      recipient row by call_id — the first event of the call
//      persisted that mapping.
//   3. clients.onboarding_pin is the source of truth for PIN
//      verification.
//
// Actions on this route:
//   - create_onboarding_agent  one-time per-agency setup
//   - get_agent_prompt         render the prompt for a client
//   - test_lookup              debug helper for AgencySettings
//   - (no action)              Retell webhook event handler
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
// Onboarding question set — canonical, priority-ordered list
// shared between the voice agent and the missing-fields email.
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
// Phone normalization — strip everything that isn't a digit and
// drop the leading US country code so we can compare formats like
// "+1 (305) 555-0100" and "3055550100" as equal.
// ─────────────────────────────────────────────────────────────
function normalizePhone(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '').replace(/^1/, '')
}

// ─────────────────────────────────────────────────────────────
// resolveCallContext — look up agency + client from call data.
//
// PIN model: the dialed number (to_number) is the primary key.
// It's assigned to exactly one client in koto_onboarding_phone_pool,
// which gives us both agency_id and client_id. Subsequent events
// for the same call resolve via the recipient row by call_id.
// ─────────────────────────────────────────────────────────────
async function resolveCallContext(args: {
  sb: any
  callId?: string | null
  toNumber: string
  metadataAgencyId?: string | null
  metadataClientId?: string | null
}): Promise<{
  agency_id: string | null
  client_id: string | null
  source: 'metadata' | 'call_id_lookup' | 'pool_lookup' | 'none'
}> {
  const { sb, callId, toNumber, metadataAgencyId, metadataClientId } = args

  // 1. Metadata — trust if present.
  if (metadataClientId && metadataAgencyId) {
    return { agency_id: metadataAgencyId, client_id: metadataClientId, source: 'metadata' }
  }

  // 2. Call-id lookup — first event of the call persisted the
  // mapping to the recipient row, subsequent events read it back.
  if (callId) {
    const { data: existing } = await sb
      .from('koto_onboarding_recipients')
      .select('client_id, agency_id')
      .eq('call_id', callId)
      .maybeSingle()
    if (existing?.client_id && existing?.agency_id) {
      return {
        agency_id: existing.agency_id,
        client_id: existing.client_id,
        source: 'call_id_lookup',
      }
    }
  }

  // 3. Pool lookup by dialed number. Match both the raw E.164 form
  // and the normalized 10-digit form for safety.
  const normalizedTo = normalizePhone(toNumber)
  if (!normalizedTo) {
    return { agency_id: null, client_id: null, source: 'none' }
  }

  const candidates = [
    toNumber,
    `+1${normalizedTo}`,
    `1${normalizedTo}`,
    normalizedTo,
  ].filter((v, i, a) => !!v && a.indexOf(v) === i)

  const { data: pool } = await sb
    .from('koto_onboarding_phone_pool')
    .select('assigned_to_client_id, assigned_to_agency_id, status, phone_number')
    .in('phone_number', candidates)
    .eq('status', 'assigned')
    .maybeSingle()

  if (pool?.assigned_to_client_id && pool?.assigned_to_agency_id) {
    return {
      agency_id: pool.assigned_to_agency_id,
      client_id: pool.assigned_to_client_id,
      source: 'pool_lookup',
    }
  }

  return { agency_id: null, client_id: null, source: 'none' }
}

// ─────────────────────────────────────────────────────────────
// PIN verification — invoked by the Retell verify_pin tool.
// Validates the entered PIN against clients.onboarding_pin for
// the client associated with the dialed number.
// ─────────────────────────────────────────────────────────────
async function verifyPin(args: {
  sb: any
  dialedNumber: string
  enteredPin: string
  callId: string
  callerPhone: string
  rawBody?: any
}): Promise<{
  valid: boolean
  reason?: string
  message?: string
  client_id?: string
  agency_id?: string
  client_name?: string
  caller_name?: string | null
}> {
  const { sb, dialedNumber, enteredPin, callId, callerPhone, rawBody } = args

  // ── Debug: log what we received on the verify_pin tool call ──
  // eslint-disable-next-line no-console
  console.log(
    '[verify_pin] pin:', enteredPin,
    'phone_number:', dialedNumber,
    'caller_phone:', callerPhone,
    'call_id:', callId || rawBody?.call_id || null,
  )

  // Explicit pool lookup for diagnostics — Retell sometimes sends
  // the number as `+15613630695`, sometimes as `15613630695`, and
  // sometimes in display form. Try the raw, `+1`-prefixed, and
  // 10-digit variants in parallel to see which one the pool row
  // actually matches.
  const normalizedTo = (dialedNumber || '').replace(/\D/g, '').replace(/^1/, '')
  const poolCandidates = [
    dialedNumber,
    `+1${normalizedTo}`,
    `1${normalizedTo}`,
    normalizedTo,
  ].filter((v, i, a) => !!v && a.indexOf(v) === i)

  const { data: pool } = await sb
    .from('koto_onboarding_phone_pool')
    .select('*')
    .in('phone_number', poolCandidates)
    .maybeSingle()

  // eslint-disable-next-line no-console
  console.log('[verify_pin] pool lookup candidates:', JSON.stringify(poolCandidates))
  // eslint-disable-next-line no-console
  console.log('[verify_pin] pool lookup result:', JSON.stringify(pool))

  const resolved = await resolveCallContext({ sb, callId, toNumber: dialedNumber })
  if (!resolved.client_id) {
    // eslint-disable-next-line no-console
    console.log('[verify_pin] resolveCallContext returned no client_id — resolved:', JSON.stringify(resolved))
    return { valid: false, reason: 'number_not_assigned', message: 'This number is not currently active.' }
  }

  const { data: client } = await sb
    .from('clients')
    .select('id, name, owner_name, onboarding_pin, onboarding_phone_expires_at, onboarding_status')
    .eq('id', resolved.client_id)
    .maybeSingle()

  // eslint-disable-next-line no-console
  console.log(
    '[verify_pin] client pin:', (client as any)?.onboarding_pin,
    'entered pin:', enteredPin,
    'client_id:', resolved.client_id,
    'onboarding_status:', (client as any)?.onboarding_status,
  )

  if (!client) {
    return { valid: false, reason: 'client_not_found' }
  }
  if (client.onboarding_phone_expires_at && new Date(client.onboarding_phone_expires_at) < new Date()) {
    return { valid: false, reason: 'session_expired', message: 'This session has expired. Please contact your agency for a new link.' }
  }
  if (client.onboarding_status === 'complete') {
    return { valid: false, reason: 'already_complete', message: 'This onboarding is already complete. Thank you!' }
  }
  const pin = String(enteredPin || '').trim()
  if (!client.onboarding_pin || client.onboarding_pin !== pin) {
    return { valid: false, reason: 'wrong_pin', message: "That PIN doesn't match. Please try again." }
  }

  // Update the recipient row so the caller's phone is attributed
  // to this client going forward.
  await sb
    .from('koto_onboarding_recipients')
    .update({
      phone: callerPhone || null,
      status: 'in_progress',
      opened_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    })
    .eq('call_id', callId)

  return {
    valid: true,
    client_id: resolved.client_id,
    agency_id: resolved.agency_id || undefined,
    client_name: client.name || undefined,
    caller_name: client.owner_name || null,
  }
}

// ─────────────────────────────────────────────────────────────
// Build the Retell system prompt for a specific client.
// ─────────────────────────────────────────────────────────────
async function buildOnboardingSystemPrompt(args: {
  sb: any
  clientId: string
  agencyId: string
  pinVerified?: boolean
  callerName?: string | null
}): Promise<{ prompt: string; beginMessage: string; missingCount: number; answeredCount: number }> {
  const { sb, clientId, agencyId, pinVerified, callerName } = args

  const [{ data: client }, { data: agency }] = await Promise.all([
    sb.from('clients').select('*').eq('id', clientId).maybeSingle(),
    sb.from('agencies').select('id, name, brand_name').eq('id', agencyId).maybeSingle(),
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

  const prompt = `You are an onboarding specialist calling on behalf of ${agencyName}. You are warm, professional, and efficient. Your goal is to collect information about ${clientName} to help the agency do their best work.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — MANDATORY: PIN VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The VERY FIRST thing you do after greeting the caller is ask them for their 4-digit onboarding PIN. They received it in their onboarding email or on their onboarding page.

Say: "Before we get started, can you read me the 4-digit PIN on your onboarding page?"

When the caller says the PIN, call the verify_pin tool immediately with:
  { "pin": "1234" }

If verify_pin returns valid=true, greet them by name if you have it and start the questions.
If verify_pin returns valid=false with reason='wrong_pin', say: "Hmm, that PIN doesn't match what I have. Could you read it to me one more time?" and try again. After 3 failed attempts say: "I'm having trouble verifying that PIN. Please double check the 4 digits on your onboarding page and call back. Thanks!" and end the call.
If verify_pin returns reason='session_expired' or 'already_complete', read the message back to the caller and end the call warmly.

Do NOT ask any onboarding questions until verify_pin has returned valid=true.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AFTER PIN IS VERIFIED — MANDATORY TRANSITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

As soon as verify_pin returns valid=true, say this line EXACTLY before asking any questions:

"Perfect. Before we dive in, just a heads up — everything you tell me will appear live in your onboarding document. If you have the link open, you can watch your answers populate in real time as we go. Now let's get started."

Then immediately ask the first question from the QUESTIONS TO ASK list below. Do not skip this transition line even if the caller sounds rushed — it takes 8 seconds and sets the whole tone.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUSINESS CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${welcomeStatement}
${classificationLine}
${pinVerified && callerName ? `You are speaking with ${callerName}.` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALREADY ANSWERED (do NOT ask these again)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${answeredBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUESTIONS TO ASK (in order, ask only these)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${questionsBlock}
${remainingCount > 0 ? `\n…and ${remainingCount} more questions if time allows.` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONVERSATION STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Be conversational, not robotic. Don't read questions like a survey.
- After each answer, ACKNOWLEDGE briefly before moving on. Rotate through these acknowledgments — never use the same one twice in a row:
  "Perfect, thank you."
  "Great, got it."
  "Love that, thank you."
  "That's really helpful."
  "Makes sense, thanks."
  "Excellent, noted."
  "Got it, that's useful."
  "Awesome, thanks for sharing that."
- Vary your sentence structure. Don't start every response with "Great" or every question with "And".
- If they say they don't know something, say "No problem, someone else from your team can provide that later" and call save_flag with reason='needs_followup'.
- Save each answer immediately using the save_answer tool after your acknowledgment.
- Confirm tricky answers by repeating them back briefly: "Got it, so your primary service is X — is that right?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VOICE COMMAND HANDLING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Listen for these caller commands and handle them naturally:

"skip this" / "next" / "move on"
  → Call save_flag with reason='skipped'. Say: "No problem, we can come back to that. Moving on…"

"I don't know" / "not sure" / "I'll have to check"
  → Call save_flag with reason='needs_followup'. Say: "That's totally fine. I'll flag that one — you or a teammate can fill it in later. Next question…"

"let me correct that" / "wait that's wrong" / "actually"
  → Re-ask the previous question. Say: "Of course! Let me ask that again."
  → When they answer again, call save_answer with the corrected value for the same field. The system keeps the latest.

"someone else will answer this" / "a colleague will handle this"
  → Call save_flag with reason='colleague_will_answer'. Say: "Got it, I'll leave that for a teammate. They can call this same number with the same PIN. Moving on…"

"how much is left?" / "how many questions?" / "are we almost done?"
  → Tell them how many questions remain out of the total.

"what have we covered?" / "read back my answers"
  → Briefly summarize the fields captured so far.

"I'm done for now" / "I need to go"
  → Wrap up warmly. Say: "Perfect! Your onboarding link stays active — you or anyone on your team can call this same number or visit the link to add more. Our team will review everything and be in touch. Have a great day!"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRAP UP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When you've covered all questions: "That's everything I need for now. I'll pass this along to the team. Thanks so much for your time — have a great day!"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOOLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

verify_pin(pin: string) — MUST be called first, before any questions.
save_answer(field: string, answer: string, confidence: number) — called after every valid answer.
save_flag(field: string, reason: 'skipped'|'needs_followup'|'colleague_will_answer') — called when the caller skips or defers a question.

NEVER ask for passwords, payment info, credit cards, SSNs, or sensitive credentials. If the caller offers them, politely redirect to business questions.`

  // New verbose intro — explains the live-doc sync + directs the
  // caller to the onboarding link before the PIN prompt. Same text
  // for every call variant; the post-PIN transition line (injected
  // into the system prompt above) handles the "welcome back"
  // personalization after verify_pin returns valid=true.
  const beginMessage = `Hi! Welcome to ${agencyName}'s onboarding. My name is Alex and I'll be collecting some information about your business today — this usually takes about 10 to 15 minutes. Here's how it works: I'll ask you a series of questions, and as you answer, your responses will automatically appear in your onboarding document in real time. You can follow along at any time by visiting the link that was sent to you — you'll actually see the answers populate as we talk. If you don't know the answer to something, just say 'skip it' and we'll move on — someone else on your team can fill that in later by calling this same number or visiting the link. Ready to get started? Go ahead and tell me your 4-digit PIN and we'll begin.`

  return {
    prompt,
    beginMessage,
    missingCount: missing.length,
    answeredCount: answered.length,
  }
}

// ─────────────────────────────────────────────────────────────
// buildInboundDynamicVariables
//
// Single source of truth for the dynamic variables returned by
// every webhook path (call_inbound pre-call hook AND call_started
// notification). Given a dialed number, resolves agency + client
// via the pool, builds the full system prompt + begin_message,
// and returns a string-only object Retell can substitute into
// {{placeholders}}.
//
// Keys returned:
//   system_prompt     — entire agent prompt (what the LLM sees)
//   begin_message     — exact opening line the agent speaks first
//   agency_name       — for any {{agency_name}} references
//   client_name       — for any {{client_name}} references
//   first_name        — owner first name if known, else "there"
//   already_answered  — newline-joined "field: value" lines
//   questions_to_ask  — newline-joined "1. Question [field: xyz]"
//   missing_count     — string count for "how much is left"
//   resolved_source   — metadata debug flag
// ─────────────────────────────────────────────────────────────
async function buildInboundDynamicVariables(args: {
  sb: any
  toNumber: string
}): Promise<{
  variables: Record<string, string>
  agency_id: string | null
  client_id: string | null
}> {
  const { sb, toNumber } = args

  const resolved = await resolveCallContext({ sb, toNumber })

  let agencyDisplayName = 'our onboarding team'
  let clientDisplayName = 'your business'
  let firstNameDisplay = 'there'
  let missingCount = 0
  let systemPromptText = ''
  let beginMessageText = `Hi! Before we get started, could you read me the 4-digit PIN from your onboarding page?`
  let alreadyAnsweredText = ''
  let questionsToAskText = ''

  if (resolved.agency_id && resolved.client_id) {
    const [agencyRes, clientRes] = await Promise.all([
      sb.from('agencies').select('name, brand_name').eq('id', resolved.agency_id).maybeSingle(),
      sb.from('clients').select('*').eq('id', resolved.client_id).maybeSingle(),
    ])
    const agency = agencyRes.data as any
    const client = clientRes.data as any

    if (agency) {
      agencyDisplayName = agency.brand_name || agency.name || agencyDisplayName
    }
    if (client) {
      clientDisplayName = client.name || clientDisplayName
      if (client.owner_name) {
        firstNameDisplay = String(client.owner_name).split(/\s+/)[0] || firstNameDisplay
      }
      const { missing, answered } = computeMissingFields(client)
      missingCount = missing.length

      alreadyAnsweredText = answered.length
        ? answered.map((a) => `- ${a.field}: ${String(a.value).slice(0, 120)}`).join('\n')
        : 'Nothing answered yet — start from the beginning.'

      const topMissing = missing.slice(0, 8)
      questionsToAskText = topMissing.length
        ? topMissing.map((q, i) => `${i + 1}. ${q.question} [field: ${q.field}]`).join('\n')
        : 'All priority questions are already answered — just confirm anything that sounds outdated and wrap up.'

      // Build the full system prompt via the existing builder so
      // both the notification webhook and the pre-call webhook
      // return the exact same prompt string.
      const built = await buildOnboardingSystemPrompt({
        sb,
        clientId: resolved.client_id,
        agencyId: resolved.agency_id,
      })
      systemPromptText = built.prompt
      beginMessageText = built.beginMessage
    }
  }

  const variables: Record<string, string> = {
    system_prompt: systemPromptText || `You are an onboarding specialist for ${agencyDisplayName}. Ask the caller for their 4-digit PIN and call the verify_pin tool. If verification fails, politely end the call.`,
    begin_message: beginMessageText,
    agency_name: agencyDisplayName,
    client_name: clientDisplayName,
    first_name: firstNameDisplay,
    already_answered: alreadyAnsweredText,
    questions_to_ask: questionsToAskText,
    missing_count: String(missingCount),
    resolved_source: resolved.source,
  }

  return {
    variables,
    agency_id: resolved.agency_id,
    client_id: resolved.client_id,
  }
}

// Tool definitions for Retell.
const VERIFY_PIN_TOOL = {
  type: 'function',
  function: {
    name: 'verify_pin',
    description: 'Verify the caller\'s 4-digit onboarding PIN before any questions are asked. Must be called before save_answer or save_flag.',
    parameters: {
      type: 'object',
      properties: {
        pin: { type: 'string', description: 'The 4-digit PIN the caller read aloud' },
      },
      required: ['pin'],
    },
  },
}
const SAVE_ANSWER_TOOL = {
  type: 'function',
  function: {
    name: 'save_answer',
    description: 'Save a field answer from the onboarding conversation. Only call after verify_pin has returned valid=true.',
    parameters: {
      type: 'object',
      properties: {
        field: { type: 'string', description: "Field name (e.g. 'primary_service', 'marketing_budget')" },
        answer: { type: 'string', description: "The caller's answer" },
        confidence: { type: 'number', description: 'Your confidence in this answer (0-100)' },
      },
      required: ['field', 'answer'],
    },
  },
}
const SAVE_FLAG_TOOL = {
  type: 'function',
  function: {
    name: 'save_flag',
    description: 'Flag a field for follow-up when the caller skips it, defers to a colleague, or doesn\'t know the answer.',
    parameters: {
      type: 'object',
      properties: {
        field: { type: 'string', description: 'The field being flagged' },
        reason: { type: 'string', description: "'skipped' | 'needs_followup' | 'colleague_will_answer'" },
      },
      required: ['field', 'reason'],
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

    // ── Debug logging ────────────────────────────────────────
    // Logs every non-action POST so we can see exactly what
    // shape Retell is sending. Visible in Vercel function logs.
    // Skips action-style calls (create_onboarding_agent etc)
    // since those aren't webhooks and would be noise.
    if (!action) {
      try {
        const logSnapshot = {
          event: body.event || body.event_type || null,
          call_inbound_present: !!body.call_inbound,
          call_id: body.call_id || body.call?.call_id || body.call?.id || null,
          from_number: body.from_number || body.call?.from_number || body.call_inbound?.from_number || null,
          to_number: body.to_number || body.call?.to_number || body.call_inbound?.to_number || null,
          fn_name: body.name || body.function?.name || body.call?.name || null,
          top_level_keys: Object.keys(body),
        }
        // eslint-disable-next-line no-console
        console.log('[onboarding/voice webhook] received:', JSON.stringify(logSnapshot))
        // Full body dump — truncated at 2k so a runaway transcript
        // can't blow up the function log. Lets us see every field
        // Retell actually sends without guessing at names.
        // eslint-disable-next-line no-console
        console.log('[voice webhook] full body:', JSON.stringify(body).slice(0, 2000))
      } catch { /* never fail a webhook over logging */ }
    }

    // ── Action: create_onboarding_agent ──────────────────────
    if (action === 'create_onboarding_agent') {
      const { agency_id, voice_id } = body
      if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })

      const { data: agency } = await sb
        .from('agencies')
        .select('id, name, brand_name, onboarding_agent_id')
        .eq('id', agency_id)
        .maybeSingle()
      if (!agency) return NextResponse.json({ error: 'Agency not found' }, { status: 404 })

      const agencyName = agency.brand_name || agency.name || 'Your Agency'
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'}/api/onboarding/voice`

      // Minimal Retell-side template. The entire system prompt
      // is injected as a single {{system_prompt}} variable at call
      // time (via dynamic_variables on call_inbound / call_started).
      // Same for the opening line via {{begin_message}}. This keeps
      // the Retell dashboard config trivial — one agent serves
      // every agency and every client.
      const templatePrompt = `{{system_prompt}}`

      const retellConfig: any = {
        agent_name: `Koto Onboarding Assistant`,
        voice_id: voice_id || '11labs-Marissa',
        response_engine: { type: 'retell-llm', llm_id: null },
        language: 'en-US',
        general_prompt: templatePrompt,
        begin_message: `{{begin_message}}`,
        // Post-call notification events (call_started/call_ended)
        webhook_url: webhookUrl,
        // Pre-call synchronous hook — Retell POSTs here with
        // { call_inbound: { from_number, to_number, agent_id } }
        // and expects dynamic_variables back within ~3s.
        inbound_dynamic_variables_webhook_url: webhookUrl,
        enable_backchannel: true,
        backchannel_frequency: 0.7,
        interruption_sensitivity: 0.75,
        general_tools: [VERIFY_PIN_TOOL, SAVE_ANSWER_TOOL, SAVE_FLAG_TOOL],
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

    // ── Action: update_existing_agent ────────────────────────
    // PATCHes a live Retell agent to match the current code's
    // begin_message and general_prompt templates. Use this when
    // the code's intro text has drifted from what's in the Retell
    // dashboard — instead of deleting + recreating the agent,
    // just PATCH the two fields that matter.
    //
    // Resolves the agent id from (in order):
    //   1. body.agent_id          — explicit override
    //   2. process.env.RETELL_ONBOARDING_AGENT_ID
    //   3. agencies.onboarding_agent_id (if agency_id in body)
    if (action === 'update_existing_agent') {
      const { agency_id } = body
      let targetAgentId: string | null =
        body.agent_id ||
        process.env.RETELL_ONBOARDING_AGENT_ID ||
        null

      if (!targetAgentId && agency_id) {
        const { data: agency } = await sb
          .from('agencies')
          .select('onboarding_agent_id')
          .eq('id', agency_id)
          .maybeSingle()
        targetAgentId = agency?.onboarding_agent_id || null
      }

      if (!targetAgentId) {
        return NextResponse.json({
          error: 'No agent id — pass agent_id, set RETELL_ONBOARDING_AGENT_ID env var, or pass agency_id with a configured onboarding_agent_id',
        }, { status: 400 })
      }

      // The new verbose intro — {{agency_name}} is substituted by
      // Retell at call time via the dynamic variables returned
      // from the inbound webhook. Keep this in sync with the
      // beginMessage interpolation inside buildOnboardingSystemPrompt.
      const NEW_BEGIN_MESSAGE = `Hi! Welcome to {{agency_name}}'s onboarding. My name is Alex and I'll be collecting some information about your business today — this usually takes about 10 to 15 minutes. Here's how it works: I'll ask you a series of questions, and as you answer, your responses will automatically appear in your onboarding document in real time. You can follow along at any time by visiting the link that was sent to you — you'll actually see the answers populate as we talk. If you don't know the answer to something, just say 'skip it' and we'll move on — someone else on your team can fill that in later by calling this same number or visiting the link. Ready to get started? Go ahead and tell me your 4-digit PIN and we'll begin.`

      try {
        const res = await fetch(`${RETELL_BASE}/update-agent/${targetAgentId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${RETELL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            begin_message: NEW_BEGIN_MESSAGE,
            general_prompt: `{{system_prompt}}`,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          return NextResponse.json({
            ok: false,
            error: data?.error_message || data?.message || `Retell ${res.status}`,
            retell_response: data,
          }, { status: 500 })
        }
        return NextResponse.json({
          ok: true,
          agent_id: targetAgentId,
          updated: {
            begin_message: true,
            general_prompt: true,
          },
          retell_response: data,
        })
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Retell PATCH failed' }, { status: 500 })
      }
    }

    // ── Action: get_agent_prompt ─────────────────────────────
    if (action === 'get_agent_prompt') {
      const { client_id, agency_id } = body
      if (!client_id || !agency_id) {
        return NextResponse.json({ error: 'client_id and agency_id required' }, { status: 400 })
      }
      const built = await buildOnboardingSystemPrompt({ sb, clientId: client_id, agencyId: agency_id })
      return NextResponse.json({
        ok: true,
        general_prompt: built.prompt,
        begin_message: built.beginMessage,
        missing_count: built.missingCount,
        answered_count: built.answeredCount,
      })
    }

    // ── Action: test_lookup ──────────────────────────────────
    // Debug helper: given a dialed number, return the resolved
    // agency + client + pool entry. No side effects.
    if (action === 'test_lookup') {
      const { to_number } = body
      const resolved = await resolveCallContext({ sb, toNumber: to_number || '' })

      let agency: any = null
      let client: any = null
      let pool: any = null
      if (resolved.agency_id) {
        const { data } = await sb.from('agencies').select('id, name, brand_name').eq('id', resolved.agency_id).maybeSingle()
        agency = data
      }
      if (resolved.client_id) {
        const { data } = await sb
          .from('clients')
          .select('id, name, onboarding_phone, onboarding_phone_display, onboarding_pin, onboarding_phone_expires_at')
          .eq('id', resolved.client_id)
          .maybeSingle()
        client = data
        const { data: p } = await sb
          .from('koto_onboarding_phone_pool')
          .select('phone_number, status, expires_at, telnyx_phone_id')
          .eq('assigned_to_client_id', resolved.client_id)
          .eq('status', 'assigned')
          .maybeSingle()
        pool = p
      }

      return NextResponse.json({
        ok: true,
        resolved,
        agency,
        client,
        pool,
        normalized: normalizePhone(to_number || ''),
      })
    }

    // ─────────────────────────────────────────────────────────
    // Inbound webhook — synchronous pre-call hook from Retell.
    //
    // Wired up via `inbound_dynamic_variables_webhook_url` in
    // create_onboarding_agent. Retell POSTs here BEFORE the call
    // connects with { call_inbound: { from_number, to_number,
    // agent_id } } and expects us to return dynamic variables
    // within ~3s. Those variables are substituted into the
    // agent's begin_message and general_prompt templates so the
    // greeting can include the correct agency name per dialed
    // number — no static dashboard config, one agent serves every
    // agency.
    //
    // This is a different mechanism from the notification webhook
    // events below (call_started / call_ended). Those fire AFTER
    // the call connects and their response is ignored by Retell.
    // ─────────────────────────────────────────────────────────
    if (body.call_inbound) {
      const inboundFromNumber: string = body.call_inbound.from_number || ''
      const inboundToNumber: string = body.call_inbound.to_number || ''

      // eslint-disable-next-line no-console
      console.log('[call_inbound] fired — to:', inboundToNumber, 'from:', inboundFromNumber)

      const dynVars = await buildInboundDynamicVariables({
        sb,
        toNumber: inboundToNumber,
      })

      // Per Retell's inbound dynamic variables webhook spec, the
      // response must be a FLAT { dynamic_variables, metadata }
      // object. No outer call_inbound wrapper — wrapping it
      // causes Retell to ignore the variables entirely and fall
      // back to whatever static strings are on the LLM resource.
      // All values must be strings; Retell string-coerces them
      // before substituting into {{placeholder}} tokens.
      const response = {
        dynamic_variables: dynVars.variables,
        metadata: {
          agency_id: dynVars.agency_id || '',
          client_id: dynVars.client_id || '',
          dialed_number: inboundToNumber,
        },
      }

      // eslint-disable-next-line no-console
      console.log('[call_inbound] response:', JSON.stringify(response).slice(0, 2000))

      return NextResponse.json(response)
    }

    // ─────────────────────────────────────────────────────────
    // Retell notification webhook events — no `action` field and
    // no `call_inbound` means Retell is firing a post-connect
    // event (call_started, call_ended, function_call). The
    // response from these is NOT used to modify the call — they
    // are notifications only.
    // ─────────────────────────────────────────────────────────
    const event = body.event || body.type || ''
    const call = body.call || body.data || {}
    const callId: string = call.call_id || call.id || ''
    const callerPhone: string = call.from_number || ''
    const dialedNumber: string = call.to_number || ''
    const metadata = { ...(call.metadata || {}), ...(body.metadata || {}) }

    const resolved = await resolveCallContext({
      sb,
      callId,
      toNumber: dialedNumber,
      metadataAgencyId: metadata.agency_id || call.agency_id || null,
      metadataClientId: metadata.client_id || call.client_id || null,
    })
    const clientId: string = resolved.client_id || ''
    const agencyId: string = resolved.agency_id || ''

    // ── call_started / call_created ──
    // Notification event — fires AFTER the call has connected and
    // the prompt has already been rendered with the dynamic
    // variables from the call_inbound webhook above. The response
    // body is discarded by Retell, so we only use this path for
    // DB writes + bell notifications.
    if ((event === 'call_started' || event === 'call_created') && callId) {
      if (!clientId || !agencyId) {
        // Nothing to do — if call_inbound above couldn't resolve
        // the number, the caller already heard the fallback
        // greeting from the agent's static template. Return 200
        // so Retell doesn't retry.
        return NextResponse.json({ received: true, orphan: true, reason: 'number_not_in_pool' })
      }

      // Build dynamic variables for this call — mirror the exact
      // same shape the call_inbound handler returns so whichever
      // webhook Retell actually honors ends up with the full
      // per-client system prompt. Safe to call twice per call.
      const dynVars = await buildInboundDynamicVariables({
        sb,
        toNumber: dialedNumber,
      })

      // Create an "invited" recipient row immediately — keyed by
      // call_id so subsequent function_call events can find it
      // without re-resolving from the dialed number each time.
      await sb.from('koto_onboarding_recipients').insert({
        agency_id: agencyId,
        client_id: clientId,
        name: 'Voice Caller',
        email: `voice_${callId}@koto.voice`,
        source: 'voice',
        status: 'in_progress',
        call_id: callId,
        phone: callerPhone || null,
        last_active_at: new Date().toISOString(),
        role_label: 'Voice Caller',
      })

      // Increment total_calls on the pool row
      await sb
        .from('koto_onboarding_phone_pool')
        .update({ total_calls: (call.total_calls || 0) + 1, updated_at: new Date().toISOString() })
        .eq('assigned_to_client_id', clientId)
        .eq('status', 'assigned')

      await createNotification(
        sb,
        agencyId,
        'onboarding_call_started',
        '📞 Onboarding call started',
        `Call from ${callerPhone || 'unknown'} — ${dynVars.variables.missing_count} questions remaining for ${await clientDisplayName(sb, clientId)}`,
        `/clients/${clientId}`,
        '📞',
        { client_id: clientId, call_id: callId, caller_phone: callerPhone, resolved_via: resolved.source },
      )

      // Return the dynamic variables in every shape Retell might
      // honor. If call_started notifications are discarded (my
      // previous theory) this is harmless. If they're honored,
      // the agent gets the full per-client prompt injected here.
      return NextResponse.json({
        received: true,
        llm_dynamic_variables: dynVars.variables,
        dynamic_variables: dynVars.variables,
        call_inbound: {
          dynamic_variables: dynVars.variables,
          metadata: {
            agency_id: agencyId,
            client_id: clientId,
          },
        },
      })
    }

    // ── function_call / tool invocation ──
    //
    // Retell's real payload shape for tool calls (confirmed from
    // live Vercel logs) is:
    //
    //   { "call": { "call_id", "from_number", "to_number" },
    //     "name": "verify_pin",
    //     "args": { "pin": "5377", "phone_number": "..." } }
    //
    // Notably there is NO "event" field and the arguments live
    // under `args` (not `arguments`). We detect a function call by
    // the presence of `body.name` on a non-action, non-call_inbound,
    // non-notification-event request.
    const fnName: string = body.name || body.fn_name || body.function?.name || call.name || ''
    const rawArgs: any = body.args ?? body.arguments ?? body.function?.arguments ?? call.arguments ?? {}
    const fnArgs: any = typeof rawArgs === 'string' ? safeJson(rawArgs) : (rawArgs || {})

    const isFunctionCall =
      !!fnName &&
      (event === 'function_call' ||
        event === 'tool_call' ||
        body.type === 'function_call' ||
        (!event && !body.call_inbound))

    if (isFunctionCall) {
      // eslint-disable-next-line no-console
      console.log(
        '[function_call] fnName:', fnName,
        'toNumber:', dialedNumber,
        'callId:', callId,
        'fnArgs:', JSON.stringify(fnArgs).slice(0, 500),
      )

      // ── verify_pin ──
      // Uses the TO number (what was dialed) for the pool lookup —
      // never trust any phone_number Retell passes in args.
      if (fnName === 'verify_pin') {
        const enteredPin = String(fnArgs.pin ?? fnArgs.pin_code ?? '').trim()
        // eslint-disable-next-line no-console
        console.log('[verify_pin] parsed — pin:', enteredPin, 'toNumber:', dialedNumber, 'fnArgs:', JSON.stringify(fnArgs))
        const result = await verifyPin({
          sb,
          dialedNumber,
          enteredPin,
          callId,
          callerPhone,
          rawBody: body,
        })
        return NextResponse.json(result)
      }

      // ── save_answer ──
      // clientId / agencyId came from resolveCallContext which runs
      // at the top of the webhook event section — it reads
      // body.call.to_number (same source we use for verify_pin) and
      // looks the number up in koto_onboarding_phone_pool. If that
      // resolution failed, log loudly instead of silently bailing.
      if (fnName === 'save_answer') {
        if (!clientId || !agencyId) {
          // eslint-disable-next-line no-console
          console.log('[save_answer] dropped — resolveCallContext failed. toNumber:', dialedNumber, 'resolved:', JSON.stringify(resolved))
          return NextResponse.json({ success: false, error: 'Could not resolve client from dialed number' })
        }
        if (!fnArgs.field) {
          // eslint-disable-next-line no-console
          console.log('[save_answer] dropped — missing field in args:', JSON.stringify(fnArgs))
          return NextResponse.json({ success: false, error: 'Missing field argument' })
        }
        const field = String(fnArgs.field).trim()
        const answer = String(fnArgs.answer ?? '').trim()
        const confidence = typeof fnArgs.confidence === 'number' ? fnArgs.confidence : 85

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
        } catch { /* silent */ }

        const { data: recipient } = await sb
          .from('koto_onboarding_recipients')
          .select('id, answers, fields_captured, fields_completed')
          .eq('call_id', callId)
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
              fields_completed: (recipient.fields_completed || 0) + 1,
              last_active_at: nowIso,
            })
            .eq('id', recipient.id)
        }

        return NextResponse.json({ success: true, message: `Saved ${field}` })
      }

      // ── save_flag ──
      if (fnName === 'save_flag') {
        if (!clientId) {
          // eslint-disable-next-line no-console
          console.log('[save_flag] dropped — resolveCallContext failed. toNumber:', dialedNumber, 'resolved:', JSON.stringify(resolved))
          return NextResponse.json({ success: false, error: 'Could not resolve client from dialed number' })
        }
        if (!fnArgs.field) {
          return NextResponse.json({ success: false, error: 'Missing field argument' })
        }
        const field = String(fnArgs.field).trim()
        const reason = String(fnArgs.reason || 'needs_followup').trim()

        const { data: recipient } = await sb
          .from('koto_onboarding_recipients')
          .select('id, answers')
          .eq('call_id', callId)
          .maybeSingle()

        const nowIso = new Date().toISOString()
        if (recipient) {
          const nextAnswers = {
            ...(recipient.answers || {}),
            [field]: { flag: reason, flagged_at: nowIso, call_id: callId },
          }
          await sb
            .from('koto_onboarding_recipients')
            .update({ answers: nextAnswers, last_active_at: nowIso })
            .eq('id', recipient.id)
        }

        return NextResponse.json({ success: true, message: `Flagged ${field} as ${reason}` })
      }

      return NextResponse.json({ received: true, handled: false })
    }

    // ── call_ended ──
    if (event === 'call_ended' && callId && clientId && agencyId) {
      const { data: recipient } = await sb
        .from('koto_onboarding_recipients')
        .select('id, name, fields_captured, fields_completed')
        .eq('call_id', callId)
        .maybeSingle()

      const fieldsCaptured = recipient?.fields_completed ?? (
        recipient?.fields_captured ? Object.keys(recipient.fields_captured).length : 0
      )

      const { data: client } = await sb.from('clients').select('*').eq('id', clientId).maybeSingle()
      const { missing } = computeMissingFields(client)
      const missingPriority1 = missing.filter((m) => m.priority === 1)
      const clientName = client?.name || 'the client'
      const callerName = recipient?.name || 'Someone'

      if (recipient) {
        await sb
          .from('koto_onboarding_recipients')
          .update({
            status: fieldsCaptured > 0 ? 'complete' : 'abandoned',
            completed_at: new Date().toISOString(),
            last_active_at: new Date().toISOString(),
          })
          .eq('id', recipient.id)
      }

      if (missingPriority1.length === 0) {
        await createNotification(
          sb, agencyId,
          'onboarding_call_complete',
          '✅ Voice onboarding complete',
          `${callerName} completed onboarding for ${clientName} — ${fieldsCaptured} fields captured`,
          `/clients/${clientId}`, '📞',
          { client_id: clientId, fields_captured: fieldsCaptured, call_id: callId },
        )
      } else {
        await createNotification(
          sb, agencyId,
          'onboarding_call_partial',
          '📞 Onboarding call ended — action needed',
          `${callerName} covered ${fieldsCaptured} fields for ${clientName}. ${missingPriority1.length} priority field${missingPriority1.length === 1 ? '' : 's'} still missing.`,
          `/clients/${clientId}`, '⚠️',
          { client_id: clientId, fields_captured: fieldsCaptured, missing_fields: missingPriority1.map((f) => f.field), call_id: callId },
        )
      }

      return NextResponse.json({ received: true, fields_captured: fieldsCaptured })
    }

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
