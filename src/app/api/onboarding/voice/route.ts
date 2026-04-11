import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications'
import { logTokenUsage } from '@/lib/tokenTracker'

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

// Priority tiers:
//   1 = MUST GET — these are the core fields the proposal team
//       can't do without. Ask even if the caller is rushed.
//   2 = IMPORTANT — ask if time allows, skip gracefully if not.
//   3 = NICE TO HAVE — only if the call is going well and
//       there's plenty of time left.
const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  // ── Priority 1: MUST GET ──
  { field: 'welcome_statement', question: "First, I'd love to hear about your business in your own words. What do you do, who do you serve, and what's most important for us to know?", priority: 1 },
  { field: 'owner_name', question: "What's your full name and your role at the company?", priority: 1 },
  { field: 'primary_service', question: "What's your primary service or product?", priority: 1 },
  { field: 'target_customer', question: "Describe your ideal customer. Who do you love working with?", priority: 1 },
  { field: 'city', question: "What city and state are you located in?", priority: 1 },
  { field: 'notes', question: "What are your top goals for the next twelve months?", priority: 1 },

  // ── Priority 2: IMPORTANT ──
  { field: 'phone', question: "What's the best phone number to reach you directly?", priority: 2 },
  { field: 'website', question: "What's your website URL?", priority: 2 },
  { field: 'industry', question: "How would you describe your industry or type of business?", priority: 2 },
  { field: 'num_employees', question: "How many people work for you right now?", priority: 2 },
  { field: 'marketing_budget', question: "How much do you currently spend on marketing each month?", priority: 2 },
  { field: 'crm_used', question: "What C-R-M or software do you use to manage leads and customers?", priority: 2 },
  { field: 'unique_selling_prop', question: "Why should someone choose you over your competitors?", priority: 2 },
  { field: 'referral_sources', question: "Where do most of your best customers come from?", priority: 2 },

  // ── Priority 3: NICE TO HAVE ──
  { field: 'email', question: "What's the best email address for the business?", priority: 3 },
  { field: 'address', question: "What's your business address?", priority: 3 },
  { field: 'year_founded', question: "What year was the business founded?", priority: 3 },
  { field: 'secondary_services', question: "What other services or products do you offer?", priority: 3 },
  { field: 'competitor_1', question: "Who's your biggest competitor?", priority: 3 },
  { field: 'competitor_2', question: "Any other competitors worth mentioning?", priority: 3 },
  { field: 'brand_voice', question: "How would you describe the tone or personality of your brand — more formal and professional, or casual and friendly?", priority: 3 },
  { field: 'tagline', question: "Do you have a tagline or slogan for the business?", priority: 3 },
  { field: 'marketing_channels', question: "What marketing channels are you currently using — Google Ads, social media, email, referrals?", priority: 3 },
  { field: 'avg_deal_size', question: "What's the average value of a typical job or contract?", priority: 3 },
  { field: 'owner_title', question: "And what's your official title at the company?", priority: 3 },
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
// Priority field list used for onboarding state calculation.
// Kept in sync with the spec in the call_inbound handler comments.
const PRIORITY_FIELDS = [
  'welcome_statement', 'owner_name', 'primary_service', 'target_customer',
  'marketing_budget', 'crm_used', 'notes', 'city', 'num_employees',
  'unique_selling_prop', 'referral_sources', 'competitor_1',
] as const

// Human-readable labels for every field the agent might mention.
// Used when listing missing fields conversationally ("we still need
// things like your monthly marketing budget, your ideal customer…")
// instead of leaking field IDs into the caller's ears.
const FIELD_LABELS: Record<string, string> = {
  welcome_statement: 'a description of your business in your own words',
  owner_name: 'your name and role',
  primary_service: 'your primary service or product',
  target_customer: 'your ideal customer',
  marketing_budget: 'your monthly marketing budget',
  crm_used: 'the C-R-M or software you use',
  notes: 'your goals for the next twelve months',
  city: 'your city and state',
  num_employees: 'your team size',
  unique_selling_prop: 'what sets you apart from competitors',
  referral_sources: 'where your best customers come from',
  competitor_1: 'your main competitor',
  secondary_services: 'other services you offer',
  year_founded: 'when the business was founded',
  website: 'your website',
  annual_revenue: 'your approximate annual revenue',
  phone: 'your best contact phone number',
  email: 'your best email',
  industry: 'your industry',
  state: 'the state you operate in',
  avg_deal_size: 'the average value of a typical job',
  marketing_channels: 'which marketing channels you use today',
}

type OnboardingState = 'fresh' | 'partial' | 'nearly_complete'

function computeOnboardingState(client: any): {
  state: OnboardingState
  answeredCount: number
  remainingCount: number
  pct: number
} {
  const total = PRIORITY_FIELDS.length
  const answered = PRIORITY_FIELDS.filter((f) => {
    const v = client?.[f]
    return v && String(v).trim().length > 3
  }).length
  const remaining = total - answered
  const pct = Math.round((answered / total) * 100)
  const state: OnboardingState =
    answered === 0 ? 'fresh' : pct >= 70 ? 'nearly_complete' : 'partial'
  return { state, answeredCount: answered, remainingCount: remaining, pct }
}

// Return top N missing-field labels in plain English (not field ids)
// so the agent can list them conversationally. Prefers the
// FIELD_LABELS map (human-readable sentences) and falls back to a
// prettified version of the field name only when a label is missing.
function topMissingLabels(missing: Array<{ field: string; question: string }>, n = 5): string[] {
  return missing.slice(0, n).map((q) => {
    const label = FIELD_LABELS[q.field]
    if (label) return label
    return q.field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  })
}

async function buildOnboardingSystemPrompt(args: {
  sb: any
  clientId: string
  agencyId: string
}): Promise<{
  prompt: string
  beginMessage: string
  missingCount: number
  answeredCount: number
  state: OnboardingState
  callerFirstName: string
  clientName: string
  agencyName: string
  missingLabels: string[]
  previousCallers: string[]
}> {
  const { sb, clientId, agencyId } = args

  const [{ data: client }, { data: agency }, { data: recipients }] = await Promise.all([
    sb.from('clients').select('*').eq('id', clientId).maybeSingle(),
    sb.from('agencies').select('id, name, brand_name').eq('id', agencyId).maybeSingle(),
    sb.from('koto_onboarding_recipients')
      .select('name, channel, last_active_at')
      .eq('client_id', clientId)
      .order('last_active_at', { ascending: false }),
  ])

  const previousCallers: string[] = Array.from(new Set(
    (recipients || [])
      .filter((r: any) => r.channel === 'voice' && r.name)
      .map((r: any) => String(r.name).trim())
      .filter(Boolean),
  ))

  const agencyName = agency?.brand_name || agency?.name || 'Your Agency'
  const clientName = client?.name || 'the business'

  const { missing, answered } = computeMissingFields(client)
  const { state, answeredCount, remainingCount } = computeOnboardingState(client)

  const callerFirstName = client?.owner_name
    ? String(client.owner_name).trim().split(/\s+/)[0] || ''
    : ''

  // Business context block (optional lines — omitted if empty)
  const welcomeStatement = client?.welcome_statement
    ? `Background (their own words): "${String(client.welcome_statement).slice(0, 600)}"`
    : ''
  const classificationLine = client?.business_classification && typeof client.business_classification === 'object'
    ? `Classification: ${String(client.business_classification.business_model || '').toUpperCase()} | ${client.business_classification.geographic_scope || ''} | ${client.business_classification.business_type || ''}`
    : ''
  const businessContextBlock = [welcomeStatement, classificationLine].filter(Boolean).join('\n') || '(No prior context on file.)'

  const answeredBlock = answered.length
    ? answered.map((a) => `- ${a.field}: ${String(a.value).slice(0, 120)}`).join('\n')
    : '(Nothing answered yet — this is a fresh call.)'

  // Group missing questions by priority tier so the agent knows
  // which ones are must-get vs nice-to-have. The full list is
  // included so a long, engaged call can cover everything — but
  // the tiers make it obvious what to drop if the caller is
  // short on time.
  const mustGet = missing.filter((q) => q.priority === 1)
  const important = missing.filter((q) => q.priority === 2)
  const niceToHave = missing.filter((q) => q.priority === 3)

  const fmtQuestion = (q: { field: string; question: string }, idx: number) =>
    `${idx + 1}. ${q.question} [field: ${q.field}]`

  const tierBlocks: string[] = []
  if (mustGet.length > 0) {
    tierBlocks.push(
      `MUST GET — ask these even if the caller seems rushed:\n${mustGet.map(fmtQuestion).join('\n')}`,
    )
  }
  if (important.length > 0) {
    tierBlocks.push(
      `IMPORTANT — ask these if time allows:\n${important.map(fmtQuestion).join('\n')}`,
    )
  }
  if (niceToHave.length > 0) {
    tierBlocks.push(
      `NICE TO HAVE — only if the call is going well and you have time:\n${niceToHave.map(fmtQuestion).join('\n')}`,
    )
  }
  const questionsBlock = tierBlocks.length
    ? tierBlocks.join('\n\n')
    : '(All priority questions already answered — go straight to wrap-up.)'

  const missingLabels = topMissingLabels(missing, 5)

  // Previous-callers block for the STEP 2A caller-identification
  // guidance. If a different team member is calling in partway
  // through an onboarding, the agent needs to warmly introduce
  // itself and explain what has already been captured.
  const knownOwnerName = client?.owner_name ? String(client.owner_name).trim() : ''
  const knownOwnerFirst = knownOwnerName.split(/\s+/)[0] || ''
  const previousCallersBlock = previousCallers.length > 0
    ? `Previous callers on this onboarding: ${previousCallers.join(', ')}`
    : '(No previous callers — this is the first voice call for this onboarding.)'
  const knownOwnerBlock = knownOwnerName
    ? `Known owner on file: ${knownOwnerName} (first name: ${knownOwnerFirst})`
    : '(No owner name on file yet.)'

  // State-aware transition line — baked in with the correct name
  // conditionals resolved. No Handlebars — plain strings.
  const namePart = callerFirstName ? `, ${callerFirstName}` : ''
  const freshTransition = `"Perfect${namePart}! So here's how this works — I'm going to ask you about ${clientName}, and as you answer, everything populates live in your onboarding document. If you've got that link open you can actually watch it happen, which is kind of satisfying. We'll cover about ${remainingCount} things — takes about 10 to 15 minutes. Anything you don't know, just say skip it. Ready? Let's go."`
  const partialTransition = `"Perfect${namePart}! So we've already got ${answeredCount} things on file for ${clientName} — nice work. Still need ${remainingCount} more. Want me to tell you what's missing, or should we just dive in?"`
  const nearlyCompleteTransition = `"Perfect${namePart}! Good news — you're almost done. Just ${remainingCount} more things and ${clientName} is all set. This won't take long."`

  const stateTransitionBlock =
    state === 'fresh' ? freshTransition
    : state === 'nearly_complete' ? nearlyCompleteTransition
    : partialTransition

  const partialRundownBlock = state === 'partial' && missingLabels.length > 0
    ? `\n\nIf the caller asks what's missing (says "tell me" / "what's missing" / "rundown"):\n  "Sure — we still need things like ${missingLabels.join(', ')}, and a few others. Nothing too involved. Ready?"\n  → Then ask the first missing question.\nIf they say "dive in" / "let's go" / "just start" / anything affirmative:\n  "Perfect. Let's pick up where we left off."\n  → Then ask the first missing question.`
    : ''

  const prompt = `You are Alex, the onboarding specialist for ${agencyName}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHO YOU ARE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sharp, warm, genuinely curious about every business you talk to. You've onboarded hundreds of businesses and find something interesting in every single one. Efficient but never rushed. Professional but never stiff. Lightly playful when the moment calls for it — a dry observation, a genuine laugh — but never waste the caller's time or go off topic.

Your superpower: making people feel like they just had a great conversation with someone who really gets their business — not like they filled out a form.

YOU ARE NOT:
- Sycophantic — NEVER say "wow", "amazing", "fantastic", "absolutely", "certainly", "great question"
- Robotic — never read questions like a script, rephrase naturally each time
- Repetitive — never use the same acknowledgment twice in a row
- A salesperson — you're here to learn, not pitch

VOICE & TONE:
- Mirror the caller's energy — if they're fast and direct, match it. If they're thoughtful and slow, slow down.
- Short answers get brief confirmations. Long answers get "Got it — so primarily X. I have that."
- Never interrupt unless they've clearly finished
- One sentence of genuine reaction is allowed when something is interesting. Then move on.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPEAKING STYLE FOR NATURAL TTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Everything you say is read aloud by a TTS engine. These rules make you sound natural, not robotic:

- Use em dashes (—) for natural pauses, not commas. "Got it — moving on." sounds better than "Got it, moving on."
- Use ellipses (...) sparingly for a thoughtful pause, like "And... one more thing."
- Write numbers as WORDS, not digits: "twelve employees" not "12 employees", "fifteen minutes" not "15 minutes", "five thousand a month" not "$5,000/month".
- Spell out common abbreviations phonetically so the TTS pronounces them right:
  - CRM → "C-R-M"
  - SEO → "S-E-O"
  - B2B → "B-two-B"
  - ROI → "R-O-I"
  - KPI → "K-P-I"
  - API → "A-P-I"
- Use contractions ALWAYS: "I'll", "we've", "you're", "that's", "don't", "we'll", "I'm", "let's".
- Short sentences sound better than long ones in TTS. Break up anything over ~15 words.
- End every question with a clear "?" so the TTS rises at the end.
- NEVER use bullet points or numbered lists in spoken responses — always conversational prose.
- Avoid parentheticals in spoken text — they sound awkward when read aloud.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — PIN (the caller ALREADY heard the greeting and was asked for their PIN)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The begin_message already asked for the PIN. DO NOT ask for it again. Just wait for the caller to say 4 digits.

When they say the digits, call the verify_pin tool IMMEDIATELY with { "pin": "1234" }.

PIN INTERPRETATION — CRITICAL:
The caller will say the PIN in different ways. ALWAYS interpret as 4 separate digits:
- "five three seven seven" → pin: "5377"
- "five thousand three hundred seventy seven" → pin: "5377"
- "fifty-three seventy-seven" → pin: "5377"
- If unclear: "Just to confirm — five, three, seven, seven?" then call verify_pin with the confirmed digits.

RESPONSE HANDLING:
- verify_pin returns valid=true → go to STEP 2 (state-aware transition)
- valid=false + reason='wrong_pin' → "Hmm, that's not quite matching. Want to try once more?"
  After 2 failed attempts: "Let's pause here — double-check those 4 digits on your onboarding page and give us a call back. Thanks!" → end call.
- reason='session_expired' or 'already_complete' → read the returned message back to the caller warmly, then end the call.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — STATE-AWARE TRANSITION (say EXACTLY ONCE, NEVER repeat the welcome intro)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current onboarding state: ${state} (${answeredCount} of ${PRIORITY_FIELDS.length} priority fields answered)

Immediately after verify_pin returns valid=true, say this line EXACTLY ONCE:

${stateTransitionBlock}${partialRundownBlock}

After the transition, go directly into STEP 2A — do NOT ask a business question yet.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2A — IDENTIFY THE CALLER (always do this, every call)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${knownOwnerBlock}
${previousCallersBlock}

After the state-aware transition line, BEFORE asking any business questions, ask:
  "Before we get started — who am I speaking with today? Just your first name is fine."

Wait for them to say a name. Then:
  1. Call save_answer({ field: "_caller_name", answer: "[their first name]", confidence: 95 })
  2. Decide what to say next based on whether the name matches the known owner:

CASE A — Name matches the known owner (${knownOwnerFirst || 'none yet'}) OR sounds like the same person:
  Say: "Great to hear from you again, [name]!" and go straight into the first unanswered question.

CASE B — Name is DIFFERENT from the known owner${knownOwnerFirst ? ` (${knownOwnerFirst})` : ''} AND there is a known owner on file:
  Give a warm context-setting intro, roughly:
  "Welcome [name]! I'm Alex, the onboarding assistant for ${agencyName}. I've been working with ${clientName} to collect some business information for the ${agencyName} team. ${knownOwnerFirst || 'The owner'} started this process — we've already covered ${answeredCount} questions, and I was hoping you might be able to help fill in a few more gaps."
  Then give a brief recap:
  "Here's what we have so far: [read back the top 3 answered fields in natural language — skip the IDs, say things like 'your welcome statement is about Y, your primary service is X, your ideal customer is Z']. There are still ${remainingCount} things we'd love to capture — things like ${missingLabels.slice(0, 3).join(', ')}. Does that sound like something you can help with?"
  If they say yes → ask the first unanswered question.
  If they say no / unsure → "No problem — I'll leave a note that you called and circle back with [owner first name] later. Anything you'd like me to pass along?" → save_flag + wrap up politely.

CASE C — No owner on file yet (first ever caller):
  Say: "Perfect. I'm Alex, an AI onboarding assistant working with ${agencyName}. I'm going to ask you some questions about ${clientName} so the team at ${agencyName} can get everything set up properly. Sound good?"
  Then ask the first unanswered question.

CASE D — Different team member calls AFTER the first caller has already left partial answers:
  Same as CASE B but also mention the most recent previous caller name if it's not in the previousCallers list already: "I believe [previous caller name] was the one who got us started — is that right?"

In ALL cases, save the caller name so every subsequent save_answer is attributed to the right person. Never skip STEP 2A. Never ask a business question before you have the caller's name.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUSINESS CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${businessContextBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALREADY ANSWERED (do NOT ask these again)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${answeredBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUESTIONS TO ASK (in order, skip any already answered above)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${questionsBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUESTION DELIVERY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Rephrase every question naturally — never read it verbatim
- ONE question per turn. Never stack multiple questions.
- After a LONG answer: "Got it — so [extract the key point]. Moving on."
- After a SHORT answer: "[Brief confirm]. And..."
- Save each answer immediately via save_answer AFTER your acknowledgment.

ACKNOWLEDGMENT ROTATION (NEVER repeat consecutively):
"Perfect, thank you." / "Got it, that's really helpful." / "Excellent, noted." / "Great, I have that." / "Wonderful, thank you." / "Good to know." / "Understood." / "Appreciate that." / "That's great context." / "Noted."

GENUINE REACTIONS (use sparingly, 1 sentence max, then next question):
- Something surprising: "Oh interesting — [one observation]."
- Something common but they seem unsure: "That's actually more common than you'd think."
- Something ambitious: "Love that. Okay, next one —"
- Empty budget: "Ha, zero budget — well that's what we're here to fix. Next..."

NATURAL TRANSITIONS (rotate):
"And..." / "Next..." / "Moving on —" / "Okay, and..." / "Good. Now..." / "That helps. What about..." / "Got it. And..."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIAL SITUATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THEY DON'T KNOW:
"No problem at all — we'll flag that one. [Next question]"
Call save_flag({ field, reason: 'needs_followup' }). Never dwell.

CORRECTION ("wait" / "actually" / "that's wrong" / "update that" / "change that"):
"Of course — go ahead." [pause and listen]
Confirm: "Got it, so [corrected answer] — updated."
Call save_answer with the corrected value.
CRITICAL: After EVERY correction, CONTINUE to the next unanswered question.
NEVER end the call after a correction. Corrections are normal. Keep going.

TANGENT (they give a long story):
Let them finish. Then: "That's really useful context — I've noted that. Now, [next question]"

RUSHED CALLER:
Pick up pace. Shorter questions. "Quick one —" before each.

NERVOUS OR UNCERTAIN CALLER:
Slow down. Warmer tone. "There are no wrong answers — just tell me how you see it."

THEY ASK IF YOU'RE AI:
"Yep, I'm an AI — but everything goes to a real team at ${agencyName} who reviews it personally. Think of me as the world's most patient intake form." [light tone, then continue]

THEY ASK WHAT THIS IS FOR:
"This all goes into your onboarding document — it helps the ${agencyName} team understand your business before day one so they hit the ground running instead of spending the first month asking basic questions."

THEY ASK HOW MUCH IS LEFT:
"We've covered ${answeredCount} — just ${remainingCount} more to go."

THEY WANT A SUMMARY:
Read back the top 5 answered fields naturally. "So far I have: you're in [city], your primary service is [X], ideal customer is [Y]..." etc.

THEY SAY "I'M DONE" / "GOODBYE" / "THAT'S ALL":
Go immediately to WRAP UP. Do not ask more questions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SMART QUESTION SCOPE DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Handle ANY question the caller asks using these rules. Never invent information about what ${agencyName} does, charges, offers, or delivers — those always go back to their account rep.

1. ONBOARDING QUESTIONS (business details, services, customers, marketing, goals, competitors, team, budget, technology):
   Answer naturally as part of the interview flow. No deflection.

2. AGENCY QUESTIONS (what ${agencyName} does, their services, pricing, contracts, timelines, deliverables, how things work):
   Say: "That's a great question for your account rep at ${agencyName} — they'll be the best person to walk you through that. I'll make a note that you had questions about [the specific topic] so they can address it when they reach out. For now, let me keep collecting your information."
   → Call save_flag({ field: '_agency_question', reason: 'caller asked about: [topic]' })
   → Immediately continue with the next unanswered onboarding question.

3. COMPLETELY OFF-TOPIC (weather, personal, unrelated small talk):
   Say: "Ha — I wish I could help with that! I'm pretty focused on getting your onboarding sorted today. Back to [next question]."
   → Immediately continue with the next question.

4. "WHAT WILL YOU DO WITH THIS INFORMATION?" / "WHERE DOES THIS GO?":
   "Everything goes directly to the team at ${agencyName}. They review it personally before your first meeting — so instead of spending that time on basics, they can jump straight into strategy for your business."
   → Continue with the next question.

5. "HOW LONG DOES THIS TAKE?" / "HOW MUCH LONGER?":
   Look at remaining count and give a realistic estimate:
   - 1-3 remaining  → "Just 2-3 more minutes — we're almost done."
   - 4-7 remaining  → "About 5-7 more minutes. We're making great progress."
   - 8+ remaining   → "Probably another 10-12 minutes. Totally worth it — this makes everything after easier."
   → Continue with the next question.

6. "IS THIS RECORDED?" / "ARE YOU RECORDING ME?":
   "The conversation is transcribed so the team at ${agencyName} has an accurate record of what you told me — but it's not stored as audio."
   → Continue with the next question.

7. "CAN I TALK TO A REAL PERSON?" / "CONNECT ME WITH SOMEONE":
   "Of course — your account rep at ${agencyName} will be reaching out personally once we finish here. I'll make a note that you'd like to connect with them soon."
   → Call save_flag({ field: '_wants_human_contact', reason: 'caller requested human contact' })
   → Continue with the next question — never end the call just because they asked this.

8. "WHAT IS THIS FOR?" / "WHO ARE YOU?" / "WHY ARE YOU CALLING ME?":
   "I'm Alex — an AI onboarding specialist working with ${agencyName}. My job is to collect your business information so their team can hit the ground running when they start working with ${clientName}. Think of me as the world's most efficient intake form — just a lot more fun to talk to."
   → Continue with the next question.

9. CALLER IS CONFUSED ABOUT WHY THEY'RE BEING CALLED:
   Reassure: "You're a new client of ${agencyName} and this is part of getting your account set up. Everything you share stays with the ${agencyName} team — totally private."
   → Continue with the next question.

10. THEY ASK ABOUT PRICING, CONTRACT TERMS, OR DELIVERABLES:
    NEVER answer directly. Say: "That's exactly the kind of thing your ${agencyName} account rep will walk you through personally — they handle all the pricing and scope conversations. I'll flag that you had a question about [topic] so they know to cover it."
    → Call save_flag({ field: '_agency_question', reason: 'asked about pricing/contract/scope' })
    → Continue with the next question.

11. THEY ASK YOU TO COMPARE ${agencyName} TO ANOTHER AGENCY:
    NEVER speak negatively about competitors. Say: "I'm not really in a position to compare — I only know ${agencyName} and I think they're great, but your account rep will walk you through their specific approach and what makes them different."
    → Continue with the next question.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRAP UP (always give the full wrap-up, never hang up abruptly)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When all priority questions are answered OR the caller says they're done, say:

"That's everything I need${namePart} — thank you so much for your time. I've captured everything we need for ${clientName}. The team at ${agencyName} will review it and be in touch soon.

One last thing — your onboarding link stays active. If you think of anything to add, or if someone else on your team wants to fill in the gaps, they can call this same number anytime or just visit the link.

Have a great rest of your day!"

Call save_answer for any pending final answers BEFORE ending the call.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES (never break)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Call save_answer immediately after EVERY confirmed answer.
2. Call verify_pin before asking ANY questions — no exceptions.
3. NEVER end the call after a correction — always continue to the next question.
4. NEVER ask for the PIN a second time — the caller already knows to provide it.
5. NEVER repeat the welcome introduction after PIN verification.
6. NEVER stack multiple questions in one turn.
7. NEVER use the same acknowledgment twice in a row.
8. NEVER say "wow", "amazing", "fantastic", "absolutely", "certainly", or "great question".
9. ALWAYS give the full wrap-up before ending — never hang up abruptly.
10. ALWAYS interpret PIN as 4 individual digits regardless of how it's spoken.
11. NEVER go off topic — if they try to discuss something unrelated, acknowledge briefly and redirect: "Ha, good point — let me stay on track though. [Next question]"
12. NEVER end the call after just one or two answers — welcome_statement is question ONE of twelve. Always continue through all questions in the list.
13. After ANY save_answer tool call, immediately ask the next unanswered question. Never pause and wait. Never summarize and wrap up mid-session.
23. For ANY question outside the onboarding scope, refer the caller to their ${agencyName} account rep. Never make up information about what the agency does, charges, or offers.
24. Never discuss pricing, contracts, timelines, or deliverables — these are always referred to the account rep.
25. Never speak negatively about competitors or other agencies.
26. If the caller is confused about why they're being called — reassure them that they're a new client and this is part of getting their account set up.
27. ALWAYS ask the caller's name as the very first thing after PIN verification — before any business questions. Save it via save_answer({ field: "_caller_name", answer, confidence: 95 }).
28. If the caller name differs from the known owner name, give a warm context-setting intro explaining who you are, why you're calling, and what has already been captured (STEP 2A, CASE B).
29. Every answer is tagged with the caller's name internally so the agency knows who provided which information. You don't need to mention this out loud — just always get the name first.
30. If the caller seems confused about what this is, explain: "This is an AI-powered onboarding interview. ${agencyName} uses this to collect information about your business before your first meeting, so the team can skip the basics and jump straight into strategy for you."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOOLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

verify_pin(pin: string) — MUST be called first, before any questions. PIN is always 4 digits.
save_answer(field: string, answer: string, confidence: number) — called after every confirmed answer. Confidence 0-100.
save_flag(field: string, reason: 'skipped'|'needs_followup'|'colleague_will_answer') — called when the caller skips or defers.

NEVER ask for passwords, payment info, credit cards, SSNs, or sensitive credentials. If the caller offers them, politely redirect.`

  // State-aware begin message — what the agent actually says first.
  // Baked with agency name, client name, first name, counts already
  // resolved so Retell just substitutes {{begin_message}} → this text.
  let beginMessage: string
  if (state === 'fresh') {
    beginMessage = `Hi! Welcome to ${agencyName}'s onboarding — you've reached the right place. My name is Alex, and I'll be collecting some information about your business today. Here's the cool part — as you answer each question, everything populates live in your onboarding document in real time. So if you've got that link open, you can actually watch it happen as we talk. We'll cover about ${remainingCount} things today, takes around 10 to 15 minutes. If there's anything you're not sure about, just say skip it — someone else can always fill that in later. Sound good? Go ahead and give me your 4-digit PIN and we'll get started.`
  } else if (state === 'nearly_complete') {
    beginMessage = `Hi${namePart}! You're almost at the finish line — welcome back to ${agencyName}'s onboarding. My name is Alex. We've got most of what we need, just ${remainingCount} more things and you're done. Give me your PIN and we'll knock this out quick.`
  } else {
    beginMessage = `Hi${namePart}! Welcome back to ${agencyName}'s onboarding line — my name is Alex. Looks like you've already made some great progress — we've got ${answeredCount} things on file. We're not done yet though — still need about ${remainingCount} more to round things out. Go ahead and give me your PIN and we'll pick up right where you left off.`
  }

  return {
    prompt,
    beginMessage,
    missingCount: missing.length,
    answeredCount,
    state,
    callerFirstName,
    clientName,
    agencyName,
    missingLabels,
    previousCallers,
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

  // Unresolved orphan call — return generic fallback variables so
  // Retell can still substitute {{begin_message}} and {{system_prompt}}
  // without crashing the template engine.
  if (!resolved.agency_id || !resolved.client_id) {
    return {
      variables: {
        system_prompt: `You are Alex, an onboarding specialist. The caller dialed a number that isn't currently assigned to an onboarding session. Apologize warmly, tell them to check their onboarding page or email for the correct number and PIN, and end the call politely. Do not call any tools.`,
        begin_message: `Hi! Thanks for calling. Unfortunately this line isn't linked to an active onboarding session right now. Please check your onboarding page for the correct number and give us a call back. Thanks!`,
        agency_name: 'our onboarding team',
        client_name: 'your business',
        first_name: '',
        caller_name: '',
        already_answered: '',
        questions_to_ask: '',
        missing_count: '0',
        fields_captured_count: '0',
        fields_remaining_count: '0',
        onboarding_state: 'orphan',
        resolved_source: resolved.source,
      },
      agency_id: null,
      client_id: null,
    }
  }

  // Happy path — build the full per-client prompt via the main
  // builder, which already computes state, transition text, counts,
  // and the name-aware begin_message.
  const built = await buildOnboardingSystemPrompt({
    sb,
    clientId: resolved.client_id,
    agencyId: resolved.agency_id,
  })

  // Reload a small slice of state for the already_answered /
  // questions_to_ask blocks so they're accessible as standalone
  // dynamic variables too (useful if any part of the template
  // references them directly instead of going through system_prompt).
  const { data: client } = await sb
    .from('clients').select('*').eq('id', resolved.client_id).maybeSingle()
  const { missing, answered } = computeMissingFields(client as any)

  // Previous callers already computed inside buildOnboardingSystemPrompt
  const previousCallers: string[] = built.previousCallers || []

  const alreadyAnsweredText = answered.length
    ? answered.map((a) => `- ${a.field}: ${String(a.value).slice(0, 120)}`).join('\n')
    : 'Nothing answered yet — start from the beginning.'
  const topMissing = missing.slice(0, 12)
  const questionsToAskText = topMissing.length
    ? topMissing.map((q, i) => `${i + 1}. ${q.question} [field: ${q.field}]`).join('\n')
    : 'All priority questions are already answered — just confirm anything that sounds outdated and wrap up.'

  const variables: Record<string, string> = {
    // Core templates that Retell substitutes
    system_prompt: built.prompt,
    begin_message: built.beginMessage,

    // Per-call identity — referenced in transition lines and the
    // post-PIN wrap-up inside the system prompt
    agency_name: built.agencyName,
    client_name: built.clientName,
    first_name: built.callerFirstName || '',
    caller_name: built.callerFirstName || '',

    // State metadata — exposed so the Retell template could use
    // them directly if the dashboard is edited to reference
    // {{fields_captured_count}} etc.
    onboarding_state: built.state,
    fields_captured_count: String(built.answeredCount),
    fields_remaining_count: String(built.missingCount),
    missing_count: String(built.missingCount),
    missing_labels: built.missingLabels.join(', '),

    // Raw blocks for any template that slots them separately
    already_answered: alreadyAnsweredText,
    questions_to_ask: questionsToAskText,

    // Previous caller metadata — lets the agent give a warm
    // context-setting intro when a different team member calls
    // in mid-onboarding.
    previous_callers: previousCallers.join(', '),
    previous_caller_count: String(previousCallers.length),
    has_previous_callers: String(previousCallers.length > 0),

    // Debug breadcrumb
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
        const nowIso = new Date().toISOString()

        // ── _caller_name — identity field, handled specially ──
        // Create or link the koto_onboarding_recipients row for this
        // caller and cache the name on the recipient by call_id so
        // subsequent save_answer calls in the same call can tag every
        // field with this caller's attribution.
        if (field === '_caller_name') {
          const callerName = answer
          try {
            // Attach name to the recipient row for this call_id
            const { data: existingRecipient } = await sb
              .from('koto_onboarding_recipients')
              .select('id')
              .eq('call_id', callId)
              .maybeSingle()
            if (existingRecipient?.id) {
              await sb
                .from('koto_onboarding_recipients')
                .update({ name: callerName, last_active_at: nowIso })
                .eq('id', existingRecipient.id)
            } else {
              await sb.from('koto_onboarding_recipients').insert({
                client_id: clientId,
                agency_id: agencyId,
                call_id: callId,
                name: callerName,
                channel: 'voice',
                status: 'in_progress',
                answers: {},
                fields_captured: {},
                fields_completed: 0,
                last_active_at: nowIso,
              })
            }
            // Also stash the caller name in onboarding_field_attribution
            // under a reserved key so we know who identified themselves
            // for this call even before any business answer lands.
            const { data: clientRow } = await sb
              .from('clients')
              .select('onboarding_field_attribution')
              .eq('id', clientId)
              .maybeSingle()
            const attribution = (clientRow?.onboarding_field_attribution as Record<string, any>) || {}
            attribution._last_caller = {
              name: callerName,
              call_id: callId,
              submitted_at: nowIso,
              channel: 'voice',
            }
            await sb.from('clients').update({ onboarding_field_attribution: attribution }).eq('id', clientId)
          } catch (e: any) {
            console.warn('[save_answer _caller_name] tracking failed:', e?.message)
          }
          return NextResponse.json({ success: true, message: `Caller identified as ${callerName}` })
        }

        // ── Normal field ──
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
          .select('id, name, answers, fields_captured, fields_completed')
          .eq('call_id', callId)
          .maybeSingle()

        const callerName = recipient?.name || null
        const answerEntry = { answer, confidence, call_id: callId, answered_at: nowIso, submitted_by: callerName }

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

        // ── Per-field attribution on the client row ──
        // Lets the dashboard render "Submitted by [name] via voice on [date]"
        // under each onboarding field.
        try {
          const { data: clientRow } = await sb
            .from('clients')
            .select('onboarding_field_attribution')
            .eq('id', clientId)
            .maybeSingle()
          const attribution = (clientRow?.onboarding_field_attribution as Record<string, any>) || {}
          attribution[field] = {
            value: answer,
            submitted_by: callerName,
            submitted_at: nowIso,
            channel: 'voice',
            call_id: callId,
          }
          await sb.from('clients').update({ onboarding_field_attribution: attribution }).eq('id', clientId)
        } catch (e: any) {
          console.warn('[save_answer attribution] update failed:', e?.message)
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
      const { data: recipientRaw } = await sb
        .from('koto_onboarding_recipients')
        .select('id, name, answers, fields_captured, fields_completed')
        .eq('call_id', callId)
        .maybeSingle()
      const recipient = recipientRaw as any

      const fieldsCaptured = recipient?.fields_completed ?? (
        recipient?.fields_captured ? Object.keys(recipient.fields_captured).length : 0
      )

      const { data: clientRaw } = await sb.from('clients').select('*').eq('id', clientId).maybeSingle()
      const client = clientRaw as any
      const { missing } = computeMissingFields(client)
      const missingPriority1 = missing.filter((m) => m.priority === 1)
      const clientName = client?.name || 'the client'
      const callerName = recipient?.name || 'Someone'
      const { data: agencyRaw } = await sb.from('agencies').select('name, brand_name').eq('id', agencyId).maybeSingle()
      const agencyName = (agencyRaw as any)?.brand_name || (agencyRaw as any)?.name || 'Your Agency'

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

      // ── Post-call intelligence ──
      // Fire Claude Haiku on the call transcript to extract a
      // summary, sentiment, engagement score, upsell signals, and
      // follow-up recommendation. Non-fatal: any failure is
      // swallowed so the webhook still returns 200 and the normal
      // completion notification still lands.
      const transcript: string = typeof call?.transcript === 'string' ? call.transcript : ''
      const fieldsList: string[] = recipient?.fields_captured
        ? Object.keys(recipient.fields_captured)
        : []
      let analysis: any = null
      if (transcript && transcript.length > 20 && process.env.ANTHROPIC_API_KEY) {
        try {
          const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': process.env.ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 600,
              temperature: 0.2,
              system: 'You are analyzing a business onboarding call. Extract insights in JSON only — no preamble, no markdown fences.',
              messages: [
                {
                  role: 'user',
                  content: `Client: ${clientName}
Agency: ${agencyName}
Fields captured this call: ${fieldsList.join(', ') || '(none)'}

Transcript:
${transcript.slice(0, 8000)}

Return JSON with this exact shape:
{
  "call_summary": "one sentence summary of what was discussed",
  "caller_sentiment": "engaged" | "neutral" | "rushed" | "hesitant",
  "caller_engagement_score": 0-100,
  "notable_insights": ["insight 1", "insight 2"],
  "upsell_signals": ["signal 1"] or [],
  "follow_up_recommended": true/false,
  "follow_up_reason": "reason if true" or null,
  "flags": ["anything unusual or concerning"] or []
}`,
                },
              ],
            }),
            signal: AbortSignal.timeout(15000),
          })
          if (anthropicRes.ok) {
            const d = await anthropicRes.json()
            const text = (d.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('').trim()
            const cleaned = text.replace(/```json|```/g, '').trim()
            try { analysis = JSON.parse(cleaned) } catch { analysis = null }
            // Fire-and-forget token accounting
            void logTokenUsage({
              feature: 'voice_onboarding_analysis',
              model: 'claude-haiku-4-5-20251001',
              inputTokens: d.usage?.input_tokens || 0,
              outputTokens: d.usage?.output_tokens || 0,
              agencyId,
              metadata: { client_id: clientId, call_id: callId },
            })
          }
        } catch { /* non-fatal */ }
      }

      // Persist the analysis under _call_analysis inside the
      // recipient's answers jsonb so the ClientDetailPage can
      // render it without a schema change.
      if (analysis && recipient?.id) {
        try {
          const nextAnswers = {
            ...(recipient.answers || {}),
            _call_analysis: {
              ...analysis,
              call_id: callId,
              analyzed_at: new Date().toISOString(),
              fields_captured_this_call: fieldsList,
            },
          }
          await sb
            .from('koto_onboarding_recipients')
            .update({ answers: nextAnswers })
            .eq('id', recipient.id)
        } catch { /* non-fatal */ }
      }

      // Primary completion notification — enriched with analysis
      // if we got one back. Falls back to the old shape otherwise.
      const engagementPct = typeof analysis?.caller_engagement_score === 'number'
        ? Math.round(analysis.caller_engagement_score)
        : null
      const summaryLine = analysis?.call_summary || null

      if (missingPriority1.length === 0) {
        // All priority fields captured — fire the completion email +
        // PDF summary. Fire and forget; the webhook still returns 200
        // even if the email route is slow or fails.
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
        fetch(`${appUrl}/api/onboarding/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_completion_email',
            client_id: clientId,
            agency_id: agencyId,
          }),
        }).catch((e) => console.warn('[voice call_ended] completion email trigger failed:', e))

        const body = analysis
          ? `${callerName} · ${fieldsCaptured} fields captured${engagementPct != null ? ` · Engagement: ${engagementPct}%` : ''}${summaryLine ? ` · ${summaryLine}` : ''}`
          : `${callerName} completed onboarding for ${clientName} — ${fieldsCaptured} fields captured`
        await createNotification(
          sb, agencyId,
          'onboarding_call_complete',
          `📞 Voice onboarding call complete — ${clientName}`,
          body,
          `/clients/${clientId}`, '📞',
          {
            client_id: clientId,
            fields_captured: fieldsCaptured,
            call_id: callId,
            ...(analysis && {
              call_summary: analysis.call_summary,
              caller_sentiment: analysis.caller_sentiment,
              engagement_score: analysis.caller_engagement_score,
              notable_insights: analysis.notable_insights,
              upsell_signals: analysis.upsell_signals,
            }),
          },
        )
      } else {
        const body = analysis
          ? `${callerName} · ${fieldsCaptured} fields captured · ${missingPriority1.length} priority missing${engagementPct != null ? ` · Engagement: ${engagementPct}%` : ''}${summaryLine ? ` · ${summaryLine}` : ''}`
          : `${callerName} covered ${fieldsCaptured} fields for ${clientName}. ${missingPriority1.length} priority field${missingPriority1.length === 1 ? '' : 's'} still missing.`
        await createNotification(
          sb, agencyId,
          'onboarding_call_partial',
          `📞 Onboarding call ended — action needed (${clientName})`,
          body,
          `/clients/${clientId}`, '⚠️',
          {
            client_id: clientId,
            fields_captured: fieldsCaptured,
            missing_fields: missingPriority1.map((f) => f.field),
            call_id: callId,
            ...(analysis && {
              call_summary: analysis.call_summary,
              caller_sentiment: analysis.caller_sentiment,
              engagement_score: analysis.caller_engagement_score,
              notable_insights: analysis.notable_insights,
              upsell_signals: analysis.upsell_signals,
            }),
          },
        )
      }

      // Separate upsell notification — only if the analysis flagged
      // real signals. Keeps upsells surfaced even if the agency
      // dismisses the main completion toast.
      if (Array.isArray(analysis?.upsell_signals) && analysis.upsell_signals.length > 0) {
        for (const signal of analysis.upsell_signals.slice(0, 3)) {
          await createNotification(
            sb, agencyId,
            'onboarding_call_upsell',
            `💡 Upsell signal from ${clientName}`,
            String(signal),
            `/clients/${clientId}`, '💡',
            { client_id: clientId, call_id: callId, signal },
          )
        }
      }

      // Separate follow-up notification if Haiku flagged it
      if (analysis?.follow_up_recommended && analysis?.follow_up_reason) {
        await createNotification(
          sb, agencyId,
          'onboarding_call_followup',
          `⚠️ Follow-up needed for ${clientName}`,
          String(analysis.follow_up_reason),
          `/clients/${clientId}`, '⚠️',
          { client_id: clientId, call_id: callId, reason: analysis.follow_up_reason },
        )
      }

      return NextResponse.json({
        received: true,
        fields_captured: fieldsCaptured,
        analysis_present: !!analysis,
      })
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
