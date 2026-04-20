import 'server-only'
import { createHmac, randomBytes } from 'node:crypto'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 / Plan 06 — Google Business Profile OAuth helpers (PROF-09)
//
// Env vars required (set in Vercel Dashboard):
//   GOOGLE_OAUTH_CLIENT_ID     — Google Cloud Console OAuth 2.0 Client
//   GOOGLE_OAUTH_CLIENT_SECRET — paired secret
//
// This module handles:
//   1. Consent URL generation with scope=business.manage + CSRF state
//   2. Authorization code exchange
//   3. Access token refresh
//   4. State validation (HMAC-signed, timing-safe)
// ─────────────────────────────────────────────────────────────────────────────

const OAUTH_AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth'
const OAUTH_TOKEN = 'https://oauth2.googleapis.com/token'
const SCOPE_BUSINESS_MANAGE = 'https://www.googleapis.com/auth/business.manage'

function loadEnv() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('[profileGBPOAuth] Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET — set both in Vercel')
  }
  return { clientId, clientSecret }
}

export type OAuthMode = 'agency' | 'client'

export function generateConsentUrl(args: {
  agencyId: string
  mode: OAuthMode
  clientId?: string       // for mode='client'
  redirectUri: string     // must match Google Cloud Console whitelist
  redirectAfter?: string  // post-callback path, encoded into state
}): { url: string; state: string; stateCookieValue: string } {
  const { clientId } = loadEnv()
  const nonce = randomBytes(32).toString('base64url')
  const payload = {
    n: nonce,
    a: args.agencyId,
    m: args.mode,
    c: args.clientId ?? null,
    r: args.redirectAfter ?? '/kotoiq/launch',
    t: Date.now(),
  }
  const state = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const stateCookieValue = signState(state, args.agencyId)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: args.redirectUri,
    response_type: 'code',
    scope: SCOPE_BUSINESS_MANAGE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return {
    url: `${OAUTH_AUTHORIZE}?${params.toString()}`,
    state,
    stateCookieValue,
  }
}

function signState(state: string, agencyId: string): string {
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!
  return createHmac('sha256', secret).update(`${state}.${agencyId}`).digest('base64url')
}

export function validateState(args: {
  receivedState: string
  cookieValue: string
  agencyId: string
}): boolean {
  if (!args.receivedState || !args.cookieValue) return false
  const expected = signState(args.receivedState, args.agencyId)
  // Timing-safe comparison
  if (expected.length !== args.cookieValue.length) return false
  return Buffer.compare(Buffer.from(expected), Buffer.from(args.cookieValue)) === 0
}

export function decodeState(state: string): {
  nonce: string
  agencyId: string
  mode: OAuthMode
  clientId: string | null
  redirectAfter: string
  issuedAt: number
} | null {
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
    return {
      nonce: decoded.n,
      agencyId: decoded.a,
      mode: decoded.m,
      clientId: decoded.c,
      redirectAfter: decoded.r,
      issuedAt: decoded.t,
    }
  } catch {
    return null
  }
}

export type TokenResponse = {
  access_token: string
  refresh_token?: string  // may be absent on subsequent grants
  expires_in: number
  token_type: string
  scope?: string
}

export async function exchangeCode(args: {
  code: string
  redirectUri: string
}): Promise<TokenResponse> {
  const { clientId, clientSecret } = loadEnv()
  const r = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: args.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: args.redirectUri,
    }).toString(),
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`GOOGLE_TOKEN_EXCHANGE_${r.status}: ${text.slice(0, 200)}`)
  }
  return r.json() as Promise<TokenResponse>
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = loadEnv()
  const r = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`GOOGLE_TOKEN_REFRESH_${r.status}: ${text.slice(0, 200)}`)
  }
  return r.json() as Promise<TokenResponse>
}
