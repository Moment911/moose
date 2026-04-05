import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { code, redirect_uri } = await req.json()

    if (!code || !redirect_uri) {
      return NextResponse.json({ error: 'Missing code or redirect_uri' }, { status: 400 })
    }

    const clientId     = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()
    const clientSecret = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET?.trim()

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 })
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri,
        grant_type:    'authorization_code',
      }),
    })

    const tokens = await res.json()

    if (!res.ok || tokens.error) {
      return NextResponse.json(
        { error: tokens.error || 'Token exchange failed', details: tokens.error_description },
        { status: 400 }
      )
    }

    return NextResponse.json(tokens)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
