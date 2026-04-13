import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncLeadToGHL, testGHLConnection } from '@/lib/goHighLevelSync'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'get_integration'
    const agencyId = searchParams.get('agency_id') || ''
    const s = sb()

    if (action === 'get_integration') {
      const { data } = await s.from('koto_ghl_integrations').select('*').eq('agency_id', agencyId).maybeSingle()
      return Response.json({ data })
    }

    if (action === 'get_sync_log') {
      const { data } = await s.from('koto_ghl_sync_log').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }).limit(50)
      return Response.json({ data: data || [] })
    }

    // List all GHL locations the agency API key has access to
    if (action === 'get_locations') {
      const { data: integration } = await s.from('koto_ghl_integrations').select('*').eq('agency_id', agencyId).maybeSingle()
      if (!integration || !integration.ghl_api_key) return Response.json({ error: 'GHL not connected' }, { status: 400 })

      try {
        // GHL API: list locations under this company
        const headers: Record<string, string> = { 'Authorization': `Bearer ${integration.ghl_api_key}`, 'Content-Type': 'application/json', 'Version': '2021-07-28' }
        const res = await fetch(`https://services.leadconnectorhq.com/locations/search?companyId=${integration.ghl_company_id || ''}&limit=100`, { headers, signal: AbortSignal.timeout(10000) })
        if (res.ok) {
          const data = await res.json()
          return Response.json({ locations: (data.locations || []).map((l: any) => ({ id: l.id, name: l.name, address: l.address, city: l.city, state: l.state, phone: l.phone })) })
        }
        // Fallback: return just the connected location
        return Response.json({ locations: [{ id: integration.ghl_location_id, name: integration.ghl_location_name || 'Default Location' }] })
      } catch {
        return Response.json({ locations: [{ id: integration.ghl_location_id, name: integration.ghl_location_name || 'Default Location' }] })
      }
    }

    // List all client → GHL location mappings
    if (action === 'get_client_mappings') {
      const { data } = await s.from('koto_ghl_client_mappings').select('*, clients:client_id(id, name, phone, industry)').eq('agency_id', agencyId).order('created_at', { ascending: false })
      return Response.json({ mappings: data || [] })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action
    const s = sb()

    if (action === 'connect') {
      const { agency_id, api_key, location_id } = body
      if (!api_key || !location_id) return Response.json({ error: 'api_key and location_id required' }, { status: 400 })

      // Test connection
      const test = await testGHLConnection(api_key, location_id)
      if (!test.success) return Response.json({ error: test.error || 'Connection failed' }, { status: 400 })

      // Upsert integration
      const { data: existing } = await s.from('koto_ghl_integrations').select('id').eq('agency_id', agency_id).maybeSingle()

      if (existing) {
        await s.from('koto_ghl_integrations').update({
          ghl_api_key: api_key,
          ghl_location_id: location_id,
          status: 'active',
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id)
      } else {
        await s.from('koto_ghl_integrations').insert({
          agency_id,
          ghl_api_key: api_key,
          ghl_location_id: location_id,
          status: 'active',
          connection_type: 'api_key',
        })
      }

      return Response.json({ success: true, location_name: test.locationName, contact_count: test.contactCount })
    }

    if (action === 'disconnect') {
      await s.from('koto_ghl_integrations').update({ status: 'disconnected' }).eq('agency_id', body.agency_id)
      return Response.json({ success: true })
    }

    if (action === 'test_connection') {
      const { data: integration } = await s.from('koto_ghl_integrations').select('*').eq('agency_id', body.agency_id).single()
      if (!integration) return Response.json({ error: 'No integration found' }, { status: 404 })
      const test = await testGHLConnection(integration.ghl_api_key, integration.ghl_location_id)
      return Response.json(test)
    }

    if (action === 'sync_lead') {
      const ghlId = await syncLeadToGHL(body.agency_id, body.lead || { id: body.lead_id })
      return Response.json({ success: !!ghlId, ghl_contact_id: ghlId })
    }

    if (action === 'update_settings') {
      const { agency_id, ...settings } = body
      delete settings.action
      await s.from('koto_ghl_integrations').update({ ...settings, updated_at: new Date().toISOString() }).eq('agency_id', agency_id)
      return Response.json({ success: true })
    }

    // ── Assign a client to a GHL location ──
    if (action === 'assign_client') {
      const { agency_id, client_id, ghl_location_id, ghl_location_name } = body
      if (!client_id || !ghl_location_id) return Response.json({ error: 'client_id and ghl_location_id required' }, { status: 400 })

      const { data: existing } = await s.from('koto_ghl_client_mappings').select('id').eq('client_id', client_id).eq('agency_id', agency_id).maybeSingle()

      if (existing) {
        await s.from('koto_ghl_client_mappings').update({
          ghl_location_id, ghl_location_name: ghl_location_name || '', status: 'active', updated_at: new Date().toISOString(),
        }).eq('id', existing.id)
      } else {
        await s.from('koto_ghl_client_mappings').insert({
          agency_id, client_id, ghl_location_id, ghl_location_name: ghl_location_name || '', status: 'active',
        })
      }

      // Also update the client record
      await s.from('clients').update({ ghl_location_id }).eq('id', client_id)

      return Response.json({ success: true })
    }

    // ── Disconnect a client from GHL ──
    if (action === 'disconnect_client') {
      const { agency_id, client_id } = body
      if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 })

      await s.from('koto_ghl_client_mappings').update({ status: 'disconnected' }).eq('client_id', client_id).eq('agency_id', agency_id)
      await s.from('clients').update({ ghl_location_id: null, ghl_contact_id: null }).eq('id', client_id)

      return Response.json({ success: true })
    }

    // ── Disconnect agency from GHL entirely ──
    if (action === 'disconnect_agency') {
      const { agency_id } = body
      if (!agency_id) return Response.json({ error: 'agency_id required' }, { status: 400 })

      // Disconnect integration
      await s.from('koto_ghl_integrations').update({ status: 'disconnected', ghl_api_key: null }).eq('agency_id', agency_id)

      // Disconnect all client mappings
      await s.from('koto_ghl_client_mappings').update({ status: 'disconnected' }).eq('agency_id', agency_id)

      // Clear GHL IDs from all clients
      await s.from('clients').update({ ghl_location_id: null, ghl_contact_id: null }).eq('agency_id', agency_id)

      return Response.json({ success: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
