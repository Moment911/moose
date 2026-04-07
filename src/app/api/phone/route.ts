import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const TWILIO_SID = () => process.env.TWILIO_ACCOUNT_SID || ''
const TWILIO_TOKEN = () => process.env.TWILIO_AUTH_TOKEN || ''
const TELNYX_KEY = () => process.env.TELNYX_API_KEY || ''

function twilioAuth() {
  return 'Basic ' + Buffer.from(`${TWILIO_SID()}:${TWILIO_TOKEN()}`).toString('base64')
}
function telnyxHeaders() {
  return { Authorization: `Bearer ${TELNYX_KEY()}`, 'Content-Type': 'application/json' }
}

/* ── GET ─────────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const action = p.get('action')
  const agencyId = p.get('agency_id')
  const s = sb()

  if (action === 'list') {
    const isSuperAdmin = p.get('super_admin') === 'true'
    let q = s.from('koto_phone_numbers').select('*').order('created_at', { ascending: false })
    if (!isSuperAdmin) {
      if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
      q = q.eq('agency_id', agencyId)
    }
    const status = p.get('status')
    const type = p.get('type')
    const purpose = p.get('purpose')
    const provider = p.get('provider')
    if (status) q = q.eq('status', status)
    if (type) q = q.eq('type', type)
    if (purpose) q = q.eq('purpose', purpose)
    if (provider) q = q.eq('provider', provider)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  }

  if (action === 'available') {
    const areaCode = p.get('area_code') || ''
    const numType = p.get('type') || 'local'
    const provider = p.get('provider') || 'twilio'

    if (provider === 'telnyx') {
      const key = TELNYX_KEY()
      if (!key) return NextResponse.json({ error: 'Telnyx not configured' }, { status: 500 })
      try {
        const params = new URLSearchParams({ 'filter[country_code]': 'US', 'filter[limit]': '20' })
        if (numType === 'tollfree') {
          params.set('filter[number_type]', 'toll_free')
        } else {
          params.set('filter[number_type]', 'local')
          if (areaCode) params.set('filter[national_destination_code]', areaCode)
        }
        const res = await fetch(`https://api.telnyx.com/v2/available_phone_numbers?${params}`, { headers: telnyxHeaders() })
        const json = await res.json()
        if (!res.ok) return NextResponse.json({ error: json.errors?.[0]?.detail || 'Telnyx error' }, { status: res.status })
        const numbers = (json.data || []).map((n: any) => ({
          phone_number: n.phone_number,
          friendly_name: n.phone_number,
          locality: n.locality || n.region_information?.[0]?.region_name || '',
          region: n.region_information?.[0]?.region_type === 'state' ? n.region_information[0].region_name : '',
          provider: 'telnyx',
          features: n.features || [],
          cost_monthly: numType === 'tollfree' ? 2.00 : 1.00,
          cost_setup: 0,
        }))
        return NextResponse.json(numbers)
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
      }
    }

    // Twilio
    const sid = TWILIO_SID()
    if (!sid) return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
    const typeMap: Record<string, string> = { local: 'Local', tollfree: 'TollFree', mobile: 'Mobile' }
    const url = new URL(`https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/US/${typeMap[numType] || 'Local'}.json`)
    if (areaCode) url.searchParams.set('AreaCode', areaCode)
    url.searchParams.set('PageSize', '20')
    try {
      const res = await fetch(url.toString(), { headers: { Authorization: twilioAuth() } })
      const json = await res.json()
      if (!res.ok) return NextResponse.json({ error: json.message || 'Twilio error' }, { status: res.status })
      const numbers = (json.available_phone_numbers || []).map((n: any) => ({
        phone_number: n.phone_number,
        friendly_name: n.friendly_name,
        locality: n.locality,
        region: n.region,
        capabilities: n.capabilities,
        provider: 'twilio',
        cost_monthly: numType === 'tollfree' ? 2.15 : 1.15,
        cost_setup: 1.00,
      }))
      return NextResponse.json(numbers)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'stats') {
    if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const { data: all, error } = await s.from('koto_phone_numbers').select('*').eq('agency_id', agencyId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const nums = all || []
    const active = nums.filter((n: any) => n.status === 'active')
    const totalCost = active.reduce((sum: number, n: any) => sum + (Number(n.monthly_cost) || 0), 0)
    const byType: Record<string, number> = {}
    const byProvider: Record<string, number> = {}
    for (const n of nums) {
      byType[n.type || 'local'] = (byType[n.type || 'local'] || 0) + 1
      byProvider[n.provider || 'twilio'] = (byProvider[n.provider || 'twilio'] || 0) + 1
    }
    return NextResponse.json({
      total: nums.length, active: active.length,
      monthly_cost: Math.round(totalCost * 100) / 100,
      by_type: byType, by_provider: byProvider,
      last_purchased: nums[0]?.created_at || null,
      twilio_configured: !!TWILIO_SID(),
      telnyx_configured: !!TELNYX_KEY(),
    })
  }

  if (action === 'providers') {
    return NextResponse.json({
      twilio: { configured: !!TWILIO_SID(), name: 'Twilio', local_cost: 1.15, tollfree_cost: 2.15, setup_fee: 1.00, features: ['Established provider', 'Worldwide coverage', 'Rich SMS/MMS', 'Programmable voice'] },
      telnyx: { configured: !!TELNYX_KEY(), name: 'Telnyx', local_cost: 1.00, tollfree_cost: 2.00, setup_fee: 0, features: ['No setup fees', 'Local presence dialing', 'Lower per-minute rates', 'Number porting', 'Mission control portal', 'SIP trunking'] },
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

/* ── POST ────────────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, agency_id } = body
  const s = sb()

  if (action === 'purchase') {
    const { phone_number, friendly_name, type, purpose, provider } = body
    if (!agency_id || !phone_number) return NextResponse.json({ error: 'agency_id and phone_number required' }, { status: 400 })

    if (provider === 'telnyx') {
      const key = TELNYX_KEY()
      if (!key) return NextResponse.json({ error: 'Telnyx not configured' }, { status: 500 })
      try {
        // Order number from Telnyx
        const res = await fetch('https://api.telnyx.com/v2/number_orders', {
          method: 'POST', headers: telnyxHeaders(),
          body: JSON.stringify({ phone_numbers: [{ phone_number }] }),
        })
        const json = await res.json()
        if (!res.ok) return NextResponse.json({ error: json.errors?.[0]?.detail || 'Telnyx purchase failed' }, { status: res.status })

        const orderId = json.data?.id
        const monthlyCost = type === 'tollfree' ? 2.00 : 1.00
        const { data, error } = await s.from('koto_phone_numbers').insert({
          agency_id, phone_number,
          friendly_name: friendly_name || phone_number,
          type: type || 'local', provider: 'telnyx',
          provider_sid: orderId, status: 'active',
          purpose: purpose || 'voice', monthly_cost: monthlyCost,
          capabilities: { voice: true, sms: true, mms: false, local_presence: true },
        }).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Record billing
        try {
          await fetch(new URL('/api/billing', req.url).toString(), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'record_usage', agency_id, feature: 'phone_number', quantity: 1, unit: 'number', unit_cost: monthlyCost }),
          })
        } catch {}

        return NextResponse.json(data)
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
      }
    }

    // Twilio purchase
    const sid = TWILIO_SID()
    if (!sid) return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
    try {
      const params = new URLSearchParams()
      params.set('PhoneNumber', phone_number)
      if (friendly_name) params.set('FriendlyName', friendly_name)
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`, {
        method: 'POST',
        headers: { Authorization: twilioAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })
      const json = await res.json()
      if (!res.ok) return NextResponse.json({ error: json.message || 'Purchase failed' }, { status: res.status })

      const monthlyCost = type === 'tollfree' ? 2.15 : 1.15
      const { data, error } = await s.from('koto_phone_numbers').insert({
        agency_id, phone_number,
        friendly_name: friendly_name || json.friendly_name || phone_number,
        type: type || 'local', provider: 'twilio',
        provider_sid: json.sid, status: 'active',
        purpose: purpose || 'voice', monthly_cost: monthlyCost,
        capabilities: json.capabilities || { voice: true, sms: true, mms: false },
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      try {
        await fetch(new URL('/api/billing', req.url).toString(), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'record_usage', agency_id, feature: 'phone_number', quantity: 1, unit: 'number', unit_cost: monthlyCost }),
        })
      } catch {}

      return NextResponse.json(data)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'release') {
    const { phone_id } = body
    if (!phone_id) return NextResponse.json({ error: 'phone_id required' }, { status: 400 })
    const { data: existing } = await s.from('koto_phone_numbers').select('*').eq('id', phone_id).single()
    if (!existing) return NextResponse.json({ error: 'Number not found' }, { status: 404 })

    if (existing.provider === 'telnyx' && existing.phone_number) {
      try {
        await fetch(`https://api.telnyx.com/v2/phone_numbers/${encodeURIComponent(existing.phone_number)}`, {
          method: 'DELETE', headers: telnyxHeaders(),
        })
      } catch {}
    } else if (existing.provider_sid) {
      try {
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID()}/IncomingPhoneNumbers/${existing.provider_sid}.json`, {
          method: 'DELETE', headers: { Authorization: twilioAuth() },
        })
      } catch {}
    }

    const { data, error } = await s.from('koto_phone_numbers')
      .update({ status: 'released', updated_at: new Date().toISOString() })
      .eq('id', phone_id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (action === 'assign') {
    const { phone_id, client_id, assigned_agent_id, assigned_agent_type } = body
    if (!phone_id) return NextResponse.json({ error: 'phone_id required' }, { status: 400 })
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (client_id !== undefined) updates.client_id = client_id
    if (assigned_agent_id !== undefined) updates.assigned_agent_id = assigned_agent_id
    if (assigned_agent_type !== undefined) updates.assigned_agent_type = assigned_agent_type
    const { data, error } = await s.from('koto_phone_numbers').update(updates).eq('id', phone_id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (action === 'update') {
    const { phone_id, friendly_name, purpose, status } = body
    if (!phone_id) return NextResponse.json({ error: 'phone_id required' }, { status: 400 })
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (friendly_name !== undefined) updates.friendly_name = friendly_name
    if (purpose !== undefined) updates.purpose = purpose
    if (status !== undefined) updates.status = status
    const { data, error } = await s.from('koto_phone_numbers').update(updates).eq('id', phone_id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
