import { NextRequest, NextResponse } from 'next/server'

// Phase 8 Wave 0 — Playwright-on-Vercel-Fluid-Compute smoke test.
// Gate for Plan 05 website crawl. If this returns 200 + a valid title,
// Playwright is viable on the current Vercel Fluid Compute deployment.

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const started = Date.now()
  try {
    const chromium = (await import('@sparticuz/chromium')).default
    const { chromium: pw } = await import('playwright-core')
    const browser = await pw.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
    try {
      const page = await browser.newPage()
      await page.goto('https://example.com', { waitUntil: 'networkidle', timeout: 15_000 })
      const title = await page.title()
      return NextResponse.json({
        ok: true,
        title,
        duration_ms: Date.now() - started,
        env: {
          AWS_LAMBDA_JS_RUNTIME: process.env.AWS_LAMBDA_JS_RUNTIME ?? null,
          NODE_VERSION: process.version,
        },
      })
    } finally {
      await browser.close()
    }
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message ?? 'unknown',
      stack: (err?.stack ?? '').toString().split('\n').slice(0, 10).join('\n'),
      duration_ms: Date.now() - started,
      env: {
        AWS_LAMBDA_JS_RUNTIME: process.env.AWS_LAMBDA_JS_RUNTIME ?? null,
        NODE_VERSION: process.version,
      },
    }, { status: 500 })
  }
}
