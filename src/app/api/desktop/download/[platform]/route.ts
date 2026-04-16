import { NextResponse } from 'next/server'
import { loadManifest, type DesktopPlatform } from '../../manifest/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_PLATFORMS: readonly DesktopPlatform[] = [
  'macos_arm',
  'macos_intel',
  'windows',
  'linux_deb',
  'linux_appimage',
  'chrome-extension',
] as const

function isValidPlatform(p: string): p is DesktopPlatform {
  return (VALID_PLATFORMS as readonly string[]).includes(p)
}

function fallbackFilename(platform: DesktopPlatform): string {
  switch (platform) {
    case 'macos_arm':
      return 'KotoIQ-arm64.dmg'
    case 'macos_intel':
      return 'KotoIQ-x64.dmg'
    case 'windows':
      return 'KotoIQ-setup.exe'
    case 'linux_deb':
      return 'kotoiq_amd64.deb'
    case 'linux_appimage':
      return 'KotoIQ.AppImage'
    case 'chrome-extension':
      return 'chrome-extension.zip'
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params

  if (!isValidPlatform(platform)) {
    return NextResponse.json(
      {
        error: 'Unknown platform',
        message: `Platform "${platform}" is not recognized. Valid platforms: ${VALID_PLATFORMS.join(', ')}.`,
      },
      { status: 400 },
    )
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    return NextResponse.json(
      {
        error: 'Downloads not configured',
        message:
          'The desktop download system is not yet configured. BLOB_READ_WRITE_TOKEN is missing from this environment. See desktop-app/SHIPPING.md.',
      },
      { status: 503 },
    )
  }

  const manifest = await loadManifest()
  const asset = manifest?.platforms?.[platform]

  if (!asset?.url) {
    return NextResponse.json(
      {
        error: 'Not yet available',
        message:
          'This platform is not yet available — join the waitlist at /downloads.',
        platform,
      },
      { status: 404 },
    )
  }

  // Fetch the private blob server-side with the read-write token, then pipe
  // the body back to the client as an attachment. The raw Blob URL is never
  // exposed. @vercel/blob v1.1.1 has no signed-URL helper, so we stream.
  const upstream = await fetch(asset.url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      {
        error: 'Download failed',
        message: `Upstream blob responded with status ${upstream.status}.`,
        platform,
      },
      { status: 502 },
    )
  }

  const filename = asset.filename || fallbackFilename(platform)
  const contentType =
    upstream.headers.get('content-type') || 'application/octet-stream'
  const contentLength = upstream.headers.get('content-length')

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, max-age=300',
  }
  if (contentLength) headers['Content-Length'] = contentLength

  return new Response(upstream.body, { status: 200, headers })
}
