// ─────────────────────────────────────────────────────────────
// Content Refresh Engine — KotoIQ Feature #3
// Builds a content inventory from sitemap, scores freshness,
// identifies declining pages, and generates refresh plans.
// ─────────────────────────────────────────────────────────────

import { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { getSitemapUrls, getLatestCrawl } from '@/lib/sitemapCrawler'

// ── Types ──────────────────────────────────────────────────────
interface InventoryRow {
  client_id: string
  url: string
  title: string
  word_count: number
  published_at: string | null
  last_modified: string | null
  sc_position: number | null
  sc_clicks: number | null
  sc_impressions: number | null
  sc_ctr: number | null
  position_30d_ago: number | null
  position_90d_ago: number | null
  clicks_30d_ago: number | null
  trajectory: string
  days_since_update: number | null
  freshness_status: string
  refresh_priority: string
  refresh_due_at: string | null
  thin_content: boolean
  unique_sentence_ratio: number | null
  has_images: boolean
  has_schema: boolean
  has_faq: boolean
  internal_links_in: number
  internal_links_out: number
  refresh_recommendations: any | null
  topical_node_id: string | null
}

// ── Helpers ────────────────────────────────────────────────────
const UA = 'Mozilla/5.0 (compatible; KotoBot/1.0)'

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(timeoutMs),
  })
}

function stripTags(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m?.[1]?.replace(/<[^>]+>/g, '').trim() || ''
}

function extractPublishedAt(html: string): string | null {
  // Try article:published_time meta
  const m1 = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i)
  if (m1) return m1[1]
  // Try <time> tag with datetime
  const m2 = html.match(/<time[^>]*datetime=["']([^"']+)["']/i)
  if (m2) return m2[1]
  // Try datePublished in JSON-LD
  const m3 = html.match(/"datePublished"\s*:\s*"([^"]+)"/i)
  if (m3) return m3[1]
  return null
}

function extractLastModified(html: string, headers: Headers): string | null {
  // HTTP header first
  const lm = headers.get('last-modified')
  if (lm) return new Date(lm).toISOString()
  // article:modified_time
  const m1 = html.match(/<meta[^>]*property=["']article:modified_time["'][^>]*content=["']([^"']+)/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']article:modified_time["']/i)
  if (m1) return m1[1]
  // dateModified in JSON-LD
  const m2 = html.match(/"dateModified"\s*:\s*"([^"]+)"/i)
  if (m2) return m2[1]
  return null
}

function countInternalLinks(html: string, domain: string): { inbound: number; outbound: number } {
  const anchors = [...html.matchAll(/<a[^>]*href=["']([^"'#]+)["'][^>]*/gi)]
  let outbound = 0
  for (const m of anchors) {
    const href = m[1]
    if (href.startsWith('/') || href.includes(domain)) outbound++
  }
  return { inbound: 0, outbound } // inbound computed cross-page below
}

function hasJsonLdSchema(html: string): boolean {
  return /<script[^>]*type=["']application\/ld\+json["']/i.test(html)
}

function hasFaqSection(html: string): boolean {
  return /FAQPage/i.test(html) || /<(h[1-6]|summary)[^>]*>[^<]*faq/i.test(html) || /<(h[1-6]|summary)[^>]*>[^<]*frequently asked/i.test(html)
}

function hasImages(html: string): boolean {
  return /<img\s/i.test(html)
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return Math.floor((Date.now() - d.getTime()) / 86400000)
  } catch { return null }
}

function computeFreshness(days: number | null): string {
  if (days === null) return 'stale' // unknown = stale
  if (days < 90) return 'fresh'
  if (days < 180) return 'aging'
  if (days < 365) return 'stale'
  return 'critical'
}

function computeTrajectory(current: number | null, pos30d: number | null, pos90d: number | null): string {
  if (current === null || current > 100) {
    // Was it ranking before?
    if ((pos30d !== null && pos30d < 50) || (pos90d !== null && pos90d < 50)) return 'dead'
    return 'new'
  }
  if (pos30d === null && pos90d === null) return 'new'
  const ref = pos30d ?? pos90d
  if (ref === null) return 'new'
  const diff = ref - current // positive = improved (lower position number is better)
  if (diff >= 3) return 'improving'
  if (diff <= -3) return 'declining'
  return 'stable'
}

function computeRefreshPriority(freshness: string, trajectory: string): string {
  if ((trajectory === 'declining' || trajectory === 'dead') && (freshness === 'stale' || freshness === 'critical')) return 'urgent'
  if (freshness === 'stale' || freshness === 'critical' || trajectory === 'declining' || trajectory === 'dead') return 'soon'
  if (freshness === 'aging') return 'scheduled'
  return 'ok'
}

function computeRefreshDueAt(freshness: string, publishedAt: string | null): string | null {
  const now = new Date()
  if (freshness === 'critical' || freshness === 'stale') return now.toISOString()
  if (freshness === 'aging') return new Date(now.getTime() + 30 * 86400000).toISOString()
  if (publishedAt) {
    try {
      return new Date(new Date(publishedAt).getTime() + 180 * 86400000).toISOString()
    } catch { /* fall through */ }
  }
  return new Date(now.getTime() + 180 * 86400000).toISOString()
}

// ── Fetch sitemap URLs ─────────────────────────────────────────
async function fetchSitemapUrls(website: string, limit = 200): Promise<string[]> {
  const base = website.startsWith('http') ? website : `https://${website}`
  const domain = new URL(base).origin
  const urls: string[] = []

  // Try common sitemap locations
  const sitemapUrls = [
    `${domain}/sitemap.xml`,
    `${domain}/sitemap_index.xml`,
    `${domain}/wp-sitemap.xml`,
    `${domain}/post-sitemap.xml`,
    `${domain}/page-sitemap.xml`,
  ]

  for (const smUrl of sitemapUrls) {
    if (urls.length >= limit) break
    try {
      const res = await fetchWithTimeout(smUrl, 8000)
      if (!res.ok) continue
      const xml = await res.text()
      // Extract <loc> tags
      const locs = [...xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)]
      for (const m of locs) {
        const loc = m[1].trim()
        // If this is a sitemap index, it points to other sitemaps — skip nested fetch for now
        if (loc.endsWith('.xml')) {
          try {
            const subRes = await fetchWithTimeout(loc, 8000)
            if (subRes.ok) {
              const subXml = await subRes.text()
              const subLocs = [...subXml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)]
              for (const sl of subLocs) {
                if (!sl[1].endsWith('.xml') && urls.length < limit) urls.push(sl[1].trim())
              }
            }
          } catch { /* skip sub-sitemap */ }
        } else {
          if (urls.length < limit) urls.push(loc)
        }
      }
    } catch { /* skip */ }
  }

  // Dedupe
  return [...new Set(urls)].slice(0, limit)
}

// ── Analyze single page ────────────────────────────────────────
async function analyzePage(url: string, domain: string): Promise<Partial<InventoryRow> | null> {
  try {
    const res = await fetchWithTimeout(url, 10000)
    if (!res.ok) return null
    const html = await res.text()
    const text = stripTags(html)
    const wordCount = text.split(/\s+/).filter(Boolean).length
    const title = extractTitle(html)
    const publishedAt = extractPublishedAt(html)
    const lastModified = extractLastModified(html, res.headers)
    const links = countInternalLinks(html, domain)

    const refDate = lastModified || publishedAt
    const dsu = daysSince(refDate)
    const freshness = computeFreshness(dsu)

    return {
      url,
      title,
      word_count: wordCount,
      published_at: publishedAt,
      last_modified: lastModified,
      has_images: hasImages(html),
      has_schema: hasJsonLdSchema(html),
      has_faq: hasFaqSection(html),
      internal_links_out: links.outbound,
      internal_links_in: 0,
      days_since_update: dsu,
      freshness_status: freshness,
      thin_content: wordCount < 300,
    }
  } catch {
    return null
  }
}

// ── Batch helper ───────────────────────────────────────────────
async function batchProcess<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
  }
  return results
}

// ═══════════════════════════════════════════════════════════════
// buildContentInventory — action: build_content_inventory
// ═══════════════════════════════════════════════════════════════
export async function buildContentInventory(s: SupabaseClient, ai: Anthropic, body: any) {
  const { client_id } = body
  if (!client_id) return { error: 'client_id required' }

  // url_limit body param — default 500, max 10,000
  const urlLimit = Math.min(Math.max(parseInt(body.url_limit) || 500, 1), 10000)

  // Get client website
  const { data: client } = await s.from('clients').select('website, name').eq('id', client_id).single()
  if (!client?.website) return { error: 'Client has no website configured' }

  const website = client.website.trim()
  const domain = (() => {
    try { return new URL(website.startsWith('http') ? website : `https://${website}`).hostname } catch { return website }
  })()

  // Try cached sitemap URLs from kotoiq_sitemap_urls first
  let sitemapUrls: string[] = []
  try {
    const latestCrawl = await getLatestCrawl(s as any, client_id).catch(() => null)
    if (latestCrawl?.status === 'complete' && (latestCrawl.urls_saved || 0) > 0) {
      const result = await getSitemapUrls(s as any, {
        client_id,
        limit: urlLimit,
        orderBy: 'lastmod', // freshness matters for content refresh
      })
      sitemapUrls = (result.urls || []).map((u: any) => u.url).filter(Boolean)
    }
  } catch { /* fall through to XML fetch */ }

  // Fallback: fetch sitemap XML directly (legacy path)
  if (sitemapUrls.length === 0) {
    sitemapUrls = await fetchSitemapUrls(website, urlLimit)
  }

  if (!sitemapUrls.length) return { error: 'No URLs found in sitemap. Ensure the site has a sitemap.xml or run the sitemap crawler first.' }

  // Get existing keyword data for SC positions/clicks matching
  const { data: keywords } = await s.from('kotoiq_keywords').select('keyword, sc_avg_position, sc_clicks, sc_impressions, sc_ctr, sc_top_page')
    .eq('client_id', client_id)

  // Build URL → SC data map from keywords that have a top page
  const scMap = new Map<string, { position: number; clicks: number; impressions: number; ctr: number }>()
  for (const kw of keywords || []) {
    if (kw.sc_top_page) {
      const existing = scMap.get(kw.sc_top_page)
      // Keep the best-ranking keyword's data for each URL
      if (!existing || (kw.sc_avg_position && kw.sc_avg_position < existing.position)) {
        scMap.set(kw.sc_top_page, {
          position: kw.sc_avg_position || 999,
          clicks: (existing?.clicks || 0) + (kw.sc_clicks || 0),
          impressions: (existing?.impressions || 0) + (kw.sc_impressions || 0),
          ctr: kw.sc_ctr || 0,
        })
      }
    }
  }

  // Get historical snapshots for trajectory
  const now = new Date()
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString()
  const d90 = new Date(now.getTime() - 90 * 86400000).toISOString()

  const { data: snapshots30 } = await s.from('kotoiq_snapshots')
    .select('keyword, position, clicks')
    .eq('client_id', client_id)
    .gte('snapshot_date', d30)
    .order('snapshot_date', { ascending: true })
    .limit(500)

  const { data: snapshots90 } = await s.from('kotoiq_snapshots')
    .select('keyword, position, clicks')
    .eq('client_id', client_id)
    .gte('snapshot_date', d90)
    .lte('snapshot_date', d30)
    .order('snapshot_date', { ascending: true })
    .limit(500)

  // Build keyword → historical position maps
  const kwPos30 = new Map<string, number>()
  for (const snap of snapshots30 || []) {
    if (snap.keyword && snap.position != null && !kwPos30.has(snap.keyword)) {
      kwPos30.set(snap.keyword, snap.position)
    }
  }
  const kwPos90 = new Map<string, number>()
  for (const snap of snapshots90 || []) {
    if (snap.keyword && snap.position != null && !kwPos90.has(snap.keyword)) {
      kwPos90.set(snap.keyword, snap.position)
    }
  }

  // Build URL → historical position from keyword data
  const urlPos30 = new Map<string, number>()
  const urlClicks30 = new Map<string, number>()
  const urlPos90 = new Map<string, number>()
  for (const kw of keywords || []) {
    if (kw.sc_top_page) {
      const p30 = kwPos30.get(kw.keyword)
      if (p30 != null) {
        const existing = urlPos30.get(kw.sc_top_page)
        if (!existing || p30 < existing) urlPos30.set(kw.sc_top_page, p30)
      }
      const p90 = kwPos90.get(kw.keyword)
      if (p90 != null) {
        const existing = urlPos90.get(kw.sc_top_page)
        if (!existing || p90 < existing) urlPos90.set(kw.sc_top_page, p90)
      }
    }
  }

  // Create processing job
  let jobId: string | null = null
  try {
    const { data: job } = await s.from('kotoiq_processing_jobs').insert({
      client_id,
      engine: 'content_refresh',
      status: 'running',
      total_urls: sitemapUrls.length,
      processed_urls: 0,
      started_at: new Date().toISOString(),
    }).select().single()
    jobId = job?.id || null
  } catch { /* processing_jobs is nice-to-have */ }

  // Analyze pages in concurrent chunks of 10 with progress updates
  const pageResults: (Partial<InventoryRow> | null)[] = []
  const CHUNK = 10
  for (let i = 0; i < sitemapUrls.length; i += CHUNK) {
    const batch = sitemapUrls.slice(i, i + CHUNK)
    const batchResults = await Promise.all(batch.map((url) => analyzePage(url, domain)))
    pageResults.push(...batchResults)
    if (jobId) {
      try {
        await s.from('kotoiq_processing_jobs').update({
          processed_urls: pageResults.length,
          updated_at: new Date().toISOString(),
        }).eq('id', jobId)
      } catch { /* non-critical */ }
    }
  }

  // Compute internal_links_in (count how many pages link to each URL)
  const internalLinkCount = new Map<string, number>()
  // This is a rough approximation — full link graph requires parsing all anchors

  // Build inventory rows
  const rows: InventoryRow[] = []
  for (let i = 0; i < sitemapUrls.length; i++) {
    const url = sitemapUrls[i]
    const page = pageResults[i]
    if (!page) continue

    const sc = scMap.get(url)
    const pos30 = urlPos30.get(url) ?? null
    const pos90 = urlPos90.get(url) ?? null
    const clicks30 = urlClicks30.get(url) ?? null
    const currentPos = sc?.position ?? null

    const trajectory = computeTrajectory(currentPos, pos30, pos90)
    const freshness = page.freshness_status || 'stale'
    const priority = computeRefreshPriority(freshness, trajectory)

    rows.push({
      client_id,
      url,
      title: page.title || '',
      word_count: page.word_count || 0,
      published_at: page.published_at || null,
      last_modified: page.last_modified || null,
      sc_position: currentPos === 999 ? null : currentPos,
      sc_clicks: sc?.clicks ?? null,
      sc_impressions: sc?.impressions ?? null,
      sc_ctr: sc?.ctr ?? null,
      position_30d_ago: pos30,
      position_90d_ago: pos90,
      clicks_30d_ago: clicks30,
      trajectory,
      days_since_update: page.days_since_update ?? null,
      freshness_status: freshness,
      refresh_priority: priority,
      refresh_due_at: computeRefreshDueAt(freshness, page.published_at || null),
      thin_content: page.thin_content || false,
      unique_sentence_ratio: null,
      has_images: page.has_images || false,
      has_schema: page.has_schema || false,
      has_faq: page.has_faq || false,
      internal_links_in: internalLinkCount.get(url) || 0,
      internal_links_out: page.internal_links_out || 0,
      refresh_recommendations: null,
      topical_node_id: null,
    })
  }

  // Sort by priority for AI recommendations
  const priorityOrder = { urgent: 0, soon: 1, scheduled: 2, ok: 3 }
  rows.sort((a, b) => (priorityOrder[a.refresh_priority as keyof typeof priorityOrder] ?? 3) - (priorityOrder[b.refresh_priority as keyof typeof priorityOrder] ?? 3))

  // Generate AI recommendations for top 20 priority pages
  const topPages = rows.slice(0, 20).filter(r => r.refresh_priority !== 'ok')
  if (topPages.length > 0) {
    const pagesSummary = topPages.map(p => ({
      url: p.url,
      title: p.title,
      words: p.word_count,
      days_old: p.days_since_update,
      position: p.sc_position,
      trajectory: p.trajectory,
      freshness: p.freshness_status,
      thin: p.thin_content,
      has_images: p.has_images,
      has_schema: p.has_schema,
      has_faq: p.has_faq,
    }))

    try {
      const msg = await ai.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: `You are an SEO content strategist. For each page, provide specific refresh recommendations.
Return ONLY valid JSON: an array of objects, each with "url" and "recommendations" (object with keys: "add" (array of things to add), "update" (array of things to update), "restructure" (array of structural changes), "estimated_hours" (number), "priority_reason" (string)).`,
        messages: [{ role: 'user', content: `Analyze these pages for ${client.name || domain} and recommend refresh actions:\n${JSON.stringify(pagesSummary, null, 2)}` }],
      })

      void logTokenUsage({
        feature: 'kotoiq_content_refresh',
        model: 'claude-sonnet-4-20250514',
        inputTokens: msg.usage?.input_tokens || 0,
        outputTokens: msg.usage?.output_tokens || 0,
      })

      const raw = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
      const recs = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())

      // Attach recommendations to rows
      if (Array.isArray(recs)) {
        const recMap = new Map(recs.map((r: any) => [r.url, r.recommendations]))
        for (const row of rows) {
          if (recMap.has(row.url)) {
            row.refresh_recommendations = recMap.get(row.url)
          }
        }
      }
    } catch { /* AI recommendations are nice-to-have, don't block */ }
  }

  // Delete old inventory and insert new
  await s.from('kotoiq_content_inventory').delete().eq('client_id', client_id)

  // Insert in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    await s.from('kotoiq_content_inventory').insert(rows.slice(i, i + 50))
  }

  // Mark processing job complete
  if (jobId) {
    try {
      await s.from('kotoiq_processing_jobs').update({
        status: 'complete',
        processed_urls: sitemapUrls.length,
        completed_at: new Date().toISOString(),
      }).eq('id', jobId)
    } catch { /* non-critical */ }
  }

  return {
    success: true,
    job_id: jobId,
    urls_processed: sitemapUrls.length,
    total_pages: rows.length,
    fresh: rows.filter(r => r.freshness_status === 'fresh').length,
    aging: rows.filter(r => r.freshness_status === 'aging').length,
    stale: rows.filter(r => r.freshness_status === 'stale').length,
    critical: rows.filter(r => r.freshness_status === 'critical').length,
    urgent: rows.filter(r => r.refresh_priority === 'urgent').length,
    thin_content: rows.filter(r => r.thin_content).length,
  }
}

// ═══════════════════════════════════════════════════════════════
// getContentInventory — action: get_content_inventory
// ═══════════════════════════════════════════════════════════════
export async function getContentInventory(s: SupabaseClient, body: any) {
  const { client_id, freshness_status, trajectory, refresh_priority } = body
  if (!client_id) return { error: 'client_id required' }

  let query = s.from('kotoiq_content_inventory').select('*').eq('client_id', client_id)
  if (freshness_status) query = query.eq('freshness_status', freshness_status)
  if (trajectory) query = query.eq('trajectory', trajectory)
  if (refresh_priority) query = query.eq('refresh_priority', refresh_priority)

  const { data, error } = await query.order('refresh_priority', { ascending: true }).order('days_since_update', { ascending: false })
  if (error) return { error: error.message }

  // Compute summary stats
  const items = data || []
  return {
    inventory: items,
    summary: {
      total: items.length,
      fresh: items.filter((r: any) => r.freshness_status === 'fresh').length,
      aging: items.filter((r: any) => r.freshness_status === 'aging').length,
      stale: items.filter((r: any) => r.freshness_status === 'stale').length,
      critical: items.filter((r: any) => r.freshness_status === 'critical').length,
      urgent: items.filter((r: any) => r.refresh_priority === 'urgent').length,
      declining: items.filter((r: any) => r.trajectory === 'declining').length,
      thin: items.filter((r: any) => r.thin_content).length,
    },
  }
}

// ═══════════════════════════════════════════════════════════════
// getRefreshPlan — action: get_refresh_plan
// ═══════════════════════════════════════════════════════════════
export async function getRefreshPlan(s: SupabaseClient, ai: Anthropic, body: any) {
  const { client_id, urls, top_n = 10 } = body
  if (!client_id) return { error: 'client_id required' }

  let query = s.from('kotoiq_content_inventory').select('*').eq('client_id', client_id)

  if (urls && Array.isArray(urls) && urls.length > 0) {
    query = query.in('url', urls)
  } else {
    query = query.in('refresh_priority', ['urgent', 'soon']).order('refresh_priority').limit(top_n)
  }

  const { data: pages } = await query
  if (!pages?.length) return { error: 'No pages found needing refresh' }

  const { data: client } = await s.from('clients').select('name, website, primary_service').eq('id', client_id).single()

  const pageSummaries = pages.map((p: any) => ({
    url: p.url,
    title: p.title,
    word_count: p.word_count,
    days_since_update: p.days_since_update,
    sc_position: p.sc_position,
    sc_clicks: p.sc_clicks,
    trajectory: p.trajectory,
    freshness: p.freshness_status,
    priority: p.refresh_priority,
    thin_content: p.thin_content,
    has_images: p.has_images,
    has_schema: p.has_schema,
    has_faq: p.has_faq,
    internal_links_in: p.internal_links_in,
    internal_links_out: p.internal_links_out,
    existing_recommendations: p.refresh_recommendations,
  }))

  try {
    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      system: `You are an expert SEO content strategist creating detailed refresh plans.
For each page, provide a comprehensive plan. Return ONLY valid JSON: an array of objects with:
- "url": the page URL
- "title": current title
- "priority": urgent/soon/scheduled
- "sections_to_update": array of {section, action, details}
- "content_to_add": array of strings (new sections/topics to add)
- "content_to_remove": array of strings (outdated/irrelevant content)
- "seo_improvements": array of strings (title tag, meta desc, schema, etc.)
- "estimated_hours": number (realistic estimate)
- "expected_impact": string (what ranking/traffic improvement to expect)`,
      messages: [{
        role: 'user',
        content: `Create refresh plans for ${client?.name || 'this business'} (${client?.primary_service || 'services'}).\n\nPages:\n${JSON.stringify(pageSummaries, null, 2)}`,
      }],
    })

    void logTokenUsage({
      feature: 'kotoiq_content_refresh',
      model: 'claude-sonnet-4-20250514',
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
    const plans = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())

    return { plans: Array.isArray(plans) ? plans : [] }
  } catch (e: any) {
    return { error: e.message }
  }
}
