// ─────────────────────────────────────────────────────────────
// Industrial Sitemap Crawler — handles massive multi-sitemap sites
//
// Capabilities:
//  - Recursive sitemap-index resolution (unlimited depth)
//  - Compressed .xml.gz sitemaps
//  - Concurrent child-sitemap fetching (up to 20 parallel)
//  - URL deduplication + normalization
//  - DB persistence to kotoiq_sitemap_urls for downstream engines
//  - Pagination-friendly chunked processing
//  - Progress tracking via kotoiq_sitemap_crawls
//
// Use this as the FIRST step for any engine that needs to process
// many URLs (Content Refresh, Topical Map, Internal Links, etc.)
// ─────────────────────────────────────────────────────────────

import { gunzipSync } from 'zlib'

type SB = any

const CONCURRENT_SITEMAP_FETCHES = 20
const MAX_SITEMAP_DEPTH = 10
const FETCH_TIMEOUT_MS = 15000
const MAX_URLS_PER_SITEMAP = 50000 // sitemap spec limit

// ── Types ────────────────────────────────────────────────────

export interface SitemapUrl {
  loc: string
  lastmod?: string
  priority?: number
  changefreq?: string
}

export interface CrawlProgress {
  crawl_id: string
  client_id: string
  status: 'running' | 'complete' | 'failed'
  sitemaps_found: number
  sitemaps_processed: number
  urls_discovered: number
  urls_saved: number
  depth_reached: number
  errors: string[]
  started_at: string
  completed_at?: string
}

export interface CrawlOptions {
  maxUrls?: number            // stop at N URLs (default: unlimited)
  maxDepth?: number           // sitemap-index recursion depth (default: 10)
  includePatterns?: string[]  // only URLs matching any pattern (substring)
  excludePatterns?: string[]  // skip URLs matching any pattern
  onlyNewSince?: string       // ISO date — only URLs with lastmod >= this
}

// ── Core crawler ─────────────────────────────────────────────

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)',
        'Accept': 'application/xml, text/xml, application/gzip, */*',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const arr = new Uint8Array(await res.arrayBuffer())
    return arr
  } catch {
    return null
  }
}

function decodeBytes(bytes: Uint8Array, url: string): string | null {
  try {
    // Handle gzipped sitemaps (.xml.gz)
    if (url.endsWith('.gz') || (bytes[0] === 0x1f && bytes[1] === 0x8b)) {
      const buf = Buffer.from(bytes)
      return gunzipSync(buf).toString('utf8')
    }
    return Buffer.from(bytes).toString('utf8')
  } catch {
    return null
  }
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[^>]*>/i.test(xml)
}

function extractUrlsFromSitemap(xml: string): SitemapUrl[] {
  const urls: SitemapUrl[] = []
  // Match <url>...</url> blocks
  const urlBlocks = xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)
  let count = 0
  for (const match of urlBlocks) {
    if (count >= MAX_URLS_PER_SITEMAP) break
    const block = match[1]
    const loc = block.match(/<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/i)?.[1]
    if (!loc) continue
    const lastmod = block.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/i)?.[1]
    const priorityStr = block.match(/<priority>\s*([\d.]+)\s*<\/priority>/i)?.[1]
    const changefreq = block.match(/<changefreq>\s*([^<]+?)\s*<\/changefreq>/i)?.[1]
    urls.push({
      loc: loc.trim(),
      lastmod: lastmod?.trim(),
      priority: priorityStr ? parseFloat(priorityStr) : undefined,
      changefreq: changefreq?.trim(),
    })
    count++
  }
  // Fallback: bare <loc> extraction (covers non-standard sitemaps)
  if (urls.length === 0) {
    const locMatches = xml.matchAll(/<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi)
    for (const m of locMatches) {
      if (urls.length >= MAX_URLS_PER_SITEMAP) break
      urls.push({ loc: m[1].trim() })
    }
  }
  return urls
}

function extractChildSitemapsFromIndex(xml: string): string[] {
  const children: string[] = []
  const blocks = xml.matchAll(/<sitemap\b[^>]*>([\s\S]*?)<\/sitemap>/gi)
  for (const m of blocks) {
    const loc = m[1].match(/<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/i)?.[1]
    if (loc) children.push(loc.trim())
  }
  return children
}

// ── Discover root sitemaps ───────────────────────────────────

async function discoverRootSitemaps(websiteUrl: string): Promise<string[]> {
  const base = websiteUrl.replace(/\/+$/, '')
  const candidates = [
    `${base}/sitemap.xml`,
    `${base}/sitemap_index.xml`,
    `${base}/sitemap-index.xml`,
    `${base}/wp-sitemap.xml`,
    `${base}/sitemap.xml.gz`,
  ]

  // Parse robots.txt for Sitemap: directives
  try {
    const robotsBytes = await fetchBytes(`${base}/robots.txt`)
    if (robotsBytes) {
      const text = Buffer.from(robotsBytes).toString('utf8')
      const sitemapLines = [...text.matchAll(/^\s*Sitemap:\s*(https?:\/\/\S+)/gim)].map(m => m[1].trim())
      candidates.push(...sitemapLines)
    }
  } catch { /* ignore */ }

  // Dedupe and return only ones that actually respond
  const unique = [...new Set(candidates)]
  const checks = await Promise.all(
    unique.map(async url => {
      const bytes = await fetchBytes(url)
      return bytes ? url : null
    })
  )
  return checks.filter((u): u is string => u !== null)
}

// ── Main crawl function ──────────────────────────────────────

export async function crawlSitemaps(
  s: SB,
  params: {
    client_id: string
    website: string
    options?: CrawlOptions
  }
): Promise<CrawlProgress> {
  const { client_id, website, options = {} } = params
  const maxUrls = options.maxUrls ?? Infinity
  const maxDepth = options.maxDepth ?? MAX_SITEMAP_DEPTH

  // Create crawl record
  const { data: crawlRow } = await s
    .from('kotoiq_sitemap_crawls')
    .insert({ client_id, status: 'running', started_at: new Date().toISOString() })
    .select()
    .single()

  const crawlId = crawlRow?.id
  const errors: string[] = []
  let sitemapsFound = 0
  let sitemapsProcessed = 0
  let urlsDiscovered = 0
  let urlsSaved = 0
  let depthReached = 0

  try {
    // 1. Discover root sitemaps
    const normalized = website.startsWith('http') ? website : `https://${website}`
    const roots = await discoverRootSitemaps(normalized)
    if (roots.length === 0) {
      throw new Error(`No sitemaps found. Tried /sitemap.xml, /sitemap_index.xml, /wp-sitemap.xml, /sitemap.xml.gz, robots.txt`)
    }

    // 2. Clear previous URLs for this client
    await s.from('kotoiq_sitemap_urls').delete().eq('client_id', client_id)

    // 3. BFS through sitemap-index recursion
    const queue: { url: string; depth: number }[] = roots.map(url => ({ url, depth: 0 }))
    const visited = new Set<string>()
    const seenUrls = new Set<string>()

    sitemapsFound = roots.length

    // Batch inserts every 500 URLs
    let urlBuffer: any[] = []
    const flushBuffer = async () => {
      if (urlBuffer.length === 0) return
      const { error } = await s.from('kotoiq_sitemap_urls').insert(urlBuffer)
      if (!error) urlsSaved += urlBuffer.length
      urlBuffer = []
    }

    while (queue.length > 0 && urlsDiscovered < maxUrls) {
      // Pull a batch of concurrent fetches
      const batch = queue.splice(0, CONCURRENT_SITEMAP_FETCHES)

      const results = await Promise.all(batch.map(async item => {
        if (visited.has(item.url) || item.depth > maxDepth) return null
        visited.add(item.url)
        depthReached = Math.max(depthReached, item.depth)

        const bytes = await fetchBytes(item.url)
        if (!bytes) {
          errors.push(`Failed to fetch ${item.url}`)
          return null
        }
        const xml = decodeBytes(bytes, item.url)
        if (!xml) {
          errors.push(`Failed to decode ${item.url}`)
          return null
        }
        return { url: item.url, depth: item.depth, xml }
      }))

      for (const r of results) {
        if (!r) continue
        sitemapsProcessed++

        if (isSitemapIndex(r.xml)) {
          // Enqueue child sitemaps
          const children = extractChildSitemapsFromIndex(r.xml)
          sitemapsFound += children.length
          for (const child of children) {
            if (!visited.has(child)) {
              queue.push({ url: child, depth: r.depth + 1 })
            }
          }
        } else {
          // Extract URLs
          const sitemapUrls = extractUrlsFromSitemap(r.xml)
          for (const u of sitemapUrls) {
            if (urlsDiscovered >= maxUrls) break
            // Dedupe + filter
            const normUrl = u.loc.split('#')[0]
            if (seenUrls.has(normUrl)) continue

            // Include/exclude patterns
            if (options.includePatterns?.length && !options.includePatterns.some(p => normUrl.includes(p))) continue
            if (options.excludePatterns?.some(p => normUrl.includes(p))) continue

            // Lastmod filter
            if (options.onlyNewSince && u.lastmod) {
              try {
                if (new Date(u.lastmod) < new Date(options.onlyNewSince)) continue
              } catch { /* keep */ }
            }

            seenUrls.add(normUrl)
            urlBuffer.push({
              client_id,
              crawl_id: crawlId,
              url: normUrl,
              lastmod: u.lastmod || null,
              priority: u.priority || null,
              changefreq: u.changefreq || null,
              source_sitemap: r.url,
              discovered_at: new Date().toISOString(),
            })
            urlsDiscovered++

            if (urlBuffer.length >= 500) {
              await flushBuffer()
            }
          }
        }
      }

      // Update progress mid-crawl every batch
      if (crawlId) {
        await s.from('kotoiq_sitemap_crawls').update({
          sitemaps_found: sitemapsFound,
          sitemaps_processed: sitemapsProcessed,
          urls_discovered: urlsDiscovered,
          urls_saved: urlsSaved,
          depth_reached: depthReached,
        }).eq('id', crawlId)
      }
    }

    // Final flush
    await flushBuffer()

    // Mark complete
    if (crawlId) {
      await s.from('kotoiq_sitemap_crawls').update({
        status: 'complete',
        sitemaps_found: sitemapsFound,
        sitemaps_processed: sitemapsProcessed,
        urls_discovered: urlsDiscovered,
        urls_saved: urlsSaved,
        depth_reached: depthReached,
        errors: errors.slice(0, 50),
        completed_at: new Date().toISOString(),
      }).eq('id', crawlId)
    }

    return {
      crawl_id: crawlId,
      client_id,
      status: 'complete',
      sitemaps_found: sitemapsFound,
      sitemaps_processed: sitemapsProcessed,
      urls_discovered: urlsDiscovered,
      urls_saved: urlsSaved,
      depth_reached: depthReached,
      errors: errors.slice(0, 20),
      started_at: crawlRow?.started_at || new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }
  } catch (e: any) {
    if (crawlId) {
      await s.from('kotoiq_sitemap_crawls').update({
        status: 'failed',
        errors: [...errors, e.message].slice(0, 50),
        completed_at: new Date().toISOString(),
      }).eq('id', crawlId)
    }
    return {
      crawl_id: crawlId,
      client_id,
      status: 'failed',
      sitemaps_found: sitemapsFound,
      sitemaps_processed: sitemapsProcessed,
      urls_discovered: urlsDiscovered,
      urls_saved: urlsSaved,
      depth_reached: depthReached,
      errors: [...errors, e.message],
      started_at: crawlRow?.started_at || new Date().toISOString(),
    }
  }
}

// ── Helper: get URLs from saved crawl (paginated) ────────────

export async function getSitemapUrls(
  s: SB,
  params: {
    client_id: string
    limit?: number
    offset?: number
    orderBy?: 'lastmod' | 'priority' | 'url' | 'discovered_at'
    filter?: { pathContains?: string; olderThan?: string; newerThan?: string }
  }
): Promise<{ urls: any[]; total: number }> {
  const { client_id, limit = 1000, offset = 0, orderBy = 'discovered_at', filter = {} } = params

  let q = s.from('kotoiq_sitemap_urls').select('*', { count: 'exact' }).eq('client_id', client_id)
  if (filter.pathContains) q = q.ilike('url', `%${filter.pathContains}%`)
  if (filter.olderThan) q = q.lt('lastmod', filter.olderThan)
  if (filter.newerThan) q = q.gt('lastmod', filter.newerThan)
  q = q.order(orderBy, { ascending: false }).range(offset, offset + limit - 1)

  const { data, count } = await q
  return { urls: data || [], total: count || 0 }
}

// ── Helper: get crawl status ──────────────────────────────────

export async function getLatestCrawl(s: SB, client_id: string) {
  const { data } = await s
    .from('kotoiq_sitemap_crawls')
    .select('*')
    .eq('client_id', client_id)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()
  return data
}

// ── Helper: chunk processor for engines ──────────────────────
// Generic utility for any engine to process URLs in batches
// with concurrency control

export async function processUrlsInChunks<T>(
  urls: string[],
  processor: (url: string) => Promise<T>,
  options: { concurrency?: number; onProgress?: (done: number, total: number) => void } = {}
): Promise<T[]> {
  const { concurrency = 10, onProgress } = options
  const results: T[] = []
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)
    onProgress?.(results.length, urls.length)
  }
  return results
}
