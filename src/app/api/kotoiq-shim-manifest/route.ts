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
 * Plan 11 wiring: `scripts/cutover/build-shim-zip.sh` produces the zip +
 * sha256, the operator uploads to /public/downloads/, then sets two Vercel
 * envs (KOTOIQ_SHIM_DIST_SHA256 + KOTOIQ_SHIM_DIST_VERSION). When either
 * env is missing, this endpoint returns 503 with an explicit "build not
 * published" payload so the shim's self-update fails LOUDLY rather than
 * silently no-op'ing a downgrade.
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
  const version = process.env.KOTOIQ_SHIM_DIST_VERSION || '4.0.0'
  const downloadUrl = `${APP_URL}/downloads/kotoiq-shim-${version}.zip`
  const fingerprint = pubkeyFingerprint()

  // 503 LOUD failure when either env is missing — better than serving a
  // half-formed manifest that tells the shim to install a sha-less zip.
  // The shim's self-update aborts on missing sha256 anyway (see
  // wp-plugin-kotoiq-shim/includes/self-update.php line 58), but returning
  // a 200 with null fields would mask the misconfiguration. Operators see
  // the 503 + reason and re-run build-shim-zip.sh + re-set the env.
  if (!sha256) {
    return NextResponse.json(
      {
        plugin: 'kotoiq-shim',
        version,
        download_url: downloadUrl,
        sha256: null,
        pubkey_fingerprint: fingerprint,
        error: 'build_not_published',
        message:
          'KOTOIQ_SHIM_DIST_SHA256 is not set. Run scripts/cutover/build-shim-zip.sh, upload the resulting zip to /public/downloads/, then set KOTOIQ_SHIM_DIST_SHA256 + KOTOIQ_SHIM_DIST_VERSION Vercel env vars and redeploy.',
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }

  const manifest = {
    plugin: 'kotoiq-shim',
    version,
    download_url: downloadUrl,
    sha256,
    pubkey_fingerprint: fingerprint,
    released_at: '2026-05-26T00:00:00Z',
    minimum_wp: '5.8',
    minimum_php: '7.4',
    channel: 'stable',
    note: null,
  }
  return NextResponse.json(manifest, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  })
}
