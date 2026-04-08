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

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
