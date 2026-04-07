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

function twilioAuth() {
  return 'Basic ' + Buffer.from(`${TWILIO_SID()}:${TWILIO_TOKEN()}`).toString('base64')
}

/* ── GET ─────────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const action = p.get('action')
  const agencyId = p.get('agency_id')
  const s = sb()

  /* ── list: all phone numbers for an agency ── */
  if (action === 'list') {
    if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    let q = s.from('koto_phone_numbers').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false })
    const status = p.get('status')
    const type = p.get('type')
    const purpose = p.get('purpose')
    if (status) q = q.eq('status', status)
    if (type) q = q.eq('type', type)
    if (purpose) q = q.eq('purpose', purpose)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  }

  /* ── available: search Twilio for available numbers ── */
  if (action === 'available') {
    const areaCode = p.get('area_code') || ''
    const numType = p.get('type') || 'local'
    const sid = TWILIO_SID()
    if (!sid) return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })

    const typeMap: Record<string, string> = { local: 'Local', tollfree: 'TollFree', mobile: 'Mobile' }
    const twilioType = typeMap[numType] || 'Local'
    const url = new URL(`https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/US/${twilioType}.json`)
    if (areaCode) url.searchParams.set('AreaCode', areaCode)
    url.searchParams.set('PageSize', '20')

    try {
      const res = await fetch(url.toString(), { headers: { Authorization: twilioAuth() } })
      const json = await res.json()
      if (!res.ok) return NextResponse.json({ error: json.message || 'Twilio error' }, { status: res.status })
      const numbers = (json.available_phone_numbers || []).map((n: Record<string, unknown>) => ({
        phone_number: n.phone_number,
        friendly_name: n.friendly_name,
        locality: n.locality,
        region: n.region,
        capabilities: n.capabilities,
      }))
      return NextResponse.json(numbers)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Twilio search failed'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  /* ── stats: aggregate stats for agency ── */
  if (action === 'stats') {
    if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const { data: all, error } = await s.from('koto_phone_numbers').select('*').eq('agency_id', agencyId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const nums = all || []
    const active = nums.filter((n: Record<string, unknown>) => n.status === 'active')
    const totalCost = active.reduce((sum: number, n: Record<string, unknown>) => sum + (Number(n.monthly_cost) || 0), 0)
    const byType: Record<string, number> = {}
    const byPurpose: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    for (const n of nums) {
      const rec = n as Record<string, unknown>
      byType[rec.type as string || 'local'] = (byType[rec.type as string || 'local'] || 0) + 1
      byPurpose[rec.purpose as string || 'voice'] = (byPurpose[rec.purpose as string || 'voice'] || 0) + 1
      byStatus[rec.status as string || 'active'] = (byStatus[rec.status as string || 'active'] || 0) + 1
    }
    const sorted = [...nums].sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
      new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
    )
    return NextResponse.json({
      total: nums.length,
      active: active.length,
      monthly_cost: Math.round(totalCost * 100) / 100,
      by_type: byType,
      by_purpose: byPurpose,
      by_status: byStatus,
      last_purchased: sorted[0]?.created_at || null,
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

/* ── POST ────────────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, agency_id } = body
  const s = sb()

  /* ── purchase: buy number from Twilio ── */
  if (action === 'purchase') {
    const { phone_number, friendly_name, type, purpose } = body
    if (!agency_id || !phone_number) return NextResponse.json({ error: 'agency_id and phone_number required' }, { status: 400 })

    const sid = TWILIO_SID()
    if (!sid) return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })

    // Purchase from Twilio
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

      // Save to DB
      const monthlyCost = type === 'tollfree' ? 2.15 : 1.45
      const { data, error } = await s.from('koto_phone_numbers').insert({
        agency_id,
        phone_number,
        friendly_name: friendly_name || json.friendly_name || phone_number,
        type: type || 'local',
        provider: 'twilio',
        provider_sid: json.sid,
        status: 'active',
        purpose: purpose || 'voice',
        monthly_cost: monthlyCost,
        capabilities: json.capabilities || { voice: true, sms: true, mms: false },
      }).select().single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Record usage in billing
      try {
        await fetch(new URL('/api/billing', req.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'record_usage',
            agency_id,
            feature: 'phone_number',
            quantity: 1,
            unit_cost: monthlyCost,
            description: `Purchased phone number ${phone_number}`,
          }),
        })
      } catch (_) { /* billing record is best-effort */ }

      return NextResponse.json(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Purchase failed'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  /* ── release: release number back to Twilio ── */
  if (action === 'release') {
    const { phone_id } = body
    if (!phone_id) return NextResponse.json({ error: 'phone_id required' }, { status: 400 })

    // Get current record
    const { data: existing } = await s.from('koto_phone_numbers').select('*').eq('id', phone_id).single()
    if (!existing) return NextResponse.json({ error: 'Number not found' }, { status: 404 })

    // Release from Twilio
    if (existing.provider_sid) {
      const sid = TWILIO_SID()
      try {
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${existing.provider_sid}.json`, {
          method: 'DELETE',
          headers: { Authorization: twilioAuth() },
        })
      } catch (_) { /* best-effort release from Twilio */ }
    }

    // Mark as released in DB
    const { data, error } = await s.from('koto_phone_numbers')
      .update({ status: 'released', updated_at: new Date().toISOString() })
      .eq('id', phone_id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  /* ── assign: assign number to client / agent ── */
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

  /* ── update: update friendly_name, purpose, etc. ── */
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
