import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { integration_id } = await req.json()
    const sb = getSupabase()

    const { data: integration } = await sb.from('crm_integrations')
      .select('*').eq('id', integration_id).single()
    if (!integration?.refresh_token) return NextResponse.json({ error: 'No refresh token' }, { status: 400 })

    const res = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: integration.refresh_token,
        client_id:     (process.env.GHL_CLIENT_ID || process.env.NEXT_PUBLIC_GHL_CLIENT_ID)!,
        client_secret: process.env.GHL_CLIENT_SECRET!,
      }),
    })
    if (!res.ok) throw new Error('Token refresh failed')
    const tokens = await res.json()

    await sb.from('crm_integrations').update({
      access_token:     tokens.access_token,
      refresh_token:    tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at:       new Date().toISOString(),
    }).eq('id', integration_id)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
