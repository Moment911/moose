import { NextResponse } from 'next/server'
import { loadManifest } from '../manifest/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Alias for /api/desktop/download/chrome-extension.
 * The /downloads page links here for the Chrome extension button.
 * Streams the private blob through the server — never exposes the Blob URL.
 */
export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
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

  const upstream = await fetch(asset.url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      {
        error: 'Download failed',
        message: `Upstream blob responded with status ${upstream.status}.`,
      },
      { status: 502 },
    )
  }

  const filename = asset.filename || 'chrome-extension.zip'
  const contentType = upstream.headers.get('content-type') || 'application/zip'
  const contentLength = upstream.headers.get('content-length')

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, max-age=300',
  }
  if (contentLength) headers['Content-Length'] = contentLength

  return new Response(upstream.body, { status: 200, headers })
}
