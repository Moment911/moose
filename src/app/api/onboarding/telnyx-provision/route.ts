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

async function retellAssignAgent(args: {
  phoneNumber: string
  inboundAgentId: string
}): Promise<{ ok: boolean; error: string | null }> {
  if (!process.env.RETELL_API_KEY) {
    return { ok: false, error: 'RETELL_API_KEY not configured' }
  }
  try {
    const res = await fetch(`${RETELL_API_BASE}/update-phone-number/${encodeURIComponent(args.phoneNumber)}`, {
      method: 'PATCH',
      headers: retellHeaders(),
      body: JSON.stringify({ inbound_agent_id: args.inboundAgentId }),
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

// ─────────────────────────────────────────────────────────────
// POST handler — provision + release
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
      if (!getApiKey()) {
        return NextResponse.json({ error: 'TELNYX_API_KEY not configured' }, { status: 500 })
      }

      // If this client already has an active assignment, return it
      // instead of buying another number.
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
        return NextResponse.json({
          ok: true,
          already_assigned: true,
          phone_number: existing.onboarding_phone,
          display_number: existing.onboarding_phone_display,
          pin: existing.onboarding_pin,
          expires_at: existing.onboarding_phone_expires_at,
        })
      }

      // 1. Find an available number — try the preferred area code
      // first, then a short list of common US ones, then any.
      const areaCodesToTry: (string | null)[] = area_code
        ? [area_code, '800', null]
        : ['561', '305', '954', '800', null]

      let selectedNumber: string | null = null
      for (const ac of areaCodesToTry) {
        selectedNumber = await searchAvailableNumber(ac)
        if (selectedNumber) break
      }

      if (!selectedNumber) {
        return NextResponse.json({ error: 'No phone numbers available from Telnyx' }, { status: 500 })
      }

      // 2. Order it
      const { orderId, error: orderError } = await orderNumber(selectedNumber)
      if (orderError) {
        return NextResponse.json({ error: orderError }, { status: 500 })
      }

      // 3. Wait for Telnyx to process, then fetch the phone number id
      await new Promise((r) => setTimeout(r, 2000))
      const phoneNumberId = await fetchPhoneNumberId(selectedNumber)
      if (!phoneNumberId) {
        return NextResponse.json({
          error: 'Number ordered but could not retrieve id from Telnyx. Check the Telnyx dashboard and try again.',
          ordered_number: selectedNumber,
          order_id: orderId,
        }, { status: 500 })
      }

      // 4. Assign to the Telnyx voice connection so Telnyx routes
      // the call into the Retell BYOC trunk. Not fatal if it fails —
      // the agency can fix it from the Telnyx dashboard.
      const connectionOk = await assignConnection(phoneNumberId)

      // 5. Import the number into Retell via the BYOC path. This is
      // the step that tells Retell the number exists. Without it,
      // Retell will 404 on any inbound call to the number.
      const connectionId = getConnectionId()
      const retellImport = await retellImportCarrierNumber({
        phoneNumber: selectedNumber,
        connectionId,
      })
      if (!retellImport.ok) {
        // Retell import failed — roll back the Telnyx order so we
        // don't leave an orphan number on the account.
        await deleteNumber(phoneNumberId).catch(() => {})
        return NextResponse.json({
          error: `Retell import failed: ${retellImport.error}. Telnyx order was rolled back.`,
        }, { status: 500 })
      }

      // 6. Look up the agency's onboarding agent and assign it to
      // the imported number so inbound calls actually route to our
      // webhook. If no onboarding agent exists yet, the provision
      // still succeeds but we return a warning so the agency knows
      // to click "Create Retell Onboarding Agent" in Agency Settings
      // and retry.
      const { data: agency } = await s
        .from('agencies')
        .select('onboarding_agent_id, brand_name, name')
        .eq('id', agency_id)
        .maybeSingle()

      const inboundAgentId = agency?.onboarding_agent_id || null
      let agentAssignOk = false
      let agentAssignError: string | null = null
      if (inboundAgentId) {
        const assignRes = await retellAssignAgent({
          phoneNumber: selectedNumber,
          inboundAgentId,
        })
        agentAssignOk = assignRes.ok
        agentAssignError = assignRes.error
      } else {
        agentAssignError = 'No onboarding agent configured for this agency — create one in Agency Settings → Onboarding → Voice Onboarding, then release and re-provision this number.'
      }

      // 7. Generate PIN + save everything
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
        // Pool write failed — roll back both Retell and Telnyx so we
        // don't leave orphans on either side.
        await retellDeletePhoneNumber(selectedNumber).catch(() => {})
        await deleteNumber(phoneNumberId).catch(() => {})
        return NextResponse.json({ error: 'Failed to save pool entry: ' + poolError.message }, { status: 500 })
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

      return NextResponse.json({
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
      })
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
