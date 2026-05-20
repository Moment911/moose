import { NextResponse } from 'next/server'

/**
 * WPSimpleCode update manifest — public endpoint that tells the plugin
 * (and the Control Center) which version is current, where to download
 * it, and what the expected checksum is.
 *
 * GET /api/wpsc-manifest
 *
 * Versions are tracked here in the route file so a release is a single
 * commit: bump the version, build the zip into public/downloads/, paste
 * the new sha256. Vercel serves /public statically so the URL works
 * everywhere immediately.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

const MANIFEST = {
  latest_version: '1.2.0',
  download_url: `${APP_URL}/downloads/wpsimplecode-1.2.0.zip`,
  sha256: '96a852fb3efdb1efc46743e883457fac879c3bdef767d85dc7b5803c80dfc20f',
  released_at: '2026-05-19',
  channel: 'stable',
  changelog: 'Phase 3: self-update REST endpoint, sha256-verified download channel, Control Center push-update UI.',
  // Historical versions — purely informational, lets Control Center show
  // what would land vs. what's already installed.
  history: [
    { version: '1.0.0', released_at: '2026-05-19' },
    { version: '1.0.1', released_at: '2026-05-19', note: 'SHOW-command table discovery (LiteSpeed-friendly).' },
    { version: '1.1.0', released_at: '2026-05-19', note: 'Module loader contract + per-module enable/disable.' },
    { version: '1.2.0', released_at: '2026-05-19', note: 'Self-update endpoint.' },
  ],
}

export async function GET() {
  return NextResponse.json(MANIFEST, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  })
}
