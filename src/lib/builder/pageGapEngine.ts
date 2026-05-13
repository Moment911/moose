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
import { getKeywordCPCs } from '../dataforseo'
import { readFileSync } from 'fs'
import { join } from 'path'

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
  /**
   * If true, enrich the top-N suggestions with real per-city Google Ads
   * search volume + CPC from DataForSEO. Replaces the national volume
   * from kotoiq_keywords with city-specific data so priority scoring
   * reflects local demand. Defaults to true; pass false to skip the
   * extra API calls during dev / tests.
   */
  enrichWithLocalVolume?: boolean
  /** How many top suggestions to enrich (default 30). */
  enrichTopN?: number
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
  const { agencyId, clientId, services, state, counties, cityLimit = 100, enrichWithLocalVolume = true, enrichTopN = 30 } = input
  const db = getKotoIQDb(agencyId)

  // 1. Load existing intelligence data in parallel
  const [
    sitemapUrls,
    keywords,
    topicalNodes,
    competitorSnapshots,
    gridScans,
    cities,
    semanticAnalysis,
    strategicPlan,
    contentInventory,
  ] = await Promise.all([
    loadSitemapUrls(db, clientId),
    loadKeywords(db, clientId),
    loadTopicalNodes(db, clientId),
    loadCompetitorSnapshots(db, clientId),
    loadGridScans(db, clientId),
    loadCities(state, counties),
    loadSemanticAnalysis(db, clientId),
    loadStrategicPlan(db, clientId),
    loadContentInventory(db, clientId),
  ])

  // 2. Build existing page index (what pages the client already has)
  const existingPageIndex = buildExistingPageIndex(sitemapUrls)

  // 3. Build keyword volume map
  const keywordVolumeMap = buildKeywordVolumeMap(keywords)

  // 4. Build competitor coverage map
  const competitorCoverageMap = buildCompetitorCoverageMap(competitorSnapshots)

  // 4b. Build strategic priority sets (attack/defend/abandon from strategy engine)
  const attackTopics = new Set<string>()
  const abandonTopics = new Set<string>()
  if (strategicPlan) {
    for (const p of (strategicPlan.attack_priorities || [])) {
      if (p.cluster || p.topic) attackTopics.add((p.cluster || p.topic).toLowerCase())
    }
    for (const a of (strategicPlan.abandon_list || [])) {
      if (a.cluster || a.topic) abandonTopics.add((a.cluster || a.topic).toLowerCase())
    }
  }

  // 4c. Build content inventory index (pages already ranking well)
  const rankingPages = new Set<string>()
  for (const page of contentInventory) {
    if (page.url && page.sc_position && page.sc_position <= 20) {
      const path = page.url.toLowerCase().replace(/https?:\/\/[^/]+/, '')
      rankingPages.add(path)
    }
  }

  // 4d. Semantic thin/orphan pages
  const thinPages = new Set<string>()
  const orphanContexts = new Set<string>()
  if (semanticAnalysis) {
    for (const p of (semanticAnalysis.thin_content_pages || [])) {
      if (p.url) thinPages.add(p.url.toLowerCase())
    }
    for (const o of (semanticAnalysis.orphan_contexts || [])) {
      if (o.topic || o.context) orphanContexts.add((o.topic || o.context).toLowerCase())
    }
  }

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

      // Boost/penalize from strategic plan
      const serviceLower = service.toLowerCase()
      if (attackTopics.size > 0) {
        const isAttack = [...attackTopics].some(t => serviceLower.includes(t) || t.includes(serviceLower))
        if (isAttack) priority += 15
      }
      if (abandonTopics.size > 0) {
        const isAbandon = [...abandonTopics].some(t => serviceLower.includes(t) || t.includes(serviceLower))
        if (isAbandon) priority -= 30
      }

      // Boost if semantic analysis found orphan context matching this service
      if (orphanContexts.size > 0) {
        const isOrphan = [...orphanContexts].some(t => serviceLower.includes(t) || t.includes(serviceLower))
        if (isOrphan) priority += 10
      }

      // Cap at 0-100
      priority = Math.max(0, Math.min(priority, 100))

      // Skip abandoned topics
      if (priority <= 0) continue

      // Build reason string
      const reasons: string[] = []
      if (kwData?.volume) reasons.push(`${kwData.volume.toLocaleString()} monthly searches`)
      if (competitors.length > 0) reasons.push(`${competitors.length} competitors ranking`)
      if (topicalGap) reasons.push('topical authority gap')
      if ([...attackTopics].some(t => serviceLower.includes(t) || t.includes(serviceLower))) reasons.push('strategic attack priority')
      if ([...orphanContexts].some(t => serviceLower.includes(t) || t.includes(serviceLower))) reasons.push('orphan topic needs coverage')
      if (!kwData?.volume && reasons.length === 0) reasons.push('no existing page for this service+city')

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

  // ── Local volume enrichment (DataForSEO per-city CPC + volume) ────────
  // The initial scoring uses national keyword volume from kotoiq_keywords.
  // For the top-N gaps, query DataForSEO with the city's location_name so
  // we get the REAL local demand signal — a "plumber Phoenix" national
  // volume of 5k often masks a per-city volume of 200, and vice versa.
  let enrichedCount = 0
  if (enrichWithLocalVolume && suggestions.length > 0) {
    const top = suggestions.slice(0, enrichTopN)
    // Group by city so we can batch the DataForSEO calls (one call per city
    // with all its candidate keywords, up to 100 per call).
    const byCity = new Map<string, PageSuggestion[]>()
    for (const s of top) {
      const cityKey = `${s.city}|${s.state}`
      if (!byCity.has(cityKey)) byCity.set(cityKey, [])
      byCity.get(cityKey)!.push(s)
    }

    await Promise.allSettled(
      Array.from(byCity.entries()).map(async ([cityKey, batch]) => {
        const [cityName, st] = cityKey.split('|')
        const keywords = batch.map(s => `${s.service} ${cityName}`)
        const locationName = `${cityName},${st},United States`
        try {
          const rows = await getKeywordCPCs(keywords, locationName)
          // Map back by lowercase keyword for matching
          const byKw = new Map<string, { cpc: number; volume: number }>()
          for (const r of rows) {
            byKw.set(r.keyword.toLowerCase(), { cpc: r.cpc, volume: r.search_volume })
          }
          for (const s of batch) {
            const key = `${s.service} ${cityName}`.toLowerCase()
            const live = byKw.get(key)
            if (live && live.volume >= 0) {
              s.search_volume = live.volume
              // Re-score priority with local volume:
              //   base 30 (preserved logic) + volume boost + comp + topical + strategy ...
              //   simpler: rescale the volume contribution
              const oldVolBoost =
                (s.search_volume == null ? 0 :
                  (s.search_volume > 1000 ? 30 :
                  (s.search_volume > 500 ? 20 :
                  (s.search_volume > 100 ? 10 : 0))))
              // Apply a single re-priority pass using local volume signal —
              // keep priority bounded [0, 100].
              let newPriority = s.priority
              if (live.volume === 0) {
                newPriority = Math.max(0, newPriority - 15) // nobody actually searches there
              } else if (live.volume > 500) {
                newPriority = Math.min(100, newPriority + 8) // confirmed local demand
              }
              s.priority = newPriority
              // Surface the source in reason so it's visible in the UI
              if (live.volume > 0 && !s.reason.includes('local')) {
                s.reason = `${live.volume.toLocaleString()} local searches/mo · ${s.reason}`
              }
              enrichedCount++
            }
          }
        } catch {
          // Swallow — DataForSEO failures shouldn't break gap analysis.
          // Suggestions retain their national-volume scores.
        }
      })
    )

    // Re-sort after enrichment
    suggestions.sort((a, b) => b.priority - a.priority)
  }

  return {
    suggestions,
    stats: {
      cities_analyzed: citiesToCheck.length,
      services_checked: services.length,
      existing_pages_found: existingPageIndex.size,
      gaps_found: suggestions.length,
      ...(enrichWithLocalVolume ? { local_volume_enriched: enrichedCount } : {}),
    } as any,
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

async function loadSemanticAnalysis(db: ReturnType<typeof getKotoIQDb>, clientId: string) {
  const { data } = await db.client
    .from('kotoiq_semantic_analysis')
    .select('thin_content_pages, orphan_contexts, overall_score')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data || null
}

async function loadStrategicPlan(db: ReturnType<typeof getKotoIQDb>, clientId: string) {
  const { data } = await db.client
    .from('kotoiq_strategic_plans')
    .select('attack_priorities, defend_priorities, abandon_list')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data || null
}

async function loadContentInventory(db: ReturnType<typeof getKotoIQDb>, clientId: string) {
  const { data } = await db.client
    .from('kotoiq_content_inventory')
    .select('url, sc_position, sc_clicks, freshness_status, trajectory')
    .eq('client_id', clientId)
    .limit(1000)
  return data || []
}

interface GeoCity {
  name: string
  county: string
  state: string
  zips: string[]
  lat?: number
  lng?: number
}

async function loadCities(
  state: string,
  counties?: string[],
): Promise<GeoCity[]> {
  try {
    // Load from local geo JSON files (public/geo/{state}.json)
    // 42K ZIPs, 30K cities, 3.1K counties — no external API needed
    const filePath = join(process.cwd(), 'public', 'geo', `${state.toLowerCase()}.json`)
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw) as {
      counties: string[]
      cities: Array<{ n: string; c: string; z: string[]; lat: number; lng: number }>
    }

    let cities = data.cities || []

    // Filter by counties if specified
    if (counties?.length) {
      const countySet = new Set(counties.map(c => c.toLowerCase()))
      cities = cities.filter(c => countySet.has(c.c.toLowerCase()))
    }

    return cities.map(c => ({
      name: c.n,
      county: c.c,
      state: state.toUpperCase(),
      zips: c.z || [],
      lat: c.lat,
      lng: c.lng,
    }))
  } catch (e) {
    console.error(`[pageGapEngine] Failed to load geo data for ${state}:`, e)
    return []
  }
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
