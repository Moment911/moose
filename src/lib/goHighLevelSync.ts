import 'server-only' // fails the build if this module is ever imported from a client component
// ── GoHighLevel CRM Sync Engine ──────────────────────────────────────────────
// Syncs leads, calls, appointments, and workflows between Koto and GHL.

import { createClient } from '@supabase/supabase-js'

const GHL_BASE_URL = 'https://services.leadconnectorhq.com'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function getGHLHeaders(agencyId: string): Promise<{ headers: Record<string, string>; integration: any } | null> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('koto_ghl_integrations')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('status', 'active')
    .single()

  if (!data) return null

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  }

  if (data.connection_type === 'oauth' && data.ghl_access_token) {
    headers['Authorization'] = `Bearer ${data.ghl_access_token}`
  } else if (data.ghl_api_key) {
    headers['Authorization'] = `Bearer ${data.ghl_api_key}`
  }

  return { headers, integration: data }
}

async function logSync(agencyId: string, syncType: string, kotoId: string, ghlId: string, direction: string, status: string, error?: string) {
  const supabase = getSupabase()
  await supabase.from('koto_ghl_sync_log').insert({
    agency_id: agencyId,
    sync_type: syncType,
    koto_record_id: kotoId,
    ghl_record_id: ghlId,
    direction,
    status,
    error_message: error || null,
  })
}

// ── CONTACTS ─────────────────────────────────────────────────────────────────

export async function syncLeadToGHL(agencyId: string, lead: any): Promise<string | null> {
  const auth = await getGHLHeaders(agencyId)
  if (!auth) return null

  const { headers, integration } = auth
  const locationId = integration.ghl_location_id

  try {
    // Search for existing contact by phone
    const phone = lead.prospect_phone || lead.phone || ''
    if (phone) {
      const searchRes = await fetch(`${GHL_BASE_URL}/contacts/search/duplicate?locationId=${locationId}&number=${encodeURIComponent(phone)}`, {
        headers, signal: AbortSignal.timeout(8000),
      })
      if (searchRes.ok) {
        const searchData = await searchRes.json()
        if (searchData.contact?.id) {
          // Update existing contact
          await fetch(`${GHL_BASE_URL}/contacts/${searchData.contact.id}`, {
            method: 'PUT', headers,
            body: JSON.stringify({
              firstName: lead.prospect_name?.split(' ')[0] || lead.first_name || '',
              lastName: lead.prospect_name?.split(' ').slice(1).join(' ') || lead.last_name || '',
              companyName: lead.prospect_company || lead.business_name || '',
              phone,
              email: lead.prospect_email || lead.email || '',
              city: lead.city || '',
              state: lead.state || '',
              customFields: [
                { key: 'koto_lead_score', value: String(lead.lead_score || 0) },
                { key: 'koto_industry', value: lead.industry_sic_code || '' },
              ],
            }),
            signal: AbortSignal.timeout(8000),
          })
          await logSync(agencyId, 'contact', lead.id, searchData.contact.id, 'koto_to_ghl', 'success')
          return searchData.contact.id
        }
      }
    }

    // Create new contact
    const createRes = await fetch(`${GHL_BASE_URL}/contacts/`, {
      method: 'POST', headers,
      body: JSON.stringify({
        locationId,
        firstName: lead.prospect_name?.split(' ')[0] || lead.first_name || '',
        lastName: lead.prospect_name?.split(' ').slice(1).join(' ') || lead.last_name || '',
        companyName: lead.prospect_company || lead.business_name || '',
        phone: lead.prospect_phone || lead.phone || '',
        email: lead.prospect_email || lead.email || '',
        city: lead.city || '',
        state: lead.state || '',
        source: 'Koto AI',
        tags: ['koto-synced'],
        customFields: [
          { key: 'koto_lead_score', value: String(lead.lead_score || 0) },
          { key: 'koto_industry', value: lead.industry_sic_code || '' },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!createRes.ok) {
      const err = await createRes.text()
      await logSync(agencyId, 'contact', lead.id, '', 'koto_to_ghl', 'failed', err)
      return null
    }

    const createData = await createRes.json()
    const ghlId = createData.contact?.id || ''
    await logSync(agencyId, 'contact', lead.id, ghlId, 'koto_to_ghl', 'success')

    // Update integration stats
    const supabase = getSupabase()
    await supabase.from('koto_ghl_integrations').update({
      contacts_synced: (integration.contacts_synced || 0) + 1,
      last_sync_at: new Date().toISOString(),
    }).eq('id', integration.id)

    return ghlId
  } catch (e: any) {
    await logSync(agencyId, 'contact', lead.id, '', 'koto_to_ghl', 'failed', e.message)
    return null
  }
}

// ── CALLS ────────────────────────────────────────────────────────────────────

export async function syncCallToGHL(agencyId: string, call: any, ghlContactId: string): Promise<void> {
  const auth = await getGHLHeaders(agencyId)
  if (!auth) return

  try {
    const note = [
      `Koto AI Call -- ${new Date(call.created_at || Date.now()).toLocaleString()}`,
      `Duration: ${call.duration_seconds || 0}s`,
      `Outcome: ${call.appointment_set ? 'Appointment Set' : call.status || 'completed'}`,
      `Lead Score: ${call.lead_score || 'N/A'}/100`,
      `Sentiment: ${call.sentiment || 'neutral'}`,
      call.call_analysis?.summary ? `Summary: ${call.call_analysis.summary}` : '',
      call.prospect_pain_point ? `Pain Point: ${call.prospect_pain_point}` : '',
    ].filter(Boolean).join('\n')

    await fetch(`${GHL_BASE_URL}/contacts/${ghlContactId}/notes/`, {
      method: 'POST',
      headers: auth.headers,
      body: JSON.stringify({ body: note }),
      signal: AbortSignal.timeout(8000),
    })

    await logSync(agencyId, 'call', call.id, ghlContactId, 'koto_to_ghl', 'success')

    const supabase = getSupabase()
    await supabase.from('koto_ghl_integrations').update({
      calls_synced: (auth.integration.calls_synced || 0) + 1,
      last_sync_at: new Date().toISOString(),
    }).eq('id', auth.integration.id)
  } catch (e: any) {
    await logSync(agencyId, 'call', call.id, ghlContactId, 'koto_to_ghl', 'failed', e.message)
  }
}

// ── APPOINTMENTS/OPPORTUNITIES ───────────────────────────────────────────────

export async function createGHLOpportunity(
  agencyId: string,
  lead: any,
  appointmentDatetime: string,
  ghlContactId: string
): Promise<void> {
  const auth = await getGHLHeaders(agencyId)
  if (!auth) return

  const { integration } = auth

  try {
    // Create opportunity
    if (integration.pipeline_id) {
      await fetch(`${GHL_BASE_URL}/opportunities/`, {
        method: 'POST',
        headers: auth.headers,
        body: JSON.stringify({
          pipelineId: integration.pipeline_id,
          locationId: integration.ghl_location_id,
          name: `Koto Appointment -- ${lead.prospect_company || lead.business_name || 'Unknown'}`,
          pipelineStageId: integration.appointment_stage_id || undefined,
          status: 'open',
          contactId: ghlContactId,
          monetaryValue: lead.estimated_deal_value || 0,
        }),
        signal: AbortSignal.timeout(8000),
      })
    }

    await logSync(agencyId, 'appointment', lead.id, ghlContactId, 'koto_to_ghl', 'success')

    const supabase = getSupabase()
    await supabase.from('koto_ghl_integrations').update({
      appointments_synced: (integration.appointments_synced || 0) + 1,
      last_sync_at: new Date().toISOString(),
    }).eq('id', integration.id)
  } catch (e: any) {
    await logSync(agencyId, 'appointment', lead.id, ghlContactId, 'koto_to_ghl', 'failed', e.message)
  }
}

// ── TAGS ─────────────────────────────────────────────────────────────────────

export async function addGHLTags(agencyId: string, ghlContactId: string, tags: string[]): Promise<void> {
  const auth = await getGHLHeaders(agencyId)
  if (!auth) return

  try {
    await fetch(`${GHL_BASE_URL}/contacts/${ghlContactId}/tags/`, {
      method: 'POST',
      headers: auth.headers,
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(8000),
    })
  } catch { /* non-critical */ }
}

// ── TEST CONNECTION ──────────────────────────────────────────────────────────

export async function testGHLConnection(apiKey: string, locationId: string): Promise<{ success: boolean; locationName?: string; contactCount?: number; error?: string }> {
  try {
    const res = await fetch(`${GHL_BASE_URL}/locations/${locationId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-07-28',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return { success: false, error: `GHL API returned ${res.status}` }

    const data = await res.json()
    return {
      success: true,
      locationName: data.location?.name || data.name || 'Unknown',
      contactCount: data.location?.contactCount || 0,
    }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
