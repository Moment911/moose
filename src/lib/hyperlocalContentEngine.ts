import 'server-only'
// ─────────────────────────────────────────────────────────────
// KotoIQ — Hyperlocal Content Generator
//
// Turns geographic weakness into content strategy. Takes the
// latest rank grid pro scan for a client, finds the weakest
// points (rank > 20), reverse-geocodes them into neighborhood
// names, clusters points by area, then auto-generates a
// hyperlocal landing page brief + LocalBusiness schema for
// every neighborhood with 3+ weak points.
//
// Called via POST /api/kotoiq action: generate_hyperlocal_from_grid
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

// ── Types ───────────────────────────────────────────────────────────────────
interface HyperlocalInput {
  client_id: string
  agency_id?: string | null
  grid_scan_id?: string | null
  create_calendar_items?: boolean
}

interface NeighborhoodCluster {
  name: string
  city: string
  state: string
  weak_points: number
  avg_rank: number | null
  center_lat: number
  center_lng: number
  landmarks: string[]
  point_indices: number[]
}

interface BriefCreated {
  brief_id: string
  neighborhood: string
  target_keyword: string
  target_url: string
  schema_preview: any
}

interface HyperlocalResult {
  dead_zones_analyzed: number
  neighborhoods_identified: Array<{
    name: string
    weak_points: number
    avg_rank: number | null
    population_estimate?: number
  }>
  briefs_created: BriefCreated[]
  calendar_items_created: number
  estimated_coverage_improvement: string
  scan_id: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function cleanJSON(raw: string): string {
  return raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Haversine distance in km — used to cluster nearby weak points
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

// ── Reverse geocode via Google Geocoding API ────────────────────────────────
interface GeocodeHit {
  formatted_address: string
  neighborhood: string | null
  sublocality: string | null
  locality: string | null
  admin_area_1: string | null
  postal_code: string | null
  lat: number
  lng: number
}

async function reverseGeocode(lat: number, lng: number, apiKey: string): Promise<GeocodeHit | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(apiKey)}`
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const d = await r.json()
    if (d.status !== 'OK' || !d.results?.length) return null

    // Prefer the first result with a neighborhood component
    const withNeighborhood = d.results.find((res: any) =>
      res.address_components?.some((c: any) => c.types.includes('neighborhood'))
    ) || d.results[0]

    const comp = (type: string): string | null =>
      withNeighborhood.address_components?.find((c: any) => c.types.includes(type))?.long_name || null

    return {
      formatted_address: withNeighborhood.formatted_address || '',
      neighborhood: comp('neighborhood'),
      sublocality: comp('sublocality') || comp('sublocality_level_1'),
      locality: comp('locality'),
      admin_area_1: comp('administrative_area_level_1'),
      postal_code: comp('postal_code'),
      lat,
      lng,
    }
  } catch { return null }
}

// ── Main entry: generate_hyperlocal_from_grid ───────────────────────────────
export async function generateHyperlocalFromGrid(
  s: SupabaseClient,
  ai: Anthropic,
  body: HyperlocalInput
): Promise<HyperlocalResult> {
  const { client_id, agency_id, grid_scan_id } = body
  const create_calendar_items = body.create_calendar_items !== false

  if (!client_id) throw new Error('client_id required')

  const geoKey =
    process.env.GOOGLE_GEOCODING_KEY ||
    process.env.GOOGLE_PLACES_KEY ||
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''

  if (!geoKey) {
    throw new Error('GOOGLE_GEOCODING_KEY (or GOOGLE_PLACES_KEY / GOOGLE_API_KEY) env var is required for reverse geocoding')
  }

  // ── Pull client + scan ──
  const { data: client } = await s
    .from('clients')
    .select('id, name, website, primary_service, industry, target_customer, city, state')
    .eq('id', client_id)
    .single()

  if (!client) throw new Error('Client not found')

  let scanQuery = s
    .from('kotoiq_grid_scans_pro')
    .select('id, keyword, business_name, center_lat, center_lng, grid_data, dead_zones, avg_rank, top3_coverage_pct, scanned_at')
    .eq('client_id', client_id)

  if (grid_scan_id) {
    scanQuery = scanQuery.eq('id', grid_scan_id)
  } else {
    scanQuery = scanQuery.order('scanned_at', { ascending: false }).limit(1)
  }

  const { data: scans, error: scanErr } = await scanQuery
  if (scanErr) throw scanErr
  if (!scans?.length) throw new Error('No grid scans found for this client. Run a Rank Grid Pro scan first.')

  const scan = scans[0]
  const gridData: any[] = scan.grid_data || []

  // ── Extract weak points (rank > 20 or null) ──
  const weakPoints = gridData
    .map((p, idx) => ({ ...p, idx }))
    .filter(p => p.rank === null || (typeof p.rank === 'number' && p.rank > 20))

  if (weakPoints.length === 0) {
    return {
      dead_zones_analyzed: 0,
      neighborhoods_identified: [],
      briefs_created: [],
      calendar_items_created: 0,
      estimated_coverage_improvement: 'No weak points detected — client has strong local coverage.',
      scan_id: scan.id,
    }
  }

  // ── Reverse geocode each weak point (throttled to 10 at a time) ──
  const geocoded: Array<{ point: any; geo: GeocodeHit | null }> = []
  const BATCH = 10
  for (let i = 0; i < weakPoints.length; i += BATCH) {
    const batch = weakPoints.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(async (p) => {
        const geo = await reverseGeocode(Number(p.lat), Number(p.lng), geoKey)
        return { point: p, geo }
      })
    )
    geocoded.push(...results)
  }

  // ── Cluster points by neighborhood name ──
  // Two-tier grouping: first by neighborhood/sublocality name if available,
  // then fall back to postal_code, finally to locality (city).
  const clusters = new Map<string, NeighborhoodCluster>()

  for (const { point, geo } of geocoded) {
    if (!geo) continue
    const name = geo.neighborhood || geo.sublocality || geo.postal_code || geo.locality || 'Unknown'
    const city = geo.locality || client.city || ''
    const state = geo.admin_area_1 || client.state || ''
    const key = `${name}|${city}|${state}`.toLowerCase()

    if (!clusters.has(key)) {
      clusters.set(key, {
        name,
        city,
        state,
        weak_points: 0,
        avg_rank: null,
        center_lat: 0,
        center_lng: 0,
        landmarks: [],
        point_indices: [],
      })
    }
    const c = clusters.get(key)!
    c.weak_points++
    c.center_lat += Number(point.lat)
    c.center_lng += Number(point.lng)
    c.point_indices.push(point.idx)

    if (geo.formatted_address && !c.landmarks.includes(geo.formatted_address)) {
      c.landmarks.push(geo.formatted_address)
    }
  }

  // Finalize cluster centroids + avg rank
  for (const c of clusters.values()) {
    if (c.weak_points > 0) {
      c.center_lat = c.center_lat / c.weak_points
      c.center_lng = c.center_lng / c.weak_points
    }
    const ranks = c.point_indices
      .map(i => gridData[i]?.rank)
      .filter((r): r is number => typeof r === 'number')
    c.avg_rank = ranks.length > 0
      ? Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10
      : null
    // Cap landmarks list
    c.landmarks = c.landmarks.slice(0, 4)
  }

  // ── Keep only clusters with 3+ weak points ──
  const qualifiedClusters = [...clusters.values()]
    .filter(c => c.weak_points >= 3)
    .sort((a, b) => b.weak_points - a.weak_points)

  const neighborhoods_identified = qualifiedClusters.map(c => ({
    name: c.name,
    weak_points: c.weak_points,
    avg_rank: c.avg_rank,
  }))

  // ── Generate a hyperlocal brief + schema for each qualified neighborhood ──
  const briefs_created: BriefCreated[] = []
  let calendar_items_created = 0

  const primaryService = client.primary_service || client.industry || scan.keyword || 'services'

  for (const cluster of qualifiedClusters) {
    try {
      const target_keyword = `${primaryService} in ${cluster.name}`
      const target_url = `/${slugify(primaryService)}-${slugify(cluster.name)}/`

      const hyperlocalPrompt = `You are KotoIQ's local SEO strategist. Generate a hyperlocal landing page brief + LocalBusiness JSON-LD schema for a service area the business is losing visibility in.

BUSINESS: ${client.name}
WEBSITE: ${client.website || ''}
PRIMARY SERVICE: ${primaryService}
TARGET CUSTOMER: ${client.target_customer || 'local homeowners and businesses'}

NEIGHBORHOOD: ${cluster.name}
CITY: ${cluster.city}
STATE: ${cluster.state}
WEAK GRID POINTS: ${cluster.weak_points}
AVG RANK IN AREA: ${cluster.avg_rank ?? 'not ranking'}
CENTROID: ${cluster.center_lat.toFixed(5)}, ${cluster.center_lng.toFixed(5)}
NEARBY LANDMARKS / ADDRESSES: ${cluster.landmarks.join(' | ')}

APPROACH:
1. Write for residents of ${cluster.name} specifically — reference local context, landmarks, streets, and neighborhood character where possible.
2. The page's information gain comes from neighborhood-specific content no generic service page provides: travel times, common local service issues, neighborhood-specific pricing considerations, local testimonials patterns.
3. Target search intent: "${target_keyword}" — transactional with strong geographic modifier.
4. Build internal link opportunities back to the main service page and city hub page.
5. The LocalBusiness schema MUST set areaServed to the neighborhood, include geo coordinates (centroid), and reference the parent business.

Output ONLY valid JSON, no markdown fences:
{
  "title_tag": "${primaryService} in ${cluster.name} | ${client.name} — max 60 chars",
  "meta_description": "max 155 chars",
  "h1": "primary heading with neighborhood",
  "target_url": "${target_url}",
  "target_word_count": 1200,
  "outline": [
    {
      "h2": "Section heading",
      "h3s": ["Subsection"],
      "key_points": ["what to cover"],
      "word_count_target": 200
    }
  ],
  "neighborhood_context": {
    "local_landmarks": ["landmark 1", "landmark 2"],
    "streets_or_areas_to_mention": ["street 1"],
    "local_pain_points": ["specific issue residents face"],
    "competitor_local_presence": "what local competitors offer that we must beat"
  },
  "faq_questions": [
    { "question": "Do you serve ${cluster.name}?", "answer_guidance": "direct yes, describe coverage area" },
    { "question": "How fast can you reach ${cluster.name}?", "answer_guidance": "travel time or scheduling detail" },
    { "question": "What's the cost of ${primaryService} in ${cluster.name}?", "answer_guidance": "transparent pricing range" }
  ],
  "target_entities": ["${cluster.name}", "${cluster.city}", "${primaryService}"],
  "internal_link_targets": [
    { "anchor": "${primaryService}", "target": "/services/${slugify(primaryService)}/" },
    { "anchor": "${cluster.city} ${primaryService}", "target": "/${slugify(primaryService)}-${slugify(cluster.city)}/" }
  ],
  "schema": {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "${client.name} — ${cluster.name}",
    "url": "${client.website || ''}${target_url}",
    "areaServed": {
      "@type": "Place",
      "name": "${cluster.name}, ${cluster.city}, ${cluster.state}",
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": ${cluster.center_lat},
        "longitude": ${cluster.center_lng}
      }
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": ${cluster.center_lat},
      "longitude": ${cluster.center_lng}
    }
  },
  "estimated_monthly_traffic": 50
}`

      const msg = await ai.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3500,
        system: 'You are a local SEO strategist. Return ONLY valid JSON. No markdown.',
        messages: [{ role: 'user', content: hyperlocalPrompt }],
      })
      void logTokenUsage({
        feature: 'kotoiq_hyperlocal_brief',
        model: 'claude-sonnet-4-20250514',
        inputTokens: msg.usage?.input_tokens || 0,
        outputTokens: msg.usage?.output_tokens || 0,
        agencyId: agency_id || undefined,
      })

      const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
      const brief = JSON.parse(cleanJSON(raw))

      // Merge AI-generated schema with our deterministic fallback so we always
      // have a valid LocalBusiness block even if the LLM drops a field
      const fallbackSchema = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: `${client.name} — ${cluster.name}`,
        url: `${client.website || ''}${target_url}`,
        areaServed: {
          '@type': 'Place',
          name: `${cluster.name}, ${cluster.city}, ${cluster.state}`,
          geo: {
            '@type': 'GeoCoordinates',
            latitude: cluster.center_lat,
            longitude: cluster.center_lng,
          },
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: cluster.center_lat,
          longitude: cluster.center_lng,
        },
      }
      const schemaBlock = brief.schema && typeof brief.schema === 'object' ? brief.schema : fallbackSchema

      // Persist the content brief
      let brief_id: string | null = null
      try {
        const { data: savedBrief } = await s.from('kotoiq_content_briefs').insert({
          client_id,
          agency_id: agency_id || null,
          target_keyword,
          target_url: brief.target_url || target_url,
          page_type: 'hyperlocal_landing',
          title_tag: brief.title_tag,
          meta_description: brief.meta_description,
          h1: brief.h1,
          outline: brief.outline,
          schema_types: ['LocalBusiness', 'FAQPage'],
          faq_questions: brief.faq_questions,
          target_word_count: brief.target_word_count || 1200,
          target_entities: brief.target_entities,
          estimated_monthly_traffic: brief.estimated_monthly_traffic || 50,
          semantic_data: {
            neighborhood_context: brief.neighborhood_context || null,
            internal_link_targets: brief.internal_link_targets || [],
            local_schema: schemaBlock,
            source_scan_id: scan.id,
            cluster: {
              name: cluster.name,
              city: cluster.city,
              state: cluster.state,
              weak_points: cluster.weak_points,
              avg_rank: cluster.avg_rank,
              center: { lat: cluster.center_lat, lng: cluster.center_lng },
            },
          },
        }).select('id').single()
        brief_id = savedBrief?.id || null
      } catch { /* non-blocking */ }

      if (brief_id) {
        briefs_created.push({
          brief_id,
          neighborhood: cluster.name,
          target_keyword,
          target_url: brief.target_url || target_url,
          schema_preview: schemaBlock,
        })

        // Optionally add to content calendar — schedule across upcoming weeks
        if (create_calendar_items) {
          try {
            const today = new Date()
            const daysUntilMonday = ((8 - today.getDay()) % 7) || 7
            const startDate = new Date(today)
            startDate.setDate(startDate.getDate() + daysUntilMonday)

            // Space hyperlocal pages one per week, offset by current count
            const weekOffset = briefs_created.length - 1
            const planned = new Date(startDate)
            planned.setDate(planned.getDate() + weekOffset * 7)

            const { data: calItem } = await s.from('kotoiq_content_calendar').insert({
              client_id,
              title: `Hyperlocal: ${primaryService} in ${cluster.name}`,
              target_keyword,
              content_type: 'landing_page',
              status: 'planned',
              planned_date: planned.toISOString().split('T')[0],
              word_count: brief.target_word_count || 1200,
              notes: `Hyperlocal auto-brief from grid scan ${scan.id}. Neighborhood: ${cluster.name}. ${cluster.weak_points} weak points. Brief ID: ${brief_id}`,
            }).select('id').single()
            if (calItem?.id) calendar_items_created++
          } catch { /* non-blocking */ }
        }
      }
    } catch (e) {
      // One neighborhood failing shouldn't stop the others
      console.error('[hyperlocal] Failed to generate brief for', cluster.name, e)
    }
  }

  // ── Estimated coverage improvement ──
  const totalPoints = gridData.length
  const improvableWeakPoints = qualifiedClusters.reduce((a, c) => a + c.weak_points, 0)
  const coveragePct = totalPoints > 0 ? Math.round((improvableWeakPoints / totalPoints) * 100) : 0
  const estimated_coverage_improvement = briefs_created.length > 0
    ? `Covering ${briefs_created.length} new hyperlocal pages targets ${improvableWeakPoints} weak grid points (${coveragePct}% of scan area). Expected 15-30% improvement in local top-3 coverage within 90 days.`
    : 'No qualifying neighborhoods found — try a larger grid or lower weak-point threshold.'

  return {
    dead_zones_analyzed: weakPoints.length,
    neighborhoods_identified,
    briefs_created,
    calendar_items_created,
    estimated_coverage_improvement,
    scan_id: scan.id,
  }
}
