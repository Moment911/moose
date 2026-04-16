// ─────────────────────────────────────────────────────────────
// Internal Link Intelligence Engine — KotoIQ Feature #2
//
// Crawls a client's website, extracts all internal links,
// audits link equity distribution, and generates AI
// recommendations for internal linking improvements.
// ─────────────────────────────────────────────────────────────
import { logTokenUsage } from '@/lib/tokenTracker'

type SB = any
type AI = any

// ── Helpers ──────────────────────────────────────────────────

function sameDomain(href: string, base: string): boolean {
  try {
    const u = new URL(href, base)
    const b = new URL(base)
    return u.hostname === b.hostname || u.hostname === 'www.' + b.hostname || 'www.' + u.hostname === b.hostname
  } catch { return false }
}

function resolve(href: string, base: string): string {
  try {
    const u = new URL(href, base)
    u.hash = ''
    u.search = ''
    return u.href.replace(/\/+$/, '')
  } catch { return '' }
}

function classifyAnchorType(text: string, href: string, domain: string): string {
  const t = (text || '').trim().toLowerCase()
  if (!t || t === '') return 'image'
  if (/^(click here|read more|learn more|here|this|more|continue|go|link)$/i.test(t)) return 'generic'
  try {
    const u = new URL(href, `https://${domain}`)
    if (t === u.href || t === u.hostname || t === u.pathname) return 'naked_url'
  } catch { /* ignore */ }
  if (t.includes(domain.replace(/^www\./, '').split('.')[0].toLowerCase())) return 'branded'
  // Rough: if anchor is 1-3 words and looks like a keyword, it's exact/partial
  const words = t.split(/\s+/).length
  if (words <= 4) return 'exact'
  return 'partial'
}

interface ExtractedLink {
  source_url: string
  target_url: string
  anchor_text: string
  anchor_type: string
  position: string
  is_first_link: boolean
  status_code?: number
}

// ── Minimal HTML parser for link extraction (no DOM needed on server) ──

function extractLinksFromHTML(html: string, pageUrl: string, domain: string): ExtractedLink[] {
  const links: ExtractedLink[] = []
  const seenTargets = new Set<string>()

  // Detect positions by finding landmark tags
  // Build a position map: for each character index, what section are we in?
  const lc = html.toLowerCase()

  // Find tag boundaries
  const headerEnd = Math.max(
    findClosingTag(lc, '<header'),
    findClosingTag(lc, '<nav')
  )
  const footerStart = lc.lastIndexOf('<footer')
  const sidebarRanges = findAllTagRanges(lc, '<aside')
  const navRanges = findAllTagRanges(lc, '<nav')

  // Extract all <a> tags
  const aTagRegex = /<a\s[^>]*href\s*=\s*["']([^"']*?)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = aTagRegex.exec(html)) !== null) {
    const href = match[1]
    const innerHtml = match[2]
    const pos = match.index

    // Only internal links
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue
    if (!sameDomain(href, `https://${domain}`)) continue

    const targetUrl = resolve(href, pageUrl)
    if (!targetUrl) continue

    // Strip HTML tags from anchor text
    const anchorText = innerHtml.replace(/<[^>]*>/g, '').trim().slice(0, 300)
    const anchorType = classifyAnchorType(anchorText, href, domain)

    // Determine position
    let position = 'content'
    if (isInRanges(pos, navRanges)) position = 'nav'
    else if (headerEnd > 0 && pos < headerEnd) position = 'header'
    else if (footerStart > 0 && pos >= footerStart) position = 'footer'
    else if (isInRanges(pos, sidebarRanges)) position = 'sidebar'

    const isFirst = !seenTargets.has(targetUrl)
    seenTargets.add(targetUrl)

    links.push({
      source_url: pageUrl,
      target_url: targetUrl,
      anchor_text: anchorText,
      anchor_type: anchorType,
      position,
      is_first_link: isFirst,
    })
  }

  return links
}

function findClosingTag(html: string, openTag: string): number {
  const idx = html.indexOf(openTag)
  if (idx === -1) return -1
  const tagName = openTag.replace('<', '').trim()
  const closeTag = `</${tagName}>`
  const closeIdx = html.indexOf(closeTag, idx)
  return closeIdx > 0 ? closeIdx + closeTag.length : -1
}

function findAllTagRanges(html: string, openTag: string): [number, number][] {
  const ranges: [number, number][] = []
  const tagName = openTag.replace('<', '').trim()
  let searchFrom = 0
  while (true) {
    const start = html.indexOf(openTag, searchFrom)
    if (start === -1) break
    const closeTag = `</${tagName}>`
    const end = html.indexOf(closeTag, start)
    if (end === -1) break
    ranges.push([start, end + closeTag.length])
    searchFrom = end + closeTag.length
  }
  return ranges
}

function isInRanges(pos: number, ranges: [number, number][]): boolean {
  return ranges.some(([s, e]) => pos >= s && pos <= e)
}

// ── Fetch sitemap URLs ──────────────────────────────────────

async function fetchSitemapUrls(domain: string): Promise<string[]> {
  const urls = new Set<string>()
  const base = `https://${domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`

  // Try sitemap.xml, sitemap_index.xml, robots.txt
  const sitemapUrls = [
    `${base}/sitemap.xml`,
    `${base}/sitemap_index.xml`,
  ]

  for (const smUrl of sitemapUrls) {
    try {
      const res = await fetch(smUrl, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'KotoIQ/1.0' } })
      if (!res.ok) continue
      const xml = await res.text()

      // Check if this is a sitemap index
      if (xml.includes('<sitemapindex')) {
        const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi
        let m: RegExpExecArray | null
        while ((m = locRegex.exec(xml)) !== null) {
          // Fetch child sitemaps
          try {
            const childRes = await fetch(m[1], { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'KotoIQ/1.0' } })
            if (childRes.ok) {
              const childXml = await childRes.text()
              const childLocRegex = /<loc>\s*(.*?)\s*<\/loc>/gi
              let cm: RegExpExecArray | null
              while ((cm = childLocRegex.exec(childXml)) !== null) {
                if (urls.size >= 200) break
                urls.add(cm[1].trim().replace(/\/+$/, ''))
              }
            }
          } catch { /* skip broken child sitemaps */ }
          if (urls.size >= 200) break
        }
      } else {
        // Regular sitemap
        const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi
        let m: RegExpExecArray | null
        while ((m = locRegex.exec(xml)) !== null) {
          if (urls.size >= 200) break
          urls.add(m[1].trim().replace(/\/+$/, ''))
        }
      }
      if (urls.size > 0) break // Got URLs from first working sitemap
    } catch { /* try next */ }
  }

  // Fallback: if no sitemap or too few URLs, add the homepage
  if (urls.size === 0) {
    urls.add(base)
  }

  return Array.from(urls).slice(0, 200)
}

// ── Fetch page HTML ─────────────────────────────────────────

async function fetchPage(url: string): Promise<{ html: string; status: number } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'KotoIQ/1.0 (internal-link-audit)' },
      redirect: 'follow',
    })
    if (!res.ok) return { html: '', status: res.status }
    const html = await res.text()
    return { html, status: res.status }
  } catch {
    return null
  }
}

// ── Batch processing helper ─────────────────────────────────

async function batchProcess<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
  }
  return results
}

// ── Check breadcrumb presence ───────────────────────────────

function hasBreadcrumbs(html: string): boolean {
  const lc = html.toLowerCase()
  return (
    lc.includes('aria-label="breadcrumb"') ||
    lc.includes('aria-label=\'breadcrumb\'') ||
    lc.includes('class="breadcrumb') ||
    lc.includes("class='breadcrumb") ||
    lc.includes('breadcrumb') && lc.includes('itemtype="https://schema.org/breadcrumblist"')
  )
}

// ── Calculate Gini coefficient for equity concentration ─────

function giniCoefficient(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const mean = sorted.reduce((s, v) => s + v, 0) / n
  if (mean === 0) return 0
  let sumDiff = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumDiff += Math.abs(sorted[i] - sorted[j])
    }
  }
  return sumDiff / (2 * n * n * mean)
}

// ═════════════════════════════════════════════════════════════
// EXPORTED ACTIONS
// ═════════════════════════════════════════════════════════════

export async function scanInternalLinks(s: SB, ai: AI, body: any) {
  const { client_id } = body
  if (!client_id) return { error: 'client_id required', status: 400 }

  // Get client website
  const { data: client } = await s.from('clients').select('website, name').eq('id', client_id).single()
  const rawWebsite = client?.website?.trim() || ''
  if (!rawWebsite) return { error: 'Client has no website configured', status: 400 }

  const domain = rawWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const baseUrl = rawWebsite.startsWith('http') ? rawWebsite : `https://${rawWebsite}`

  // 1) Get all URLs from sitemap
  const sitemapUrls = await fetchSitemapUrls(domain)

  // 2) Crawl each page and extract links (batch of 10)
  const allLinks: ExtractedLink[] = []
  const pageStatuses: Record<string, number> = {}
  const breadcrumbPages: Set<string> = new Set()
  const crawledPages: Set<string> = new Set()

  const pageResults = await batchProcess(sitemapUrls, 10, async (url) => {
    const result = await fetchPage(url)
    return { url, result }
  })

  for (const { url, result } of pageResults) {
    const normalUrl = url.replace(/\/+$/, '')
    crawledPages.add(normalUrl)
    if (!result) {
      pageStatuses[normalUrl] = 0 // connection failed
      continue
    }
    pageStatuses[normalUrl] = result.status
    if (!result.html) continue

    // Check breadcrumbs
    if (hasBreadcrumbs(result.html)) {
      breadcrumbPages.add(normalUrl)
    }

    // Extract internal links
    const links = extractLinksFromHTML(result.html, normalUrl, domain)
    allLinks.push(...links)
  }

  // 3) Delete old data and save new links
  await s.from('kotoiq_internal_links').delete().eq('client_id', client_id)

  // Insert in batches of 100
  const linkRows = allLinks.map(l => ({
    client_id,
    source_url: l.source_url,
    target_url: l.target_url,
    anchor_text: l.anchor_text,
    anchor_type: l.anchor_type,
    position: l.position,
    is_first_link: l.is_first_link,
    contextual_relevance: null,
    link_equity_estimate: null,
  }))

  for (let i = 0; i < linkRows.length; i += 100) {
    await s.from('kotoiq_internal_links').insert(linkRows.slice(i, i + 100))
  }

  // 4) Run audit analysis
  const totalPages = crawledPages.size
  const totalLinks = allLinks.length
  const avgLinksPerPage = totalPages > 0 ? Math.round(totalLinks / totalPages * 10) / 10 : 0

  // Inbound link counts per page
  const inboundCounts: Record<string, number> = {}
  for (const url of crawledPages) inboundCounts[url] = 0
  for (const l of allLinks) {
    const t = l.target_url
    inboundCounts[t] = (inboundCounts[t] || 0) + 1
  }

  // Outbound link counts per page
  const outboundCounts: Record<string, number> = {}
  for (const l of allLinks) {
    outboundCounts[l.source_url] = (outboundCounts[l.source_url] || 0) + 1
  }

  // Orphan pages: 0 inbound internal links (excluding homepage)
  const homepageNorm = baseUrl.replace(/\/+$/, '')
  const orphanPages = Object.entries(inboundCounts)
    .filter(([url, count]) => count === 0 && url !== homepageNorm && !url.endsWith(domain))
    .map(([url]) => url)
    .slice(0, 50)

  // Over-linked pages: >150 outbound links
  const overLinkedPages = Object.entries(outboundCounts)
    .filter(([, count]) => count > 150)
    .map(([url, count]) => ({ url, link_count: count }))
    .sort((a, b) => b.link_count - a.link_count)
    .slice(0, 20)

  // Duplicate anchor text issues: same anchor text → different URLs
  const anchorMap: Record<string, Set<string>> = {}
  for (const l of allLinks) {
    const key = l.anchor_text.toLowerCase().trim()
    if (!key || key.length < 2) continue
    if (!anchorMap[key]) anchorMap[key] = new Set()
    anchorMap[key].add(l.target_url)
  }
  const duplicateAnchorIssues = Object.entries(anchorMap)
    .filter(([, targets]) => targets.size > 1)
    .map(([anchor, targets]) => ({ anchor, targets: Array.from(targets), count: targets.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)

  // Broken links (non-200 status)
  const brokenLinks = Object.entries(pageStatuses)
    .filter(([, status]) => status !== 200 && status !== 0)
    .map(([url, status]) => ({ url, status_code: status }))
  // Also add targets that were linked to but returned errors
  const linkedTargets = new Set(allLinks.map(l => l.target_url))
  for (const target of linkedTargets) {
    if (!crawledPages.has(target) && !brokenLinks.some(b => b.url === target)) {
      // We didn't crawl this page — try a HEAD request
      // (skip to avoid massive extra requests; mark as unknown)
    }
  }

  // Equity concentration (Gini of inbound link distribution)
  const inboundValues = Object.values(inboundCounts)
  const equityConcentration = Math.round(giniCoefficient(inboundValues) * 100) / 100

  // Top equity pages (most inbound links)
  const topEquityPages = Object.entries(inboundCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([url, inbound]) => ({ url, inbound_links: inbound, outbound_links: outboundCounts[url] || 0 }))

  // Starved pages: pages with high SC impressions but <3 inbound links
  // Cross-reference with kotoiq_keywords
  let starvedPages: any[] = []
  try {
    const { data: kwData } = await s.from('kotoiq_keywords')
      .select('keyword, sc_impressions, sc_clicks, sc_avg_position, landing_page')
      .eq('client_id', client_id)
      .gt('sc_impressions', 50)
      .order('sc_impressions', { ascending: false })
      .limit(100)

    if (kwData) {
      const landingPages: Record<string, { impressions: number; clicks: number; keywords: string[] }> = {}
      for (const kw of kwData) {
        const lp = kw.landing_page?.replace(/\/+$/, '') || ''
        if (!lp) continue
        if (!landingPages[lp]) landingPages[lp] = { impressions: 0, clicks: 0, keywords: [] }
        landingPages[lp].impressions += kw.sc_impressions || 0
        landingPages[lp].clicks += kw.sc_clicks || 0
        landingPages[lp].keywords.push(kw.keyword)
      }

      starvedPages = Object.entries(landingPages)
        .filter(([url]) => (inboundCounts[url] || 0) < 3)
        .map(([url, data]) => ({
          url,
          inbound_links: inboundCounts[url] || 0,
          impressions: data.impressions,
          clicks: data.clicks,
          top_keywords: data.keywords.slice(0, 3),
        }))
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 20)
    }
  } catch { /* kotoiq_keywords may not have data */ }

  // Breadcrumb coverage
  const breadcrumbCoverage = totalPages > 0 ? Math.round(breadcrumbPages.size / totalPages * 100) : 0
  const breadcrumbIssues = Array.from(crawledPages)
    .filter(url => !breadcrumbPages.has(url) && url !== homepageNorm)
    .slice(0, 30)

  // Quality node suggestions: pages with highest organic clicks that should be linked from homepage
  let qualityNodeSuggestions: any[] = []
  try {
    const { data: topKws } = await s.from('kotoiq_keywords')
      .select('keyword, sc_clicks, sc_impressions, landing_page')
      .eq('client_id', client_id)
      .gt('sc_clicks', 0)
      .order('sc_clicks', { ascending: false })
      .limit(50)

    if (topKws) {
      // Aggregate by landing page
      const pageClicks: Record<string, { clicks: number; impressions: number; keywords: string[] }> = {}
      for (const kw of topKws) {
        const lp = kw.landing_page?.replace(/\/+$/, '') || ''
        if (!lp || lp === homepageNorm) continue
        if (!pageClicks[lp]) pageClicks[lp] = { clicks: 0, impressions: 0, keywords: [] }
        pageClicks[lp].clicks += kw.sc_clicks || 0
        pageClicks[lp].impressions += kw.sc_impressions || 0
        pageClicks[lp].keywords.push(kw.keyword)
      }

      // Find pages with high clicks but not linked from homepage
      const homepageLinks = allLinks
        .filter(l => l.source_url === homepageNorm || l.source_url === baseUrl.replace(/\/+$/, ''))
        .map(l => l.target_url)
      const homepageLinkSet = new Set(homepageLinks)

      qualityNodeSuggestions = Object.entries(pageClicks)
        .filter(([url]) => !homepageLinkSet.has(url))
        .map(([url, data]) => ({
          url,
          organic_clicks: data.clicks,
          organic_impressions: data.impressions,
          inbound_links: inboundCounts[url] || 0,
          top_keywords: data.keywords.slice(0, 3),
          suggested_action: 'Add link from homepage',
        }))
        .sort((a, b) => b.organic_clicks - a.organic_clicks)
        .slice(0, 10)
    }
  } catch { /* may not have keyword data */ }

  // Overall score (0-100)
  let score = 100

  // Orphan pages penalty: -2 per orphan, max -20
  score -= Math.min(orphanPages.length * 2, 20)

  // Broken links penalty: -3 per broken link, max -15
  score -= Math.min(brokenLinks.length * 3, 15)

  // Over-linked penalty: -3 per over-linked page, max -15
  score -= Math.min(overLinkedPages.length * 3, 15)

  // Duplicate anchor penalty: -1 per issue, max -10
  score -= Math.min(duplicateAnchorIssues.length, 10)

  // Equity concentration penalty (high Gini = bad)
  if (equityConcentration > 0.7) score -= 15
  else if (equityConcentration > 0.5) score -= 10
  else if (equityConcentration > 0.3) score -= 5

  // Breadcrumb penalty
  if (breadcrumbCoverage < 50) score -= 10
  else if (breadcrumbCoverage < 80) score -= 5

  // Starved pages penalty
  score -= Math.min(starvedPages.length * 2, 10)

  // Low avg links penalty
  if (avgLinksPerPage < 3) score -= 10
  else if (avgLinksPerPage < 5) score -= 5

  score = Math.max(0, Math.min(100, score))

  // 5) Save audit
  await s.from('kotoiq_link_audit').delete().eq('client_id', client_id)

  const auditRow = {
    client_id,
    total_pages: totalPages,
    total_internal_links: totalLinks,
    avg_links_per_page: avgLinksPerPage,
    orphan_pages: orphanPages,
    over_linked_pages: overLinkedPages,
    duplicate_anchor_issues: duplicateAnchorIssues,
    broken_links: brokenLinks,
    equity_concentration: equityConcentration,
    top_equity_pages: topEquityPages,
    starved_pages: starvedPages,
    breadcrumb_coverage: breadcrumbCoverage,
    breadcrumb_issues: breadcrumbIssues,
    quality_node_suggestions: qualityNodeSuggestions,
    overall_score: score,
  }

  await s.from('kotoiq_link_audit').insert(auditRow)

  // 6) Generate AI recommendations
  let recommendations: string[] = []
  try {
    const auditSummary = {
      client_name: client?.name,
      total_pages: totalPages,
      total_links: totalLinks,
      avg_links_per_page: avgLinksPerPage,
      orphan_count: orphanPages.length,
      broken_count: brokenLinks.length,
      overlinked_count: overLinkedPages.length,
      duplicate_anchor_count: duplicateAnchorIssues.length,
      equity_gini: equityConcentration,
      breadcrumb_coverage: breadcrumbCoverage,
      starved_count: starvedPages.length,
      quality_node_count: qualityNodeSuggestions.length,
      overall_score: score,
      orphan_samples: orphanPages.slice(0, 5),
      starved_samples: starvedPages.slice(0, 5),
      duplicate_samples: duplicateAnchorIssues.slice(0, 5),
    }

    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: 'You are KotoIQ Internal Link Analyst. Given audit data, provide specific, actionable recommendations to improve internal linking. Return ONLY a JSON array of strings, each a specific recommendation.',
      messages: [{
        role: 'user',
        content: `Analyze this internal link audit and provide 5-10 specific recommendations:\n\n${JSON.stringify(auditSummary, null, 2)}`
      }],
    })

    void logTokenUsage({
      feature: 'kotoiq_internal_links',
      model: 'claude-sonnet-4-20250514',
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
    recommendations = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
  } catch { /* AI recommendations are optional */ }

  return {
    audit: { ...auditRow, recommendations },
    link_count: linkRows.length,
    pages_crawled: totalPages,
  }
}

// ─────────────────────────────────────────────────────────────

export async function getInternalLinkAudit(s: SB, body: any) {
  const { client_id } = body
  if (!client_id) return { error: 'client_id required', status: 400 }

  const { data: audit } = await s.from('kotoiq_link_audit')
    .select('*')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const { data: links } = await s.from('kotoiq_internal_links')
    .select('*')
    .eq('client_id', client_id)
    .order('source_url')

  return { audit: audit || null, links: links || [] }
}

// ─────────────────────────────────────────────────────────────

export async function getLinkSuggestions(s: SB, ai: AI, body: any) {
  const { client_id, url } = body
  if (!client_id) return { error: 'client_id required', status: 400 }
  if (!url) return { error: 'url required', status: 400 }

  // Get all internal links for context
  const { data: links } = await s.from('kotoiq_internal_links')
    .select('source_url, target_url, anchor_text')
    .eq('client_id', client_id)

  // Get keyword data for the URL
  const { data: kwData } = await s.from('kotoiq_keywords')
    .select('keyword, sc_impressions, sc_clicks, sc_avg_position, landing_page')
    .eq('client_id', client_id)

  // Check for topical nodes
  let topicalNodes: any[] = []
  try {
    const { data: nodes } = await s.from('kotoiq_topical_nodes')
      .select('*')
      .eq('client_id', client_id)
    topicalNodes = nodes || []
  } catch { /* table may not exist yet */ }

  // Current links from/to this URL
  const linksFrom = (links || []).filter((l: any) => l.source_url === url)
  const linksTo = (links || []).filter((l: any) => l.target_url === url)

  // All other pages
  const allPages = new Set<string>()
  for (const l of (links || [])) {
    allPages.add(l.source_url)
    allPages.add(l.target_url)
  }

  // Keywords per page
  const pageKeywords: Record<string, string[]> = {}
  for (const kw of (kwData || [])) {
    const lp = kw.landing_page?.replace(/\/+$/, '') || ''
    if (!lp) continue
    if (!pageKeywords[lp]) pageKeywords[lp] = []
    pageKeywords[lp].push(kw.keyword)
  }

  const prompt = `Analyze internal linking opportunities for this URL: ${url}

CURRENT OUTBOUND LINKS FROM THIS PAGE (${linksFrom.length}):
${JSON.stringify(linksFrom.slice(0, 30).map((l: any) => ({ to: l.target_url, anchor: l.anchor_text })))}

CURRENT INBOUND LINKS TO THIS PAGE (${linksTo.length}):
${JSON.stringify(linksTo.slice(0, 30).map((l: any) => ({ from: l.source_url, anchor: l.anchor_text })))}

ALL SITE PAGES (${allPages.size}):
${JSON.stringify(Array.from(allPages).slice(0, 50))}

KEYWORD MAP (page → keywords):
${JSON.stringify(Object.entries(pageKeywords).slice(0, 30).map(([p, kws]) => ({ page: p, keywords: kws.slice(0, 3) })))}

${topicalNodes.length > 0 ? `TOPICAL MAP NODES:\n${JSON.stringify(topicalNodes.slice(0, 20))}` : ''}

Return ONLY valid JSON:
{
  "should_link_to": [{ "url": "...", "reason": "...", "suggested_anchor": "..." }],
  "should_receive_links_from": [{ "url": "...", "reason": "...", "suggested_anchor": "..." }],
  "anchor_improvements": [{ "current_anchor": "...", "target_url": "...", "suggested_anchor": "...", "reason": "..." }],
  "summary": "2-3 sentence summary"
}`

  try {
    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      system: 'You are KotoIQ Internal Link Strategist. Suggest specific internal linking improvements based on topical relevance and SEO value. Return ONLY valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    })

    void logTokenUsage({
      feature: 'kotoiq_internal_links',
      model: 'claude-sonnet-4-20250514',
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    const suggestions = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
    return { suggestions }
  } catch (e: any) {
    return { error: e.message, status: 500 }
  }
}
