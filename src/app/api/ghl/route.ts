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

    // Get OAuth URL for per-client GHL connection
    if (action === 'get_client_oauth_url') {
      const clientId = searchParams.get('client_id')
      if (!clientId) return Response.json({ error: 'Missing client_id' }, { status: 400 })

      const GHL_CLIENT_ID = process.env.GHL_CLIENT_ID || process.env.NEXT_PUBLIC_GHL_CLIENT_ID
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
      if (!GHL_CLIENT_ID) return Response.json({ error: 'GHL_CLIENT_ID not configured' }, { status: 500 })

      const redirectUri = `${appUrl}/api/integrations/ghl/callback`
      const state = `${agencyId}:${clientId}`
      const scopes = 'contacts.readonly contacts.write locations.readonly calendars.readonly calendars.write opportunities.readonly opportunities.write'
      const url = `https://marketplace.leadconnectorhq.com/oauth/chooselocation?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${GHL_CLIENT_ID}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`

      return Response.json({ url })
    }

    // Get per-client GHL connection status
    if (action === 'get_client_ghl') {
      const clientId = searchParams.get('client_id')
      if (!clientId) return Response.json({ error: 'Missing client_id' }, { status: 400 })
      const { data } = await s.from('koto_ghl_client_mappings').select('*').eq('client_id', clientId).eq('agency_id', agencyId).eq('status', 'active').maybeSingle()
      return Response.json({ connection: data || null, connected: !!data?.access_token })
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

    // ── Connect client using Private Integration Token (no OAuth) ──
    if (action === 'connect_client_direct') {
      const { agency_id, client_id, location_id } = body
      if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 })

      const pitToken = process.env.GHL_CLIENT_ID || process.env.NEXT_PUBLIC_GHL_CLIENT_ID || ''
      if (!pitToken) return Response.json({ error: 'GHL token not configured' }, { status: 500 })

      // Test connection with the pit token
      let locationName = 'GHL Location'
      try {
        const headers = { 'Authorization': `Bearer ${pitToken}`, 'Content-Type': 'application/json', 'Version': '2021-07-28' }
        if (location_id) {
          const locRes = await fetch(`https://services.leadconnectorhq.com/locations/${location_id}`, { headers, signal: AbortSignal.timeout(10000) })
          if (locRes.ok) {
            const locData = await locRes.json()
            locationName = locData.location?.name || locData.name || locationName
          }
        }
      } catch {}

      // Upsert client mapping
      const { data: existing } = await s.from('koto_ghl_client_mappings').select('id').eq('client_id', client_id).eq('agency_id', agency_id).maybeSingle()
      const record = {
        agency_id, client_id,
        access_token: pitToken,
        ghl_location_id: location_id || null,
        ghl_location_name: locationName,
        connection_type: 'private_integration',
        status: 'active',
        updated_at: new Date().toISOString(),
      }

      if (existing) {
        await s.from('koto_ghl_client_mappings').update(record).eq('id', existing.id)
      } else {
        await s.from('koto_ghl_client_mappings').insert(record)
      }

      // Also upsert agency-level integration
      const { data: agencyInt } = await s.from('koto_ghl_integrations').select('id').eq('agency_id', agency_id).maybeSingle()
      if (!agencyInt) {
        await s.from('koto_ghl_integrations').insert({ agency_id, ghl_api_key: pitToken, ghl_location_id: location_id || null, ghl_location_name: locationName, status: 'active', connection_type: 'private_integration' })
      }

      return Response.json({ success: true, location_name: locationName })
    }

    // ── Disconnect a client from GHL ──
    if (action === 'disconnect_client') {
      const { agency_id, client_id } = body
      if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 })

      await s.from('koto_ghl_client_mappings').update({ status: 'disconnected' }).eq('client_id', client_id).eq('agency_id', agency_id)
      await s.from('clients').update({ ghl_location_id: null, ghl_contact_id: null }).eq('id', client_id)

      return Response.json({ success: true })
    }

    // ── Refresh per-client GHL token ──
    if (action === 'refresh_client_token') {
      const { client_id } = body
      if (!client_id) return Response.json({ error: 'Missing client_id' }, { status: 400 })

      const { data: mapping } = await s.from('koto_ghl_client_mappings').select('*').eq('client_id', client_id).eq('agency_id', body.agency_id).eq('status', 'active').maybeSingle()
      if (!mapping?.refresh_token) return Response.json({ error: 'No refresh token for this client' }, { status: 400 })

      const res = await fetch('https://services.leadconnectorhq.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: mapping.refresh_token,
          client_id: (process.env.GHL_CLIENT_ID || process.env.NEXT_PUBLIC_GHL_CLIENT_ID)!,
          client_secret: process.env.GHL_CLIENT_SECRET!,
        }),
      })
      if (!res.ok) return Response.json({ error: 'Token refresh failed' }, { status: 502 })
      const tokens = await res.json()

      await s.from('koto_ghl_client_mappings').update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', mapping.id)

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
