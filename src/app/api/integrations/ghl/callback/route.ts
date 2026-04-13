import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

  if (error || !code) return NextResponse.redirect(`${appUrl}/integrations?error=ghl_auth_failed`)

  try {
    const tokenRes = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: code!, client_id: process.env.GHL_CLIENT_ID!, client_secret: process.env.GHL_CLIENT_SECRET!, redirect_uri: `${appUrl}/api/integrations/ghl/callback` }),
    })
    if (!tokenRes.ok) throw new Error('Token exchange failed')
    const tokens = await tokenRes.json()

    // State format: "agencyId" or "agencyId:clientId" for per-client OAuth
    const stateParts = (state || '').split(':')
    const agencyId = stateParts[0]
    const clientId = stateParts[1] || null

    const sb = getSupabase()

    // Per-client connection — store in koto_ghl_client_mappings
    if (clientId) {
      const { data: existing } = await sb.from('koto_ghl_client_mappings').select('id').eq('client_id', clientId).eq('agency_id', agencyId).maybeSingle()
      const mappingData = {
        agency_id: agencyId, client_id: clientId,
        ghl_location_id: tokens.locationId, ghl_location_name: tokens.locationId,
        company_id: tokens.companyId,
        access_token: tokens.access_token, refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        connection_type: 'oauth', status: 'active',
        updated_at: new Date().toISOString(),
      }
      if (existing) {
        await sb.from('koto_ghl_client_mappings').update(mappingData).eq('id', existing.id)
      } else {
        await sb.from('koto_ghl_client_mappings').insert(mappingData)
      }
      // Also update client record
      await sb.from('clients').update({ ghl_location_id: tokens.locationId }).eq('id', clientId)
      return NextResponse.redirect(`${appUrl}/client/${clientId}?tab=front-desk&connected=ghl`)
    }

    // Agency-level connection — store in crm_integrations (existing behavior)
    const { data: existing } = await sb.from('crm_integrations').select('id').eq('agency_id', agencyId).eq('provider', 'gohighlevel').eq('location_id', tokens.locationId).maybeSingle()
    const integrationData = { agency_id: agencyId, provider: 'gohighlevel', name: `GoHighLevel (${tokens.locationId})`, status: 'connected', access_token: tokens.access_token, refresh_token: tokens.refresh_token, token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), location_id: tokens.locationId, company_id: tokens.companyId, updated_at: new Date().toISOString() }
    if (existing) {
      await sb.from('crm_integrations').update(integrationData).eq('id', existing.id)
    } else {
      await sb.from('crm_integrations').insert(integrationData)
    }
    return NextResponse.redirect(`${appUrl}/integrations?connected=ghl`)
  } catch (err) {
    console.error('GHL callback error:', err)
    return NextResponse.redirect(`${appUrl}/integrations?error=ghl_token_failed`)
  }
}
