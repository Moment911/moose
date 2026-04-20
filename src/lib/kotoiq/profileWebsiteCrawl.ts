import 'server-only'
import { extractFromPastedText, type ExtractedFieldRecord } from './profileExtractClaude'
import { SOURCE_CONFIG } from './profileConfig'
import { refuseIfInternalIp } from './profileWebsiteSSRFGuard'
import { fetchRobots, isAllowedForCrawl, type RobotsMode, type RobotsRules } from './profileWebsiteRobots'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 / Plan 05 — Website crawl orchestrator (PROF-08).
//
// Modes:
//   A — targeted paths (/about, /services, /contact, etc.) + sitemap top-level; cap 10 pages
//   B — BFS depth-2, follow internal links; cap 100 pages
//   C — sitemap-first, prioritize About/Services/Contact paths; cap 15 pages
//
// Per-page: extract text → extractFromPastedText with sourceUrl = page URL (D-10)
// Cost tracking: abort mid-crawl if accumulated cost > cost_cap (D-08)
// SSRF: refuseIfInternalIp before every fetch
// ─────────────────────────────────────────────────────────────────────────────

export type CrawlScope = 'A' | 'B' | 'C'

export type CrawlArgs = {
  url: string
  agencyId: string
  clientId: string
  scope?: CrawlScope
  useJs?: boolean
  robotsMode?: RobotsMode
  costCap?: number
}

export type CrawlResult = {
  records: ExtractedFieldRecord[]
  pages_crawled: string[]
  pages_skipped: Array<{ url: string; reason: string }>
  warnings: string[]
  cost_spent_usd: number
  aborted: boolean
  abort_reason?: 'cost_cap' | null
}

const TARGETED_PATHS = [
  '/', '/about', '/about-us', '/services', '/what-we-do',
  '/contact', '/contact-us', '/locations', '/team', '/our-team',
]
const PRIORITIZED_KEYWORDS = /about|service|contact|location|team|who-we|company/i
const MODE_A_CAP = 10
const MODE_B_CAP = 100
const MODE_C_CAP = 15
const PER_PAGE_COST = 0.011
const JS_OVERHEAD = 0.004

export async function crawlWebsite(args: CrawlArgs): Promise<CrawlResult> {
  const scope = args.scope ?? 'A'
  const useJs = args.useJs ?? (process.env.ENABLE_PLAYWRIGHT !== 'false')
  const robotsMode = args.robotsMode ?? 'warn_but_allow'
  const costCap = args.costCap ?? SOURCE_CONFIG.website_scrape.default_cost_cap
  const ceiling = SOURCE_CONFIG.website_scrape.confidence_ceiling

  const origin = new URL(args.url).origin
  const robots = await fetchRobots(args.url)
  const pagesSkipped: CrawlResult['pages_skipped'] = []
  const warnings: string[] = []
  let costSpent = 0
  let aborted = false
  let abortReason: 'cost_cap' | null = null

  // Resolve page list per scope
  let pagesInScope: string[] = []
  if (scope === 'A') {
    pagesInScope = TARGETED_PATHS.map(p => `${origin}${p}`).slice(0, MODE_A_CAP)
  } else if (scope === 'C') {
    pagesInScope = await resolveSitemapPages(origin, MODE_C_CAP)
    if (!pagesInScope.length) pagesInScope = TARGETED_PATHS.map(p => `${origin}${p}`).slice(0, MODE_A_CAP)
  } else {
    // Mode B: seed with targeted paths + sitemap
    pagesInScope = await bfsPages(origin, MODE_B_CAP)
  }

  const pagesCrawled: string[] = []
  const records: ExtractedFieldRecord[] = []

  // Shared browser for useJs=true
  let browser: any = null
  if (useJs) {
    const { chromium: pw } = await import('playwright-core')
    const chromium = (await import('@sparticuz/chromium')).default
    browser = await pw.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }

  try {
    for (const pageUrl of pagesInScope) {
      // SSRF guard before every fetch
      try {
        await refuseIfInternalIp(pageUrl)
      } catch (err: any) {
        if (err?.code === 'SSRF_BLOCKED') {
          pagesSkipped.push({ url: pageUrl, reason: `ssrf:${err.code}` })
          continue
        }
        throw err
      }

      // robots.txt check
      const decision = isAllowedForCrawl(pageUrl, robots, robotsMode)
      warnings.push(...decision.warnings)
      if (!decision.allowed) {
        pagesSkipped.push({ url: pageUrl, reason: 'robots' })
        continue
      }

      // Cost-cap check (D-08)
      const perPageCost = PER_PAGE_COST + (useJs ? JS_OVERHEAD : 0)
      if (costSpent + perPageCost > costCap) {
        aborted = true
        abortReason = 'cost_cap'
        break
      }

      // Fetch page content
      let text: string | null = null
      try {
        if (useJs && browser) {
          const page = await browser.newPage()
          await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 15_000 })
          text = (await page.evaluate(() => (document.body?.innerText ?? '').slice(0, 50_000))) as string
          await page.close()
        } else {
          const cheerio = await import('cheerio')
          const r = await fetch(pageUrl, { redirect: 'manual' })
          if (!r.ok) { pagesSkipped.push({ url: pageUrl, reason: `http_${r.status}` }); continue }
          const html = await r.text()
          const $ = cheerio.load(html)
          $('script, style, noscript, nav, footer').remove()
          text = $('body').text().slice(0, 50_000)
        }
      } catch (err: any) {
        pagesSkipped.push({ url: pageUrl, reason: `fetch_error:${err?.message ?? 'unknown'}` })
        continue
      }

      if (!text || text.trim().length < 40) {
        pagesSkipped.push({ url: pageUrl, reason: 'empty_content' })
        continue
      }

      // Extract fields from page text (D-10: per-page citation via sourceUrl)
      const extracted = await extractFromPastedText({
        text,
        agencyId: args.agencyId,
        clientId: args.clientId,
        sourceLabel: 'website_scrape',
        sourceUrl: pageUrl,
      })

      // D-09 confidence ceiling + D-10 per-page source_url
      for (const { field_name, record } of extracted) {
        records.push({
          field_name,
          record: {
            ...record,
            source_type: 'website_scrape' as any,
            source_url: pageUrl,
            confidence: Math.min(record.confidence, ceiling),
          },
        })
      }

      pagesCrawled.push(pageUrl)
      costSpent += perPageCost
    }
  } finally {
    if (browser) await browser.close().catch(() => {})
  }

  return {
    records,
    pages_crawled: pagesCrawled,
    pages_skipped: pagesSkipped,
    warnings,
    cost_spent_usd: Math.round(costSpent * 10000) / 10000,
    aborted,
    abort_reason: abortReason,
  }
}

// ── Sitemap resolver ──────────────────────────────────────────────────────────

async function resolveSitemapPages(origin: string, cap: number): Promise<string[]> {
  try {
    await refuseIfInternalIp(`${origin}/sitemap.xml`)
    const r = await fetch(`${origin}/sitemap.xml`)
    if (!r.ok) return []
    const body = await r.text()
    const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim())
    // Prioritize about/services/contact patterns first
    const prioritized = locs.filter(u => PRIORITIZED_KEYWORDS.test(u))
    const rest = locs.filter(u => !PRIORITIZED_KEYWORDS.test(u))
    return [...prioritized, ...rest].slice(0, cap)
  } catch { return [] }
}

// ── BFS page resolver (simplified v1 — true link-following deferred) ─────────

async function bfsPages(origin: string, cap: number): Promise<string[]> {
  const seeds = [origin + '/', ...TARGETED_PATHS.slice(1).map(p => origin + p)]
  const sitemap = await resolveSitemapPages(origin, cap)
  const uniq = [...new Set([...seeds, ...sitemap])]
  return uniq.slice(0, cap)
}
