import { NextResponse } from 'next/server'
import { loadManifest } from '../manifest/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Alias for /api/desktop/download/chrome-extension.
 * The /downloads page links here for the Chrome extension button.
 */
export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error: 'Downloads not configured',
        message:
          'The desktop download system is not yet configured. BLOB_READ_WRITE_TOKEN is missing.',
      },
      { status: 503 },
    )
  }

  const manifest = await loadManifest()
  const asset = manifest?.platforms?.['chrome-extension']

  if (!asset?.url) {
    return NextResponse.json(
      {
        error: 'Not yet available',
        message:
          'The Chrome extension is not yet available — join the waitlist at /downloads.',
      },
      { status: 404 },
    )
  }

  return NextResponse.redirect(asset.url, { status: 302 })
}
