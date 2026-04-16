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

export interface PlatformAsset {
  url: string
  size_mb?: number
  sha256?: string
  filename?: string
}

export interface DesktopManifest {
  version: string
  released_at: string
  platforms: Partial<Record<DesktopPlatform, PlatformAsset>>
}

const MANIFEST_PREFIX = 'kotoiq-downloads/latest/'
const MANIFEST_PATHNAME = 'kotoiq-downloads/latest/manifest.json'

const EMPTY_MANIFEST: DesktopManifest = {
  version: '0.0.0',
  released_at: new Date(0).toISOString(),
  platforms: {},
}

/**
 * Loads the manifest JSON from Vercel Blob storage.
 * Returns null if BLOB_READ_WRITE_TOKEN is unset, or the manifest cannot be found.
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

    const res = await fetch(manifestBlob.url, { cache: 'no-store' })
    if (!res.ok) return null

    const json = (await res.json()) as DesktopManifest
    if (!json || typeof json !== 'object' || !json.platforms) return null
    return json
  } catch (err) {
    console.error('[desktop/manifest] loadManifest failed:', err)
    return null
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

  return NextResponse.json(manifest, {
    status: 200,
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  })
}
