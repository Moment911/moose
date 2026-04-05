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

// Standard GHL fields (always available on every contact)
const GHL_STANDARD_FIELDS = [
  { key: 'firstName',   name: 'First Name',   type: 'text' },
  { key: 'lastName',    name: 'Last Name',     type: 'text' },
  { key: 'email',       name: 'Email',         type: 'email' },
  { key: 'phone',       name: 'Phone',         type: 'phone' },
  { key: 'companyName', name: 'Company Name',  type: 'text' },
  { key: 'website',     name: 'Website',       type: 'url' },
  { key: 'address1',    name: 'Address',       type: 'text' },
  { key: 'city',        name: 'City',          type: 'text' },
  { key: 'state',       name: 'State',         type: 'text' },
  { key: 'postalCode',  name: 'Postal Code',   type: 'text' },
  { key: 'country',     name: 'Country',       type: 'text' },
  { key: 'tags',        name: 'Tags',          type: 'tags' },
  { key: 'source',      name: 'Source',        type: 'text' },
]

// Koto client fields available for mapping
const KOTO_FIELDS = [
  { key: 'name',          label: 'Business Name',     type: 'text' },
  { key: 'email',         label: 'Email',             type: 'email' },
  { key: 'phone',         label: 'Phone',             type: 'phone' },
  { key: 'website',       label: 'Website',           type: 'url' },
  { key: 'address',       label: 'Street Address',    type: 'text' },
  { key: 'city',          label: 'City',              type: 'text' },
  { key: 'state',         label: 'State',             type: 'text' },
  { key: 'zip',           label: 'ZIP Code',          type: 'text' },
  { key: 'industry',      label: 'Industry',          type: 'text' },
  { key: 'sic_code',      label: 'SIC Code',          type: 'text' },
  { key: 'status',        label: 'Client Status',     type: 'select' },
  { key: 'monthly_value', label: 'Monthly Value ($)', type: 'number' },
  { key: 'notes',         label: 'Notes',             type: 'textarea' },
  { key: 'google_place_id',label: 'Google Place ID',  type: 'text' },
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const integration_id = searchParams.get('integration_id')
  if (!integration_id) return NextResponse.json({ error: 'integration_id required' }, { status: 400 })

  const sb = getSupabase()

  const { data: integration } = await sb.from('crm_integrations')
    .select('*').eq('id', integration_id).single()
  if (!integration) return NextResponse.json({ error: 'Integration not found' }, { status: 404 })

  // Fetch GHL custom fields
  let ghlCustomFields: any[] = []
  try {
    const res = await fetch(`${GHL_BASE}/locations/${integration.location_id}/customFields?model=contact`, {
      headers: { 'Authorization': `Bearer ${integration.access_token}`, 'Version': GHL_VERSION }
    })
    if (res.ok) {
      const data = await res.json()
      ghlCustomFields = data.customFields || []
    }
  } catch (e) {
    console.error('Failed to fetch GHL custom fields:', e)
  }

  // Fetch existing mappings
  const { data: existingMappings } = await sb.from('crm_field_mappings')
    .select('*').eq('integration_id', integration_id)

  const allGHLFields = [
    ...GHL_STANDARD_FIELDS,
    ...ghlCustomFields.map((f: any) => ({
      key:    f.fieldKey || f.key || f.id,
      name:   f.name || f.label,
      type:   f.dataType || f.type || 'text',
      custom: true,
    }))
  ]

  return NextResponse.json({
    ghl_fields:   allGHLFields,
    koto_fields:  KOTO_FIELDS,
    mappings:     existingMappings || [],
  })
}

export async function POST(req: NextRequest) {
  try {
    const { integration_id, agency_id, mappings } = await req.json()
    if (!integration_id || !mappings) return NextResponse.json({ error: 'integration_id and mappings required' }, { status: 400 })

    const sb = getSupabase()

    // Delete existing mappings and re-insert
    await sb.from('crm_field_mappings').delete().eq('integration_id', integration_id)

    if (mappings.length > 0) {
      const toInsert = mappings.map((m: any) => ({
        integration_id,
        agency_id,
        ghl_field_key:  m.ghl_field_key,
        ghl_field_name: m.ghl_field_name,
        ghl_field_type: m.ghl_field_type,
        koto_field:     m.koto_field,
        koto_label:     m.koto_label,
        direction:      m.direction || 'both',
        active:         m.active !== false,
      }))
      await sb.from('crm_field_mappings').insert(toInsert)
    }

    return NextResponse.json({ ok: true, saved: mappings.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
