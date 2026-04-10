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

      // 4. Assign to the onboarding connection so inbound calls hit
      // our voice webhook. Not fatal if this fails — the agency can
      // fix it from the Telnyx dashboard.
      const connectionOk = await assignConnection(phoneNumberId)

      // 5. Generate PIN + save everything
      const pin = generatePin()
      const displayNumber = formatDisplayNumber(selectedNumber)
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const connectionId = getConnectionId()

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
        // Pool write failed — try to roll back the Telnyx order so we
        // don't leave an orphan number on the account.
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
        telnyx_deleted: telnyxReleased,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
