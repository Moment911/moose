import { NextResponse } from 'next/server'

/**
 * GET /api/kotoiq-shim-latest
 *
 * Stable URL that 302-redirects to the latest kotoiq-shim-X.Y.Z.zip in
 * public/downloads/. UI download buttons + WP plugin self-update can link
 * here once and never go stale — the manifest endpoint already does
 * version auto-discovery, this just re-uses that lookup as a redirect
 * target.
 *
 * Source of truth: /api/kotoiq-shim-manifest → download_url field.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

export async function GET(req: Request) {
  // Hit our own manifest endpoint to discover the latest download_url.
  // Cheap intra-deployment fetch; the manifest's own auto-discovery does
  // the filesystem scan + caches in module memory.
  const origin = new URL(req.url).origin || APP_URL
  let downloadUrl: string | null = null
  try {
    const res = await fetch(`${origin}/api/kotoiq-shim-manifest`, {
      headers: { 'Cache-Control': 'no-store' },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const m = await res.json().catch(() => null)
      downloadUrl = m?.download_url || null
    }
  } catch {
    // fall through to error response below
  }

  if (!downloadUrl) {
    return NextResponse.json(
      {
        error: 'no_release',
        message: 'No kotoiq-shim-*.zip found in public/downloads/. Build and commit a release.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  return NextResponse.redirect(downloadUrl, { status: 302 })
}
