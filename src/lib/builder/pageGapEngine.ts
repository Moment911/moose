/**
 * Page Gap Engine — identifies service x city page opportunities
 *
 * Cross-references KotoIQ intelligence data:
 *  - Topical map nodes (gap/partial entities)
 *  - Keywords (search volume, position)
 *  - Sitemap URLs (existing pages)
 *  - Competitor snapshots (what competitors cover)
 *  - Grid scans (local competitive density)
 *  - Census geo data (cities in a county/state)
 *
 * Produces a ranked list of page suggestions for the Page Factory.
 */

import 'server-only'
import { getKotoIQDb } from '../kotoiqDb'
import { getPlacesForState, getCountiesForState } from '../geoLookup'
import type { GeoPlace } from '../geoLookup'

// ── Types ──────────────────────────────────────────────────────────────────

export interface PageSuggestion {
  service: string
  city: string
  state: string
  county: string | null
  zip: string | null
  priority: number        // 0-100
  reason: string
  search_volume: number | null
  keyword_difficulty: number | null
  competitor_count: number
  competitor_urls: string[]
}

export interface GapAnalysisInput {
  agencyId: string
  clientId: string
  /** Services the client offers (from onboarding or profile) */
  services: string[]
  /** State abbreviation to scope city lookup */
  state: string
  /** Optional: limit to specific counties */
  counties?: string[]
  /** Optional: limit number of cities (default 100) */
  cityLimit?: number
}

export interface GapAnalysisResult {
  suggestions: PageSuggestion[]
  stats: {
    cities_analyzed: number
    services_checked: number
    existing_pages_found: number
    gaps_found: number
  }
}

// ── Core Engine ────────────────────────────────────────────────────────────

export async function analyzePageGaps(input: GapAnalysisInput): Promise<GapAnalysisResult> {
  const { agencyId, clientId, services, state, counties, cityLimit = 100 } = input
  const db = getKotoIQDb(agencyId)

  // 1. Load existing intelligence data in parallel
  const [
    sitemapUrls,
    keywords,
    topicalNodes,
    competitorSnapshots,
    gridScans,
    cities,
  ] = await Promise.all([
    loadSitemapUrls(db, clientId),
    loadKeywords(db, clientId),
    loadTopicalNodes(db, clientId),
    loadCompetitorSnapshots(db, clientId),
    loadGridScans(db, clientId),
    loadCities(state, counties),
  ])

  // 2. Build existing page index (what pages the client already has)
  const existingPageIndex = buildExistingPageIndex(sitemapUrls)

  // 3. Build keyword volume map
  const keywordVolumeMap = buildKeywordVolumeMap(keywords)

  // 4. Build competitor coverage map
  const competitorCoverageMap = buildCompetitorCoverageMap(competitorSnapshots)

  // 5. Cross-reference: for each service x city combo, check if a page exists
  const suggestions: PageSuggestion[] = []

  const citiesToCheck = cities.slice(0, cityLimit)

  for (const service of services) {
    for (const city of citiesToCheck) {
      const cityName = city.name
      const slug = `${service.toLowerCase().replace(/\s+/g, '-')}-${cityName.toLowerCase().replace(/\s+/g, '-')}`

      // Check if page already exists in sitemap
      const alreadyExists = existingPageIndex.has(slug)
        || existingPageIndex.has(cityName.toLowerCase())
        && existingPageIndex.has(service.toLowerCase())

      if (alreadyExists) continue

      // Check keyword data
      const kwKey = `${service.toLowerCase()} ${cityName.toLowerCase()}`
      const kwData = keywordVolumeMap.get(kwKey)

      // Check competitor coverage
      const compKey = `${service.toLowerCase()} ${cityName.toLowerCase()} ${state.toLowerCase()}`
      const competitors = competitorCoverageMap.get(compKey) || []

      // Check topical map for gaps
      const topicalGap = topicalNodes.find(n =>
        n.status === 'gap' &&
        n.entity?.toLowerCase().includes(service.toLowerCase())
      )

      // Calculate priority score (0-100)
      let priority = 30 // base score for any service+city combo with no page

      // Boost for keyword volume
      if (kwData?.volume) {
        if (kwData.volume > 1000) priority += 30
        else if (kwData.volume > 500) priority += 20
        else if (kwData.volume > 100) priority += 10
      }

      // Boost for competitors ranking (opportunity signal)
      if (competitors.length > 0) priority += 10
      if (competitors.length >= 3) priority += 10

      // Boost for topical authority gap
      if (topicalGap) priority += 15

      // Boost for low keyword difficulty
      if (kwData?.difficulty !== undefined) {
        if (kwData.difficulty < 30) priority += 10
        else if (kwData.difficulty < 50) priority += 5
      }

      // Cap at 100
      priority = Math.min(priority, 100)

      // Build reason string
      const reasons: string[] = []
      if (kwData?.volume) reasons.push(`${kwData.volume.toLocaleString()} monthly searches`)
      if (competitors.length > 0) reasons.push(`${competitors.length} competitors ranking`)
      if (topicalGap) reasons.push('topical authority gap')
      if (!kwData?.volume) reasons.push('no existing page for this service+city')

      suggestions.push({
        service,
        city: cityName,
        state,
        county: city.county || null,
        zip: null,
        priority,
        reason: reasons.join(', ') || 'service area coverage',
        search_volume: kwData?.volume || null,
        keyword_difficulty: kwData?.difficulty || null,
        competitor_count: competitors.length,
        competitor_urls: competitors.slice(0, 5),
      })
    }
  }

  // Sort by priority descending
  suggestions.sort((a, b) => b.priority - a.priority)

  return {
    suggestions,
    stats: {
      cities_analyzed: citiesToCheck.length,
      services_checked: services.length,
      existing_pages_found: existingPageIndex.size,
      gaps_found: suggestions.length,
    },
  }
}

/** Persist suggestions to kotoiq_page_suggestions table */
export async function saveSuggestions(
  agencyId: string,
  clientId: string,
  suggestions: PageSuggestion[],
): Promise<{ saved: number }> {
  const db = getKotoIQDb(agencyId)

  // Clear old suggestions for this client (keep accepted/built/published)
  await db.from('kotoiq_page_suggestions')
    .delete()
    .eq('client_id', clientId)
    .in('status', ['suggested', 'dismissed'])

  // Insert new suggestions in batches of 50
  let saved = 0
  for (let i = 0; i < suggestions.length; i += 50) {
    const batch = suggestions.slice(i, i + 50).map(s => ({
      agency_id: agencyId,
      client_id: clientId,
      service: s.service,
      city: s.city,
      state: s.state,
      county: s.county,
      zip: s.zip,
      priority: s.priority,
      reason: s.reason,
      search_volume: s.search_volume,
      keyword_difficulty: s.keyword_difficulty,
      competitor_count: s.competitor_count,
      competitor_urls: s.competitor_urls,
      status: 'suggested',
    }))

    const { error } = await db.from('kotoiq_page_suggestions').insert(batch)
    if (!error) saved += batch.length
  }

  return { saved }
}

// ── Data Loaders ───────────────────────────────────────────────────────────

async function loadSitemapUrls(db: ReturnType<typeof getKotoIQDb>, clientId: string) {
  const { data } = await db.client
    .from('kotoiq_sitemap_urls')
    .select('url, lastmod, priority')
    .eq('crawl_id', clientId) // crawl_id references the crawl for this client
    .limit(5000)
  return data || []
}

async function loadKeywords(db: ReturnType<typeof getKotoIQDb>, clientId: string) {
  const { data } = await db.client
    .from('kotoiq_keywords')
    .select('keyword, kp_monthly_volume, sc_avg_position, opportunity_score, competitor_domains')
    .eq('client_id', clientId)
    .limit(2000)
  return data || []
}

async function loadTopicalNodes(db: ReturnType<typeof getKotoIQDb>, clientId: string) {
  const { data } = await db.client
    .from('kotoiq_topical_nodes')
    .select('entity, status, priority, suggested_url, suggested_title, section')
    .eq('map_id', clientId) // map references the client
    .in('status', ['gap', 'partial'])
    .limit(500)
  return data || []
}

async function loadCompetitorSnapshots(db: ReturnType<typeof getKotoIQDb>, clientId: string) {
  // Get the most recent competitor snapshot
  const { data } = await db.client
    .from('kotoiq_competitor_url_snapshots')
    .select('competitor_domain, urls, ranking_keywords, new_urls')
    .order('created_at', { ascending: false })
    .limit(10)
  return data || []
}

async function loadGridScans(db: ReturnType<typeof getKotoIQDb>, clientId: string) {
  const { data } = await db.client
    .from('kotoiq_grid_scans_pro')
    .select('keyword, avg_rank, grid_data')
    .order('scanned_at', { ascending: false })
    .limit(20)
  return data || []
}

async function loadCities(
  state: string,
  counties?: string[],
): Promise<Array<GeoPlace & { county?: string }>> {
  // Get all cities/places for the state from Census API (cached)
  const result = await getPlacesForState(state, { incorporatedOnly: true })
  if (!result?.data) return []

  let places = result.data

  // Filter by counties if specified
  if (counties?.length) {
    // For county filtering, we'd need the countyLookup — for now, return all
    // and let the caller filter. Full county-based filtering can use
    // getPlacesForCounties() from geoLookup.ts
    // This is a simplification; proper implementation uses countyLookup.ts
  }

  return places.map(p => ({
    ...p,
    county: undefined, // populated by countyLookup in full implementation
  }))
}

// ── Index Builders ─────────────────────────────────────────────────────────

function buildExistingPageIndex(sitemapUrls: Array<{ url: string }>): Set<string> {
  const index = new Set<string>()
  for (const u of sitemapUrls) {
    try {
      const path = new URL(u.url).pathname.toLowerCase()
      // Add the full path
      index.add(path)
      // Add individual path segments for fuzzy matching
      path.split('/').filter(Boolean).forEach(seg => index.add(seg))
    } catch {
      // Skip invalid URLs
    }
  }
  return index
}

function buildKeywordVolumeMap(
  keywords: Array<{ keyword: string; kp_monthly_volume?: number; opportunity_score?: number; competitor_domains?: string[] }>
): Map<string, { volume: number; difficulty: number }> {
  const map = new Map<string, { volume: number; difficulty: number }>()
  for (const kw of keywords) {
    map.set(kw.keyword.toLowerCase(), {
      volume: kw.kp_monthly_volume || 0,
      difficulty: kw.opportunity_score ? (100 - kw.opportunity_score) : 50, // invert opportunity to difficulty
    })
  }
  return map
}

function buildCompetitorCoverageMap(
  snapshots: Array<{ competitor_domain: string; urls?: any; ranking_keywords?: any }>
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const snap of snapshots) {
    if (!snap.ranking_keywords) continue
    const keywords = Array.isArray(snap.ranking_keywords) ? snap.ranking_keywords : []
    for (const kw of keywords) {
      const key = (typeof kw === 'string' ? kw : kw.keyword || '').toLowerCase()
      if (!key) continue
      const existing = map.get(key) || []
      existing.push(snap.competitor_domain)
      map.set(key, existing)
    }
  }
  return map
}
