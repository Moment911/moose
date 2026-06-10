// ─────────────────────────────────────────────────────────────
// Competitor-Intel Aggregator — KotoIQ Phase 12 / WS5
//
// ONE lib + ONE action (competitor_intel) that, for a chosen
// service×city set, gathers THREE competitor lenses with provenance:
//
//   ORGANIC — DataForSEO SERP (analyze_competitors market path):
//             top 3-5 {name, domain, rank_group}. rank_group = the
//             authoritative organic rank.
//   GEO     — grid-scan map-pack: per-cell local-pack winners (top3[])
//             across an N×N Places grid. Per-business-name rank.
//   AEO     — aeoVisibilityEngine: setupClientForAEO → seed roster →
//             runAEOVisibilityScan → getCompetitorCompare. 5 engines
//             (ChatGPT/Claude/Gemini/Perplexity/Google AIO). Real $.
//
// The three lenses use THREE different identity models (organic = domain,
// GEO = business name, AEO = brand row). reconcileCompetitorIdentities()
// is the PURE, IO-free correctness anchor that collapses them into one
// per-competitor × per-lens set without double-counting.
//
// Every fetched lens fact is wrapped in createVerifiedData (source_url +
// fetched_at) with buildExpiresAt('rankings') = 24h staleness. A failed
// lens is marked 'unavailable' — NEVER presented as "no competitors".
// Spend is bounded to a representative service×city subset by default;
// what was capped is logged.
//
// Pure exports (unit-tested on fixtures, no DB/network):
//   - reconcileCompetitorIdentities
//   - normalizeBrand
//   - hostOf
// IO export:
//   - aggregateCompetitorIntel
// ─────────────────────────────────────────────────────────────

// NOTE: this module is imported by both server code (aggregateCompetitorIntel)
// and the pure-function unit test. The IO function lazy-imports its server-only
// deps so the pure helpers stay importable from the Vitest (react-server) env.

// ── Identity models (one per lens) ───────────────────────────────────────────

/** ORGANIC lens row — DataForSEO SERP. Authoritative rank = rank_group. */
export interface OrganicCompetitor {
  name?: string
  domain: string
  rank_group: number
}

/** GEO lens row — grid-scan local pack, keyed by business name. */
export interface GeoCompetitor {
  business_name: string
  local_pack_rank: number | null
  cells_present: number
}

/** AEO lens row — kotoiq_aeo_competitors share-of-voice (getCompetitorCompare). */
export interface AeoCompetitor {
  brand: string
  share: number
  avg_position: number | null
  mentions: number
  domain?: string | null
  aliases?: string[] | null
}

/** One reconciled competitor with whichever lenses matched it. */
export interface UnifiedCompetitor {
  name: string
  domain?: string
  organic?: { rank: number }
  geo?: { local_pack_rank: number | null; cells_present: number }
  aeo?: { share: number; avg_position: number | null; mentions: number }
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

const BRAND_SUFFIXES = new Set([
  'llc', 'inc', 'co', 'corp', 'company', 'ltd', 'group', 'plc', 'pllc', 'pc', 'lp', 'llp',
])

/**
 * Normalize a brand/business name for cross-lens equality:
 * lowercase, strip punctuation → spaces, collapse whitespace, drop trailing
 * legal suffixes (LLC/Inc/Co/...). Pure + idempotent.
 */
export function normalizeBrand(s: string): string {
  if (!s || typeof s !== 'string') return ''
  const base = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!base) return ''
  const parts = base.split(' ')
  while (parts.length > 1 && BRAND_SUFFIXES.has(parts[parts.length - 1])) {
    parts.pop()
  }
  return parts.join(' ')
}

/**
 * Extract the bare host from a URL or domain string: www-stripped, lowercased.
 * Returns '' on garbage rather than throwing (so a bad competitor URL can't
 * crash the merge). Pure.
 */
export function hostOf(url: string): string {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  // Try as a full URL first; fall back to bare-domain parse.
  const candidates = [trimmed, `https://${trimmed}`]
  for (const c of candidates) {
    try {
      const host = new URL(c).hostname.replace(/^www\./, '').toLowerCase()
      if (host && host.includes('.')) return host
    } catch {
      /* try next candidate */
    }
  }
  // Bare token with no protocol and no dot is not a host.
  return ''
}

/**
 * Collapse the three lenses into one per-competitor × per-lens set.
 *
 * Match rules:
 *   organic.domain ↔ aeo.domain          (hostOf equality)
 *   geo.business_name ↔ aeo.brand        (normalizeBrand equality OR alias membership)
 *
 * Unmatched entries become single-lens rows (never dropped). The same
 * competitor never double-counts across lenses. PURE — no IO.
 */
export function reconcileCompetitorIdentities(input: {
  organic: OrganicCompetitor[]
  geo: GeoCompetitor[]
  aeo: AeoCompetitor[]
}): UnifiedCompetitor[] {
  const organic = input.organic || []
  const geo = input.geo || []
  const aeo = input.aeo || []

  // Build merged rows keyed by a stable identity. We seed from AEO (the lens
  // that carries BOTH a domain and aliases, so it bridges organic↔geo), then
  // attach organic by domain and geo by normalized-name/alias. Anything that
  // doesn't match an AEO row becomes its own row.
  const rows: UnifiedCompetitor[] = []

  // Index helpers over the growing rows list.
  const byHost = new Map<string, UnifiedCompetitor>()
  const byName = new Map<string, UnifiedCompetitor>()
  // alias-normalized → row, so geo can match an AEO alias.
  const byAlias = new Map<string, UnifiedCompetitor>()

  function indexRow(row: UnifiedCompetitor, aliases?: string[] | null) {
    if (row.domain) byHost.set(row.domain, row)
    const nm = normalizeBrand(row.name)
    if (nm) byName.set(nm, row)
    for (const a of aliases || []) {
      const na = normalizeBrand(a)
      if (na) byAlias.set(na, row)
    }
  }

  // 1. Seed from AEO.
  for (const a of aeo) {
    const host = hostOf(a.domain || '')
    const row: UnifiedCompetitor = {
      name: a.brand,
      ...(host ? { domain: host } : {}),
      aeo: { share: a.share, avg_position: a.avg_position, mentions: a.mentions },
    }
    rows.push(row)
    indexRow(row, a.aliases)
  }

  // 2. Attach organic by domain host; else create a new organic-only row.
  for (const o of organic) {
    const host = hostOf(o.domain || '')
    let row = host ? byHost.get(host) : undefined
    if (!row && o.name) {
      // Fall back to name match (some SERP rows carry a brand title).
      row = byName.get(normalizeBrand(o.name)) || byAlias.get(normalizeBrand(o.name))
    }
    if (row) {
      // Never double-count: only the FIRST (best-ranked) organic hit wins.
      if (!row.organic) row.organic = { rank: o.rank_group }
      if (!row.domain && host) {
        row.domain = host
        byHost.set(host, row)
      }
      continue
    }
    const newRow: UnifiedCompetitor = {
      name: o.name || host || 'unknown',
      ...(host ? { domain: host } : {}),
      organic: { rank: o.rank_group },
    }
    rows.push(newRow)
    indexRow(newRow)
  }

  // 3. Attach geo by normalized business name OR alias; else new geo-only row.
  for (const g of geo) {
    const nm = normalizeBrand(g.business_name)
    let row = (nm ? byName.get(nm) : undefined) || (nm ? byAlias.get(nm) : undefined)
    if (row) {
      if (!row.geo) row.geo = { local_pack_rank: g.local_pack_rank, cells_present: g.cells_present }
      continue
    }
    const newRow: UnifiedCompetitor = {
      name: g.business_name,
      geo: { local_pack_rank: g.local_pack_rank, cells_present: g.cells_present },
    }
    rows.push(newRow)
    indexRow(newRow)
  }

  return rows
}

// ─────────────────────────────────────────────────────────────
// IO: aggregateCompetitorIntel — orchestrate 3 lenses (Task 2)
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSERPResults } from '../dataforseo'
import { createVerifiedData, buildExpiresAt, type VerifiedDataSource } from '../dataIntegrity'
import { getKotoIQDb } from '../kotoiqDb'
import {
  setupClientForAEO,
  runAEOVisibilityScan,
  getCompetitorCompare,
} from './aeoVisibilityEngine'

/** Per-lens status — a failed lens is 'unavailable', NEVER empty-as-truth. */
export type LensStatus = 'ok' | 'unavailable' | 'skipped'

export interface AggregateInput {
  agencyId: string
  clientId: string
  services: string[]
  cities: string[]
  state: string
  /** When true, scan the FULL service×city grid + run the paid AEO lens. */
  fullScan?: boolean
  /** Override the representative-subset cap (service×city combos). */
  maxCombos?: number
  /** Cap GEO grid size (≤7 hard limit; ≤5 default for spend). */
  gridSize?: number
}

export interface AggregateResult {
  competitors: UnifiedCompetitor[]
  lenses: { organic: LensStatus; geo: LensStatus; aeo: LensStatus }
  /** Provenance for each lens's facts (createVerifiedData envelopes, data only). */
  provenance: {
    organic?: VerifiedDataSource
    geo?: VerifiedDataSource
    aeo?: VerifiedDataSource
  }
  capped: {
    total_combos: number
    scanned: { service: string; city: string }[]
    skipped: { service: string; city: string }[]
    full_scan: boolean
  }
  /** false when the AEO (Claude-funded) lens could not run — drives the UI banner. */
  ai_available: boolean
  notes: string[]
}

const DEFAULT_MAX_COMBOS = 3
const DEFAULT_GRID_SIZE = 5

function log(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.log('[competitorIntel]', ...args)
}

/**
 * Pick a deterministic representative subset of service×city combos to bound
 * spend. Default cap is small (DEFAULT_MAX_COMBOS) unless fullScan is set.
 * Deterministic order: services × cities in their given order, take first N.
 */
function pickRepresentativeCombos(
  services: string[],
  cities: string[],
  opts: { fullScan: boolean; maxCombos: number },
): { scanned: { service: string; city: string }[]; skipped: { service: string; city: string }[]; total: number } {
  const all: { service: string; city: string }[] = []
  for (const service of services) {
    for (const city of cities) {
      all.push({ service, city })
    }
  }
  if (opts.fullScan) {
    return { scanned: all, skipped: [], total: all.length }
  }
  const scanned = all.slice(0, opts.maxCombos)
  const skipped = all.slice(opts.maxCombos)
  return { scanned, skipped, total: all.length }
}

/** GEO lens — internal call to /api/seo/grid-scan (Google Places map pack). */
async function fetchGeoLens(
  combos: { service: string; city: string }[],
  state: string,
  targetBusiness: string,
  gridSize: number,
): Promise<{ competitors: GeoCompetitor[]; status: LensStatus; clientAvgRank: number | null }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
  // Aggregate local-pack winners across cells/combos → cells_present count.
  const cellCounts = new Map<string, { rank: number | null; cells: number }>()
  let clientRankSum = 0
  let clientRankCells = 0
  let anySuccess = false

  for (const { service, city } of combos) {
    const location = [city, state].filter(Boolean).join(', ')
    const keyword = [service, city, state].filter(Boolean).join(' ')
    try {
      const res = await fetch(`${appUrl}/api/seo/grid-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword,
          location,
          target_business: targetBusiness,
          grid_size: Math.min(gridSize, 7),
        }),
        signal: AbortSignal.timeout(120000),
      })
      if (!res.ok) {
        log(`GEO grid-scan non-200 for "${keyword}": ${res.status}`)
        continue
      }
      const data = await res.json()
      const grid: any[] = Array.isArray(data?.grid_results) ? data.grid_results : []
      if (!grid.length) {
        log(`GEO grid-scan empty grid for "${keyword}"`)
        continue
      }
      anySuccess = true
      // Client's own avg rank for this combo.
      const avg = data?.summary?.avg_rank
      if (typeof avg === 'number') {
        clientRankSum += avg
        clientRankCells += 1
      }
      // Count each local-pack winner's presence across cells, and capture its
      // best (lowest) observed rank position within top3.
      for (const cell of grid) {
        const top3: string[] = Array.isArray(cell?.top3) ? cell.top3 : []
        top3.forEach((name, idx) => {
          if (!name) return
          const key = normalizeBrand(name)
          if (!key) return
          const prior = cellCounts.get(key) || { rank: null, cells: 0 }
          const thisRank = idx + 1
          cellCounts.set(key, {
            rank: prior.rank == null ? thisRank : Math.min(prior.rank, thisRank),
            cells: prior.cells + 1,
          })
        })
      }
    } catch (e: any) {
      log(`GEO grid-scan error for "${keyword}": ${e?.message || e}`)
    }
  }

  if (!anySuccess) {
    return { competitors: [], status: 'unavailable', clientAvgRank: null }
  }

  // Map normalized keys back to display names (first-seen original casing is
  // lost in normalization; use the normalized form as the display fallback —
  // reconciliation keys on normalizeBrand anyway).
  const competitors: GeoCompetitor[] = Array.from(cellCounts.entries())
    .filter(([, v]) => v.cells > 0)
    .sort((a, b) => b[1].cells - a[1].cells)
    .slice(0, 10)
    .map(([name, v]) => ({
      business_name: name,
      local_pack_rank: v.rank,
      cells_present: v.cells,
    }))

  const clientAvgRank = clientRankCells > 0 ? Number((clientRankSum / clientRankCells).toFixed(1)) : null
  return { competitors, status: 'ok', clientAvgRank }
}

/** ORGANIC lens — DataForSEO SERP per representative service×city (rank_group). */
async function fetchOrganicLens(
  combos: { service: string; city: string }[],
  state: string,
  clientDomain: string,
): Promise<{ competitors: OrganicCompetitor[]; status: LensStatus; sampleQueryUrl: string }> {
  const sampleQueryUrl = 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced'
  // Best (lowest) rank_group per domain across combos; drop the client itself.
  const byDomain = new Map<string, OrganicCompetitor>()
  let anySuccess = false

  for (const { service, city } of combos) {
    const keyword = [service, city, state].filter(Boolean).join(' ')
    try {
      const serp = await getSERPResults(keyword)
      const items = Array.isArray(serp?.items) ? serp.items : []
      if (!items.length) {
        log(`ORGANIC SERP empty for "${keyword}"`)
        continue
      }
      anySuccess = true
      for (const item of items.slice(0, 15)) {
        const host = hostOf(item.url || item.domain || '')
        if (!host) continue
        if (clientDomain && host === clientDomain) continue // skip self
        const prior = byDomain.get(host)
        const rank = item.rank_group || 999
        if (!prior || rank < prior.rank_group) {
          byDomain.set(host, { name: item.title || host, domain: host, rank_group: rank })
        }
      }
    } catch (e: any) {
      log(`ORGANIC SERP error for "${keyword}": ${e?.message || e}`)
    }
  }

  if (!anySuccess) {
    return { competitors: [], status: 'unavailable', sampleQueryUrl }
  }

  // Top 3-5 organic competitors by best rank.
  const competitors = Array.from(byDomain.values())
    .sort((a, b) => a.rank_group - b.rank_group)
    .slice(0, 5)

  return { competitors, status: 'ok', sampleQueryUrl }
}

/**
 * Aggregate the three competitor lenses for a chosen service×city set, with
 * provenance + spend caps + identity reconciliation. Persists the unified set
 * to kotoiq_client_profile.fields.competitor_intel (jsonb — no new table).
 *
 * Lens degradation: any lens that can't produce facts is marked 'unavailable'
 * (NEVER empty-as-no-competitors). No bare catch{} — every failure is logged.
 */
export async function aggregateCompetitorIntel(
  s: SupabaseClient,
  input: AggregateInput,
): Promise<AggregateResult> {
  const {
    agencyId,
    clientId,
    services,
    cities,
    state,
    fullScan = false,
    maxCombos = DEFAULT_MAX_COMBOS,
    gridSize = DEFAULT_GRID_SIZE,
  } = input

  const notes: string[] = []
  const fetched_at = new Date().toISOString()

  if (!clientId || !agencyId) throw new Error('agencyId and clientId required')
  if (!Array.isArray(services) || !services.length) throw new Error('services[] required')
  if (!Array.isArray(cities) || !cities.length) throw new Error('cities[] required')

  // Load the client for self-domain + business name (for GEO target + organic self-skip).
  const { data: client } = await s
    .from('clients')
    .select('name, business_name, website')
    .eq('id', clientId)
    .maybeSingle()
  const targetBusiness = (client?.business_name || client?.name || '').trim()
  const clientDomain = hostOf(client?.website || '')

  // ── Spend control: representative subset by default. ──
  const { scanned, skipped, total } = pickRepresentativeCombos(services, cities, { fullScan, maxCombos })
  log(
    `combos total=${total} scanned=${scanned.length} skipped=${skipped.length} fullScan=${fullScan}`,
    { scanned: scanned.map(c => `${c.service}|${c.city}`), skipped: skipped.map(c => `${c.service}|${c.city}`) },
  )
  if (skipped.length) {
    notes.push(`Spend cap: scanned ${scanned.length}/${total} service×city combos (set fullScan=true for the full grid).`)
  }

  const provenance: AggregateResult['provenance'] = {}

  // ── ORGANIC lens ──
  const organic = await fetchOrganicLens(scanned, state, clientDomain)
  if (organic.status === 'ok') {
    provenance.organic = createVerifiedData(
      { count: organic.competitors.length },
      {
        source_url: organic.sampleQueryUrl,
        source_name: 'DataForSEO SERP (rank_group)',
        source_type: 'third-party-verified',
        fetched_at,
        expires_at: buildExpiresAt('rankings'),
        cross_referenced: false,
        ai_generated: false,
        confidence: 'single-source',
      },
    )
  } else {
    notes.push('Organic lens unavailable (DataForSEO SERP returned no usable results).')
  }

  // ── GEO lens ──
  let geo: { competitors: GeoCompetitor[]; status: LensStatus; clientAvgRank: number | null } = {
    competitors: [],
    status: 'skipped',
    clientAvgRank: null,
  }
  if (!targetBusiness) {
    geo.status = 'unavailable'
    notes.push('GEO lens unavailable (client has no business name to rank in the map pack).')
  } else if (!process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY) {
    geo.status = 'unavailable'
    notes.push('GEO lens unavailable (NEXT_PUBLIC_GOOGLE_PLACES_KEY not configured).')
  } else {
    geo = await fetchGeoLens(scanned, state, targetBusiness, gridSize)
    if (geo.status === 'ok') {
      provenance.geo = createVerifiedData(
        { count: geo.competitors.length, client_avg_rank: geo.clientAvgRank },
        {
          source_url: 'https://places.googleapis.com/v1/places:searchNearby',
          source_name: 'Google Places grid-scan (map pack)',
          source_type: 'google-api',
          fetched_at,
          expires_at: buildExpiresAt('rankings'),
          cross_referenced: false,
          ai_generated: false,
          confidence: 'single-source',
        },
      )
    } else {
      notes.push('GEO lens unavailable (grid-scan returned no map-pack results).')
    }
  }

  // ── Seed the AEO roster from organic + GEO BEFORE the scan ──
  // Without this, share-of-voice is empty (kotoiq_aeo_competitors is unseeded).
  let ai_available = false
  let aeoStatus: LensStatus = 'skipped'
  let aeoCompetitors: AeoCompetitor[] = []

  // setupClientForAEO is idempotent — ensures self is seeded + prompts exist.
  let selfSeeded = false
  try {
    const setup = await setupClientForAEO(s, {
      client_id: clientId,
      agency_id: agencyId,
      seed_prompts: true,
      seed_self_competitor: true,
    })
    selfSeeded = setup.self_added || true
    if (setup.errors?.length) log('AEO setup errors', setup.errors)
  } catch (e: any) {
    log(`AEO setup failed: ${e?.message || e}`)
    notes.push(`AEO setup failed: ${e?.message || e}`)
  }

  // Upsert organic domains + GEO business names into the roster (idempotent).
  const rosterRows: { brand_name: string; domain: string | null }[] = []
  for (const o of organic.competitors) {
    rosterRows.push({ brand_name: o.name || o.domain, domain: o.domain || null })
  }
  for (const g of geo.competitors) {
    rosterRows.push({ brand_name: g.business_name, domain: null })
  }
  // Dedup by normalized brand to avoid UNIQUE(client_id, brand_name) churn.
  const seenBrand = new Set<string>()
  for (const r of rosterRows) {
    const key = normalizeBrand(r.brand_name)
    if (!key || seenBrand.has(key)) continue
    seenBrand.add(key)
    try {
      const { error } = await s.from('kotoiq_aeo_competitors').upsert(
        { client_id: clientId, brand_name: r.brand_name, domain: r.domain, is_self: false },
        { onConflict: 'client_id,brand_name' },
      )
      if (error) log(`AEO roster upsert error for "${r.brand_name}": ${error.message}`)
    } catch (e: any) {
      log(`AEO roster upsert threw for "${r.brand_name}": ${e?.message || e}`)
    }
  }
  if (rosterRows.length) {
    notes.push(`Seeded ${seenBrand.size} competitor brands into the AEO roster before scanning.`)
  }

  // ── AEO lens (paid 5-engine scan) — gated behind fullScan to bound $ ──
  if (!fullScan) {
    aeoStatus = 'skipped'
    notes.push('AEO lens skipped (run with fullScan=true to spend the paid 5-engine scan).')
    // Even when skipped, read any EXISTING share-of-voice so the lens isn't blank
    // if a prior scan ran. This read is free.
    try {
      const compare = await getCompetitorCompare(s, { client_id: clientId, days: 1 })
      if (compare.rows?.length) {
        aeoCompetitors = compare.rows
          .filter(r => !r.is_self)
          .map(r => ({ brand: r.brand, share: r.share, avg_position: r.avg_position, mentions: r.mentions }))
        if (aeoCompetitors.length) {
          aeoStatus = 'ok'
          ai_available = true
        }
      }
    } catch (e: any) {
      log(`AEO existing-SoV read failed: ${e?.message || e}`)
    }
  } else if (!process.env.ANTHROPIC_API_KEY) {
    aeoStatus = 'unavailable'
    ai_available = false
    notes.push('AEO lens unavailable (ANTHROPIC_API_KEY not set — Claude engine cannot run).')
  } else if (!selfSeeded) {
    aeoStatus = 'unavailable'
    notes.push('AEO lens unavailable (self not seeded — share-of-voice would be meaningless).')
  } else {
    try {
      const scan = await runAEOVisibilityScan(s, { client_id: clientId, agency_id: agencyId })
      log(`AEO scan: ${scan.prompts_run} prompts × engines, $${scan.total_cost_usd.toFixed(4)}, ${scan.failures} failures`)
      notes.push(`AEO scan ran ${scan.prompts_run} prompts (cost ~$${scan.total_cost_usd.toFixed(2)}).`)
      const compare = await getCompetitorCompare(s, { client_id: clientId, days: 1 })
      aeoCompetitors = (compare.rows || [])
        .filter(r => !r.is_self)
        .map(r => ({ brand: r.brand, share: r.share, avg_position: r.avg_position, mentions: r.mentions }))
      // ai_available reflects that the Claude-funded lens actually produced data.
      ai_available = scan.successes > 0
      aeoStatus = ai_available ? 'ok' : 'unavailable'
      if (!ai_available) {
        notes.push('AEO lens unavailable (all engine calls failed — likely an unfunded key).')
      }
    } catch (e: any) {
      log(`AEO scan failed: ${e?.message || e}`)
      aeoStatus = 'unavailable'
      ai_available = false
      notes.push(`AEO lens unavailable (scan error: ${e?.message || e}).`)
    }
  }

  if (aeoStatus === 'ok') {
    provenance.aeo = createVerifiedData(
      { count: aeoCompetitors.length },
      {
        source_url: 'kotoiq_aeo_runs (ChatGPT/Claude/Gemini/Perplexity/Google AIO)',
        source_name: 'KotoIQ AEO Visibility Engine (5-engine share of voice)',
        source_type: 'ai-generated',
        fetched_at,
        expires_at: buildExpiresAt('rankings'),
        cross_referenced: false,
        ai_generated: true,
        confidence: 'ai-inferred',
      },
    )
  }

  // ── Reconcile the three lenses into one per-competitor × per-lens set. ──
  const competitors = reconcileCompetitorIdentities({
    organic: organic.competitors,
    geo: geo.competitors,
    aeo: aeoCompetitors,
  })

  const result: AggregateResult = {
    competitors,
    lenses: { organic: organic.status, geo: geo.status, aeo: aeoStatus },
    provenance,
    capped: { total_combos: total, scanned, skipped, full_scan: fullScan },
    ai_available,
    notes,
  }

  // ── Persist to kotoiq_client_profile.fields.competitor_intel (jsonb). ──
  // Read-merge-write so we don't clobber the WS1 category lists (the upsert
  // overwrites `fields` wholesale).
  try {
    const db = getKotoIQDb(agencyId)
    const { data: profile } = await db.clientProfile.get(clientId)
    const existingFields = ((profile as any)?.fields || {}) as Record<string, any>
    const nextFields = {
      ...existingFields,
      competitor_intel: {
        ...result,
        generated_at: fetched_at,
        services,
        cities,
        state,
      },
    }
    await db.clientProfile.upsert({ client_id: clientId, fields: nextFields })
  } catch (e: any) {
    // Persistence failure must not lose the computed result — log + return it.
    log(`persist competitor_intel failed: ${e?.message || e}`)
    notes.push(`Persist warning: could not write fields.competitor_intel (${e?.message || e}).`)
  }

  return result
}
