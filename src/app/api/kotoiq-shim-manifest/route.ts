import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * KotoIQ Shim (v4) update manifest — public endpoint that tells the shim
 * plugin which version is current, where to download it, and what the
 * expected sha256 checksum is.
 *
 * GET /api/kotoiq-shim-manifest
 *
 * Auto-discovery: scans `public/downloads/` for `kotoiq-shim-X.Y.Z.zip` files,
 * picks the highest semver, computes its sha256 on first request, caches in
 * module memory until the next cold start. No env vars to update on each
 * plugin release — just commit the new zip and push.
 *
 * Fallback to env vars (KOTOIQ_SHIM_DIST_SHA256 + KOTOIQ_SHIM_DIST_VERSION)
 * is preserved for emergency override (e.g. you want to publish a manifest
 * pointing at a zip stored outside the repo).
 *
 * Distinct from /api/kotoiq-manifest (v3 channel). v3 sites never fetch
 * this URL — they continue to follow /api/kotoiq-manifest. Per
 * CONTEXT.md D-Plugin-distribution (USER-LOCKED): self-hosted only, NOT
 * published to WordPress.org.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
const ZIP_PATTERN = /^kotoiq-shim-(\d+)\.(\d+)\.(\d+)\.zip$/

// Module-level cache. Survives between requests on the same warm function
// instance but resets on cold start (which is fine — that's exactly when
// you'd have just pushed a new zip).
let cachedManifest: { version: string; sha256: string; computedAt: number } | null = null

function pubkeyFingerprint(): string | null {
  const pem = process.env.KOTOIQ_SHIM_DASHBOARD_PUBKEY || ''
  if (!pem) return null
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
  if (raw.length === 32) {
    return createHash('sha256').update(raw).digest('hex')
  }
  if (raw.length >= 32) {
    return createHash('sha256').update(raw.subarray(raw.length - 32)).digest('hex')
  }
  return null
}

function compareSemver(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

/**
 * Scan public/downloads/ for kotoiq-shim-*.zip, pick the highest semver,
 * compute its sha256. Returns null if no zip is found OR the file can't
 * be read.
 */
async function discoverLatestZip(): Promise<{ version: string; sha256: string } | null> {
  try {
    const downloadsDir = join(process.cwd(), 'public', 'downloads')
    const entries = await readdir(downloadsDir)
    let best: { version: string; tuple: [number, number, number]; filename: string } | null = null
    for (const name of entries) {
      const m = name.match(ZIP_PATTERN)
      if (!m) continue
      const tuple: [number, number, number] = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
      const version = `${tuple[0]}.${tuple[1]}.${tuple[2]}`
      if (!best || compareSemver(tuple, best.tuple) > 0) {
        best = { version, tuple, filename: name }
      }
    }
    if (!best) return null
    const zipPath = join(downloadsDir, best.filename)
    const buf = await readFile(zipPath)
    const sha256 = createHash('sha256').update(buf).digest('hex')
    return { version: best.version, sha256 }
  } catch {
    return null
  }
}

async function resolveDistInfo(): Promise<{ version: string; sha256: string | null; source: 'auto' | 'env' | 'none' }> {
  // Env-var override (emergency / off-repo zip)
  const envSha = process.env.KOTOIQ_SHIM_DIST_SHA256
  const envVer = process.env.KOTOIQ_SHIM_DIST_VERSION
  if (envSha && envVer) {
    return { version: envVer, sha256: envSha, source: 'env' }
  }

  // Cached auto-discovery
  if (cachedManifest) {
    return { version: cachedManifest.version, sha256: cachedManifest.sha256, source: 'auto' }
  }

  // Fresh auto-discovery
  const discovered = await discoverLatestZip()
  if (discovered) {
    cachedManifest = { ...discovered, computedAt: Date.now() }
    return { version: discovered.version, sha256: discovered.sha256, source: 'auto' }
  }

  return { version: envVer || '0.0.0', sha256: null, source: 'none' }
}

export async function GET() {
  const { version, sha256, source } = await resolveDistInfo()
  const downloadUrl = `${APP_URL}/downloads/kotoiq-shim-${version}.zip`
  const fingerprint = pubkeyFingerprint()

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
          'No kotoiq-shim-*.zip found in public/downloads/. Run scripts/cutover/build-shim-zip.sh, ' +
          'commit the resulting zip, push. The manifest will auto-discover the new version on next request.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const manifest = {
    plugin: 'kotoiq-shim',
    version,
    download_url: downloadUrl,
    sha256,
    pubkey_fingerprint: fingerprint,
    source,
    minimum_wp: '5.8',
    minimum_php: '7.4',
    channel: 'stable',
    note: null,
  }
  return NextResponse.json(manifest, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  })
}
