import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '../../../../../../lib/apiAuth'
import { validateState, decodeState, exchangeCode } from '../../../../../../lib/kotoiq/profileGBPOAuth'
import { encryptSecret } from '../../../../../../lib/kotoiq/profileIntegrationsVault'
import { getKotoIQDb } from '../../../../../../lib/kotoiqDb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await verifySession(req, {})
  if (!session.verified || !session.agencyId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) {
    return NextResponse.json({ error: 'missing_code_or_state' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const cookieValue = cookieStore.get('koto_oauth_gbp_state')?.value
  if (!cookieValue || !validateState({ receivedState: state, cookieValue, agencyId: session.agencyId })) {
    return NextResponse.json({ error: 'state_mismatch' }, { status: 400 })
  }

  const decoded = decodeState(state)
  if (!decoded || decoded.agencyId !== session.agencyId) {
    return NextResponse.json({ error: 'state_decode_failed' }, { status: 400 })
  }

  const redirectUri = `${url.origin}/api/kotoiq/profile/oauth_gbp/callback`
  const tokens = await exchangeCode({ code, redirectUri })

  const payload = encryptSecret(JSON.stringify({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: Date.now() + tokens.expires_in * 1000,
    scope: tokens.scope ?? null,
  }), session.agencyId)

  const kind = decoded.mode === 'client' ? 'gbp_client_oauth' : 'gbp_agency_oauth'
  const db = getKotoIQDb(session.agencyId)
  await db.agencyIntegrations.upsert({
    integration_kind: kind,
    scope_client_id: decoded.mode === 'client' ? decoded.clientId : null,
    encrypted_payload: payload,
    payload_version: 1,
    label: decoded.mode === 'client' ? `client:${decoded.clientId}` : 'agency-wide',
    created_by: session.userId,
  })

  // Clear cookie + redirect to post-callback destination
  const redirectDest = new URL(decoded.redirectAfter || '/kotoiq/launch', url.origin)
  redirectDest.searchParams.set('gbp_connected', '1')
  const res = NextResponse.redirect(redirectDest)
  res.cookies.delete('koto_oauth_gbp_state')
  return res
}
