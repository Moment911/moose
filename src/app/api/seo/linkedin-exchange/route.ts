import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { code, redirect_uri } = await req.json()
    if (!code || !redirect_uri) {
      return NextResponse.json({ error: 'Missing code or redirect_uri' }, { status: 400 })
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID?.trim()
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim()
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'LinkedIn OAuth not configured (LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET)' }, { status: 500 })
    }

    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri,
      }),
    })

    const tokens = await res.json()

    if (!res.ok || tokens.error) {
      return NextResponse.json(
        { error: tokens.error_description || tokens.error || 'LinkedIn token exchange failed' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      access_token: tokens.access_token,
      expires_in: tokens.expires_in || 5184000, // 60 days
      refresh_token: tokens.refresh_token || null,
      refresh_token_expires_in: tokens.refresh_token_expires_in || 31536000, // 365 days
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
