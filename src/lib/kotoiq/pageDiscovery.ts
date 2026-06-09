// ─────────────────────────────────────────────────────────────
// Page Discovery — Phase B
//
// When a user adds a competitor to AEO Visibility, auto-discover
// their 5 most-important pages and pre-track them. Fast first
// impression: scan a competitor and instantly see what we're
// watching, with the option to add more.
//
// Strategy:
// 1. Pull robots.txt → find sitemap declarations
// 2. Fetch up to 3 sitemaps → collect URLs (cap 500)
// 3. Pattern-match for high-signal pages: /, /pricing, /features,
//    /about, recent blog posts
// 4. Return top 5 candidates ranked by signal type
// ─────────────────────────────────────────────────────────────

import 'server-only'
import { inferPageType, urlDomain } from './pageContentExtractor'

const FETCH_TIMEOUT_MS = 8000
const MAX_PAGES_RETURNED = 5

export interface DiscoveredPage {
  url: string
  page_type: string
  reason: string             // why this page was picked
  priority: number           // lower = more important
}

export async function discoverPages(domain: string): Promise<{ pages: DiscoveredPage[]; sitemap_url?: string; error?: string }> {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  if (!cleanDomain) return { pages: [], error: 'invalid_domain' }

  const homepage = `https://${cleanDomain}/`
  let allUrls: string[] = [homepage]
  let sitemap_url: string | undefined

  // 1) robots.txt → sitemap declarations
  try {
    const robotsRes = await fetch(`https://${cleanDomain}/robots.txt`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'KotoBot/1.0 (+https://hellokoto.com)' },
    })
    if (robotsRes.ok) {
      const txt = await robotsRes.text()
      const sitemaps = txt.match(/^Sitemap:\s*(\S+)/gim)?.map(s => s.split(/\s+/)[1]) || []
      for (const sm of sitemaps.slice(0, 3)) {
        try {
          const sitemapUrls = await fetchSitemapUrls(sm)
          allUrls.push(...sitemapUrls)
          if (!sitemap_url) sitemap_url = sm
        } catch { /* skip */ }
      }
    }
  } catch { /* skip */ }

  // 2) Fallback common sitemap locations
  if (allUrls.length < 5) {
    for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
      try {
        const more = await fetchSitemapUrls(`https://${cleanDomain}${path}`)
        if (more.length) {
          allUrls.push(...more)
          if (!sitemap_url) sitemap_url = `https://${cleanDomain}${path}`
          break
        }
      } catch { /* skip */ }
    }
  }

  // Dedupe + same-domain only
  const urls = Array.from(new Set(allUrls))
    .filter(u => urlDomain(u) === cleanDomain)
    .slice(0, 500)

  // 3) Score candidates
  const scored = urls.map(u => scoreUrl(u, cleanDomain)).filter(Boolean) as DiscoveredPage[]

  // 4) Top 5 unique page_types where possible (don't return 5 blog posts)
  const seenTypes = new Map<string, number>()
  const picked: DiscoveredPage[] = []
  scored.sort((a, b) => a.priority - b.priority)
  for (const c of scored) {
    const count = seenTypes.get(c.page_type) || 0
    // allow 2 blog posts max; one each of every other type
    const maxPerType = c.page_type === 'blog_post' ? 2 : 1
    if (count >= maxPerType) continue
    picked.push(c)
    seenTypes.set(c.page_type, count + 1)
    if (picked.length >= MAX_PAGES_RETURNED) break
  }

  // Always ensure home page is in there
  if (!picked.find(p => p.page_type === 'home')) {
    picked.unshift({ url: homepage, page_type: 'home', reason: 'homepage', priority: 0 })
    if (picked.length > MAX_PAGES_RETURNED) picked.pop()
  }

  return { pages: picked, sitemap_url }
}

/**
 * Full same-domain URL inventory for a domain — NOT the top-5 competitor
 * quick-look. `discoverPages` deliberately scores down to MAX_PAGES_RETURNED (5)
 * for a fast first impression; a CLIENT baseline (WS2) needs the WHOLE site, so
 * this returns the full deduped same-domain sitemap list (homepage always first,
 * capped at the same 500-URL sitemap sanity cap discoverPages uses internally,
 * never the 5-page cap). Reuses the identical robots→sitemap discovery path —
 * no new crawler.
 */
export async function discoverAllUrls(domain: string): Promise<{ urls: string[]; sitemap_url?: string; error?: string }> {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  if (!cleanDomain) return { urls: [], error: 'invalid_domain' }

  const homepage = `https://${cleanDomain}/`
  const allUrls: string[] = [homepage]
  let sitemap_url: string | undefined

  // 1) robots.txt → sitemap declarations (identical to discoverPages)
  try {
    const robotsRes = await fetch(`https://${cleanDomain}/robots.txt`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'KotoBot/1.0 (+https://hellokoto.com)' },
    })
    if (robotsRes.ok) {
      const txt = await robotsRes.text()
      const sitemaps = txt.match(/^Sitemap:\s*(\S+)/gim)?.map(s => s.split(/\s+/)[1]) || []
      for (const sm of sitemaps.slice(0, 3)) {
        try {
          const sitemapUrls = await fetchSitemapUrls(sm)
          allUrls.push(...sitemapUrls)
          if (!sitemap_url) sitemap_url = sm
        } catch { /* skip */ }
      }
    }
  } catch { /* skip */ }

  // 2) Fallback common sitemap locations
  if (allUrls.length < 5) {
    for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
      try {
        const more = await fetchSitemapUrls(`https://${cleanDomain}${path}`)
        if (more.length) {
          allUrls.push(...more)
          if (!sitemap_url) sitemap_url = `https://${cleanDomain}${path}`
          break
        }
      } catch { /* skip */ }
    }
  }

  // Dedupe + same-domain only + drop non-page asset URLs. NOTE: 500 is the
  // sitemap sanity cap, NOT the 5-page competitor cap — the full inventory.
  const urls = Array.from(new Set(allUrls))
    .filter(u => urlDomain(u) === cleanDomain)
    .filter(u => !/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|webm|xml|ico)$/i.test(u))
    .slice(0, 500)

  // Homepage always first.
  const ordered = [homepage, ...urls.filter(u => u !== homepage)]
  return { urls: Array.from(new Set(ordered)), sitemap_url }
}

function scoreUrl(url: string, _domain: string): DiscoveredPage | null {
  let type = inferPageType(url)
  let path = ''
  try { path = new URL(url).pathname.toLowerCase() } catch { return null }

  // Priority ranking — lower number = more important to track
  const rank: Record<string, { priority: number; reason: string }> = {
    home:      { priority: 0, reason: 'homepage' },
    pricing:   { priority: 1, reason: 'pricing page' },
    features:  { priority: 2, reason: 'features / product page' },
    about:     { priority: 4, reason: 'about page' },
    landing:   { priority: 5, reason: 'landing page' },
    blog_post: { priority: 6, reason: 'blog post' },
    other:     { priority: 9, reason: 'other' },
  }
  const r = rank[type] || rank.other
  if (type === 'other') return null

  // Skip excluded patterns
  if (/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|webm|xml|ico)$/i.test(path)) return null
  if (/\/(login|signin|signup|register|account|cart|checkout|search|tag|category)/i.test(path)) return null

  return { url, page_type: type, reason: r.reason, priority: r.priority }
}

async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const out: string[] = []
  const res = await fetch(sitemapUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': 'KotoBot/1.0 (+https://hellokoto.com)' },
  })
  if (!res.ok) return out
  const xml = await res.text()

  // Sub-sitemaps
  const subMatches = xml.match(/<sitemap>[\s\S]*?<\/sitemap>/g) || []
  if (subMatches.length > 0) {
    for (const sm of subMatches.slice(0, 3)) {
      const loc = sm.match(/<loc>([^<]+)<\/loc>/)?.[1]
      if (!loc) continue
      try {
        const subRes = await fetch(loc, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: { 'User-Agent': 'KotoBot/1.0 (+https://hellokoto.com)' },
        })
        if (subRes.ok) {
          const subXml = await subRes.text()
          const matches = subXml.match(/<loc>([^<]+)<\/loc>/g) || []
          for (const m of matches.slice(0, 300)) {
            const u = m.replace(/<\/?loc>/g, '').trim()
            if (u && !u.endsWith('.xml')) out.push(u)
          }
        }
      } catch { /* skip */ }
    }
    return out
  }

  // Single sitemap
  const matches = xml.match(/<loc>([^<]+)<\/loc>/g) || []
  for (const m of matches) {
    const u = m.replace(/<\/?loc>/g, '').trim()
    if (u && !u.endsWith('.xml')) out.push(u)
  }
  return out
}
