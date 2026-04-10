/*
 * Gmail OAuth — exchange code + refresh tokens for the email tracking system.
 *
 * Required environment variables:
 *   GOOGLE_CLIENT_ID      = your Google OAuth client id
 *   GOOGLE_CLIENT_SECRET  = your Google OAuth client secret
 *   GOOGLE_REDIRECT_URI   = https://hellokoto.com/integrations/gmail/callback
 *
 * Google Cloud Console setup:
 *   1. Create OAuth 2.0 credentials (Web application type)
 *   2. Add authorized redirect URI: https://hellokoto.com/integrations/gmail/callback
 *   3. Enable Gmail API in your Google Cloud project
 *   4. Configure consent screen with scopes: gmail.readonly, gmail.compose, gmail.modify
 */
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '@/lib/apiAuth'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  )
}

const DEFAULT_AGENCY = '00000000-0000-0000-0000-000000000099'

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
]

function clientId() { return process.env.GOOGLE_CLIENT_ID || '' }
function clientSecret() { return process.env.GOOGLE_CLIENT_SECRET || '' }
function redirectUri() {
  return process.env.GOOGLE_REDIRECT_URI || 'https://hellokoto.com/integrations/gmail/callback'
}

// ─────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || ''
    const s = sb()
    const agencyId = resolveAgencyId(req, searchParams) || DEFAULT_AGENCY

    // ── auth_url ────────────────────────────────────────
    if (action === 'auth_url') {
      const cid = clientId()
      if (!cid) {
        return Response.json({
          error: 'GOOGLE_CLIENT_ID not configured',
          hint: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment',
        }, { status: 500 })
      }
      const params = new URLSearchParams({
        client_id: cid,
        redirect_uri: redirectUri(),
        response_type: 'code',
        scope: GMAIL_SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state: agencyId,
      })
      return Response.json({
        data: { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` },
      })
    }

    // ── check ───────────────────────────────────────────
    if (action === 'check') {
      const { data } = await s
        .from('koto_gmail_connections')
        .select('gmail_email, is_active, token_expires_at')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return Response.json({
        data: {
          connected: !!data,
          email: data?.gmail_email || null,
          expires_at: data?.token_expires_at || null,
        },
      })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { searchParams } = new URL(req.url)
    const action = body.action || searchParams.get('action') || ''
    const s = sb()
    // The OAuth flow rides agency_id in the `state` param
    const stateAgencyId = typeof body.state === 'string' ? body.state : ''
    const agencyId = stateAgencyId || resolveAgencyId(req, searchParams, body) || DEFAULT_AGENCY

    // ── exchange_code ──────────────────────────────────
    if (action === 'exchange_code') {
      const code = body.code || ''
      if (!code) return Response.json({ error: 'Missing code' }, { status: 400 })

      const cid = clientId()
      const csec = clientSecret()
      if (!cid || !csec) {
        return Response.json({
          error: 'Gmail OAuth not configured',
          hint: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET',
        }, { status: 500 })
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: cid,
          client_secret: csec,
          redirect_uri: redirectUri(),
          grant_type: 'authorization_code',
        }),
      })
      const tokens: any = await tokenRes.json().catch(() => ({}))
      if (!tokenRes.ok || !tokens.access_token) {
        return Response.json({
          error: tokens?.error_description || tokens?.error || 'Token exchange failed',
        }, { status: 400 })
      }

      // Fetch the user's email so we know which account is connected
      let gmailEmail = ''
      try {
        const profile = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        })
        const pj: any = await profile.json().catch(() => ({}))
        gmailEmail = pj?.email || ''
      } catch { /* best-effort */ }

      // Deactivate any existing connection then insert the fresh one
      await s
        .from('koto_gmail_connections')
        .update({ is_active: false })
        .eq('agency_id', agencyId)

      const expiresAt = new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000).toISOString()
      const { error } = await s.from('koto_gmail_connections').insert({
        agency_id: agencyId,
        gmail_email: gmailEmail || 'unknown@gmail.com',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expires_at: expiresAt,
        scope: tokens.scope || GMAIL_SCOPES.join(' '),
        is_active: true,
      })
      if (error) return Response.json({ error: error.message }, { status: 500 })

      return Response.json({
        data: {
          connected: true,
          email: gmailEmail,
          expires_at: expiresAt,
        },
      })
    }

    // ── refresh_token ──────────────────────────────────
    if (action === 'refresh_token') {
      const cid = clientId()
      const csec = clientSecret()
      if (!cid || !csec) {
        return Response.json({ error: 'Gmail OAuth not configured' }, { status: 500 })
      }

      const { data: conn } = await s
        .from('koto_gmail_connections')
        .select('id, refresh_token')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!conn?.refresh_token) {
        return Response.json({ error: 'No refresh token on file' }, { status: 400 })
      }

      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: cid,
          client_secret: csec,
          refresh_token: conn.refresh_token,
          grant_type: 'refresh_token',
        }),
      })
      const j: any = await r.json().catch(() => ({}))
      if (!r.ok || !j?.access_token) {
        return Response.json({ error: j?.error_description || 'Refresh failed' }, { status: 400 })
      }

      const expiresAt = new Date(Date.now() + (Number(j.expires_in) || 3600) * 1000).toISOString()
      await s
        .from('koto_gmail_connections')
        .update({
          access_token: j.access_token,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conn.id)

      return Response.json({ data: { refreshed: true, expires_at: expiresAt } })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
