import { NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type DesktopPlatform =
  | 'macos_arm'
  | 'macos_intel'
  | 'windows'
  | 'linux_deb'
  | 'linux_appimage'
  | 'chrome-extension'

/**
 * Internal shape stored in the Blob manifest — includes the private URL used
 * by the server-side download proxy. Never returned to clients.
 */
export interface PlatformAsset {
  url: string
  filename?: string
  size_mb?: number
  sha256?: string
}

export interface DesktopManifest {
  version: string
  released_at: string
  platforms: Partial<Record<DesktopPlatform, PlatformAsset>>
}

/**
 * Public-facing per-platform row — URL omitted so clients never see the raw
 * Blob URL. Clients hit `/api/desktop/download/[platform]` which proxies the
 * bytes server-side using BLOB_READ_WRITE_TOKEN.
 */
export interface PublicPlatformEntry {
  available: boolean
  filename?: string
  size_mb?: number
  sha256?: string
}

export interface PublicManifest {
  version: string
  released_at: string
  platforms: Partial<Record<DesktopPlatform, PublicPlatformEntry>>
  error?: string
}

const MANIFEST_PREFIX = 'kotoiq-downloads/latest/'
const MANIFEST_PATHNAME = 'kotoiq-downloads/latest/manifest.json'

const EMPTY_MANIFEST: PublicManifest = {
  version: '0.0.0',
  released_at: new Date(0).toISOString(),
  platforms: {},
}

/**
 * Server-only. Loads the full manifest (including private URLs) from Blob.
 * Used by the download route to resolve the URL server-side before fetching
 * the binary with the read-write token. NEVER return this shape to clients.
 */
export async function loadManifest(): Promise<DesktopManifest | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null

  try {
    const { blobs } = await list({
      prefix: MANIFEST_PREFIX,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      limit: 100,
    })
    const manifestBlob = blobs.find((b) => b.pathname === MANIFEST_PATHNAME)
    if (!manifestBlob) return null

    // The blob store is configured as private — fetch with the token.
    const res = await fetch(manifestBlob.url, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    })
    if (!res.ok) return null

    const json = (await res.json()) as DesktopManifest
    if (!json || typeof json !== 'object' || !json.platforms) return null
    return json
  } catch (err) {
    console.error('[desktop/manifest] loadManifest failed:', err)
    return null
  }
}

/**
 * Strips private URLs from the manifest before serving it to clients.
 * Only exposes `available`, `filename`, `size_mb`, `sha256` per platform.
 */
function toPublicManifest(m: DesktopManifest): PublicManifest {
  const platforms: PublicManifest['platforms'] = {}
  for (const [key, asset] of Object.entries(m.platforms)) {
    if (!asset) continue
    platforms[key as DesktopPlatform] = {
      available: Boolean(asset.url),
      filename: asset.filename,
      size_mb: asset.size_mb,
      sha256: asset.sha256,
    }
  }
  return {
    version: m.version,
    released_at: m.released_at,
    platforms,
  }
}

export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        ...EMPTY_MANIFEST,
        error:
          'Downloads not configured — BLOB_READ_WRITE_TOKEN is not set. See desktop-app/SHIPPING.md.',
      },
      { status: 503 },
    )
  }

  const manifest = await loadManifest()
  if (!manifest) {
    return NextResponse.json(EMPTY_MANIFEST, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  return NextResponse.json(toPublicManifest(manifest), {
    status: 200,
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  })
}
