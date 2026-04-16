import 'server-only'
// ── Technical SEO Deep Intelligence Engine ─────────────────────────────────
// Deep crawl-based technical audit: sitemaps, canonicals, mobile, CWV, indexing.
// Called from /api/kotoiq route via action: audit_technical_deep / get_technical_deep.

import { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

// ── Types ───────────────────────────────────────────────────────────────────
interface CanonicalIssue {
  url: string
  issue: string // 'missing' | 'non_self' | 'points_to_404' | 'chain'
  canonical_url?: string
}

interface MobileMismatch {
  url: string
  issue: string // 'no_viewport' | 'fixed_width'
}

interface SitemapIssue {
  url: string
  issue: string
  status?: number
}

interface PageCrawlResult {
  url: string
  status: number
  canonical: string | null
  canonical_self: boolean
  has_viewport: boolean
  has_noindex: boolean
  response_time_ms: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function gradeFromScore(score: number): string {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

function cwvGrade(lcp: number | null, fid: number | null, cls: number | null): string {
  // Google thresholds
  const lcpGood = lcp !== null && lcp <= 2500
  const lcpPoor = lcp !== null && lcp > 4000
  const fidGood = fid !== null && fid <= 200
  const fidPoor = fid !== null && fid > 500
  const clsGood = cls !== null && cls <= 0.1
  const clsPoor = cls !== null && cls > 0.25

  if (lcpPoor || fidPoor || clsPoor) return 'Poor'
  if (lcpGood && fidGood && clsGood) return 'Good'
  return 'Needs Improvement'
}

async function fetchWithTimeout(url: string, timeoutMs = 12000): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    })
    return res
  } catch {
    return null
  }
}

async function fetchText(url: string): Promise<{ text: string | null; status: number; timeMs: number }> {
  const start = Date.now()
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    })
    const text = await res.text()
    return { text, status: res.status, timeMs: Date.now() - start }
  } catch {
    return { text: null, status: 0, timeMs: Date.now() - start }
  }
}

function extractCanonical(html: string): string | null {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)
  return match ? match[1] : null
}

function hasViewportMeta(html: string): boolean {
  return /<meta[^>]+name=["']viewport["']/i.test(html)
}

function hasNoindex(html: string): boolean {
  return /<meta[^>]+content=["'][^"']*noindex[^"']*["']/i.test(html)
    || /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html)
}

function extractUrlsFromSitemap(xml: string): string[] {
  const urls: string[] = []
  const matches = xml.matchAll(/<loc>\s*(https?:\/\/[^<]+)\s*<\/loc>/gi)
  for (const m of matches) {
    urls.push(m[1].trim())
  }
  return urls
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex/i.test(xml)
}

// ── Main audit function ─────────────────────────────────────────────────────
export async function auditTechnicalDeep(
  s: SupabaseClient,
  ai: Anthropic,
  body: { client_id: string; agency_id?: string }
) {
  const { client_id } = body
  if (!client_id) return { error: 'client_id required' }

  // Get client website
  const { data: client } = await s.from('clients').select('name, website').eq('id', client_id).single()
  if (!client?.website) return { error: 'No website found for client — set it on the client record first' }

  let baseUrl = client.website
  if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`
  baseUrl = baseUrl.replace(/\/+$/, '')
  const domain = new URL(baseUrl).hostname

  // ── Phase 1: Sitemap Analysis ──────────────────────────────────────────
  const sitemapPaths = ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml']
  let sitemapUrl: string | null = null
  let allSitemapUrls: string[] = []
  let sitemapCategorized = false
  const sitemapIssues: SitemapIssue[] = []
  const childSitemaps: string[] = []

  for (const path of sitemapPaths) {
    const url = baseUrl + path
    const res = await fetchWithTimeout(url)
    if (res && res.ok) {
      sitemapUrl = url
      const xml = await res.text()

      if (isSitemapIndex(xml)) {
        // It's a sitemap index — extract child sitemaps
        sitemapCategorized = true
        const childUrls = extractUrlsFromSitemap(xml)
        childSitemaps.push(...childUrls)

        // Fetch each child sitemap (limit to 10)
        for (const childUrl of childUrls.slice(0, 10)) {
          try {
            const childRes = await fetchWithTimeout(childUrl, 8000)
            if (childRes && childRes.ok) {
              const childXml = await childRes.text()
              const urls = extractUrlsFromSitemap(childXml)
              allSitemapUrls.push(...urls)
            } else {
              sitemapIssues.push({ url: childUrl, issue: 'child_sitemap_error', status: childRes?.status || 0 })
            }
          } catch {
            sitemapIssues.push({ url: childUrl, issue: 'child_sitemap_unreachable' })
          }
        }
      } else {
        // Single sitemap
        allSitemapUrls = extractUrlsFromSitemap(xml)
      }
      break
    }
  }

  // Deduplicate
  const uniqueUrls = [...new Set(allSitemapUrls)]
  const duplicateCount = allSitemapUrls.length - uniqueUrls.length
  if (duplicateCount > 0) {
    sitemapIssues.push({ url: sitemapUrl || '', issue: `${duplicateCount} duplicate URLs across sitemaps` })
  }

  const totalUrls = uniqueUrls.length || 1 // avoid division by zero

  // ── Phase 2: Page Crawl (sample up to 50 URLs) ────────────────────────
  const sampleSize = Math.min(50, uniqueUrls.length)
  // Pick evenly distributed sample
  const sampleUrls: string[] = []
  if (uniqueUrls.length <= 50) {
    sampleUrls.push(...uniqueUrls)
  } else {
    const step = Math.floor(uniqueUrls.length / 50)
    for (let i = 0; i < uniqueUrls.length && sampleUrls.length < 50; i += step) {
      sampleUrls.push(uniqueUrls[i])
    }
  }

  // Always include homepage
  if (!sampleUrls.includes(baseUrl) && !sampleUrls.includes(baseUrl + '/')) {
    sampleUrls.unshift(baseUrl)
  }

  const crawlResults: PageCrawlResult[] = []
  const canonicalIssues: CanonicalIssue[] = []
  const mobileMismatches: MobileMismatch[] = []
  const statusCodes: Record<string, number> = {}

  // Crawl in batches of 10
  for (let i = 0; i < sampleUrls.length; i += 10) {
    const batch = sampleUrls.slice(i, i + 10)
    const results = await Promise.all(batch.map(async (url) => {
      const { text: html, status, timeMs } = await fetchText(url)

      // Track status code distribution
      const statusKey = String(status)
      statusCodes[statusKey] = (statusCodes[statusKey] || 0) + 1

      if (!html || status === 0) {
        return { url, status, canonical: null, canonical_self: false, has_viewport: false, has_noindex: false, response_time_ms: timeMs }
      }

      const canonical = extractCanonical(html)
      const viewport = hasViewportMeta(html)
      const noindex = hasNoindex(html)

      // Canonical checks
      const canonicalSelf = canonical !== null && (canonical === url || canonical === url + '/' || url === canonical + '/')
      if (!canonical && status === 200) {
        canonicalIssues.push({ url, issue: 'missing' })
      } else if (canonical && !canonicalSelf) {
        canonicalIssues.push({ url, issue: 'non_self', canonical_url: canonical })
      }

      // Mobile checks
      if (!viewport && status === 200) {
        mobileMismatches.push({ url, issue: 'no_viewport' })
      }

      return { url, status, canonical, canonical_self: canonicalSelf, has_viewport: viewport, has_noindex: noindex, response_time_ms: timeMs }
    }))
    crawlResults.push(...results)
  }

  // Check for non-200 URLs in sitemap
  for (const result of crawlResults) {
    if (result.status !== 200 && result.status !== 0) {
      sitemapIssues.push({ url: result.url, issue: 'non_200_in_sitemap', status: result.status })
    }
  }

  const indexableUrls = crawlResults.filter(r => r.status === 200 && !r.has_noindex).length
  const totalSampled = crawlResults.length || 1

  // Extrapolate to full site
  const indexableRatio = indexableUrls / totalSampled
  const estimatedIndexable = Math.round(totalUrls * indexableRatio)

  // Status code distribution as object
  const statusCodeDist: Record<string, number> = {}
  for (const [code, count] of Object.entries(statusCodes)) {
    // Extrapolate to full site
    statusCodeDist[code] = Math.round((count / totalSampled) * totalUrls)
  }

  // ── Phase 3: Core Web Vitals ──────────────────────────────────────────
  let cwvLcp: number | null = null
  let cwvFid: number | null = null
  let cwvCls: number | null = null

  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_PLACES_API_KEY || ''
  if (apiKey) {
    try {
      const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(baseUrl)}&key=${apiKey}&category=performance&strategy=mobile`
      const psiRes = await fetch(psiUrl, { signal: AbortSignal.timeout(30000) })
      if (psiRes.ok) {
        const psiData = await psiRes.json()
        const le = psiData.loadingExperience?.metrics || {}

        // LCP in milliseconds
        if (le.LARGEST_CONTENTFUL_PAINT_MS) {
          cwvLcp = le.LARGEST_CONTENTFUL_PAINT_MS.percentile || null
        }
        // FID/INP — try INP first (newer), fall back to FID
        if (le.INTERACTION_TO_NEXT_PAINT) {
          cwvFid = le.INTERACTION_TO_NEXT_PAINT.percentile || null
        } else if (le.FIRST_INPUT_DELAY_MS) {
          cwvFid = le.FIRST_INPUT_DELAY_MS.percentile || null
        }
        // CLS (unitless, multiply by 100 for display in some contexts)
        if (le.CUMULATIVE_LAYOUT_SHIFT_SCORE) {
          cwvCls = (le.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile || 0) / 100 // API returns int * 100
        }
      }
    } catch {
      // CWV unavailable
    }
  }

  const cwvGradeValue = cwvGrade(cwvLcp, cwvFid, cwvCls)

  // ── Phase 4: Calculate Scores ─────────────────────────────────────────
  const crawlWastePct = Math.round(((totalUrls - estimatedIndexable) / totalUrls) * 100)

  // URL value ratio: cross-ref with kotoiq_keywords sc_top_page
  const { data: kws } = await s.from('kotoiq_keywords')
    .select('sc_top_page')
    .eq('client_id', client_id)
    .not('sc_top_page', 'is', null)
  const pagesWithTraffic = new Set((kws || []).map(k => k.sc_top_page).filter(Boolean))
  const urlValueRatio = totalUrls > 0 ? Math.round((pagesWithTraffic.size / totalUrls) * 100) : 0

  const canonicalScore = Math.max(0, Math.round(100 - (canonicalIssues.length / totalSampled * 100)))
  const mobileScore = Math.max(0, Math.round(100 - (mobileMismatches.length / totalSampled * 100)))
  const indexedPct = Math.round(indexableRatio * 100)

  // CWV score (0-100)
  let cwvScore = 50 // default if no data
  if (cwvLcp !== null || cwvCls !== null) {
    let pts = 0
    let factors = 0
    if (cwvLcp !== null) {
      pts += cwvLcp <= 2500 ? 100 : cwvLcp <= 4000 ? 60 : 20
      factors++
    }
    if (cwvFid !== null) {
      pts += cwvFid <= 200 ? 100 : cwvFid <= 500 ? 60 : 20
      factors++
    }
    if (cwvCls !== null) {
      pts += cwvCls <= 0.1 ? 100 : cwvCls <= 0.25 ? 60 : 20
      factors++
    }
    cwvScore = factors > 0 ? Math.round(pts / factors) : 50
  }

  // Overall score — weighted average
  const overallScore = Math.round(
    canonicalScore * 0.2 +
    mobileScore * 0.2 +
    indexedPct * 0.2 +
    cwvScore * 0.2 +
    (100 - crawlWastePct) * 0.1 +
    urlValueRatio * 0.1
  )

  // Not indexed reasons
  const notIndexedReasons: Record<string, number> = {}
  for (const r of crawlResults) {
    if (r.has_noindex) notIndexedReasons['noindex'] = (notIndexedReasons['noindex'] || 0) + 1
    if (r.status === 404) notIndexedReasons['404'] = (notIndexedReasons['404'] || 0) + 1
    if (r.status === 301 || r.status === 302) notIndexedReasons['redirect'] = (notIndexedReasons['redirect'] || 0) + 1
    if (r.status === 0) notIndexedReasons['unreachable'] = (notIndexedReasons['unreachable'] || 0) + 1
  }

  // ── Save to DB ────────────────────────────────────────────────────────
  const record = {
    client_id,
    total_urls: totalUrls,
    indexable_urls: estimatedIndexable,
    crawl_waste_pct: crawlWastePct,
    url_value_ratio: urlValueRatio,
    canonical_issues: canonicalIssues.slice(0, 50),
    canonical_score: canonicalScore,
    mobile_mismatches: mobileMismatches.slice(0, 50),
    mobile_score: mobileScore,
    sitemap_url: sitemapUrl,
    sitemap_urls_count: totalUrls,
    sitemap_categorized: sitemapCategorized,
    sitemap_issues: sitemapIssues.slice(0, 30),
    indexed_pct: indexedPct,
    not_indexed_reasons: notIndexedReasons,
    status_code_distribution: statusCodeDist,
    cwv_lcp: cwvLcp,
    cwv_fid: cwvFid,
    cwv_cls: cwvCls,
    cwv_grade: cwvGradeValue,
    overall_score: overallScore,
    scanned_at: new Date().toISOString(),
  }

  // Upsert: delete old then insert
  await s.from('kotoiq_technical_deep').delete().eq('client_id', client_id)
  const { error } = await s.from('kotoiq_technical_deep').insert(record)
  if (error) return { error: `DB save failed: ${error.message}` }

  // Log token usage (no AI tokens used in this audit, but log the action)
  try {
    await logTokenUsage({
      feature: 'kotoiq_technical_deep',
      model: 'crawl-engine',
      inputTokens: 0,
      outputTokens: 0,
      agencyId: body.agency_id || undefined,
    })
  } catch { /* non-critical */ }

  return { success: true, ...record }
}

// ── Get existing audit ─────────────────────────────────────────────────────
export async function getTechnicalDeep(
  s: SupabaseClient,
  body: { client_id: string }
) {
  const { client_id } = body
  if (!client_id) return { error: 'client_id required' }

  const { data } = await s.from('kotoiq_technical_deep')
    .select('*')
    .eq('client_id', client_id)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .single()

  return data ? { success: true, ...data } : { success: true, empty: true }
}
