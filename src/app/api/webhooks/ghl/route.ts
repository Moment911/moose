import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function handleGHLWebhook(event: any, integrationId: string, agencyId: string) {
  const { type, locationId, data } = event

  switch (type) {
    case 'ContactCreate':
    case 'ContactUpdate': {
      const contact = data || event
      const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.companyName || 'Unknown'
      const { data: existing } = await getSupabase().from('clients').select('id').eq('ghl_contact_id', contact.id).eq('agency_id', agencyId).maybeSingle()
      if (existing) {
        await getSupabase().from('clients').update({ name, email: contact.email, phone: contact.phone, website: contact.website, updated_at: new Date().toISOString() }).eq('id', existing.id)
      } else {
        const { data: newClient } = await getSupabase().from('clients').insert({ agency_id: agencyId, name, email: contact.email || '', phone: contact.phone || '', website: contact.website || '', ghl_contact_id: contact.id, ghl_location_id: locationId, status: 'lead' }).select().single()
        if (newClient) {
          await getSupabase().from('crm_sync_log').insert({ integration_id: integrationId, agency_id: agencyId, client_id: newClient.id, direction: 'webhook', entity_type: 'contact', entity_id: contact.id, moose_id: newClient.id, action: 'create', status: 'success', payload: { ghl_contact: contact } })

          // Onboarding link + phone provisioning are now MANUAL.
          // Agency generates from the client detail page.
        }
      }
      break
    }
    case 'OpportunityCreate':
    case 'OpportunityStageUpdate': {
      const opp = data || event
      if (opp.contact?.id) {
        const { data: client } = await getSupabase().from('clients').select('id').eq('ghl_contact_id', opp.contact.id).eq('agency_id', agencyId).maybeSingle()
        if (client) {
          const statusMap: Record<string, string> = { won: 'active', lost: 'churned', open: 'lead', abandoned: 'paused' }
          await getSupabase().from('clients').update({ status: statusMap[opp.status] || 'lead', updated_at: new Date().toISOString() }).eq('id', client.id)
          await getSupabase().from('client_change_history').insert({ client_id: client.id, changed_by: 'GoHighLevel', changed_by_email: 'ghl@webhook', change_type: 'status_change', description: `GHL opportunity stage: ${opp.pipelineStageId || opp.status}`, new_value: opp.status })
        }
      }
      break
    }
    case 'INSTALL': {
      await getSupabase().from('crm_integrations').update({ status: 'connected', location_id: event.locationId || locationId, company_id: event.companyId, updated_at: new Date().toISOString() }).eq('id', integrationId)
      break
    }
    case 'UNINSTALL': {
      await getSupabase().from('crm_integrations').update({ status: 'disconnected', access_token: null, refresh_token: null, updated_at: new Date().toISOString() }).eq('id', integrationId)
      break
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const locationId = body.locationId || body.location?.id
    if (!locationId) return NextResponse.json({ ok: true })
    const { data: integration } = await getSupabase().from('crm_integrations').select('id, agency_id').eq('location_id', locationId).eq('provider', 'gohighlevel').maybeSingle()
    if (!integration) return NextResponse.json({ ok: true })
    handleGHLWebhook(body, integration.id, integration.agency_id).catch(console.error)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('GHL webhook error:', err)
    return NextResponse.json({ ok: true })
  }
}
export async function GET() { return NextResponse.json({ status: 'GHL webhook active' }) }
