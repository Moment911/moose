// ─────────────────────────────────────────────────────────────
// White-label custom domain proxy (Next.js 16 file convention)
//
// When a request comes in on a host that's NOT hellokoto.com,
// annotate the request with x-koto-custom-domain so downstream
// pages can fetch /api/agency/white-label?domain=... and render
// with the agency's branding instead of Koto's defaults.
//
// We don't hit Supabase from the proxy itself — keeps the proxy
// fast and avoids a DB round-trip on every request. The actual
// agency lookup happens client-side in OnboardingPage.
//
// Marketing/admin pages stay on hellokoto.com — only onboarding
// routes serve from custom domains.
// ─────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from 'next/server'

const KOTO_HOSTS = new Set([
  'hellokoto.com',
  'www.hellokoto.com',
  'koto.vercel.app',
  'localhost',
])

export async function proxy(req: NextRequest) {
  const url = req.nextUrl
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase()

  // Skip Koto hosts and Vercel preview deployments
  if (KOTO_HOSTS.has(host) || host.endsWith('.vercel.app')) {
    return NextResponse.next()
  }

  // Only handle onboarding-related routes on custom domains.
  // Everything else falls through to a 404 — agencies don't get
  // to white-label the agency dashboard.
  const isOnboardingPath =
    url.pathname.startsWith('/onboard')
    || url.pathname.startsWith('/onboarding')
    || url.pathname === '/'
    || url.pathname.startsWith('/access-guide')
  if (!isOnboardingPath) {
    return NextResponse.next()
  }

  // Annotate the request with the host so the page can fetch
  // /api/agency/white-label?domain=... and apply branding.
  // Actual lookup happens client-side to keep middleware fast
  // and avoid a Supabase round-trip on every request.
  const res = NextResponse.next()
  res.headers.set('x-koto-custom-domain', host)
  return res
}

export const config = {
  // Match everything except _next, favicon, and api routes.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
