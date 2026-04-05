import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const GHL_BASE    = 'https://services.leadconnectorhq.com'
const GHL_VERSION = '2021-07-28'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function ghlGet(path: string, token: string) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Version': GHL_VERSION }
  })
  if (!res.ok) throw new Error(`GHL ${path} → ${res.status}`)
  return res.json()
}

async function ghlPost(path: string, token: string, body: any) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Version': GHL_VERSION },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`GHL POST ${path} → ${res.status}: ${JSON.stringify(err)}`)
  }
  return res.json()
}

async function ghlPut(path: string, token: string, body: any) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Version': GHL_VERSION },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`GHL PUT ${path} → ${res.status}`)
  return res.json()
}

// ── Map GHL contact → Koto client ────────────────────────────────────────────
function ghlToKoto(c: any, agencyId: string, integrationId: string, fieldMappings: any[]) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
    || c.companyName || c.email?.split('@')[0] || 'Unknown'

  // Start with standard field mapping
  const client: any = {
    agency_id:      agencyId,
    name,
    email:          c.email   || '',
    phone:          c.phone   || '',
    website:        c.website || '',
    city:           c.city    || '',
    state:          c.state   || '',
    address:        c.address1 || '',
    zip:            c.postalCode || '',
    status:         'lead',
    ghl_contact_id: c.id,
    ghl_location_id:c.locationId,
    crm_source:    'gohighlevel',
    crm_synced_at:  new Date().toISOString(),
    crm_raw:        c,
  }

  // Apply custom field mappings
  if (c.customFields?.length && fieldMappings.length) {
    for (const cf of c.customFields) {
      const mapping = fieldMappings.find(m =>
        m.ghl_field_key === cf.key || m.ghl_field_key === cf.fieldKey
      )
      if (mapping && mapping.koto_field && mapping.direction !== 'push' && cf.value) {
        client[mapping.koto_field] = cf.value
      }
    }
  }

  // Map tags to industry if available
  if (c.tags?.length && !client.industry) {
    const industryTag = c.tags.find((t: string) => !t.startsWith('moose-'))
    if (industryTag) client.industry = industryTag
  }

  return client
}

// ── Map Koto client → GHL contact ────────────────────────────────────────────
function kotoToGHL(client: any, profile: any, fieldMappings: any[], locationId: string) {
  const contact: any = {
    locationId,
    firstName:   client.name?.split(' ')[0] || '',
    lastName:    client.name?.split(' ').slice(1).join(' ') || '',
    email:       client.email || '',
    phone:       client.phone || '',
    companyName: client.name || '',
    website:     client.website || '',
    address1:    client.address || '',
    city:        client.city || '',
    state:       client.state || '',
    postalCode:  client.zip || '',
    country:     'US',
    source:      'Koto',
    tags:        ['koto-client', client.status ? `koto-status:${client.status}` : ''].filter(Boolean),
  }

  // Build custom fields from mapping
  const customField: any[] = [
    { key: 'koto_client_id',    field_value: client.id },
    { key: 'koto_industry',     field_value: client.industry || '' },
    { key: 'koto_sic_code',     field_value: client.sic_code || '' },
    { key: 'koto_monthly_value',field_value: String(client.monthly_value || '') },
    { key: 'koto_status',       field_value: client.status || '' },
    { key: 'koto_agent_enabled',field_value: String(client.agent_enabled || false) },
  ]

  // Apply custom field mappings (push direction)
  for (const mapping of fieldMappings) {
    if (mapping.direction !== 'pull' && mapping.koto_field && mapping.ghl_field_key) {
      const val = client[mapping.koto_field]
      if (val !== undefined && val !== null && val !== '') {
        customField.push({ key: mapping.ghl_field_key, field_value: String(val) })
      }
    }
  }

  contact.customField = customField.filter(f => f.field_value)
  return contact
}

// ── Pull all contacts from GHL → Koto ────────────────────────────────────────
async function pullFromGHL(integration: any, fieldMappings: any[]) {
  const sb = getSupabase()
  const { access_token, location_id, agency_id, id: integrationId } = integration

  let page = 1
  let hasMore = true
  const stats = { created: 0, updated: 0, skipped: 0, errors: 0, total: 0 }
  const logs: any[] = []

  while (hasMore) {
    const params = new URLSearchParams({
      locationId: location_id,
      limit: '100',
      skip: String((page - 1) * 100),
    })

    let contacts: any[] = []
    try {
      const resp = await ghlGet(`/contacts/?${params}`, access_token)
      contacts = resp.contacts || []
      hasMore = contacts.length === 100
      page++
    } catch (e: any) {
      console.error('GHL pull error:', e.message)
      hasMore = false
    }

    for (const contact of contacts) {
      stats.total++
      try {
        const clientData = ghlToKoto(contact, agency_id, integrationId, fieldMappings)

        // Check if already exists by GHL contact ID
        const { data: existing } = await sb.from('clients')
          .select('id, name, email, ghl_contact_id')
          .eq('ghl_contact_id', contact.id)
          .eq('agency_id', agency_id)
          .maybeSingle()

        if (existing) {
          // Update existing client
          const { error } = await sb.from('clients').update({
            ...clientData,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id)

          if (!error) {
            stats.updated++
            logs.push({ integration_id: integrationId, agency_id, client_id: existing.id, direction: 'pull', entity_type: 'contact', entity_id: contact.id, action: 'update', status: 'success' })
          } else {
            stats.errors++
            logs.push({ integration_id: integrationId, agency_id, direction: 'pull', entity_type: 'contact', entity_id: contact.id, action: 'update', status: 'error', error_message: error.message })
          }
        } else {
          // Create new client
          const { data: newClient, error } = await sb.from('clients')
            .insert(clientData)
            .select('id')
            .single()

          if (!error && newClient) {
            stats.created++
            logs.push({ integration_id: integrationId, agency_id, client_id: newClient.id, direction: 'pull', entity_type: 'contact', entity_id: contact.id, moose_id: newClient.id, action: 'create', status: 'success' })
          } else {
            stats.errors++
            logs.push({ integration_id: integrationId, agency_id, direction: 'pull', entity_type: 'contact', entity_id: contact.id, action: 'create', status: 'error', error_message: error?.message })
          }
        }
      } catch (e: any) {
        stats.errors++
        logs.push({ integration_id: integrationId, agency_id, direction: 'pull', entity_type: 'contact', entity_id: contact.id, action: 'error', status: 'error', error_message: e.message })
      }
    }

    // Batch insert logs every page
    if (logs.length > 0) {
      await sb.from('crm_sync_log').insert(logs.splice(0))
    }
  }

  // Update integration stats
  await sb.from('crm_integrations').update({
    last_sync_at: new Date().toISOString(),
    total_synced: stats.total,
    updated_at:   new Date().toISOString(),
  }).eq('id', integrationId)

  return stats
}

// ── Push all Koto clients → GHL ───────────────────────────────────────────────
async function pushToGHL(integration: any, fieldMappings: any[]) {
  const sb = getSupabase()
  const { access_token, location_id, agency_id, id: integrationId } = integration

  const { data: clients } = await sb.from('clients')
    .select('*')
    .eq('agency_id', agency_id)
    .neq('status', 'churned')

  if (!clients?.length) return { pushed: 0, errors: 0, total: 0 }

  const stats = { pushed: 0, errors: 0, total: clients.length }
  const logs: any[] = []

  for (const client of clients) {
    try {
      const contactPayload = kotoToGHL(client, {}, fieldMappings, location_id)

      if (client.ghl_contact_id) {
        // Update existing GHL contact
        await ghlPut(`/contacts/${client.ghl_contact_id}`, access_token, contactPayload)
        stats.pushed++
        logs.push({ integration_id: integrationId, agency_id, client_id: client.id, direction: 'push', entity_type: 'contact', entity_id: client.ghl_contact_id, action: 'update', status: 'success' })
      } else {
        // Create new GHL contact
        const result = await ghlPost('/contacts/', access_token, contactPayload)
        const ghlId = result.contact?.id || result.id
        if (ghlId) {
          await sb.from('clients').update({
            ghl_contact_id:  ghlId,
            ghl_location_id: location_id,
            crm_synced_at:   new Date().toISOString(),
          }).eq('id', client.id)
          stats.pushed++
          logs.push({ integration_id: integrationId, agency_id, client_id: client.id, direction: 'push', entity_type: 'contact', entity_id: ghlId, action: 'create', status: 'success' })
        }
      }
    } catch (e: any) {
      stats.errors++
      logs.push({ integration_id: integrationId, agency_id, client_id: client.id, direction: 'push', entity_type: 'contact', action: 'error', status: 'error', error_message: e.message })
    }
  }

  if (logs.length) await sb.from('crm_sync_log').insert(logs)
  await sb.from('crm_integrations').update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', integrationId)
  return stats
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { integration_id, direction = 'pull' } = await req.json()
    if (!integration_id) return NextResponse.json({ error: 'integration_id required' }, { status: 400 })

    const sb = getSupabase()

    const { data: integration, error: intErr } = await sb.from('crm_integrations')
      .select('*').eq('id', integration_id).single()
    if (intErr || !integration) return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    if (!integration.access_token) return NextResponse.json({ error: 'No access token — reconnect GHL' }, { status: 400 })

    const { data: fieldMappings } = await sb.from('crm_field_mappings')
      .select('*').eq('integration_id', integration_id).eq('active', true)

    const mappings = fieldMappings || []

    let stats: any
    if (direction === 'pull') {
      stats = await pullFromGHL(integration, mappings)
    } else if (direction === 'push') {
      stats = await pushToGHL(integration, mappings)
    } else if (direction === 'both') {
      const pullStats = await pullFromGHL(integration, mappings)
      const pushStats = await pushToGHL(integration, mappings)
      stats = { pull: pullStats, push: pushStats }
    } else {
      return NextResponse.json({ error: 'direction must be pull|push|both' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, direction, stats })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── GET: sync status + recent log ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const integration_id = searchParams.get('integration_id')
  if (!integration_id) return NextResponse.json({ error: 'integration_id required' }, { status: 400 })

  const sb = getSupabase()
  const [{ data: integration }, { data: logs }] = await Promise.all([
    sb.from('crm_integrations').select('*').eq('id', integration_id).single(),
    sb.from('crm_sync_log').select('*').eq('integration_id', integration_id)
      .order('created_at', { ascending: false }).limit(50),
  ])

  const stats = {
    created: logs?.filter(l => l.action === 'create' && l.status === 'success').length || 0,
    updated: logs?.filter(l => l.action === 'update' && l.status === 'success').length || 0,
    errors:  logs?.filter(l => l.status === 'error').length || 0,
  }

  return NextResponse.json({ integration, logs, stats })
}
