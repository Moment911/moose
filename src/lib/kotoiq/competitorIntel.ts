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
// (appended below)
// ─────────────────────────────────────────────────────────────
