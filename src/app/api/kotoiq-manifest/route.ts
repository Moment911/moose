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
  latest_version: '3.0.0',
  download_url: `${APP_URL}/downloads/kotoiq-3.0.0.zip`,
  sha256: '9b4bf4f6d5a51709dd4f76290e68dbba806cfceb0767c0ffe6d9d9cb6e8858f4',
  released_at: '2026-05-19',
  channel: 'stable',
  changelog: 'SEO & Page Factory v3.0 — built-in SEO engine replaces Yoast/Rank Math. Native meta titles, descriptions, focus keywords, JSON-LD schema, Open Graph tags, sitemap rebuild, auto-ping on publish.',
  history: [
    { version: '2.1.0', released_at: '2026-05-19', note: 'SEO module lifted from standalone Koto SEO 2.0.0. 6 modules total. Legacy koto_api_key still accepted on koto/v1 + hlseo/v1 routes for back-compat.' },
    { version: '2.0.0', released_at: '2026-05-19', note: 'Initial KotoIQ release. Zip extracts to wpsimplecode/ so it overwrites the legacy 1.2.0 install in place — one plugin entry per site, no duplicate folders.' },
  ],
}

export async function GET() {
  return NextResponse.json(MANIFEST, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  })
}
