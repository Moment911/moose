import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// Telnyx onboarding provisioning
//
// Dynamically assigns a real phone number to a client for voice
// onboarding. Each assignment:
//
//   1. Searches Telnyx for an available US local number (trying
//      the preferred area code first, then falling back).
//   2. Orders it via POST /v2/number_orders.
//   3. Retrieves the phone_number record id (used for PATCH/DELETE).
//   4. PATCHes the connection_id so calls to this number route to
//      our Koto Onboarding Voice API app.
//   5. Generates a 4-digit PIN (avoiding obvious sequences).
//   6. Saves to koto_onboarding_phone_pool + clients.onboarding_*.
//
// On release, we DELETE the number from Telnyx (billing stops) and
// clear the client row. The pool entry is kept for historical
// tracking but marked status='released'.
//
// Env:
//   TELNYX_API_KEY                     (required)
//   TELNYX_ONBOARDING_CONNECTION_ID    (defaults to 2935231712440878244)
// ─────────────────────────────────────────────────────────────

const TELNYX_API_BASE = 'https://api.telnyx.com/v2'
const DEFAULT_CONNECTION_ID = '2935231712440878244'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function getApiKey(): string {
  return process.env.TELNYX_API_KEY || ''
}

function getConnectionId(): string {
  return process.env.TELNYX_ONBOARDING_CONNECTION_ID || DEFAULT_CONNECTION_ID
}

// 4-digit PIN generator. Rejects common sequences so the PIN is
// harder to guess and harder to mistype.
function generatePin(): string {
  const banned = new Set([
    '1234', '2345', '3456', '4567', '5678', '6789',
    '0000', '1111', '2222', '3333', '4444', '5555',
    '6666', '7777', '8888', '9999',
    '0987', '9876', '8765', '7654', '6543', '5432', '4321', '3210',
  ])
  let pin: string
  do {
    pin = String(Math.floor(1000 + Math.random() * 9000))
  } while (banned.has(pin))
  return pin
}

function formatDisplayNumber(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return phone
}

function telnyxHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  }
}

async function searchAvailableNumber(areaCode: string | null): Promise<string | null> {
  const params = new URLSearchParams({
    'filter[country_code]': 'US',
    'filter[number_type]': 'local',
    'filter[limit]': '5',
  })
  if (areaCode) params.set('filter[national_destination_code]', areaCode)

  try {
    const res = await fetch(`${TELNYX_API_BASE}/available_phone_numbers?${params}`, {
      headers: telnyxHeaders(),
    })
    if (!res.ok) return null
    const data = await res.json()
    const numbers = data?.data || []
    return numbers[0]?.phone_number || null
  } catch {
    return null
  }
}

async function orderNumber(phoneNumber: string): Promise<{ orderId: string | null; error: string | null }> {
  try {
    const res = await fetch(`${TELNYX_API_BASE}/number_orders`, {
      method: 'POST',
      headers: telnyxHeaders(),
      body: JSON.stringify({ phone_numbers: [{ phone_number: phoneNumber }] }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { orderId: null, error: data?.errors?.[0]?.detail || `Telnyx order failed (${res.status})` }
    }
    return { orderId: data?.data?.id || null, error: null }
  } catch (e: any) {
    return { orderId: null, error: e?.message || 'Telnyx order request failed' }
  }
}

async function fetchPhoneNumberId(phoneNumber: string): Promise<string | null> {
  // Telnyx takes a moment after ordering to populate the phone_numbers
  // endpoint. Retry up to 3 times with a short delay in between.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `${TELNYX_API_BASE}/phone_numbers?filter[phone_number]=${encodeURIComponent(phoneNumber)}`,
        { headers: telnyxHeaders() }
      )
      if (res.ok) {
        const data = await res.json()
        const id = data?.data?.[0]?.id
        if (id) return id
      }
    } catch { /* retry */ }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1500))
  }
  return null
}

async function assignConnection(phoneNumberId: string): Promise<boolean> {
  try {
    const res = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}`, {
      method: 'PATCH',
      headers: telnyxHeaders(),
      body: JSON.stringify({ connection_id: getConnectionId() }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function deleteNumber(phoneNumberId: string): Promise<boolean> {
  try {
    const res = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}`, {
      method: 'DELETE',
      headers: telnyxHeaders(),
    })
    return res.ok || res.status === 404
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────
// Retell import + agent assignment
//
// Once a Telnyx number is ordered and assigned to the Telnyx
// Voice API connection, we need to tell Retell about it so calls
// to the number actually route to our agent. Two-step:
//
//   1. POST /create-phone-number-from-carrier-number with
//      { carrier: 'telnyx', phone_number, telnyx_account_connection_id }
//      — imports the number into Retell's address book.
//   2. PATCH /update-phone-number/{phone_number} with
//      { inbound_agent_id } — binds the onboarding agent to the
//      number so inbound calls hit its webhook.
//
// Without both steps, Retell has no idea the number exists and
// calls to it will fail silently (or Telnyx will play an error).
// ─────────────────────────────────────────────────────────────
const RETELL_API_BASE = 'https://api.retellai.com'

function retellHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.RETELL_API_KEY || ''}`,
    'Content-Type': 'application/json',
  }
}

async function retellImportCarrierNumber(args: {
  phoneNumber: string
  connectionId: string
}): Promise<{ ok: boolean; error: string | null; retellPhoneNumberId: string | null }> {
  if (!process.env.RETELL_API_KEY) {
    return { ok: false, error: 'RETELL_API_KEY not configured', retellPhoneNumberId: null }
  }
  try {
    const res = await fetch(`${RETELL_API_BASE}/create-phone-number-from-carrier-number`, {
      method: 'POST',
      headers: retellHeaders(),
      body: JSON.stringify({
        carrier: 'telnyx',
        phone_number: args.phoneNumber,
        telnyx_account_connection_id: args.connectionId,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error_message || data?.message || `Retell import failed (${res.status})`,
        retellPhoneNumberId: null,
      }
    }
    // Retell returns the imported number record; the phone_number
    // itself is the key used by PATCH/DELETE endpoints.
    return { ok: true, error: null, retellPhoneNumberId: data?.phone_number || args.phoneNumber }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Retell import request failed', retellPhoneNumberId: null }
  }
}

// Retell's inbound dynamic variables webhook URL is a
// PHONE-NUMBER-level field, not an agent-level field. We set it
// here alongside the agent id so every provisioned number
// correctly receives the pre-call hook that injects the per-call
// system prompt + begin message.
function getInboundWebhookUrl(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'}/api/onboarding/voice`
}

async function retellAssignAgent(args: {
  phoneNumber: string
  inboundAgentId: string
}): Promise<{ ok: boolean; error: string | null }> {
  if (!process.env.RETELL_API_KEY) {
    return { ok: false, error: 'RETELL_API_KEY not configured' }
  }
  try {
    // Two things must be set on the phone number for inbound
    // calls to work end-to-end:
    //
    //   inbound_agent_id       → which agent answers the call
    //   inbound_webhook_url    → where Retell POSTs the pre-call
    //                            hook with { call_inbound: {...} }
    //                            to get dynamic variables back
    //
    // The second field is PHONE-NUMBER-level, not agent-level,
    // even though the agent has its own webhook_url for post-call
    // notification events. Miss this and calls still connect but
    // the agent uses whatever static begin_message / general_prompt
    // is on the Retell LLM resource — no per-client personalization.
    const res = await fetch(`${RETELL_API_BASE}/update-phone-number/${encodeURIComponent(args.phoneNumber)}`, {
      method: 'PATCH',
      headers: retellHeaders(),
      body: JSON.stringify({
        inbound_agent_id: args.inboundAgentId,
        inbound_webhook_url: getInboundWebhookUrl(),
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return {
        ok: false,
        error: data?.error_message || data?.message || `Retell agent assignment failed (${res.status})`,
      }
    }
    return { ok: true, error: null }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Retell agent assignment request failed' }
  }
}

async function retellDeletePhoneNumber(phoneNumber: string): Promise<boolean> {
  if (!process.env.RETELL_API_KEY) return false
  try {
    const res = await fetch(`${RETELL_API_BASE}/delete-phone-number/${encodeURIComponent(phoneNumber)}`, {
      method: 'DELETE',
      headers: retellHeaders(),
    })
    return res.ok || res.status === 404
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────
// GET handler — status + search
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const action = url.searchParams.get('action') || ''
  const s = sb()

  // ?action=status&client_id=... → current assignment for the client
  if (action === 'status') {
    const clientId = url.searchParams.get('client_id') || ''
    if (!clientId) {
      return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    }
    const { data: client } = await s
      .from('clients')
      .select('id, name, onboarding_phone, onboarding_phone_display, onboarding_pin, onboarding_phone_assigned_at, onboarding_phone_expires_at')
      .eq('id', clientId)
      .maybeSingle()
    if (!client) return NextResponse.json({ assigned: false })

    const assigned = !!(client.onboarding_phone && client.onboarding_pin)
    const expired = !!(client.onboarding_phone_expires_at && new Date(client.onboarding_phone_expires_at) < new Date())

    return NextResponse.json({
      assigned,
      expired,
      client_name: client.name,
      phone_number: client.onboarding_phone || null,
      display_number: client.onboarding_phone_display || null,
      pin: client.onboarding_pin || null,
      assigned_at: client.onboarding_phone_assigned_at || null,
      expires_at: client.onboarding_phone_expires_at || null,
    })
  }

  // ?action=search&area_code=561 → preview available numbers
  if (action === 'search') {
    if (!getApiKey()) {
      return NextResponse.json({ error: 'TELNYX_API_KEY not configured' }, { status: 500 })
    }
    const areaCode = url.searchParams.get('area_code')
    try {
      const params = new URLSearchParams({
        'filter[country_code]': 'US',
        'filter[number_type]': 'local',
        'filter[limit]': '10',
      })
      if (areaCode) params.set('filter[national_destination_code]', areaCode)
      const res = await fetch(`${TELNYX_API_BASE}/available_phone_numbers?${params}`, {
        headers: telnyxHeaders(),
      })
      const data = await res.json()
      const numbers = (data?.data || []).map((n: any) => ({
        phone_number: n.phone_number,
        display: formatDisplayNumber(n.phone_number),
        region: n.region_information?.[0]?.region_name || null,
      }))
      return NextResponse.json({ numbers })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Search failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// Claim the full 300s Vercel function budget. The bulk_provision
// handler can take up to ~225s for 25 sequential provisions, so we
// need more than the 60s default. This also benefits the
// single-client provision path which occasionally hits ~10s when
// Telnyx is slow to register a new number.
export const maxDuration = 300

// ─────────────────────────────────────────────────────────────
// Helpers used by bulk_provision, init_client_onboarding, and
// the single provision action. Keep these close to the POST
// handler so the call sites don't need to import anything else.
// ─────────────────────────────────────────────────────────────

// Pulls the 3-digit US area code from a free-form phone string.
// Returns null for anything that doesn't look like a valid US
// number so the caller falls back to the default area code list.
function extractAreaCodeFromPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = String(phone).replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1, 4)
  if (digits.length === 10) return digits.slice(0, 3)
  return null
}

// Creates an onboarding_tokens row for a client if missing. Uses
// the client id as the token value so /onboard/:client_id always
// resolves via the UUID-aware resolver in src/lib/supabase.js.
// Returns { created: boolean } so callers can count new rows.
async function ensureOnboardingToken(
  s: any,
  clientId: string,
  agencyId: string,
): Promise<{ created: boolean; error?: string }> {
  try {
    const { data: existing } = await s
      .from('onboarding_tokens')
      .select('id')
      .eq('client_id', clientId)
      .maybeSingle()
    if (existing) return { created: false }

    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await s.from('onboarding_tokens').insert({
      client_id: clientId,
      agency_id: agencyId,
      token: clientId, // resolver accepts client_id directly too
      expires_at: expiresAt,
    })
    if (error) return { created: false, error: error.message }
    return { created: true }
  } catch (e: any) {
    return { created: false, error: e?.message || 'ensureOnboardingToken failed' }
  }
}

// The entire provision flow for one client, returned as a plain
// object instead of a NextResponse. Used by:
//   - action='provision'           (single client)
//   - action='init_client_onboarding' (post-insert hook)
//   - action='bulk_provision'      (batch loop)
//
// Idempotent: if the client already has an active, non-expired
// assignment, returns the existing details without spending more
// Telnyx money. Rolls back Telnyx + Retell state on failure.
async function provisionOneClient(
  s: any,
  args: { client_id: string; agency_id: string; area_code?: string | null },
): Promise<any> {
  const { client_id, agency_id, area_code } = args

  if (!getApiKey()) {
    return { ok: false, error: 'TELNYX_API_KEY not configured' }
  }

  // Short-circuit if already assigned + not expired
  const { data: existing } = await s
    .from('clients')
    .select('onboarding_phone, onboarding_phone_display, onboarding_pin, onboarding_phone_expires_at')
    .eq('id', client_id)
    .maybeSingle()

  if (
    existing?.onboarding_phone &&
    existing?.onboarding_pin &&
    existing.onboarding_phone_expires_at &&
    new Date(existing.onboarding_phone_expires_at) > new Date()
  ) {
    return {
      ok: true,
      already_assigned: true,
      phone_number: existing.onboarding_phone,
      display_number: existing.onboarding_phone_display,
      pin: existing.onboarding_pin,
      expires_at: existing.onboarding_phone_expires_at,
    }
  }

  // 1. Find an available number
  const areaCodesToTry: (string | null)[] = area_code
    ? [area_code, '800', null]
    : ['561', '305', '954', '800', null]

  let selectedNumber: string | null = null
  for (const ac of areaCodesToTry) {
    selectedNumber = await searchAvailableNumber(ac)
    if (selectedNumber) break
  }
  if (!selectedNumber) {
    return { ok: false, error: 'No phone numbers available from Telnyx' }
  }

  // 2. Order it
  const { orderId, error: orderError } = await orderNumber(selectedNumber)
  if (orderError) {
    return { ok: false, error: orderError }
  }

  // 3. Wait for Telnyx to process, fetch the phone number id
  await new Promise((r) => setTimeout(r, 2000))
  const phoneNumberId = await fetchPhoneNumberId(selectedNumber)
  if (!phoneNumberId) {
    return {
      ok: false,
      error: 'Number ordered but could not retrieve id from Telnyx. Check dashboard.',
      ordered_number: selectedNumber,
      order_id: orderId,
    }
  }

  // 4. Assign Telnyx voice connection (route → Retell BYOC trunk)
  const connectionOk = await assignConnection(phoneNumberId)

  // 5. Import into Retell — NON-FATAL.
  //
  // create-phone-number-from-carrier-number has been returning
  // intermittent 404s during bulk provisioning (root cause
  // unknown — possibly a Retell-side routing change or a rate
  // limit). Previously this triggered a Telnyx rollback, which
  // meant bulk runs would lose every partially-provisioned
  // number and leak nothing but also complete zero clients.
  //
  // New behavior: log the error, carry on, persist everything
  // to Telnyx + our DB. The Telnyx connection
  // (TELNYX_ONBOARDING_CONNECTION_ID) is the SIP trust boundary
  // that hands calls off to Retell's BYOC trunk — the Retell
  // import is what makes the number appear in Retell's
  // dashboard and enables the inbound_webhook_url / agent
  // binding pattern.
  //
  // CAVEAT: if this import fails, calls to the number will
  // likely not route correctly on the Retell side until
  // someone manually imports the number in the Retell
  // dashboard (or we retry the import successfully later).
  // The return value's retell_imported field tells the caller
  // whether the number is fully live or needs a manual fix.
  const connectionId = getConnectionId()
  const retellImport = await retellImportCarrierNumber({
    phoneNumber: selectedNumber,
    connectionId,
  })
  if (!retellImport.ok) {
    // eslint-disable-next-line no-console
    console.warn(
      `[provision] Retell BYOC import FAILED for ${selectedNumber} — continuing anyway. ` +
      `Number is in Telnyx but not registered with Retell. Manual dashboard import may be needed. ` +
      `Error: ${retellImport.error}`,
    )
  }

  // 6. Bind the agency's onboarding agent to the imported number.
  // Only attempt this if the import succeeded — otherwise
  // update-phone-number/{number} will 404 for the same reason
  // the import did.
  const { data: agency } = await s
    .from('agencies')
    .select('onboarding_agent_id, brand_name, name')
    .eq('id', agency_id)
    .maybeSingle()

  const inboundAgentId = (agency as any)?.onboarding_agent_id || null
  let agentAssignOk = false
  let agentAssignError: string | null = null
  if (!retellImport.ok) {
    agentAssignError = 'Skipped — Retell import failed upstream so there is no phone number record to bind an agent to.'
  } else if (inboundAgentId) {
    const assignRes = await retellAssignAgent({
      phoneNumber: selectedNumber,
      inboundAgentId,
    })
    agentAssignOk = assignRes.ok
    agentAssignError = assignRes.error
  } else {
    agentAssignError = 'No onboarding agent configured for this agency — create one in Agency Settings.'
  }

  // 7. Generate PIN + persist everything
  const pin = generatePin()
  const displayNumber = formatDisplayNumber(selectedNumber)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { error: poolError } = await s.from('koto_onboarding_phone_pool').insert({
    phone_number: selectedNumber,
    display_number: displayNumber,
    telnyx_phone_id: phoneNumberId,
    telnyx_order_id: orderId,
    connection_id: connectionId,
    provider: 'telnyx',
    status: 'assigned',
    assigned_to_client_id: client_id,
    assigned_to_agency_id: agency_id,
    assigned_at: new Date().toISOString(),
    expires_at: expiresAt,
    total_assignments: 1,
  })

  if (poolError) {
    // Roll back everything — no orphans on either side
    await retellDeletePhoneNumber(selectedNumber).catch(() => {})
    await deleteNumber(phoneNumberId).catch(() => {})
    return { ok: false, error: 'Failed to save pool entry: ' + poolError.message }
  }

  await s
    .from('clients')
    .update({
      onboarding_phone: selectedNumber,
      onboarding_phone_display: displayNumber,
      onboarding_pin: pin,
      onboarding_phone_assigned_at: new Date().toISOString(),
      onboarding_phone_expires_at: expiresAt,
    })
    .eq('id', client_id)

  return {
    ok: true,
    phone_number: selectedNumber,
    display_number: displayNumber,
    pin,
    telnyx_phone_id: phoneNumberId,
    telnyx_order_id: orderId,
    connection_id: connectionId,
    connection_assigned: connectionOk,
    retell_imported: retellImport.ok,
    retell_agent_id: inboundAgentId,
    agent_assigned: agentAssignOk,
    agent_assign_error: agentAssignError,
    expires_at: expiresAt,
  }
}

// ─────────────────────────────────────────────────────────────
// POST handler — provision + release + bulk + init + tokens
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { action, client_id, agency_id, area_code } = body || {}

    const s = sb()

    // ── import_existing ────────────────────────────────────────
    // For a Telnyx number that was already ordered (either via the
    // `provision` action before the Retell import path existed, or
    // manually from the Telnyx dashboard), register it with Retell
    // and bind the agency's onboarding agent. Skips ordering.
    //
    // Falls back to process.env.RETELL_ONBOARDING_AGENT_ID if the
    // agency row doesn't have one set — lets the agency import a
    // number during initial setup before they've wired the per-
    // agency agent.
    if (action === 'import_existing') {
      const { phone_number } = body
      if (!phone_number || !agency_id) {
        return NextResponse.json({ error: 'phone_number and agency_id required' }, { status: 400 })
      }

      const connectionId = getConnectionId()

      // Step A — import the number into Retell
      const retellImport = await retellImportCarrierNumber({
        phoneNumber: phone_number,
        connectionId,
      })
      if (!retellImport.ok) {
        return NextResponse.json({
          ok: false,
          retell_imported: false,
          agent_assigned: false,
          error: retellImport.error,
        }, { status: 500 })
      }

      // Step B — bind the onboarding agent to the number. Prefer
      // the per-agency agent id; fall back to the env var if set.
      const { data: agency } = await s
        .from('agencies')
        .select('onboarding_agent_id')
        .eq('id', agency_id)
        .maybeSingle()

      const inboundAgentId = agency?.onboarding_agent_id || process.env.RETELL_ONBOARDING_AGENT_ID || null
      if (!inboundAgentId) {
        return NextResponse.json({
          ok: true,
          retell_imported: true,
          agent_assigned: false,
          error: 'No onboarding agent configured. Create one in Agency Settings → Onboarding → Voice Onboarding, then retry.',
        })
      }

      const assignRes = await retellAssignAgent({
        phoneNumber: phone_number,
        inboundAgentId,
      })

      return NextResponse.json({
        ok: true,
        retell_imported: true,
        agent_assigned: assignRes.ok,
        agent_id: inboundAgentId,
        error: assignRes.ok ? null : assignRes.error,
      })
    }

    // ── provision ───────────────────────────────────────────────
    if (action === 'provision') {
      if (!client_id || !agency_id) {
        return NextResponse.json({ error: 'client_id and agency_id required' }, { status: 400 })
      }
      const result = await provisionOneClient(s, { client_id, agency_id, area_code })
      if (result.ok) return NextResponse.json(result)
      return NextResponse.json(result, { status: 500 })
    }

    // ── init_client_onboarding ─────────────────────────────────
    // One-shot helper called after a new client is created. Does
    // two things: creates an onboarding_tokens row if missing, and
    // fires provisioning (unless the client is tagged is_test /
    // is_simulation in source_meta — we never spend real money on
    // test data). Fire-and-forget from the caller's perspective.
    if (action === 'init_client_onboarding') {
      if (!client_id || !agency_id) {
        return NextResponse.json({ error: 'client_id and agency_id required' }, { status: 400 })
      }

      const { data: client } = await s
        .from('clients')
        .select('id, name, agency_id, source_meta, phone')
        .eq('id', client_id)
        .maybeSingle()

      if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

      const sm = (client as any).source_meta || {}
      const isTest = sm?.is_test === true || sm?.is_simulation === true
      if (isTest) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: 'test_client',
          message: 'Test/simulation client — skipping auto-provision',
        })
      }

      // Ensure the onboarding token exists so the /onboard/:id link
      // resolves even if provisioning fails.
      await ensureOnboardingToken(s, client_id, agency_id)

      // Figure out a preferred area code from the client's phone
      // if we have one — keeps the assigned number in the same
      // geography when possible.
      const ac = extractAreaCodeFromPhone((client as any).phone)
      const result = await provisionOneClient(s, {
        client_id,
        agency_id,
        area_code: ac || null,
      })

      return NextResponse.json(result)
    }

    // ── bulk_provision ─────────────────────────────────────────
    // Iterates over every client for an agency missing an
    // onboarding_phone and provisions one sequentially.
    //
    // dry_run=true: returns { total, estimated_monthly_cost } with
    // zero side effects — safe preview before spending money.
    //
    // Real run: capped at 25 clients per invocation to stay under
    // the Vercel 300s function limit (each provision averages ~9s
    // including the 800ms inter-request delay). Returns has_more
    // when more clients remain so the UI can call again.
    if (action === 'bulk_provision') {
      if (!agency_id) {
        return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
      }

      const dryRun = !!body.dry_run
      const MAX_PER_CALL = 25

      // Find candidates — clients with no onboarding_phone, not
      // deleted, not tagged as test/simulation.
      const { data: candidates } = await s
        .from('clients')
        .select('id, name, phone, source_meta, onboarding_phone, deleted_at')
        .eq('agency_id', agency_id)
        .is('onboarding_phone', null)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      const filtered = (candidates || []).filter((c: any) => {
        const sm = c.source_meta || {}
        return !(sm.is_test === true || sm.is_simulation === true)
      })

      const total = filtered.length

      if (dryRun) {
        return NextResponse.json({
          total,
          estimated_monthly_cost: total * 1.00,
          capped_per_call: MAX_PER_CALL,
          would_process: Math.min(total, MAX_PER_CALL),
        })
      }

      if (!getApiKey()) {
        return NextResponse.json({ error: 'TELNYX_API_KEY not configured' }, { status: 500 })
      }

      const scoped = filtered.slice(0, MAX_PER_CALL)
      const results: any[] = []
      let provisioned = 0
      let failed = 0
      let skipped = 0

      for (let i = 0; i < scoped.length; i++) {
        const c: any = scoped[i]
        try {
          // Ensure token exists for every client we touch
          await ensureOnboardingToken(s, c.id, agency_id)

          const ac = extractAreaCodeFromPhone(c.phone)
          const r = await provisionOneClient(s, {
            client_id: c.id,
            agency_id,
            area_code: ac || null,
          })

          if (r.ok && !r.error) {
            provisioned += 1
            results.push({
              client_id: c.id,
              client_name: c.name,
              status: 'provisioned',
              phone_number: r.display_number || r.phone_number,
              pin: r.pin,
            })
          } else {
            failed += 1
            results.push({
              client_id: c.id,
              client_name: c.name,
              status: 'failed',
              error: r.error || 'unknown error',
            })
          }
        } catch (e: any) {
          failed += 1
          results.push({
            client_id: c.id,
            client_name: c.name,
            status: 'failed',
            error: e?.message || 'exception',
          })
        }

        // 800ms delay between calls to stay under Telnyx rate limits
        if (i < scoped.length - 1) {
          await new Promise((r) => setTimeout(r, 800))
        }
      }

      return NextResponse.json({
        total,
        processed: scoped.length,
        provisioned,
        failed,
        skipped,
        has_more: filtered.length > MAX_PER_CALL,
        remaining: Math.max(0, filtered.length - MAX_PER_CALL),
        results,
        estimated_monthly_cost: provisioned * 1.00,
      })
    }

    // ── fix_missing_tokens ─────────────────────────────────────
    // Creates onboarding_tokens rows for any clients in this
    // agency that don't have one. No Telnyx calls — cheap.
    // Uses client.id as the token value so /onboard/:client_id
    // always resolves.
    if (action === 'fix_missing_tokens') {
      if (!agency_id) {
        return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
      }

      const { data: clients } = await s
        .from('clients')
        .select('id, agency_id, source_meta')
        .eq('agency_id', agency_id)
        .is('deleted_at', null)

      const eligible = (clients || []).filter((c: any) => {
        const sm = c.source_meta || {}
        return !(sm.is_test === true || sm.is_simulation === true)
      })

      let created = 0
      let skipped = 0
      for (const c of eligible) {
        const result = await ensureOnboardingToken(s, (c as any).id, agency_id)
        if (result.created) created += 1
        else skipped += 1
      }

      return NextResponse.json({ created, skipped, total_checked: eligible.length })
    }

    // ── release ────────────────────────────────────────────────
    if (action === 'release') {
      if (!client_id) {
        return NextResponse.json({ error: 'client_id required' }, { status: 400 })
      }

      const { data: client } = await s
        .from('clients')
        .select('onboarding_phone, onboarding_pin')
        .eq('id', client_id)
        .maybeSingle()

      if (!client?.onboarding_phone) {
        return NextResponse.json({ ok: true, message: 'No phone assigned' })
      }

      const { data: pool } = await s
        .from('koto_onboarding_phone_pool')
        .select('id, telnyx_phone_id')
        .eq('assigned_to_client_id', client_id)
        .eq('status', 'assigned')
        .maybeSingle()

      // Tear down in reverse order: Retell first (so it stops
      // trying to route calls to a number we're about to kill),
      // then Telnyx (billing stops).
      const retellReleased = await retellDeletePhoneNumber(client.onboarding_phone)

      let telnyxReleased = false
      if (pool?.telnyx_phone_id && getApiKey()) {
        telnyxReleased = await deleteNumber(pool.telnyx_phone_id)
      }

      if (pool?.id) {
        await s
          .from('koto_onboarding_phone_pool')
          .update({
            status: telnyxReleased ? 'released' : 'released_local_only',
            assigned_to_client_id: null,
            assigned_to_agency_id: null,
            released_at: new Date().toISOString(),
          })
          .eq('id', pool.id)
      }

      await s
        .from('clients')
        .update({
          onboarding_phone: null,
          onboarding_phone_display: null,
          onboarding_pin: null,
          onboarding_phone_assigned_at: null,
          onboarding_phone_expires_at: null,
        })
        .eq('id', client_id)

      return NextResponse.json({
        ok: true,
        released: client.onboarding_phone,
        retell_deleted: retellReleased,
        telnyx_deleted: telnyxReleased,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
