import { NextResponse } from 'next/server'

/**
 * KotoIQ update manifest — public endpoint that tells the plugin (and the
 * Control Center) which version is current, where to download it, and
 * what the expected sha256 checksum is.
 *
 * GET /api/kotoiq-manifest
 *
 * Versions are tracked here in the route file so a release is a single
 * commit: bump the version, build the zip into public/downloads/, paste
 * the new sha256. Vercel serves /public statically so the URL works
 * everywhere immediately.
 *
 * Separate from /api/wpsc-manifest — KotoIQ-paired sites (meta.plugin
 * === 'kotoiq') fetch this manifest; legacy WPSimpleCode-paired sites
 * keep using /api/wpsc-manifest. Control Center routes based on each
 * site's reported plugin identity.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

const MANIFEST = {
  plugin: 'kotoiq',
  latest_version: '2.0.0',
  download_url: `${APP_URL}/downloads/kotoiq-2.0.0.zip`,
  sha256: '573823903bf45cd7a60a4f1350c2a1cf7622d7edd671779c89e00f1265ba6da6',
  released_at: '2026-05-19',
  channel: 'stable',
  changelog: 'Phase 4: unified KotoIQ plugin — search & replace + snippets + access + Elementor builder + content rotation, all under the module-loader contract. Versioned 2.0.0 so it sorts above the WPSimpleCode 1.x line.',
  history: [
    { version: '2.0.0', released_at: '2026-05-19', note: 'Initial KotoIQ release. Zip extracts to wpsimplecode/ so it overwrites the legacy 1.2.0 install in place — one plugin entry per site, no duplicate folders.' },
  ],
}

export async function GET() {
  return NextResponse.json(MANIFEST, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  })
}
