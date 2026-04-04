import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moose-adam-segalls-projects.vercel.app'

  if (error || !code) return NextResponse.redirect(`${appUrl}/integrations?error=ghl_auth_failed`)

  try {
    const tokenRes = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: code!, client_id: process.env.GHL_CLIENT_ID!, client_secret: process.env.GHL_CLIENT_SECRET!, redirect_uri: `${appUrl}/api/integrations/ghl/callback` }),
    })
    if (!tokenRes.ok) throw new Error('Token exchange failed')
    const tokens = await tokenRes.json()
    const agencyId = state!

    const { data: existing } = await supabase.from('crm_integrations').select('id').eq('agency_id', agencyId).eq('provider', 'gohighlevel').eq('location_id', tokens.locationId).maybeSingle()
    const integrationData = { agency_id: agencyId, provider: 'gohighlevel', name: `GoHighLevel (${tokens.locationId})`, status: 'connected', access_token: tokens.access_token, refresh_token: tokens.refresh_token, token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), location_id: tokens.locationId, company_id: tokens.companyId, updated_at: new Date().toISOString() }
    if (existing) {
      await supabase.from('crm_integrations').update(integrationData).eq('id', existing.id)
    } else {
      await supabase.from('crm_integrations').insert(integrationData)
    }
    return NextResponse.redirect(`${appUrl}/integrations?connected=ghl`)
  } catch (err) {
    console.error('GHL callback error:', err)
    return NextResponse.redirect(`${appUrl}/integrations?error=ghl_token_failed`)
  }
}
