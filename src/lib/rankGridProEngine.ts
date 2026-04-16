import 'server-only'
// ─────────────────────────────────────────────────────────────
// KotoIQ — Rank Grid Pro
// Pro version of local grid rank tracking. Layers competitor
// tracking, Share of Local Voice, dead-zone detection, drift,
// and competitor clustering on top of the base DataForSEO grid.
// Called via POST /api/kotoiq action: run_rank_grid_pro
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { runGMBGridScan } from '@/lib/dataforseo'

// ── Types ───────────────────────────────────────────────────────────────────
interface GridPoint {
  row: number
  col: number
  lat: number
  lng: number
  rank: number | null
  top3: { title: string; rank: number }[]
  heat_color: 'green' | 'yellow' | 'orange' | 'red' | 'black'
  competitor_at_1: string | null
}

interface CompetitorAgg {
  name: string
  avg_rank: number
  appearances: number
  top3_count: number
  dominant_zones: { row: number; col: number }[]
}

export interface RankGridProResult {
  scan_id?: string
  keyword: string
  business_name: string
  center_lat: number
  center_lng: number
  grid_size: number
  radius_miles: number
  grid_data: GridPoint[]
  avg_rank: number
  solv_pct: number
  top3_coverage_pct: number
  dead_zones: { row: number; col: number; lat: number; lng: number }[]
  top_competitors: CompetitorAgg[]
  drift_vs_last_scan: {
    points_improved: number
    points_declined: number
    points_unchanged: number
    avg_rank_delta: number
    previous_scanned_at: string | null
  } | null
  heatmap_data: GridPoint[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function heatColor(rank: number | null): GridPoint['heat_color'] {
  if (rank === null) return 'black'
  if (rank <= 3) return 'green'
  if (rank <= 10) return 'yellow'
  if (rank <= 20) return 'orange'
  if (rank <= 50) return 'red'
  return 'black'
}

function milesToKm(mi: number): number {
  return mi * 1.60934
}

function normalizeName(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// ── Main entry ──────────────────────────────────────────────────────────────
export async function runRankGridPro(
  s: SupabaseClient,
  _ai: Anthropic,
  body: {
    client_id?: string | null
    agency_id?: string | null
    keyword: string
    business_name: string
    center_lat: number
    center_lng: number
    grid_size?: 5 | 7
    radius_miles?: number
    track_competitors?: boolean
  }
): Promise<RankGridProResult> {
  const {
    client_id,
    keyword,
    business_name,
    center_lat,
    center_lng,
  } = body
  const grid_size = (body.grid_size === 5 ? 5 : 7) as 5 | 7
  const radius_miles = body.radius_miles ?? 3
  const track_competitors = body.track_competitors !== false

  if (!keyword) throw new Error('keyword required')
  if (!business_name) throw new Error('business_name required')
  if (center_lat == null || center_lng == null) throw new Error('center_lat and center_lng required')

  // Convert "radius in miles" to spacing_km between grid cells.
  // Radius covers half the grid; spacing = radius / (gridSize/2)
  const radiusKm = milesToKm(radius_miles)
  const spacingKm = Math.max(0.3, radiusKm / Math.max(1, Math.floor(grid_size / 2)))

  // ── Run the underlying grid scan ──
  const base = await runGMBGridScan(
    keyword,
    business_name,
    center_lat,
    center_lng,
    grid_size,
    spacingKm,
  )

  // ── Build enriched grid points ──
  const grid_data: GridPoint[] = base.cells.map(cell => ({
    row: cell.row,
    col: cell.col,
    lat: cell.lat,
    lng: cell.lng,
    rank: cell.rank,
    top3: cell.top_3,
    heat_color: heatColor(cell.rank),
    competitor_at_1: cell.top_3.find(t => t.rank === 1)?.title || null,
  }))

  // ── SoLV: share of top-3 positions across all points ──
  const totalTop3Slots = grid_data.length * 3
  let clientTop3 = 0
  const nameNorm = normalizeName(business_name)

  for (const p of grid_data) {
    for (const t of p.top3) {
      if (normalizeName(t.title).includes(nameNorm) && nameNorm.length > 0) clientTop3++
    }
  }
  const solv_pct = totalTop3Slots > 0 ? Math.round((clientTop3 / totalTop3Slots) * 100 * 100) / 100 : 0

  // ── Top3 coverage: % of points where client is ranked 1-3 ──
  const top3Points = grid_data.filter(p => p.rank !== null && p.rank <= 3).length
  const top3_coverage_pct = grid_data.length > 0 ? Math.round((top3Points / grid_data.length) * 100 * 100) / 100 : 0

  // ── Avg rank (only over ranked points) ──
  const rankedPoints = grid_data.filter(p => p.rank !== null)
  const avg_rank = rankedPoints.length > 0
    ? Math.round((rankedPoints.reduce((acc, p) => acc + (p.rank as number), 0) / rankedPoints.length) * 10) / 10
    : 0

  // ── Dead zones: points where client doesn't appear at all (rank === null) ──
  const dead_zones = grid_data.filter(p => p.rank === null).map(p => ({
    row: p.row,
    col: p.col,
    lat: p.lat,
    lng: p.lng,
  }))

  // ── Top competitors ──
  let top_competitors: CompetitorAgg[] = []
  if (track_competitors) {
    const compMap = new Map<string, { ranks: number[]; top3: number; zones: { row: number; col: number }[] }>()

    for (const p of grid_data) {
      for (const t of p.top3) {
        const key = normalizeName(t.title)
        if (!key || key === nameNorm || key.includes(nameNorm) || (nameNorm && nameNorm.includes(key))) continue
        if (!compMap.has(key)) compMap.set(key, { ranks: [], top3: 0, zones: [] })
        const agg = compMap.get(key)!
        agg.ranks.push(t.rank)
        if (t.rank <= 3) agg.top3++
        agg.zones.push({ row: p.row, col: p.col })
      }
    }

    top_competitors = [...compMap.entries()]
      .map(([key, agg]) => {
        // Find the display name (original-case title with most appearances)
        const nameCounts = new Map<string, number>()
        for (const p of grid_data) {
          for (const t of p.top3) {
            if (normalizeName(t.title) === key) nameCounts.set(t.title, (nameCounts.get(t.title) || 0) + 1)
          }
        }
        let bestName = key
        let bestCount = 0
        for (const [n, c] of nameCounts) if (c > bestCount) { bestName = n; bestCount = c }

        const avg = agg.ranks.length > 0 ? Math.round((agg.ranks.reduce((a, b) => a + b, 0) / agg.ranks.length) * 10) / 10 : 0
        return {
          name: bestName,
          avg_rank: avg,
          appearances: agg.ranks.length,
          top3_count: agg.top3,
          dominant_zones: agg.zones,
        }
      })
      .sort((a, b) => b.top3_count - a.top3_count || a.avg_rank - b.avg_rank)
      .slice(0, 3)
  }

  // ── Drift vs last scan (same keyword + client + business_name) ──
  let drift_vs_last_scan: RankGridProResult['drift_vs_last_scan'] = null
  if (client_id) {
    try {
      const { data: prev } = await s
        .from('kotoiq_grid_scans_pro')
        .select('grid_data, avg_rank, scanned_at')
        .eq('client_id', client_id)
        .eq('keyword', keyword)
        .eq('business_name', business_name)
        .order('scanned_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (prev?.grid_data) {
        let improved = 0
        let declined = 0
        let unchanged = 0
        const prevByKey = new Map<string, number | null>()
        for (const pp of prev.grid_data as any[]) {
          prevByKey.set(`${pp.row}:${pp.col}`, pp.rank ?? null)
        }
        for (const p of grid_data) {
          const prevRank = prevByKey.get(`${p.row}:${p.col}`) ?? null
          if (prevRank === null && p.rank === null) { unchanged++; continue }
          if (prevRank === null && p.rank !== null) { improved++; continue }
          if (prevRank !== null && p.rank === null) { declined++; continue }
          if (prevRank === p.rank) unchanged++
          else if ((p.rank as number) < (prevRank as number)) improved++
          else declined++
        }
        drift_vs_last_scan = {
          points_improved: improved,
          points_declined: declined,
          points_unchanged: unchanged,
          avg_rank_delta: Math.round(((avg_rank || 0) - (Number(prev.avg_rank) || 0)) * 10) / 10,
          previous_scanned_at: prev.scanned_at || null,
        }
      }
    } catch {
      // Drift lookup failure shouldn't block the scan
    }
  }

  const result: RankGridProResult = {
    keyword,
    business_name,
    center_lat,
    center_lng,
    grid_size,
    radius_miles,
    grid_data,
    avg_rank,
    solv_pct,
    top3_coverage_pct,
    dead_zones,
    top_competitors,
    drift_vs_last_scan,
    heatmap_data: grid_data,
  }

  // ── Persist ──
  let scan_id: string | undefined
  if (client_id) {
    try {
      const { data } = await s.from('kotoiq_grid_scans_pro').insert({
        client_id,
        keyword,
        business_name,
        center_lat,
        center_lng,
        grid_size,
        radius_miles,
        grid_data,
        avg_rank,
        solv_pct,
        top3_coverage_pct,
        dead_zones,
        top_competitors,
        drift_vs_last: drift_vs_last_scan || {},
      }).select('id').single()
      scan_id = data?.id
    } catch {
      // Persistence failure shouldn't block the scan response
    }
  }

  return { ...result, scan_id }
}

// ── History + comparison ────────────────────────────────────────────────────
export async function getGridScanHistory(
  s: SupabaseClient,
  body: { client_id: string; keyword?: string; limit?: number }
) {
  const { client_id, keyword } = body
  if (!client_id) throw new Error('client_id required')

  let q = s.from('kotoiq_grid_scans_pro').select('*').eq('client_id', client_id)
  if (keyword) q = q.eq('keyword', keyword)

  const { data, error } = await q
    .order('scanned_at', { ascending: false })
    .limit(Math.min(body.limit || 25, 100))

  if (error && error.code !== 'PGRST116') throw error
  return data || []
}

export async function compareGridScans(
  s: SupabaseClient,
  body: { scan_a: string; scan_b: string }
) {
  const { scan_a, scan_b } = body
  if (!scan_a || !scan_b) throw new Error('scan_a and scan_b required')

  const { data: scans, error } = await s
    .from('kotoiq_grid_scans_pro')
    .select('*')
    .in('id', [scan_a, scan_b])

  if (error) throw error
  if (!scans || scans.length < 2) throw new Error('One or both scans not found')

  // Normalize ordering so A is earlier
  const [older, newer] = (scans[0].scanned_at < scans[1].scanned_at)
    ? [scans[0], scans[1]]
    : [scans[1], scans[0]]

  const prevByKey = new Map<string, number | null>()
  for (const p of (older.grid_data || []) as any[]) prevByKey.set(`${p.row}:${p.col}`, p.rank ?? null)

  let improved = 0
  let declined = 0
  let unchanged = 0
  const point_deltas: Array<{ row: number; col: number; from: number | null; to: number | null; delta: number | null }> = []

  for (const p of (newer.grid_data || []) as any[]) {
    const prev = prevByKey.get(`${p.row}:${p.col}`) ?? null
    const now = p.rank ?? null
    let delta: number | null = null
    if (prev !== null && now !== null) delta = prev - now // positive = improved (lower rank number)
    point_deltas.push({ row: p.row, col: p.col, from: prev, to: now, delta })

    if (prev === null && now === null) { unchanged++; continue }
    if (prev === null && now !== null) { improved++; continue }
    if (prev !== null && now === null) { declined++; continue }
    if (prev === now) unchanged++
    else if ((now as number) < (prev as number)) improved++
    else declined++
  }

  return {
    older_scan: { id: older.id, scanned_at: older.scanned_at, avg_rank: older.avg_rank, solv_pct: older.solv_pct, top3_coverage_pct: older.top3_coverage_pct },
    newer_scan: { id: newer.id, scanned_at: newer.scanned_at, avg_rank: newer.avg_rank, solv_pct: newer.solv_pct, top3_coverage_pct: newer.top3_coverage_pct },
    points_improved: improved,
    points_declined: declined,
    points_unchanged: unchanged,
    avg_rank_delta: Math.round(((Number(newer.avg_rank) || 0) - (Number(older.avg_rank) || 0)) * 10) / 10,
    solv_delta: Math.round(((Number(newer.solv_pct) || 0) - (Number(older.solv_pct) || 0)) * 100) / 100,
    top3_coverage_delta: Math.round(((Number(newer.top3_coverage_pct) || 0) - (Number(older.top3_coverage_pct) || 0)) * 100) / 100,
    point_deltas,
  }
}
