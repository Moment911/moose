import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

async function db(path: string, opts: any = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { 'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`,'Prefer':'return=representation',...(opts.headers||{}) },
  })
}

export async function POST(req: NextRequest) {
  try {
    const { action, client_id, agency_id, token, email, name } = await req.json()

    // Generate a shareable portal link for a client
    if (action === 'generate_link') {
      if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
      // Create or refresh portal session
      const res = await db('client_portal_sessions', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          client_id, agency_id,
          email: email || null,
          name:  name  || null,
          token: crypto.randomUUID(),
          expires_at: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
        }),
      })
      const data = await res.json()
      const session = Array.isArray(data) ? data[0] : data
      return NextResponse.json({
        token: session.token,
        portal_url: `${APP_URL}/portal/${session.token}`,
        expires_at: session.expires_at,
      })
    }

    // Validate a portal token
    if (action === 'validate') {
      if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
      const res = await db(`client_portal_sessions?token=eq.${token}&select=*,clients(*)`)
      const sessions = await res.json()
      const session = sessions?.[0]
      if (!session) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
      if (new Date(session.expires_at) < new Date()) return NextResponse.json({ error: 'Link expired' }, { status: 401 })
      // Update last accessed
      await db(`client_portal_sessions?token=eq.${token}`, {
        method: 'PATCH',
        body: JSON.stringify({ last_accessed_at: new Date().toISOString() }),
      })
      return NextResponse.json({ valid: true, client: session.clients, session })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
