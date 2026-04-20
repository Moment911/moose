import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '../../../../../../lib/apiAuth'
import { generateConsentUrl } from '../../../../../../lib/kotoiq/profileGBPOAuth'
import { checkRateLimit } from '../../../../../../lib/kotoiq/profileCostBudget'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await verifySession(req, {})
  if (!session.verified || !session.agencyId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const rl = checkRateLimit({ agencyId: session.agencyId, actionKey: 'connect_gbp_oauth_start' })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited', retry_after_ms: rl.retry_after_ms }, { status: 429 })
  }

  const url = new URL(req.url)
  const mode = (url.searchParams.get('mode') ?? 'agency') as 'agency' | 'client'
  const redirectAfter = url.searchParams.get('redirect_after') ?? '/kotoiq/launch'
  const clientId = url.searchParams.get('client_id') ?? undefined
  const redirectUri = `${url.origin}/api/kotoiq/profile/oauth_gbp/callback`

  const { url: consentUrl, stateCookieValue } = generateConsentUrl({
    agencyId: session.agencyId,
    mode,
    clientId,
    redirectUri,
    redirectAfter,
  })

  const res = NextResponse.redirect(consentUrl)
  res.cookies.set('koto_oauth_gbp_state', stateCookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return res
}
