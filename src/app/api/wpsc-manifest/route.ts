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

// Phase 9 cutover (2026-05-20): the legacy WPSimpleCode-manifest endpoint
// now advertises KotoIQ 2.1.0. Every legacy 1.x-paired site sees itself as
// outdated; clicking Update in Control Center installs kotoiq-2.1.0.zip on
// top of the existing wpsimplecode/ folder (the zip's internal folder is
// `wpsimplecode/` so the plugin basename stays stable, pairing survives).
// After /meta reports `plugin: 'kotoiq'`, the proxy flips wpsc_plugin →
// 'kotoiq' and future updates route through /api/kotoiq-manifest.
const MANIFEST = {
  latest_version: '2.1.0',
  download_url: `${APP_URL}/downloads/kotoiq-2.1.0.zip`,
  sha256: '9b4bf4f6d5a51709dd4f76290e68dbba806cfceb0767c0ffe6d9d9cb6e8858f4',
  released_at: '2026-05-20',
  channel: 'stable',
  changelog: 'Phase 9: legacy fleet now points at KotoIQ 2.1.0. Zip overwrites wpsimplecode/ in place — one plugin entry per site, pairing preserved. Adds 6th module (SEO & Page Factory) on top of the v2.0 base.',
  history: [
    { version: '2.1.0', released_at: '2026-05-20', note: 'KotoIQ 2.1.0 — adds SEO module (Yoast/Rank Math, page sync, sitemap rebuild, blog generation, auto-ping). wpsc-manifest now advertises this so legacy 1.x sites upgrade to KotoIQ on next push.' },
    { version: '2.0.0', released_at: '2026-05-19', note: 'KotoIQ 2.0.0 — rebrand + Elementor Builder + Content Rotation modules added.' },
    { version: '1.2.0', released_at: '2026-05-19', note: 'WPSimpleCode 1.2.0 — last release under the WPSimpleCode name (self-update endpoint).' },
    { version: '1.1.0', released_at: '2026-05-19', note: 'Module loader contract + per-module enable/disable.' },
    { version: '1.0.1', released_at: '2026-05-19', note: 'SHOW-command table discovery (LiteSpeed-friendly).' },
    { version: '1.0.0', released_at: '2026-05-19', note: 'Initial WPSimpleCode release.' },
  ],
}

export async function GET() {
  return NextResponse.json(MANIFEST, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  })
}
