// Per-client Telnyx number management. One number per client handles both
// inbound calls (via Retell BYOC) and outbound SMS. Release = fully delete
// from Telnyx so the number stops billing.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TELNYX_KEY = () => process.env.TELNYX_API_KEY || ''
const TELNYX_MESSAGING_PROFILE_ID = () => process.env.TELNYX_MESSAGING_PROFILE_ID || ''

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function telnyxFetch(path: string, method = 'GET', body?: any) {
  const res = await fetch(`https://api.telnyx.com/v2${path}`, {
    method,
    headers: { Authorization: `Bearer ${TELNYX_KEY()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.errors?.[0]?.detail || `Telnyx ${res.status}`)
  return data
}

// GET /api/telnyx/numbers?agency_id=X&client_id=Y
// Lists numbers in our DB for this agency + client (if provided). Each row has
// the DB metadata plus status flags we pulled from Telnyx at assignment time.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agency_id = searchParams.get('agency_id')
  const client_id = searchParams.get('client_id')
  const agent_id = searchParams.get('agent_id')
  if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
  let q = sb().from('koto_telnyx_numbers').select('*').eq('agency_id', agency_id).order('created_at', { ascending: false })
  if (client_id) q = q.eq('client_id', client_id)
  if (agent_id) q = q.eq('agent_id', agent_id)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ numbers: data || [] })
}

// POST /api/telnyx/numbers
// Actions: search_available, provision, release, assign, unassign
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body
  if (!TELNYX_KEY()) return NextResponse.json({ error: 'TELNYX_API_KEY not configured' }, { status: 500 })

  // ── Search Telnyx inventory for numbers you can buy ────────────────────
  if (action === 'search_available') {
    const { area_code, limit = 20, country_code = 'US', features = ['voice', 'sms'] } = body
    try {
      const res = await telnyxFetch('/available_phone_numbers', 'POST', {
        filter: {
          country_code,
          national_destination_code: area_code ? String(area_code) : undefined,
          features,
          limit,
        },
      })
      const numbers = (res.data || []).map((n: any) => ({
        phone_number: n.phone_number,
        region: n.region_information?.[0]?.region_name,
        rate_center: n.region_information?.find((r: any) => r.region_type === 'rate_center')?.region_name,
        features: (n.features || []).map((f: any) => f.name),
        cost_monthly: n.cost_information?.monthly_cost,
      }))
      return NextResponse.json({ numbers })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'search failed' }, { status: 500 })
    }
  }

  // ── Provision: buy the number from Telnyx + save the row ───────────────
  if (action === 'provision') {
    const { agency_id, client_id, agent_id, phone_number, nickname } = body
    if (!agency_id || !phone_number) return NextResponse.json({ error: 'agency_id and phone_number required' }, { status: 400 })

    try {
      // 1. Create the number order
      const order = await telnyxFetch('/number_orders', 'POST', {
        phone_numbers: [{ phone_number }],
        messaging_profile_id: TELNYX_MESSAGING_PROFILE_ID() || undefined,
      })

      // 2. Find the resulting phone_number_id — Telnyx numbers are usable
      // immediately once the order status is "success" (usually synchronous).
      let telnyxPhoneId: string | null = null
      try {
        const lookup = await telnyxFetch(`/phone_numbers?filter[phone_number]=${encodeURIComponent(phone_number)}`)
        telnyxPhoneId = lookup.data?.[0]?.id || null
      } catch {}

      // 3. Make sure messaging is enabled on this number
      if (telnyxPhoneId && TELNYX_MESSAGING_PROFILE_ID()) {
        try {
          await telnyxFetch(`/phone_numbers/${telnyxPhoneId}/messaging`, 'PATCH', {
            messaging_profile_id: TELNYX_MESSAGING_PROFILE_ID(),
          })
        } catch {}
      }

      // 4. Persist in our DB
      const { data: row, error } = await sb().from('koto_telnyx_numbers').insert({
        agency_id,
        client_id: client_id || null,
        agent_id: agent_id || null,
        phone_number,
        telnyx_phone_id: telnyxPhoneId,
        order_id: order.data?.id || null,
        nickname: nickname || null,
        status: 'active',
        features: ['voice', 'sms'],
      }).select().maybeSingle()
      if (error) {
        // Roll back: release the Telnyx number if we can't save it
        if (telnyxPhoneId) {
          try { await telnyxFetch(`/phone_numbers/${telnyxPhoneId}`, 'DELETE') } catch {}
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // 5. Optionally attach to the agent (sets phone_number + telnyx_number_id)
      if (agent_id) {
        await sb().from('koto_inbound_agents').update({
          phone_number,
          telnyx_number_id: telnyxPhoneId,
        }).eq('id', agent_id)
      }

      return NextResponse.json({ success: true, number: row })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'provision failed' }, { status: 500 })
    }
  }

  // ── Release: delete from Telnyx + from DB. This stops billing. ─────────
  if (action === 'release') {
    const { id, phone_number } = body
    if (!id && !phone_number) return NextResponse.json({ error: 'id or phone_number required' }, { status: 400 })

    // Find the row so we have the Telnyx id to delete
    let q = sb().from('koto_telnyx_numbers').select('*')
    if (id) q = q.eq('id', id)
    else q = q.eq('phone_number', phone_number)
    const { data: row } = await q.maybeSingle()

    const telnyxPhoneId = row?.telnyx_phone_id
    if (telnyxPhoneId) {
      try {
        await telnyxFetch(`/phone_numbers/${telnyxPhoneId}`, 'DELETE')
      } catch (e: any) {
        console.error('[telnyx/release] delete failed (continuing):', e?.message)
      }
    }

    // Remove from DB
    if (row?.id) await sb().from('koto_telnyx_numbers').delete().eq('id', row.id)
    else if (phone_number) await sb().from('koto_telnyx_numbers').delete().eq('phone_number', phone_number)

    // Detach from any agents that had it assigned
    const num = row?.phone_number || phone_number
    if (num) {
      await sb().from('koto_inbound_agents').update({ phone_number: null, telnyx_number_id: null }).eq('phone_number', num)
    }

    return NextResponse.json({ success: true })
  }

  // ── Assign an already-provisioned number to a specific agent ───────────
  if (action === 'assign') {
    const { id, agent_id, client_id } = body
    if (!id || !agent_id) return NextResponse.json({ error: 'id and agent_id required' }, { status: 400 })
    const { data: row } = await sb().from('koto_telnyx_numbers').select('*').eq('id', id).maybeSingle()
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    await sb().from('koto_telnyx_numbers').update({ agent_id, client_id: client_id || row.client_id }).eq('id', id)
    await sb().from('koto_inbound_agents').update({ phone_number: row.phone_number, telnyx_number_id: row.telnyx_phone_id }).eq('id', agent_id)
    return NextResponse.json({ success: true })
  }

  // ── Unassign: keep the number provisioned at Telnyx but detach agent ──
  if (action === 'unassign') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data: row } = await sb().from('koto_telnyx_numbers').select('agent_id, phone_number').eq('id', id).maybeSingle()
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    await sb().from('koto_telnyx_numbers').update({ agent_id: null }).eq('id', id)
    if (row.agent_id) {
      await sb().from('koto_inbound_agents').update({ phone_number: null, telnyx_number_id: null }).eq('id', row.agent_id)
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
}

// DELETE /api/telnyx/numbers?id=X
// Convenience for release from a DELETE request (same semantics as action=release).
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const phone_number = searchParams.get('phone_number')
  if (!id && !phone_number) return NextResponse.json({ error: 'id or phone_number required' }, { status: 400 })

  let q = sb().from('koto_telnyx_numbers').select('*')
  if (id) q = q.eq('id', id)
  else if (phone_number) q = q.eq('phone_number', phone_number)
  const { data: row } = await q.maybeSingle()

  if (row?.telnyx_phone_id) {
    try { await telnyxFetch(`/phone_numbers/${row.telnyx_phone_id}`, 'DELETE') } catch (e: any) {
      console.error('[telnyx/DELETE] release failed (continuing):', e?.message)
    }
  }
  if (row?.id) await sb().from('koto_telnyx_numbers').delete().eq('id', row.id)
  const num = row?.phone_number || phone_number
  if (num) await sb().from('koto_telnyx_numbers').delete().eq('phone_number', num)
  if (num) await sb().from('koto_inbound_agents').update({ phone_number: null, telnyx_number_id: null }).eq('phone_number', num)

  return NextResponse.json({ success: true })
}
