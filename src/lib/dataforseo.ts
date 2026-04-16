// ─────────────────────────────────────────────────────────────
// DataForSEO API Client
// Docs: https://docs.dataforseo.com/
// Auth: HTTP Basic (base64 encoded login:password)
// ─────────────────────────────────────────────────────────────

const BASE = 'https://api.dataforseo.com/v3'

function getAuth(): string {
  return process.env.DATAFORSEO_AUTH || ''
}

async function dfsPost(endpoint: string, body: any[]): Promise<any> {
  const auth = getAuth()
  if (!auth) throw new Error('DATAFORSEO_AUTH not configured')

  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`DataForSEO ${endpoint} ${res.status}: ${text.slice(0, 300)}`)
  }

  return res.json()
}

async function dfsGet(endpoint: string): Promise<any> {
  const auth = getAuth()
  if (!auth) throw new Error('DATAFORSEO_AUTH not configured')

  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { 'Authorization': `Basic ${auth}` },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`DataForSEO ${endpoint} ${res.status}: ${text.slice(0, 300)}`)
  }

  return res.json()
}

// ─────────────────────────────────────────────────────────────
// SERP — Google organic + features + AI Overview
// ─────────────────────────────────────────────────────────────

export interface SERPResult {
  keyword: string
  location: string
  items: SERPItem[]
  ai_overview: AIOverview | null
  featured_snippet: any | null
  people_also_ask: string[]
  related_searches: string[]
  knowledge_graph: any | null
  local_pack: any[]
  total_results: number
  se_results_count: number
}

interface SERPItem {
  type: string
  rank_group: number
  rank_absolute: number
  position: string
  title: string
  url: string
  domain: string
  description: string
  breadcrumb: string
}

interface AIOverview {
  present: boolean
  text: string
  sources: { title: string; url: string; domain: string }[]
  position: number
}

export async function getSERPResults(keyword: string, location: string = 'United States', language: string = 'en'): Promise<SERPResult> {
  const data = await dfsPost('/serp/google/organic/live/advanced', [{
    keyword,
    location_name: location,
    language_name: language === 'en' ? 'English' : language,
    device: 'desktop',
    os: 'windows',
  }])

  const task = data?.tasks?.[0]
  const result = task?.result?.[0]
  if (!result) return { keyword, location, items: [], ai_overview: null, featured_snippet: null, people_also_ask: [], related_searches: [], knowledge_graph: null, local_pack: [], total_results: 0, se_results_count: 0 }

  const items: SERPItem[] = []
  let ai_overview: AIOverview | null = null
  let featured_snippet: any = null
  const people_also_ask: string[] = []
  const related_searches: string[] = []
  let knowledge_graph: any = null
  const local_pack: any[] = []

  for (const item of (result.items || [])) {
    if (item.type === 'organic') {
      items.push({
        type: 'organic',
        rank_group: item.rank_group,
        rank_absolute: item.rank_absolute,
        position: item.position || 'left',
        title: item.title || '',
        url: item.url || '',
        domain: item.domain || '',
        description: item.description || '',
        breadcrumb: item.breadcrumb || '',
      })
    } else if (item.type === 'ai_overview') {
      ai_overview = {
        present: true,
        text: item.text || item.description || '',
        sources: (item.references || item.items || []).map((ref: any) => ({
          title: ref.title || '',
          url: ref.url || '',
          domain: ref.domain || '',
        })),
        position: item.rank_absolute || 0,
      }
    } else if (item.type === 'featured_snippet') {
      featured_snippet = {
        title: item.title,
        url: item.url,
        domain: item.domain,
        description: item.description,
        type: item.featured_snippet_type || 'paragraph',
      }
    } else if (item.type === 'people_also_ask') {
      for (const q of (item.items || [])) {
        if (q.title) people_also_ask.push(q.title)
      }
    } else if (item.type === 'related_searches') {
      for (const s of (item.items || [])) {
        if (s.title) related_searches.push(s.title)
      }
    } else if (item.type === 'knowledge_graph') {
      knowledge_graph = {
        title: item.title,
        subtitle: item.subtitle,
        description: item.description,
        type: item.sub_type,
      }
    } else if (item.type === 'local_pack') {
      for (const biz of (item.items || [])) {
        local_pack.push({
          title: biz.title,
          rating: biz.rating?.value,
          reviews: biz.rating?.votes_count,
          domain: biz.domain,
          url: biz.url,
          description: biz.description,
        })
      }
    }
  }

  return {
    keyword,
    location,
    items,
    ai_overview,
    featured_snippet,
    people_also_ask,
    related_searches,
    knowledge_graph,
    local_pack,
    total_results: result.se_results_count || 0,
    se_results_count: result.se_results_count || 0,
  }
}

// ─────────────────────────────────────────────────────────────
// GMB Grid Tracker — local rankings across geographic grid
// ─────────────────────────────────────────────────────────────

export interface GMBGridResult {
  keyword: string
  business_name: string
  center_lat: number
  center_lng: number
  grid_size: number
  spacing_km: number
  cells: GMBGridCell[]
  avg_rank: number
  best_rank: number
  worst_rank: number
  ranked_cells: number
  total_cells: number
  coverage_pct: number
}

interface GMBGridCell {
  row: number
  col: number
  lat: number
  lng: number
  rank: number | null
  found: boolean
  top_3: { title: string; rank: number }[]
}

export async function runGMBGridScan(
  keyword: string,
  businessName: string,
  lat: number,
  lng: number,
  gridSize: number = 5,
  spacingKm: number = 1.5,
  location: string = 'United States',
): Promise<GMBGridResult> {
  const cells: GMBGridCell[] = []
  const halfGrid = Math.floor(gridSize / 2)

  // Build grid points
  const gridPoints: { row: number; col: number; lat: number; lng: number }[] = []
  for (let r = -halfGrid; r <= halfGrid; r++) {
    for (let c = -halfGrid; c <= halfGrid; c++) {
      const cellLat = lat + (r * spacingKm * 0.009) // ~0.009 degrees per km
      const cellLng = lng + (c * spacingKm * 0.011) // ~0.011 degrees per km at mid-latitudes
      gridPoints.push({ row: r + halfGrid, col: c + halfGrid, lat: cellLat, lng: cellLng })
    }
  }

  // Batch into DataForSEO requests (max 100 per request)
  const tasks = gridPoints.map(point => ({
    keyword,
    location_coordinate: `${point.lat.toFixed(6)},${point.lng.toFixed(6)},15`,
    language_name: 'English',
    device: 'mobile',
    os: 'android',
    depth: 20,
  }))

  // Send in batches of 10 to avoid rate limits
  const batchSize = 10
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize)
    try {
      const data = await dfsPost('/serp/google/maps/live/advanced', batch)

      for (let j = 0; j < batch.length; j++) {
        const point = gridPoints[i + j]
        const taskResult = data?.tasks?.[j]?.result?.[0]
        const items = taskResult?.items || []

        let rank: number | null = null
        const top_3: { title: string; rank: number }[] = []

        for (const item of items) {
          if (item.rank_absolute <= 3) {
            top_3.push({ title: item.title || '', rank: item.rank_absolute })
          }
          if (item.title && businessName &&
            item.title.toLowerCase().includes(businessName.toLowerCase().slice(0, 20))) {
            rank = item.rank_absolute
          }
        }

        cells.push({
          row: point.row,
          col: point.col,
          lat: point.lat,
          lng: point.lng,
          rank,
          found: rank !== null,
          top_3,
        })
      }
    } catch (e) {
      // Fill failed cells with null
      for (let j = 0; j < batch.length; j++) {
        const point = gridPoints[i + j]
        cells.push({ row: point.row, col: point.col, lat: point.lat, lng: point.lng, rank: null, found: false, top_3: [] })
      }
    }
  }

  const rankedCells = cells.filter(c => c.rank !== null)
  const ranks = rankedCells.map(c => c.rank as number)

  return {
    keyword,
    business_name: businessName,
    center_lat: lat,
    center_lng: lng,
    grid_size: gridSize,
    spacing_km: spacingKm,
    cells,
    avg_rank: ranks.length > 0 ? Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length * 10) / 10 : 0,
    best_rank: ranks.length > 0 ? Math.min(...ranks) : 0,
    worst_rank: ranks.length > 0 ? Math.max(...ranks) : 0,
    ranked_cells: rankedCells.length,
    total_cells: cells.length,
    coverage_pct: Math.round((rankedCells.length / cells.length) * 100),
  }
}

// ─────────────────────────────────────────────────────────────
// Keyword Rankings — bulk position tracking
// ─────────────────────────────────────────────────────────────

export async function getKeywordRankings(domain: string, keywords: string[], location: string = 'United States'): Promise<any[]> {
  const tasks = keywords.map(kw => ({
    keyword: kw,
    location_name: location,
    language_name: 'English',
    device: 'desktop',
    os: 'windows',
  }))

  const results: any[] = []
  const batchSize = 10

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize)
    try {
      const data = await dfsPost('/serp/google/organic/live/regular', batch)

      for (let j = 0; j < batch.length; j++) {
        const taskResult = data?.tasks?.[j]?.result?.[0]
        const items = taskResult?.items || []

        let position: number | null = null
        let url: string | null = null

        for (const item of items) {
          if (item.type === 'organic' && item.domain && item.domain.includes(domain.replace(/^www\./, ''))) {
            position = item.rank_group
            url = item.url
            break
          }
        }

        results.push({
          keyword: keywords[i + j],
          position,
          url,
          found: position !== null,
          total_results: taskResult?.se_results_count || 0,
        })
      }
    } catch {
      for (let j = 0; j < batch.length; j++) {
        results.push({ keyword: keywords[i + j], position: null, url: null, found: false, total_results: 0 })
      }
    }
  }

  return results
}

// ─────────────────────────────────────────────────────────────
// Account balance check
// ─────────────────────────────────────────────────────────────

export async function getBalance(): Promise<{ balance: number; currency: string }> {
  const data = await dfsGet('/appendix/user_data')
  const user = data?.tasks?.[0]?.result?.[0]
  return {
    balance: user?.money?.balance || 0,
    currency: user?.money?.currency || 'USD',
  }
}

// ─────────────────────────────────────────────────────────────
// Domain Competitors — find who competes for the same keywords
// ─────────────────────────────────────────────────────────────

export interface DomainCompetitor {
  domain: string
  avg_position: number
  keywords_count: number
  sum_position: number
  intersections: number
  competitor_relevance: number
  organic_count: number
  organic_traffic: number
  organic_cost: number
}

export async function getDomainCompetitors(domain: string, location: string = 'United States', limit: number = 20): Promise<DomainCompetitor[]> {
  const data = await dfsPost('/dataforseo_labs/google/competitors_domain/live', [{
    target: domain.replace(/^www\./, ''),
    location_name: location,
    language_name: 'English',
    item_types: ['organic'],
    limit,
    exclude_top_domains: true,
    order_by: ['metrics.organic.count,desc'],
  }])

  const items = data?.tasks?.[0]?.result?.[0]?.items || []
  return items.map((item: any) => ({
    domain: item.domain,
    avg_position: item.avg_position || 0,
    keywords_count: item.metrics?.organic?.count || 0,
    sum_position: item.metrics?.organic?.pos_1 + item.metrics?.organic?.pos_2_3 + item.metrics?.organic?.pos_4_10 || 0,
    intersections: item.metrics?.organic?.intersections || 0,
    competitor_relevance: item.competitor_relevance || 0,
    organic_count: item.metrics?.organic?.count || 0,
    organic_traffic: item.metrics?.organic?.etv || 0,
    organic_cost: item.metrics?.organic?.estimated_paid_traffic_cost || 0,
  }))
}

// ─────────────────────────────────────────────────────────────
// Domain Ranked Keywords — all keywords a domain ranks for
// ─────────────────────────────────────────────────────────────

export interface RankedKeyword {
  keyword: string
  position: number
  search_volume: number
  cpc: number
  competition: number
  url: string
  traffic: number
  traffic_cost: number
  serp_type: string
}

export async function getDomainRankedKeywords(domain: string, location: string = 'United States', limit: number = 100): Promise<{ keywords: RankedKeyword[]; total: number }> {
  const data = await dfsPost('/dataforseo_labs/google/ranked_keywords/live', [{
    target: domain.replace(/^www\./, ''),
    location_name: location,
    language_name: 'English',
    item_types: ['organic'],
    limit,
    order_by: ['ranked_serp_element.serp_item.rank_group,asc'],
  }])

  const result = data?.tasks?.[0]?.result?.[0]
  const items = result?.items || []
  const total = result?.total_count || 0

  return {
    total,
    keywords: items.map((item: any) => ({
      keyword: item.keyword_data?.keyword || '',
      position: item.ranked_serp_element?.serp_item?.rank_group || 0,
      search_volume: item.keyword_data?.keyword_info?.search_volume || 0,
      cpc: item.keyword_data?.keyword_info?.cpc || 0,
      competition: item.keyword_data?.keyword_info?.competition || 0,
      url: item.ranked_serp_element?.serp_item?.url || '',
      traffic: item.ranked_serp_element?.serp_item?.etv || 0,
      traffic_cost: item.ranked_serp_element?.serp_item?.estimated_paid_traffic_cost || 0,
      serp_type: item.ranked_serp_element?.serp_item?.type || 'organic',
    })),
  }
}

// ─────────────────────────────────────────────────────────────
// Domain vs Domain — keyword intersection comparison
// ─────────────────────────────────────────────────────────────

export async function getDomainIntersection(domain1: string, domain2: string, location: string = 'United States', limit: number = 100): Promise<any[]> {
  const data = await dfsPost('/dataforseo_labs/google/domain_intersection/live', [{
    target1: domain1.replace(/^www\./, ''),
    target2: domain2.replace(/^www\./, ''),
    location_name: location,
    language_name: 'English',
    item_types: ['organic'],
    limit,
    order_by: ['first_domain_serp_element.serp_item.rank_group,asc'],
  }])

  const items = data?.tasks?.[0]?.result?.[0]?.items || []
  return items.map((item: any) => ({
    keyword: item.keyword_data?.keyword || '',
    search_volume: item.keyword_data?.keyword_info?.search_volume || 0,
    cpc: item.keyword_data?.keyword_info?.cpc || 0,
    domain1_position: item.first_domain_serp_element?.serp_item?.rank_group || null,
    domain2_position: item.second_domain_serp_element?.serp_item?.rank_group || null,
    domain1_url: item.first_domain_serp_element?.serp_item?.url || '',
    domain2_url: item.second_domain_serp_element?.serp_item?.url || '',
  }))
}
