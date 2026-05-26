import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'

/**
 * KotoIQ Shim (v4) update manifest — public endpoint that tells the shim
 * plugin which version is current, where to download it, and what the
 * expected sha256 checksum is.
 *
 * GET /api/kotoiq-shim-manifest
 *
 * Distinct from /api/kotoiq-manifest (v3 channel). v3 sites never fetch
 * this URL — they continue to follow /api/kotoiq-manifest. Per
 * CONTEXT.md D-Plugin-distribution (USER-LOCKED): self-hosted only, NOT
 * published to WordPress.org.
 *
 * The shim plugin posts a signed envelope to /wp-json/kotoiq-shim/v1/self-update
 * carrying {download_url, sha256, version}; the dashboard takes the
 * canonical values from this manifest before signing.
 *
 * TODO Plan 11 cutover: build the actual zip + upload to /public/downloads/
 * + populate KOTOIQ_SHIM_DIST_SHA256 in Vercel env. Until then, sha256 is
 * null and the note flags the build as not-yet-published.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

function pubkeyFingerprint(): string | null {
  const pem = process.env.KOTOIQ_SHIM_DASHBOARD_PUBKEY || ''
  if (!pem) return null
  // Accept either base64-of-raw-32-bytes or full PEM. If PEM, strip
  // header/footer/whitespace and pick the base64 body.
  const body = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '')
  let raw: Buffer
  try {
    raw = Buffer.from(body, 'base64')
  } catch {
    return null
  }
  // PEM-wrapped Ed25519 SubjectPublicKeyInfo is 44 bytes — the trailing
  // 32 bytes are the raw public key. Raw-encoded keys are 32 bytes.
  if (raw.length === 32) {
    return createHash('sha256').update(raw).digest('hex')
  }
  if (raw.length >= 32) {
    return createHash('sha256').update(raw.subarray(raw.length - 32)).digest('hex')
  }
  return null
}

export async function GET() {
  const sha256 = process.env.KOTOIQ_SHIM_DIST_SHA256 || null
  const manifest = {
    plugin: 'kotoiq-shim',
    version: '4.0.0',
    download_url: `${APP_URL}/downloads/kotoiq-shim-4.0.0.zip`,
    sha256,
    pubkey_fingerprint: pubkeyFingerprint(),
    released_at: '2026-05-26T00:00:00Z',
    minimum_wp: '5.8',
    minimum_php: '7.4',
    channel: 'stable',
    note:
      sha256 == null
        ? 'Build not yet uploaded — Plan 11 cutover playbook publishes the first signed zip and sets KOTOIQ_SHIM_DIST_SHA256.'
        : null,
  }
  return NextResponse.json(manifest, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  })
}
