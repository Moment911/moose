import 'server-only'
import { extractFromPastedText, type ExtractedFieldRecord } from './profileExtractClaude'
import { SOURCE_CONFIG } from './profileConfig'
import { refuseIfInternalIp } from './profileWebsiteSSRFGuard'  // Plan 05 cross-import

export type FormScrapeArgs = {
  url: string
  agencyId: string
  clientId: string
  /** default true; Plan 05 spike outcome may flip to false at deploy time */
  useJs?: boolean
}

export async function scrapeFormUrl(args: FormScrapeArgs): Promise<ExtractedFieldRecord[]> {
  await refuseIfInternalIp(args.url)  // SSRF guard (Plan 05)

  const useJs = args.useJs ?? (process.env.ENABLE_PLAYWRIGHT !== 'false')
  let text: string

  if (useJs) {
    // Dynamic import so Cheerio-only deploys don't pull playwright into the bundle.
    const { chromium: pw } = await import('playwright-core')
    const chromium = (await import('@sparticuz/chromium')).default
    const browser = await pw.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
    try {
      const page = await browser.newPage()
      await page.goto(args.url, { waitUntil: 'networkidle', timeout: 15_000 })
      text = await page.evaluate(() => (document.body?.innerText ?? '').slice(0, 50_000))
    } finally {
      await browser.close()
    }
  } else {
    const cheerio = await import('cheerio')
    const r = await fetch(args.url, { redirect: 'manual' })
    if (!r.ok) throw new Error(`FORM_SCRAPE_HTTP_${r.status}`)
    const html = await r.text()
    const $ = cheerio.load(html)
    $('script, style, noscript').remove()
    text = $('body').text().slice(0, 50_000)
  }

  if (!text) return []
  const records = await extractFromPastedText({
    text, agencyId: args.agencyId, clientId: args.clientId,
    sourceLabel: 'form_scrape', sourceUrl: args.url,
  })
  const ceiling = SOURCE_CONFIG.form_scrape.confidence_ceiling
  return records.map(({ field_name, record }) => ({
    field_name,
    record: { ...record, source_type: 'form_scrape' as const, confidence: Math.min(record.confidence, ceiling) },
  }))
}
