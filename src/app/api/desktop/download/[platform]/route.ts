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

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
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

  // 302 redirect to the Blob public URL so the browser downloads it directly
  return NextResponse.redirect(asset.url, { status: 302 })
}
