import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { code, redirect_uri } = await req.json()
    if (!code || !redirect_uri) {
      return NextResponse.json({ error: 'Missing code or redirect_uri' }, { status: 400 })
    }

    const appId = process.env.META_APP_ID?.trim()
    const appSecret = process.env.META_APP_SECRET?.trim()
    if (!appId || !appSecret) {
      return NextResponse.json({ error: 'Meta OAuth not configured (META_APP_ID / META_APP_SECRET)' }, { status: 500 })
    }

    // Exchange code for short-lived token
    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri,
      code,
    })
    const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${params}`)
    const shortLived = await res.json()

    if (!res.ok || shortLived.error) {
      return NextResponse.json(
        { error: shortLived.error?.message || 'Meta token exchange failed', details: shortLived.error },
        { status: 400 }
      )
    }

    // Exchange short-lived for long-lived token (60 days)
    const llParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLived.access_token,
    })
    const llRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${llParams}`)
    const longLived = await llRes.json()

    if (!llRes.ok || longLived.error) {
      // Fall back to short-lived token if long-lived exchange fails
      return NextResponse.json({
        access_token: shortLived.access_token,
        expires_in: shortLived.expires_in || 3600,
        token_type: 'bearer',
      })
    }

    return NextResponse.json({
      access_token: longLived.access_token,
      expires_in: longLived.expires_in || 5184000, // 60 days
      token_type: longLived.token_type || 'bearer',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
